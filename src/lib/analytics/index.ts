// GYEON Business Hub — Analytics & Reporting Center: Package Barrel (Sprint 11Z)
//
// Public API for src/lib/analytics/.
// Import from here, not from sub-modules, to maintain a stable package surface.

// ── Domain types ──────────────────────────────────────────────────────────────
export type {
  AnalyticsMetricGroupId,
  AnalyticsMetricValueType,
  AnalyticsTimeframe,
  AnalyticsTrendDirection,
  AnalyticsVisibilityScope,
  AnalyticsInsightType,
  AnalyticsInsightSeverity,
  AnalyticsDashboardId,
  AnalyticsReportId,
  AnalyticsMetricDescriptor,
  AnalyticsDashboardDescriptor,
  AnalyticsReportDescriptor,
  AnalyticsInsightDescriptor,
  AnalyticsPolicyEnforcement,
  AnalyticsPolicy,
  AnalyticsCenterDescriptor,
} from "./analytics-types";

// ── Metric registry ───────────────────────────────────────────────────────────
export {
  ANALYTICS_METRIC_REGISTRY,
  getMetric,
  getMetricsByGroup,
  getMetricsByApplication,
  getMetricsByVisibility,
  getAIRequiredMetrics,
  getActiveMetrics,
  getMetricGroupIds,
} from "./metric-registry";

// ── Dashboard registry ────────────────────────────────────────────────────────
export {
  ANALYTICS_DASHBOARD_REGISTRY,
  getDashboard,
  getDashboardsForRole,
  getDashboardsForApplication,
  getDashboardsWithAIInsights,
  getDashboardsByScope,
} from "./dashboard-registry";

// ── Report registry ───────────────────────────────────────────────────────────
export {
  ANALYTICS_REPORT_REGISTRY,
  getReport,
  getReportsForApplication,
  getAISummaryReports,
  getReportsByFrequency,
  getReportsByScope,
} from "./report-registry";

// ── AI insights ───────────────────────────────────────────────────────────────
export {
  ANALYTICS_INSIGHT_REGISTRY,
  getInsightDescriptor,
  getInsightTypesForMetricGroup,
  getInsightTypesForSeverity,
  getMinimumDataPointRequirement,
} from "./ai-insights";

// ── Analytics policy ──────────────────────────────────────────────────────────
export {
  ANALYTICS_POLICIES,
  getAnalyticsPolicy,
  getStrictAnalyticsPolicies,
  getAdvisoryAnalyticsPolicies,
  getPoliciesForScope,
  getUniversalAnalyticsPolicies,
} from "./analytics-policy";

// ── Platform Core bridge ──────────────────────────────────────────────────────
export type {
  AnalyticsModuleManifest,
  AnalyticsPolicySummary,
} from "./platform-core-bridge";

export {
  APPLICATION_METRIC_GROUP_MAP,
  ANALYTICS_MODULE_MANIFEST,
  ANALYTICS_POLICY_SUMMARY,
  ANALYTICS_CENTER,
  getMetricGroupsForApplication,
  getDashboardsForPlatformApp,
  getReportsForPlatformApp,
} from "./platform-core-bridge";
