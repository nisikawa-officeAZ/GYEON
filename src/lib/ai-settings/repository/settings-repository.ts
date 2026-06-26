// DealerOS — AI Settings Platform: Settings Repository (Sprint 11R Phase A)
//
// Supabase-backed implementation of AISettingsRepository.
//
// ─── Canonical storage model ───────────────────────────────────────────────────
//
//   CANONICAL (write + read):
//     dealer_ai_settings table (migration 072 — CTO approval required)
//     → Only long-term source of truth for AI Settings profiles.
//     → All new writes target this table exclusively.
//
//   COMPAT READ ONLY:
//     dealer_settings.ai_settings JSONB (migration 070 — already applied)
//     → Read-only backward compatibility layer during migration window.
//     → Provides basic config + key status for dealers who have not yet had
//       migration 072 applied.
//     → New writes NEVER go to this column for AI Settings data.
//     → FUTURE CLEANUP TASK: remove compat read after all dealers have migrated
//       to dealer_ai_settings table and migration window is closed.
//
// ─── Save policy ──────────────────────────────────────────────────────────────
//
//   Write target: dealer_ai_settings table ONLY.
//   If table does not exist (42P01 before migration 072 is applied):
//     → return AISettingsPersistenceResult { ok: false, error_code: "TABLE_NOT_AVAILABLE" }
//     → DO NOT fall back to writing JSONB
//   Callers handle TABLE_NOT_AVAILABLE by surfacing a migration prompt.
//
// ─── Load policy ──────────────────────────────────────────────────────────────
//
//   1. Try dealer_ai_settings table (canonical)
//   2. If 42P01 → fall back to dealer_settings.ai_settings JSONB (compat read only)
//   3. Always read dealer_settings.ai_settings for key presence status
//      (keys are always stored there via the AES-256-GCM encryption flow)
//
// Key storage is NOT in scope here — API keys are always handled by
// src/lib/ai/save-ai-settings.ts (AES-256-GCM encryption flow).
//
// "use server" is not declared here — consumed by server actions.

import { createClient }         from "@/lib/supabase/server";
import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import type { AIProviderId }    from "@/lib/ai/types";
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

  // --- Step 1: Read from canonical dealer_ai_settings table (migration 072) ---
  let extendedRow: Record<string, unknown> | null = null;
  let canonicalTableAvailable = true;

  try {
    const { data, error } = await supabase
      .from("dealer_ai_settings")
      .select("*")
      .eq("dealer_id", dealer_id)
      .maybeSingle();

    if (error) {
      if (error.code === PG_UNDEFINED_TABLE || error.message?.includes("dealer_ai_settings")) {
        // Migration 072 not yet applied — will fall through to compat read
        canonicalTableAvailable = false;
      } else {
        // Real DB error — surface it
        return settingsFail("PERSISTENCE_ERROR", "Failed to read dealer_ai_settings", {
          code: error.code,
        });
      }
    } else {
      extendedRow = (data as Record<string, unknown> | null) ?? null;
    }
  } catch {
    canonicalTableAvailable = false;
  }

  // --- Step 2: Always read dealer_settings.ai_settings ---
  //   (a) Key presence status — always comes from here (keys never in dealer_ai_settings)
  //   (b) Basic config fallback when canonical table unavailable (compat read)
  let basicConfig: Record<string, unknown> = {};

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

    if (dsError) {
      return settingsFail("PERSISTENCE_ERROR", "Failed to read dealer_settings");
    }

    basicConfig = (dsData?.ai_settings as Record<string, unknown>) ?? {};
  } catch {
    return settingsFail("PERSISTENCE_ERROR", "Failed to read dealer_settings");
  }

  // --- Step 3: Build provider key status (always from dealer_settings.ai_settings) ---
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

  // --- Step 4: Resolve extended config source ---
  // Canonical: extendedRow from dealer_ai_settings
  // Compat read: JSONB values when canonical table not yet available
  // Note: cap_prefs/exec_prefs/budget_pol keys in JSONB were written by Sprint 11R
  // before this architecture clarification. They are read for backward compat
  // but will not be written going forward.

  const storageSource: AISettingsLoadResult["storage_source"] = extendedRow
    ? "dealer_ai_settings_table"
    : canonicalTableAvailable === false && Object.keys(basicConfig).length > 0
      ? "dealer_settings_compat"
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

  // primary_provider: canonical table uses "default_provider"; JSONB uses "primary_provider"
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

// Save targets dealer_ai_settings table ONLY.
// If the table does not exist (migration 072 not applied), return TABLE_NOT_AVAILABLE.
// We do NOT fall back to writing dealer_settings.ai_settings JSONB.

async function saveSettings(
  dealer_id: string,
  payload:   AISettingsSavePayload,
): Promise<AISettingsPersistenceResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const upsertData: Record<string, unknown> = {
    dealer_id,
    updated_at: now,
  };

  if (payload.primary_provider       !== undefined) upsertData.default_provider        = payload.primary_provider;
  if (payload.fallback_providers      !== undefined) upsertData.fallback_providers       = payload.fallback_providers;
  if (payload.capability_preferences  !== undefined) upsertData.capability_preferences   = payload.capability_preferences;
  if (payload.execution_preferences   !== undefined) upsertData.execution_preferences    = payload.execution_preferences;
  if (payload.budget_policy           !== undefined) upsertData.budget_policy            = payload.budget_policy;

  // Note: enabled / monthly_limit_usd / hard_limit are not in dealer_ai_settings schema.
  // They reside in dealer_settings.ai_settings and are written via saveAiSettings().
  // The repository does not manage key-adjacent basic config — that belongs to the
  // existing encrypted key flow in src/lib/ai/save-ai-settings.ts.

  try {
    const { error: upsertErr } = await supabase
      .from("dealer_ai_settings")
      .upsert(upsertData, { onConflict: "dealer_id" });

    if (upsertErr) {
      if (upsertErr.code === PG_UNDEFINED_TABLE || upsertErr.message?.includes("dealer_ai_settings")) {
        // Migration 072 not applied — do NOT fall back to JSONB
        return {
          ok:             false,
          storage_target: "none",
          error_code:     "TABLE_NOT_AVAILABLE",
          error_message:  "dealer_ai_settings table not available — migration 072 requires CTO approval",
          persisted_at:   now,
        };
      }
      return {
        ok:             false,
        storage_target: "none",
        error_code:     upsertErr.code,
        error_message:  "Failed to save to dealer_ai_settings table",
        persisted_at:   now,
      };
    }

    return { ok: true, storage_target: "dealer_ai_settings_table", persisted_at: now };
  } catch (err) {
    return {
      ok:             false,
      storage_target: "none",
      error_code:     "PERSISTENCE_ERROR",
      error_message:  "Unexpected error saving to dealer_ai_settings",
      persisted_at:   now,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSupabaseAISettingsRepository(): AISettingsRepository {
  return {
    load: loadSettings,
    save: saveSettings,
  };
}
