// DealerOS — AI Growth Platform: Public API (Sprint 11H)
//
// Single barrel export for the entire AI Growth Platform.
// Import from "@/lib/growth" for all growth domain types and helpers.

// Phase A: Core domain types
export type {
  GrowthDimension,
  GrowthTimeframe,
  GrowthMetricId,
  GrowthMetric,
  GrowthTrend,
  GrowthTrendDirection,
  GrowthDataPoint,
  GrowthScore,
  GrowthInsight,
  GrowthInsightSeverity,
  GrowthOpportunity,
  GrowthOpportunityCategory,
  GrowthRecommendationCategory,
  GrowthRecommendation,
  GrowthReport,
  GrowthReportType,
  GrowthDashboard,
  GrowthDashboardType,
} from "./growth-types";

// Phase B: Data source registry
export type {
  GrowthDataSourceId,
  GrowthDataSourceDescriptor,
} from "./data-source-registry";
export {
  DATA_SOURCE_REGISTRY,
  getDataSourceDescriptor,
  getSourcesForKPI,
  getSourcesForDimension,
  getAvailableSources,
} from "./data-source-registry";

// Phase C: KPI model
export type { GrowthKPIDefinition } from "./kpi-model";
export {
  KPI_REGISTRY,
  getKPIDefinition,
  getKPIsByDimension,
  getKPIsForDashboard,
  getAIRequiredKPIs,
  buildBlankMetric,
} from "./kpi-model";

// Phase D: Recommendation model
export type { GrowthRecommendationTemplate } from "./recommendation-model";
export {
  RECOMMENDATION_TEMPLATE_REGISTRY,
  buildRecommendationShell,
  getRecommendationTemplate,
  getAIRequiredCategories,
} from "./recommendation-model";

// Phase E: Dashboard compatibility
export type {
  GrowthDashboardDescriptor,
  GrowthDashboardDataRequirement,
} from "./dashboard-compat";
export {
  DASHBOARD_REGISTRY,
  buildEmptyDashboard,
  getDashboardDescriptor,
  getAIDashboardTypes,
  getDashboardTypesForAudience,
  getDashboardDataRequirement,
} from "./dashboard-compat";

// Phase F: AI integration
export type {
  GrowthAITaskConfig,
  GrowthAgentCrossFeed,
  GrowthAIContext,
  GrowthAIExecutionPlan,
  GrowthAIWorkflowSpec,
} from "./growth-ai";
export {
  GROWTH_AI_WORKFLOW_REGISTRY,
  buildGrowthAIExecutionPlan,
  buildMarketingAgentFeed,
  buildReputationAgentFeed,
  getGrowthAIWorkflowSpec,
} from "./growth-ai";
