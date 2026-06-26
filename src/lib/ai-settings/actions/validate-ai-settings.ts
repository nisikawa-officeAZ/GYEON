// DealerOS — AI Settings Platform: Validation (Sprint 11R Phase E)
//
// Validates AI settings input before persistence.
// Called by saveAISettingsProfile() and available independently for
// client-side pre-validation without saving.
//
// Returns structured violations instead of throwing exceptions.
// Pure — no "use server", no async, no DB calls.

import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import type { AIProviderId }    from "@/lib/ai/types";
import type { AISettingsValidationResult, AISettingsValidationViolation } from "../errors";
import { VALID_SETTINGS } from "../errors";
import type { AISettingsProfileSaveInput } from "./save-ai-settings-profile";

export const VALID_PROVIDER_IDS = new Set(AI_PROVIDER_REGISTRY.map((e) => e.id) as AIProviderId[]);

export function isValidProviderId(id: unknown): id is AIProviderId {
  return typeof id === "string" && VALID_PROVIDER_IDS.has(id as AIProviderId);
}

/**
 * validateAISettingsInput — validates all fields in an AISettingsProfileSaveInput.
 * Returns VALID_SETTINGS if all fields are valid.
 * Returns a result with violations if any field fails.
 */
export function validateAISettingsInput(
  input: AISettingsProfileSaveInput,
): AISettingsValidationResult {
  const violations: AISettingsValidationViolation[] = [];

  // primary_provider
  if (input.primary_provider !== undefined && input.primary_provider !== null) {
    if (!VALID_PROVIDER_IDS.has(input.primary_provider)) {
      violations.push({
        field:   "primary_provider",
        message: `Unknown provider '${input.primary_provider}'. Valid: ${[...VALID_PROVIDER_IDS].join(", ")}`,
      });
    }
  }

  // fallback_providers
  if (input.fallback_providers !== undefined) {
    if (!Array.isArray(input.fallback_providers)) {
      violations.push({ field: "fallback_providers", message: "Must be an array" });
    } else {
      for (const pid of input.fallback_providers) {
        if (!VALID_PROVIDER_IDS.has(pid)) {
          violations.push({
            field:   "fallback_providers",
            message: `Unknown provider '${pid}' in fallback list`,
          });
        }
      }
      if (
        input.primary_provider &&
        input.fallback_providers.includes(input.primary_provider)
      ) {
        violations.push({
          field:   "fallback_providers",
          message: "primary_provider should not appear in fallback_providers",
        });
      }
    }
  }

  // monthly_limit_usd
  if (input.monthly_limit_usd !== undefined) {
    if (typeof input.monthly_limit_usd !== "number" || isNaN(input.monthly_limit_usd)) {
      violations.push({ field: "monthly_limit_usd", message: "Must be a number" });
    } else if (input.monthly_limit_usd < 0) {
      violations.push({ field: "monthly_limit_usd", message: "Must be >= 0 (0 = no limit)" });
    } else if (input.monthly_limit_usd > 100_000) {
      violations.push({ field: "monthly_limit_usd", message: "Must be <= 100,000 USD" });
    }
  }

  // budget_policy
  if (input.budget_policy !== undefined) {
    const bp = input.budget_policy;

    if (typeof bp.monthly_limit_usd === "number") {
      if (bp.monthly_limit_usd < 0) {
        violations.push({
          field: "budget_policy.monthly_limit_usd",
          message: "Must be >= 0 (0 = no limit)",
        });
      }
    }

    if (typeof bp.warning_threshold === "number") {
      if (bp.warning_threshold < 0 || bp.warning_threshold > 1) {
        violations.push({
          field:   "budget_policy.warning_threshold",
          message: "Must be between 0.0 and 1.0",
        });
      }
    }

    if (typeof bp.reset_day === "number") {
      if (!Number.isInteger(bp.reset_day) || bp.reset_day < 1 || bp.reset_day > 28) {
        violations.push({
          field:   "budget_policy.reset_day",
          message: "Must be an integer between 1 and 28",
        });
      }
    }

    if (bp.emergency_stop_usd !== null && bp.emergency_stop_usd !== undefined) {
      if (typeof bp.emergency_stop_usd !== "number" || bp.emergency_stop_usd < 0) {
        violations.push({
          field:   "budget_policy.emergency_stop_usd",
          message: "Must be a non-negative number or null",
        });
      }
    }

    const validStrategies = ["preferred_cost", "quality", "balanced"];
    if (bp.budget_strategy !== undefined && !validStrategies.includes(bp.budget_strategy)) {
      violations.push({
        field:   "budget_policy.budget_strategy",
        message: `Must be one of: ${validStrategies.join(", ")}`,
      });
    }
  }

  // execution_preference
  if (input.execution_preference !== undefined) {
    const ep = input.execution_preference;
    const validModes = ["quality", "cost", "speed", "balanced"];

    if (ep.mode !== undefined && !validModes.includes(ep.mode)) {
      violations.push({
        field:   "execution_preference.mode",
        message: `Must be one of: ${validModes.join(", ")}`,
      });
    }

    if (ep.max_latency_ms !== null && ep.max_latency_ms !== undefined) {
      if (typeof ep.max_latency_ms !== "number" || ep.max_latency_ms < 0) {
        violations.push({
          field:   "execution_preference.max_latency_ms",
          message: "Must be a non-negative number or null",
        });
      }
    }

    const validQuality = ["good", "better", "best"];
    if (ep.quality_threshold !== null && ep.quality_threshold !== undefined) {
      if (!validQuality.includes(ep.quality_threshold)) {
        violations.push({
          field:   "execution_preference.quality_threshold",
          message: `Must be one of: ${validQuality.join(", ")} or null`,
        });
      }
    }
  }

  if (violations.length === 0) return VALID_SETTINGS;
  return { valid: false, violations };
}
