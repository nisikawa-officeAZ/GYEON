// DealerOS — AI Settings Platform: Orchestrator Integration (Sprint 11O Phase F)
//
// Integration layer between the AI Settings Platform and the AI Orchestrator.
//
// consultAISettingsForExecution() is called BEFORE the 13-check execution guard.
// It evaluates whether the dealer's settings profile permits a new execution
// for a given capability, and returns the provider and budget context needed
// by the guard.
//
// Intended data flow (Sprint 11P+):
//   Server Action
//     → getCurrentDealer()                             (dealer_id)
//     → load AISettingsProfile from DB                 (future: Sprint 11P+)
//     → consultAISettingsForExecution()                (this module)
//     → checkProviderExecutionReadiness()              (ai-orchestrator/provider-execution)
//     → agent.execute()                                (Sprint 11P+)
//
// AISettingsExecutionContext deliberately does NOT import AIProviderExecutionContext
// from ai-orchestrator to avoid a cross-module dependency cycle. The calling
// server action merges both into the final execution context.
//
// No AI execution in Sprint 11O. No SDK imports. No network calls.
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AICapability }       from "@/lib/ai/capabilities";
import type { AIProviderId }       from "@/lib/ai/types";
import type { AISettingsProfile }  from "./settings-profile-types";
import type { AICapabilityAssignment } from "./capability-assignment";
import type {
  AIBudgetPolicyEvaluation,
  AIBudgetStrategy,
}                                        from "./budget-policy";
import { evaluateBudgetPolicy }         from "./budget-policy";
import { getProviderForCapability }      from "./provider-selection";
import {
  getAssignmentForCapability,
  isCapabilityEnabled,
}                                        from "./capability-assignment";

// ─── Consult decision ─────────────────────────────────────────────────────────

export type AISettingsConsultDecision =
  | "proceed"               // Settings allow this execution; proceed to execution guard
  | "blocked_no_provider"   // No primary or capability-specific provider configured
  | "blocked_budget"        // Budget policy blocks this execution
  | "blocked_capability"    // Capability is explicitly disabled in capability assignments
  | "blocked_gateway"       // AI features are not enabled for this dealer
  | "proceed_with_warnings"; // Allowed, but soft warnings exist (e.g. near budget limit)

// ─── Consult result ───────────────────────────────────────────────────────────

export interface AISettingsConsultResult {
  decision:              AISettingsConsultDecision;
  selected_provider:     AIProviderId | null;
  fallback_providers:    AIProviderId[];
  capability_assignment: AICapabilityAssignment | null;
  budget_evaluation:     AIBudgetPolicyEvaluation;
  /** English explanation if decision is a blocked_* value. null if proceeding. */
  blocking_reason:       string | null;
  /** Soft warnings that do not block execution. Empty array if none. */
  warnings:              string[];
  /** ISO 8601 timestamp of when this consultation was evaluated. */
  consulted_at:          string;
}

// ─── Settings-derived execution context ──────────────────────────────────────

/**
 * AISettingsExecutionContext — settings-derived fields for populating an
 * AIProviderExecutionContext (ai-orchestrator/provider-execution).
 *
 * The calling server action merges these with dealer_id, agent_id, task_type,
 * active_features, gateway_status, and usage_policy to form the full context.
 */
export interface AISettingsExecutionContext {
  /** Selected provider from settings — maps to gateway_provider in execution context. */
  selected_provider:  AIProviderId | null;
  /** Required capabilities for this task — from capability routing. */
  required_caps:      AICapability[];
  /** Estimated cost in USD for budget guard evaluation. */
  estimated_cost_usd: number;
  budget_strategy:    AIBudgetStrategy;
  /** Always false in Sprint 11O — execution deferred to Sprint 11P+. */
  run_execute:        false;
}

// ─── Integration status descriptor ───────────────────────────────────────────

export interface AISettingsIntegrationStatus {
  version:                     string;
  /** true from Sprint 11R — repository layer and server actions implemented. */
  settings_available:          boolean;
  integration_target_sprint:   string;
  consult_function_available:  true;
  execution_context_available: true;
}

export const AI_SETTINGS_INTEGRATION: AISettingsIntegrationStatus = {
  version:                     "1.1.0-persisted",
  settings_available:          true,
  integration_target_sprint:   "Sprint 11R",
  consult_function_available:  true,
  execution_context_available: true,
};

// ─── Integration functions ────────────────────────────────────────────────────

/**
 * consultAISettingsForExecution — evaluates whether the dealer's settings profile
 * permits a new AI execution for a given capability.
 *
 * Called BEFORE checkProviderExecutionReadiness() in the server action.
 * Returns the provider to use and a typed decision for the orchestrator.
 *
 * Does not execute AI inference. Does not call external services.
 * The profile must have been loaded by a server action that called getCurrentDealer().
 *
 * current_month_usd defaults to 0 until dealer_ai_usage_log migration is available (Sprint 11P+).
 */
export function consultAISettingsForExecution(
  profile:            AISettingsProfile,
  capability:         AICapability,
  estimated_cost_usd: number,
  now:                string,
  current_month_usd:  number = 0,
): AISettingsConsultResult {
  const warnings: string[] = [];

  // Check 1: AI enabled
  if (!profile.is_ai_enabled) {
    return {
      decision:              "blocked_gateway",
      selected_provider:     null,
      fallback_providers:    [],
      capability_assignment: null,
      budget_evaluation:     evaluateBudgetPolicy(profile.budget_policy, current_month_usd, estimated_cost_usd),
      blocking_reason:       "AI features are not enabled for this dealer",
      warnings:              [],
      consulted_at:          now,
    };
  }

  // Check 2: Capability not explicitly disabled
  if (!isCapabilityEnabled(profile.capability_assignments, capability)) {
    return {
      decision:              "blocked_capability",
      selected_provider:     null,
      fallback_providers:    [],
      capability_assignment: getAssignmentForCapability(profile.capability_assignments, capability),
      budget_evaluation:     evaluateBudgetPolicy(profile.budget_policy, current_month_usd, estimated_cost_usd),
      blocking_reason:       `Capability '${capability}' is disabled in dealer capability assignments`,
      warnings:              [],
      consulted_at:          now,
    };
  }

  // Check 3: Provider configured for this capability
  const selected_provider = getProviderForCapability(
    profile.provider_selection,
    capability,
    profile.capability_assignments,
  );

  if (!selected_provider) {
    return {
      decision:              "blocked_no_provider",
      selected_provider:     null,
      fallback_providers:    [],
      capability_assignment: getAssignmentForCapability(profile.capability_assignments, capability),
      budget_evaluation:     evaluateBudgetPolicy(profile.budget_policy, current_month_usd, estimated_cost_usd),
      blocking_reason:       `No provider configured for capability '${capability}'`,
      warnings:              [],
      consulted_at:          now,
    };
  }

  // Check 4: Budget policy
  const budget_evaluation = evaluateBudgetPolicy(
    profile.budget_policy,
    current_month_usd,
    estimated_cost_usd,
  );

  if (!budget_evaluation.should_proceed) {
    return {
      decision:              "blocked_budget",
      selected_provider,
      fallback_providers:    profile.provider_selection.fallback_providers,
      capability_assignment: getAssignmentForCapability(profile.capability_assignments, capability),
      budget_evaluation,
      blocking_reason:       budget_evaluation.blocking_reason,
      warnings:              [],
      consulted_at:          now,
    };
  }

  if (budget_evaluation.warning_message) {
    warnings.push(budget_evaluation.warning_message);
  }

  return {
    decision:              warnings.length > 0 ? "proceed_with_warnings" : "proceed",
    selected_provider,
    fallback_providers:    profile.provider_selection.fallback_providers,
    capability_assignment: getAssignmentForCapability(profile.capability_assignments, capability),
    budget_evaluation,
    blocking_reason:       null,
    warnings,
    consulted_at:          now,
  };
}

/**
 * buildExecutionContextFromSettings — builds settings-derived fields for an
 * AIProviderExecutionContext from a consult result and required capabilities.
 *
 * The calling server action merges these with dealer_id, agent_id, task_type,
 * active_features, gateway_status, and usage_policy to form the full context.
 *
 * run_execute is always false in Sprint 11O.
 */
export function buildExecutionContextFromSettings(
  consult:            AISettingsConsultResult,
  required_caps:      AICapability[],
  estimated_cost_usd: number,
): AISettingsExecutionContext {
  return {
    selected_provider:  consult.selected_provider,
    required_caps,
    estimated_cost_usd,
    budget_strategy:    consult.budget_evaluation.strategy,
    run_execute:        false,
  };
}

/** getSettingsIntegrationStatus — returns the current integration status descriptor. */
export function getSettingsIntegrationStatus(): AISettingsIntegrationStatus {
  return AI_SETTINGS_INTEGRATION;
}
