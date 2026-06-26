// DealerOS — AI Growth Platform: Core Domain Types (Sprint 11H Phase A)
//
// Canonical type definitions for the AI Growth Platform.
// Growth becomes a first-class business domain alongside Marketing, Reputation,
// and the LINE Automation Platform.
//
// Design principles:
//   - dealer_id always from getCurrentDealer() in every server-side consumer
//   - No AI provider execution in Sprint 11H — architecture and models only
//   - All cross-platform data flows through typed interfaces, not raw queries
//   - GrowthInsight, GrowthRecommendation, GrowthOpportunity, GrowthMetric,
//     GrowthScore, GrowthTrend, GrowthReport, and GrowthDashboard are the
//     eight canonical growth domain objects
//   - execution_deferred: true is a literal — no AI inference fires in Sprint 11H
//
// Consumed by:
//   - Executive Dashboard (future)
//   - Dealer Dashboard (future)
//   - Monthly AI Report (future)
//   - growth_agent via AI Gateway (Phase 11I+)
//   - marketing_agent cross-feed (Phase 11I+)
//   - reputation_agent cross-feed (Phase 11I+)
//
// Pure — no "use server", no external calls, no DB queries.

import type { AIAgentId }  from "@/lib/ai/agents/types";
import type { AppFeature } from "@/lib/plans/plan-types";

// ─── Dimension identifiers ─────────────────────────────────────────────────────

/**
 * GrowthDimension — the business dimension a growth object belongs to.
 * Used to route insights and recommendations to the right dashboard panel.
 */
export type GrowthDimension =
  | "revenue"             // Revenue and repair order value
  | "customer_retention"  // Repeat visit rate, churn, loyalty
  | "acquisition"         // New customer growth, referrals
  | "operations"          // Work order throughput, staff efficiency
  | "marketing"           // Campaign ROI, channel performance
  | "reputation"          // Review volume, rating trends, response rate
  | "line_engagement"     // LINE open rates, click-through, link actions
  | "inventory"           // Product / coating inventory usage
  | "seasonal"            // Seasonal demand and capacity patterns
  | "ai_performance";     // AI agent output quality and ROI (Phase 11I+)

/**
 * GrowthTimeframe — canonical time windows for growth analysis.
 */
export type GrowthTimeframe =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_12_months"
  | "month_to_date"
  | "quarter_to_date"
  | "year_to_date"
  | "custom";

// ─── GrowthMetric ─────────────────────────────────────────────────────────────

/**
 * GrowthMetricId — canonical KPI identifiers.
 * Full definitions are in kpi-model.ts.
 */
export type GrowthMetricId =
  | "customer_retention_rate"
  | "repeat_visit_rate"
  | "average_repair_order_value"
  | "average_coating_revenue"
  | "maintenance_conversion_rate"
  | "review_conversion_rate"
  | "review_response_rate"
  | "line_engagement_rate"
  | "campaign_conversion_rate"
  | "monthly_growth_score"
  | "new_customer_rate"
  | "customer_lifetime_value"
  | "work_order_completion_rate"
  | "estimate_approval_rate"
  | "line_opt_in_rate";

/**
 * GrowthMetric — a single measured data point for a KPI.
 *
 * value is null when the metric cannot be computed (insufficient data, missing
 * integration, or calculation is deferred to Phase 11I+).
 */
export interface GrowthMetric {
  id:              GrowthMetricId;
  /** Always from getCurrentDealer() in any server-side context. */
  dealer_id:       string;
  dimension:       GrowthDimension;
  timeframe:       GrowthTimeframe;
  /** null = insufficient data or calculation deferred */
  value:           number | null;
  unit:            "percent" | "jpy" | "count" | "ratio" | "score" | "days";
  /** The previous period's value for trend comparison. null if unavailable. */
  previous_value:  number | null;
  /** ISO 8601 timestamp when this metric was last computed. */
  computed_at:     string;
  /** True when value is a projection, not a measured result. */
  is_projected:    boolean;
  /** True when the data source is not yet integrated. */
  data_deferred:   boolean;
}

// ─── GrowthTrend ──────────────────────────────────────────────────────────────

/**
 * GrowthTrendDirection — qualitative direction of a metric trend.
 */
export type GrowthTrendDirection =
  | "improving"
  | "stable"
  | "declining"
  | "insufficient_data";

/**
 * GrowthTrend — change analysis for a metric over time.
 */
export interface GrowthTrend {
  metric_id:         GrowthMetricId;
  dealer_id:         string;
  direction:         GrowthTrendDirection;
  /** Percentage change from previous period. null = insufficient data. */
  change_percent:    number | null;
  /** Absolute change value. null = insufficient data. */
  change_absolute:   number | null;
  timeframe:         GrowthTimeframe;
  data_points:       GrowthDataPoint[];
  computed_at:       string;
}

/**
 * GrowthDataPoint — a single time-series observation for a metric.
 */
export interface GrowthDataPoint {
  date:        string;   // ISO 8601 date (YYYY-MM-DD)
  value:       number | null;
  is_projected:boolean;
}

// ─── GrowthScore ──────────────────────────────────────────────────────────────

/**
 * GrowthScore — composite business health score for a dealer.
 *
 * Computed from a weighted combination of KPIs across all dimensions.
 * 0–100 scale. null when insufficient data to compute.
 */
export interface GrowthScore {
  /** Always from getCurrentDealer(). */
  dealer_id:         string;
  /** Overall weighted score. null = insufficient data. */
  overall:           number | null;
  /** Per-dimension breakdown. */
  breakdown:         Record<GrowthDimension, number | null>;
  timeframe:         GrowthTimeframe;
  /** True when overall is based on partial data (some dimensions are null). */
  is_partial:        boolean;
  computed_at:       string;
  /** AI-generated narrative summary. null until Phase 11I+. */
  ai_summary:        null;
  execution_deferred:true;
}

// ─── GrowthInsight ────────────────────────────────────────────────────────────

/**
 * GrowthInsightSeverity — how urgent the insight is for the dealer.
 */
export type GrowthInsightSeverity =
  | "critical"   // Immediate action required — significant revenue or retention risk
  | "warning"    // Action recommended within the week
  | "info"       // Informational — no urgency
  | "positive";  // Good news — something is working well

/**
 * GrowthInsight — a single business observation derived from growth data.
 *
 * Insights are generated by the growth_agent (Phase 11I+).
 * In Sprint 11H they are typed structures with deferred content.
 */
export interface GrowthInsight {
  id:                string;
  /** Always from getCurrentDealer(). */
  dealer_id:         string;
  dimension:         GrowthDimension;
  severity:          GrowthInsightSeverity;
  title:             string;
  /** null until Phase 11I+ — AI generates this. */
  description:       string | null;
  /** KPI IDs that contributed to this insight. */
  source_metrics:    GrowthMetricId[];
  timeframe:         GrowthTimeframe;
  /** True when this insight was generated by an AI agent. */
  ai_generated:      boolean;
  /** null until Phase 11I+. */
  ai_agent_id:       AIAgentId | null;
  created_at:        string;
  /** True when the dealer has acknowledged this insight. */
  acknowledged:      boolean;
  execution_deferred:true;
}

// ─── GrowthOpportunity ────────────────────────────────────────────────────────

/**
 * GrowthOpportunityCategory — the business area an opportunity belongs to.
 */
export type GrowthOpportunityCategory =
  | "upsell"              // Offer additional services to existing customers
  | "cross_sell"          // Recommend complementary products or services
  | "win_back"            // Re-engage lapsed customers
  | "referral"            // Encourage word-of-mouth from satisfied customers
  | "seasonal"            // Time-sensitive demand opportunity
  | "capacity"            // Under-utilized time slots or staff capacity
  | "product_bundling"    // Bundle products with service for higher AOV
  | "maintenance"         // Convert one-time customers to maintenance plans
  | "ai_automation";      // Automate a manual process with AI (Phase 11I+)

/**
 * GrowthOpportunity — a specific, actionable opportunity to grow the business.
 * More concrete than a GrowthInsight — includes effort, impact, and next action.
 */
export interface GrowthOpportunity {
  id:                   string;
  /** Always from getCurrentDealer(). */
  dealer_id:            string;
  category:             GrowthOpportunityCategory;
  dimension:            GrowthDimension;
  title:                string;
  /** null until Phase 11I+ — AI generates this. */
  description:          string | null;
  /** Estimated revenue impact (JPY). null when unquantifiable. */
  estimated_impact_jpy: number | null;
  effort:               "low" | "medium" | "high";
  /** Timeframe in which the opportunity expires or loses relevance. */
  urgency:              "immediate" | "this_week" | "this_month" | "long_term";
  /** Which platform subsystems are needed to act on this opportunity. */
  required_features:    AppFeature[];
  /** Customer IDs relevant to this opportunity (e.g., win-back list). */
  customer_ids:         string[];
  created_at:           string;
  expires_at:           string | null;
  status:               "open" | "in_progress" | "completed" | "dismissed";
  execution_deferred:   true;
}

// ─── GrowthRecommendation ─────────────────────────────────────────────────────

/**
 * GrowthRecommendationCategory — the type of action recommended.
 * Full definitions in recommendation-model.ts.
 */
export type GrowthRecommendationCategory =
  | "revenue_growth"
  | "customer_retention"
  | "maintenance_reminders"
  | "marketing_opportunities"
  | "review_improvement"
  | "inventory_optimization"
  | "staff_productivity"
  | "service_mix_optimization"
  | "seasonal_campaigns";

/**
 * GrowthRecommendation — a specific, prioritized action the dealer should take.
 *
 * Recommendations are the primary output of the growth_agent (Phase 11I+).
 * In Sprint 11H they define the structure without AI-generated content.
 */
export interface GrowthRecommendation {
  id:                  string;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  category:            GrowthRecommendationCategory;
  dimension:           GrowthDimension;
  priority:            1 | 2 | 3 | 4 | 5;   // 1 = highest priority
  title:               string;
  /** null until Phase 11I+ — AI generates this. */
  rationale:           string | null;
  /** Concrete actions to take. null until Phase 11I+. */
  action_steps:        string[] | null;
  /** Linked opportunity, if this recommendation comes from one. */
  opportunity_id:      string | null;
  /** Source insights that triggered this recommendation. */
  insight_ids:         string[];
  source_metrics:      GrowthMetricId[];
  ai_agent_id:         AIAgentId | null;
  /** Estimated effort in hours. null when unquantifiable. */
  estimated_effort_h:  number | null;
  /** Estimated revenue impact (JPY). null when unquantifiable. */
  estimated_impact_jpy:number | null;
  created_at:          string;
  /** null = no expiry. */
  expires_at:          string | null;
  status:              "pending" | "accepted" | "rejected" | "completed";
  execution_deferred:  true;
}

// ─── GrowthReport ─────────────────────────────────────────────────────────────

/**
 * GrowthReportType — the format and audience of a growth report.
 */
export type GrowthReportType =
  | "monthly_summary"    // Full monthly business review
  | "weekly_insights"    // Lightweight weekly digest
  | "quarterly_review"   // Quarterly trend analysis
  | "kpi_snapshot"       // Current KPI values only — no AI narrative
  | "ai_report";         // Full AI-generated report with recommendations (Phase 11I+)

/**
 * GrowthReport — a packaged collection of insights, metrics, and recommendations.
 *
 * Reports are computed on demand or on a schedule (monthly/weekly).
 * AI narrative and deep recommendations are deferred to Phase 11I+.
 */
export interface GrowthReport {
  id:                  string;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  report_type:         GrowthReportType;
  timeframe:           GrowthTimeframe;
  period_start:        string;    // ISO 8601 date
  period_end:          string;    // ISO 8601 date
  score:               GrowthScore;
  metrics:             GrowthMetric[];
  trends:              GrowthTrend[];
  insights:            GrowthInsight[];
  recommendations:     GrowthRecommendation[];
  opportunities:       GrowthOpportunity[];
  /** AI-generated executive summary. null until Phase 11I+. */
  executive_summary:   string | null;
  generated_at:        string;
  /** True when the report is based on incomplete data. */
  is_partial:          boolean;
  execution_deferred:  true;
}

// ─── GrowthDashboard ──────────────────────────────────────────────────────────

/**
 * GrowthDashboardType — which user role this dashboard is for.
 * Full definitions in dashboard-compat.ts.
 */
export type GrowthDashboardType =
  | "executive"       // Owner/executive view — high-level KPIs and score
  | "dealer"          // Dealer operational view — daily/weekly metrics
  | "staff"           // Staff operational view — task lists and completions
  | "ai_summary"      // AI-curated panel — insights and recommendations
  | "monthly_report"  // Month-end report view
  | "weekly_insights";// Lightweight weekly view

/**
 * GrowthDashboard — the data contract for a dashboard panel.
 *
 * Defines what data each dashboard type needs — not the UI rendering.
 * UI components will consume this in Phase 11I+.
 */
export interface GrowthDashboard {
  type:                GrowthDashboardType;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  score:               GrowthScore | null;
  pinned_metrics:      GrowthMetric[];
  featured_insight:    GrowthInsight | null;
  top_recommendations: GrowthRecommendation[];
  top_opportunities:   GrowthOpportunity[];
  /** true when AI summary is available in this dashboard type. */
  shows_ai_summary:    boolean;
  /** null until Phase 11I+ — growth_agent generates this. */
  ai_narrative:        string | null;
  generated_at:        string;
  execution_deferred:  true;
}
