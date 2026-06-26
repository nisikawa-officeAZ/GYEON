// DealerOS — AI Orchestration Engine: Workflow Registry (Sprint 11J Phase C)
//
// Canonical registry of all multi-agent orchestration workflows.
//
// Workflows define the full execution chain from trigger event to completion.
// They reference coordination patterns and declare which CE events or schedules
// activate them.
//
// Design rules:
//   - Workflows never execute in Sprint 11J — all execution_deferred: true
//   - Workflow specs describe WHAT WILL happen in Sprint 11K+
//   - dealer_id is resolved at runtime by the server-side plan builder
//   - No direct provider calls — all agent invocations via AI Gateway
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { EngagementEventType }        from "@/lib/customer-engagement/events";
import type { AppFeature }                 from "@/lib/plans/plan-types";
import type { AIAgentId }                  from "@/lib/ai/agents/types";
import type {
  AIOrchestrationWorkflowId,
  AIExecutionStep,
  AIExecutionPolicy,
} from "./orchestrator-types";
import {
  DEFAULT_EXECUTION_POLICY,
  buildExecutionStep,
} from "./orchestrator-types";

// ─── Workflow trigger ─────────────────────────────────────────────────────────

export type AIWorkflowTriggerType =
  | "ce_event"      // Triggered by a Customer Engagement event
  | "scheduled"     // Triggered on a timer (cron-like)
  | "manual"        // Triggered manually by the dealer
  | "ai_trigger";   // Triggered by another agent's output (Phase 11L+)

export interface AIWorkflowTrigger {
  type:                AIWorkflowTriggerType;
  /** CE event type that fires this workflow. Set when type === "ce_event". */
  ce_event?:           EngagementEventType;
  /** Human-readable schedule description. Set when type === "scheduled". */
  schedule_label?:     string;
  /** Minimum hours between runs for the same dealer. 0 = no cooldown. */
  cooldown_hours:      number;
}

// ─── Workflow specification ───────────────────────────────────────────────────

export type AIOrchestrationWorkflowStatus =
  | "planned"    // Architecture defined, not yet executable
  | "active"     // Fully wired and executable (Sprint 11K+)
  | "deprecated" // No longer used
  | "disabled";  // Defined but turned off for this environment

/**
 * AIOrchestrationWorkflowSpec — full specification for one orchestration workflow.
 *
 * The spec describes trigger conditions, step templates, agent involvement,
 * required plan features, and execution policy overrides.
 */
export interface AIOrchestrationWorkflowSpec {
  workflow_id:         AIOrchestrationWorkflowId;
  label:               string;
  description:         string;
  triggers:            AIWorkflowTrigger[];
  /** Agents that participate in this workflow, in rough execution order. */
  agents_involved:     AIAgentId[];
  /** AppFeature gates — ALL must be active for the dealer to run this workflow. */
  required_features:   AppFeature[];
  /** Step templates for this workflow. Instantiated at plan-build time. */
  step_templates:      AIExecutionStep[];
  /** Policy overrides for this workflow. Merged over DEFAULT_EXECUTION_POLICY. */
  policy_overrides:    Partial<AIExecutionPolicy>;
  /** Coordination pattern IDs used. Informational — step_templates are canonical. */
  pattern_ids:         string[];
  status:              AIOrchestrationWorkflowStatus;
  /** Sprint when this workflow becomes executable. */
  available_from:      string;
  execution_deferred:  true;
}

// ─── Workflow registry ────────────────────────────────────────────────────────

export const ORCHESTRATION_WORKFLOW_REGISTRY: AIOrchestrationWorkflowSpec[] = [

  // ── Work → Social Content ────────────────────────────────────────────────────
  {
    workflow_id:   "work_to_social_content",
    label:         "Work Order → Social Content",
    description:   "After work completion, orchestrates the full content automation pipeline: storyboard curation, caption writing, SEO/reputation enrichment, dealer approval, and social media dispatch.",
    triggers: [
      {
        type:          "ce_event",
        ce_event:      "WORK_COMPLETED",
        cooldown_hours: 0,
      },
    ],
    agents_involved:   ["marketing_agent", "seo_agent", "reputation_agent", "growth_agent"],
    required_features: ["ai_marketing", "ai_gateway"],
    step_templates: [
      buildExecutionStep("wc_01_storyboard", "marketing_agent", "image_analysis", "Storyboard planning", {
        depends_on:            [],
        is_parallel:           false,
        input_keys:            ["approved_media_ids", "work_order_id", "service_summary"],
        output_keys:           ["storyboard_scenes"],
      }),
      buildExecutionStep("wc_02_caption", "marketing_agent", "content_writing", "Caption drafting", {
        depends_on:            ["wc_01_storyboard"],
        requires_dealer_approval: true,
        is_customer_facing:    true,
        input_keys:            ["storyboard_scenes", "target_channels"],
        output_keys:           ["base_caption", "channel_variants"],
      }),
      buildExecutionStep("wc_03_seo", "seo_agent", "keyword_extraction", "SEO enrichment", {
        depends_on:            ["wc_02_caption"],
        is_parallel:           true,
        is_optional:           true,
        input_keys:            ["base_caption"],
        output_keys:           ["seo_keywords"],
      }),
      buildExecutionStep("wc_04_compliance", "reputation_agent", "reputation_analysis", "Compliance check", {
        depends_on:            ["wc_02_caption"],
        is_parallel:           true,
        is_optional:           true,
        input_keys:            ["base_caption"],
        output_keys:           ["compliance_flags"],
      }),
      buildExecutionStep("wc_05_growth_signal", "growth_agent", "reputation_analysis", "Publish-time signal", {
        depends_on:            ["wc_03_seo", "wc_04_compliance"],
        is_optional:           true,
        input_keys:            ["dealer_id"],
        output_keys:           ["optimal_publish_time"],
      }),
    ],
    policy_overrides: {
      pause_on_customer_facing_output: true,
      max_parallel_steps:              2,
    },
    pattern_ids:        ["work_order_content_chain"],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

  // ── Work → Review Request ────────────────────────────────────────────────────
  {
    workflow_id:   "work_to_review_request",
    label:         "Work Order → LINE Review Request",
    description:   "After work completion and consent verification, review_agent generates a personalized LINE review request that line_agent formats for dispatch.",
    triggers: [
      {
        type:           "ce_event",
        ce_event:       "WORK_COMPLETED",
        cooldown_hours: 168, // 7 days — one review request per customer per week maximum
      },
    ],
    agents_involved:   ["review_agent", "line_agent"],
    required_features: ["ai_reputation", "line", "ai_gateway"],
    step_templates: [
      buildExecutionStep("rr_01_generate", "review_agent", "review_request_generation", "Review message generation", {
        depends_on:            [],
        requires_dealer_approval: true,
        is_customer_facing:    true,
        input_keys:            ["customer_name", "service_summary", "dealer_name"],
        output_keys:           ["review_request_message"],
      }),
      buildExecutionStep("rr_02_line_wrap", "line_agent", "review_request_generation", "LINE message formatting", {
        depends_on:            ["rr_01_generate"],
        is_customer_facing:    true,
        input_keys:            ["review_request_message", "line_user_id"],
        output_keys:           ["line_message_payload"],
      }),
    ],
    policy_overrides: {
      pause_on_customer_facing_output: true,
    },
    pattern_ids:        ["review_request_chain"],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

  // ── Work → Reputation Report ─────────────────────────────────────────────────
  {
    workflow_id:   "work_to_reputation_report",
    label:         "Work Order → Reputation Impact Report",
    description:   "After work completion, reputation_agent analyzes how the new service affects the dealer's overall reputation score and surfaces any content compliance concerns.",
    triggers: [
      {
        type:           "ce_event",
        ce_event:       "WORK_COMPLETED",
        cooldown_hours: 24,
      },
    ],
    agents_involved:   ["reputation_agent", "review_agent"],
    required_features: ["ai_reputation", "ai_gateway"],
    step_templates: [
      buildExecutionStep("wr_01_scan", "reputation_agent", "reputation_analysis", "Reputation scan", {
        depends_on:  [],
        input_keys:  ["dealer_id", "work_order_id"],
        output_keys: ["reputation_score", "trend_direction"],
      }),
      buildExecutionStep("wr_02_draft", "review_agent", "review_response_drafting", "Response draft", {
        depends_on:            ["wr_01_scan"],
        is_optional:           true,
        requires_dealer_approval: true,
        is_customer_facing:    true,
        input_keys:            ["reputation_score", "low_rated_reviews"],
        output_keys:           ["response_drafts"],
      }),
    ],
    policy_overrides: {},
    pattern_ids:        ["reputation_analysis_chain"],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

  // ── Periodic Growth Analysis ─────────────────────────────────────────────────
  {
    workflow_id:   "periodic_growth_analysis",
    label:         "Scheduled Growth KPI Analysis",
    description:   "Weekly scheduled workflow: growth_agent analyzes all KPIs across subsystems, generates prioritized recommendations, and surfaces performance signals to marketing_agent.",
    triggers: [
      {
        type:           "scheduled",
        schedule_label: "Weekly — every Monday at 09:00 JST",
        cooldown_hours: 168,
      },
      {
        type:           "manual",
        cooldown_hours: 24,
      },
    ],
    agents_involved:   ["growth_agent", "marketing_agent"],
    required_features: ["ai_growth", "ai_gateway"],
    step_templates: [
      buildExecutionStep("ga_01_kpi", "growth_agent", "reputation_analysis", "KPI analysis", {
        depends_on:  [],
        input_keys:  ["dealer_id", "analysis_period"],
        output_keys: ["kpi_scores", "growth_opportunities"],
      }),
      buildExecutionStep("ga_02_content_signal", "marketing_agent", "keyword_extraction", "Content strategy signal", {
        depends_on:  ["ga_01_kpi"],
        is_optional: true,
        input_keys:  ["growth_opportunities"],
        output_keys: ["content_strategy_hints"],
      }),
    ],
    policy_overrides: {
      pause_on_customer_facing_output: false,
    },
    pattern_ids:        ["growth_analysis_chain"],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

  // ── Periodic Reputation Scan ─────────────────────────────────────────────────
  {
    workflow_id:   "periodic_reputation_scan",
    label:         "Scheduled Reputation Scan",
    description:   "Weekly scheduled workflow: reputation_agent scans all recent reviews, review_agent drafts responses for negative reviews, marketing_agent conditionally suggests recovery content.",
    triggers: [
      {
        type:           "scheduled",
        schedule_label: "Weekly — every Wednesday at 10:00 JST",
        cooldown_hours: 168,
      },
      {
        type:           "manual",
        cooldown_hours: 24,
      },
    ],
    agents_involved:   ["reputation_agent", "review_agent", "marketing_agent"],
    required_features: ["ai_reputation", "ai_gateway"],
    step_templates: [
      buildExecutionStep("rs_01_scan", "reputation_agent", "reputation_analysis", "Review scan", {
        depends_on:  [],
        input_keys:  ["dealer_id", "scan_period"],
        output_keys: ["reputation_score", "low_rated_reviews", "trend_direction"],
      }),
      buildExecutionStep("rs_02_response", "review_agent", "review_response_drafting", "Response drafting", {
        depends_on:            ["rs_01_scan"],
        is_optional:           true,
        requires_dealer_approval: true,
        is_customer_facing:    true,
        input_keys:            ["low_rated_reviews"],
        output_keys:           ["response_drafts"],
      }),
      buildExecutionStep("rs_03_recovery", "marketing_agent", "content_writing", "Recovery content (conditional)", {
        depends_on:  ["rs_01_scan"],
        is_optional: true,
        is_parallel: true,
        requires_dealer_approval: true,
        input_keys:  ["reputation_score", "trend_direction"],
        output_keys: ["recovery_content_suggestion"],
      }),
    ],
    policy_overrides: {
      pause_on_customer_facing_output: true,
    },
    pattern_ids:        ["reputation_analysis_chain"],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

  // ── LINE Workflow Execution ──────────────────────────────────────────────────
  {
    workflow_id:   "line_workflow_execution",
    label:         "LINE Automation Workflow Execution",
    description:   "Triggered by the LINE Automation Platform: line_agent generates personalized messages. Used for maintenance reminders, campaign delivery, and custom workflow triggers.",
    triggers: [
      {
        type:           "ce_event",
        ce_event:       "MAINTENANCE_DUE",
        cooldown_hours: 720, // 30 days — one maintenance reminder per month
      },
      {
        type:           "ce_event",
        ce_event:       "CAMPAIGN_SENT",
        cooldown_hours: 0,
      },
      {
        type:           "manual",
        cooldown_hours: 0,
      },
    ],
    agents_involved:   ["line_agent"],
    required_features: ["line", "ai_gateway"],
    step_templates: [
      buildExecutionStep("lw_01_generate", "line_agent", "content_writing", "LINE message generation", {
        depends_on:            [],
        requires_dealer_approval: true,
        is_customer_facing:    true,
        input_keys:            ["workflow_id", "customer_id", "trigger_payload"],
        output_keys:           ["line_message_payload"],
      }),
    ],
    policy_overrides: {
      pause_on_customer_facing_output: true,
    },
    pattern_ids:        [],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

  // ── Monthly Business Report ──────────────────────────────────────────────────
  {
    workflow_id:   "monthly_business_report",
    label:         "Monthly Business Intelligence Report",
    description:   "Monthly scheduled workflow: growth_agent, reputation_agent, and marketing_agent collaborate to produce a comprehensive business performance report.",
    triggers: [
      {
        type:           "scheduled",
        schedule_label: "Monthly — first business day of each month at 08:00 JST",
        cooldown_hours: 672, // 28 days
      },
      {
        type:           "manual",
        cooldown_hours: 24,
      },
    ],
    agents_involved:   ["growth_agent", "reputation_agent", "marketing_agent", "seo_agent"],
    required_features: ["ai_growth", "ai_reputation", "ai_marketing", "ai_gateway"],
    step_templates: [
      buildExecutionStep("mr_01_growth_kpi", "growth_agent", "reputation_analysis", "Growth KPI compilation", {
        depends_on:  [],
        is_parallel: true,
        input_keys:  ["dealer_id", "report_period"],
        output_keys: ["growth_kpi_data"],
      }),
      buildExecutionStep("mr_02_reputation_score", "reputation_agent", "reputation_analysis", "Reputation score compilation", {
        depends_on:  [],
        is_parallel: true,
        input_keys:  ["dealer_id", "report_period"],
        output_keys: ["reputation_data"],
      }),
      buildExecutionStep("mr_03_seo_analysis", "seo_agent", "keyword_extraction", "SEO performance analysis", {
        depends_on:  [],
        is_parallel: true,
        is_optional: true,
        input_keys:  ["dealer_id", "report_period"],
        output_keys: ["seo_performance_data"],
      }),
      buildExecutionStep("mr_04_narrative", "marketing_agent", "content_writing", "Report narrative", {
        depends_on:  ["mr_01_growth_kpi", "mr_02_reputation_score", "mr_03_seo_analysis"],
        input_keys:  ["growth_kpi_data", "reputation_data", "seo_performance_data"],
        output_keys: ["monthly_report_narrative"],
      }),
    ],
    policy_overrides: {
      max_parallel_steps:              3,
      pause_on_customer_facing_output: false,
    },
    pattern_ids:        ["growth_analysis_chain", "reputation_analysis_chain"],
    status:             "planned",
    available_from:     "Sprint 11L",
    execution_deferred: true,
  },

  // ── SEO Batch Optimization ───────────────────────────────────────────────────
  {
    workflow_id:   "seo_batch_optimization",
    label:         "Scheduled SEO / MEO Content Refresh",
    description:   "Bi-weekly: seo_agent refreshes keyword analysis for existing content, feeds updated signals to marketing_agent for content calendar adjustments.",
    triggers: [
      {
        type:           "scheduled",
        schedule_label: "Bi-weekly — every other Sunday at 03:00 JST",
        cooldown_hours: 336, // 14 days
      },
    ],
    agents_involved:   ["seo_agent", "marketing_agent"],
    required_features: ["ai_marketing", "ai_gateway"],
    step_templates: [
      buildExecutionStep("seo_01_refresh", "seo_agent", "keyword_extraction", "Keyword refresh", {
        depends_on:  [],
        input_keys:  ["dealer_id", "published_content_ids"],
        output_keys: ["refreshed_keywords", "keyword_trends"],
      }),
      buildExecutionStep("seo_02_signal", "marketing_agent", "keyword_extraction", "Content calendar signal", {
        depends_on:  ["seo_01_refresh"],
        is_optional: true,
        input_keys:  ["refreshed_keywords", "keyword_trends"],
        output_keys: ["content_calendar_hints"],
      }),
    ],
    policy_overrides: {
      pause_on_customer_facing_output: false,
    },
    pattern_ids:        [],
    status:             "planned",
    available_from:     "Sprint 11K",
    execution_deferred: true,
  },

];

// ─── Lookup functions ─────────────────────────────────────────────────────────

export function getWorkflowSpec(
  workflow_id: AIOrchestrationWorkflowId,
): AIOrchestrationWorkflowSpec | undefined {
  return ORCHESTRATION_WORKFLOW_REGISTRY.find((w) => w.workflow_id === workflow_id);
}

export function getWorkflowsForCEEvent(
  ce_event: EngagementEventType,
): AIOrchestrationWorkflowSpec[] {
  return ORCHESTRATION_WORKFLOW_REGISTRY.filter((w) =>
    w.triggers.some((t) => t.type === "ce_event" && t.ce_event === ce_event),
  );
}

export function getWorkflowsForFeature(
  feature: AppFeature,
): AIOrchestrationWorkflowSpec[] {
  return ORCHESTRATION_WORKFLOW_REGISTRY.filter((w) =>
    w.required_features.includes(feature),
  );
}

export function getWorkflowsForAgent(
  agent_id: AIAgentId,
): AIOrchestrationWorkflowSpec[] {
  return ORCHESTRATION_WORKFLOW_REGISTRY.filter((w) =>
    w.agents_involved.includes(agent_id),
  );
}

export function getScheduledWorkflows(): AIOrchestrationWorkflowSpec[] {
  return ORCHESTRATION_WORKFLOW_REGISTRY.filter((w) =>
    w.triggers.some((t) => t.type === "scheduled"),
  );
}

/**
 * resolveWorkflowPolicy — merges a workflow's policy overrides over the default.
 * Pure function — does not read from DB.
 */
export function resolveWorkflowPolicy(
  workflow_id: AIOrchestrationWorkflowId,
): AIExecutionPolicy {
  const spec = getWorkflowSpec(workflow_id);
  if (!spec) return DEFAULT_EXECUTION_POLICY;
  return { ...DEFAULT_EXECUTION_POLICY, ...spec.policy_overrides };
}
