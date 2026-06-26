// DealerOS — AI Orchestration Engine: Adapter Selection Policy (Sprint 11N Phase D)
//
// Models the policy governing which provider adapter is chosen for a given step.
//
// No runtime selection execution in Sprint 11N — strategy model only.
// Applied in Sprint 11O+ when concrete adapters are available.
//
// Supported strategies:
//   dealer_default         — use the dealer's configured primary provider
//   lowest_estimated_cost  — pick the cheapest provider that supports the capability
//   best_quality           — pick the highest quality_tier provider
//   fastest_response       — pick the lowest latency provider
//   capability_required    — filter by required capability, then apply dealer_default
//   fallback_provider      — try primary provider first, then fallback_providers in order
//
// Security rules:
//   - No API key fields in any policy type
//   - dealer_id always from getCurrentDealer() in the calling server action
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }   from "@/lib/ai/types";
import type { AICapability }   from "@/lib/ai/capabilities";
import type {
  AIAdapterSelectionStrategy,
  AIProviderAdapterSelectionPolicy,
  AIProviderAdapterDescriptor,
}                              from "./adapter-registry-types";
import {
  AI_PROVIDER_ADAPTER_DESCRIPTORS,
}                              from "./provider-descriptors";

// ─── Default selection policy ─────────────────────────────────────────────────

/**
 * DEFAULT_ADAPTER_SELECTION_POLICY — the default policy applied when no dealer-specific
 * selection policy has been configured.
 *
 * Uses dealer_default strategy — the dealer's AI Gateway primary_provider is used.
 * No capability filter — all capabilities are allowed.
 */
export const DEFAULT_ADAPTER_SELECTION_POLICY: AIProviderAdapterSelectionPolicy = {
  strategy:             "dealer_default",
  preferred_provider:   null,   // Resolved from dealer's AI Gateway settings at runtime
  fallback_providers:   [],
  capability_filter:    [],
  max_cost_tier:        null,
  min_quality_tier:     null,
};

/**
 * QUALITY_FIRST_SELECTION_POLICY — policy for workflows where output quality is paramount.
 *
 * Uses best_quality strategy — selects the highest quality_tier available descriptor.
 */
export const QUALITY_FIRST_SELECTION_POLICY: AIProviderAdapterSelectionPolicy = {
  strategy:             "best_quality",
  preferred_provider:   null,
  fallback_providers:   ["anthropic", "openai"],
  capability_filter:    [],
  max_cost_tier:        null,
  min_quality_tier:     "best",
};

/**
 * COST_OPTIMIZED_SELECTION_POLICY — policy for batch or high-volume workflows.
 *
 * Uses lowest_estimated_cost strategy with a "standard" quality floor.
 */
export const COST_OPTIMIZED_SELECTION_POLICY: AIProviderAdapterSelectionPolicy = {
  strategy:             "lowest_estimated_cost",
  preferred_provider:   null,
  fallback_providers:   ["gemini", "openrouter"],
  capability_filter:    [],
  max_cost_tier:        "standard",
  min_quality_tier:     "good",
};

/**
 * ENTERPRISE_SELECTION_POLICY — policy for enterprise dealers on Azure OpenAI.
 *
 * Uses fallback_provider strategy: azure_openai first, then openai as fallback.
 */
export const ENTERPRISE_SELECTION_POLICY: AIProviderAdapterSelectionPolicy = {
  strategy:             "fallback_provider",
  preferred_provider:   "azure_openai",
  fallback_providers:   ["openai"],
  capability_filter:    [],
  max_cost_tier:        null,
  min_quality_tier:     "better",
};

// ─── Selection helpers ────────────────────────────────────────────────────────

/**
 * COST_TIER_ORDER — relative ordering of cost tiers (lower index = cheaper).
 */
const COST_TIER_ORDER: AIProviderAdapterDescriptor["estimated_cost_tier"][] = [
  "budget",
  "standard",
  "premium",
];

/**
 * QUALITY_TIER_ORDER — relative ordering of quality tiers (lower index = lower quality).
 */
const QUALITY_TIER_ORDER: AIProviderAdapterDescriptor["quality_tier"][] = [
  "good",
  "better",
  "best",
];

/**
 * SPEED_TIER_ORDER — relative ordering of speed tiers (lower index = faster).
 */
const SPEED_TIER_ORDER: AIProviderAdapterDescriptor["response_speed_tier"][] = [
  "fast",
  "standard",
  "slow",
];

/**
 * filterDescriptorsByPolicy — applies cost and quality tier filters from a selection policy.
 *
 * Returns only descriptors that satisfy both max_cost_tier and min_quality_tier constraints.
 * If a filter is null, it is not applied.
 *
 * Note: In Sprint 11N all descriptors have adapter_available: false.
 * This function operates on the full descriptor set for planning purposes.
 */
export function filterDescriptorsByPolicy(
  policy:      AIProviderAdapterSelectionPolicy,
  descriptors: AIProviderAdapterDescriptor[] = AI_PROVIDER_ADAPTER_DESCRIPTORS,
): AIProviderAdapterDescriptor[] {
  let result = [...descriptors];

  // Apply capability filter — keep only descriptors that have all required caps as planned/supported_later
  if (policy.capability_filter.length > 0) {
    result = result.filter((d) =>
      policy.capability_filter.every((cap) => {
        const decl = d.capability_map[cap];
        if (!decl) return false;
        return decl.support_status === "planned" || decl.support_status === "supported_later";
      }),
    );
  }

  // Apply max cost tier filter
  if (policy.max_cost_tier !== null) {
    const max_idx = COST_TIER_ORDER.indexOf(policy.max_cost_tier);
    result = result.filter((d) => COST_TIER_ORDER.indexOf(d.estimated_cost_tier) <= max_idx);
  }

  // Apply min quality tier filter
  if (policy.min_quality_tier !== null) {
    const min_idx = QUALITY_TIER_ORDER.indexOf(policy.min_quality_tier);
    result = result.filter((d) => QUALITY_TIER_ORDER.indexOf(d.quality_tier) >= min_idx);
  }

  return result;
}

/**
 * rankDescriptorsByStrategy — sorts descriptors according to a selection strategy.
 *
 * Returns a new array sorted by the strategy's preference order.
 * No runtime selection execution — use for planning and UI display only in Sprint 11N.
 */
export function rankDescriptorsByStrategy(
  strategy:    AIAdapterSelectionStrategy,
  descriptors: AIProviderAdapterDescriptor[],
): AIProviderAdapterDescriptor[] {
  const ranked = [...descriptors];

  switch (strategy) {
    case "lowest_estimated_cost":
      ranked.sort((a, b) =>
        COST_TIER_ORDER.indexOf(a.estimated_cost_tier) -
        COST_TIER_ORDER.indexOf(b.estimated_cost_tier),
      );
      break;

    case "best_quality":
      ranked.sort((a, b) =>
        QUALITY_TIER_ORDER.indexOf(b.quality_tier) -
        QUALITY_TIER_ORDER.indexOf(a.quality_tier),
      );
      break;

    case "fastest_response":
      ranked.sort((a, b) =>
        SPEED_TIER_ORDER.indexOf(a.response_speed_tier) -
        SPEED_TIER_ORDER.indexOf(b.response_speed_tier),
      );
      break;

    case "dealer_default":
    case "capability_required":
    case "fallback_provider":
      // Ranked by selection_weight — higher weight = preferred
      ranked.sort((a, b) => b.selection_weight - a.selection_weight);
      break;
  }

  return ranked;
}

/**
 * resolveSelectionOrder — returns the providers in the order they should be tried,
 * according to the given selection policy and capability requirements.
 *
 * In Sprint 11N: no adapter is available, so this is informational only.
 * In Sprint 11O+: the first provider in this list that has adapter_available: true
 * and supports the required capabilities will be used for execution.
 */
export function resolveSelectionOrder(
  policy:         AIProviderAdapterSelectionPolicy,
  required_caps:  AICapability[],
): AIProviderId[] {
  const policy_with_caps: AIProviderAdapterSelectionPolicy = {
    ...policy,
    capability_filter: [
      ...new Set([...policy.capability_filter, ...required_caps]),
    ],
  };

  const filtered = filterDescriptorsByPolicy(policy_with_caps);
  const ranked   = rankDescriptorsByStrategy(policy.strategy, filtered);

  // For fallback_provider strategy: preferred first, then fallbacks, then remainder
  if (policy.strategy === "fallback_provider" && policy.preferred_provider) {
    const preferred     = ranked.find((d) => d.provider_id === policy.preferred_provider);
    const fallbacks     = policy.fallback_providers
      .map((id) => ranked.find((d) => d.provider_id === id))
      .filter((d): d is AIProviderAdapterDescriptor => d !== undefined);
    const others = ranked.filter(
      (d) =>
        d.provider_id !== policy.preferred_provider &&
        !policy.fallback_providers.includes(d.provider_id),
    );
    const ordered = [
      ...(preferred ? [preferred] : []),
      ...fallbacks,
      ...others,
    ];
    return ordered.map((d) => d.provider_id);
  }

  return ranked.map((d) => d.provider_id);
}

/**
 * getSelectionPolicyLabel — returns a human-readable English label for a strategy.
 */
export function getSelectionPolicyLabel(strategy: AIAdapterSelectionStrategy): string {
  const labels: Record<AIAdapterSelectionStrategy, string> = {
    dealer_default:        "Dealer Default",
    lowest_estimated_cost: "Lowest Estimated Cost",
    best_quality:          "Best Quality",
    fastest_response:      "Fastest Response",
    capability_required:   "Capability Required",
    fallback_provider:     "Primary + Fallback",
  };
  return labels[strategy];
}
