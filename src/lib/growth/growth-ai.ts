// DealerOS — AI Growth Platform: AI Integration (Sprint 11H Phase F)
//
// Provider-agnostic AI integration layer for the Growth Platform.
//
// Architecture principles:
//   - Growth Platform never couples to a specific AI provider
//   - All AI calls go through the AI Gateway (checkAiGatewayReady, createAgentContext)
//   - The platform declares WHAT it needs (agent, task, dimension, timeframe)
//   - Provider resolution is the AI Gateway's sole responsibility
//   - No direct imports from provider SDKs (openai, anthropic, etc.)
//
// Three agents may contribute to the Growth Platform:
//   growth_agent     — Primary growth analysis and recommendation generation
//   marketing_agent  — Campaign performance data and marketing recommendations
//   reputation_agent — Review and reputation signal data
//
// All agents exchange data only through typed interfaces defined here.
// There is no direct coupling between agent modules.
//
// AI execution is deferred in Sprint 11H:
//   GrowthAIExecutionPlan.execution_deferred = true (literal)
//   No real inference is triggered.
//   Plans describe WHAT WILL happen when the gateway is ready in Phase 11I+.
//
// Pure — no "use server", no external calls.

import type { AIAgentId }  from "@/lib/ai/agents/types";
import type { AITaskType } from "@/lib/ai/types";
import type {
  GrowthDimension,
  GrowthMetricId,
  GrowthDashboardType,
  GrowthTimeframe,
} from "./growth-types";

// ─── Agent task configuration ──────────────────────────────────────────────────

/**
 * GrowthAITaskConfig — a single AI task in the growth agent pipeline.
 *
 * provider: never hardcoded — resolved at runtime by the AI Gateway.
 */
export interface GrowthAITaskConfig {
  agent_id:            AIAgentId;
  task_type:           AITaskType;
  purpose:             string;
  language_preference: "ja" | "en";
  /** Data variables the AI task reads from the GrowthAIContext. */
  input_variables:     string[];
  /** Output variables the task produces for downstream use. */
  output_variables:    string[];
  /** True when this task must succeed for the pipeline to continue. */
  blocking:            boolean;
  /** True when the dealer must review the output before it is surfaced. */
  requires_review:     boolean;
}

// ─── Agent cross-feed interface ────────────────────────────────────────────────

/**
 * GrowthAgentCrossFeed — standardized data exchange between growth and other agents.
 *
 * Agents never call each other directly. They exchange data via the AI Gateway
 * using this typed feed contract. The gateway routes the feed to the correct agent.
 */
export interface GrowthAgentCrossFeed {
  source_agent_id:    AIAgentId;
  target_agent_id:    AIAgentId;
  dimension:          GrowthDimension;
  /** Structured payload — serializable, no class instances. */
  payload:            Record<string, unknown>;
  feed_version:       "1.0";
  created_at:         string;
  /** True when this feed requires gateway forwarding (cross-agent dispatch). */
  requires_gateway:   true;
}

// ─── Context for AI execution ──────────────────────────────────────────────────

/**
 * GrowthAIContext — the typed input context for any growth AI task.
 *
 * Built server-side before AI execution is attempted.
 * dealer_id is always from getCurrentDealer() — never from client input.
 */
export interface GrowthAIContext {
  /** Always from getCurrentDealer(). */
  dealer_id:    string;
  timeframe:    GrowthTimeframe;
  dimensions:   GrowthDimension[];
  kpi_ids:      GrowthMetricId[];
  dashboard_type: GrowthDashboardType | null;
  /** Serialized metric values for AI context — no raw DB rows. */
  metric_snapshot: Record<GrowthMetricId, number | null>;
  prepared_at:  string;
}

// ─── AI execution plan ─────────────────────────────────────────────────────────

/**
 * GrowthAIExecutionPlan — the deferred AI execution plan for a growth analysis run.
 *
 * execution_deferred: true — literal type, always set in Sprint 11H.
 * AI execution requires Phase 11I+: AI Gateway wired to growth data layer.
 */
export interface GrowthAIExecutionPlan {
  workflow:            "growth_analysis" | "monthly_report" | "recommendation_generation";
  context:             GrowthAIContext;
  tasks:               GrowthAITaskConfig[];
  cross_feeds:         GrowthAgentCrossFeed[];
  /** Always true — no AI inference in Sprint 11H */
  execution_deferred:  true;
  deferred_reason:     string;
  prepared_at:         string;
}

// ─── AI integration registry ───────────────────────────────────────────────────

/**
 * GrowthAIWorkflowSpec — full specification for an AI workflow in the Growth Platform.
 */
export interface GrowthAIWorkflowSpec {
  workflow:         GrowthAIExecutionPlan["workflow"];
  label:            string;
  description:      string;
  primary_agent:    AIAgentId;
  contributing_agents: AIAgentId[];
  tasks:            GrowthAITaskConfig[];
  required_features:string[];
  deferred:         boolean;
  deferred_since:   string;
}

/**
 * GROWTH_AI_WORKFLOW_REGISTRY — all AI workflows in the Growth Platform.
 */
export const GROWTH_AI_WORKFLOW_REGISTRY: Record<
  GrowthAIExecutionPlan["workflow"],
  GrowthAIWorkflowSpec
> = {

  growth_analysis: {
    workflow:         "growth_analysis",
    label:            "Growth Analysis",
    description:      "growth_agent analyzes all KPI dimensions and produces insights and a growth score",
    primary_agent:    "growth_agent",
    contributing_agents: ["marketing_agent", "reputation_agent"],
    tasks:            [
      {
        agent_id:            "growth_agent",
        task_type:           "reputation_analysis",
        purpose:             "Analyze cross-dimensional KPI data and identify growth patterns",
        language_preference: "ja",
        input_variables:     [
          "metric_snapshot",
          "timeframe",
          "customer_retention_rate",
          "average_repair_order_value",
          "monthly_growth_score",
        ],
        output_variables:    ["insights", "growth_score", "trend_analysis"],
        blocking:            true,
        requires_review:     false,
      },
    ],
    required_features: ["ai_growth"],
    deferred:          true,
    deferred_since:    "Sprint 11H",
  },

  recommendation_generation: {
    workflow:         "recommendation_generation",
    label:            "Recommendation Generation",
    description:      "growth_agent generates prioritized recommendations based on insights and KPI gaps",
    primary_agent:    "growth_agent",
    contributing_agents: ["marketing_agent"],
    tasks:            [
      {
        agent_id:            "growth_agent",
        task_type:           "content_writing",
        purpose:             "Generate prioritized, actionable dealer recommendations in Japanese",
        language_preference: "ja",
        input_variables:     [
          "insights",
          "growth_score",
          "kpi_gaps",        // KPIs more than threshold below benchmark
          "dealer_profile",  // Dealer plan and enabled features
        ],
        output_variables:    ["recommendations"],
        blocking:            true,
        requires_review:     false,
      },
      {
        agent_id:            "marketing_agent",
        task_type:           "content_writing",
        purpose:             "Enrich marketing-dimension recommendations with campaign opportunities",
        language_preference: "ja",
        input_variables:     [
          "campaign_history",
          "line_engagement_metrics",
        ],
        output_variables:    ["marketing_recommendations"],
        blocking:            false,
        requires_review:     false,
      },
    ],
    required_features: ["ai_growth"],
    deferred:          true,
    deferred_since:    "Sprint 11H",
  },

  monthly_report: {
    workflow:         "monthly_report",
    label:            "Monthly AI Report",
    description:      "Full monthly business review: all KPIs, trends, AI narrative, and complete recommendation set",
    primary_agent:    "growth_agent",
    contributing_agents: ["marketing_agent", "reputation_agent"],
    tasks:            [
      {
        agent_id:            "growth_agent",
        task_type:           "reputation_analysis",
        purpose:             "Produce the full month-end growth analysis across all dimensions",
        language_preference: "ja",
        input_variables:     [
          "all_metric_snapshots",
          "trend_data",
          "previous_month_score",
        ],
        output_variables:    ["full_analysis", "growth_score", "all_insights"],
        blocking:            true,
        requires_review:     false,
      },
      {
        agent_id:            "growth_agent",
        task_type:           "content_writing",
        purpose:             "Write the executive summary for the monthly report in Japanese",
        language_preference: "ja",
        input_variables:     ["full_analysis", "growth_score", "top_recommendations"],
        output_variables:    ["executive_summary"],
        blocking:            false,
        requires_review:     true,   // Dealer should review AI-generated executive summary
      },
    ],
    required_features: ["ai_growth"],
    deferred:          true,
    deferred_since:    "Sprint 11H",
  },

} as const;

// ─── Cross-feed builders ───────────────────────────────────────────────────────

/**
 * buildMarketingAgentFeed — creates a cross-feed from marketing_agent to growth_agent.
 * marketing_agent calls this when a campaign performance update is available.
 *
 * dealer_id must come from getCurrentDealer().
 */
export function buildMarketingAgentFeed(
  dealer_id: string,
  payload:   Record<string, unknown>,
  now:       string,
): GrowthAgentCrossFeed {
  return {
    source_agent_id: "marketing_agent",
    target_agent_id: "growth_agent",
    dimension:       "marketing",
    payload,
    feed_version:    "1.0",
    created_at:      now,
    requires_gateway:true,
  };
}

/**
 * buildReputationAgentFeed — creates a cross-feed from reputation_agent to growth_agent.
 * reputation_agent calls this when new review signals are available.
 *
 * dealer_id must come from getCurrentDealer().
 */
export function buildReputationAgentFeed(
  dealer_id: string,
  payload:   Record<string, unknown>,
  now:       string,
): GrowthAgentCrossFeed {
  return {
    source_agent_id: "reputation_agent",
    target_agent_id: "growth_agent",
    dimension:       "reputation",
    payload,
    feed_version:    "1.0",
    created_at:      now,
    requires_gateway:true,
  };
}

// ─── Execution plan builder ────────────────────────────────────────────────────

/**
 * buildGrowthAIExecutionPlan — creates a deferred AI execution plan.
 *
 * Returns a fully typed plan with execution_deferred: true.
 * No AI inference is triggered. dealer_id from getCurrentDealer().
 */
export function buildGrowthAIExecutionPlan(
  workflow:  GrowthAIExecutionPlan["workflow"],
  context:   GrowthAIContext,
): GrowthAIExecutionPlan {
  const spec = GROWTH_AI_WORKFLOW_REGISTRY[workflow];
  return {
    workflow,
    context,
    tasks:              spec.tasks,
    cross_feeds:        [],
    execution_deferred: true,
    deferred_reason:    "AI Growth Platform execution requires Phase 11I+ — growth_agent inference pipeline not yet wired",
    prepared_at:        context.prepared_at,
  };
}

/** Returns the AI workflow spec for a workflow type. Never null. */
export function getGrowthAIWorkflowSpec(
  workflow: GrowthAIExecutionPlan["workflow"],
): GrowthAIWorkflowSpec {
  return GROWTH_AI_WORKFLOW_REGISTRY[workflow];
}
