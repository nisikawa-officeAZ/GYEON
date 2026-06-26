// DealerOS — AI Orchestration Engine: AI Settings Compatibility (Sprint 11N Phase F)
//
// Bridges the adapter registry with the dealer-facing AI Settings UI.
//
// The existing AiSettingsView (src/lib/ai/ai-settings-types.ts) shows per-provider
// key status (has_key: boolean). This module provides richer adapter metadata that
// the Settings UI can use to display provider cards, capability badges, and adapter
// readiness status — without duplicating or replacing AiSettingsView.
//
// Usage (future Settings UI):
//   const summaries = getAdapterSummariesForSettings();
//   // Merge with AiSettingsView.providers for full provider display
//
// No UI implementation in Sprint 11N. This is a pure data layer.
// No API key data. No adapter execution. No network calls.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIProviderId }               from "@/lib/ai/types";
import type { AICapability }               from "@/lib/ai/capabilities";
import type {
  AIProviderAdapterStatus,
  AICapabilitySupportStatus,
}                                          from "./adapter-registry-types";
import {
  AI_PROVIDER_ADAPTER_DESCRIPTORS,
  getAdapterDescriptor,
}                                          from "./provider-descriptors";
import {
  getCapabilityGroupsForProvider,
  getUnavailableCapabilities,
}                                          from "./capability-map";

// ─── Settings-compatible view types ──────────────────────────────────────────

/**
 * AIProviderAdapterSummaryForSettings — enriched provider info for the Settings UI.
 *
 * Intended to be merged with AiSettingsView.providers (from ai-settings-types.ts)
 * to provide a complete provider display card in the dealer AI Gateway settings screen.
 */
export interface AIProviderAdapterSummaryForSettings {
  provider_id:            AIProviderId;
  /** English display name for the settings UI. */
  display_name:           string;
  adapter_status:         AIProviderAdapterStatus;
  /** Always false in Sprint 11N. Will be true when the Sprint 11O+ adapter is live. */
  adapter_available:      false;
  /** The sprint in which this provider's adapter is planned. */
  planned_sprint:         string;
  estimated_cost_tier:    "budget" | "standard" | "premium";
  response_speed_tier:    "fast" | "standard" | "slow";
  quality_tier:           "good" | "better" | "best";
  /** Routing group names (from CAPABILITY_GROUP_LABEL) for capabilities with status "planned". */
  planned_capability_groups: string[];
  /** Whether this provider requires a custom endpoint URL (Azure OpenAI only). */
  requires_endpoint:      boolean;
}

/**
 * AIProviderCapabilityBadge — a compact capability badge for the Settings UI.
 *
 * Used to show per-capability status in the provider card UI.
 */
export interface AIProviderCapabilityBadge {
  capability:     AICapability;
  group_label:    string;
  support_status: AICapabilitySupportStatus;
  /** Short English label for UI display. */
  display_label:  string;
}

/**
 * AIAdapterRegistrySummaryForSettings — a high-level registry summary for the
 * AI Settings page header or admin view.
 */
export interface AIAdapterRegistrySummaryForSettings {
  total_providers:     number;
  available_providers: number;   // Always 0 in Sprint 11N
  planned_providers:   number;   // Always 5 in Sprint 11N
  activation_sprint:   string;   // "Sprint 11O+"
  providers:           AIProviderAdapterSummaryForSettings[];
}

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * getAdapterSummaryForSettings — builds the settings summary for one provider.
 *
 * Returns null if the provider is not in the adapter registry.
 */
export function getAdapterSummaryForSettings(
  provider_id: AIProviderId,
): AIProviderAdapterSummaryForSettings | null {
  const descriptor = getAdapterDescriptor(provider_id);
  if (!descriptor) return null;

  return {
    provider_id:               descriptor.provider_id,
    display_name:              descriptor.display_name,
    adapter_status:            descriptor.adapter_status,
    adapter_available:         descriptor.adapter_available,
    planned_sprint:            descriptor.planned_adapter_sprint,
    estimated_cost_tier:       descriptor.estimated_cost_tier,
    response_speed_tier:       descriptor.response_speed_tier,
    quality_tier:              descriptor.quality_tier,
    planned_capability_groups: getCapabilityGroupsForProvider(provider_id),
    requires_endpoint:         descriptor.requires_endpoint,
  };
}

/**
 * getAdapterSummariesForSettings — builds settings summaries for all registered providers.
 *
 * Returns summaries in the order: openai, anthropic, gemini, azure_openai, openrouter.
 * Intended for rendering provider selection cards in the AI Gateway settings UI.
 */
export function getAdapterSummariesForSettings(): AIProviderAdapterSummaryForSettings[] {
  return AI_PROVIDER_ADAPTER_DESCRIPTORS
    .map((d) => getAdapterSummaryForSettings(d.provider_id))
    .filter((s): s is AIProviderAdapterSummaryForSettings => s !== null);
}

/**
 * getAdapterRegistrySummaryForSettings — builds the registry-level summary.
 *
 * Used for the settings page header or an admin overview panel.
 */
export function getAdapterRegistrySummaryForSettings(): AIAdapterRegistrySummaryForSettings {
  const providers = getAdapterSummariesForSettings();
  return {
    total_providers:     providers.length,
    available_providers: providers.filter((p) => p.adapter_available).length,
    planned_providers:   providers.filter((p) => p.adapter_status === "planned").length,
    activation_sprint:   "Sprint 11O+",
    providers,
  };
}

/**
 * getCapabilityBadgesForProvider — returns badge data for all capabilities of a provider.
 *
 * Suitable for rendering a capability badge list in the provider settings card.
 * Ordered: planned first, then supported_later, then requires_review, then unavailable.
 */
export function getCapabilityBadgesForProvider(
  provider_id: AIProviderId,
): AIProviderCapabilityBadge[] {
  const descriptor = getAdapterDescriptor(provider_id);
  if (!descriptor) return [];

  const GROUP_LABEL: Record<AICapability, string> = {
    text_generation:  "Chat",
    chat_completion:  "Chat",
    function_calling: "Tools",
    embeddings:       "Embeddings",
    vision:           "Vision",
    ocr:              "OCR",
    image_generation: "Image Gen",
    video_generation: "Video Gen",
    seo_analysis:     "SEO",
    meo_analysis:     "MEO",
    aeo_analysis:     "AEO",
    llmo_analysis:    "LLMO",
    aio_analysis:     "AIO",
    social_post:      "Social",
    analytics:        "Analytics",
    reporting:        "Reports",
  };

  const STATUS_ORDER: AICapabilitySupportStatus[] = [
    "planned",
    "supported_later",
    "requires_review",
    "unavailable",
  ];

  const entries = Object.entries(descriptor.capability_map) as [AICapability, { support_status: AICapabilitySupportStatus }][];

  const badges: AIProviderCapabilityBadge[] = entries.map(([cap, decl]) => ({
    capability:     cap,
    group_label:    GROUP_LABEL[cap] ?? cap,
    support_status: decl.support_status,
    display_label:  GROUP_LABEL[cap] ?? cap,
  }));

  badges.sort((a, b) =>
    STATUS_ORDER.indexOf(a.support_status) - STATUS_ORDER.indexOf(b.support_status),
  );

  return badges;
}

/**
 * getUnsupportedCapabilitiesForSettings — returns capabilities that are "unavailable"
 * for the given provider, formatted for the settings UI.
 *
 * Used to display a warning when a dealer's workflow requires a capability their
 * provider does not support.
 */
export function getUnsupportedCapabilitiesForSettings(
  provider_id:    AIProviderId,
  required_caps:  AICapability[],
): AICapability[] {
  return getUnavailableCapabilities(provider_id, required_caps);
}
