// DealerOS — AI Capability Marketplace: Marketplace Descriptor (Sprint 11S)
//
// The authoritative static descriptor for the AI Capability Marketplace subsystem.
// Consumed by feature gates, settings UI pre-flight checks, and diagnostics.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AICapabilityMarketplace } from "./marketplace-types";
import { CAPABILITY_CATALOG, CATEGORY_CATALOG } from "./capability-catalog";
import { AI_MARKETPLACE_PROVIDER_PROFILES }     from "./provider-profiles";

// ─── Marketplace descriptor ───────────────────────────────────────────────────

export const AI_CAPABILITY_MARKETPLACE: AICapabilityMarketplace = {
  version:                    "1.0.0",
  sprint:                     "Sprint 11S",
  capability_count:           CAPABILITY_CATALOG.length,                      // 19
  provider_count:             AI_MARKETPLACE_PROVIDER_PROFILES.length,         // 11
  gateway_provider_count:     AI_MARKETPLACE_PROVIDER_PROFILES.filter(
    (p) => p.gateway_provider_id !== null,
  ).length,                                                                    // 5
  extension_provider_count:   AI_MARKETPLACE_PROVIDER_PROFILES.filter(
    (p) => p.marketplace_status === "marketplace_only",
  ).length,                                                                    // 6
  category_count:             CATEGORY_CATALOG.length,                         // 14
  marketplace_ui_available:   false,
  settings_integration_ready: true,
  target_sprint:              "Sprint 11T+",
};
