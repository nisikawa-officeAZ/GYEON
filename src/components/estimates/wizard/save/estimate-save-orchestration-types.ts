// Estimate Wizard Ver2.2 — Server save orchestration types (Phase 11E).
//
// Stable server-action error codes, save stage, action result, server context, and a PII-free
// structured logger. Plain types (no "use server", no DB, no side effects beyond the console logger).

import type { EstimateSaveValidationIssue } from "./estimate-save-errors";

// Server-action error codes (distinct from the DTO validation codes in estimate-save-errors.ts).
export const ESTIMATE_SAVE_ACTION_ERRORS = {
  UNAUTHENTICATED:         "UNAUTHENTICATED",
  DEALER_CONTEXT_REQUIRED: "DEALER_CONTEXT_REQUIRED",
  PERMISSION_DENIED:       "PERMISSION_DENIED",
  VALIDATION_ERROR:        "VALIDATION_ERROR",
  PRICING_INCOMPLETE:      "PRICING_INCOMPLETE",
  // RPC-surfaced (mapped from the atomic RPC's coded errors — never raw DB text)
  CUSTOMER_NOT_FOUND:      "CUSTOMER_NOT_FOUND",
  VEHICLE_NOT_FOUND:       "VEHICLE_NOT_FOUND",
  DUPLICATE_SUBMISSION:    "DUPLICATE_SUBMISSION",
  ESTIMATE_NUMBER_FAILED:  "ESTIMATE_NUMBER_FAILED",
  SAVE_FAILED:             "SAVE_FAILED",
  RPC_NOT_IMPLEMENTED:     "RPC_NOT_IMPLEMENTED",
  UNKNOWN_SAVE_ERROR:      "UNKNOWN_SAVE_ERROR",
} as const;

export type EstimateSaveActionErrorCode =
  typeof ESTIMATE_SAVE_ACTION_ERRORS[keyof typeof ESTIMATE_SAVE_ACTION_ERRORS];

// Orchestration pipeline stage (also used by the structured log).
export type EstimateSaveStage =
  | "authentication"
  | "dealer_context"
  | "permission"
  | "validation"
  | "pricing_completeness"
  | "rpc"
  | "done";

// Structured, controlled server-action result. Raw exceptions are never surfaced. `replay` marks an
// idempotent retry that returned the existing estimate (no new estimate created).
export type EstimateSaveActionResult =
  | { ok: true; estimateId: string; estimateNumber: string; customerId: string; vehicleId: string; replay: boolean }
  | { ok: false; code: EstimateSaveActionErrorCode; message: string; stage: EstimateSaveStage; issues?: EstimateSaveValidationIssue[] };

// Server-resolved context passed to the orchestration core. dealerId originates ONLY from
// getCurrentDealer() (never the client). idempotencyKey is a client-supplied save token (never a
// label/random-per-render) used by the atomic RPC for duplicate detection.
//
// R56E: idempotencyKey is REQUIRED and NON-NULL. The hardened RPC rejects a missing, null, blank or
// malformed key with VALIDATION_ERROR (`^[A-Za-z0-9_-]{16,64}$`), so a context that permitted
// optional/null was a contract mismatch: it let an unusable key travel all the way to SQL and fail
// late and generically. Every entry point now proves the key BEFORE constructing this context.
// No layer below may default, substitute or regenerate it — retry stability is the caller's.
export type EstimateSaveServerContext = {
  requestId:      string;
  dealerId:       string;
  userId:         string;
  idempotencyKey: string;
};

// PII-free structured log entry — ids + stage + outcome only. NEVER customer/vehicle/pricing data.
export type EstimateSaveLogEntry = {
  requestId:    string;
  dealerId:     string | null;
  userId:       string | null;
  stage:        EstimateSaveStage;
  validationOk: boolean | null;
  errorCode:    EstimateSaveActionErrorCode | null;
};

/** Emit a structured, PII-free save-stage log line (existing console-based convention). */
export function logEstimateSaveStage(entry: EstimateSaveLogEntry): void {
  console.info("[saveEstimateFromWizard]", JSON.stringify(entry));
}
