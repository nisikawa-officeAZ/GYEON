// DealerOS — AI Growth Platform: KPI Model (Sprint 11H Phase C)
//
// Canonical KPI definitions for the AI Growth Platform.
//
// This module defines WHAT each KPI measures — not HOW to compute it.
// Computation requires live database queries which are deferred to Phase 11I.
//
// KPI structure:
//   - GrowthKPIDefinition: the static definition (name, formula description,
//     unit, benchmark, data sources, dimensions)
//   - KPI_REGISTRY: all 15 canonical KPIs indexed by GrowthMetricId
//
// 15 canonical KPIs covering:
//   Revenue:          average_repair_order_value, average_coating_revenue
//   Retention:        customer_retention_rate, repeat_visit_rate, customer_lifetime_value
//   Operations:       work_order_completion_rate, estimate_approval_rate, maintenance_conversion_rate
//   Marketing:        campaign_conversion_rate, line_engagement_rate, line_opt_in_rate
//   Reputation:       review_conversion_rate, review_response_rate
//   Acquisition:      new_customer_rate
//   Composite:        monthly_growth_score
//
// All calculations require dealer_id from getCurrentDealer() in the computation layer.
// No KPI definition itself stores or processes data.
//
// Pure — no "use server", no async, no DB calls.

import type { GrowthDimension, GrowthMetricId } from "./growth-types";
import type { GrowthDataSourceId } from "./data-source-registry";

// ─── KPI definition ───────────────────────────────────────────────────────────

/**
 * GrowthKPIDefinition — the canonical definition of a single KPI.
 *
 * Provides enough information for:
 *   - Dashboard rendering (label, unit, benchmark)
 *   - AI agent context (formula_description, data_sources)
 *   - Calculation engine (numerator_hint, denominator_hint)
 */
export interface GrowthKPIDefinition {
  id:                    GrowthMetricId;
  label:                 string;
  description:           string;
  /** Natural-language description of the calculation formula. */
  formula_description:   string;
  /** Numerator data hint for the calculation engine. */
  numerator_hint:        string;
  /** Denominator data hint. null for absolute metrics (not a ratio). */
  denominator_hint:      string | null;
  unit:                  "percent" | "jpy" | "count" | "ratio" | "score" | "days";
  /** Industry benchmark for the Japanese automotive detailing market. null = unknown. */
  benchmark:             number | null;
  /** Direction: "higher" or "lower" is better. */
  higher_is_better:      boolean;
  dimension:             GrowthDimension;
  required_sources:      GrowthDataSourceId[];
  /** Minimum number of records needed to produce a meaningful value. */
  min_data_points:       number;
  /** True when this KPI requires AI to compute (Phase 11I+). */
  requires_ai:           boolean;
  /** Which dashboard types should always show this KPI. */
  pinned_to_dashboards:  string[];
  calculation_deferred:  boolean;
  available_since:       string;
}

// ─── KPI_REGISTRY ─────────────────────────────────────────────────────────────

/**
 * KPI_REGISTRY — canonical definitions for all 15 growth KPIs.
 *
 * calculation_deferred: true for all KPIs in Sprint 11H.
 * Real calculation requires Phase 11I query layer.
 */
export const KPI_REGISTRY: Record<GrowthMetricId, GrowthKPIDefinition> = {

  customer_retention_rate: {
    id:                   "customer_retention_rate",
    label:                "Customer Retention Rate",
    description:          "Percentage of customers who returned for a second visit within 12 months",
    formula_description:  "Customers with 2+ visits in 12 months ÷ Total unique customers × 100",
    numerator_hint:       "COUNT(DISTINCT customer_id WHERE visit_count >= 2 AND period = '12m')",
    denominator_hint:     "COUNT(DISTINCT customer_id WHERE first_visit < period_end)",
    unit:                 "percent",
    benchmark:            45,       // ~45% repeat rate is strong for JP automotive detailing
    higher_is_better:     true,
    dimension:            "customer_retention",
    required_sources:     ["customers", "work_orders"],
    min_data_points:      20,
    requires_ai:          false,
    pinned_to_dashboards: ["executive", "dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  repeat_visit_rate: {
    id:                   "repeat_visit_rate",
    label:                "Repeat Visit Rate",
    description:          "Percentage of all work orders from returning customers (not first-visit)",
    formula_description:  "Work orders from returning customers ÷ Total work orders × 100",
    numerator_hint:       "COUNT(work_orders WHERE customer has previous completed work_order)",
    denominator_hint:     "COUNT(ALL completed work_orders)",
    unit:                 "percent",
    benchmark:            55,
    higher_is_better:     true,
    dimension:            "customer_retention",
    required_sources:     ["customers", "work_orders"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report", "weekly_insights"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  average_repair_order_value: {
    id:                   "average_repair_order_value",
    label:                "Average Repair Order Value",
    description:          "Average total payment amount per completed work order",
    formula_description:  "Total payment revenue ÷ Number of completed work orders",
    numerator_hint:       "SUM(payments.amount WHERE work_order.status = 'completed')",
    denominator_hint:     "COUNT(work_orders WHERE status = 'completed')",
    unit:                 "jpy",
    benchmark:            65000,    // ¥65,000 average RO value for GYEON ceramic coating
    higher_is_better:     true,
    dimension:            "revenue",
    required_sources:     ["work_orders", "payments"],
    min_data_points:      5,
    requires_ai:          false,
    pinned_to_dashboards: ["executive", "dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  average_coating_revenue: {
    id:                   "average_coating_revenue",
    label:                "Average Coating Revenue",
    description:          "Average revenue from coating services only, excluding maintenance and products",
    formula_description:  "Total coating-category payments ÷ Number of coating work orders",
    numerator_hint:       "SUM(payments.amount WHERE estimate.service_category = 'coating')",
    denominator_hint:     "COUNT(work_orders WHERE estimate.service_category = 'coating')",
    unit:                 "jpy",
    benchmark:            80000,
    higher_is_better:     true,
    dimension:            "revenue",
    required_sources:     ["work_orders", "payments", "estimates"],
    min_data_points:      5,
    requires_ai:          false,
    pinned_to_dashboards: ["executive", "dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  maintenance_conversion_rate: {
    id:                   "maintenance_conversion_rate",
    label:                "Maintenance Conversion Rate",
    description:          "Percentage of coating customers who book at least one maintenance service",
    formula_description:  "Customers with a maintenance work order ÷ Total coating customers × 100",
    numerator_hint:       "COUNT(DISTINCT customer_id WHERE has_maintenance_work_order = true)",
    denominator_hint:     "COUNT(DISTINCT customer_id WHERE has_coating_work_order = true)",
    unit:                 "percent",
    benchmark:            30,
    higher_is_better:     true,
    dimension:            "customer_retention",
    required_sources:     ["customers", "work_orders"],
    min_data_points:      15,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  review_conversion_rate: {
    id:                   "review_conversion_rate",
    label:                "Review Conversion Rate",
    description:          "Percentage of review requests that result in an actual customer review",
    formula_description:  "Reviews received ÷ Review requests sent × 100",
    numerator_hint:       "COUNT(review_signals WHERE source = 'customer_review')",
    denominator_hint:     "COUNT(line_messages WHERE type = 'review_request' AND delivered = true)",
    unit:                 "percent",
    benchmark:            20,       // 20% conversion is strong for Japanese market
    higher_is_better:     true,
    dimension:            "reputation",
    required_sources:     ["ai_reputation_platform", "line_automation_platform"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  review_response_rate: {
    id:                   "review_response_rate",
    label:                "Review Response Rate",
    description:          "Percentage of customer reviews that received a dealer response",
    formula_description:  "Reviews with dealer response ÷ Total reviews received × 100",
    numerator_hint:       "COUNT(reviews WHERE dealer_responded = true)",
    denominator_hint:     "COUNT(ALL reviews)",
    unit:                 "percent",
    benchmark:            80,
    higher_is_better:     true,
    dimension:            "reputation",
    required_sources:     ["ai_reputation_platform"],
    min_data_points:      5,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  line_engagement_rate: {
    id:                   "line_engagement_rate",
    label:                "LINE Engagement Rate",
    description:          "Percentage of sent LINE messages that receive a click, reply, or action",
    formula_description:  "LINE messages with user action ÷ LINE messages delivered × 100",
    numerator_hint:       "COUNT(line_message_logs WHERE action_taken = true)",
    denominator_hint:     "COUNT(line_message_logs WHERE status = 'delivered')",
    unit:                 "percent",
    benchmark:            35,
    higher_is_better:     true,
    dimension:            "line_engagement",
    required_sources:     ["line_automation_platform"],
    min_data_points:      20,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "weekly_insights"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  campaign_conversion_rate: {
    id:                   "campaign_conversion_rate",
    label:                "Campaign Conversion Rate",
    description:          "Percentage of delivered campaign messages that lead to a booking or estimate",
    formula_description:  "Campaigns resulting in work order ÷ Campaigns delivered × 100",
    numerator_hint:       "COUNT(campaigns WHERE outcome = 'booking' OR outcome = 'estimate')",
    denominator_hint:     "COUNT(campaigns WHERE status = 'delivered')",
    unit:                 "percent",
    benchmark:            8,
    higher_is_better:     true,
    dimension:            "marketing",
    required_sources:     ["ai_marketing_platform", "work_orders", "estimates"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  monthly_growth_score: {
    id:                   "monthly_growth_score",
    label:                "Monthly Growth Score",
    description:          "Composite 0–100 business health score weighted across all KPI dimensions",
    formula_description:  "Weighted average of normalized dimension scores across revenue, retention, reputation, marketing, operations",
    numerator_hint:       "Weighted sum of (normalized_kpi_value × dimension_weight) for each active KPI",
    denominator_hint:     null,   // Absolute score — not a ratio
    unit:                 "score",
    benchmark:            65,
    higher_is_better:     true,
    dimension:            "revenue",   // Primary dimension — cross-dimensional by nature
    required_sources:     [
      "customers", "work_orders", "payments",
      "ai_reputation_platform", "line_automation_platform",
    ],
    min_data_points:      30,
    requires_ai:          true,   // AI agent refines the score weighting (Phase 11I+)
    pinned_to_dashboards: ["executive", "dealer", "monthly_report", "ai_summary"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  new_customer_rate: {
    id:                   "new_customer_rate",
    label:                "New Customer Rate",
    description:          "Percentage of work orders from first-time customers in the period",
    formula_description:  "Work orders from new customers ÷ Total work orders × 100",
    numerator_hint:       "COUNT(work_orders WHERE customer is first_visit_in_period)",
    denominator_hint:     "COUNT(ALL completed work_orders in period)",
    unit:                 "percent",
    benchmark:            25,
    higher_is_better:     true,
    dimension:            "acquisition",
    required_sources:     ["customers", "work_orders"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["executive", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  customer_lifetime_value: {
    id:                   "customer_lifetime_value",
    label:                "Customer Lifetime Value",
    description:          "Average total revenue generated by a customer over their lifetime with the dealer",
    formula_description:  "Total revenue per customer ÷ Number of customers",
    numerator_hint:       "SUM(all_payments_per_customer)",
    denominator_hint:     "COUNT(DISTINCT customer_id)",
    unit:                 "jpy",
    benchmark:            150000,  // ¥150,000 LTV target for GYEON dealers
    higher_is_better:     true,
    dimension:            "customer_retention",
    required_sources:     ["customers", "payments"],
    min_data_points:      20,
    requires_ai:          false,
    pinned_to_dashboards: ["executive", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  work_order_completion_rate: {
    id:                   "work_order_completion_rate",
    label:                "Work Order Completion Rate",
    description:          "Percentage of created work orders that are completed (not cancelled)",
    formula_description:  "Completed work orders ÷ Total created work orders × 100",
    numerator_hint:       "COUNT(work_orders WHERE status = 'completed')",
    denominator_hint:     "COUNT(work_orders WHERE status != 'draft')",
    unit:                 "percent",
    benchmark:            92,
    higher_is_better:     true,
    dimension:            "operations",
    required_sources:     ["work_orders"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "weekly_insights"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  estimate_approval_rate: {
    id:                   "estimate_approval_rate",
    label:                "Estimate Approval Rate",
    description:          "Percentage of submitted estimates that are approved by customers",
    formula_description:  "Approved estimates ÷ Submitted estimates × 100",
    numerator_hint:       "COUNT(estimates WHERE status = 'approved')",
    denominator_hint:     "COUNT(estimates WHERE status IN ('approved', 'rejected', 'expired'))",
    unit:                 "percent",
    benchmark:            68,
    higher_is_better:     true,
    dimension:            "operations",
    required_sources:     ["estimates"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },

  line_opt_in_rate: {
    id:                   "line_opt_in_rate",
    label:                "LINE Opt-In Rate",
    description:          "Percentage of customers who are linked to the dealer's LINE account",
    formula_description:  "LINE-linked customers ÷ Total active customers × 100",
    numerator_hint:       "COUNT(customers WHERE line_user_id IS NOT NULL)",
    denominator_hint:     "COUNT(customers WHERE status = 'active')",
    unit:                 "percent",
    benchmark:            40,
    higher_is_better:     true,
    dimension:            "line_engagement",
    required_sources:     ["customers", "line_automation_platform"],
    min_data_points:      10,
    requires_ai:          false,
    pinned_to_dashboards: ["dealer", "monthly_report"],
    calculation_deferred: true,
    available_since:      "Sprint 11I",
  },
} as const;

// ─── KPI helpers ───────────────────────────────────────────────────────────────

/** Returns the KPI definition for a metric ID. Never null — all IDs have definitions. */
export function getKPIDefinition(id: GrowthMetricId): GrowthKPIDefinition {
  return KPI_REGISTRY[id];
}

/** Returns all KPIs in a given growth dimension. */
export function getKPIsByDimension(
  dimension: GrowthDimension,
): GrowthKPIDefinition[] {
  return Object.values(KPI_REGISTRY).filter((kpi) => kpi.dimension === dimension);
}

/** Returns all KPIs that are pinned to a specific dashboard type. */
export function getKPIsForDashboard(
  dashboardType: string,
): GrowthKPIDefinition[] {
  return Object.values(KPI_REGISTRY).filter((kpi) =>
    kpi.pinned_to_dashboards.includes(dashboardType),
  );
}

/** Returns all KPIs that require AI to compute (deferred to Phase 11I+). */
export function getAIRequiredKPIs(): GrowthKPIDefinition[] {
  return Object.values(KPI_REGISTRY).filter((kpi) => kpi.requires_ai);
}

/**
 * buildBlankMetric — creates a GrowthMetric with null value for a KPI.
 * Used by the growth engine to represent deferred calculations.
 * Caller must supply dealer_id from getCurrentDealer().
 */
export function buildBlankMetric(
  id:        GrowthMetricId,
  dealer_id: string,
  timeframe: import("./growth-types").GrowthTimeframe,
  now:       string,
): import("./growth-types").GrowthMetric {
  const def = KPI_REGISTRY[id];
  return {
    id,
    dealer_id,
    dimension:      def.dimension,
    timeframe,
    value:          null,
    unit:           def.unit,
    previous_value: null,
    computed_at:    now,
    is_projected:   false,
    data_deferred:  true,
  };
}
