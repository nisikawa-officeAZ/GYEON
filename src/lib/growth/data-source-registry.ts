// DealerOS — AI Growth Platform: Data Source Registry (Sprint 11H Phase B)
//
// Centralized registry of all data sources the Growth Platform will consume.
//
// The registry serves two purposes:
//   1. Documentation — declares what data the growth engine needs
//   2. Readiness tracking — records whether each source is currently available
//
// In Sprint 11H, all data sources have availability: "available" or "partial"
// for sources already implemented in the codebase, and "planned" for future
// integrations. No actual queries are made here.
//
// Security:
//   All production data access from these sources MUST scope queries by
//   dealer_id from getCurrentDealer(). The registry describes data shapes
//   only — it does not execute queries.
//
// Cross-platform data flow:
//   Growth Platform reads from all subsystems but NEVER writes to them.
//   Data flows one-way: source platform → growth analysis layer.
//   Mutations (e.g. sending a campaign) go through the source platform's own API.
//
// Pure — no "use server", no async, no DB calls.

import type { AppFeature } from "@/lib/plans/plan-types";
import type { GrowthDimension, GrowthMetricId } from "./growth-types";

// ─── Data source identifier ────────────────────────────────────────────────────

/**
 * GrowthDataSourceId — canonical identifier for each data source the Growth
 * Platform may consume.
 */
export type GrowthDataSourceId =
  | "customers"              // src/lib/customers
  | "vehicles"               // src/lib/vehicles
  | "estimates"              // src/lib/estimates
  | "work_orders"            // src/lib/work-orders
  | "completion_reports"     // src/lib/completion-reports
  | "payments"               // src/lib/payments
  | "products"               // src/lib/products
  | "media_platform"         // src/lib/media
  | "ai_marketing_platform"  // src/lib/marketing
  | "ai_reputation_platform" // src/lib/reputation
  | "line_automation_platform"; // src/lib/line-automation

// ─── Data source descriptor ────────────────────────────────────────────────────

/**
 * GrowthDataSourceDescriptor — metadata about a single data source.
 */
export interface GrowthDataSourceDescriptor {
  id:                    GrowthDataSourceId;
  label:                 string;
  description:           string;
  /** Path to the source module relative to src/. */
  module_path:           string;
  /** AppFeatures required to access this source. */
  required_features:     AppFeature[];
  /** KPIs that this source contributes to. */
  contributes_to_kpis:   GrowthMetricId[];
  /** Growth dimensions this source feeds. */
  contributes_to_dims:   GrowthDimension[];
  /**
   * "available" — source is implemented and has production data
   * "partial"   — source is implemented but some data is missing
   * "planned"   — source integration with Growth Platform is future work
   */
  availability:          "available" | "partial" | "planned";
  /** Sprint when this source's Growth Platform integration will be active. */
  integration_sprint:    string;
  /**
   * Names of the query functions or server actions the growth engine will call.
   * Documents future integration points — not called in Sprint 11H.
   */
  future_query_hints:    string[];
}

// ─── DATA_SOURCE_REGISTRY ─────────────────────────────────────────────────────

/**
 * DATA_SOURCE_REGISTRY — all data sources the Growth Platform will consume.
 *
 * This is the authoritative list of cross-platform data relationships.
 * Each entry documents what KPIs the source contributes to and where to
 * find the data in the codebase.
 */
export const DATA_SOURCE_REGISTRY: readonly GrowthDataSourceDescriptor[] = [
  {
    id:                  "customers",
    label:               "Customers",
    description:         "Customer records: name, contact, LINE linkage, registration date",
    module_path:         "src/lib/customers",
    required_features:   ["customers"],
    contributes_to_kpis: [
      "customer_retention_rate",
      "repeat_visit_rate",
      "new_customer_rate",
      "customer_lifetime_value",
      "line_opt_in_rate",
    ],
    contributes_to_dims: ["customer_retention", "acquisition", "line_engagement"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getCustomers(dealer_id)",
      "getCustomerById(id, dealer_id)",
      "getCustomerWithVehicles(id, dealer_id)",
    ],
  },

  {
    id:                  "vehicles",
    label:               "Vehicles",
    description:         "Customer vehicles: make, model, year, coating history, maintenance schedule",
    module_path:         "src/lib/vehicles",
    required_features:   ["vehicles"],
    contributes_to_kpis: [
      "maintenance_conversion_rate",
      "repeat_visit_rate",
      "average_coating_revenue",
    ],
    contributes_to_dims: ["customer_retention", "revenue", "operations"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getVehiclesByCustomer(customer_id, dealer_id)",
      "getVehiclesWithMaintenanceSchedule(dealer_id)",
    ],
  },

  {
    id:                  "estimates",
    label:               "Estimates",
    description:         "Estimate records: service type, coating product, price, approval status",
    module_path:         "src/lib/estimates",
    required_features:   ["estimates"],
    contributes_to_kpis: [
      "estimate_approval_rate",
      "average_repair_order_value",
      "average_coating_revenue",
      "campaign_conversion_rate",
    ],
    contributes_to_dims: ["revenue", "operations", "seasonal"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getEstimates(dealer_id, filters)",
      "getEstimatesByStatus(dealer_id, status)",
    ],
  },

  {
    id:                  "work_orders",
    label:               "Work Orders",
    description:         "Work order records: completion status, service details, duration, assigned staff",
    module_path:         "src/lib/work-orders",
    required_features:   ["work_orders"],
    contributes_to_kpis: [
      "work_order_completion_rate",
      "average_repair_order_value",
      "repeat_visit_rate",
      "maintenance_conversion_rate",
    ],
    contributes_to_dims: ["revenue", "operations", "customer_retention"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getWorkOrders(dealer_id, filters)",
      "getWorkOrdersByStatus(dealer_id, status)",
      "getCompletedWorkOrders(dealer_id, timeframe)",
    ],
  },

  {
    id:                  "completion_reports",
    label:               "Completion Reports",
    description:         "Detailed post-completion records: service notes, photos, customer satisfaction",
    module_path:         "src/lib/completion-reports",
    required_features:   ["completion_reports"],
    contributes_to_kpis: [
      "review_conversion_rate",
      "customer_retention_rate",
      "work_order_completion_rate",
    ],
    contributes_to_dims: ["reputation", "customer_retention", "operations"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getCompletionReports(dealer_id, filters)",
    ],
  },

  {
    id:                  "payments",
    label:               "Payments",
    description:         "Payment records: amount, method, date, linked work order",
    module_path:         "src/lib/payments",
    required_features:   ["payments"],
    contributes_to_kpis: [
      "average_repair_order_value",
      "average_coating_revenue",
      "monthly_growth_score",
      "customer_lifetime_value",
    ],
    contributes_to_dims: ["revenue", "operations", "seasonal"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getPayments(dealer_id, filters)",
      "getPaymentsByPeriod(dealer_id, start, end)",
    ],
  },

  {
    id:                  "products",
    label:               "Products",
    description:         "GYEON product catalog: SKU, price, category, inventory",
    module_path:         "src/lib/products",
    required_features:   ["products"],
    contributes_to_kpis: [
      "average_coating_revenue",
      "average_repair_order_value",
    ],
    contributes_to_dims: ["revenue", "inventory"],
    availability:        "available",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getProducts(dealer_id)",
      "getProductUsageByPeriod(dealer_id, start, end)",
    ],
  },

  {
    id:                  "media_platform",
    label:               "Media Platform",
    description:         "Media assets: before/after photos, video pipeline status, consent records",
    module_path:         "src/lib/media",
    required_features:   ["work_orders"],  // Media is tied to work orders
    contributes_to_kpis: [
      "campaign_conversion_rate",
      "monthly_growth_score",
    ],
    contributes_to_dims: ["marketing", "reputation"],
    availability:        "partial",        // Media Platform exists; Growth query layer is future
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getMediaAssetsByDealer(dealer_id, filters)",
      "getBeforeAfterMediaByWorkOrder(work_order_id, dealer_id)",
    ],
  },

  {
    id:                  "ai_marketing_platform",
    label:               "AI Marketing Platform",
    description:         "Marketing campaigns: channel, status, reach, conversion data",
    module_path:         "src/lib/marketing",
    required_features:   ["ai_marketing"],
    contributes_to_kpis: [
      "campaign_conversion_rate",
      "monthly_growth_score",
      "line_engagement_rate",
    ],
    contributes_to_dims: ["marketing", "revenue", "line_engagement"],
    availability:        "partial",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getCampaigns(dealer_id, filters)",
      "getCampaignPerformance(campaign_id, dealer_id)",
    ],
  },

  {
    id:                  "ai_reputation_platform",
    label:               "AI Reputation Platform",
    description:         "Review requests, review signals, reputation scores, LINE review message logs",
    module_path:         "src/lib/reputation",
    required_features:   ["ai_reputation"],
    contributes_to_kpis: [
      "review_conversion_rate",
      "review_response_rate",
      "monthly_growth_score",
    ],
    contributes_to_dims: ["reputation", "customer_retention"],
    availability:        "partial",
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getReputationProfile(dealer_id)",
      "getReviewSignals(dealer_id, filters)",
    ],
  },

  {
    id:                  "line_automation_platform",
    label:               "LINE Automation Platform",
    description:         "LINE workflow execution logs, trigger history, dispatch readiness",
    module_path:         "src/lib/line-automation",
    required_features:   ["line"],
    contributes_to_kpis: [
      "line_engagement_rate",
      "line_opt_in_rate",
      "maintenance_conversion_rate",
      "review_conversion_rate",
    ],
    contributes_to_dims: ["line_engagement", "customer_retention", "marketing"],
    availability:        "partial",       // Platform defined in Sprint 11G; dispatch deferred
    integration_sprint:  "Sprint 11I",
    future_query_hints:  [
      "getLineAutomationLogs(dealer_id, filters)",
      "getLineEngagementMetrics(dealer_id, timeframe)",
    ],
  },
] as const;

// ─── Registry helpers ──────────────────────────────────────────────────────────

/** Returns the descriptor for a data source. undefined if not in registry. */
export function getDataSourceDescriptor(
  id: GrowthDataSourceId,
): GrowthDataSourceDescriptor | undefined {
  return DATA_SOURCE_REGISTRY.find((ds) => ds.id === id);
}

/** Returns all sources that contribute to a given KPI. */
export function getSourcesForKPI(
  kpiId: GrowthMetricId,
): readonly GrowthDataSourceDescriptor[] {
  return DATA_SOURCE_REGISTRY.filter((ds) =>
    ds.contributes_to_kpis.includes(kpiId),
  );
}

/** Returns all sources that feed a given growth dimension. */
export function getSourcesForDimension(
  dimension: GrowthDimension,
): readonly GrowthDataSourceDescriptor[] {
  return DATA_SOURCE_REGISTRY.filter((ds) =>
    ds.contributes_to_dims.includes(dimension),
  );
}

/** Returns all sources that are currently available (not planned). */
export function getAvailableSources(): readonly GrowthDataSourceDescriptor[] {
  return DATA_SOURCE_REGISTRY.filter(
    (ds) => ds.availability === "available" || ds.availability === "partial",
  );
}
