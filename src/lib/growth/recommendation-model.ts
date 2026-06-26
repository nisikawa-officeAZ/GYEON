// DealerOS — AI Growth Platform: Recommendation Model (Sprint 11H Phase D)
//
// Canonical recommendation structures for the AI Growth Platform.
//
// Recommendations are the primary output of the growth_agent (Phase 11I+).
// In Sprint 11H, this module defines:
//   - GrowthRecommendationTemplate: a parameterized structure for each category
//   - RECOMMENDATION_TEMPLATE_REGISTRY: all 9 category templates
//   - buildRecommendationShell(): creates a typed shell for deferred AI filling
//
// 9 recommendation categories:
//   1. revenue_growth         — Increase RO value, upsell services
//   2. customer_retention     — Improve retention rate, reduce churn
//   3. maintenance_reminders  — Convert coating customers to maintenance plans
//   4. marketing_opportunities — Campaign timing, channel optimization
//   5. review_improvement     — Increase review volume and response rate
//   6. inventory_optimization — Coating and product stock level advice
//   7. staff_productivity     — Work order throughput, scheduling gaps
//   8. service_mix_optimization — Rebalance service categories for higher margin
//   9. seasonal_campaigns     — Capitalize on seasonal demand peaks
//
// No AI execution in Sprint 11H. All content fields are null until Phase 11I+.
//
// Pure — no "use server", no async, no DB calls.

import type {
  GrowthRecommendationCategory,
  GrowthDimension,
  GrowthMetricId,
  GrowthRecommendation,
} from "./growth-types";
import type { AppFeature } from "@/lib/plans/plan-types";
import type { AIAgentId }  from "@/lib/ai/agents/types";

// ─── Template ─────────────────────────────────────────────────────────────────

/**
 * GrowthRecommendationTemplate — parameterized pattern for a recommendation category.
 *
 * Templates define what a recommendation LOOKS LIKE and what data it needs.
 * The growth_agent fills in rationale and action_steps at runtime (Phase 11I+).
 */
export interface GrowthRecommendationTemplate {
  category:              GrowthRecommendationCategory;
  label:                 string;
  description:           string;
  dimension:             GrowthDimension;
  /** KPIs that typically trigger this recommendation category. */
  trigger_kpis:          GrowthMetricId[];
  /** KPI threshold (as percentage change from benchmark) that suggests this recommendation. */
  trigger_threshold:     number;    // e.g. 0.1 = KPI is 10% below benchmark
  /** Canonical action step templates. growth_agent personalizes these. */
  action_step_templates: string[];
  /** App features required to execute the recommended actions. */
  required_features:     AppFeature[];
  /** AI agents that produce or refine this recommendation type. */
  ai_agents:             AIAgentId[];
  default_priority:      1 | 2 | 3 | 4 | 5;
  effort_estimate:       "low" | "medium" | "high";
  /** Expected lift in relevant KPIs. e.g. "+5% customer_retention_rate" */
  expected_lift:         string;
  ai_required:           boolean;
}

// ─── RECOMMENDATION_TEMPLATE_REGISTRY ─────────────────────────────────────────

/**
 * RECOMMENDATION_TEMPLATE_REGISTRY — all 9 recommendation category templates.
 */
export const RECOMMENDATION_TEMPLATE_REGISTRY: Record<
  GrowthRecommendationCategory,
  GrowthRecommendationTemplate
> = {

  revenue_growth: {
    category:              "revenue_growth",
    label:                 "Revenue Growth",
    description:           "Increase average repair order value or total monthly revenue",
    dimension:             "revenue",
    trigger_kpis:          ["average_repair_order_value", "average_coating_revenue", "monthly_growth_score"],
    trigger_threshold:     0.10,
    action_step_templates: [
      "Review your current service menu pricing against market benchmarks",
      "Identify upsell opportunities: customers with basic packages may be ready for premium coatings",
      "Add a complementary product bundle (e.g., coating maintenance kit) to your top service tiers",
      "Review your estimate approval rate — low approval may signal pricing friction",
    ],
    required_features:     ["estimates", "work_orders", "payments"],
    ai_agents:             ["growth_agent", "marketing_agent"],
    default_priority:      1,
    effort_estimate:       "medium",
    expected_lift:         "+8–15% average repair order value over 90 days",
    ai_required:           true,
  },

  customer_retention: {
    category:              "customer_retention",
    label:                 "Customer Retention",
    description:           "Improve the percentage of customers who return for repeat visits",
    dimension:             "customer_retention",
    trigger_kpis:          ["customer_retention_rate", "repeat_visit_rate", "customer_lifetime_value"],
    trigger_threshold:     0.08,
    action_step_templates: [
      "Send a follow-up LINE message 30 days after work completion with a maintenance reminder",
      "Offer a loyalty discount to customers who haven't returned in 6+ months",
      "Set up the maintenance reminder workflow in the LINE Automation Platform",
      "Review customers whose vehicles are past their recommended maintenance interval",
    ],
    required_features:     ["line", "maintenance", "customers"],
    ai_agents:             ["growth_agent", "line_agent"],
    default_priority:      1,
    effort_estimate:       "medium",
    expected_lift:         "+5–12% retention rate over 6 months",
    ai_required:           false,
  },

  maintenance_reminders: {
    category:              "maintenance_reminders",
    label:                 "Maintenance Reminders",
    description:           "Convert one-time coating customers to recurring maintenance plan customers",
    dimension:             "customer_retention",
    trigger_kpis:          ["maintenance_conversion_rate", "repeat_visit_rate"],
    trigger_threshold:     0.15,
    action_step_templates: [
      "Identify all coating customers who have not booked a maintenance service",
      "Activate the maintenance_reminder workflow in the LINE Automation Platform",
      "Create a seasonal maintenance campaign for spring and autumn (peak coating protection months)",
      "Add maintenance schedule documentation to the work order completion report",
    ],
    required_features:     ["maintenance", "line", "work_orders"],
    ai_agents:             ["growth_agent", "line_agent"],
    default_priority:      2,
    effort_estimate:       "low",
    expected_lift:         "+10–20% maintenance conversion rate over 90 days",
    ai_required:           false,
  },

  marketing_opportunities: {
    category:              "marketing_opportunities",
    label:                 "Marketing Opportunities",
    description:           "Capitalize on campaign timing, channel performance, and customer segment opportunities",
    dimension:             "marketing",
    trigger_kpis:          ["campaign_conversion_rate", "line_engagement_rate", "monthly_growth_score"],
    trigger_threshold:     0.12,
    action_step_templates: [
      "Review campaign performance by channel — shift budget toward highest-converting channels",
      "Segment your customer list by coating type for more targeted messaging",
      "Schedule a before/after showcase campaign timed to seasonal demand peaks",
      "Activate LINE campaign delivery workflow for dormant customers (6+ months inactive)",
    ],
    required_features:     ["line", "ai_marketing"],
    ai_agents:             ["marketing_agent", "growth_agent"],
    default_priority:      2,
    effort_estimate:       "medium",
    expected_lift:         "+3–8% campaign conversion rate over 60 days",
    ai_required:           true,
  },

  review_improvement: {
    category:              "review_improvement",
    label:                 "Review Improvement",
    description:           "Increase review volume, improve average rating, and maintain timely response rate",
    dimension:             "reputation",
    trigger_kpis:          ["review_conversion_rate", "review_response_rate"],
    trigger_threshold:     0.10,
    action_step_templates: [
      "Activate the review_request workflow in the LINE Automation Platform for completed work orders",
      "Respond to all existing reviews within 48 hours — use the AI review response assistant",
      "Review your Google Business Profile completeness score",
      "Add a review link QR code to your invoice PDF and completion report",
    ],
    required_features:     ["ai_reputation", "line"],
    ai_agents:             ["reputation_agent", "growth_agent"],
    default_priority:      2,
    effort_estimate:       "low",
    expected_lift:         "+15–30% review conversion rate over 90 days",
    ai_required:           false,
  },

  inventory_optimization: {
    category:              "inventory_optimization",
    label:                 "Inventory Optimization",
    description:           "Align product stock levels with seasonal demand and service mix patterns",
    dimension:             "inventory",
    trigger_kpis:          ["average_coating_revenue", "work_order_completion_rate"],
    trigger_threshold:     0.08,
    action_step_templates: [
      "Review which GYEON products appear most in recent work orders",
      "Identify products with high estimate inclusion but low work order completion — possible stock friction",
      "Pre-order peak season products (Q4 car care season: October–December in Japan)",
      "Set minimum stock level alerts for your top 5 coating products",
    ],
    required_features:     ["products", "work_orders"],
    ai_agents:             ["growth_agent"],
    default_priority:      3,
    effort_estimate:       "low",
    expected_lift:         "Reduce stockout delays; maintain work order completion rate",
    ai_required:           false,
  },

  staff_productivity: {
    category:              "staff_productivity",
    label:                 "Staff Productivity",
    description:           "Improve work order throughput, reduce scheduling gaps, and optimize staff time",
    dimension:             "operations",
    trigger_kpis:          ["work_order_completion_rate", "average_repair_order_value"],
    trigger_threshold:     0.08,
    action_step_templates: [
      "Review work order cycle times to identify bottlenecks",
      "Identify calendar gaps — low-density days that could absorb one more booking",
      "Compare staff output per work order to find training opportunities",
      "Set work order completion targets and track weekly vs previous period",
    ],
    required_features:     ["work_orders", "calendar"],
    ai_agents:             ["growth_agent"],
    default_priority:      3,
    effort_estimate:       "medium",
    expected_lift:         "+5–10% work order completion rate",
    ai_required:           false,
  },

  service_mix_optimization: {
    category:              "service_mix_optimization",
    label:                 "Service Mix Optimization",
    description:           "Rebalance the service category mix to improve gross margin and customer satisfaction",
    dimension:             "revenue",
    trigger_kpis:          ["average_coating_revenue", "average_repair_order_value", "estimate_approval_rate"],
    trigger_threshold:     0.12,
    action_step_templates: [
      "Identify your top 3 services by revenue contribution and margin",
      "Assess which services have the lowest estimate approval rate — price or positioning issue?",
      "Consider bundling low-margin services with high-margin ones",
      "Review if your maintenance tier pricing aligns with coating warranty periods",
    ],
    required_features:     ["estimates", "work_orders", "payments"],
    ai_agents:             ["growth_agent", "marketing_agent"],
    default_priority:      2,
    effort_estimate:       "medium",
    expected_lift:         "+5–12% gross margin improvement over 6 months",
    ai_required:           true,
  },

  seasonal_campaigns: {
    category:              "seasonal_campaigns",
    label:                 "Seasonal Campaigns",
    description:           "Capitalize on predictable seasonal demand peaks with timely marketing campaigns",
    dimension:             "seasonal",
    trigger_kpis:          ["campaign_conversion_rate", "new_customer_rate", "monthly_growth_score"],
    trigger_threshold:     0.05,
    action_step_templates: [
      "Plan a spring campaign (March–April) for pre-rainy-season paint protection",
      "Plan an autumn campaign (October–November) for year-end coating before winter",
      "Schedule a new year campaign (January) targeting car owners post-winter inspection",
      "Set up LINE campaign delivery workflow 3 weeks before each seasonal peak",
    ],
    required_features:     ["line", "ai_marketing"],
    ai_agents:             ["marketing_agent", "growth_agent"],
    default_priority:      2,
    effort_estimate:       "medium",
    expected_lift:         "+8–20% new customer acquisition during campaign periods",
    ai_required:           true,
  },
} as const;

// ─── Recommendation shell builder ──────────────────────────────────────────────

/**
 * buildRecommendationShell — creates a GrowthRecommendation with null content fields.
 *
 * Used by the growth engine to produce a typed shell before AI content is available.
 * dealer_id must come from getCurrentDealer() in the calling server action.
 *
 * All shell recommendations have execution_deferred: true in Sprint 11H.
 */
export function buildRecommendationShell(
  category:  GrowthRecommendationCategory,
  dealer_id: string,
  id:        string,
  now:       string,
): GrowthRecommendation {
  const template = RECOMMENDATION_TEMPLATE_REGISTRY[category];
  return {
    id,
    dealer_id,
    category,
    dimension:           template.dimension,
    priority:            template.default_priority,
    title:               template.label,
    rationale:           null,
    action_steps:        null,
    opportunity_id:      null,
    insight_ids:         [],
    source_metrics:      template.trigger_kpis,
    ai_agent_id:         template.ai_agents[0] ?? null,
    estimated_effort_h:  null,
    estimated_impact_jpy:null,
    created_at:          now,
    expires_at:          null,
    status:              "pending",
    execution_deferred:  true,
  };
}

/** Returns the template for a recommendation category. Never null. */
export function getRecommendationTemplate(
  category: GrowthRecommendationCategory,
): GrowthRecommendationTemplate {
  return RECOMMENDATION_TEMPLATE_REGISTRY[category];
}

/** Returns all categories that require AI to produce recommendations. */
export function getAIRequiredCategories(): GrowthRecommendationCategory[] {
  return (Object.values(RECOMMENDATION_TEMPLATE_REGISTRY) as GrowthRecommendationTemplate[])
    .filter((t) => t.ai_required)
    .map((t) => t.category);
}
