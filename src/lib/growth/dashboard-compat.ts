// DealerOS — AI Growth Platform: Dashboard Compatibility (Sprint 11H Phase E)
//
// Compatibility layer for future dashboard UI components.
//
// This module defines the data contracts for each dashboard type.
// It answers the question: "What does each dashboard need, and in what shape?"
//
// Supported dashboards:
//   executive        — Owner/CTO view: growth score, top KPIs, AI summary
//   dealer           — Dealer operational view: daily/weekly metrics, recommendations
//   staff            — Staff task view: completions, work orders due today
//   ai_summary       — AI insight panel: top recommendation + insight digest
//   monthly_report   — Month-end comprehensive report
//   weekly_insights  — Lightweight weekly digest
//
// In Sprint 11H, dashboard data contracts are architectural only.
// No UI components are built. No data is fetched.
// The DASHBOARD_REGISTRY documents what each panel WILL need when built.
//
// Pure — no "use server", no async, no DB calls.

import type {
  GrowthDashboardType,
  GrowthMetricId,
  GrowthDimension,
  GrowthRecommendationCategory,
  GrowthInsightSeverity,
  GrowthDashboard,
  GrowthScore,
  GrowthMetric,
  GrowthInsight,
  GrowthRecommendation,
  GrowthOpportunity,
} from "./growth-types";
import type { AppFeature } from "@/lib/plans/plan-types";

// ─── Dashboard descriptor ──────────────────────────────────────────────────────

/**
 * GrowthDashboardDescriptor — metadata about a single dashboard type.
 *
 * Defines the data requirements and rendering hints for dashboard UI components.
 * Components that implement these dashboards will consume GrowthDashboard,
 * populated with the data described here.
 */
export interface GrowthDashboardDescriptor {
  type:                  GrowthDashboardType;
  label:                 string;
  audience:              "owner" | "dealer" | "staff" | "ai_system";
  description:           string;
  /** KPIs this dashboard always shows. */
  pinned_kpis:           GrowthMetricId[];
  /** Dimensions this dashboard emphasizes. */
  featured_dimensions:   GrowthDimension[];
  /** Maximum number of recommendations to surface. */
  max_recommendations:   number;
  /** Maximum number of insights to surface. */
  max_insights:          number;
  /** Minimum severity to show in this dashboard. */
  min_insight_severity:  GrowthInsightSeverity;
  /** Recommendation categories shown in this dashboard. */
  recommendation_filter: GrowthRecommendationCategory[];
  shows_growth_score:    boolean;
  shows_ai_narrative:    boolean;
  shows_opportunities:   boolean;
  /** Expected refresh frequency for this dashboard's data. */
  refresh_cadence:       "realtime" | "daily" | "weekly" | "monthly";
  required_features:     AppFeature[];
  implementation_status: "planned" | "partial" | "complete";
  sprint:                string;
}

// ─── DASHBOARD_REGISTRY ────────────────────────────────────────────────────────

/**
 * DASHBOARD_REGISTRY — canonical descriptors for all 6 dashboard types.
 */
export const DASHBOARD_REGISTRY: Record<GrowthDashboardType, GrowthDashboardDescriptor> = {

  executive: {
    type:                  "executive",
    label:                 "Executive Dashboard",
    audience:              "owner",
    description:           "High-level business health view for the dealer owner or CTO. Growth score, revenue KPIs, top AI insight, and monthly trend.",
    pinned_kpis:           [
      "monthly_growth_score",
      "average_repair_order_value",
      "customer_retention_rate",
      "new_customer_rate",
      "customer_lifetime_value",
    ],
    featured_dimensions:   ["revenue", "customer_retention", "acquisition"],
    max_recommendations:   3,
    max_insights:          2,
    min_insight_severity:  "warning",
    recommendation_filter: ["revenue_growth", "customer_retention", "service_mix_optimization"],
    shows_growth_score:    true,
    shows_ai_narrative:    true,
    shows_opportunities:   false,
    refresh_cadence:       "daily",
    required_features:     ["ai_growth"],
    implementation_status: "planned",
    sprint:                "Sprint 11I",
  },

  dealer: {
    type:                  "dealer",
    label:                 "Dealer Dashboard",
    audience:              "dealer",
    description:           "Operational dashboard for the dealer. Daily metrics, work order status, LINE engagement, and prioritized recommendations.",
    pinned_kpis:           [
      "repeat_visit_rate",
      "work_order_completion_rate",
      "estimate_approval_rate",
      "line_engagement_rate",
      "review_conversion_rate",
    ],
    featured_dimensions:   ["operations", "customer_retention", "line_engagement", "reputation"],
    max_recommendations:   5,
    max_insights:          4,
    min_insight_severity:  "info",
    recommendation_filter: [
      "customer_retention",
      "maintenance_reminders",
      "review_improvement",
      "staff_productivity",
      "marketing_opportunities",
    ],
    shows_growth_score:    true,
    shows_ai_narrative:    false,
    shows_opportunities:   true,
    refresh_cadence:       "daily",
    required_features:     ["work_orders", "ai_growth"],
    implementation_status: "planned",
    sprint:                "Sprint 11I",
  },

  staff: {
    type:                  "staff",
    label:                 "Staff Dashboard",
    audience:              "staff",
    description:           "Task-oriented view for technicians and front desk staff. Today's work orders, pending estimates, and completion targets.",
    pinned_kpis:           [
      "work_order_completion_rate",
      "estimate_approval_rate",
    ],
    featured_dimensions:   ["operations"],
    max_recommendations:   2,
    max_insights:          1,
    min_insight_severity:  "warning",
    recommendation_filter: ["staff_productivity"],
    shows_growth_score:    false,
    shows_ai_narrative:    false,
    shows_opportunities:   false,
    refresh_cadence:       "realtime",
    required_features:     ["work_orders"],
    implementation_status: "planned",
    sprint:                "Sprint 11I",
  },

  ai_summary: {
    type:                  "ai_summary",
    label:                 "AI Summary Panel",
    audience:              "dealer",
    description:           "AI-curated insight digest for dealers. The growth_agent selects the most impactful insight and one top recommendation.",
    pinned_kpis:           ["monthly_growth_score"],
    featured_dimensions:   ["revenue", "customer_retention", "marketing", "reputation"],
    max_recommendations:   1,
    max_insights:          1,
    min_insight_severity:  "warning",
    recommendation_filter: [
      "revenue_growth",
      "customer_retention",
      "review_improvement",
      "seasonal_campaigns",
    ],
    shows_growth_score:    true,
    shows_ai_narrative:    true,
    shows_opportunities:   false,
    refresh_cadence:       "daily",
    required_features:     ["ai_growth"],
    implementation_status: "planned",
    sprint:                "Sprint 11I",
  },

  monthly_report: {
    type:                  "monthly_report",
    label:                 "Monthly Report",
    audience:              "owner",
    description:           "Comprehensive month-end report. All KPIs, trend analysis, full recommendation set, and AI executive summary.",
    pinned_kpis:           [
      "monthly_growth_score",
      "average_repair_order_value",
      "customer_retention_rate",
      "review_conversion_rate",
      "line_engagement_rate",
      "campaign_conversion_rate",
      "maintenance_conversion_rate",
      "new_customer_rate",
      "estimate_approval_rate",
    ],
    featured_dimensions:   [
      "revenue", "customer_retention", "acquisition",
      "marketing", "reputation", "line_engagement", "operations",
    ],
    max_recommendations:   9,
    max_insights:          8,
    min_insight_severity:  "info",
    recommendation_filter: [
      "revenue_growth",
      "customer_retention",
      "maintenance_reminders",
      "marketing_opportunities",
      "review_improvement",
      "inventory_optimization",
      "staff_productivity",
      "service_mix_optimization",
      "seasonal_campaigns",
    ],
    shows_growth_score:    true,
    shows_ai_narrative:    true,
    shows_opportunities:   true,
    refresh_cadence:       "monthly",
    required_features:     ["ai_growth"],
    implementation_status: "planned",
    sprint:                "Sprint 11I",
  },

  weekly_insights: {
    type:                  "weekly_insights",
    label:                 "Weekly Insights",
    audience:              "dealer",
    description:           "Lightweight weekly digest. 2–3 KPIs, one insight, one recommendation. Delivered via LINE or in-app notification.",
    pinned_kpis:           [
      "repeat_visit_rate",
      "work_order_completion_rate",
      "line_engagement_rate",
    ],
    featured_dimensions:   ["operations", "customer_retention"],
    max_recommendations:   1,
    max_insights:          2,
    min_insight_severity:  "warning",
    recommendation_filter: ["customer_retention", "maintenance_reminders", "review_improvement"],
    shows_growth_score:    false,
    shows_ai_narrative:    false,
    shows_opportunities:   false,
    refresh_cadence:       "weekly",
    required_features:     ["ai_growth"],
    implementation_status: "planned",
    sprint:                "Sprint 11I",
  },
} as const;

// ─── Empty dashboard factory ───────────────────────────────────────────────────

/**
 * buildEmptyDashboard — creates an empty GrowthDashboard shell for a dashboard type.
 *
 * Used by the growth engine to produce a typed placeholder before data is available.
 * dealer_id must come from getCurrentDealer() in the calling server action.
 */
export function buildEmptyDashboard(
  type:      GrowthDashboardType,
  dealer_id: string,
  now:       string,
): GrowthDashboard {
  const descriptor = DASHBOARD_REGISTRY[type];
  return {
    type,
    dealer_id,
    score:               null,
    pinned_metrics:      [],
    featured_insight:    null,
    top_recommendations: [],
    top_opportunities:   [],
    shows_ai_summary:    descriptor.shows_ai_narrative,
    ai_narrative:        null,
    generated_at:        now,
    execution_deferred:  true,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the descriptor for a dashboard type. */
export function getDashboardDescriptor(
  type: GrowthDashboardType,
): GrowthDashboardDescriptor {
  return DASHBOARD_REGISTRY[type];
}

/** Returns all dashboard types that show an AI narrative. */
export function getAIDashboardTypes(): GrowthDashboardType[] {
  return (Object.values(DASHBOARD_REGISTRY) as GrowthDashboardDescriptor[])
    .filter((d) => d.shows_ai_narrative)
    .map((d) => d.type);
}

/** Returns all dashboard types accessible to a given audience role. */
export function getDashboardTypesForAudience(
  audience: "owner" | "dealer" | "staff" | "ai_system",
): GrowthDashboardDescriptor[] {
  return (Object.values(DASHBOARD_REGISTRY) as GrowthDashboardDescriptor[]).filter(
    (d) => d.audience === audience,
  );
}

/**
 * GrowthDashboardDataRequirement — the data a dashboard type needs, as concrete types.
 * Used by future server actions to know exactly what to fetch per dashboard.
 */
export interface GrowthDashboardDataRequirement {
  type:             GrowthDashboardType;
  kpis:             GrowthMetricId[];
  needs_score:      boolean;
  needs_insights:   boolean;
  needs_recs:       boolean;
  needs_opps:       boolean;
  needs_narrative:  boolean;
  /** The dealer_id must come from getCurrentDealer() when this is resolved. */
  requires_dealer:  true;
}

/** Returns the data requirement spec for a dashboard type. */
export function getDashboardDataRequirement(
  type: GrowthDashboardType,
): GrowthDashboardDataRequirement {
  const descriptor = DASHBOARD_REGISTRY[type];
  return {
    type,
    kpis:            descriptor.pinned_kpis,
    needs_score:     descriptor.shows_growth_score,
    needs_insights:  descriptor.max_insights > 0,
    needs_recs:      descriptor.max_recommendations > 0,
    needs_opps:      descriptor.shows_opportunities,
    needs_narrative: descriptor.shows_ai_narrative,
    requires_dealer: true,
  };
}

// ─── Type re-export for consumers ─────────────────────────────────────────────
// Consumers that need GrowthDashboard-related types can import from this module.
export type {
  GrowthScore,
  GrowthMetric,
  GrowthInsight,
  GrowthRecommendation,
  GrowthOpportunity,
};
