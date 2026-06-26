// DealerOS — Platform Core: Package Barrel (Sprint 11T)
//
// Public API for src/lib/platform-core/.
// Import from here, not from sub-modules, to maintain a stable package surface.

// ── Core domain types ────────────────────────────────────────────────────────
export type {
  PlatformApplicationId,
  PlatformModuleId,
  PlatformCapabilityStatus,
  PlatformApplicationStatus,
  PolicyEnforcement,
  PlatformDependencyType,
  PlatformCapability,
  PlatformModuleDependency,
  ModuleManifest,
  PlatformFeature,
  PlatformApplication,
  PlatformIsolationRule,
  CrossApplicationPolicy,
  FeatureDiscoveryQuery,
  FeatureDiscoveryResult,
  PlatformCoreDescriptor,
} from "./platform-types";

// ── Application Registry ─────────────────────────────────────────────────────
export {
  PLATFORM_APPLICATION_REGISTRY,
  getApplicationDescriptor,
  getActiveApplications,
  getPlannedApplications,
  getApplicationsForModule,
  getRequiredModules,
  getOptionalModules,
  getAllModulesForApplication,
} from "./application-registry";

// ── Shared Services Registry ─────────────────────────────────────────────────
export {
  SHARED_SERVICES_REGISTRY,
  getModuleManifest,
  getActiveModules,
  getPlannedModules,
  isModuleAvailable,
  getAllCapabilities,
  getCapabilitiesForModule,
} from "./shared-services";

// ── Cross-Application Policy ─────────────────────────────────────────────────
export {
  PLATFORM_CROSS_APP_POLICY,
  getIsolationRule,
  getStrictRules,
  getAdvisoryRules,
  getRulesForApplication,
  isModuleAlwaysShared,
  isApplicationIsolated,
} from "./platform-policy";

// ── Feature Discovery ─────────────────────────────────────────────────────────
export {
  discoverFeatures,
  getAvailableModules,
  getActiveCapabilitiesForApplication,
  getPlannedCapabilitiesForApplication,
  getFeaturesForApplication,
  isCapabilityAvailable,
  getApplicationModuleSummary,
  getPlatformFeatures,
  getPlatformFeature,
} from "./feature-discovery";

// ── Platform Descriptor ───────────────────────────────────────────────────────
export { PLATFORM_CORE } from "./platform-descriptor";
