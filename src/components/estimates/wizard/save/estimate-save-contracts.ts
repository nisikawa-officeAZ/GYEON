// Estimate Wizard Ver2.2 — Estimate Save contracts (Phase 11A, architecture only).
//
// Layer interfaces + the transaction DESIGN. NO implementation of persistence exists here. The
// concrete EstimateSaveService (server-side, transactional) is a FUTURE phase; this file only
// declares the boundary so every layer has a single responsibility:
//
//   Wizard → Canonical Draft → Pricing Result → Mapper → Save DTO → Save Service → Database

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";
import type { EstimateSaveRequest } from "./estimate-save-dto";
import type { EstimateSaveErrorCode, EstimateSaveValidationResult } from "./estimate-save-errors";

// ── Mapper input (§3) — ONE explicit object. No individual screen states, no React, no EstimateEditor,
// no browser storage, no database rows. ──
export type EstimateSaveMapperInput = {
  draft: EstimateWizardDraftV22;
  pricingResult: WizardPricingResult;
};

// ── Mapper contract (pure) — input object → save request. ──
export type EstimateSaveMapper = (input: EstimateSaveMapperInput) => EstimateSaveRequest;

// ── Validation contract (pure) — save request → issues. Never saves, never touches the DB. ──
export type EstimateSaveValidator = (request: EstimateSaveRequest) => EstimateSaveValidationResult;

// ── Save result (returned by the FUTURE service) ──
export type EstimateSaveResult =
  | { status: "success"; estimateId: string; estimateNumber: string | null }
  | { status: "error"; code: EstimateSaveErrorCode; message: string };

// ── Save service contract (THE single persistence boundary) ──
// Screens / adapters / mapper NEVER write to the database. Only a future concrete implementation of
// this interface performs the transactional write. No implementation is provided in this phase.
export interface EstimateSaveService {
  save(request: EstimateSaveRequest): Promise<EstimateSaveResult>;
}

// ── Transaction design (DESIGN ONLY — there is no executor) ──
// The future save is ONE transaction. Ordered steps; a failure at any step rolls the whole thing back
// (nothing is partially persisted). No step is implemented here.
export type EstimateSaveTransactionStep =
  | "begin"
  | "customer"        // resolve/create customer (future)
  | "vehicle"         // resolve/create vehicle (future)
  | "estimate"        // insert estimate header (future)
  | "estimate_items"  // insert priced line items (future)
  | "commit";

export const ESTIMATE_SAVE_TRANSACTION_PLAN: readonly EstimateSaveTransactionStep[] = [
  "begin",
  "customer",
  "vehicle",
  "estimate",
  "estimate_items",
  "commit",
] as const;

// Rollback design: the transaction is atomic. On any failure before `commit`, all preceding steps are
// discarded (transactional rollback). No compensating writes and no partial estimate are ever left.
export type EstimateSaveRollbackPolicy = "atomic_rollback_on_any_failure";
export const ESTIMATE_SAVE_ROLLBACK_POLICY: EstimateSaveRollbackPolicy = "atomic_rollback_on_any_failure";
