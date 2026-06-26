// DealerOS — AI Capability Marketplace: AI Settings Integration (Sprint 11S Phase E)
//
// Bridge types connecting the marketplace (AIMarketplaceCapability, AIMarketplaceProviderId)
// to the AI Settings Platform (AICapability, AIProviderId, AICapabilityAssignmentMap).
//
// The marketplace is a superset of the AI Settings layer:
//   AICapability (16)   ⊂  AIMarketplaceCapability (19)
//   AIProviderId (5)    ⊂  AIMarketplaceProviderId  (11)
//
// Future routing flow (Sprint 11T+):
//
//   AICapabilityMarketplace
//     ↓  dealer selects preferred provider per capability
//   AIMarketplaceCapabilityRouting
//     ↓  if gateway_eligible → convert to AICapabilityAssignment
//   AICapabilityAssignmentMap (AI Settings persistence)
//     ↓  provider resolution (4-level, src/lib/ai-settings/provider-resolution.ts)
//   resolved AIProviderId for execution
//
// Marketplace-only providers (runway, kling, etc.) cannot be stored in
// AICapabilityAssignmentMap until they are added to AIProviderId in a future sprint.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AICapability }          from "@/lib/ai/capabilities";
import type { AIProviderId }          from "@/lib/ai/types";
import type { AICapabilityAssignment } from "@/lib/ai-settings/capability-assignment";
import type {
  AIMarketplaceCapability,
  AIMarketplaceProviderId,
  AIRecommendationMode,
} from "./marketplace-types";

// ─── Execution policy ─────────────────────────────────────────────────────────

export type AICapabilityExecutionPolicy =
  | "auto"       // System selects best available gateway provider
  | "preferred"  // Use preferred_provider; fall back on failure
  | "strict"     // Use preferred_provider only; fail if unavailable
  | "disabled";  // This capability is disabled for the dealer

// ─── Marketplace capability routing ──────────────────────────────────────────

export interface AIMarketplaceCapabilityRouting {
  capability:          AIMarketplaceCapability;
  preferred_provider:  AIMarketplaceProviderId | null;
  fallback_provider:   AIMarketplaceProviderId | null;
  execution_policy:    AICapabilityExecutionPolicy;
  recommendation_mode: AIRecommendationMode;
  // Whether the preferred_provider is in the current AI Gateway (AIProviderId)
  gateway_eligible:    boolean;
  // Maps to an AICapability if this is a base capability; null for extensions
  base_capability:     AICapability | null;
}

export type AIMarketplaceRoutingMap = {
  [K in AIMarketplaceCapability]?: AIMarketplaceCapabilityRouting;
};

// ─── Gateway eligibility check ────────────────────────────────────────────────

// The 5 provider IDs currently in AIProviderId (src/lib/ai/types.ts).
// Used to determine if a marketplace provider selection can be persisted
// in AICapabilityAssignmentMap without a gateway extension sprint.
const GATEWAY_PROVIDER_IDS = new Set<string>([
  "openai",
  "anthropic",
  "gemini",
  "azure_openai",
  "openrouter",
]);

export function isGatewayEligible(
  provider_id: AIMarketplaceProviderId,
): provider_id is AIProviderId {
  return GATEWAY_PROVIDER_IDS.has(provider_id as string);
}

// The 16 base AICapability values from src/lib/ai/capabilities.ts.
// Extension capabilities (translation, voice_synthesis, voice_cloning) are absent here.
const BASE_CAPABILITY_VALUES = new Set<string>([
  "text_generation", "chat_completion", "function_calling", "embeddings",
  "vision", "ocr", "image_generation", "video_generation",
  "seo_analysis", "meo_analysis", "aeo_analysis", "llmo_analysis", "aio_analysis",
  "social_post", "analytics", "reporting",
]);

export function isBaseCapability(
  capability: AIMarketplaceCapability,
): capability is AICapability {
  return BASE_CAPABILITY_VALUES.has(capability as string);
}

// ─── Bridge: marketplace routing → gateway assignment ─────────────────────────

/**
 * toGatewayAssignment — converts one AIMarketplaceCapabilityRouting entry
 * to the AICapabilityAssignment format used by AICapabilityAssignmentMap.
 *
 * Returns null when:
 *   - capability is an extension (not in AICapability)
 *   - preferred_provider is marketplace-only (not in AIProviderId)
 *
 * Call this for each routing entry, then collect non-null results into an
 * AICapabilityAssignmentMap for persistence via saveAISettingsProfile().
 */
export function toGatewayAssignment(
  routing: AIMarketplaceCapabilityRouting,
): AICapabilityAssignment | null {
  if (!isBaseCapability(routing.capability)) {
    // Extension capability — no AICapabilityAssignment equivalent yet
    return null;
  }

  const preferredProvider: AIProviderId | null =
    routing.preferred_provider !== null && isGatewayEligible(routing.preferred_provider)
      ? routing.preferred_provider
      : null;

  const fallbackProvider: AIProviderId | null =
    routing.fallback_provider !== null && routing.fallback_provider !== undefined && isGatewayEligible(routing.fallback_provider)
      ? routing.fallback_provider
      : null;

  const status =
    routing.execution_policy === "disabled"
      ? "disabled"
      : preferredProvider !== null
        ? "preferred"
        : "fallback";

  return {
    capability:         routing.capability,
    status,
    preferred_provider: preferredProvider,
    fallback_provider:  fallbackProvider,
    notes:              `Marketplace routing: mode=${routing.recommendation_mode}, policy=${routing.execution_policy}`,
  };
}

// ─── Routing validation ───────────────────────────────────────────────────────

export interface AIMarketplaceRoutingValidation {
  valid:             boolean;
  gateway_routable:  AIMarketplaceCapability[];   // can go through current gateway
  marketplace_only:  AIMarketplaceCapability[];   // needs extension provider
  violations:        Array<{
    capability: AIMarketplaceCapability;
    reason:     string;
  }>;
}

export function validateMarketplaceRouting(
  routingMap: AIMarketplaceRoutingMap,
): AIMarketplaceRoutingValidation {
  const gatewayRoutable:  AIMarketplaceCapability[] = [];
  const marketplaceOnly:  AIMarketplaceCapability[] = [];
  const violations:       AIMarketplaceRoutingValidation["violations"] = [];

  for (const [cap, routing] of Object.entries(routingMap) as [AIMarketplaceCapability, AIMarketplaceCapabilityRouting][]) {
    if (!routing) continue;

    const preferredIsGateway =
      routing.preferred_provider === null || isGatewayEligible(routing.preferred_provider);

    if (!isBaseCapability(cap)) {
      marketplaceOnly.push(cap);
      if (routing.execution_policy === "strict" && routing.preferred_provider !== null && !isGatewayEligible(routing.preferred_provider)) {
        violations.push({
          capability: cap,
          reason:     `Strict policy with marketplace-only provider '${routing.preferred_provider}' — cannot execute until gateway integration sprint`,
        });
      }
    } else if (preferredIsGateway) {
      gatewayRoutable.push(cap);
    } else {
      marketplaceOnly.push(cap);
      if (routing.execution_policy === "strict") {
        violations.push({
          capability: cap,
          reason:     `Strict policy with marketplace-only provider '${routing.preferred_provider}' — add to AIProviderId first`,
        });
      }
    }
  }

  return {
    valid:            violations.length === 0,
    gateway_routable: gatewayRoutable,
    marketplace_only: marketplaceOnly,
    violations,
  };
}

// ─── Descriptor ───────────────────────────────────────────────────────────────

export interface AISettingsMarketplaceIntegration {
  version:                     string;
  sprint:                      string;
  gateway_capability_count:    number;   // 16 — current AICapability values
  extension_capability_count:  number;   // 3  — translation, voice_synthesis, voice_cloning
  gateway_provider_count:      number;   // 5  — current AIProviderId values
  extension_provider_count:    number;   // 6  — marketplace-only providers
  bridge_available:            boolean;  // toGatewayAssignment() is implemented
  marketplace_ui_available:    false;    // locked — UI not yet built
  target_sprint:               string;
}

export const AI_SETTINGS_MARKETPLACE_INTEGRATION: AISettingsMarketplaceIntegration = {
  version:                    "1.0.0",
  sprint:                     "Sprint 11S",
  gateway_capability_count:   16,
  extension_capability_count: 3,
  gateway_provider_count:     5,
  extension_provider_count:   6,
  bridge_available:           true,
  marketplace_ui_available:   false,
  target_sprint:              "Sprint 11T+",
};
