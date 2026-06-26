"use server";

// DealerOS — Reputation Platform: Review Request Approval Server Actions
//
// Sprint 11E Phase D — initial implementation.
// Sprint 11F Phase E — added LINE message preview (buildReviewLineMessagePreview).
//
// Actions:
//   prepareReviewRequestApproval()   — builds the dry-run approval data for the UI
//   approveReviewRequestDryRun()     — records dealer approval (dry-run, no LINE send)
//   rejectReviewRequestDryRun()      — records dealer rejection (dry-run)
//   skipReviewRequestDryRun()        — records dealer skip (dry-run)
//
// Security rules (enforced in every action):
//   - dealer_id always from getCurrentDealer() — never from client input
//   - Work order ownership validated via dealer_id scope on every DB read
//   - Customer ownership: work order must belong to dealer (cascading validation)
//   - Vehicle ownership: validated through the work order record
//   - Pro+ feature gate: ai_reputation checked before any work begins
//   - No LINE messages sent
//   - No AI provider calls
//   - No API keys exposed
//   - No fake persistence — state is dry-run only
//
// Persistence note:
//   ReviewRequest objects are NOT persisted in Sprint 11E/11F.
//   Persistence requires the `review_requests` DB table migration (CTO approval pending).
//   All approve/reject/skip actions return dry_run: true to document this constraint.

import { getCurrentDealer }                  from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }                from "@/lib/plans/can-use-feature";
import { getWorkOrder }                      from "@/lib/work-orders/get-work-order";
import {
  workOrderCustomerName,
  workOrderVehicleLabel,
}                                            from "@/lib/work-orders/work-order-types";
import { getDealerSettings }                 from "@/lib/line/get-line-settings";
import { checkReputationGatewayReadiness }   from "@/lib/reputation/runtime/gateway-readiness";
import {
  checkReputationCompliance,
  buildCleanComplianceContext,
  REPUTATION_COMPLIANCE_CHECKLIST,
}                                            from "@/lib/reputation/runtime/compliance-guard";
import { buildReviewRequestDryRun }          from "@/lib/reputation/runtime/review-request-dryrun";
import { DEFAULT_REPUTATION_POLICY }         from "@/lib/reputation/reputation-profile";
import type { ReviewDestination }            from "@/lib/reputation/reputation-types";
import type {
  ReputationReadinessCheck,
  ReputationComplianceCheckItem,
}                                            from "@/lib/reputation/runtime/runtime-types";
import {
  buildReviewLineMessagePreview,
}                                            from "@/lib/reputation/line/review-line-message-builder";
import type {
  ReviewLineMessageContext,
  ReviewLineMessagePreview,
}                                            from "@/lib/reputation/line/review-line-types";
import { randomUUID }                        from "crypto";

// ─── Result types ─────────────────────────────────────────────────────────────

/**
 * ReviewRequestApprovalStatus — describes what the UI should show.
 *
 * "ready"             — All checks pass; dealer can approve
 * "not_ready"         — Missing settings; show what needs to be configured
 * "feature_locked"    — ai_reputation feature not in dealer plan
 * "no_customer"       — Work order has no customer_id or work order not found
 * "gateway_locked"    — AI Gateway has blocking failures
 * "compliance_blocked"— Compliance guard raised a blocking violation
 */
export type ReviewRequestApprovalStatus =
  | "ready"
  | "not_ready"
  | "feature_locked"
  | "no_customer"
  | "gateway_locked"
  | "compliance_blocked";

/**
 * ReviewRequestApprovalData — the full dry-run approval payload returned to the UI.
 *
 * message_preview:      Sprint 11F — deterministic LINE message preview.
 *                       null if feature_locked, no_customer, or dealer data unavailable.
 * draft_message:        null — AI-generated message is Phase 11G+ (AI provider adapter).
 * persisted_request_id: null — requires review_requests DB table (pending migration).
 */
export interface ReviewRequestApprovalData {
  status:               ReviewRequestApprovalStatus;
  customer_name:        string | null;
  vehicle_label:        string | null;
  service_summary:      string | null;
  readiness_checks:     ReputationReadinessCheck[];
  missing_settings:     string[];
  compliance_checklist: ReputationComplianceCheckItem[];
  blocking_reasons:     string[];
  /**
   * Sprint 11F: deterministic LINE message preview from ReviewLineMessageBuilder.
   * Includes message_text, link_readiness, compliance validation, and character count.
   * dispatch_payload is always null — real LINE dispatch requires Phase 11G+.
   */
  message_preview:      ReviewLineMessagePreview | null;
  /**
   * Always null — AI-generated review suggestion requires Phase 11G+ (AI provider adapter).
   * Distinct from message_preview: this field will hold the AI-crafted review text,
   * not the LINE dispatch message.
   */
  draft_message:        null;
  /**
   * Always null — persistence requires review_requests table (CTO approval pending).
   */
  persisted_request_id: null;
  prepared_at:          string;  // ISO 8601
}

/**
 * ReviewRequestDryRunActionResult — result returned by approve/reject/skip actions.
 *
 * dry_run: true — permanently set in Sprint 11E; no real execution occurs.
 */
export type ReviewRequestDryRunActionResult =
  | { success: true;  action: "approved" | "rejected" | "skipped"; dry_run: true;  message: string }
  | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the unconfigured "google" placeholder destination used when no
 * reputation settings DB table exists yet. All fields indicate "not set".
 */
function buildPlaceholderDestination(dealerId: string): ReviewDestination {
  return {
    id:            "",
    dealer_id:     dealerId,
    platform:      "google",
    label:         "Google ビジネスプロフィール",
    review_url:    null,
    enabled:       false,
    available_now: false,
    blocked_by:    "Reputation settings not yet configured",
  };
}

// ─── prepareReviewRequestApproval ────────────────────────────────────────────

/**
 * prepareReviewRequestApproval — builds the full dry-run approval dataset.
 *
 * Orchestrates:
 *   1. Auth + dealer_id from getCurrentDealer()
 *   2. Feature gate: ai_reputation
 *   3. Work order ownership validation (dealer_id scoped)
 *   4. Customer existence check
 *   5. AI Gateway readiness + dealer settings (parallel)
 *   6. Compliance guard (Phase D)
 *   7. Review request dry-run (Phase C)
 *   8. LINE message preview (Phase E / Sprint 11F)
 *
 * Returns ReviewRequestApprovalData — always serializable, no class instances.
 * Never sends LINE. Never calls AI provider. Never persists data.
 */
export async function prepareReviewRequestApproval(
  workOrderId: string,
): Promise<ReviewRequestApprovalData> {
  const now = new Date().toISOString();

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return {
      status:               "no_customer",
      customer_name:        null,
      vehicle_label:        null,
      service_summary:      null,
      readiness_checks:     [],
      missing_settings:     ["ログインが必要です"],
      compliance_checklist: [],
      blocking_reasons:     ["認証エラー"],
      message_preview:      null,
      draft_message:        null,
      persisted_request_id: null,
      prepared_at:          now,
    };
  }

  // ── 2. Feature gate ──────────────────────────────────────────────────────────
  const hasFeature = await checkFeatureAccess("ai_reputation");
  if (!hasFeature) {
    return {
      status:               "feature_locked",
      customer_name:        null,
      vehicle_label:        null,
      service_summary:      null,
      readiness_checks:     [],
      missing_settings:     ["Pro+プランへのアップグレードが必要です"],
      compliance_checklist: [],
      blocking_reasons:     ["ai_reputation feature requires Pro+ plan"],
      message_preview:      null,
      draft_message:        null,
      persisted_request_id: null,
      prepared_at:          now,
    };
  }

  // ── 3. Work order ownership + 4. Customer check ──────────────────────────────
  const wo = await getWorkOrder(workOrderId);
  if (!wo) {
    return {
      status:               "no_customer",
      customer_name:        null,
      vehicle_label:        null,
      service_summary:      null,
      readiness_checks:     [],
      missing_settings:     ["作業指示書が見つかりません"],
      compliance_checklist: [],
      blocking_reasons:     ["Work order not found or not authorized"],
      message_preview:      null,
      draft_message:        null,
      persisted_request_id: null,
      prepared_at:          now,
    };
  }

  if (!wo.customer_id) {
    return {
      status:               "no_customer",
      customer_name:        null,
      vehicle_label:        workOrderVehicleLabel(wo.vehicles),
      service_summary:      wo.service_summary,
      readiness_checks:     [],
      missing_settings:     ["顧客情報を作業指示書に紐付けてください"],
      compliance_checklist: [],
      blocking_reasons:     ["Work order has no linked customer"],
      message_preview:      null,
      draft_message:        null,
      persisted_request_id: null,
      prepared_at:          now,
    };
  }

  const customerName   = workOrderCustomerName(wo.customers);
  const vehicleLabel   = workOrderVehicleLabel(wo.vehicles);
  const serviceSummary = wo.service_summary;

  // ── 5. AI Gateway readiness + dealer settings (parallel) ─────────────────────
  const [gatewayReadiness, dealerSettings] = await Promise.all([
    checkReputationGatewayReadiness(),
    getDealerSettings(),
  ]);

  // ── 6. Compliance guard (Phase D) ────────────────────────────────────────────
  const complianceResult = checkReputationCompliance(
    buildCleanComplianceContext(),
    now,
  );

  // ── 7. Review request dry-run (Phase C) ──────────────────────────────────────
  const destination = buildPlaceholderDestination(dealer.dealer_id);
  const actionId    = randomUUID();

  const dryRun = buildReviewRequestDryRun(
    {
      dealer_id:              dealer.dealer_id,
      customer_id:            wo.customer_id,
      vehicle_id:             wo.vehicle_id ?? undefined,
      work_order_id:          workOrderId,
      service_summary:        serviceSummary ?? "",
      destination,
      language_preference:    "ja",
      reputation_policy:      DEFAULT_REPUTATION_POLICY,
      gateway_ready:          gatewayReadiness.overall === "ready",
      customer_eligible:      true,  // No DB to check 30-day window in Sprint 11F
      destination_configured: false, // No reputation settings DB table yet
    },
    actionId,
    now,
  );

  // ── 8. LINE message preview (Sprint 11F Phase E) ──────────────────────────────
  //
  // Build the deterministic LINE review request message for the approval UI.
  // google_review_url and instagram_url are null — no reputation settings table yet.
  // website_url comes from dealer_settings.business_website.
  // No LINE API calls. No AI inference.
  const messageContext: ReviewLineMessageContext = {
    dealer_id:           dealer.dealer_id,
    dealer_name:         dealerSettings?.business_name ?? null,
    customer_last_name:  wo.customers?.last_name ?? null,
    customer_first_name: wo.customers?.first_name ?? null,
    vehicle_label:       vehicleLabel !== "—" ? vehicleLabel : null,
    service_summary:     serviceSummary,
    google_review_url:   null,   // Requires reputation_settings table (CTO approval pending)
    website_url:         dealerSettings?.business_website ?? null,
    instagram_url:       null,   // Requires reputation_settings table (CTO approval pending)
    facebook_url:        null,   // Requires reputation_settings table (CTO approval pending)
    language_preference: "ja",
  };

  const messagePreview = buildReviewLineMessagePreview(messageContext, now);

  // ── Derive overall status ─────────────────────────────────────────────────────
  const hasGatewayBlock    = gatewayReadiness.blocking_count > 0;
  const hasComplianceBlock = !complianceResult.passed;

  const status: ReviewRequestApprovalStatus =
    hasComplianceBlock        ? "compliance_blocked" :
    hasGatewayBlock           ? "gateway_locked"     :
    dryRun.all_checks_passed  ? "ready"              : "not_ready";

  // Merge readiness checks: gateway checks first, then workflow checks
  const workflowChecks = dryRun.readiness_checks.filter(
    (wc) => !gatewayReadiness.checks.some((gc) => gc.name === wc.name),
  );
  const allChecks: ReputationReadinessCheck[] = [
    ...gatewayReadiness.checks,
    ...workflowChecks,
  ];

  const blockingReasons: string[] = [
    ...gatewayReadiness.checks.filter((c) => c.status === "failed" && c.blocking).map((c) => c.message),
    ...complianceResult.violations.map((v) => v.description),
    ...dryRun.readiness_checks.filter((c) => c.status === "failed" && c.blocking).map((c) => c.message),
  ];

  // Merge missing settings: workflow + link readiness missing destinations
  const linkMissingSettings = messagePreview.link_readiness.items
    .filter((i) => i.status !== "ready")
    .map((i) => `${i.label}: URLが未設定（将来の設定画面で追加可能）`);

  const allMissingSettings = [
    ...dryRun.required_missing_settings,
    ...linkMissingSettings,
  ];

  return {
    status,
    customer_name:        customerName,
    vehicle_label:        vehicleLabel,
    service_summary:      serviceSummary,
    readiness_checks:     allChecks,
    missing_settings:     allMissingSettings,
    compliance_checklist: [...REPUTATION_COMPLIANCE_CHECKLIST] as ReputationComplianceCheckItem[],
    blocking_reasons:     blockingReasons,
    message_preview:      messagePreview,
    draft_message:        null,
    persisted_request_id: null,
    prepared_at:          now,
  };
}

// ─── approveReviewRequestDryRun ───────────────────────────────────────────────

/**
 * approveReviewRequestDryRun — records dealer approval of the review request plan.
 *
 * Validates:
 *   - Dealer auth + ownership of work order
 *   - Pro+ feature gate
 *   - Work order is "completed"
 *   - Customer exists on work order
 *   - Compliance guard
 *
 * No LINE message is sent.
 * No AI provider is called.
 * No ReviewRequest record is persisted (review_requests table pending migration).
 * Returns dry_run: true to document this constraint explicitly.
 */
export async function approveReviewRequestDryRun(
  workOrderId: string,
): Promise<ReviewRequestDryRunActionResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー。再ログインしてください。" };

  const hasFeature = await checkFeatureAccess("ai_reputation");
  if (!hasFeature) return { success: false, error: "この機能は Pro+ プランが必要です。" };

  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { success: false, error: "作業指示書が見つかりません。" };
  if (!wo.customer_id) return { success: false, error: "顧客情報が必要です。作業指示書に顧客を紐付けてください。" };
  if (wo.status !== "completed") return { success: false, error: "完了した作業指示書のみ承認できます。" };

  const complianceResult = checkReputationCompliance(
    buildCleanComplianceContext(),
    new Date().toISOString(),
  );
  if (!complianceResult.passed) {
    return { success: false, error: "コンプライアンス違反が検出されました。管理者にご連絡ください。" };
  }

  // Approval recorded — dry-run only.
  // Line sending deferred to Phase 11F+.
  // Persistence deferred until review_requests table is created.
  return {
    success:  true,
    action:   "approved",
    dry_run:  true,
    message:  "レビュー依頼の準備が承認されました。LINE送信はPhase 11Fで実装予定です。",
  };
}

// ─── rejectReviewRequestDryRun ────────────────────────────────────────────────

/**
 * rejectReviewRequestDryRun — records dealer rejection of the review request plan.
 *
 * Same security validation as approve. Rejection is not persisted.
 */
export async function rejectReviewRequestDryRun(
  workOrderId: string,
  reason?:     string,
): Promise<ReviewRequestDryRunActionResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー。再ログインしてください。" };

  const hasFeature = await checkFeatureAccess("ai_reputation");
  if (!hasFeature) return { success: false, error: "この機能は Pro+ プランが必要です。" };

  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { success: false, error: "作業指示書が見つかりません。" };

  void reason;  // Logged in future persistence layer

  return {
    success:  true,
    action:   "rejected",
    dry_run:  true,
    message:  "レビュー依頼をスキップしました。",
  };
}

// ─── skipReviewRequestDryRun ──────────────────────────────────────────────────

/**
 * skipReviewRequestDryRun — records dealer decision to skip this review request.
 *
 * "Skip" differs from "reject": the dealer defers the decision, not declines.
 * Not persisted in Sprint 11E.
 */
export async function skipReviewRequestDryRun(
  workOrderId: string,
): Promise<ReviewRequestDryRunActionResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー。再ログインしてください。" };

  const hasFeature = await checkFeatureAccess("ai_reputation");
  if (!hasFeature) return { success: false, error: "この機能は Pro+ プランが必要です。" };

  const wo = await getWorkOrder(workOrderId);
  if (!wo) return { success: false, error: "作業指示書が見つかりません。" };

  return {
    success:  true,
    action:   "skipped",
    dry_run:  true,
    message:  "今回はスキップしました。",
  };
}
