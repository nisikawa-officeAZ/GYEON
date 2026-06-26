// DealerOS — AI Settings Platform: Canonical Error Types (Sprint 11R Phase E)
//
// Structured result type for all AI Settings operations.
// No exceptions for expected business conditions — all failures are typed.
//
// Pure — no "use server", no async, no DB calls.

// ─── Error codes ──────────────────────────────────────────────────────────────

export type AISettingsErrorCode =
  | "SETTINGS_NOT_CONFIGURED"   // No AI settings found (migration not applied or never saved)
  | "PROVIDER_DISABLED"         // Dealer has disabled this provider
  | "PROVIDER_NOT_AVAILABLE"    // Provider exists but adapter not yet implemented
  | "FEATURE_NOT_LICENSED"      // Pro+ plan required for this operation
  | "SUBSCRIPTION_REQUIRED"     // Active subscription required
  | "BUDGET_LIMIT_REACHED"      // Monthly budget limit exceeded
  | "PROVIDER_UNKNOWN"          // Provider ID not recognized in registry
  | "ENCRYPTION_NOT_CONFIGURED" // DEALER_AI_KEY_SECRET env var missing
  | "VALIDATION_FAILED"         // Input validation failed
  | "PERSISTENCE_ERROR"         // Database write failed
  | "AUTHENTICATION_FAILED"     // getCurrentDealer() returned null
  | "MIGRATION_REQUIRED"        // Required database column/table not yet created
  | "USAGE_NOT_AVAILABLE";      // dealer_ai_usage_log table not yet created

// ─── Error shape ──────────────────────────────────────────────────────────────

export interface AISettingsError {
  code:      AISettingsErrorCode;
  message:   string;
  details?:  Record<string, unknown>;
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type AISettingsResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: AISettingsError };

// ─── Constructors ─────────────────────────────────────────────────────────────

export function settingsOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function settingsFail(
  code:     AISettingsErrorCode,
  message:  string,
  details?: Record<string, unknown>,
): { ok: false; error: AISettingsError } {
  return { ok: false, error: { code, message, ...(details && { details }) } };
}

export function isSettingsError<T>(
  result: AISettingsResult<T>,
): result is { ok: false; error: AISettingsError } {
  return !result.ok;
}

export function isSettingsOk<T>(
  result: AISettingsResult<T>,
): result is { ok: true; value: T } {
  return result.ok;
}

// ─── Validation error ─────────────────────────────────────────────────────────

export interface AISettingsValidationViolation {
  field:   string;
  message: string;
}

export interface AISettingsValidationResult {
  valid:      boolean;
  violations: AISettingsValidationViolation[];
}

export const VALID_SETTINGS: AISettingsValidationResult = {
  valid: true, violations: [],
};
