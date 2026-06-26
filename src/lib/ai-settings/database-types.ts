// DealerOS — AI Settings Platform: Database Row Types (Sprint 11P)
//
// TypeScript representations of the PROPOSED database schema for the AI Settings Platform.
//
// IMPORTANT: These tables do NOT yet exist in the database.
// Migrations 072 (dealer_ai_settings) and 073 (dealer_ai_usage_log) require
// CTO approval before any migration is applied.
//
// These types are used to:
//   1. Define the exact shape of data that will be stored and loaded
//   2. Enable type-safe server actions in Sprint 11Q
//   3. Document the persistence contract for the AI Settings Platform
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }    from "@/lib/ai/types";
import type { AICapability }    from "@/lib/ai/capabilities";
import type {
  AICapabilityAssignmentMap,
  AIBudgetPolicyConfig,
  AIBudgetStrategy,
} from "./index";
import type { AIExecutionPreference } from "./settings-profile-types";

// ─── dealer_ai_settings row ───────────────────────────────────────────────────

/**
 * DealerAiSettingsRow — shape of a row in the proposed dealer_ai_settings table.
 *
 * CTO approval required before migration 072_dealer_ai_settings.sql is applied.
 * One row per dealer (UNIQUE dealer_id constraint).
 */
export interface DealerAiSettingsRow {
  id:                     string;          // uuid PK
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:              string;          // uuid FK → dealers.id (UNIQUE)
  default_provider:       AIProviderId | null;
  fallback_providers:     AIProviderId[];
  provider_priority_order: AIProviderId[];
  /** Serialized AICapabilityAssignmentMap */
  capability_preferences: Record<string, unknown>;
  /** Serialized AIExecutionPreference */
  execution_preferences:  Record<string, unknown>;
  /** Serialized AIBudgetPolicyConfig */
  budget_policy:          Record<string, unknown>;
  /** Serialized health check preference config */
  health_policy:          Record<string, unknown>;
  settings_version:       number;
  created_at:             string;  // ISO 8601
  updated_at:             string;  // ISO 8601
}

/**
 * DealerAiSettingsInsert — typed insert shape for dealer_ai_settings.
 *
 * Used by Sprint 11Q server actions to insert a new settings row.
 * id, created_at, updated_at, settings_version are omitted (DB defaults).
 */
export type DealerAiSettingsInsert = Omit<
  DealerAiSettingsRow,
  "id" | "created_at" | "updated_at" | "settings_version"
>;

/**
 * DealerAiSettingsUpdate — typed update shape for dealer_ai_settings.
 *
 * All fields except dealer_id and id are optional.
 * dealer_id must never change — it is the partition key.
 */
export type DealerAiSettingsUpdate = Partial<
  Omit<DealerAiSettingsRow, "id" | "dealer_id" | "created_at">
>;

// ─── dealer_ai_usage_log row ──────────────────────────────────────────────────

/**
 * AIExecutionStatus — possible values for dealer_ai_usage_log.execution_status.
 */
export type AIExecutionStatus =
  | "success"           // Execution completed, provider returned a response
  | "error"             // Execution failed with a provider error
  | "timeout"           // Execution timed out waiting for provider response
  | "blocked_budget"    // Blocked by budget policy before reaching provider
  | "blocked_guard";    // Blocked by execution guard (non-budget reason)

/**
 * DealerAiUsageLogRow — shape of a row in the proposed dealer_ai_usage_log table.
 *
 * CTO approval required before migration 073_dealer_ai_usage_log.sql is applied.
 * Append-only — no UPDATE or DELETE policies (service_role GDPR erasure exception).
 */
export interface DealerAiUsageLogRow {
  id:                  string;   // uuid PK
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:           string;   // uuid FK → dealers.id
  /** References future dealer_ai_executions table (Sprint 11T+). null until then. */
  execution_id:        string | null;
  provider:            AIProviderId;
  capability:          AICapability;
  task_type:           string | null;
  model:               string;
  prompt_tokens:       number;
  completion_tokens:   number;
  total_tokens:        number;
  /** Estimated cost in USD computed before the call. */
  estimated_cost_usd:  number;
  /** Actual cost in USD reported by provider after the call. null if not reported. */
  actual_cost_usd:     number | null;
  /** Elapsed time for the provider call in ms. null if not measured. */
  execution_time_ms:   number | null;
  execution_status:    AIExecutionStatus;
  /** Category of error if execution_status is 'error' or 'timeout'. */
  error_category:      string | null;
  /** English, sanitized error message. No raw provider API error data. */
  error_message_safe:  string | null;
  created_at:          string;   // ISO 8601 (immutable — no updated_at)
}

/**
 * DealerAiUsageLogInsert — typed insert shape for dealer_ai_usage_log.
 *
 * Used by Sprint 11Q server actions to log an AI execution.
 * id and created_at are omitted (DB defaults).
 */
export type DealerAiUsageLogInsert = Omit<DealerAiUsageLogRow, "id" | "created_at">;

// ─── JSON serialization helpers ───────────────────────────────────────────────

/**
 * serializeCapabilityPreferences — converts AICapabilityAssignmentMap to a
 * plain object safe for storing in the JSONB column.
 *
 * Called by Sprint 11Q's saveAiSettingsProfile() server action.
 */
export function serializeCapabilityPreferences(
  map: AICapabilityAssignmentMap,
): Record<string, unknown> {
  return map as Record<string, unknown>;
}

/**
 * deserializeCapabilityPreferences — parses the JSONB column value back
 * into AICapabilityAssignmentMap.
 *
 * Called by Sprint 11Q's getAiSettingsProfile() server action.
 * Returns empty map if the column is null or an unexpected shape.
 */
export function deserializeCapabilityPreferences(
  raw: Record<string, unknown> | null,
): AICapabilityAssignmentMap {
  if (!raw || typeof raw !== "object") return {};
  return raw as AICapabilityAssignmentMap;
}

/**
 * serializeBudgetPolicy — converts AIBudgetPolicyConfig to a plain object.
 */
export function serializeBudgetPolicy(
  policy: AIBudgetPolicyConfig,
): Record<string, unknown> {
  return policy as unknown as Record<string, unknown>;
}

/**
 * deserializeBudgetPolicy — parses the JSONB column value back into AIBudgetPolicyConfig.
 * Returns null if the column is empty so callers can apply DEFAULT_BUDGET_POLICY.
 */
export function deserializeBudgetPolicy(
  raw: Record<string, unknown> | null,
): AIBudgetPolicyConfig | null {
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return null;
  return raw as unknown as AIBudgetPolicyConfig;
}

/**
 * serializeExecutionPreference — converts AIExecutionPreference to a plain object.
 */
export function serializeExecutionPreference(
  pref: AIExecutionPreference,
): Record<string, unknown> {
  return pref as unknown as Record<string, unknown>;
}

/**
 * deserializeExecutionPreference — parses the JSONB column back into AIExecutionPreference.
 * Returns null if empty so callers can apply DEFAULT_EXECUTION_PREFERENCE.
 */
export function deserializeExecutionPreference(
  raw: Record<string, unknown> | null,
): AIExecutionPreference | null {
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return null;
  return raw as unknown as AIExecutionPreference;
}

// ─── Proposal status descriptor ───────────────────────────────────────────────

export interface AISettingsDatabaseProposalStatus {
  dealer_ai_settings_table:  "proposed";  // Migration 072 — CTO approval required
  dealer_ai_usage_log_table: "proposed";  // Migration 073 — CTO approval required
  migrations_applied:        false;
  approval_required_from:    "CTO";
  target_sprint:             "Sprint 11Q";
}

export const AI_SETTINGS_DATABASE_PROPOSAL: AISettingsDatabaseProposalStatus = {
  dealer_ai_settings_table:  "proposed",
  dealer_ai_usage_log_table: "proposed",
  migrations_applied:        false,
  approval_required_from:    "CTO",
  target_sprint:             "Sprint 11Q",
};
