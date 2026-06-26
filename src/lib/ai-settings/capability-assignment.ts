// DealerOS — AI Settings Platform: Capability Assignment (Sprint 11O Phase C)
//
// Models per-capability provider assignment for dealers.
// Each of the 16 AICapability values can be assigned a preferred provider,
// an optional fallback provider, or disabled entirely.
//
// Unassigned capabilities inherit the primary_provider from AIProviderSelectionConfig.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AICapability } from "@/lib/ai/capabilities";
import type { AIProviderId } from "@/lib/ai/types";

// ─── Assignment status ────────────────────────────────────────────────────────

export type AICapabilityAssignmentStatus =
  | "preferred"  // Dealer explicitly assigned a preferred provider for this capability
  | "fallback"   // Assigned as fallback only; prefers a different provider for this cap
  | "disabled";  // Dealer has explicitly disabled this capability

// ─── Assignment record ────────────────────────────────────────────────────────

export interface AICapabilityAssignment {
  capability:          AICapability;
  status:              AICapabilityAssignmentStatus;
  preferred_provider:  AIProviderId | null;
  fallback_provider:   AIProviderId | null;
  /** English note for diagnostic and display purposes. */
  notes:               string;
}

// ─── Assignment map ───────────────────────────────────────────────────────────

export type AICapabilityAssignmentMap = {
  [K in AICapability]?: AICapabilityAssignment;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * DEFAULT_CAPABILITY_ASSIGNMENTS — empty map.
 *
 * Before a dealer configures capability routing, all capabilities inherit
 * the primary_provider from AIProviderSelectionConfig.
 */
export const DEFAULT_CAPABILITY_ASSIGNMENTS: AICapabilityAssignmentMap = {};

// ─── Factories ────────────────────────────────────────────────────────────────

/**
 * buildDefaultCapabilityAssignments — pre-assigns core text capabilities
 * to the given primary provider.
 *
 * Specialized capabilities (image_generation, video_generation, embeddings, etc.)
 * are left unassigned to inherit from primary_provider.
 */
export function buildDefaultCapabilityAssignments(
  primary_provider: AIProviderId | null,
): AICapabilityAssignmentMap {
  if (!primary_provider) return {};

  const text_caps: AICapability[] = [
    "text_generation",
    "chat_completion",
    "function_calling",
    "social_post",
    "analytics",
    "reporting",
  ];

  const result: AICapabilityAssignmentMap = {};
  for (const cap of text_caps) {
    result[cap] = {
      capability:         cap,
      status:             "preferred",
      preferred_provider: primary_provider,
      fallback_provider:  null,
      notes:              `Default assignment to primary provider ${primary_provider}`,
    };
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getAssignmentForCapability(
  map:        AICapabilityAssignmentMap,
  capability: AICapability,
): AICapabilityAssignment | null {
  return map[capability] ?? null;
}

/**
 * isCapabilityEnabled — returns true unless the capability is explicitly disabled.
 *
 * Unassigned capabilities are considered enabled (they inherit primary_provider).
 */
export function isCapabilityEnabled(
  map:        AICapabilityAssignmentMap,
  capability: AICapability,
): boolean {
  const assignment = map[capability];
  if (!assignment) return true;
  return assignment.status !== "disabled";
}

export function getEnabledCapabilities(
  map: AICapabilityAssignmentMap,
): AICapability[] {
  return (Object.keys(map) as AICapability[]).filter(
    (cap) => isCapabilityEnabled(map, cap),
  );
}

export function getDisabledCapabilities(
  map: AICapabilityAssignmentMap,
): AICapability[] {
  return (Object.keys(map) as AICapability[]).filter(
    (cap) => map[cap]?.status === "disabled",
  );
}
