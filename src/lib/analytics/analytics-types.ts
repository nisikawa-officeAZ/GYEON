// GYEON Business Hub — Analytics & Reporting Center: Domain Types (Sprint 11Z)
//
// Platform-level analytics type definitions shared across all applications.
//
// Relationship to src/lib/growth/:
//   GrowthMetric / GrowthInsight / GrowthDashboard are dealer-specific AI growth objects.
//   AnalyticsMetric / AnalyticsInsight / AnalyticsDashboard are platform-level, cross-application.
//   These modules do NOT import each other — they are parallel, non-overlapping layers.
//
// Pure — no "use server", no async, no DB calls, no external calls, no calculations.

// ─── Metric groupings ─────────────────────────────────────────────────────────

/** All 14 metric groups supported by the Analytics & Reporting Center. */
export type AnalyticsMetricGroupId =
  | "dealer_operations"    // Shop throughput, staff, capacity
  | "sales"                // Revenue, order value, growth rate
  | "estimates"            // Estimate pipeline, approval rate
  | "work_orders"          // Work order lifecycle, completion
  | "maintenance"          // Maintenance reminders, conversion
  | "communication"        // Messaging activity, response rate
  | "reviews"              // Review volume, rating, conversion
  | "sns_marketing"        // Social content, reach, engagement
  | "ai_usage"             // AI requests, token usage, cost, acceptance
  | "subscription_billing" // Plan, revenue, feature utilization
  | "distribution"         // B2B orders, fulfillment, sell-through
  | "warehouse"            // Inventory, stock turns, alerts
  | "accounting"           // AR, invoices, cash flow, DSO
  | "crm";                 // Customer base, retention, lifetime value

// ─── Metric value types ───────────────────────────────────────────────────────

export type AnalyticsMetricValueType =
  | "count"       // Integer count (vehicles, orders, messages)
  | "currency"    // Monetary value (JPY or configured currency)
  | "percentage"  // Rate or ratio expressed as 0-100
  | "duration"    // Time span in minutes or days
  | "score"       // Composite score (0-100 or 0-10)
  | "ratio";      // Decimal ratio (0.0-1.0)

// ─── Time windows ─────────────────────────────────────────────────────────────

export type AnalyticsTimeframe =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_12_months"
  | "month_to_date"
  | "quarter_to_date"
  | "year_to_date"
  | "custom";

// ─── Trend ────────────────────────────────────────────────────────────────────

export type AnalyticsTrendDirection =
  | "up"               // Metric is improving
  | "down"             // Metric is declining
  | "flat"             // No significant change
  | "insufficient_data"; // Not enough data points to trend

// ─── Visibility scopes ────────────────────────────────────────────────────────

/**
 * AnalyticsVisibilityScope — minimum role required to view a metric or dashboard.
 * Scopes are hierarchical: platform includes all below, staff is the most restricted.
 */
export type AnalyticsVisibilityScope =
  | "platform"  // Platform admins only (cross-tenant aggregates)
  | "company"   // Company admins + platform
  | "dealer"    // Dealer owners + above
  | "branch"    // Branch managers + above
  | "staff";    // All authenticated staff

// ─── AI insight types ─────────────────────────────────────────────────────────

export type AnalyticsInsightType =
  | "ai_summary"              // Narrative summary of a reporting period
  | "ai_recommendation"       // Specific recommended action based on data
  | "anomaly_detection"       // Unusual movement in a metric
  | "growth_opportunity"      // Untapped revenue or retention opportunity
  | "risk_warning"            // Potential risk to business performance
  | "next_action_suggestion"; // Single highest-priority next action

export type AnalyticsInsightSeverity =
  | "critical"     // Immediate attention required
  | "warning"      // Should be addressed soon
  | "info"         // Informational, no urgency
  | "opportunity"; // Positive opportunity, not a problem

// ─── Dashboard and report identifiers ────────────────────────────────────────

export type AnalyticsDashboardId =
  | "executive"
  | "dealer_owner"
  | "staff"
  | "distribution"
  | "warehouse"
  | "accounting"
  | "ai_operations"
  | "subscription";

export type AnalyticsReportId =
  | "monthly_sales"
  | "dealer_performance"
  | "maintenance_conversion"
  | "review_conversion"
  | "communication_response"
  | "ai_usage"
  | "distribution_sales"
  | "inventory_movement"
  | "accounts_receivable"
  | "customer_inactivity";

// ─── Descriptors ──────────────────────────────────────────────────────────────

/** Full metadata descriptor for a single analytics metric. */
export interface AnalyticsMetricDescriptor {
  metric_id:            string;              // "{group}.{slug}" e.g. "sales.monthly_revenue"
  display_name:         string;
  group:                AnalyticsMetricGroupId;
  description:          string;
  value_type:           AnalyticsMetricValueType;
  unit:                 string | null;       // "JPY", "minutes", "%", null
  available_timeframes: AnalyticsTimeframe[];
  visibility_scope:     AnalyticsVisibilityScope;
  source_application:   string;             // PlatformApplicationId reference
  requires_ai:          boolean;
  status:               "active" | "planned";
}

/** Dashboard descriptor — no UI, metadata and routing only. */
export interface AnalyticsDashboardDescriptor {
  dashboard_id:          AnalyticsDashboardId;
  display_name:          string;
  description:           string;
  metric_groups:         AnalyticsMetricGroupId[];
  primary_audience:      string[];          // OrganizationRoleId references
  visibility_scope:      AnalyticsVisibilityScope;
  required_applications: string[];          // PlatformApplicationId references
  default_timeframe:     AnalyticsTimeframe;
  supports_ai_insights:  boolean;
  status:                "active" | "planned";
  target_sprint:         string | null;
}

/** Report descriptor — metadata and structure, no generation. */
export interface AnalyticsReportDescriptor {
  report_id:             AnalyticsReportId;
  display_name:          string;
  description:           string;
  metric_groups:         AnalyticsMetricGroupId[];
  format:                "table" | "chart" | "mixed";
  frequency:             "on_demand" | "daily" | "weekly" | "monthly";
  visibility_scope:      AnalyticsVisibilityScope;
  required_applications: string[];
  supports_ai_summary:   boolean;
  status:                "planned";
  target_sprint:         string | null;
}

/** AI insight type descriptor — no execution. */
export interface AnalyticsInsightDescriptor {
  insight_type:                  AnalyticsInsightType;
  display_name:                  string;
  description:                   string;
  applicable_metric_groups:      AnalyticsMetricGroupId[];
  severity_levels:               AnalyticsInsightSeverity[];
  requires_ai_gateway:           true;
  requires_minimum_data_points:  number;
  status:                        "planned";
  target_sprint:                 string | null;
}

// ─── Analytics policy ─────────────────────────────────────────────────────────

export type AnalyticsPolicyEnforcement = "strict" | "advisory";

export interface AnalyticsPolicy {
  policy_id:   string;   // ANL-001...
  title:       string;
  description: string;
  enforcement: AnalyticsPolicyEnforcement;
  rationale:   string;
  applies_to:  AnalyticsVisibilityScope[] | "all";
}

// ─── Analytics Center descriptor ─────────────────────────────────────────────

export interface AnalyticsCenterDescriptor {
  version:               string;
  sprint:                string;
  metric_group_count:    number;
  total_metric_count:    number;
  dashboard_count:       number;
  report_count:          number;
  ai_insight_type_count: number;
  policy_count:          number;
  platform_core_integrated:  true;
  persistence_required:      false;
  ai_execution_required:     false;
  target_implementation_sprint: string;
}
