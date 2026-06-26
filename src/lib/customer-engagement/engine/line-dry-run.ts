// DealerOS — Customer Engagement Engine: LINE Action Dry-Run
//
// Validates all preconditions for a LINE workflow action without making
// any external API calls or database writes.
//
// Sprint 10H: dry-run only — prepares typed payloads for Phase G-B execution.
// Sprint 10H does NOT call LINE API. Sprint 10H does NOT send real messages.
//
// Security: dealer_id is always from EngagementContext (injected via getCurrentDealer()).
// This module never accepts dealer_id from client-provided input.

import { createClient }      from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/plans/can-use-feature";
import type { AppFeature }    from "@/lib/plans/plan-types";
import type { EngagementAction, EngagementContext } from "../types";
import type { LineMessagePurpose }                  from "@/lib/line/line-message-types";

// ─── Result types ─────────────────────────────────────────────────────────────

export type LineActionReadinessStatus =
  | "ready"
  | "skipped_feature_disabled"
  | "skipped_line_not_enabled"
  | "skipped_missing_line_settings"
  | "skipped_missing_customer_line_link";

export interface LineActionPayload {
  line_user_id:     string;
  line_customer_id: string;
  customer_id:      string;
  dealer_id:        string;
  purpose:          LineMessagePurpose;
  message_text:     string;
  /** Populated when the action has delay_hours > 0 — computed send time. */
  scheduled_for?:   string;    // ISO 8601
  /** True when the dealer's GBP review URL is available. */
  has_review_url:   boolean;
  review_url?:      string;    // null until dealer_settings.gbp_review_url is added (Phase G-B)
}

export interface LineActionReadinessResult {
  status:   LineActionReadinessStatus;
  /** Fully prepared payload — present only when status === "ready". */
  payload?: LineActionPayload;
  /** Japanese reason — present when status !== "ready". */
  reason?:  string;
}

// ─── Readiness validation ─────────────────────────────────────────────────────

/**
 * Validates all LINE action preconditions and prepares the message payload.
 * Does NOT call the LINE API. Does NOT write to any table.
 *
 * Returns "ready" with a fully-populated payload when every gate passes.
 * Returns a typed "skipped_*" status with a Japanese reason when any gate fails.
 */
export async function validateLineActionReadiness(
  action: EngagementAction,
  context: EngagementContext,
): Promise<LineActionReadinessResult> {
  // ── Gate 1: Feature flag ─────────────────────────────────────────────────
  const lineFeature: AppFeature = action.required_feature ?? "line";
  const hasLine = await checkFeatureAccess(lineFeature);
  if (!hasLine) {
    return {
      status: "skipped_feature_disabled",
      reason: `この機能はプランの制限により利用できません（${lineFeature}）`,
    };
  }

  const supabase = await createClient();

  // ── Gate 2: Dealer LINE settings ─────────────────────────────────────────
  // Check line_enabled and token presence only — never read the token value.
  const { data: lineSettings } = await supabase
    .from("dealer_settings")
    .select("line_enabled, line_access_token")
    .eq("dealer_id", context.dealer_id)
    .maybeSingle();

  if (!lineSettings?.line_enabled) {
    return {
      status: "skipped_line_not_enabled",
      reason: "LINE連携が無効です。設定画面でLINEを有効にしてください",
    };
  }
  if (!lineSettings?.line_access_token) {
    return {
      status: "skipped_missing_line_settings",
      reason: "LINEアクセストークンが設定されていません",
    };
  }

  // ── Gate 3: Customer LINE linkage ─────────────────────────────────────────
  const { data: lineCustomer } = await supabase
    .from("line_customers")
    .select("id, line_user_id, is_friend")
    .eq("dealer_id", context.dealer_id)
    .eq("customer_id", context.customer_id)
    .eq("is_friend", true)
    .maybeSingle();

  if (!lineCustomer) {
    return {
      status: "skipped_missing_customer_line_link",
      reason: "この顧客はLINEと連携されていないか、まだ友だち登録されていません",
    };
  }

  // ── Build payload ─────────────────────────────────────────────────────────
  const purpose   = resolvePurpose(action.type);
  const textBody  = buildMessageText(action, context);
  const scheduled = action.delay_hours > 0
    ? new Date(Date.now() + action.delay_hours * 3_600_000).toISOString()
    : undefined;

  return {
    status: "ready",
    payload: {
      line_user_id:     lineCustomer.line_user_id,
      line_customer_id: lineCustomer.id,
      customer_id:      context.customer_id,
      dealer_id:        context.dealer_id,
      purpose,
      message_text:     textBody,
      scheduled_for:    scheduled,
      has_review_url:   false,   // Pending dealer_settings.gbp_review_url (Phase G-B)
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolvePurpose(actionType: EngagementAction["type"]): LineMessagePurpose {
  switch (actionType) {
    case "request_review":              return "review_request";
    case "schedule_maintenance_reminder": return "maintenance_reminder";
    default:                            return "system";
  }
}

function buildMessageText(
  action: EngagementAction,
  _context: EngagementContext,
): string {
  switch (action.type) {
    case "send_line_message":
      return action.config.template_id === "completion_notification_v1"
        ? "施工が完了しました。ご利用ありがとうございました。"
        : action.config.template_id === "welcome_message_v1"
          ? "ご登録ありがとうございます。またのご利用をお待ちしております。"
          : action.config.template_id === "maintenance_reminder_v1"
            ? "そろそろメンテナンスの時期です。コーティングの状態確認にお立ち寄りください。"
            : action.config.template_id === "maintenance_followup_v1"
              ? "先日メンテナンスのご案内をお送りしました。ご都合はいかがでしょうか？"
              : "お知らせがあります。";

    case "request_review":
      // Phase G-A: no GBP URL available yet — static text with placeholder note.
      // Phase G-B: use dealer_settings.gbp_review_url + Reputation Agent AI generation.
      return "施工ありがとうございました。"
        + "よろしければ、Googleレビューにご協力いただけますと幸いです。"
        + "率直なご感想で問題ございません。";

    default:
      return "";
  }
}
