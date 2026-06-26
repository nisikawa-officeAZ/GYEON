// DealerOS — LINE Automation Platform: AI Integration (Sprint 11G Phase E)
//
// Provider-agnostic AI integration spec for the LINE Automation Platform.
//
// Design principle: LINE Automation never depends on a specific AI provider.
// All AI calls go through the AI Gateway (checkAiGatewayReady, createAgentContext).
// The platform declares WHAT it needs (agent, task, language) — not HOW to get it.
// Provider resolution is the AI Gateway's responsibility.
//
// Agents that LINE Automation may call (all via AI Gateway):
//   line_agent       — LINE message generation and automation (primary)
//   reputation_agent — Review request message generation (Sprint 11F: deterministic builder)
//   marketing_agent  — Campaign content personalization
//   growth_agent     — Optimal send-time prediction, customer segment analysis
//
// AI execution is deferred in Sprint 11G:
//   - LineAutomationAIPlan.execution_deferred = true (literal)
//   - No real AI inference is triggered
//   - Plans describe what WILL happen when the gateway is ready
//
// Pure — no "use server", no external calls.

import type { AIAgentId }  from "@/lib/ai/agents/types";
import type { AITaskType } from "@/lib/ai/types";
import type { LineAutomationWorkflowId } from "./line-automation-types";

// ─── AI task configuration ─────────────────────────────────────────────────────

/**
 * LineAutomationAITaskConfig — describes a single AI step in a workflow.
 *
 * provider: null — never hardcoded; resolved at runtime by the AI Gateway.
 */
export interface LineAutomationAITaskConfig {
  agent_id:            AIAgentId;
  task_type:           AITaskType;
  purpose:             string;
  language_preference: "ja" | "en";
  /** Input variable names the AI task reads from the workflow context. */
  input_variables:     string[];
  /** Output variable names the AI task produces for downstream steps. */
  output_variables:    string[];
  /** True when this step is blocking — workflow halts if AI is unavailable. */
  blocking:            boolean;
  /** True when the dealer must review the AI output before it is used. */
  requires_review:     boolean;
}

// ─── Integration spec ──────────────────────────────────────────────────────────

/**
 * LineAutomationAIIntegrationSpec — full AI integration declaration for a workflow.
 *
 * Describes all AI steps that the workflow will execute when the AI Gateway
 * is ready and the dealer has the required plan features.
 */
export interface LineAutomationAIIntegrationSpec {
  workflow_id:         LineAutomationWorkflowId;
  uses_ai:             boolean;
  tasks:               LineAutomationAITaskConfig[];
  /** Human-readable note about what AI does in this workflow. */
  ai_description:      string;
  /** Features required before AI steps can execute. */
  required_features:   string[];
  /** True when AI steps are deferred — platform foundation only. */
  deferred:            boolean;
  deferred_since:      string;
}

// ─── AI execution plan ────────────────────────────────────────────────────────

/**
 * LineAutomationAIPlan — the deferred AI execution plan for a single workflow run.
 *
 * execution_deferred: true — permanently set in Sprint 11G.
 * AI execution requires Phase 11H+: AI Gateway wired to LINE dispatch.
 */
export interface LineAutomationAIPlan {
  workflow_id:         LineAutomationWorkflowId;
  agent_id:            AIAgentId;
  task_type:           AITaskType;
  language_preference: "ja" | "en";
  estimated_output:    null;   // Always null — no AI inference in Sprint 11G
  /** Always true — real execution deferred to Phase 11H+ */
  execution_deferred:  true;
  deferred_reason:     string;
  prepared_at:         string;
}

// ─── AI integration registry ───────────────────────────────────────────────────

/**
 * LINE_AI_INTEGRATION_REGISTRY — per-workflow AI integration specifications.
 *
 * Workflows with uses_ai: false will use deterministic builders (no AI Gateway).
 * Workflows with uses_ai: true declare their AI tasks but defer execution to
 * Phase 11H+ when the full AI provider adapter chain is available.
 */
export const LINE_AI_INTEGRATION_REGISTRY: Record<
  LineAutomationWorkflowId,
  LineAutomationAIIntegrationSpec
> = {
  review_request: {
    workflow_id:       "review_request",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Sprint 11F uses a deterministic message builder. Future: line_agent will personalize the message using customer history and service context.",
    required_features: [],
    deferred:          true,
    deferred_since:    "Sprint 11G (deterministic builder available in Sprint 11F)",
  },

  maintenance_reminder: {
    workflow_id:       "maintenance_reminder",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Currently uses a fixed template. Future: line_agent will personalize based on vehicle history and upcoming service needs.",
    required_features: [],
    deferred:          true,
    deferred_since:    "Sprint 11G",
  },

  reservation_confirmation: {
    workflow_id:       "reservation_confirmation",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Fixed confirmation template — no AI needed for transactional messages.",
    required_features: [],
    deferred:          false,
    deferred_since:    "",
  },

  reservation_reminder: {
    workflow_id:       "reservation_reminder",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Fixed reminder template — no AI needed.",
    required_features: [],
    deferred:          false,
    deferred_since:    "",
  },

  estimate_followup: {
    workflow_id:       "estimate_followup",
    uses_ai:           true,
    tasks:             [
      {
        agent_id:            "marketing_agent",
        task_type:           "content_writing",
        purpose:             "Personalize the estimate follow-up message to maximize conversion",
        language_preference: "ja",
        input_variables:     ["estimate_id", "customer_name", "estimate_total", "service_summary"],
        output_variables:    ["followup_message"],
        blocking:            false,
        requires_review:     true,
      },
    ],
    ai_description:    "marketing_agent drafts a personalized follow-up message; dealer reviews before send.",
    required_features: ["ai_marketing"],
    deferred:          true,
    deferred_since:    "Sprint 11G",
  },

  invoice_notification: {
    workflow_id:       "invoice_notification",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Fixed invoice notification template — no AI needed for transactional messages.",
    required_features: [],
    deferred:          false,
    deferred_since:    "",
  },

  campaign_delivery: {
    workflow_id:       "campaign_delivery",
    uses_ai:           true,
    tasks:             [
      {
        agent_id:            "marketing_agent",
        task_type:           "content_writing",
        purpose:             "Generate campaign message body and CTA",
        language_preference: "ja",
        input_variables:     ["campaign_id", "customer_segment", "vehicle_type", "service_history"],
        output_variables:    ["campaign_message"],
        blocking:            true,
        requires_review:     true,
      },
    ],
    ai_description:    "marketing_agent generates the campaign message; manager must approve before dispatch.",
    required_features: ["ai_marketing"],
    deferred:          true,
    deferred_since:    "Sprint 11G",
  },

  birthday_message: {
    workflow_id:       "birthday_message",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Fixed birthday message template. Future: line_agent may add personalized service suggestions.",
    required_features: [],
    deferred:          true,
    deferred_since:    "Sprint 11G",
  },

  inspection_reminder: {
    workflow_id:       "inspection_reminder",
    uses_ai:           false,
    tasks:             [],
    ai_description:    "Fixed inspection reminder template.",
    required_features: [],
    deferred:          false,
    deferred_since:    "",
  },

  custom_workflow: {
    workflow_id:       "custom_workflow",
    uses_ai:           true,
    tasks:             [
      {
        agent_id:            "line_agent",
        task_type:           "content_writing",
        purpose:             "Generate or adapt custom workflow message content",
        language_preference: "ja",
        input_variables:     ["workflow_config", "customer_context"],
        output_variables:    ["message_text"],
        blocking:            false,
        requires_review:     true,
      },
    ],
    ai_description:    "line_agent generates message content for dealer-defined custom workflows.",
    required_features: ["ai_gateway"],
    deferred:          true,
    deferred_since:    "Sprint 11G",
  },
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * buildAIPlan — creates the deferred AI execution plan for a workflow run.
 *
 * Returns null when the workflow does not use AI.
 * All plans have execution_deferred: true in Sprint 11G.
 */
export function buildAIPlan(
  workflowId: LineAutomationWorkflowId,
  now:        string,
): LineAutomationAIPlan | null {
  const spec = LINE_AI_INTEGRATION_REGISTRY[workflowId];
  if (!spec.uses_ai || spec.tasks.length === 0) return null;

  const primaryTask = spec.tasks[0];
  return {
    workflow_id:         workflowId,
    agent_id:            primaryTask.agent_id,
    task_type:           primaryTask.task_type,
    language_preference: primaryTask.language_preference,
    estimated_output:    null,
    execution_deferred:  true,
    deferred_reason:     "AI execution requires Phase 11H+ — AI Gateway must be wired to LINE dispatch",
    prepared_at:         now,
  };
}

/** Returns the AI integration spec for a workflow. Never null — all workflows have a spec. */
export function getAIIntegrationSpec(
  workflowId: LineAutomationWorkflowId,
): LineAutomationAIIntegrationSpec {
  return LINE_AI_INTEGRATION_REGISTRY[workflowId];
}
