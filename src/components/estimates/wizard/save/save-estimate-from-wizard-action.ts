"use server";

// Estimate Wizard Ver2.2 — Server save orchestration entry (Phase 11E).
//
// The one server-side entry point for saving a wizard estimate. It: (1) verifies the authenticated
// user, (2) resolves the dealer via getCurrentDealer() (NEVER from the client), (3) enforces the
// existing staff permission gate, then (4) delegates to the pure orchestration core (validation →
// pricing completeness → future atomic RPC). It performs NO database write, NO number allocation, NO
// inventory reservation, NO PDF, and does NOT mutate the wizard draft or EstimateEditor. Persistence is
// the future atomic RPC — currently a controlled RPC_NOT_IMPLEMENTED placeholder.

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { EstimateSaveRequest } from "./estimate-save-dto";
import { EstimatePersistenceService } from "./estimate-persistence-service";
import { notImplementedPersistenceGateway } from "./estimate-persistence-gateway";
import {
  ESTIMATE_SAVE_ACTION_ERRORS, logEstimateSaveStage, type EstimateSaveActionResult,
} from "./estimate-save-orchestration-types";

// ── R56B: THIS PATH IS DISABLED ──────────────────────────────────────────────
// This action was the ONE source-complete route to real persistence: it is reached from
// ScreensPreview (dev-preview mount) and, until R56B, bound the real atomic-RPC gateway. Two
// properties made that unacceptable to leave standing:
//
//   1. ScreensPreview is a CLIENT component that computes pricing in the browser and passes the
//      finished DTO here. The RPC performs no repricing, so client-chosen prices would persist.
//   2. R56B makes the RPC service-role-only. Leaving the real gateway bound here would have turned
//      a client-priced write into a client-priced write executing with service-role privilege and
//      no RLS — strictly worse than before.
//
// It is therefore rebound to the placeholder gateway and now terminates with the controlled
// RPC_NOT_IMPLEMENTED result. No persistence occurs. The authentication, dealer-context and
// permission gates below are retained deliberately: they are the behaviour ScreensPreview expects,
// and removing them would change the observable failure ordering of a frozen UI.
//
// ScreensPreview.tsx is NOT edited. Rebinding here severs the path on its own.
// Re-binding the real gateway is B7 work, and is blocked on R56D (numbering) and R56E (required
// idempotency typing).
const persistenceService = new EstimatePersistenceService(notImplementedPersistenceGateway);

export async function saveEstimateFromWizardAction(
  request: EstimateSaveRequest,
  meta?: { requestId?: string; idempotencyKey?: string | null },
): Promise<EstimateSaveActionResult> {
  const E = ESTIMATE_SAVE_ACTION_ERRORS;
  const requestId = meta?.requestId?.trim() || "unspecified";
  const idempotencyKey = meta?.idempotencyKey?.trim() || null;

  // 1. Authentication
  const user = await getCurrentUser();
  if (!user) {
    logEstimateSaveStage({ requestId, dealerId: null, userId: null, stage: "authentication", validationOk: null, errorCode: E.UNAUTHENTICATED });
    return { ok: false, code: E.UNAUTHENTICATED, message: "ログインが必要です。", stage: "authentication" };
  }

  // 2. Dealer context — server-resolved (never from client input)
  const dealer = await getCurrentDealer();
  if (!dealer) {
    logEstimateSaveStage({ requestId, dealerId: null, userId: user.id, stage: "dealer_context", validationOk: null, errorCode: E.DEALER_CONTEXT_REQUIRED });
    return { ok: false, code: E.DEALER_CONTEXT_REQUIRED, message: "ディーラー情報の取得に失敗しました。", stage: "dealer_context" };
  }

  // 3. Permission — reuse the authoritative existing gate (not weakened)
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) {
    logEstimateSaveStage({ requestId, dealerId: dealer.dealer_id, userId: user.id, stage: "permission", validationOk: null, errorCode: E.PERMISSION_DENIED });
    return { ok: false, code: E.PERMISSION_DENIED, message: auth.error, stage: "permission" };
  }

  // 4/5. Validation → pricing completeness → payload → atomic RPC (via the canonical service)
  return persistenceService.save(
    request,
    { requestId, dealerId: dealer.dealer_id, userId: user.id, idempotencyKey },
  );
}
