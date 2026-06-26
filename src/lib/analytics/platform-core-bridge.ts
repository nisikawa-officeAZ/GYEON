// GYEON Business Hub — Analytics & Reporting Center: Platform Core Bridge (Sprint 11Z)
//
// Exposes the Analytics & Reporting Center to Platform Core.
//
// Dependency direction:
//   analytics/platform-core-bridge → platform-core/ (one-way)
//   platform-core/ does NOT import from analytics/ (no circular dependency)
//   analytics/ does NOT import from growth/ (parallel modules, not layered)
//
// Provides Platform Core with:
//   - Per-application available metric groups
//   - Per-role accessible dashboards
//   - AI insight type catalog
//   - Module manifest and descriptor
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { PlatformApplicationId } from "@/lib/platform-core/platform-types";
import type {
  AnalyticsCenterDescriptor,
  AnalyticsMetricGroupId,
  AnalyticsDashboardId,
} from "./analytics-types";
import { ANALYTICS_METRIC_REGISTRY, getMetricGroupIds } from "./metric-registry";
import { ANALYTICS_DASHBOARD_REGISTRY } from "./dashboard-registry";
import { ANALYTICS_REPORT_REGISTRY } from "./report-registry";
import { ANALYTICS_INSIGHT_REGISTRY } from "./ai-insights";
import { ANALYTICS_POLICIES, getStrictAnalyticsPolicies } from "./analytics-policy";

// ─── Application → metric groups map ─────────────────────────────────────────
//
// Declares which metric groups are relevant to each platform application.
// Applications consume analytics through Platform Core only.

export const APPLICATION_METRIC_GROUP_MAP: Record<PlatformApplicationId, AnalyticsMetricGroupId[]> = {
  dealer_agent:            ["dealer_operations", "sales", "estimates", "work_orders", "maintenance", "communication", "reviews", "sns_marketing", "crm"],
  enterprise_distribution: ["distribution", "warehouse", "sales"],
  warehouse:               ["warehouse"],
  accounting:              ["accounting", "subscription_billing"],
  crm:                     ["crm", "communication", "reviews"],
  ai_operations:           ["ai_usage", "subscription_billing"],
};

// ─── Platform Core-compatible queries ────────────────────────────────────────

/** Returns metric groups relevant to a given platform application. */
export function getMetricGroupsForApplication(
  application_id: PlatformApplicationId,
): AnalyticsMetricGroupId[] {
  return APPLICATION_METRIC_GROUP_MAP[application_id];
}

/** Returns dashboards available to a given platform application. */
export function getDashboardsForPlatformApp(
  application_id: PlatformApplicationId,
): typeof ANALYTICS_DASHBOARD_REGISTRY {
  return ANALYTICS_DASHBOARD_REGISTRY.filter((d) =>
    d.required_applications.includes(application_id),
  );
}

/** Returns reports relevant to a given platform application. */
export function getReportsForPlatformApp(
  application_id: PlatformApplicationId,
) {
  return ANALYTICS_REPORT_REGISTRY.filter((r) =>
    r.required_applications.includes(application_id),
  );
}

// ─── Analytics module manifest ────────────────────────────────────────────────

export interface AnalyticsModuleManifest {
  module_id:                "analytics";
  display_name:             string;
  description:              string;
  status:                   "active";
  version:                  string;
  source_path:              string;
  metric_group_count:       number;
  total_metric_count:       number;
  dashboard_count:          number;
  report_count:             number;
  ai_insight_type_count:    number;
  policy_count:             number;
  consuming_applications:   PlatformApplicationId[];
  spec_document:            string;
  implementation_sprint:    string;
}

export const ANALYTICS_MODULE_MANIFEST: AnalyticsModuleManifest = {
  module_id:             "analytics",
  display_name:          "Analytics & Reporting Center",
  description:
    "Platform-level shared analytics and business intelligence layer for all GYEON Business Hub applications. " +
    "Declares 14 metric groups with 84 metrics, 8 dashboards, 10 report types, " +
    "6 AI insight types, and 8 governance policies. " +
    "No database queries. No calculations. No report generation. Foundation declarations only.",
  status:                "active",
  version:               "1.0.0",
  source_path:           "src/lib/analytics/",
  metric_group_count:    getMetricGroupIds().length,
  total_metric_count:    ANALYTICS_METRIC_REGISTRY.length,
  dashboard_count:       ANALYTICS_DASHBOARD_REGISTRY.length,
  report_count:          ANALYTICS_REPORT_REGISTRY.length,
  ai_insight_type_count: ANALYTICS_INSIGHT_REGISTRY.length,
  policy_count:          ANALYTICS_POLICIES.length,
  consuming_applications: [
    "dealer_agent",
    "enterprise_distribution",
    "warehouse",
    "accounting",
    "crm",
    "ai_operations",
  ],
  spec_document:         "docs/master_specification/ANALYTICS_CENTER_SPEC.md",
  implementation_sprint: "Sprint 11Z",
};

// ─── Policy summary ───────────────────────────────────────────────────────────

export interface AnalyticsPolicySummary {
  strict_count:                     number;
  advisory_count:                   number;
  policy_ids:                       string[];
  tenant_isolation_enforced:        boolean;
  financial_data_restricted:        boolean;
  staff_pii_excluded:               boolean;
  ai_minimum_data_enforced:         boolean;
}

export const ANALYTICS_POLICY_SUMMARY: AnalyticsPolicySummary = {
  strict_count:              getStrictAnalyticsPolicies().length,
  advisory_count:            ANALYTICS_POLICIES.length - getStrictAnalyticsPolicies().length,
  policy_ids:                ANALYTICS_POLICIES.map((p) => p.policy_id),
  tenant_isolation_enforced: true,
  financial_data_restricted: true,
  staff_pii_excluded:        true,
  ai_minimum_data_enforced:  true,
};

// ─── Analytics Center descriptor ─────────────────────────────────────────────

export const ANALYTICS_CENTER: AnalyticsCenterDescriptor = {
  version:                      "1.0.0",
  sprint:                       "Sprint 11Z",
  metric_group_count:           getMetricGroupIds().length,
  total_metric_count:           ANALYTICS_METRIC_REGISTRY.length,
  dashboard_count:              ANALYTICS_DASHBOARD_REGISTRY.length,
  report_count:                 ANALYTICS_REPORT_REGISTRY.length,
  ai_insight_type_count:        ANALYTICS_INSIGHT_REGISTRY.length,
  policy_count:                 ANALYTICS_POLICIES.length,
  platform_core_integrated:     true,
  persistence_required:         false,
  ai_execution_required:        false,
  target_implementation_sprint: "Sprint 12+",
};
