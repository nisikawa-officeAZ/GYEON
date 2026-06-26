// GYEON Business Hub — Analytics & Reporting Center: Report Registry (Sprint 11Z)
//
// Ten report definitions for the Analytics & Reporting Center.
// No report generation. No data fetching. Metadata declarations only.
//
// Reports are structured outputs (table, chart, or mixed) generated on demand
// or on a schedule. All reports are "planned" — implementation is Sprint 12+.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AnalyticsReportDescriptor,
  AnalyticsReportId,
} from "./analytics-types";

// ─── Report definitions ───────────────────────────────────────────────────────

const MONTHLY_SALES_REPORT: AnalyticsReportDescriptor = {
  report_id:    "monthly_sales",
  display_name: "Monthly Sales Report",
  description:
    "Comprehensive summary of monthly revenue, work order volume, average order value, " +
    "top services by revenue, and period-over-period growth rate. " +
    "Generated monthly or on demand by dealer owners.",
  metric_groups:         ["sales", "work_orders", "estimates"],
  format:                "mixed",
  frequency:             "monthly",
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  supports_ai_summary:   true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const DEALER_PERFORMANCE_REPORT: AnalyticsReportDescriptor = {
  report_id:    "dealer_performance",
  display_name: "Dealer Performance Report",
  description:
    "Holistic performance assessment across operations, sales, communication, " +
    "and reviews. Includes key KPIs vs. previous period and AI growth score. " +
    "Platform admins can run this across multiple tenants.",
  metric_groups: ["dealer_operations", "sales", "communication", "reviews"],
  format:                "mixed",
  frequency:             "monthly",
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  supports_ai_summary:   true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const MAINTENANCE_CONVERSION_REPORT: AnalyticsReportDescriptor = {
  report_id:    "maintenance_conversion",
  display_name: "Maintenance Conversion Report",
  description:
    "Analysis of maintenance reminder campaigns: reminders sent, conversion rate, " +
    "revenue attributed, coating type breakdown, and customers remaining overdue. " +
    "Helps identify which reminder strategies drive the most bookings.",
  metric_groups: ["maintenance", "communication", "sales"],
  format:                "mixed",
  frequency:             "monthly",
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  supports_ai_summary:   true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const REVIEW_CONVERSION_REPORT: AnalyticsReportDescriptor = {
  report_id:    "review_conversion",
  display_name: "Review Conversion Report",
  description:
    "Review request campaign performance: requests sent, review conversion rate, " +
    "new reviews received, average rating trend, and response rate. " +
    "Compliance note: must conform to COMM-007 (no selective targeting).",
  metric_groups: ["reviews", "communication"],
  format:                "mixed",
  frequency:             "monthly",
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  supports_ai_summary:   true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const COMMUNICATION_RESPONSE_REPORT: AnalyticsReportDescriptor = {
  report_id:    "communication_response",
  display_name: "Communication Response Report",
  description:
    "Customer communication activity analysis: channel volume, response rates, " +
    "average response time by channel, opt-out events, and top communication " +
    "times. Helps teams optimize message timing and channel mix.",
  metric_groups: ["communication"],
  format:                "table",
  frequency:             "weekly",
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  supports_ai_summary:   false,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const AI_USAGE_REPORT: AnalyticsReportDescriptor = {
  report_id:    "ai_usage",
  display_name: "AI Usage Report",
  description:
    "AI platform usage breakdown: request volume by capability, token consumption, " +
    "estimated costs (for dealer-owned provider configurations), staff acceptance rates, " +
    "and time-saved estimates. Supports budget management for Enterprise AI tier.",
  metric_groups: ["ai_usage"],
  format:                "mixed",
  frequency:             "monthly",
  visibility_scope:      "dealer",
  required_applications: ["ai_operations"],
  supports_ai_summary:   false,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

const DISTRIBUTION_SALES_REPORT: AnalyticsReportDescriptor = {
  report_id:    "distribution_sales",
  display_name: "Distribution Sales Report",
  description:
    "B2B distribution performance: orders received and fulfilled, average order " +
    "value, top distributors by volume, product sell-through rates, and " +
    "backorder analysis. Company-level visibility only.",
  metric_groups: ["distribution", "sales"],
  format:                "mixed",
  frequency:             "monthly",
  visibility_scope:      "company",
  required_applications: ["enterprise_distribution"],
  supports_ai_summary:   true,
  status:                "planned",
  target_sprint:         "Sprint 13+",
};

const INVENTORY_MOVEMENT_REPORT: AnalyticsReportDescriptor = {
  report_id:    "inventory_movement",
  display_name: "Inventory Movement Report",
  description:
    "Warehouse stock movements: items received, consumed, adjusted, and transferred. " +
    "Stock turnover by SKU, low-stock events, shrinkage incidents, and reorder " +
    "lead times. Supports procurement planning.",
  metric_groups: ["warehouse"],
  format:                "table",
  frequency:             "weekly",
  visibility_scope:      "branch",
  required_applications: ["warehouse"],
  supports_ai_summary:   false,
  status:                "planned",
  target_sprint:         "Sprint 13+",
};

const ACCOUNTS_RECEIVABLE_REPORT: AnalyticsReportDescriptor = {
  report_id:    "accounts_receivable",
  display_name: "Accounts Receivable Report",
  description:
    "Outstanding receivables analysis: aging buckets (current, 30, 60, 90+ days), " +
    "DSO trend, overdue invoice list, and payment collection rate by period. " +
    "Supports cash flow management and collections follow-up.",
  metric_groups: ["accounting"],
  format:                "mixed",
  frequency:             "weekly",
  visibility_scope:      "company",
  required_applications: ["accounting"],
  supports_ai_summary:   false,
  status:                "planned",
  target_sprint:         "Sprint 13+",
};

const CUSTOMER_INACTIVITY_REPORT: AnalyticsReportDescriptor = {
  report_id:    "customer_inactivity",
  display_name: "Customer Inactivity Report",
  description:
    "Customers who have not returned within their expected maintenance interval. " +
    "Ranks by inactivity duration, last service type, last communication date, " +
    "and estimated lifetime value at risk. AI-enriched churn risk scoring where enabled.",
  metric_groups: ["crm", "maintenance", "communication"],
  format:                "table",
  frequency:             "on_demand",
  visibility_scope:      "dealer",
  required_applications: ["dealer_agent"],
  supports_ai_summary:   true,
  status:                "planned",
  target_sprint:         "Sprint 12+",
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ANALYTICS_REPORT_REGISTRY: AnalyticsReportDescriptor[] = [
  MONTHLY_SALES_REPORT,
  DEALER_PERFORMANCE_REPORT,
  MAINTENANCE_CONVERSION_REPORT,
  REVIEW_CONVERSION_REPORT,
  COMMUNICATION_RESPONSE_REPORT,
  AI_USAGE_REPORT,
  DISTRIBUTION_SALES_REPORT,
  INVENTORY_MOVEMENT_REPORT,
  ACCOUNTS_RECEIVABLE_REPORT,
  CUSTOMER_INACTIVITY_REPORT,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getReport(
  report_id: AnalyticsReportId,
): AnalyticsReportDescriptor | undefined {
  return ANALYTICS_REPORT_REGISTRY.find((r) => r.report_id === report_id);
}

export function getReportsForApplication(
  application_id: string,
): AnalyticsReportDescriptor[] {
  return ANALYTICS_REPORT_REGISTRY.filter((r) =>
    r.required_applications.includes(application_id),
  );
}

export function getAISummaryReports(): AnalyticsReportDescriptor[] {
  return ANALYTICS_REPORT_REGISTRY.filter((r) => r.supports_ai_summary);
}

export function getReportsByFrequency(
  frequency: AnalyticsReportDescriptor["frequency"],
): AnalyticsReportDescriptor[] {
  return ANALYTICS_REPORT_REGISTRY.filter((r) => r.frequency === frequency);
}

export function getReportsByScope(
  scope: import("./analytics-types").AnalyticsVisibilityScope,
): AnalyticsReportDescriptor[] {
  return ANALYTICS_REPORT_REGISTRY.filter((r) => r.visibility_scope === scope);
}
