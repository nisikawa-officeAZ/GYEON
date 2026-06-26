// DealerOS — AI Settings Platform: Repository Interfaces (Sprint 11R Phase A)
//
// Interface contracts for AI Settings persistence. All implementations must
// satisfy these contracts regardless of the storage backend.
//
// Canonical storage model (Architecture clarification post Sprint 11R):
//   CANONICAL:    dealer_ai_settings table (migration 072)
//                 → only long-term source of truth for AI Settings profiles
//   COMPAT READ:  dealer_settings.ai_settings JSONB (migration 070)
//                 → read-only backward compatibility during migration window
//                 → never written to for new AI Settings data
//                 → to be removed after all dealers have migrated (future cleanup task)
//
// Save behavior:
//   - Writes target dealer_ai_settings ONLY
//   - If dealer_ai_settings table not available (migration 072 not applied),
//     save returns NOT_CONFIGURED — it does NOT fall back to JSONB
//   - Callers must handle MIGRATION_REQUIRED and prompt for migration approval
//
// Load behavior:
//   - Reads dealer_ai_settings table first (canonical)
//   - If table unavailable, reads dealer_settings.ai_settings JSONB (compat read)
//   - storage_source reflects which layer was used
//
// Design principles:
//   - Interfaces are independent of the database implementation
//   - No direct SQL, no Supabase imports in this file
//   - dealer_id is always passed in — callers ensure it comes from getCurrentDealer()
//
// Pure — no "use server", no async signatures in interfaces (async is implementation detail).

import type { AIProviderId }     from "@/lib/ai/types";
import type { AICapability }     from "@/lib/ai/capabilities";
import type { AISettingsResult } from "../errors";

// ─── Load result ──────────────────────────────────────────────────────────────

/**
 * AISettingsStorageSource — identifies which storage layer provided the loaded data.
 *
 * "dealer_ai_settings_table": canonical — migration 072 applied, structured storage
 * "dealer_settings_compat":   compat read only — migration 072 not yet applied;
 *                              data read from dealer_settings.ai_settings JSONB for
 *                              backward compatibility; this layer is read-only and
 *                              will be removed after migration completion
 * "defaults":                 no stored data found; profile is built from coded defaults
 */
export type AISettingsStorageSource =
  | "dealer_ai_settings_table"
  | "dealer_settings_compat"
  | "defaults";

/**
 * AISettingsLoadResult — raw data loaded from storage before domain type construction.
 *
 * Provides a stable intermediate representation regardless of which storage
 * layer was used. Callers inspect storage_source if they need to know which
 * layer responded (e.g. to display a migration prompt in the UI).
 */
export interface AISettingsLoadResult {
  primary_provider:       AIProviderId | null;
  fallback_providers:     AIProviderId[];
  enabled:                boolean;
  monthly_limit_usd:      number;
  hard_limit:             boolean;
  /** Serialized AICapabilityAssignmentMap from database. Empty object if never saved. */
  capability_preferences: Record<string, unknown>;
  /** Serialized AIExecutionPreference from database. Empty object if never saved. */
  execution_preferences:  Record<string, unknown>;
  /** Serialized AIBudgetPolicyConfig from database. Empty object if never saved. */
  budget_policy:          Record<string, unknown>;
  /** Key presence per provider — always from dealer_settings.ai_settings (never raw keys). */
  provider_key_status:    Partial<Record<AIProviderId, {
    has_key:      boolean;
    validated_at: string | null;
  }>>;
  storage_source:  AISettingsStorageSource;
  loaded_at:       string;  // ISO 8601
}

// ─── Save payload ─────────────────────────────────────────────────────────────

/**
 * AISettingsSavePayload — partial update input to the repository.
 *
 * All fields are optional — repository only updates fields that are present.
 * API keys are NOT in this payload — those go through the encrypted key flow
 * in src/lib/ai/save-ai-settings.ts.
 */
export interface AISettingsSavePayload {
  primary_provider?:       AIProviderId | null;
  fallback_providers?:     AIProviderId[];
  enabled?:                boolean;
  monthly_limit_usd?:      number;
  hard_limit?:             boolean;
  capability_preferences?: Record<string, unknown>;
  execution_preferences?:  Record<string, unknown>;
  budget_policy?:          Record<string, unknown>;
}

// ─── Persistence result ───────────────────────────────────────────────────────

/**
 * AISettingsPersistenceTarget — where the save was committed.
 *
 * "dealer_ai_settings_table": canonical write succeeded
 * "none":                     save did not complete (table unavailable or DB error)
 *
 * There is no "dealer_settings_jsonb" target — new writes never go to JSONB.
 * The JSONB layer is read-only for backward compatibility.
 */
export type AISettingsPersistenceTarget =
  | "dealer_ai_settings_table"
  | "none";

export interface AISettingsPersistenceResult {
  ok:              boolean;
  storage_target:  AISettingsPersistenceTarget;
  error_code?:     string;
  error_message?:  string;
  persisted_at:    string;  // ISO 8601
}

// ─── Usage summary ────────────────────────────────────────────────────────────

export interface AIUsageSummaryResult {
  dealer_id:           string;
  period:              string;   // "YYYY-MM"
  total_tokens:        number;
  estimated_cost_usd:  number;
  current_month_usd:   number;
  row_count:           number;
  by_provider:         Partial<Record<AIProviderId, { tokens: number; cost_usd: number }>>;
  by_capability:       Partial<Record<AICapability, { tokens: number; cost_usd: number }>>;
  table_available:     boolean;
  loaded_at:           string;   // ISO 8601
}

// ─── Repository interfaces ────────────────────────────────────────────────────

/**
 * AISettingsRepository — interface for reading and writing AI Settings profiles.
 *
 * Implementations must:
 *   - Never return raw API keys
 *   - For load: try canonical table, fall back to compat read, then defaults
 *   - For save: write to canonical table ONLY — never write to JSONB compat layer
 *   - Accept dealer_id as a parameter — callers ensure it comes from getCurrentDealer()
 */
export interface AISettingsRepository {
  load(dealer_id: string): Promise<AISettingsResult<AISettingsLoadResult>>;
  save(dealer_id: string, payload: AISettingsSavePayload): Promise<AISettingsPersistenceResult>;
}

/**
 * AIUsageRepository — interface for reading AI usage and spend data.
 *
 * All methods return 0 / empty safely when dealer_ai_usage_log does not exist.
 */
export interface AIUsageRepository {
  getMonthlySpend(dealer_id: string, period: string): Promise<number>;
  getSummary(dealer_id: string, period: string): Promise<AIUsageSummaryResult>;
}

/**
 * AISettingsRepositoryFactory — creates repository instances.
 *
 * Injected into server actions so implementations can be swapped without
 * changing the action code.
 */
export interface AISettingsRepositoryFactory {
  createSettingsRepository(): AISettingsRepository;
  createUsageRepository(): AIUsageRepository;
}
