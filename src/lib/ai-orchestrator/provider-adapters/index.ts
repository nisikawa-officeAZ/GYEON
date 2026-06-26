// DealerOS — AI Orchestration Engine: Provider Adapter Registry (Sprint 11N)
//
// Barrel export for the provider-adapters module.
//
// Also exports inspectAdapterRegistry() — the key integration point consumed
// by the execution guard (Phase E) in provider-execution/execution-guard.ts.

import type { AIProviderId }   from "@/lib/ai/types";
import type { AICapability }   from "@/lib/ai/capabilities";
import type {
  AIAdapterRegistryDecision,
  AIAdapterRegistryInspection,
  AIProviderAdapterRegistry,
}                              from "./adapter-registry-types";
import {
  getAdapterDescriptor,
  AI_PROVIDER_ADAPTER_DESCRIPTORS,
}                              from "./provider-descriptors";
import {
  getUnavailableCapabilities,
}                              from "./capability-map";

// ─── Adapter registry descriptor ─────────────────────────────────────────────

/**
 * AI_PROVIDER_ADAPTER_REGISTRY — static registry descriptor.
 */
export const AI_PROVIDER_ADAPTER_REGISTRY: AIProviderAdapterRegistry = {
  version:     "1.0.0",
  descriptors: AI_PROVIDER_ADAPTER_DESCRIPTORS,
  total:       AI_PROVIDER_ADAPTER_DESCRIPTORS.length,
  available:   AI_PROVIDER_ADAPTER_DESCRIPTORS.filter((d) => d.adapter_available).length,
};

// ─── Registry inspection ──────────────────────────────────────────────────────

/**
 * inspectAdapterRegistry — inspects the registry for a given provider and capability set.
 *
 * Returns an AIAdapterRegistryInspection with a typed decision:
 *   "adapter_available"       — adapter_available: true; execution can proceed
 *   "needs_adapter"           — descriptor found; adapter not yet implemented
 *   "provider_unknown"        — provider not registered in the descriptor registry
 *   "capability_unavailable"  — required capabilities are "unavailable" for this provider
 *
 * Called by the execution guard (Sprint 11N Phase E) as check #13.
 * Also available to callers that need registry-aware provider diagnostics.
 *
 * No DB calls. No external calls. Pure lookup.
 */
export function inspectAdapterRegistry(
  provider_id:    AIProviderId | null,
  required_caps:  AICapability[],
): AIAdapterRegistryInspection {
  // No provider configured
  if (!provider_id) {
    return {
      provider_id:       null,
      decision:          "provider_unknown" as AIAdapterRegistryDecision,
      descriptor_found:  false,
      adapter_available: false,
      unavailable_caps:  [],
      message:           "No provider configured — registry inspection skipped",
    };
  }

  const descriptor = getAdapterDescriptor(provider_id);

  // Provider not in the adapter descriptor registry
  if (!descriptor) {
    return {
      provider_id,
      decision:          "provider_unknown" as AIAdapterRegistryDecision,
      descriptor_found:  false,
      adapter_available: false,
      unavailable_caps:  [],
      message:           `Provider '${provider_id}' is not registered in the adapter descriptor registry`,
    };
  }

  // Check for capabilities that are "unavailable" (never implementable for this provider)
  const unavailable_caps = getUnavailableCapabilities(provider_id, required_caps);
  if (unavailable_caps.length > 0) {
    return {
      provider_id,
      decision:          "capability_unavailable" as AIAdapterRegistryDecision,
      descriptor_found:  true,
      adapter_available: descriptor.adapter_available,
      unavailable_caps,
      message:           `Provider '${provider_id}' cannot support: ${unavailable_caps.join(", ")} — marked unavailable in adapter descriptor`,
    };
  }

  // Descriptor found but concrete adapter not yet implemented
  if (!descriptor.adapter_available) {
    return {
      provider_id,
      decision:          "needs_adapter" as AIAdapterRegistryDecision,
      descriptor_found:  true,
      adapter_available: false,
      unavailable_caps:  [],
      message:           `Provider '${provider_id}' adapter descriptor registered; concrete adapter planned for ${descriptor.planned_adapter_sprint}`,
    };
  }

  // Fully available
  return {
    provider_id,
    decision:          "adapter_available" as AIAdapterRegistryDecision,
    descriptor_found:  true,
    adapter_available: true,
    unavailable_caps:  [],
    message:           `Provider '${provider_id}' adapter is available`,
  };
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

// Phase A: Registry domain types
export type {
  AIProviderAdapterStatus,
  AICapabilitySupportStatus,
  AIProviderCapabilityDeclaration,
  AIProviderAdapterCapabilityMap,
  AIProviderAdapterDefaultModels,
  AIProviderAdapterDescriptor,
  AIProviderAdapterRegistry,
  AIAdapterRegistryDecision,
  AIAdapterRegistryInspection,
  AIAdapterSelectionStrategy,
  AIProviderAdapterSelectionPolicy,
  AIProviderAdapterValidationResult,
} from "./adapter-registry-types";

// Phase B: Provider descriptors
export {
  OPENAI_ADAPTER_DESCRIPTOR,
  ANTHROPIC_ADAPTER_DESCRIPTOR,
  GEMINI_ADAPTER_DESCRIPTOR,
  AZURE_OPENAI_ADAPTER_DESCRIPTOR,
  OPENROUTER_ADAPTER_DESCRIPTOR,
  AI_PROVIDER_ADAPTER_DESCRIPTORS,
  getAdapterDescriptor,
  isProviderInAdapterRegistry,
  getPlannedDescriptors,
  getAvailableDescriptors,
} from "./provider-descriptors";

// Phase C: Capability maps
export {
  OPENAI_CAPABILITY_MAP,
  ANTHROPIC_CAPABILITY_MAP,
  GEMINI_CAPABILITY_MAP,
  AZURE_OPENAI_CAPABILITY_MAP,
  OPENROUTER_CAPABILITY_MAP,
  PROVIDER_CAPABILITY_MAPS,
  getCapabilityDeclaration,
  getUnavailableCapabilities,
  getCapabilityGroupsForProvider,
} from "./capability-map";

// Phase D: Selection policy
export {
  DEFAULT_ADAPTER_SELECTION_POLICY,
  QUALITY_FIRST_SELECTION_POLICY,
  COST_OPTIMIZED_SELECTION_POLICY,
  ENTERPRISE_SELECTION_POLICY,
  filterDescriptorsByPolicy,
  rankDescriptorsByStrategy,
  resolveSelectionOrder,
  getSelectionPolicyLabel,
} from "./selection-policy";

// Phase F: AI Settings compatibility
export type {
  AIProviderAdapterSummaryForSettings,
  AIProviderCapabilityBadge,
  AIAdapterRegistrySummaryForSettings,
} from "./settings-compatibility";
export {
  getAdapterSummaryForSettings,
  getAdapterSummariesForSettings,
  getAdapterRegistrySummaryForSettings,
  getCapabilityBadgesForProvider,
  getUnsupportedCapabilitiesForSettings,
} from "./settings-compatibility";
