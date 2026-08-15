// Estimate Wizard Ver2.2 — Estimate persistence gateway (Phase 11E → 11G-B, placeholder still active).
//
// The ATOMIC persistence boundary. The migration + RPC source now exist
// (supabase/migrations/102_estimate_wizard_atomic_save.sql: `save_estimate_from_wizard`), but they are
// NOT applied and runtime save is NOT enabled. The concrete gateway (a future phase) will, per the
// approved Option B: allocate + format the estimate number via the existing `getNextDocumentNumber`
// authority, then call `save_estimate_from_wizard(p_dealer_id, p_actor_user_id, p_estimate_number,
// p_payload)` with dealer id from the server context (never the payload), mapping its jsonb result
// ({ estimate_id, estimate_number, customer_id, vehicle_id }) to EstimateSaveGatewayResult.
//
// This phase keeps ONLY the interface + the controlled RPC_NOT_IMPLEMENTED placeholder: NO SQL executed,
// NO Supabase RPC call, NO DB write, runtime save remains disabled.

import type { EstimateSaveServerContext } from "./estimate-save-orchestration-types";
import type { EstimateSaveRpcPayload } from "./estimate-persistence-payload";

export type EstimateSaveGatewayResult =
  | {
      ok: true;
      estimateId:     string;
      estimateNumber: string;
      customerId:     string;
      vehicleId:      string;
      replay:         boolean; // true = idempotent retry returned the existing estimate
    }
  | {
      ok: false;
      code:    string;  // stable code (mapped from the RPC's coded error — never raw DB text)
      message: string;  // operator-safe message
    };

// The single persistence primitive both the Wizard and (future) EstimateEditor will share. It receives
// the canonical RPC payload (dealer id lives in the context, never the payload).
export interface EstimatePersistenceGateway {
  saveEstimate(
    payload: EstimateSaveRpcPayload,
    context: EstimateSaveServerContext,
  ): Promise<EstimateSaveGatewayResult>;
}

// Typed, mappable error for the not-yet-implemented persistence path.
export class EstimatePersistenceNotImplementedError extends Error {
  readonly code = "RPC_NOT_IMPLEMENTED" as const;
  constructor() {
    super("Estimate persistence RPC is not implemented yet.");
    this.name = "EstimatePersistenceNotImplementedError";
  }
}

// Controlled placeholder gateway — side-effect free. It performs NO persistence and throws a typed
// RPC_NOT_IMPLEMENTED error the orchestration layer maps to a controlled result.
export const notImplementedPersistenceGateway: EstimatePersistenceGateway = {
  async saveEstimate(): Promise<EstimateSaveGatewayResult> {
    throw new EstimatePersistenceNotImplementedError();
  },
};
