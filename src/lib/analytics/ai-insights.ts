// GYEON Business Hub — Analytics & Reporting Center: AI Insight Compatibility (Sprint 11Z)
//
// AI-ready analytics insight type definitions.
// No AI execution. No provider calls. Architecture declarations only.
//
// These types define the interface contract for AI-generated insights that will
// be produced by the AI Gateway (src/lib/ai/) and consumed by dashboards and reports.
// The AI Gateway writes AnalyticsInsight objects; the Analytics Center reads them.
//
// Relationship to src/lib/growth/:
//   GrowthInsight — specific to the Dealer Agent growth domain, AI-produced.
//   AnalyticsInsightDescriptor — platform-level insight TYPE METADATA (this file).
//   These are distinct layers; no import dependency between them.
//
// Pure — no "use server", no async, no DB calls, no external calls, no AI execution.

import type {
  AnalyticsInsightDescriptor,
  AnalyticsInsightType,
  AnalyticsInsightSeverity,
  AnalyticsMetricGroupId,
} from "./analytics-types";

// ─── AI insight type declarations ─────────────────────────────────────────────

function insight(
  insight_type:                 AnalyticsInsightType,
  display_name:                 string,
  description:                  string,
  applicable_metric_groups:     AnalyticsMetricGroupId[],
  severity_levels:              AnalyticsInsightSeverity[],
  requires_minimum_data_points: number,
  target_sprint:                string | null,
): AnalyticsInsightDescriptor {
  return {
    insight_type,
    display_name,
    description,
    applicable_metric_groups,
    severity_levels,
    requires_ai_gateway:          true,
    requires_minimum_data_points,
    status:                       "planned",
    target_sprint,
  };
}

export const ANALYTICS_INSIGHT_REGISTRY: AnalyticsInsightDescriptor[] = [
  insight(
    "ai_summary",
    "AI Performance Summary",
    "A concise narrative summary of business performance for a selected time period. " +
    "Highlights the top 3 metrics that improved, the top 3 that declined, and an " +
    "overall performance assessment. Written in plain language for dealer owners. " +
    "Used as the opening section of monthly reports and dashboard cards.",
    [
      "sales", "dealer_operations", "reviews", "maintenance",
      "communication", "ai_usage",
    ],
    ["info"],
    30,
    "Sprint 12+",
  ),

  insight(
    "ai_recommendation",
    "AI Actionable Recommendation",
    "A specific, evidence-based recommendation for a concrete action the dealer can take " +
    "to improve a metric. Includes the metric to improve, the recommended action, " +
    "expected impact, and suggested timeframe. Each recommendation is tied to at " +
    "least two supporting data points from the metric registry.",
    [
      "sales", "maintenance", "reviews", "communication",
      "sns_marketing", "crm",
    ],
    ["info", "opportunity"],
    14,
    "Sprint 12+",
  ),

  insight(
    "anomaly_detection",
    "Metric Anomaly Alert",
    "Flags a metric that has moved significantly outside its expected range " +
    "for the given period. Anomalies are detected using statistical baseline " +
    "comparison against the trailing 90-day pattern. " +
    "Examples: revenue drop of > 20% from trailing average, " +
    "sudden spike in opt-out rate, unexpected drop in work order completion rate.",
    [
      "sales", "dealer_operations", "work_orders", "communication",
      "reviews", "ai_usage", "distribution", "accounting",
    ],
    ["critical", "warning"],
    30,
    "Sprint 12+",
  ),

  insight(
    "growth_opportunity",
    "Growth Opportunity",
    "Identifies an untapped revenue or retention opportunity based on current " +
    "performance gaps versus benchmarks. " +
    "Examples: maintenance conversion rate below 30% suggests a reminder campaign " +
    "opportunity; review conversion below industry average suggests a review request " +
    "cadence improvement; social reach growth suggests doubling posting frequency.",
    [
      "maintenance", "reviews", "sns_marketing", "crm",
      "sales", "estimates",
    ],
    ["opportunity"],
    60,
    "Sprint 12+",
  ),

  insight(
    "risk_warning",
    "Business Risk Warning",
    "Proactively surfaces a risk pattern that could materially affect business " +
    "performance if left unaddressed. " +
    "Examples: customer churn rate rising over 3 consecutive months, " +
    "accounts receivable DSO exceeding 45 days, AI budget at 90% utilization, " +
    "overdue work orders exceeding 10% of open orders, " +
    "communication opt-out rate spike following a campaign.",
    [
      "crm", "accounting", "work_orders", "ai_usage",
      "communication", "subscription_billing",
    ],
    ["critical", "warning"],
    7,
    "Sprint 12+",
  ),

  insight(
    "next_action_suggestion",
    "Next Best Action",
    "Suggests the single highest-priority action the dealer should take today " +
    "based on current data. Prioritizes by estimated revenue impact and effort. " +
    "One suggestion at a time — not a list. Designed for the Dealer Owner Dashboard " +
    "home card. " +
    "Examples: 'Send maintenance reminders to 12 overdue customers', " +
    "'Respond to 3 unanswered LINE messages', " +
    "'Review 5 pending estimates that have not been followed up'.",
    [
      "maintenance", "communication", "estimates", "reviews",
      "work_orders", "crm",
    ],
    ["info", "opportunity", "warning"],
    7,
    "Sprint 12+",
  ),
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getInsightDescriptor(
  insight_type: AnalyticsInsightType,
): AnalyticsInsightDescriptor | undefined {
  return ANALYTICS_INSIGHT_REGISTRY.find((i) => i.insight_type === insight_type);
}

export function getInsightTypesForMetricGroup(
  group: AnalyticsMetricGroupId,
): AnalyticsInsightDescriptor[] {
  return ANALYTICS_INSIGHT_REGISTRY.filter((i) =>
    i.applicable_metric_groups.includes(group),
  );
}

export function getInsightTypesForSeverity(
  severity: AnalyticsInsightSeverity,
): AnalyticsInsightDescriptor[] {
  return ANALYTICS_INSIGHT_REGISTRY.filter((i) =>
    i.severity_levels.includes(severity),
  );
}

export function getMinimumDataPointRequirement(
  insight_type: AnalyticsInsightType,
): number {
  return getInsightDescriptor(insight_type)?.requires_minimum_data_points ?? 30;
}
