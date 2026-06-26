// DealerOS — AI Settings Platform: Provider Selection Model (Sprint 11O Phase B)
//
// Models how a dealer selects and prioritizes AI providers.
// Supports all 5 current providers and future additions via the adapter registry
// without code changes outside the registry.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }              from "@/lib/ai/types";
import type { AICapability }              from "@/lib/ai/capabilities";
import type { AIAdapterSelectionStrategy } from "@/lib/ai-orchestrator/provider-adapters";
import type { AICapabilityAssignmentMap }  from "./capability-assignment";

// ─── Selection rule ───────────────────────────────────────────────────────────

export interface AIProviderSelectionRule {
  provider_id:  AIProviderId;
  /** Priority index — 1 = highest priority. Must be unique per config. */
  priority:     number;
  /** Whether this rule is currently active. Dealers can deactivate without deleting. */
  is_active:    boolean;
  /** Max retry attempts before moving to next provider in the fallback chain. */
  max_retries:  number;
  /** Per-call timeout in ms before switching to fallback. 0 = no timeout. */
  timeout_ms:   number;
}

// ─── Selection config ─────────────────────────────────────────────────────────

export interface AIProviderSelectionConfig {
  primary_provider:    AIProviderId | null;
  fallback_providers:  AIProviderId[];
  selection_rules:     AIProviderSelectionRule[];
  strategy:            AIAdapterSelectionStrategy;
}

export const DEFAULT_PROVIDER_SELECTION: AIProviderSelectionConfig = {
  primary_provider:    null,
  fallback_providers:  [],
  selection_rules:     [],
  strategy:            "dealer_default",
};

// ─── Factories ────────────────────────────────────────────────────────────────

export function buildDefaultProviderSelection(
  primary?: AIProviderId,
): AIProviderSelectionConfig {
  if (!primary) return { ...DEFAULT_PROVIDER_SELECTION };
  return {
    primary_provider:   primary,
    fallback_providers: [],
    selection_rules:    [
      { provider_id: primary, priority: 1, is_active: true, max_retries: 2, timeout_ms: 30000 },
    ],
    strategy: "dealer_default",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * getProviderForCapability — returns the preferred provider for a given capability.
 *
 * Checks the capability assignment map first (per-capability overrides).
 * Falls back to primary_provider from the selection config.
 * Returns null if neither is configured.
 */
export function getProviderForCapability(
  selection:    AIProviderSelectionConfig,
  capability:   AICapability,
  assignments:  AICapabilityAssignmentMap,
): AIProviderId | null {
  const assignment = assignments[capability];
  if (assignment && assignment.status !== "disabled" && assignment.preferred_provider) {
    return assignment.preferred_provider;
  }
  return selection.primary_provider;
}

/**
 * getOrderedProviders — returns all providers in priority order.
 *
 * primary_provider first, then fallback_providers in declared order.
 * Deduplicates if primary_provider also appears in fallback_providers.
 */
export function getOrderedProviders(
  selection: AIProviderSelectionConfig,
): AIProviderId[] {
  const seen = new Set<AIProviderId>();
  const result: AIProviderId[] = [];
  const candidates: (AIProviderId | null)[] = [
    selection.primary_provider,
    ...selection.fallback_providers,
  ];
  for (const p of candidates) {
    if (p && !seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
}

export function isProviderSelectionConfigured(
  selection: AIProviderSelectionConfig,
): boolean {
  return selection.primary_provider !== null;
}
