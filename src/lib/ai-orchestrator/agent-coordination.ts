// DealerOS — AI Orchestration Engine: Agent Coordination (Sprint 11J Phase B)
//
// Describes how GYEON AI agents collaborate within orchestrated workflows.
//
// Key rules:
//   - Agents never import from each other's modules directly
//   - All inter-agent data exchange flows through the AI Gateway
//   - The orchestrator owns the coordination graph — agents are unaware of siblings
//   - video_agent coordination is planned for a future sprint
//     (requires video_agent to be added to AIAgentId in a future sprint)
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }                    from "@/lib/ai/agents/types";
import type { AITaskType }                   from "@/lib/ai/types";
import type { AIOrchestrationWorkflowId }    from "./orchestrator-types";

// ─── Coordination mode ────────────────────────────────────────────────────────

/**
 * AgentCoordinationMode — how an agent step relates to its siblings in the plan.
 */
export type AgentCoordinationMode =
  | "sequential"   // This step runs after all depends_on steps complete
  | "parallel"     // This step runs concurrently with sibling steps at the same depth
  | "conditional"  // This step runs only if the trigger condition from depends_on is met
  | "fan_out"      // One input step spawns multiple independent parallel agent steps
  | "reduce"       // Multiple upstream steps produce inputs that merge into this step
  | "handoff";     // This step receives the complete output of its sole depends_on step

// ─── Coordination step ────────────────────────────────────────────────────────

/**
 * AgentCoordinationStep — one agent's role within a coordination pattern.
 */
export interface AgentCoordinationStep {
  step_id:                     string;
  agent_id:                    AIAgentId;
  task_type:                   AITaskType;
  coordination_mode:           AgentCoordinationMode;
  /** step_ids of steps that must complete before this one may start. */
  depends_on:                  string[];
  /** If true, this step is skipped when any dependency fails (partial completion). */
  skip_on_dependency_failure:  boolean;
  /** If true, dealer must review agent output before the next step proceeds. */
  requires_approval_gate:      boolean;
  /** If true, step output is customer-visible (e.g., a LINE message, social caption). */
  is_customer_facing:          boolean;
  /** Variable names this step reads from the shared execution context. */
  input_keys:                  string[];
  /** Variable names this step writes to the shared execution context. */
  output_keys:                 string[];
  description:                 string;
}

// ─── Coordination pattern ─────────────────────────────────────────────────────

/**
 * AgentCoordinationPattern — a reusable multi-agent collaboration template.
 *
 * Patterns are instantiated into AIExecutionPlan steps by the workflow registry.
 * One pattern may be used across multiple workflows.
 */
export interface AgentCoordinationPattern {
  pattern_id:            string;
  label:                 string;
  description:           string;
  steps:                 AgentCoordinationStep[];
  /** Workflows that use this pattern. */
  used_by_workflows:     AIOrchestrationWorkflowId[];
  /** True if any step in this pattern requires AI Gateway in Phase 11K+. */
  requires_gateway:      true;
  /** True if all steps are deferred to Phase 11K+. */
  execution_deferred:    true;
}

// ─── Agent role descriptor ────────────────────────────────────────────────────

/**
 * AgentOrchestrationRole — describes how a specific agent participates in orchestration.
 *
 * Separate from AIAgentRegistryEntry — this is orchestration-layer metadata.
 */
export interface AgentOrchestrationRole {
  agent_id:                 AIAgentId;
  role_in_orchestration:    string;
  /** Agents this agent can receive data feeds from (via gateway only). */
  receives_feeds_from:      AIAgentId[];
  /** Agents this agent can send data feeds to (via gateway only). */
  sends_feeds_to:           AIAgentId[];
  /** True if this agent can run in parallel with other agents. */
  supports_parallel:        boolean;
  /** True if this agent's output typically requires dealer approval before dispatch. */
  output_requires_approval: boolean;
  /** Workflows this agent participates in. */
  participates_in:          AIOrchestrationWorkflowId[];
}

// ─── Coordination registry ────────────────────────────────────────────────────

/**
 * AGENT_ORCHESTRATION_ROLES — coordination role for each registered AI agent.
 *
 * Note: video_agent is not yet a valid AIAgentId.
 * It will be added when the video pipeline agent is formalized in a future sprint.
 */
export const AGENT_ORCHESTRATION_ROLES: Record<AIAgentId, AgentOrchestrationRole> = {

  marketing_agent: {
    agent_id:                 "marketing_agent",
    role_in_orchestration:    "Primary content producer — storyboard curation, caption writing, SEO/AEO/LLMO/AIO enrichment. Runs after media is collected, before dealer approval gate.",
    receives_feeds_from:      ["growth_agent", "seo_agent", "reputation_agent"],
    sends_feeds_to:           ["seo_agent"],
    supports_parallel:        false, // Content generation is sequential within a project
    output_requires_approval: true,  // Dealer always reviews AI captions before publish
    participates_in:          [
      "work_to_social_content",
      "periodic_growth_analysis",
      "monthly_business_report",
      "seo_batch_optimization",
    ],
  },

  reputation_agent: {
    agent_id:                 "reputation_agent",
    role_in_orchestration:    "Review analysis and compliance check — scores reputation, flags content that references customer reviews, drafts GBP response suggestions.",
    receives_feeds_from:      ["review_agent"],
    sends_feeds_to:           ["marketing_agent", "growth_agent"],
    supports_parallel:        true, // Can run concurrently with SEO enrichment
    output_requires_approval: true, // GBP responses must be manually posted by dealer
    participates_in:          [
      "work_to_reputation_report",
      "periodic_reputation_scan",
      "monthly_business_report",
    ],
  },

  growth_agent: {
    agent_id:                 "growth_agent",
    role_in_orchestration:    "Performance signal feed — provides optimal publish-time suggestions to marketing_agent, contributes KPI data to monthly reports.",
    receives_feeds_from:      ["reputation_agent"],
    sends_feeds_to:           ["marketing_agent"],
    supports_parallel:        true, // KPI analysis can run concurrently
    output_requires_approval: false, // Growth analysis is internal — no customer-facing output
    participates_in:          [
      "periodic_growth_analysis",
      "monthly_business_report",
    ],
  },

  line_agent: {
    agent_id:                 "line_agent",
    role_in_orchestration:    "LINE message delivery coordinator — wraps review_agent output for LINE dispatch. Runs after review_agent completes, before LINE automation dispatch.",
    receives_feeds_from:      ["review_agent"],
    sends_feeds_to:           [],
    supports_parallel:        false, // LINE messages must be sent sequentially per customer
    output_requires_approval: true,  // LINE messages are customer-facing
    participates_in:          [
      "work_to_review_request",
      "line_workflow_execution",
    ],
  },

  review_agent: {
    agent_id:                 "review_agent",
    role_in_orchestration:    "Review request generation — creates LINE review request text and GBP response drafts. Runs immediately after work completion, feeds into line_agent.",
    receives_feeds_from:      [],
    sends_feeds_to:           ["line_agent", "reputation_agent"],
    supports_parallel:        false,
    output_requires_approval: true,  // Review requests are customer-facing
    participates_in:          [
      "work_to_review_request",
      "periodic_reputation_scan",
    ],
  },

  ocr_agent: {
    agent_id:                 "ocr_agent",
    role_in_orchestration:    "Document reading utility — not part of standard content or reputation workflows. Invoked on-demand for document extraction tasks.",
    receives_feeds_from:      [],
    sends_feeds_to:           [],
    supports_parallel:        true, // Document reads are independent
    output_requires_approval: false,
    participates_in:          [], // On-demand only, not part of any standard orchestration workflow
  },

  seo_agent: {
    agent_id:                 "seo_agent",
    role_in_orchestration:    "SEO/MEO/AEO keyword enrichment — enhances marketing_agent content with local search signals. Runs in parallel with reputation compliance check.",
    receives_feeds_from:      ["marketing_agent"],
    sends_feeds_to:           ["marketing_agent"],
    supports_parallel:        true, // Can run concurrently with reputation_agent compliance check
    output_requires_approval: false, // SEO metadata is not customer-facing
    participates_in:          [
      "work_to_social_content",
      "seo_batch_optimization",
      "monthly_business_report",
    ],
  },

};

// ─── Coordination patterns ────────────────────────────────────────────────────

/**
 * AGENT_COORDINATION_PATTERNS — canonical multi-agent collaboration templates.
 *
 * Instantiated by the workflow registry when building execution plans.
 */
export const AGENT_COORDINATION_PATTERNS: AgentCoordinationPattern[] = [

  // Pattern 1: work_order_content_chain
  // WORK_COMPLETED → marketing_agent generates content → seo_agent + reputation_agent enrich in parallel
  // → dealer approval gate → dispatch
  {
    pattern_id:         "work_order_content_chain",
    label:              "Work Order Content Automation",
    description:        "After work completion, marketing_agent creates content, seo_agent and reputation_agent enrich in parallel, then dealer approves before dispatch.",
    steps: [
      {
        step_id:                    "content_01_storyboard",
        agent_id:                   "marketing_agent",
        task_type:                  "image_analysis",
        coordination_mode:          "sequential",
        depends_on:                 [],
        skip_on_dependency_failure: false,
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["approved_media_ids", "work_order_id", "service_summary"],
        output_keys:                ["storyboard_scenes", "narrative_arc"],
        description:                "marketing_agent sequences approved media into a before/after storyboard",
      },
      {
        step_id:                    "content_02_caption",
        agent_id:                   "marketing_agent",
        task_type:                  "content_writing",
        coordination_mode:          "sequential",
        depends_on:                 ["content_01_storyboard"],
        skip_on_dependency_failure: false,
        requires_approval_gate:     true,  // Dealer reviews AI caption
        is_customer_facing:         true,
        input_keys:                 ["storyboard_scenes", "target_channels", "dealer_name"],
        output_keys:                ["base_caption", "channel_variants"],
        description:                "marketing_agent drafts per-channel captions — dealer approval required",
      },
      {
        step_id:                    "content_03_seo",
        agent_id:                   "seo_agent",
        task_type:                  "keyword_extraction",
        coordination_mode:          "parallel",
        depends_on:                 ["content_02_caption"],
        skip_on_dependency_failure: true,  // SEO enrichment is optional — partial completion allowed
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["base_caption", "dealer_local_keywords"],
        output_keys:                ["seo_keywords", "meo_tags"],
        description:                "seo_agent enriches with local SEO/MEO keywords in parallel with reputation check",
      },
      {
        step_id:                    "content_04_reputation",
        agent_id:                   "reputation_agent",
        task_type:                  "reputation_analysis",
        coordination_mode:          "parallel",
        depends_on:                 ["content_02_caption"],
        skip_on_dependency_failure: true,  // Compliance check is advisory — does not block
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["base_caption"],
        output_keys:                ["compliance_flags", "reputation_risk_level"],
        description:                "reputation_agent checks content for review references and compliance flags",
      },
      {
        step_id:                    "content_05_growth_signal",
        agent_id:                   "growth_agent",
        task_type:                  "reputation_analysis",
        coordination_mode:          "sequential",
        depends_on:                 ["content_03_seo", "content_04_reputation"],
        skip_on_dependency_failure: true,
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["dealer_id", "workflow_id"],
        output_keys:                ["optimal_publish_time", "engagement_prediction"],
        description:                "growth_agent provides optimal publish-time signal after enrichment steps",
      },
    ],
    used_by_workflows:  ["work_to_social_content"],
    requires_gateway:   true,
    execution_deferred: true,
  },

  // Pattern 2: review_request_chain
  // WORK_COMPLETED → review_agent generates message → line_agent wraps for LINE → dispatch
  {
    pattern_id:         "review_request_chain",
    label:              "Review Request Automation",
    description:        "After work completion, review_agent generates a review request message that line_agent wraps for LINE delivery.",
    steps: [
      {
        step_id:                    "review_01_generate",
        agent_id:                   "review_agent",
        task_type:                  "review_request_generation",
        coordination_mode:          "sequential",
        depends_on:                 [],
        skip_on_dependency_failure: false,
        requires_approval_gate:     true,  // Review message is customer-facing
        is_customer_facing:         true,
        input_keys:                 ["customer_name", "service_summary", "dealer_name"],
        output_keys:                ["review_request_message"],
        description:                "review_agent generates a personalized LINE review request message",
      },
      {
        step_id:                    "review_02_line_wrap",
        agent_id:                   "line_agent",
        task_type:                  "review_request_generation",
        coordination_mode:          "handoff",
        depends_on:                 ["review_01_generate"],
        skip_on_dependency_failure: false,
        requires_approval_gate:     false, // Already approved at review_01
        is_customer_facing:         true,
        input_keys:                 ["review_request_message", "line_user_id"],
        output_keys:                ["line_message_payload"],
        description:                "line_agent wraps the message for LINE Messaging API dispatch",
      },
    ],
    used_by_workflows:  ["work_to_review_request"],
    requires_gateway:   true,
    execution_deferred: true,
  },

  // Pattern 3: reputation_analysis_chain
  // Scheduled scan → reputation_agent scores reviews → review_agent drafts responses
  //                                                  → marketing_agent creates recovery content (conditional)
  {
    pattern_id:         "reputation_analysis_chain",
    label:              "Reputation Monitoring",
    description:        "Scheduled scan: reputation_agent scores all recent reviews, review_agent drafts responses for low-rated reviews, marketing_agent conditionally creates recovery content.",
    steps: [
      {
        step_id:                    "rep_01_scan",
        agent_id:                   "reputation_agent",
        task_type:                  "reputation_analysis",
        coordination_mode:          "sequential",
        depends_on:                 [],
        skip_on_dependency_failure: false,
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["dealer_id", "scan_period"],
        output_keys:                ["reputation_score", "low_rated_reviews", "trend_direction"],
        description:                "reputation_agent fetches and scores all recent reviews",
      },
      {
        step_id:                    "rep_02_response_draft",
        agent_id:                   "review_agent",
        task_type:                  "review_response_drafting",
        coordination_mode:          "sequential",
        depends_on:                 ["rep_01_scan"],
        skip_on_dependency_failure: true,
        requires_approval_gate:     true,  // GBP responses require manual dealer post
        is_customer_facing:         true,
        input_keys:                 ["low_rated_reviews", "dealer_name"],
        output_keys:                ["response_drafts"],
        description:                "review_agent drafts GBP response suggestions for low-rated reviews",
      },
      {
        step_id:                    "rep_03_recovery_content",
        agent_id:                   "marketing_agent",
        task_type:                  "content_writing",
        coordination_mode:          "conditional", // Only runs if reputation_score < threshold
        depends_on:                 ["rep_01_scan"],
        skip_on_dependency_failure: true,
        requires_approval_gate:     true,
        is_customer_facing:         false, // Internal recommendation — dealer decides to publish
        input_keys:                 ["reputation_score", "trend_direction", "dealer_name"],
        output_keys:                ["recovery_content_suggestion"],
        description:                "marketing_agent suggests recovery content when reputation score drops",
      },
    ],
    used_by_workflows:  ["periodic_reputation_scan", "work_to_reputation_report"],
    requires_gateway:   true,
    execution_deferred: true,
  },

  // Pattern 4: growth_analysis_chain
  // Scheduled → growth_agent analyzes KPIs → marketing_agent gets performance signals
  {
    pattern_id:         "growth_analysis_chain",
    label:              "Growth KPI Analysis",
    description:        "Scheduled: growth_agent analyzes KPIs across all subsystems, sends performance signals to marketing_agent for content strategy.",
    steps: [
      {
        step_id:                    "growth_01_kpi_analysis",
        agent_id:                   "growth_agent",
        task_type:                  "reputation_analysis",
        coordination_mode:          "sequential",
        depends_on:                 [],
        skip_on_dependency_failure: false,
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["dealer_id", "analysis_period"],
        output_keys:                ["kpi_scores", "growth_opportunities", "recommendations"],
        description:                "growth_agent analyzes all KPIs and generates prioritized recommendations",
      },
      {
        step_id:                    "growth_02_content_signal",
        agent_id:                   "marketing_agent",
        task_type:                  "keyword_extraction",
        coordination_mode:          "handoff",
        depends_on:                 ["growth_01_kpi_analysis"],
        skip_on_dependency_failure: true,
        requires_approval_gate:     false,
        is_customer_facing:         false,
        input_keys:                 ["growth_opportunities", "dealer_name"],
        output_keys:                ["content_strategy_hints"],
        description:                "marketing_agent receives growth signals to inform upcoming content strategy",
      },
    ],
    used_by_workflows:  ["periodic_growth_analysis", "monthly_business_report"],
    requires_gateway:   true,
    execution_deferred: true,
  },

];

// ─── Lookup functions ─────────────────────────────────────────────────────────

export function getCoordinationPattern(
  pattern_id: string,
): AgentCoordinationPattern | undefined {
  return AGENT_COORDINATION_PATTERNS.find((p) => p.pattern_id === pattern_id);
}

export function getPatternsForWorkflow(
  workflow_id: AIOrchestrationWorkflowId,
): AgentCoordinationPattern[] {
  return AGENT_COORDINATION_PATTERNS.filter((p) =>
    p.used_by_workflows.includes(workflow_id),
  );
}

export function getAgentRole(
  agent_id: AIAgentId,
): AgentOrchestrationRole {
  return AGENT_ORCHESTRATION_ROLES[agent_id];
}

export function getAgentsByWorkflow(
  workflow_id: AIOrchestrationWorkflowId,
): AIAgentId[] {
  const seen = new Set<AIAgentId>();
  for (const pattern of getPatternsForWorkflow(workflow_id)) {
    for (const step of pattern.steps) {
      seen.add(step.agent_id);
    }
  }
  return Array.from(seen);
}
