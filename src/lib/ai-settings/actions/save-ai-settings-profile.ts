"use server";

// DealerOS — AI Settings Platform: Save AI Settings Profile (Sprint 11R Phase B)
//
// Persists the non-key portions of a dealer's AI settings profile.
// API keys are NOT accepted here — they go through src/lib/ai/save-ai-settings.ts.
//
// Security:
//   - dealer_id ALWAYS from getCurrentDealer() — never from client input
//   - Pro+ feature gate enforced server-side
//   - Ownership confirmed: dealer can only write their own profile

import { getCurrentDealer }    from "@/lib/auth/get-current-dealer";
import { checkFeatureAccess }  from "@/lib/plans/can-use-feature";
import { AI_SETTINGS_REPOSITORY_FACTORY } from "../repository";
import type {
  AISettingsPersistenceResult,
  AISettingsSavePayload,
} from "../repository";
import { settingsOk, settingsFail }         from "../errors";
import type { AISettingsResult }            from "../errors";
import type { AIProviderId }               from "@/lib/ai/types";
import { AI_PROVIDER_REGISTRY }            from "@/lib/ai/provider-registry";
import type { AICapabilityAssignmentMap }  from "../capability-assignment";
import type { AIBudgetPolicyConfig }       from "../budget-policy";
import type { AIExecutionPreference }      from "../settings-profile-types";
import {
  serializeCapabilityPreferences,
  serializeBudgetPolicy,
  serializeExecutionPreference,
} from "../database-types";
import { validateAISettingsInput }         from "./validate-ai-settings";

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * AISettingsProfileSaveInput — what the caller may update in one call.
 * All fields are optional — only provided fields are written.
 * API keys are excluded — use saveAiSettings() from src/lib/ai/ for those.
 */
export interface AISettingsProfileSaveInput {
  primary_provider?:      AIProviderId | null;
  fallback_providers?:    AIProviderId[];
  enabled?:               boolean;
  monthly_limit_usd?:     number;
  hard_limit?:            boolean;
  capability_assignments?: AICapabilityAssignmentMap;
  budget_policy?:         AIBudgetPolicyConfig;
  execution_preference?:  AIExecutionPreference;
}

// ─── Save action ──────────────────────────────────────────────────────────────

/**
 * saveAISettingsProfile — persists non-key AI settings fields for the current dealer.
 *
 * Writes to dealer_ai_settings table (canonical, migration 072) ONLY.
 * If the table is not available (migration 072 not yet applied), returns
 * MIGRATION_REQUIRED — never writes to the legacy JSONB compat layer.
 *
 * Returns the persistence result including the storage target on success.
 */
export async function saveAISettingsProfile(
  input: AISettingsProfileSaveInput,
): Promise<AISettingsResult<AISettingsPersistenceResult>> {
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return settingsFail("AUTHENTICATION_FAILED", "Not authenticated");
  }

  const hasAccess = await checkFeatureAccess("ai_gateway");
  if (!hasAccess) {
    return settingsFail(
      "FEATURE_NOT_LICENSED",
      "AI Settings require Pro+ plan",
      { feature: "ai_gateway" },
    );
  }

  // Validate before persisting
  const validation = validateAISettingsInput(input);
  if (!validation.valid) {
    return settingsFail(
      "VALIDATION_FAILED",
      "AI settings validation failed",
      { violations: validation.violations },
    );
  }

  const repo = AI_SETTINGS_REPOSITORY_FACTORY.createSettingsRepository();

  const payload = buildSavePayload(input);
  const result  = await repo.save(dealer.dealer_id, payload);

  if (!result.ok) {
    if (result.error_code === "TABLE_NOT_AVAILABLE") {
      return settingsFail(
        "MIGRATION_REQUIRED",
        "AI Settings persistence requires migration 072 (dealer_ai_settings table) — CTO approval required",
        { migration: "072", table: "dealer_ai_settings" },
      );
    }
    return settingsFail(
      "PERSISTENCE_ERROR",
      result.error_message ?? "Failed to save AI settings",
      { error_code: result.error_code },
    );
  }

  return settingsOk(result);
}

// ─── Payload builder ──────────────────────────────────────────────────────────

function buildSavePayload(input: AISettingsProfileSaveInput): AISettingsSavePayload {
  const payload: AISettingsSavePayload = {};

  if (input.primary_provider   !== undefined) payload.primary_provider   = input.primary_provider;
  if (input.fallback_providers !== undefined) payload.fallback_providers  = input.fallback_providers;
  if (input.enabled            !== undefined) payload.enabled             = input.enabled;
  if (input.monthly_limit_usd !== undefined) {
    payload.monthly_limit_usd = Math.max(0, Number(input.monthly_limit_usd.toFixed(2)));
  }
  if (input.hard_limit !== undefined) payload.hard_limit = input.hard_limit;

  if (input.capability_assignments !== undefined) {
    payload.capability_preferences = serializeCapabilityPreferences(input.capability_assignments);
  }
  if (input.budget_policy !== undefined) {
    payload.budget_policy = serializeBudgetPolicy(input.budget_policy);
  }
  if (input.execution_preference !== undefined) {
    payload.execution_preferences = serializeExecutionPreference(input.execution_preference);
  }

  return payload;
}

// ─── Valid provider IDs ───────────────────────────────────────────────────────

const VALID_PROVIDER_IDS = new Set(AI_PROVIDER_REGISTRY.map((e) => e.id) as AIProviderId[]);

export function isValidProviderId(id: unknown): id is AIProviderId {
  return typeof id === "string" && VALID_PROVIDER_IDS.has(id as AIProviderId);
}
