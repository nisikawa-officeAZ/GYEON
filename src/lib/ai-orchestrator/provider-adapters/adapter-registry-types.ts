// DealerOS — AI Orchestration Engine: Adapter Registry Domain Types (Sprint 11N Phase A)
//
// Domain types for the AI Provider Adapter Registry.
//
// Architecture:
//   AIProviderAdapterRegistry holds AIProviderAdapterDescriptor[] for all 5 providers.
//   Each descriptor carries a AIProviderAdapterCapabilityMap with per-capability declarations.
//   The registry is consumed by the provider execution readiness guard (Phase E).
//
// Key invariant (non-negotiable):
//   adapter_available is ALWAYS false for all descriptors in Sprint 11N.
//   Concrete adapter implementations are Sprint 11O+ work.
//   The registry is purely declarative — it does not instantiate, execute, or call providers.
//
// Security rules:
//   - No API key fields in any registry type
//   - dealer_id always comes from getCurrentDealer() in the calling server action
//   - No provider SDK imports anywhere in the provider-adapters module
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }   from "@/lib/ai/types";
import type { AITaskType }     from "@/lib/ai/types";
import type { AICapability }   from "@/lib/ai/capabilities";

// ─── Adapter status ───────────────────────────────────────────────────────────

/**
 * AIProviderAdapterStatus — lifecycle status of an adapter in the registry.
 */
export type AIProviderAdapterStatus =
  | "available"     // adapter_available: true; fully implemented and tested (Sprint 11O+)
  | "planned"       // Descriptor exists; adapter not yet implemented (Sprint 11N default)
  | "deprecated"    // Being phased out; do not use for new workflows
  | "unavailable";  // Provider not supported on this platform

// ─── Capability support status ────────────────────────────────────────────────

/**
 * AICapabilitySupportStatus — how well the provider supports a specific capability.
 *
 * Used in AIProviderAdapterCapabilityMap to document each capability's support status
 * at the ADAPTER layer (not just the model layer).
 */
export type AICapabilitySupportStatus =
  | "planned"          // Provider API supports it; adapter will implement in Sprint 11O+
  | "supported_later"  // Provider has limited/experimental support; no firm sprint commitment
  | "unavailable"      // Provider's API does not support this capability — cannot be implemented
  | "requires_review"; // Exists at the model layer but needs compliance/legal/policy review

// ─── Per-capability declaration ───────────────────────────────────────────────

/**
 * AIProviderCapabilityDeclaration — declaration of one provider capability.
 */
export interface AIProviderCapabilityDeclaration {
  capability:       AICapability;
  support_status:   AICapabilitySupportStatus;
  /** Known model identifiers that support this capability for this provider. */
  supported_models: string[];
  /** Notes about implementation constraints, limitations, or review requirements. */
  notes:            string;
}

// ─── Capability map ───────────────────────────────────────────────────────────

/**
 * AIProviderAdapterCapabilityMap — maps each AICapability to its declaration for a provider.
 *
 * Capabilities absent from the map are treated as "unavailable".
 */
export type AIProviderAdapterCapabilityMap = {
  [K in AICapability]?: AIProviderCapabilityDeclaration;
};

// ─── Default models ───────────────────────────────────────────────────────────

/**
 * AIProviderAdapterDefaultModels — recommended models per routing group.
 *
 * Used when the dealer has not configured task-specific routing.
 */
export interface AIProviderAdapterDefaultModels {
  chat?:             string;
  vision?:           string;
  embeddings?:       string;
  image_generation?: string;
  video_generation?: string;
}

// ─── Adapter descriptor ───────────────────────────────────────────────────────

/**
 * AIProviderAdapterDescriptor — full descriptor for one provider adapter.
 *
 * Descriptors are static declarations — they do not instantiate any adapter,
 * make network calls, or import any provider SDK.
 *
 * adapter_available is ALWAYS false in Sprint 11N. Set to true only when the
 * concrete adapter class (Sprint 11O+) is fully implemented and passes integration tests.
 */
export interface AIProviderAdapterDescriptor {
  provider_id:          AIProviderId;
  /** English display name for UI rendering. */
  display_name:         string;
  adapter_status:       AIProviderAdapterStatus;
  /**
   * Always false in Sprint 11N — prevents any code path from treating the
   * descriptor as a live, executable adapter.
   */
  adapter_available:    false;
  /** Semantic version of this descriptor. Increments when capability map or models change. */
  descriptor_version:   string;
  /**
   * Sprint in which the concrete adapter is planned.
   * "Sprint 11O+" means the next sprint after 11N.
   */
  planned_adapter_sprint: string;
  supported_task_types: AITaskType[];
  capability_map:       AIProviderAdapterCapabilityMap;
  default_models:       AIProviderAdapterDefaultModels;
  /** Relative cost compared to other providers. Informational only — not a billing guarantee. */
  estimated_cost_tier:  "budget" | "standard" | "premium";
  /** Relative response latency. Informational only. */
  response_speed_tier:  "fast" | "standard" | "slow";
  /** Subjective output quality rating for text tasks. Informational only. */
  quality_tier:         "good" | "better" | "best";
  /** 0.0–1.0 weight used by selection policies (higher = preferred when other factors are equal). */
  selection_weight:     number;
  /** Whether the dealer must provide a custom endpoint URL (true for Azure OpenAI only). */
  requires_endpoint:    boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * AIProviderAdapterRegistry — immutable registry of all provider descriptors.
 */
export interface AIProviderAdapterRegistry {
  version:     string;
  descriptors: AIProviderAdapterDescriptor[];
  /** Total number of registered provider descriptors. */
  total:       number;
  /**
   * Number of descriptors where adapter_available is true.
   * Always 0 in Sprint 11N — all adapters are planned.
   */
  available:   number;
}

// ─── Registry inspection ──────────────────────────────────────────────────────

/**
 * AIAdapterRegistryDecision — result of inspecting the registry for a given provider.
 *
 * Used by the execution guard (Sprint 11N Phase E) to produce specific denial reasons.
 */
export type AIAdapterRegistryDecision =
  | "adapter_available"       // adapter_available: true — execution is possible
  | "needs_adapter"           // Descriptor exists; adapter not yet implemented (adapter_available: false)
  | "provider_unknown"        // Provider ID not found in the descriptor registry
  | "capability_unavailable"; // One or more required capabilities have support_status: "unavailable"

/**
 * AIAdapterRegistryInspection — result of inspecting the registry.
 *
 * Returned by inspectAdapterRegistry() and embedded in the execution guard result.
 */
export interface AIAdapterRegistryInspection {
  provider_id:       AIProviderId | null;
  decision:          AIAdapterRegistryDecision;
  descriptor_found:  boolean;
  adapter_available: boolean;
  /** Required capabilities that have support_status "unavailable" for this provider. */
  unavailable_caps:  AICapability[];
  /** English explanation. */
  message:           string;
}

// ─── Adapter selection policy ─────────────────────────────────────────────────

/**
 * AIAdapterSelectionStrategy — supported strategies for selecting a provider adapter.
 *
 * No runtime selection execution in Sprint 11N — strategy is declared for future use.
 */
export type AIAdapterSelectionStrategy =
  | "dealer_default"         // Use the dealer's primary configured provider
  | "lowest_estimated_cost"  // Pick the cheapest descriptor by estimated_cost_tier
  | "best_quality"           // Pick the highest quality_tier descriptor
  | "fastest_response"       // Pick the lowest latency (response_speed_tier: "fast") descriptor
  | "capability_required"    // Filter by required AICapability, then apply dealer_default
  | "fallback_provider";     // Try primary provider first, then fallback_providers in order

/**
 * AIProviderAdapterSelectionPolicy — policy governing which adapter is chosen.
 *
 * Not executed in Sprint 11N. Applied in Sprint 11O+ when multiple adapters are available.
 */
export interface AIProviderAdapterSelectionPolicy {
  strategy:             AIAdapterSelectionStrategy;
  /** The dealer's primary provider — used by dealer_default and fallback_provider strategies. */
  preferred_provider:   AIProviderId | null;
  /** Providers to try in order after preferred_provider fails (fallback_provider strategy only). */
  fallback_providers:   AIProviderId[];
  /** Filter: only consider providers supporting all of these capabilities. */
  capability_filter:    AICapability[];
  /** Filter: only consider providers at or below this cost tier. */
  max_cost_tier:        "budget" | "standard" | "premium" | null;
  /** Filter: only consider providers at or above this quality tier. */
  min_quality_tier:     "good" | "better" | "best" | null;
}

// ─── Adapter validation result ────────────────────────────────────────────────

/**
 * AIProviderAdapterValidationResult — result of validating a provider descriptor.
 *
 * Used by registry integrity checks at startup time.
 */
export interface AIProviderAdapterValidationResult {
  provider_id:      AIProviderId;
  valid:            boolean;
  checks_passed:    string[];
  checks_failed:    string[];
  validation_notes: string;
}
