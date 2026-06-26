// AZ Platform — Business Application Registry: Platform Core Bridge (Sprint 11W Phase F)
//
// Integration layer: exposes Business Application Registry data in Platform Core-compatible shapes.
//
// Dependency direction:
//   business-applications/platform-core-bridge → platform-core/ (one-way)
//   platform-core/ does NOT import from business-applications/ (no circular dependency)
//
// Consumer code that needs both platform-core and business-application data
// imports from @/lib/business-applications directly.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { PlatformApplicationId } from "@/lib/platform-core/platform-types";
import type {
  BusinessApplicationId,
  BusinessApplicationManifest,
  BusinessApplicationRegistryDescriptor,
  SharedServiceId,
} from "./business-application-types";
import {
  BUSINESS_APPLICATION_REGISTRY,
  getActiveBusinessApplications,
  getPlannedBusinessApplications,
  getApplicationsRequiringService,
  getApplicationsUsingService,
} from "./business-application-registry";
import { BUSINESS_APPLICATION_POLICIES } from "./application-isolation-policy";
import { discoverCapabilities } from "./application-capabilities";

// ─── Platform Core-aligned query helpers ─────────────────────────────────────

export function getAllBusinessApplicationIds(): BusinessApplicationId[] {
  return BUSINESS_APPLICATION_REGISTRY.map((a) => a.application_id);
}

/** Maps from PlatformApplicationId to its BusinessApplicationManifest. */
export function getBusinessApplicationByPlatformId(
  platform_id: PlatformApplicationId,
): BusinessApplicationManifest | undefined {
  return BUSINESS_APPLICATION_REGISTRY.find(
    (a) => a.platform_application_ref === platform_id,
  );
}

export function listApplicationsByStatus(): {
  active:  BusinessApplicationManifest[];
  planned: BusinessApplicationManifest[];
} {
  return {
    active:  getActiveBusinessApplications(),
    planned: getPlannedBusinessApplications(),
  };
}

// ─── Capability summary (for Platform Core descriptor) ───────────────────────

export function getBusinessCapabilitySummary(): {
  total:     number;
  available: number;
  planned:   number;
  future:    number;
} {
  const result = discoverCapabilities({});
  return {
    total:     result.total_capability_count,
    available: result.available_count,
    planned:   result.planned_count,
    future:    result.future_count,
  };
}

// ─── Shared service dependency summary ───────────────────────────────────────

export function getSharedServiceDependencies(service: SharedServiceId): {
  required_by:  BusinessApplicationId[];
  optional_for: BusinessApplicationId[];
} {
  return {
    required_by: getApplicationsRequiringService(service).map((a) => a.application_id),
    optional_for: getApplicationsUsingService(service)
      .filter((a) => !a.required_shared_services.includes(service))
      .map((a) => a.application_id),
  };
}

// ─── Isolation policy summary (for Platform Core consumption) ─────────────────

export function getBusinessAppIsolationSummary(): {
  total_policies: number;
  strict_count:   number;
  advisory_count: number;
  policy_ids:     string[];
} {
  return {
    total_policies: BUSINESS_APPLICATION_POLICIES.length,
    strict_count:   BUSINESS_APPLICATION_POLICIES.filter((p) => p.enforcement === "strict").length,
    advisory_count: BUSINESS_APPLICATION_POLICIES.filter((p) => p.enforcement === "advisory").length,
    policy_ids:     BUSINESS_APPLICATION_POLICIES.map((p) => p.policy_id),
  };
}

// ─── Registry descriptor ─────────────────────────────────────────────────────

export const BUSINESS_APPLICATION_REGISTRY_DESCRIPTOR: BusinessApplicationRegistryDescriptor = {
  version:                    "1.0.0",
  sprint:                     "Sprint 11W",
  application_count:          BUSINESS_APPLICATION_REGISTRY.length,
  active_application_count:   getActiveBusinessApplications().length,
  planned_application_count:  getPlannedBusinessApplications().length,
  total_capability_count:     BUSINESS_APPLICATION_REGISTRY.flatMap((a) => a.capabilities).length,
  available_capability_count: BUSINESS_APPLICATION_REGISTRY.flatMap((a) => a.capabilities)
    .filter((c) => c.status === "available").length,
  policy_count:               BUSINESS_APPLICATION_POLICIES.length,
  strict_policy_count:        BUSINESS_APPLICATION_POLICIES.filter((p) => p.enforcement === "strict").length,
  platform_core_integrated:   true,
  organization_integrated:    true,
  persistence_required:       false,
  target_sprint:              "Sprint 12+",
};
