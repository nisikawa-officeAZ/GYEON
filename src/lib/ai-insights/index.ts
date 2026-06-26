// GYEON Business Hub — AI Insights Module: Package Barrel (Sprint 12B)
//
// Public API for the AI Insights domain.
//
// Dependency order (no circular imports):
//   ai-insights → analytics, subscription, staff, dashboard
//   Never import from ai-insights in those modules.

// Core types
export type {
  AIInsightTypeId,
  AIInsightSeverity,
  AIInsightSource,
  AIInsightDataStatus,
  AIInsightStatus,
  AIInsightAction,
  AIInsightRecommendation,
  AIInsight,
  AIInsightPanelInput,
  DealerStaffRole,
  AIEntitlementId,
} from "./ai-insight-types";

// Policies
export {
  AI_INSIGHT_POLICIES,
  getAIInsightPolicy,
  getStrictAIInsightPolicies,
  getAdvisoryAIInsightPolicies,
} from "./insight-policy";
export type { AIInsightPolicy, AIInsightPolicyEnforcement } from "./insight-policy";

// Insight type registry
export {
  AI_INSIGHT_TYPE_REGISTRY,
  getInsightTypeDescriptor,
  getInsightTypesForRole,
  getInsightTypeRequiredEntitlement,
  getDeterministicInsightTypes,
} from "./insight-registry";
export type { AIInsightTypeDescriptor } from "./insight-registry";

// Deterministic builders
export {
  buildDeterministicInsights,
} from "./deterministic-insights";
export type { DashboardInsightInput } from "./deterministic-insights";

// Subscription gating
export {
  INSIGHT_ENTITLEMENT_MAP,
  INSIGHT_ENTITLEMENT_SUMMARY,
  getRequiredEntitlementForInsight,
  getMinimumPlanForInsightType,
  planCanGenerateInsight,
} from "./subscription-gate";
