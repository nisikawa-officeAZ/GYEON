import "server-only";

// SERVER ONLY — Uses LINE access token from dealer_settings.
// Never expose access_token to client.
//
// R90B — INTERNAL SERVER MODULE, not a Server Action.
//
// This is a GENERIC transport: it accepts a recipient, arbitrary message content
// and log options. As a "use server" module that generic surface was a
// client-callable endpoint, so a browser could push any text to any LINE user
// the dealer can reach. No production callsite outside this directory needs
// that. The estimate feature's client boundary is `send-estimate-line.ts`, whose
// only client argument is an estimateId — everything else is resolved here,
// server-side. `server-only` enforces that at build time.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { LineMessage } from "./line-types";
import { LineMessagePurpose } from "./line-message-types";
import { createPendingLog, markLogSent, markLogFailed } from "./create-line-message-log";
import { redactShareLog } from "./line-log-redaction";

const LINE_API_BASE = "https://api.line.me/v2/bot";

// ── Result ──────────────────────────────────────────────────────────────────

/**
 * Why a send did not succeed. Additive and OPTIONAL, so the historical
 * `{ error: string }` shape every existing caller matches on is preserved.
 */
export type LineSendFailureReason =
  | "line-disabled"
  | "no-access-token"
  /** `requireLog` was set and the pending log could not be created — nothing was sent. */
  | "log-unavailable"
  /** The LINE API answered with a non-OK status. */
  | "api-failure";

export type LineSendResult =
  | { success: true }
  | { error: string; reason?: LineSendFailureReason };

/**
 * Extra log fields, merged BESIDE the canonical messages (never over them).
 *
 * Flat scalars only. The type is a convenience, not the security boundary — the
 * boundary is that this module is server-only and the estimate action accepts no
 * metadata from its caller at all.
 */
export type LineLogMetadata = Readonly<Record<string, string | number | boolean | null>>;

// ─── Fetch LINE profile (server-side) ────────────────────────────────────────

export async function fetchLineProfile(
  lineUserId: string,
  accessToken: string
): Promise<{ userId: string; displayName: string; pictureUrl?: string; statusMessage?: string } | null> {
  const res = await fetch(`${LINE_API_BASE}/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Send push message (with log) ────────────────────────────────────────────

export async function sendLineMessage(
  lineUserId: string,
  outboundMessages: LineMessage[],
  options?: {
    purpose?:         LineMessagePurpose;
    title?:           string | null;
    body?:            string;
    customerId?:      string | null;
    lineCustomerId?:  string | null;
    /** Extra audit fields, stored under `payload.metadata`. Never replaces `payload.messages`. */
    logMetadata?:     LineLogMetadata;
    /**
     * FAIL CLOSED on audit loss. When true, a pending log that cannot be created
     * aborts the send: no last_message_at write, no LINE call. Left undefined by
     * the pre-existing internal senders, whose best-effort behaviour is unchanged.
     */
    requireLog?:      boolean;
    /**
     * pdf-link ONLY. When true, the AUDIT copy (body + payload.messages) is
     * replaced with a fixed placeholder while LINE still receives the original
     * `outboundMessages`. If a safe audit copy cannot be produced, the send FAILS
     * CLOSED before the LINE request. A closed boolean flag — never accepts a
     * caller-supplied replacement string.
     */
    redactLog?:       boolean;
  }
): Promise<LineSendResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  // Tenant-scoped session client: dealer_settings and line_customers both grant
  // authenticated SELECT/INSERT/UPDATE (migration 104), so RLS still applies.
  const supabase = await createClient();

  // Log-mutation client. SEPARATE and deliberately minimal in scope: migration
  // 104 grants `authenticated` SELECT ONLY on line_message_logs, so every write
  // through the session client silently no-ops and the audit trail is lost.
  // Created only AFTER the dealer is resolved, used ONLY for the three log
  // helpers below, and never returned, logged or handed to anything else.
  const logSupabase = createAdminClient();

  const { data: settings } = await supabase
    .from("dealer_settings")
    .select("line_access_token, line_enabled")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!settings?.line_enabled)       return { error: "LINE連携が無効です", reason: "line-disabled" };
  if (!settings?.line_access_token)  return { error: "LINEアクセストークンが設定されていません", reason: "no-access-token" };

  const purpose: LineMessagePurpose = options?.purpose ?? "manual";

  // `outboundMessages` is what LINE receives. `messages`/`body` are the AUDIT copy
  // persisted to line_message_logs. They are identical for ordinary sends (text
  // mode is byte-for-byte unchanged); for a redacted pdf-link send they diverge —
  // LINE keeps the working URL below, the log gets a fixed placeholder.
  let messages: LineMessage[] = outboundMessages;
  let body = options?.body ?? (outboundMessages[0] && "text" in outboundMessages[0] ? outboundMessages[0].text : "");
  if (options?.redactLog) {
    const safe = redactShareLog({ messages: outboundMessages, body });
    // FAIL CLOSED before any write or LINE call: an un-auditable share URL must
    // never be delivered-and-forgotten.
    if (!safe.ok) {
      return { error: "監査用の送信記録を安全に作成できませんでした", reason: "log-unavailable" };
    }
    messages = safe.messages;
    body = safe.body;
  }

  // Create pending log. The AUDIT `messages` is spread FIRST and metadata lands on
  // its own key, so metadata can never overwrite the canonical payload.
  const logId = await createPendingLog(logSupabase, dealer.dealer_id, {
    line_user_id:     lineUserId,
    customer_id:      options?.customerId     ?? null,
    line_customer_id: options?.lineCustomerId ?? null,
    message_type:     messages[0]?.type       ?? "text",
    purpose,
    title:            options?.title          ?? null,
    body,
    payload:          options?.logMetadata
      ? { messages, metadata: options.logMetadata }
      : { messages },
  });

  // No auditable record → no send. Returning before last_message_at keeps the
  // customer's conversation state honest about what was actually delivered.
  if (options?.requireLog && !logId) {
    return { error: "送信記録を作成できませんでした", reason: "log-unavailable" };
  }

  // Update last_message_at
  await supabase
    .from("line_customers")
    .update({ last_message_at: new Date().toISOString() })
    .eq("dealer_id", dealer.dealer_id)
    .eq("line_user_id", lineUserId);

  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${settings.line_access_token}`,
    },
    // The ORIGINAL messages — LINE receives the working share URL even when the
    // audit copy above was redacted.
    body: JSON.stringify({ to: lineUserId, messages: outboundMessages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = (err as { message?: string }).message ?? res.statusText;
    console.error("sendLineMessage error:", err);
    if (logId) await markLogFailed(logSupabase, logId, dealer.dealer_id, errMsg);
    return { error: `LINE送信エラー: ${errMsg}`, reason: "api-failure" };
  }

  if (logId) await markLogSent(logSupabase, logId, dealer.dealer_id);
  return { success: true };
}

// ─── Send text message (convenience) ─────────────────────────────────────────

export async function sendLineTextMessage(
  lineUserId: string,
  text: string,
  options?: {
    purpose?:        LineMessagePurpose;
    title?:          string | null;
    customerId?:     string | null;
    lineCustomerId?: string | null;
    logMetadata?:    LineLogMetadata;
    requireLog?:     boolean;
    /** pdf-link only — see sendLineMessage. Flows through untouched. */
    redactLog?:      boolean;
  }
): Promise<LineSendResult> {
  return sendLineMessage(
    lineUserId,
    [{ type: "text", text }],
    { ...options, body: text }
  );
}

// ─── Completion report notification ──────────────────────────────────────────

export async function sendCompletionNotification(
  customerId: string,
  workOrderNumber: string,
  reportUrl?: string
): Promise<{ error: string } | { success: true } | { skipped: true; reason: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  const { data: lineCustomer } = await supabase
    .from("line_customers")
    .select("id, line_user_id, is_friend")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .eq("is_friend", true)
    .maybeSingle();

  if (!lineCustomer) {
    return { skipped: true, reason: "顧客のLINE連携がありません" };
  }

  const text = reportUrl
    ? `施工が完了しました。\n作業指示書: ${workOrderNumber}\n\n完了報告書はこちら:\n${reportUrl}`
    : `施工が完了しました。\n作業指示書: ${workOrderNumber}\n\nご不明な点はお気軽にご連絡ください。`;

  return sendLineTextMessage(lineCustomer.line_user_id, text, {
    purpose:        "completion_report",
    title:          `完了報告 ${workOrderNumber}`,
    customerId,
    lineCustomerId: lineCustomer.id,
  });
}

// ─── Maintenance reminder notification ───────────────────────────────────────

export async function sendMaintenanceReminder(
  customerId: string,
  bookingUrl?: string
): Promise<{ error: string } | { success: true } | { skipped: true; reason: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  const { data: lineCustomer } = await supabase
    .from("line_customers")
    .select("id, line_user_id, is_friend")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .eq("is_friend", true)
    .maybeSingle();

  if (!lineCustomer) {
    return { skipped: true, reason: "顧客のLINE連携がありません" };
  }

  const text = bookingUrl
    ? `そろそろメンテナンスの時期です。\nコーティングのメンテナンスでお車を最良の状態に保ちましょう。\n\nご予約はこちら:\n${bookingUrl}`
    : `そろそろメンテナンスの時期です。\nコーティングのメンテナンスでお車を最良の状態に保ちましょう。\nお気軽にご相談ください。`;

  return sendLineTextMessage(lineCustomer.line_user_id, text, {
    purpose:        "maintenance_reminder",
    title:          "メンテナンス通知",
    customerId,
    lineCustomerId: lineCustomer.id,
  });
}
