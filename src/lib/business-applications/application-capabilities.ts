// AZ Platform — Business Application Registry: Capability Discovery (Sprint 11W Phase D)
//
// Capability discovery API for the Business Application Registry.
// Provides query functions to determine which applications support which
// capabilities, and what shared services each application depends on.
//
// No runtime execution. Metadata queries only.
// This is a design-time / initialization-time discovery layer.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  BusinessApplicationId,
  BusinessApplicationManifest,
  BusinessCapabilityStatus,
  CapabilityDiscoveryQuery,
  CapabilityDiscoveryResult,
  SharedServiceId,
} from "./business-application-types";
import {
  BUSINESS_APPLICATION_REGISTRY,
  getBusinessApplication,
  getApplicationsRequiringService,
  getApplicationsUsingService,
} from "./business-application-registry";

// ─── Per-application capability queries ──────────────────────────────────────

export function getCapabilitiesForApplication(
  application_id: BusinessApplicationId,
): BusinessApplicationManifest["capabilities"] {
  return getBusinessApplication(application_id)?.capabilities ?? [];
}

export function getCapabilitiesByStatus(
  application_id: BusinessApplicationId,
  status: BusinessCapabilityStatus,
): BusinessApplicationManifest["capabilities"] {
  return getCapabilitiesForApplication(application_id).filter(
    (c) => c.status === status,
  );
}

export function getAvailableCapabilities(
  application_id: BusinessApplicationId,
): BusinessApplicationManifest["capabilities"] {
  return getCapabilitiesByStatus(application_id, "available");
}

export function getPlannedCapabilities(
  application_id: BusinessApplicationId,
): BusinessApplicationManifest["capabilities"] {
  return getCapabilitiesByStatus(application_id, "planned");
}

// ─── Shared service dependency queries ────────────────────────────────────────

export function getRequiredServicesForApplication(
  application_id: BusinessApplicationId,
): SharedServiceId[] {
  return getBusinessApplication(application_id)?.required_shared_services ?? [];
}

export function getOptionalServicesForApplication(
  application_id: BusinessApplicationId,
): SharedServiceId[] {
  return getBusinessApplication(application_id)?.optional_shared_services ?? [];
}

export function getAllServicesForApplication(
  application_id: BusinessApplicationId,
): SharedServiceId[] {
  const app = getBusinessApplication(application_id);
  if (!app) return [];
  return [...app.required_shared_services, ...app.optional_shared_services];
}

// ─── Activation requirement queries ──────────────────────────────────────────

export function getRequiredSubscriptionLevel(
  application_id: BusinessApplicationId,
): string | null {
  return getBusinessApplication(application_id)?.required_subscription_level ?? null;
}

export function getRequiredFeatureFlags(
  application_id: BusinessApplicationId,
): string[] {
  return getBusinessApplication(application_id)?.required_feature_flags ?? [];
}

// ─── Cross-application shared service usage map ───────────────────────────────

const ALL_SHARED_SERVICES: SharedServiceId[] = [
  "authentication",
  "authorization",
  "ai_gateway",
  "ai_marketplace",
  "ocr",
  "line",
  "media",
  "notification",
  "pdf",
  "analytics",
  "organization",
];

export function getSharedServiceUsageSummary(): Record<
  SharedServiceId,
  { required_by: BusinessApplicationId[]; optional_for: BusinessApplicationId[] }
> {
  return ALL_SHARED_SERVICES.reduce(
    (acc, service) => {
      const required = getApplicationsRequiringService(service).map(
        (a) => a.application_id,
      );
      const optional = getApplicationsUsingService(service)
        .filter((a) => !a.required_shared_services.includes(service))
        .map((a) => a.application_id);

      acc[service] = { required_by: required, optional_for: optional };
      return acc;
    },
    {} as Record<
      SharedServiceId,
      { required_by: BusinessApplicationId[]; optional_for: BusinessApplicationId[] }
    >,
  );
}

// ─── Capability discovery query ───────────────────────────────────────────────

export function discoverCapabilities(
  query: CapabilityDiscoveryQuery,
): CapabilityDiscoveryResult {
  let applications = [...BUSINESS_APPLICATION_REGISTRY];

  if (query.application_id) {
    applications = applications.filter(
      (a) => a.application_id === query.application_id,
    );
  }

  if (query.shared_service) {
    const service = query.shared_service;
    applications = applications.filter(
      (a) =>
        a.required_shared_services.includes(service) ||
        a.optional_shared_services.includes(service),
    );
  }

  const allCapabilities = applications.flatMap((a) => a.capabilities);
  const filtered = query.status
    ? allCapabilities.filter((c) => c.status === query.status)
    : allCapabilities;

  return {
    query,
    applications,
    total_capability_count: filtered.length,
    available_count:        filtered.filter((c) => c.status === "available").length,
    planned_count:          filtered.filter((c) => c.status === "planned").length,
    future_count:           filtered.filter((c) => c.status === "future").length,
  };
}
