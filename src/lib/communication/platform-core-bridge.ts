// GYEON Business Hub — Communication Center: Platform Core Bridge (Sprint 11X Phase F)
//
// Integration layer: exposes Communication Center data in Platform Core-compatible shapes.
//
// Dependency direction:
//   communication/platform-core-bridge → platform-core/ (one-way)
//   platform-core/ does NOT import from communication/ (no circular dependency)
//
// Applications must consume communication services through Platform Core only (APP-002).
// This bridge provides the Platform Core view of what communication channels and
// capabilities are available per application.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { PlatformApplicationId } from "@/lib/platform-core/platform-types";
import type {
  CommunicationCenterDescriptor,
  CommunicationChannelId,
} from "./communication-types";
import { COMMUNICATION_CHANNEL_REGISTRY, getActiveChannels, getPlannedChannels } from "./channel-registry";
import { COMMUNICATION_PROVIDER_REGISTRY, COMMUNICATION_CAPABILITIES } from "./communication-provider";
import { AI_COMMUNICATION_CAPABILITIES } from "./ai-communication";
import { COMMUNICATION_POLICIES, getStrictCommPolicies } from "./communication-policy";
import { UNIFIED_INBOX_CONFIG } from "./unified-inbox";

// ─── Application → channel availability map ───────────────────────────────────
//
// Declares which channels are relevant to each platform application.
// Derived from channel_registry's available_in arrays.

export const APPLICATION_CHANNEL_MAP: Record<PlatformApplicationId, CommunicationChannelId[]> = {
  dealer_agent:            ["line", "instagram", "facebook_messenger", "x", "email", "sms"],
  enterprise_distribution: ["line", "whatsapp", "email", "sms"],
  warehouse:               ["email"],
  accounting:              ["email"],
  crm:                     ["whatsapp", "instagram", "facebook_messenger", "email"],
  ai_operations:           ["email"],
};

// ─── Query helpers ─────────────────────────────────────────────────────────────

export function getChannelsForPlatformApp(
  application_id: PlatformApplicationId,
): CommunicationChannelId[] {
  return APPLICATION_CHANNEL_MAP[application_id];
}

export function getApplicationsForChannel(
  channel_id: CommunicationChannelId,
): PlatformApplicationId[] {
  return (Object.entries(APPLICATION_CHANNEL_MAP) as [PlatformApplicationId, CommunicationChannelId[]][])
    .filter(([, channels]) => channels.includes(channel_id))
    .map(([app]) => app);
}

// ─── Communication module manifest ────────────────────────────────────────────
//
// Describes the Communication Center as if it were a platform module —
// allows Platform Core documentation and tooling to reference it consistently.
// The Communication Center is a foundation module, not a SHARED_SERVICES_REGISTRY entry.

export interface CommunicationModuleManifest {
  module_id:           "communication";
  display_name:        string;
  description:         string;
  status:              "active";
  version:             string;
  source_path:         string;
  channel_count:       number;
  active_channel_count: number;
  provider_count:      number;
  capability_count:    number;
  ai_capability_count: number;
  policy_count:        number;
  consuming_applications: PlatformApplicationId[];
  spec_document:       string;
  implementation_sprint: string;
}

export const COMMUNICATION_MODULE_MANIFEST: CommunicationModuleManifest = {
  module_id:            "communication",
  display_name:         "Communication Center",
  description:          "Unified communication abstraction for GYEON Business Hub. Declares all supported channels (LINE, WhatsApp, Instagram, Facebook Messenger, X, Email, SMS), provider metadata, customer consent model, AI communication capabilities, and governance policies. Applications consume communication services through Platform Core only.",
  status:               "active",
  version:              "1.0.0",
  source_path:          "src/lib/communication/",
  channel_count:        COMMUNICATION_CHANNEL_REGISTRY.length,
  active_channel_count: getActiveChannels().length,
  provider_count:       COMMUNICATION_PROVIDER_REGISTRY.length,
  capability_count:     COMMUNICATION_CAPABILITIES.length,
  ai_capability_count:  AI_COMMUNICATION_CAPABILITIES.length,
  policy_count:         COMMUNICATION_POLICIES.length,
  consuming_applications: ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  spec_document:        "docs/master_specification/COMMUNICATION_CENTER_SPEC.md",
  implementation_sprint: "Sprint 11X",
};

// ─── Policy summary ───────────────────────────────────────────────────────────

export interface CommPolicySummary {
  strict_count:                 number;
  advisory_count:               number;
  policy_ids:                   string[];
  consent_required_enforced:    boolean;
  opt_out_immediate_enforced:   boolean;
  ai_consent_enforced:          boolean;
}

export const COMMUNICATION_POLICY_SUMMARY: CommPolicySummary = {
  strict_count:              getStrictCommPolicies().length,
  advisory_count:            COMMUNICATION_POLICIES.length - getStrictCommPolicies().length,
  policy_ids:                COMMUNICATION_POLICIES.map((p) => p.policy_id),
  consent_required_enforced: true,
  opt_out_immediate_enforced: true,
  ai_consent_enforced:       true,
};

// ─── Communication Center descriptor ─────────────────────────────────────────

export const COMMUNICATION_CENTER: CommunicationCenterDescriptor = {
  version:                        "1.0.0",
  sprint:                         "Sprint 11X",
  registered_channel_count:       COMMUNICATION_CHANNEL_REGISTRY.length,
  active_channel_count:           getActiveChannels().length,
  planned_channel_count:          getPlannedChannels().length,
  registered_provider_count:      COMMUNICATION_PROVIDER_REGISTRY.length,
  communication_capability_count: COMMUNICATION_CAPABILITIES.length,
  ai_capability_count:            AI_COMMUNICATION_CAPABILITIES.length,
  policy_count:                   COMMUNICATION_POLICIES.length,
  strict_policy_count:            getStrictCommPolicies().length,
  platform_core_integrated:       true,
  persistence_required:           false,
  unified_inbox_status:           "planned",
  target_sprint:                  UNIFIED_INBOX_CONFIG.target_sprint,
};
