// AZ Platform — Platform Core: Platform Descriptor (Sprint 11T / updated Sprint 11W)
//
// The authoritative singleton descriptor for the AZ Platform Core.
// Consumed by admin diagnostics, status checks, and documentation generation.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { PlatformCoreDescriptor } from "./platform-types";
import { PLATFORM_APPLICATION_REGISTRY } from "./application-registry";
import { SHARED_SERVICES_REGISTRY, getAllCapabilities } from "./shared-services";
import { PLATFORM_CROSS_APP_POLICY } from "./platform-policy";

// ─── Platform Core descriptor ─────────────────────────────────────────────────

export const PLATFORM_CORE: PlatformCoreDescriptor = {
  version:                    "1.0.0",
  sprint:                     "Sprint 11W",
  application_count:          PLATFORM_APPLICATION_REGISTRY.length,                          // 5
  active_application_count:   PLATFORM_APPLICATION_REGISTRY.filter(
    (a) => a.status === "active",
  ).length,                                                                                    // 1
  planned_application_count:  PLATFORM_APPLICATION_REGISTRY.filter(
    (a) => a.status === "planned",
  ).length,                                                                                    // 4
  module_count:               SHARED_SERVICES_REGISTRY.length,                               // 10
  active_module_count:        SHARED_SERVICES_REGISTRY.filter(
    (m) => m.status === "active",
  ).length,                                                                                    // 3
  planned_module_count:       SHARED_SERVICES_REGISTRY.filter(
    (m) => m.status === "planned",
  ).length,                                                                                    // 7
  capability_count:           getAllCapabilities().length,
  isolation_rule_count:       PLATFORM_CROSS_APP_POLICY.rules.length,                        // 10
  cross_app_isolation:        true,
  shared_auth:                true,
  shared_ai_gateway:          true,
  platform_ui_available:      false,
  target_sprint:              "Sprint 12+",
};
