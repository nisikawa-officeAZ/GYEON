// AZ Platform — Business Application Registry: Package Barrel (Sprint 11W)
//
// Public API for src/lib/business-applications/.
// Import from here, not from sub-modules, to maintain a stable package surface.

// ── Domain types ──────────────────────────────────────────────────────────────
export type {
  BusinessApplicationId,
  BusinessApplicationType,
  BusinessApplicationStatus,
  BusinessCapabilityStatus,
  BusinessApplicationCapability,
  SharedServiceId,
  BusinessApplicationManifest,
  BusinessApplicationPolicy,
  AppPolicyEnforcement,
  CapabilityDiscoveryQuery,
  CapabilityDiscoveryResult,
  ApplicationOrgScope,
  BusinessApplicationRegistryDescriptor,
} from "./business-application-types";

// ── Application registry ──────────────────────────────────────────────────────
export {
  BUSINESS_APPLICATION_REGISTRY,
  getBusinessApplication,
  getActiveBusinessApplications,
  getPlannedBusinessApplications,
  getApplicationsByType,
  getApplicationsRequiringService,
  getApplicationsUsingService,
} from "./business-application-registry";

// ── Capability discovery ──────────────────────────────────────────────────────
export {
  getCapabilitiesForApplication,
  getCapabilitiesByStatus,
  getAvailableCapabilities,
  getPlannedCapabilities,
  getRequiredServicesForApplication,
  getOptionalServicesForApplication,
  getAllServicesForApplication,
  getRequiredSubscriptionLevel,
  getRequiredFeatureFlags,
  getSharedServiceUsageSummary,
  discoverCapabilities,
} from "./application-capabilities";

// ── Isolation policy ──────────────────────────────────────────────────────────
export {
  BUSINESS_APPLICATION_POLICIES,
  ISOLATED_BUSINESS_APPLICATIONS,
  getAppPolicy,
  getStrictAppPolicies,
  getAdvisoryAppPolicies,
  getPoliciesForApp,
  getPoliciesApplyingToAll,
  isApplicationIsolated,
} from "./application-isolation-policy";

// ── Organization integration ──────────────────────────────────────────────────
export {
  APPLICATION_ORG_SCOPE_REGISTRY,
  getOrgScopeForApplication,
  getApplicationsForOrgType,
  getApplicationsForOrgTier,
  getApplicationsForRole,
  getAdminApplicationsForRole,
  getSupportedOrgTypesForApp,
  getSupportedOrgTiersForApp,
} from "./organization-integration";

// ── Platform Core bridge ──────────────────────────────────────────────────────
export {
  BUSINESS_APPLICATION_REGISTRY_DESCRIPTOR,
  getAllBusinessApplicationIds,
  getBusinessApplicationByPlatformId,
  listApplicationsByStatus,
  getBusinessCapabilitySummary,
  getSharedServiceDependencies,
  getBusinessAppIsolationSummary,
} from "./platform-core-bridge";
