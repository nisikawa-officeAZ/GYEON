// DealerOS — AI Capability Marketplace: Package Barrel (Sprint 11S)
//
// Public API for src/lib/ai-marketplace/.
//
// Import from here, not from sub-modules, to maintain a stable package surface.

// ── Core domain types ────────────────────────────────────────────────────────
export type {
  AICapabilityCategory,
  AIMarketplaceCapabilityExtension,
  AIMarketplaceCapability,
  AIMarketplaceProviderExtension,
  AIMarketplaceProviderId,
  AIMarketplaceProviderStatus,
  AICapabilitySupportLevel,
  AIRecommendationMode,
  AIProviderBenchmark,
  AIProviderCapabilityEntry,
  AIProviderProfile,
  AIProviderRecommendation,
  AICapabilityMarketplace,
} from "./marketplace-types";

// ── Capability catalog ────────────────────────────────────────────────────────
export type {
  AICapabilityMetadata,
  AICapabilityCategoryMetadata,
} from "./capability-catalog";

export {
  CAPABILITY_CATALOG,
  CATEGORY_CATALOG,
  getCapabilityMetadata,
  getCapabilitiesByCategory,
  getCategoryMetadata,
  getAllMarketplaceCapabilities,
  getBaseCapabilities,
  getExtensionCapabilities,
  getCapabilitiesForPlan,
} from "./capability-catalog";

// ── Provider profiles ─────────────────────────────────────────────────────────
export {
  AI_MARKETPLACE_PROVIDER_PROFILES,
  getProviderProfile,
  getGatewayProviderProfiles,
  getExtensionProviderProfiles,
  getProvidersForCapability,
  getSpecialistProviders,
  isGatewayProvider,
} from "./provider-profiles";

// ── Recommendation engine ─────────────────────────────────────────────────────
export {
  PROVIDER_BENCHMARKS,
  PROVIDER_RECOMMENDATIONS,
  getBenchmark,
  getRecommendation,
  getRecommendationsForCapability,
  computeBalancedScore,
  rankProvidersByMode,
} from "./recommendation-engine";

// ── AI Settings integration ───────────────────────────────────────────────────
export type {
  AICapabilityExecutionPolicy,
  AIMarketplaceCapabilityRouting,
  AIMarketplaceRoutingMap,
  AIMarketplaceRoutingValidation,
  AISettingsMarketplaceIntegration,
} from "./settings-integration";

export {
  isGatewayEligible,
  isBaseCapability,
  toGatewayAssignment,
  validateMarketplaceRouting,
  AI_SETTINGS_MARKETPLACE_INTEGRATION,
} from "./settings-integration";

// ── Marketplace descriptor ────────────────────────────────────────────────────
export { AI_CAPABILITY_MARKETPLACE } from "./marketplace-descriptor";
