// Estimate Wizard Ver2.2 — Estimate persistence service (Phase 11F).
//
// The canonical application-layer service that orchestrates a post-auth save: structural validation →
// pricing completeness → normalization → RPC payload construction → gateway invocation → controlled
// result mapping. It performs NO business calculation, NO pricing, NO PDF, NO DB write. Persistence is
// the future atomic RPC, reached through the single EstimatePersistenceGateway (currently a controlled
// RPC_NOT_IMPLEMENTED placeholder). Dealer id comes only from the server-resolved context.

import type { EstimateSaveRequest } from "./estimate-save-dto";
import { validateEstimateSaveRequest } from "./estimate-save-validation";
import {
  ESTIMATE_SAVE_ACTION_ERRORS, logEstimateSaveStage,
  type EstimateSaveActionResult, type EstimateSaveServerContext, type EstimateSaveActionErrorCode,
} from "./estimate-save-orchestration-types";
import {
  EstimatePersistenceNotImplementedError, notImplementedPersistenceGateway,
  type EstimatePersistenceGateway,
} from "./estimate-persistence-gateway";
import { buildEstimateSaveRpcPayload } from "./estimate-persistence-payload";

export class EstimatePersistenceService {
  constructor(private readonly gateway: EstimatePersistenceGateway) {}

  /** Post-auth orchestration. Assumes the caller already authenticated and resolved the dealer. */
  async save(request: EstimateSaveRequest, ctx: EstimateSaveServerContext): Promise<EstimateSaveActionResult> {
    const E = ESTIMATE_SAVE_ACTION_ERRORS;
    const base = { requestId: ctx.requestId, dealerId: ctx.dealerId, userId: ctx.userId };

    // Structural validation — authoritative server re-check (client readiness is advisory only).
    const validation = validateEstimateSaveRequest(request);
    if (!validation.ok) {
      logEstimateSaveStage({ ...base, stage: "validation", validationOk: false, errorCode: E.VALIDATION_ERROR });
      return { ok: false, code: E.VALIDATION_ERROR, message: "入力内容に不備があります。", stage: "validation", issues: validation.issues };
    }

    // Pricing must ALREADY be complete — this layer never re-prices.
    if (request.pricing.completeness !== "complete") {
      logEstimateSaveStage({ ...base, stage: "pricing_completeness", validationOk: true, errorCode: E.PRICING_INCOMPLETE });
      return { ok: false, code: E.PRICING_INCOMPLETE, message: "価格が未確定のため保存できません。", stage: "pricing_completeness" };
    }

    // Normalize + build the canonical RPC payload (no execution, no SQL, no dealer id in the payload).
    const payload = buildEstimateSaveRpcPayload(request, { idempotencyKey: ctx.idempotencyKey ?? null });

    // Invoke the gateway (atomic RPC, or the disabled placeholder). Controlled result mapping only.
    try {
      const gw = await this.gateway.saveEstimate(payload, ctx);
      if (!gw.ok) {
        const code = toActionErrorCode(gw.code);
        logEstimateSaveStage({ ...base, stage: "rpc", validationOk: true, errorCode: code });
        return { ok: false, code, message: gw.message, stage: "rpc" };
      }
      logEstimateSaveStage({ ...base, stage: "done", validationOk: true, errorCode: null });
      return {
        ok: true,
        estimateId:     gw.estimateId,
        estimateNumber: gw.estimateNumber,
        customerId:     gw.customerId,
        vehicleId:      gw.vehicleId,
        replay:         gw.replay,
      };
    } catch (err) {
      const code = err instanceof EstimatePersistenceNotImplementedError ? E.RPC_NOT_IMPLEMENTED : E.UNKNOWN_SAVE_ERROR;
      logEstimateSaveStage({ ...base, stage: "rpc", validationOk: true, errorCode: code });
      return {
        ok: false,
        code,
        message: code === E.RPC_NOT_IMPLEMENTED ? "保存機能は現在準備中です。" : "保存中にエラーが発生しました。",
        stage: "rpc",
      };
    }
  }
}

// Map a gateway failure code (string) to a stable action error code (default: SAVE_FAILED).
function toActionErrorCode(code: string): EstimateSaveActionErrorCode {
  const known = (ESTIMATE_SAVE_ACTION_ERRORS as Record<string, EstimateSaveActionErrorCode>)[code];
  return known ?? ESTIMATE_SAVE_ACTION_ERRORS.SAVE_FAILED;
}

// Default service bound to the not-yet-implemented gateway (no persistence, no side effects).
export const estimatePersistenceService = new EstimatePersistenceService(notImplementedPersistenceGateway);
