// GYEON Business Hub — Automation AI Gateway Bridge: Core Types (Sprint 12D)
//
// Defines the type model for AI actions requested by the Automation Center.
//
// Type hierarchy:
//   AutomationAIActionTypeId  — automation domain action type (10 values)
//       └── maps to → AIAgentId + AITaskType (existing gateway contracts)
//   AutomationAIRequest       — automation context passed to the bridge
//       └── extends → AIAgentRequest fields for orchestrator compatibility
//   AutomationAIReadiness     — result of a pre-execution readiness check
//   AutomationAIResult        — final output (always execution_deferred in 12D)
//
// Key invariants:
//   - can_execute: false is a compile-time literal. No AI runs in Sprint 12D.
//   - execution_deferred: true is a compile-time literal on all result objects.
//   - dealer_id must always come from getCurrentDealer() before being placed in
//     AutomationAIRequest. Never from client input.
//   - No provider SDK imports anywhere in this module.
//   - No fake AI output. content: null always in Sprint 12D.
//
// Relationship to existing AI types:
//   - AITaskType (src/lib/ai/types.ts) — existing 8 task types; NOT modified here.
//   - AIAgentId (src/lib/ai/agents/types.ts) — existing 7 agents; NOT modified here.
//   - AIGatewayStatus (src/lib/ai/ai-settings-types.ts) — referenced for readiness.
//   - The bridge maps AutomationAIActionTypeId → (AIAgentId, AITaskType) pairs.
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type { AIAgentId }        from "@/lib/ai/agents/types";
import type { AITaskType }        from "@/lib/ai/types";
import type { AIGatewayStatus }   from "@/lib/ai/ai-settings-types";
import type { AIEntitlementId }   from "@/lib/subscription/subscription-center-types";
import type { AutomationWorkflowId, AutomationTriggerId } from "../automation-types";

export type {
  AIAgentId, AITaskType, AIGatewayStatus, AIEntitlementId,
  AutomationWorkflowId, AutomationTriggerId,
};

// ─── AI action type identifiers ────────────────────────────────────────────────

/**
 * AutomationAIActionTypeId — all AI action types the Automation Center can request.
 * Registry: see ai-action-registry.ts.
 *
 * These are automation-domain identifiers that map to (AIAgentId, AITaskType) pairs
 * in the AI Gateway. Each maps to exactly one agent and one task type.
 */
export type AutomationAIActionTypeId =
  // Content generation — produces text/media for staff review before use
  | "generate_ai_caption"            // SNS caption or LINE message body
  | "generate_ai_reply"              // Draft reply to inbound customer message
  | "generate_ai_summary"            // Narrative summary of business performance
  | "generate_review_request"        // LINE/channel review request message
  | "generate_maintenance_message"   // Scheduled maintenance reminder message
  | "generate_sns_post"              // Full SNS post (caption + hashtags + metadata)
  | "generate_video_storyboard"      // Shot list and script for AI video generation
  // Analysis — produces data insights (never customer-facing directly)
  | "analyze_customer_inactivity"    // Score customer churn risk from visit history
  | "analyze_review_sentiment"       // Sentiment analysis of received reviews
  | "analyze_growth_opportunity";    // Identify revenue and retention opportunities

// ─── Action category ───────────────────────────────────────────────────────────

export type AutomationAIActionCategory =
  | "content_generation"  // Creates text/media content for staff review before dispatch
  | "message_draft"       // Creates a customer-facing message draft (requires approval)
  | "analysis"            // Analyzes data to produce insights (never customer-facing)
  | "summary";            // Produces narrative summary of business data (internal)

// ─── Automation AI request ─────────────────────────────────────────────────────

/**
 * AutomationAIRequest — the automation-domain AI request.
 *
 * Built by the Automation Engine at workflow step execution time.
 * Passed to the AI Gateway Bridge, which converts it to an AITextRequest
 * for the AI Gateway.
 *
 * dealer_id MUST come from getCurrentDealer() at build time.
 * Never constructed from client-supplied data.
 */
export interface AutomationAIRequest {
  ai_action_type_id:       AutomationAIActionTypeId;
  workflow_id:             AutomationWorkflowId;
  trigger_id:              AutomationTriggerId;
  step_id:                 string;
  /** Always from getCurrentDealer(). */
  dealer_id:               string;
  customer_id:             string | null;
  vehicle_id:              string | null;
  work_order_id:           string | null;
  /** Variables from completed prior steps in this workflow run. */
  step_context:            Record<string, string>;
  /** AI Orchestration plan this request belongs to. null in Sprint 12D. */
  orchestration_plan_id:   string | null;
  /** UUID for request tracing across gateway, orchestrator, and audit logs. */
  trace_id:                string;
  requested_at:            string;   // ISO 8601
}

// ─── Gateway request shape ────────────────────────────────────────────────────

/**
 * AutomationAIGatewayPayload — the shape the bridge converts AutomationAIRequest into.
 * Compatible with AITextRequest from src/lib/ai/types.ts.
 * Actual gateway call is deferred to Sprint 13.
 */
export interface AutomationAIGatewayPayload {
  dealer_id:      string;   // From request.dealer_id — already verified server-side
  task_type:      AITaskType;
  system_prompt:  string;   // Generated by bridge from action type + context
  user_prompt:    string;   // Generated by bridge from action type + context
  max_tokens:     number;
  temperature:    number;
  trace_id:       string;
}

// ─── Readiness model ──────────────────────────────────────────────────────────

/**
 * AutomationAIReadinessStatus — result of a pre-execution readiness check.
 *
 * In Sprint 12D, dryRunAIAction() always returns execution_deferred.
 * In Sprint 13, it will return the first blocking status it finds.
 */
export type AutomationAIReadinessStatus =
  | "ready"                // All checks pass — gateway can execute immediately
  | "gateway_not_ready"    // checkAiGatewayReady() returned non-ready status
  | "entitlement_missing"  // Dealer plan does not include required AIEntitlementId
  | "consent_missing"      // Customer has not granted ai_communication_permission
  | "context_incomplete"   // Required step_context fields are absent
  | "approval_required"    // Execution is gated on dealer review of draft content
  | "execution_deferred";  // Sprint 12D: no live execution available yet

/**
 * AutomationAIReadiness — structured result of a gateway readiness assessment.
 * Returned by checkAIActionReadiness() and embedded in AutomationAIResult.
 */
export interface AutomationAIReadiness {
  status:                  AutomationAIReadinessStatus;
  /** Gateway status as would be returned by checkAiGatewayReady(). */
  gateway_status:          AIGatewayStatus | null;
  required_entitlement:    AIEntitlementId | null;
  missing_context_fields:  string[];
  requires_approval:       boolean;
  /** True if the bridge would proceed to AI Gateway on this result. Always false in 12D. */
  can_execute:             false;
  /** Sprint when live execution will be available for this action type. */
  deferred_until:          string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

/**
 * AutomationAIResult — the output of a bridge dry-run in Sprint 12D.
 *
 * Key guarantees:
 *   - content: null always (no AI execution in Sprint 12D)
 *   - provider: null always (no provider chosen yet)
 *   - approved_for_dispatch: false always
 *   - execution_deferred: true always
 */
export interface AutomationAIResult {
  ai_action_type_id:      AutomationAIActionTypeId;
  workflow_id:            AutomationWorkflowId;
  step_id:                string;
  trace_id:               string;
  agent_id:               AIAgentId;       // Which agent would handle this
  task_type:              AITaskType;       // Which task type would be dispatched
  readiness:              AutomationAIReadiness;
  gateway_payload_shape:  AutomationAIGatewayPayload;  // Typed payload shape for audit
  content:                null;             // No AI content in Sprint 12D
  provider:               null;             // No provider selected in Sprint 12D
  approved_for_dispatch:  false;            // Never approved in Sprint 12D
  execution_deferred:     true;
  created_at:             string;
}
