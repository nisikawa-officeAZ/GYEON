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
import { supabasePersistenceGateway } from "./supabase-persistence-gateway";
import {
  ESTIMATE_SAVE_ACTION_ERRORS, logEstimateSaveStage, type EstimateSaveActionResult,
} from "./estimate-save-orchestration-types";

// The runtime save path uses the REAL atomic-RPC gateway (server-only). Dealer context comes from
// getCurrentDealer() below — never the client. The environment target is the app's configured Supabase
// project (DealerOS-Dev in this phase); no project ref is hardcoded and no client bypass exists.
const persistenceService = new EstimatePersistenceService(supabasePersistenceGateway);

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
