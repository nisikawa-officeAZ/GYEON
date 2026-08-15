// Estimate Wizard Ver2.2 — Estimate save orchestration core (Phase 11E → 11F).
//
// Thin post-auth entry that delegates to the canonical EstimatePersistenceService (validation →
// pricing completeness → payload construction → gateway → controlled result). Kept as a stable function
// so existing callers (the server action) are unaffected. NO DB write, NO re-pricing, NO side effects
// beyond the service's structured logging.

import type { EstimateSaveRequest } from "./estimate-save-dto";
import type { EstimateSaveActionResult, EstimateSaveServerContext } from "./estimate-save-orchestration-types";
import type { EstimatePersistenceGateway } from "./estimate-persistence-gateway";
import { EstimatePersistenceService } from "./estimate-persistence-service";

export async function finalizeEstimateSave(
  request: EstimateSaveRequest,
  ctx: EstimateSaveServerContext,
  gateway: EstimatePersistenceGateway,
): Promise<EstimateSaveActionResult> {
  return new EstimatePersistenceService(gateway).save(request, ctx);
}
