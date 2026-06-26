// DealerOS — AI Settings Platform: Settings Repository (Sprint 11R Phase A)
//
// Supabase-backed implementation of AISettingsRepository.
//
// Storage strategy (two-layer):
//   Layer 1 (preferred): dealer_ai_settings table (migration 072)
//     → structured columns for provider selection + JSONB for capability/budget/exec prefs
//   Layer 2 (fallback): dealer_settings.ai_settings JSONB
//     → extended namespace keys (cap_prefs, exec_prefs, budget_pol) alongside existing keys
//
// The fallback layer allows full persistence without migration 072.
//
// Key storage is NOT in scope here — API keys are always handled by
// src/lib/ai/save-ai-settings.ts (AES-256-GCM encryption flow).
//
// "use server" is not declared here — this module is consumed by server actions
// that have already established the server context.

import { createClient }        from "@/lib/supabase/server";
import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import type { AIProviderId }   from "@/lib/ai/types";
import { settingsOk, settingsFail } from "../errors";
import type {
  AISettingsRepository,
  AISettingsLoadResult,
  AISettingsSavePayload,
  AISettingsPersistenceResult,
} from "./repository-types";

const PG_UNDEFINED_TABLE  = "42P01";
const PG_UNDEFINED_COLUMN = "42703";

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadSettings(
  dealer_id: string,
): ReturnType<AISettingsRepository["load"]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // --- Layer 1: dealer_ai_settings table (migration 072) ---
  let extendedRow: Record<string, unknown> | null = null;

  try {
    const { data, error } = await supabase
      .from("dealer_ai_settings")
      .select("*")
      .eq("dealer_id", dealer_id)
      .maybeSingle();

    if (error) {
      if (error.code !== PG_UNDEFINED_TABLE && !error.message?.includes("dealer_ai_settings")) {
        // Real DB error (not "table not found")
        return settingsFail("PERSISTENCE_ERROR", "Failed to read dealer_ai_settings", {
          code: error.code,
        });
      }
      // Table not yet created — continue to fallback
    } else {
      extendedRow = (data as Record<string, unknown> | null) ?? null;
    }
  } catch {
    // Table may not exist — continue to fallback
  }

  // --- Always: dealer_settings.ai_settings for key status + basic config ---
  let basicConfig: Record<string, unknown> = {};
  let basicReadFailed = false;

  try {
    const { data: dsData, error: dsError } = await supabase
      .from("dealer_settings")
      .select("ai_settings")
      .eq("dealer_id", dealer_id)
      .maybeSingle();

    if (dsError?.code === PG_UNDEFINED_COLUMN || dsError?.message?.includes("ai_settings")) {
      return settingsFail(
        "MIGRATION_REQUIRED",
        "AI settings column not available — apply migration 070",
      );
    }

    if (!dsError && dsData?.ai_settings) {
      basicConfig = dsData.ai_settings as Record<string, unknown>;
    }
  } catch {
    basicReadFailed = true;
  }

  if (basicReadFailed) {
    return settingsFail("PERSISTENCE_ERROR", "Failed to read dealer_settings");
  }

  // --- Build provider key status from basicConfig ---
  const providerKeyStatus: AISettingsLoadResult["provider_key_status"] = {};
  for (const entry of AI_PROVIDER_REGISTRY) {
    const id = entry.id as AIProviderId;
    const encryptedKey = basicConfig[entry.settingsKey];
    providerKeyStatus[id] = {
      has_key:      typeof encryptedKey === "string" && encryptedKey.length > 0,
      validated_at: typeof basicConfig[`${id}_validated_at`] === "string"
        ? (basicConfig[`${id}_validated_at`] as string)
        : null,
    };
  }

  // --- Resolve source of extended config ---
  const storageSource: AISettingsLoadResult["storage_source"] = extendedRow
    ? "dealer_ai_settings_table"
    : Object.keys(basicConfig).length > 0
      ? "dealer_settings_jsonb"
      : "defaults";

  const capPrefs: Record<string, unknown> = extendedRow
    ? ((extendedRow.capability_preferences as Record<string, unknown>) ?? {})
    : ((basicConfig.cap_prefs as Record<string, unknown>) ?? {});

  const execPrefs: Record<string, unknown> = extendedRow
    ? ((extendedRow.execution_preferences as Record<string, unknown>) ?? {})
    : ((basicConfig.exec_prefs as Record<string, unknown>) ?? {});

  const budgetPol: Record<string, unknown> = extendedRow
    ? ((extendedRow.budget_policy as Record<string, unknown>) ?? {})
    : ((basicConfig.budget_pol as Record<string, unknown>) ?? {});

  const primaryProvider = (
    extendedRow
      ? (extendedRow.default_provider as AIProviderId | null)
      : (basicConfig.primary_provider as AIProviderId | null)
  ) ?? null;

  const fallbackProviders: AIProviderId[] = (
    extendedRow
      ? (extendedRow.fallback_providers as AIProviderId[] | null)
      : null
  ) ?? [];

  return settingsOk({
    primary_provider:       primaryProvider,
    fallback_providers:     fallbackProviders,
    enabled:                typeof basicConfig.enabled === "boolean" ? basicConfig.enabled : false,
    monthly_limit_usd:      typeof basicConfig.monthly_limit_usd === "number"
      ? basicConfig.monthly_limit_usd : 0,
    hard_limit:             typeof basicConfig.hard_limit === "boolean"
      ? basicConfig.hard_limit : false,
    capability_preferences: capPrefs,
    execution_preferences:  execPrefs,
    budget_policy:          budgetPol,
    provider_key_status:    providerKeyStatus,
    storage_source:         storageSource,
    loaded_at:              now,
  });
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveSettings(
  dealer_id: string,
  payload:   AISettingsSavePayload,
): Promise<AISettingsPersistenceResult> {
  const now = new Date().toISOString();
  const supabase = await createClient();

  // --- Layer 1: Try dealer_ai_settings table (migration 072) ---
  const hasExtendedFields =
    payload.capability_preferences !== undefined ||
    payload.execution_preferences  !== undefined ||
    payload.budget_policy          !== undefined ||
    payload.fallback_providers     !== undefined;

  if (hasExtendedFields) {
    try {
      const upsertData: Record<string, unknown> = {
        dealer_id,
        updated_at: now,
      };
      if (payload.primary_provider   !== undefined) upsertData.default_provider   = payload.primary_provider;
      if (payload.fallback_providers  !== undefined) upsertData.fallback_providers  = payload.fallback_providers;
      if (payload.capability_preferences !== undefined) upsertData.capability_preferences = payload.capability_preferences;
      if (payload.execution_preferences  !== undefined) upsertData.execution_preferences  = payload.execution_preferences;
      if (payload.budget_policy          !== undefined) upsertData.budget_policy          = payload.budget_policy;

      const { error: upsertErr } = await supabase
        .from("dealer_ai_settings")
        .upsert(upsertData, { onConflict: "dealer_id" });

      if (upsertErr) {
        if (upsertErr.code === PG_UNDEFINED_TABLE || upsertErr.message?.includes("dealer_ai_settings")) {
          return saveToJsonbFallback(supabase, dealer_id, payload, now);
        }
        return {
          ok: false,
          storage_target: "none",
          error_code: upsertErr.code,
          error_message: "Failed to save to dealer_ai_settings table",
          persisted_at: now,
        };
      }

      return { ok: true, storage_target: "dealer_ai_settings_table", persisted_at: now };
    } catch {
      return saveToJsonbFallback(supabase, dealer_id, payload, now);
    }
  }

  // Basic config only — write directly to JSONB
  return saveToJsonbFallback(supabase, dealer_id, payload, now);
}

// ─── JSONB fallback save ──────────────────────────────────────────────────────

async function saveToJsonbFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealer_id: string,
  payload:   AISettingsSavePayload,
  now:       string,
): Promise<AISettingsPersistenceResult> {
  const { data: existing, error: readErr } = await supabase
    .from("dealer_settings")
    .select("ai_settings")
    .eq("dealer_id", dealer_id)
    .maybeSingle();

  if (readErr?.code === PG_UNDEFINED_COLUMN || readErr?.message?.includes("ai_settings")) {
    return {
      ok: false,
      storage_target: "none",
      error_code: "MIGRATION_REQUIRED",
      error_message: "AI settings column not available — apply migration 070",
      persisted_at: now,
    };
  }

  if (readErr) {
    return {
      ok: false,
      storage_target: "none",
      error_code: readErr.code,
      error_message: "Failed to read dealer_settings for merge",
      persisted_at: now,
    };
  }

  const current = (existing?.ai_settings as Record<string, unknown>) ?? {};
  const updated: Record<string, unknown> = { ...current };

  if (payload.enabled           !== undefined) updated.enabled             = payload.enabled;
  if (payload.primary_provider  !== undefined) updated.primary_provider    = payload.primary_provider;
  if (payload.monthly_limit_usd !== undefined) updated.monthly_limit_usd   = payload.monthly_limit_usd;
  if (payload.hard_limit        !== undefined) updated.hard_limit           = payload.hard_limit;
  // Extended fields stored under namespace keys in JSONB fallback
  if (payload.capability_preferences !== undefined) updated.cap_prefs  = payload.capability_preferences;
  if (payload.execution_preferences  !== undefined) updated.exec_prefs = payload.execution_preferences;
  if (payload.budget_policy          !== undefined) updated.budget_pol  = payload.budget_policy;

  const { error: updateErr } = await supabase
    .from("dealer_settings")
    .update({ ai_settings: updated, updated_at: now })
    .eq("dealer_id", dealer_id);

  if (updateErr) {
    return {
      ok: false,
      storage_target: "none",
      error_code: updateErr.code,
      error_message: "Failed to update dealer_settings.ai_settings",
      persisted_at: now,
    };
  }

  return { ok: true, storage_target: "dealer_settings_jsonb", persisted_at: now };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSupabaseAISettingsRepository(): AISettingsRepository {
  return {
    load: loadSettings,
    save: saveSettings,
  };
}
