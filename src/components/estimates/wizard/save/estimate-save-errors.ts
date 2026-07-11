// Estimate Wizard Ver2.2 — Estimate Save error, status & validation contracts (Phase 11A).
//
// Stable codes + save-state union + validation result shape. NO save logic, NO DB, NO side effects.

export const ESTIMATE_SAVE_ERRORS = {
  CUSTOMER_REQUIRED:        "CUSTOMER_REQUIRED",
  VEHICLE_REQUIRED:         "VEHICLE_REQUIRED",
  SERVICE_REQUIRED:         "SERVICE_REQUIRED",
  PRICING_INCOMPLETE:       "PRICING_INCOMPLETE",
  UNRESOLVED_PRICING:       "UNRESOLVED_PRICING",
  MANUAL_PRICE_MISSING:     "MANUAL_PRICE_MISSING",
  UNKNOWN_PRICING_IDENTITY: "UNKNOWN_PRICING_IDENTITY",
  VALIDATION_ERROR:         "VALIDATION_ERROR",
  SAVE_FAILED:              "SAVE_FAILED",   // reserved for the future service layer
  NETWORK_ERROR:            "NETWORK_ERROR", // reserved for the future service layer
} as const;

export type EstimateSaveErrorCode = typeof ESTIMATE_SAVE_ERRORS[keyof typeof ESTIMATE_SAVE_ERRORS];

// ── Save status (UI state machine — no save logic yet) ─────────────────────────────
export type EstimateSaveStatus =
  | "idle"
  | "validating"
  | "ready"
  | "saving"
  | "success"
  | "error";

// ── Validation result (produced by the pure validator; never saves, never calls the DB) ──
export type EstimateSaveValidationIssue = {
  code:    EstimateSaveErrorCode;
  field:   string | null;
  message: string;
};

export type EstimateSaveValidationResult = {
  ok:     boolean;
  issues: EstimateSaveValidationIssue[];
};

// ── Save readiness (§18) — explicit, non-persistence result. NEVER "saved"/"submitted"/"persisted". ──
export type EstimateSaveReadiness = {
  status: "invalid" | "ready";
  issues: EstimateSaveValidationIssue[];
};
