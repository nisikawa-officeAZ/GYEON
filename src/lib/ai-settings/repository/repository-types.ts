// DealerOS — AI Settings Platform: Repository Interfaces (Sprint 11R Phase A)
//
// Interface contracts for AI Settings persistence. All implementations must
// satisfy these contracts regardless of the storage backend.
//
// Design principles:
//   - Interfaces are independent of the database implementation
//   - No direct SQL, no Supabase imports in this file
//   - dealer_id is always passed in — callers ensure it comes from getCurrentDealer()
//   - If required tables do not exist, load returns a graceful NOT_CONFIGURED result
//     and save falls back to the dealer_settings.ai_settings JSONB column
//
// Pure — no "use server", no async signatures in interfaces (async is implementation detail).

import type { AIProviderId }     from "@/lib/ai/types";
import type { AICapability }     from "@/lib/ai/capabilities";
import type { AISettingsResult } from "../errors";

// ─── Load result ──────────────────────────────────────────────────────────────

export type AISettingsStorageSource =
  | "dealer_ai_settings_table" // Migration 072 applied — preferred structured storage
  | "dealer_settings_jsonb"    // Fallback: extended fields stored in existing JSONB column
  | "defaults";                // No stored data found; profile built from defaults

/**
 * AISettingsLoadResult — raw data loaded from storage before domain type construction.
 *
 * Provides a stable intermediate representation regardless of which storage
 * backend was used (dealer_ai_settings table vs. dealer_settings JSONB fallback).
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
  /** Key presence per provider — derived from dealer_settings.ai_settings (never raw keys). */
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

export type AISettingsPersistenceTarget =
  | "dealer_ai_settings_table"
  | "dealer_settings_jsonb"
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
 *   - Handle missing tables gracefully (return defaults or NOT_CONFIGURED)
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
