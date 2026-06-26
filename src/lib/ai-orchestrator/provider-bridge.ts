// DealerOS — AI Orchestration Engine: Provider Bridge (Sprint 11J Phase D)
//
// The contract through which the orchestrator communicates with the AI Gateway.
//
// CRITICAL ARCHITECTURE RULE:
//   The orchestrator NEVER calls AI providers directly.
//   ALL agent invocations flow through the AI Gateway bridge.
//
//   Forbidden in orchestrator code:
//     import { OpenAI } from "openai"
//     import Anthropic from "@anthropic-ai/sdk"
//     import { GoogleGenerativeAI } from "@google/generative-ai"
//
//   Required pattern:
//     AIOrchestrator → AIGatewayBridge → AI Gateway → Provider Adapter
//
// Provider independence is maintained in the bridge contract type system —
// the orchestrator cannot express a provider preference at the call site.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }                 from "@/lib/ai/agents/types";
import type { AITaskType, AIProviderId }  from "@/lib/ai/types";
import type {
  AIOrchestrationWorkflowId,
  AIExecutionStatus,
}                                         from "./orchestrator-types";

// ─── Bridge request ───────────────────────────────────────────────────────────

/**
 * AIGatewayBridgeRequest — the only structure the orchestrator sends to the gateway.
 *
 * The orchestrator does NOT specify which provider to use.
 * Provider selection is the sole responsibility of the AI Gateway.
 * dealer_id must always come from getCurrentDealer() at the call site.
 */
export interface AIGatewayBridgeRequest {
  /** Always from getCurrentDealer() — never from client input. */
  dealer_id:        string;
  agent_id:         AIAgentId;
  task_type:        AITaskType;
  workflow_id:      AIOrchestrationWorkflowId;
  /** step_id within the parent execution plan. */
  step_id:          string;
  /** plan_id of the parent execution plan. */
  plan_id:          string;
  trace_id:         string;
  /** Input data from the execution context for this step. */
  input_payload:    Record<string, unknown>;
  /** Literal true — prevents orchestrator from bypassing the gateway. */
  requires_gateway: true;
  created_at:       string;
}

// ─── Bridge response ──────────────────────────────────────────────────────────

/**
 * AIGatewayBridgeResponse — what the gateway returns to the orchestrator.
 *
 * The orchestrator receives the output and writes output_keys to the
 * execution context. It does NOT receive raw provider data.
 */
export interface AIGatewayBridgeResponse {
  step_id:             string;
  plan_id:             string;
  success:             boolean;
  /** The AI provider used. null in Sprint 11J (no real execution). */
  provider_used:       AIProviderId | null;
  /** Model identifier used. null in Sprint 11J. */
  model_used:          string | null;
  /** Structured output written by the agent. null in Sprint 11J. */
  output_payload:      Record<string, unknown> | null;
  /** User-readable error message. Set when success === false. */
  error_message:       string | null;
  /** Always true in Sprint 11J — no actual inference. */
  execution_deferred:  true;
  responded_at:        string;
}

// ─── Provider independence constraints ───────────────────────────────────────

/**
 * AIGatewayBridgeConstraints — static enforcement of provider independence.
 *
 * These constraints are architectural assertions, not runtime checks.
 * They document what the orchestrator layer is forbidden from doing.
 */
export interface AIGatewayBridgeConstraints {
  /** Orchestrator may not import any AI provider SDK. */
  readonly orchestrator_may_not_import_provider_sdk:     true;
  /** Orchestrator may not name a provider in a bridge request. */
  readonly orchestrator_may_not_specify_provider:        true;
  /** Agents may not receive raw provider API keys from the orchestrator. */
  readonly agents_never_receive_raw_api_keys:            true;
  /** All inference costs are billed to the dealer's own AI provider key. */
  readonly office_az_never_pays_inference_costs:         true;
  /** Agents communicate exclusively through the gateway — no peer imports. */
  readonly agents_communicate_via_gateway_only:          true;
}

export const GATEWAY_BRIDGE_CONSTRAINTS: AIGatewayBridgeConstraints = {
  orchestrator_may_not_import_provider_sdk:  true,
  orchestrator_may_not_specify_provider:     true,
  agents_never_receive_raw_api_keys:         true,
  office_az_never_pays_inference_costs:      true,
  agents_communicate_via_gateway_only:       true,
} as const;

// ─── Gateway bridge status ────────────────────────────────────────────────────

/**
 * AIGatewayBridgeStatus — readiness state of the bridge from the orchestrator's view.
 *
 * The orchestrator checks this before building any execution plan.
 */
export type AIGatewayBridgeReadiness =
  | "ready"               // Gateway is configured and reachable
  | "no_provider"         // Dealer has not configured an AI provider
  | "key_invalid"         // Provider key is present but failed validation
  | "feature_gate"        // Required AppFeature is not active for this dealer
  | "deferred"            // Bridge wiring deferred to Sprint 11K
  | "error";              // Unexpected error during gateway check

export interface AIGatewayBridgeStatusResult {
  readiness:           AIGatewayBridgeReadiness;
  /** Human-readable explanation for non-ready states. */
  message:             string;
  /** True if the orchestrator may proceed with plan building. */
  can_proceed:         boolean;
  checked_at:          string;
}

// ─── Execution state bridge ───────────────────────────────────────────────────

/**
 * AIOrchestrationBridgeState — the orchestrator's view of a running plan.
 *
 * Written by the gateway after each step; read by the orchestrator to decide
 * what to run next. In Sprint 11J, state is always "deferred".
 */
export interface AIOrchestrationBridgeState {
  plan_id:             string;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  overall_status:      AIExecutionStatus;
  /** Map from step_id to its current status. */
  step_statuses:       Record<string, "pending" | "running" | "complete" | "failed" | "skipped" | "deferred">;
  /** Accumulated step outputs available for downstream steps. */
  step_outputs:        Record<string, unknown>;
  /** Always true in Sprint 11J — no live state updates. */
  execution_deferred:  true;
  updated_at:          string;
}

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * buildBridgeRequest — creates a gateway bridge request for one execution step.
 * dealer_id must come from getCurrentDealer().
 */
export function buildBridgeRequest(
  dealer_id:      string,
  agent_id:       AIAgentId,
  task_type:      AITaskType,
  workflow_id:    AIOrchestrationWorkflowId,
  step_id:        string,
  plan_id:        string,
  trace_id:       string,
  input_payload:  Record<string, unknown>,
  now:            string,
): AIGatewayBridgeRequest {
  return {
    dealer_id,
    agent_id,
    task_type,
    workflow_id,
    step_id,
    plan_id,
    trace_id,
    input_payload,
    requires_gateway: true,
    created_at:       now,
  };
}

/**
 * buildDeferredBridgeResponse — creates a deferred response for Sprint 11J.
 * Used to satisfy type constraints while AI execution is not yet wired.
 */
export function buildDeferredBridgeResponse(
  step_id:  string,
  plan_id:  string,
  now:      string,
): AIGatewayBridgeResponse {
  return {
    step_id,
    plan_id,
    success:            false,
    provider_used:      null,
    model_used:         null,
    output_payload:     null,
    error_message:      "Execution deferred — AI Gateway bridge wiring planned for Sprint 11K",
    execution_deferred: true,
    responded_at:       now,
  };
}

/**
 * buildInitialBridgeState — creates the initial bridge state for a new plan.
 * dealer_id must come from getCurrentDealer().
 */
export function buildInitialBridgeState(
  plan_id:     string,
  dealer_id:   string,
  step_ids:    string[],
  now:         string,
): AIOrchestrationBridgeState {
  const step_statuses = Object.fromEntries(
    step_ids.map((id) => [id, "deferred" as const]),
  );
  return {
    plan_id,
    dealer_id,
    overall_status:     "pending",
    step_statuses,
    step_outputs:       {},
    execution_deferred: true,
    updated_at:         now,
  };
}
