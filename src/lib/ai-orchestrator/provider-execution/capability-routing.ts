// DealerOS — AI Orchestration Engine: Capability Routing (Sprint 11M Phase C)
//
// Maps agent and task capabilities to provider-level AICapability requirements.
//
// Routing groups (from sprint spec):
//   chat, vision, ocr, image_generation, video_generation, embeddings,
//   seo, meo, aeo, llmo, aio, analytics, social_post, reporting
//
// The agent registry (src/lib/ai/agents/registry.ts) is the authoritative source
// for per-agent requiredProviderCaps. This module provides task-level routing
// and lookup utilities for the execution guard and step bridge.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }    from "@/lib/ai/agents/types";
import type { AITaskType }   from "@/lib/ai/types";
import type { AIProviderId } from "@/lib/ai/types";
import type { AICapability } from "@/lib/ai/capabilities";
import { getAgentEntry }     from "@/lib/ai/agents/registry";
import { getProviderEntry }  from "@/lib/ai/provider-registry";

// ─── Task type → required provider capabilities ───────────────────────────────

/**
 * TASK_TO_PROVIDER_CAPS — maps each AITaskType to the provider-level AICapability
 * values needed to execute it.
 *
 * Used by the execution guard (check #8) to verify that the configured provider
 * supports the capabilities a given task step requires.
 */
export const TASK_TO_PROVIDER_CAPS: Record<AITaskType, AICapability[]> = {
  content_writing:           ["text_generation", "chat_completion"],
  image_analysis:            ["vision", "ocr"],
  video_generation:          ["video_generation"],
  review_request_generation: ["text_generation", "chat_completion"],
  review_writing_support:    ["text_generation", "chat_completion"],
  review_response_drafting:  ["text_generation", "chat_completion"],
  keyword_extraction:        ["text_generation", "seo_analysis"],
  reputation_analysis:       ["text_generation", "analytics"],
};

// ─── Capability group labels ──────────────────────────────────────────────────

/**
 * CAPABILITY_GROUP_LABEL — maps each AICapability to the routing group name
 * used in the sprint spec and documentation.
 *
 * Groups: chat | vision | ocr | image_generation | video_generation |
 *         embeddings | seo | meo | aeo | llmo | aio | analytics |
 *         social_post | reporting
 */
export const CAPABILITY_GROUP_LABEL: Record<AICapability, string> = {
  text_generation:  "chat",
  chat_completion:  "chat",
  function_calling: "chat",
  embeddings:       "embeddings",
  vision:           "vision",
  ocr:              "ocr",
  image_generation: "image_generation",
  video_generation: "video_generation",
  seo_analysis:     "seo",
  meo_analysis:     "meo",
  aeo_analysis:     "aeo",
  llmo_analysis:    "llmo",
  aio_analysis:     "aio",
  social_post:      "social_post",
  analytics:        "analytics",
  reporting:        "reporting",
};

// ─── Routing helpers ──────────────────────────────────────────────────────────

/**
 * getRequiredCapsForAgent — returns the provider-level capabilities required
 * by the given agent, from AI_AGENT_REGISTRY.requiredProviderCaps.
 *
 * Returns an empty array if the agent is not found in the registry.
 */
export function getRequiredCapsForAgent(agent_id: AIAgentId): AICapability[] {
  const entry = getAgentEntry(agent_id);
  return entry?.requiredProviderCaps ?? [];
}

/**
 * getRequiredCapsForTask — returns the provider-level capabilities required
 * to execute the given task type.
 */
export function getRequiredCapsForTask(task_type: AITaskType): AICapability[] {
  return TASK_TO_PROVIDER_CAPS[task_type] ?? [];
}

/**
 * resolveRequiredCaps — merges agent-level and task-level capability requirements.
 *
 * Returns a deduplicated array. This is the definitive list of provider capabilities
 * that must be present before the step can execute.
 */
export function resolveRequiredCaps(
  agent_id:  AIAgentId,
  task_type: AITaskType,
): AICapability[] {
  const agent_caps = getRequiredCapsForAgent(agent_id);
  const task_caps  = getRequiredCapsForTask(task_type);
  const seen       = new Set<AICapability>(agent_caps);
  for (const cap of task_caps) {
    seen.add(cap);
  }
  return Array.from(seen);
}

/**
 * isCapabilitySupportedByProvider — checks whether the given provider supports
 * a specific AICapability, using AI_PROVIDER_REGISTRY.
 *
 * Returns false if the provider is not found in the registry.
 */
export function isCapabilitySupportedByProvider(
  provider_id: AIProviderId,
  capability:  AICapability,
): boolean {
  const entry = getProviderEntry(provider_id);
  if (!entry) return false;
  return entry.capabilities.includes(capability);
}

/**
 * getMissingCapabilities — returns which of the required capabilities the given
 * provider does NOT support.
 *
 * An empty array means the provider can satisfy all requirements.
 * A non-empty array indicates unsupported capabilities — execution is blocked.
 */
export function getMissingCapabilities(
  provider_id:    AIProviderId,
  required_caps:  AICapability[],
): AICapability[] {
  return required_caps.filter(
    (cap) => !isCapabilitySupportedByProvider(provider_id, cap),
  );
}

/**
 * getCapabilityGroups — returns the routing group labels for a list of capabilities.
 * Deduplicates the result.
 */
export function getCapabilityGroups(caps: AICapability[]): string[] {
  const seen = new Set<string>();
  for (const cap of caps) {
    const label = CAPABILITY_GROUP_LABEL[cap];
    if (label) seen.add(label);
  }
  return Array.from(seen);
}
