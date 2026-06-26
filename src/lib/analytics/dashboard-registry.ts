// GYEON Business Hub — Analytics & Reporting Center: Dashboard Registry (Sprint 11Z)
//
// Eight dashboard definitions for the Analytics & Reporting Center.
// Metadata and routing only — no UI implementation, no data fetching.
//
// Dashboards are scoped by visibility (who can see them) and require specific
// platform applications to be active to surface their metrics.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AnalyticsDashboardDescriptor,
  AnalyticsDashboardId,
} from "./analytics-types";

// ─── Dashboard definitions ────────────────────────────────────────────────────

const EXECUTIVE_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "executive",
  display_name:    "Executive Dashboard",
  description:
    "Platform-level view across all applications and all dealer tenants. " +
    "Provides company-wide and platform-wide performance aggregates for " +
    "platform admins and company executives.",
  metric_groups: [
    "sales", "dealer_operations", "subscription_billing",
    "distribution", "accounting", "ai_usage",
  ],
  primary_audience:      ["platform_admin", "company_admin"],
  visibility_scope:      "platform",
  required_applications: ["dealer_agent"],
  default_timeframe:     "month_to_date",
  supports_ai_insights:  true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const DEALER_OWNER_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "dealer_owner",
  display_name:    "Dealer Owner Dashboard",
  description:
    "Complete business performance view for a single dealer. Covers revenue, " +
    "operations, communication, customer reviews, marketing, and AI usage. " +
    "The primary analytics entry point for dealer owners and branch managers.",
  metric_groups: [
    "sales", "dealer_operations", "estimates", "work_orders",
    "maintenance", "communication", "reviews", "sns_marketing", "ai_usage",
  ],
  primary_audience:      ["dealer_owner", "branch_manager"],
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  default_timeframe:     "last_30_days",
  supports_ai_insights:  true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const STAFF_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "staff",
  display_name:    "Staff Dashboard",
  description:
    "Operational view for front-line staff. Shows current workload, queue status, " +
    "pending estimates, and communication activity. Financial and revenue data " +
    "is excluded per privacy policy (ANL-002).",
  metric_groups: ["dealer_operations", "work_orders", "estimates", "communication"],
  primary_audience:      ["dealer_staff", "dealer_owner"],
  visibility_scope:      "staff",
  required_applications: ["dealer_agent"],
  default_timeframe:     "last_7_days",
  supports_ai_insights:  false,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const DISTRIBUTION_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "distribution",
  display_name:    "GYEON Distribution Dashboard",
  description:
    "B2B distribution performance for company admins and division managers. " +
    "Covers order pipeline, distributor performance, product sell-through, and " +
    "warehouse stock levels supporting distribution operations.",
  metric_groups: ["distribution", "warehouse"],
  primary_audience:      ["company_admin", "division_manager"],
  visibility_scope:      "company",
  required_applications: ["enterprise_distribution", "warehouse"],
  default_timeframe:     "last_30_days",
  supports_ai_insights:  true,
  status:                "planned",
  target_sprint:         "Sprint 13+",
};

const WAREHOUSE_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "warehouse",
  display_name:    "Warehouse Dashboard",
  description:
    "Inventory and stock operations view for warehouse managers and branch staff. " +
    "Displays current stock levels, low-stock alerts, turnover rates, and " +
    "pending reorder triggers.",
  metric_groups: ["warehouse"],
  primary_audience:      ["warehouse_manager", "company_admin"],
  visibility_scope:      "branch",
  required_applications: ["warehouse"],
  default_timeframe:     "last_7_days",
  supports_ai_insights:  false,
  status:                "planned",
  target_sprint:         "Sprint 13+",
};

const ACCOUNTING_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "accounting",
  display_name:    "Accounting Dashboard",
  description:
    "Financial performance view for company admins and accounting staff. " +
    "Shows accounts receivable, DSO, overdue invoices, payment collection rate, " +
    "and monthly cash flow. Subscription billing metrics included.",
  metric_groups: ["accounting", "subscription_billing"],
  primary_audience:      ["company_admin", "platform_admin"],
  visibility_scope:      "company",
  required_applications: ["accounting"],
  default_timeframe:     "month_to_date",
  supports_ai_insights:  true,
  status:                "planned",
  target_sprint:         "Sprint 13+",
};

const AI_OPERATIONS_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "ai_operations",
  display_name:    "AI Operations Dashboard",
  description:
    "AI usage and efficiency metrics for platform admins and company admins. " +
    "Shows AI request volume, token consumption, estimated costs for " +
    "dealer-owned provider accounts, capability breakdown, and staff " +
    "AI acceptance rates.",
  metric_groups: ["ai_usage"],
  primary_audience:      ["platform_admin", "company_admin", "dealer_owner"],
  visibility_scope:      "dealer",
  required_applications: ["ai_operations"],
  default_timeframe:     "last_30_days",
  supports_ai_insights:  false,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const SUBSCRIPTION_DASHBOARD: AnalyticsDashboardDescriptor = {
  dashboard_id:    "subscription",
  display_name:    "Subscription Dashboard",
  description:
    "Platform-level subscription health metrics for platform admins. " +
    "Covers MRR across all tenants, plan distribution, upgrade events, " +
    "trial conversion rates, and feature activation rates by plan tier.",
  metric_groups: ["subscription_billing"],
  primary_audience:      ["platform_admin"],
  visibility_scope:      "platform",
  required_applications: ["dealer_agent"],
  default_timeframe:     "month_to_date",
  supports_ai_insights:  true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ANALYTICS_DASHBOARD_REGISTRY: AnalyticsDashboardDescriptor[] = [
  EXECUTIVE_DASHBOARD,
  DEALER_OWNER_DASHBOARD,
  STAFF_DASHBOARD,
  DISTRIBUTION_DASHBOARD,
  WAREHOUSE_DASHBOARD,
  ACCOUNTING_DASHBOARD,
  AI_OPERATIONS_DASHBOARD,
  SUBSCRIPTION_DASHBOARD,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getDashboard(
  dashboard_id: AnalyticsDashboardId,
): AnalyticsDashboardDescriptor | undefined {
  return ANALYTICS_DASHBOARD_REGISTRY.find((d) => d.dashboard_id === dashboard_id);
}

export function getDashboardsForRole(
  role_id: string,
): AnalyticsDashboardDescriptor[] {
  return ANALYTICS_DASHBOARD_REGISTRY.filter((d) =>
    d.primary_audience.includes(role_id),
  );
}

export function getDashboardsForApplication(
  application_id: string,
): AnalyticsDashboardDescriptor[] {
  return ANALYTICS_DASHBOARD_REGISTRY.filter((d) =>
    d.required_applications.includes(application_id),
  );
}

export function getDashboardsWithAIInsights(): AnalyticsDashboardDescriptor[] {
  return ANALYTICS_DASHBOARD_REGISTRY.filter((d) => d.supports_ai_insights);
}

export function getDashboardsByScope(
  scope: import("./analytics-types").AnalyticsVisibilityScope,
): AnalyticsDashboardDescriptor[] {
  return ANALYTICS_DASHBOARD_REGISTRY.filter((d) => d.visibility_scope === scope);
}
