// DealerOS — AI Orchestration Engine: Built-in Provider Descriptors (Sprint 11N Phase B)
//
// Static descriptor objects for all 5 supported AI providers.
//
// Key invariants (non-negotiable):
//   - adapter_available: false on ALL descriptors in Sprint 11N
//   - adapter_status: "planned" on ALL descriptors in Sprint 11N
//   - No SDK imports here or in any file imported by this module
//   - No network calls, no adapter instantiation, no execution
//
// Capability maps (Phase C) are defined in capability-map.ts and imported here.
// This file assembles the complete AIProviderAdapterDescriptor objects.
//
// Reference: AI_PROVIDER_REGISTRY (src/lib/ai/provider-registry.ts) is the existing
// gateway-layer registry. This module provides the orchestration-layer descriptor
// registry — richer, with support_status per capability and selection metadata.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }               from "@/lib/ai/types";
import type { AIProviderAdapterDescriptor } from "./adapter-registry-types";
import {
  OPENAI_CAPABILITY_MAP,
  ANTHROPIC_CAPABILITY_MAP,
  GEMINI_CAPABILITY_MAP,
  AZURE_OPENAI_CAPABILITY_MAP,
  OPENROUTER_CAPABILITY_MAP,
}                                           from "./capability-map";

// ─── Descriptor: OpenAI ───────────────────────────────────────────────────────

export const OPENAI_ADAPTER_DESCRIPTOR: AIProviderAdapterDescriptor = {
  provider_id:             "openai",
  display_name:            "OpenAI",
  adapter_status:          "planned",
  adapter_available:       false,
  descriptor_version:      "1.0.0",
  planned_adapter_sprint:  "Sprint 11O+",
  supported_task_types: [
    "content_writing",
    "image_analysis",
    "review_request_generation",
    "review_writing_support",
    "review_response_drafting",
    "keyword_extraction",
    "reputation_analysis",
  ],
  capability_map:          OPENAI_CAPABILITY_MAP,
  default_models: {
    chat:             "gpt-4o",
    vision:           "gpt-4o",
    embeddings:       "text-embedding-3-small",
    image_generation: "dall-e-3",
  },
  estimated_cost_tier:  "standard",
  response_speed_tier:  "fast",
  quality_tier:         "better",
  selection_weight:     0.8,
  requires_endpoint:    false,
};

// ─── Descriptor: Anthropic Claude ─────────────────────────────────────────────

export const ANTHROPIC_ADAPTER_DESCRIPTOR: AIProviderAdapterDescriptor = {
  provider_id:             "anthropic",
  display_name:            "Anthropic Claude",
  adapter_status:          "planned",
  adapter_available:       false,
  descriptor_version:      "1.0.0",
  planned_adapter_sprint:  "Sprint 11O+",
  supported_task_types: [
    "content_writing",
    "image_analysis",
    "review_request_generation",
    "review_writing_support",
    "review_response_drafting",
    "keyword_extraction",
    "reputation_analysis",
  ],
  capability_map:          ANTHROPIC_CAPABILITY_MAP,
  default_models: {
    chat:    "claude-sonnet-4-6",
    vision:  "claude-sonnet-4-6",
    // No embeddings — Anthropic API does not have an embeddings endpoint
  },
  estimated_cost_tier:  "premium",
  response_speed_tier:  "standard",
  quality_tier:         "best",
  selection_weight:     0.9,
  requires_endpoint:    false,
};

// ─── Descriptor: Google Gemini ────────────────────────────────────────────────

export const GEMINI_ADAPTER_DESCRIPTOR: AIProviderAdapterDescriptor = {
  provider_id:             "gemini",
  display_name:            "Google Gemini",
  adapter_status:          "planned",
  adapter_available:       false,
  descriptor_version:      "1.0.0",
  planned_adapter_sprint:  "Sprint 11O+",
  supported_task_types: [
    "content_writing",
    "image_analysis",
    "review_request_generation",
    "review_writing_support",
    "review_response_drafting",
    "keyword_extraction",
    "reputation_analysis",
  ],
  capability_map:          GEMINI_CAPABILITY_MAP,
  default_models: {
    chat:             "gemini-1.5-pro",
    vision:           "gemini-1.5-pro",
    embeddings:       "text-embedding-004",
  },
  estimated_cost_tier:  "budget",
  response_speed_tier:  "fast",
  quality_tier:         "better",
  selection_weight:     0.75,
  requires_endpoint:    false,
};

// ─── Descriptor: Azure OpenAI ─────────────────────────────────────────────────

export const AZURE_OPENAI_ADAPTER_DESCRIPTOR: AIProviderAdapterDescriptor = {
  provider_id:             "azure_openai",
  display_name:            "Azure OpenAI",
  adapter_status:          "planned",
  adapter_available:       false,
  descriptor_version:      "1.0.0",
  planned_adapter_sprint:  "Sprint 11O+",
  supported_task_types: [
    "content_writing",
    "image_analysis",
    "review_request_generation",
    "review_writing_support",
    "review_response_drafting",
    "keyword_extraction",
    "reputation_analysis",
  ],
  capability_map:          AZURE_OPENAI_CAPABILITY_MAP,
  default_models: {
    chat:       "gpt-4o",
    vision:     "gpt-4o",
    embeddings: "text-embedding-3-small",
  },
  estimated_cost_tier:  "premium",
  response_speed_tier:  "fast",
  quality_tier:         "better",
  selection_weight:     0.7,
  requires_endpoint:    true,
};

// ─── Descriptor: OpenRouter ───────────────────────────────────────────────────

export const OPENROUTER_ADAPTER_DESCRIPTOR: AIProviderAdapterDescriptor = {
  provider_id:             "openrouter",
  display_name:            "OpenRouter",
  adapter_status:          "planned",
  adapter_available:       false,
  descriptor_version:      "1.0.0",
  planned_adapter_sprint:  "Sprint 11O+",
  supported_task_types: [
    "content_writing",
    "image_analysis",
    "review_request_generation",
    "review_writing_support",
    "review_response_drafting",
    "keyword_extraction",
    "reputation_analysis",
  ],
  capability_map:          OPENROUTER_CAPABILITY_MAP,
  default_models: {
    chat:             "anthropic/claude-sonnet-4-6",
    vision:           "openai/gpt-4o",
    image_generation: "openai/dall-e-3",
  },
  estimated_cost_tier:  "budget",
  response_speed_tier:  "fast",
  quality_tier:         "good",
  selection_weight:     0.65,
  requires_endpoint:    false,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * AI_PROVIDER_ADAPTER_DESCRIPTORS — all 5 provider descriptors.
 *
 * This array is the authoritative source for orchestration-layer adapter metadata.
 * It is distinct from AI_PROVIDER_REGISTRY (gateway-layer, src/lib/ai/provider-registry.ts).
 *
 * All descriptors have adapter_available: false in Sprint 11N.
 * Concrete adapters are planned for Sprint 11O+.
 */
export const AI_PROVIDER_ADAPTER_DESCRIPTORS: AIProviderAdapterDescriptor[] = [
  OPENAI_ADAPTER_DESCRIPTOR,
  ANTHROPIC_ADAPTER_DESCRIPTOR,
  GEMINI_ADAPTER_DESCRIPTOR,
  AZURE_OPENAI_ADAPTER_DESCRIPTOR,
  OPENROUTER_ADAPTER_DESCRIPTOR,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * getAdapterDescriptor — looks up a provider's descriptor by provider_id.
 *
 * Returns undefined if the provider is not in the registry.
 */
export function getAdapterDescriptor(
  provider_id: AIProviderId,
): AIProviderAdapterDescriptor | undefined {
  return AI_PROVIDER_ADAPTER_DESCRIPTORS.find((d) => d.provider_id === provider_id);
}

/**
 * isProviderInAdapterRegistry — true if the provider has a registered descriptor.
 */
export function isProviderInAdapterRegistry(provider_id: AIProviderId): boolean {
  return AI_PROVIDER_ADAPTER_DESCRIPTORS.some((d) => d.provider_id === provider_id);
}

/**
 * getPlannedDescriptors — returns all descriptors with adapter_status "planned".
 *
 * In Sprint 11N this is all 5 descriptors.
 */
export function getPlannedDescriptors(): AIProviderAdapterDescriptor[] {
  return AI_PROVIDER_ADAPTER_DESCRIPTORS.filter((d) => d.adapter_status === "planned");
}

/**
 * getAvailableDescriptors — returns descriptors with adapter_available: true.
 *
 * Returns an empty array in Sprint 11N — no adapters are implemented yet.
 */
export function getAvailableDescriptors(): AIProviderAdapterDescriptor[] {
  // In Sprint 11N: always empty (adapter_available is false for all descriptors)
  return AI_PROVIDER_ADAPTER_DESCRIPTORS.filter((d) => d.adapter_available);
}
