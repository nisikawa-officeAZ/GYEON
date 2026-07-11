// Estimate Wizard Ver2.2 — Estimate Save architecture barrel (Phase 11A → 11E).
// Types + pure mapper/validator + contracts + server orchestration types/gateway/core. The "use
// server" action (save-estimate-from-wizard-action.ts) is imported directly, not re-exported here.
// Still NO persistence, NO DB write, NO RPC, NO SQL, NO migration.
export type {
  EstimateSaveRequest, EstimateSaveCustomer, EstimateSaveVehicle, EstimateSaveServiceLine,
  EstimateSaveNonPriceableSelection, EstimateSaveDiscount, EstimateSaveDiscountIntent,
  EstimateSaveCoupon, EstimateSavePricing, EstimateSavePricingIssue, EstimateSaveNotes,
  EstimateSaveMetadata, EstimateSaveCompleteness,
} from "./estimate-save-dto";
export {
  ESTIMATE_SAVE_ERRORS,
  type EstimateSaveErrorCode, type EstimateSaveStatus,
  type EstimateSaveValidationIssue, type EstimateSaveValidationResult, type EstimateSaveReadiness,
} from "./estimate-save-errors";
export {
  type EstimateSaveMapper, type EstimateSaveMapperInput, type EstimateSaveValidator,
  type EstimateSaveResult, type EstimateSaveService, type EstimateSaveTransactionStep,
  type EstimateSaveRollbackPolicy,
  ESTIMATE_SAVE_TRANSACTION_PLAN, ESTIMATE_SAVE_ROLLBACK_POLICY,
} from "./estimate-save-contracts";
export { mapDraftToEstimateSaveRequest } from "./estimate-save-mapper";
export { validateEstimateSaveRequest, evaluateEstimateSaveReadiness } from "./estimate-save-validation";
export {
  ESTIMATE_SAVE_ACTION_ERRORS, logEstimateSaveStage,
  type EstimateSaveActionErrorCode, type EstimateSaveStage, type EstimateSaveActionResult,
  type EstimateSaveServerContext, type EstimateSaveLogEntry,
} from "./estimate-save-orchestration-types";
export {
  type EstimatePersistenceGateway, type EstimateSaveGatewayResult,
  EstimatePersistenceNotImplementedError, notImplementedPersistenceGateway,
} from "./estimate-persistence-gateway";
export {
  type EstimateSaveRpcPayload, type EstimateSaveRpcServiceLine, buildEstimateSaveRpcPayload,
} from "./estimate-persistence-payload";
export { EstimatePersistenceService, estimatePersistenceService } from "./estimate-persistence-service";
export { finalizeEstimateSave } from "./estimate-save-orchestration";
