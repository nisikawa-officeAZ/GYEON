// DealerOS — AI Orchestration Engine: Step Bridge Executor (Sprint 11L Phase B + D)
//
// Runs lifecycle preparation for one agent step through the live runtime bridge.
//
// Bridge execution per step:
//   1. Look up agent instance from the instance registry
//   2. Call agent.initialize(agent_context) — load config, validate context
//   3. Check provider readiness from agent_context.gateway.status
//   4. Determine approval_required from step + policy
//   5. Build AICapabilitySummary from registry metadata
//   6. Derive next_actions from all of the above
//   7. Compute execution_state
//   8. Return AIExecutionBridgeResult
//
// NOT called:
//   - agent.validate() — run_validate: false in Sprint 11L (no real input data yet)
//   - agent.execute()  — run_execute: false in Sprint 11L (no AI provider calls)
//
// Security rules:
//   - dealer_id always from getCurrentDealer() — passed via agent_context
//   - No API key access — gateway readiness is checked via status field only
//   - Never import any AI provider SDK
//
// Async — calls agent.initialize() which is async.

import type {
  AIExecutionBridgeContext,
  AIExecutionBridgePolicy,
  AIExecutionBridgeResult,
  AIExecutionBridgeState,
  AICapabilitySummary,
  AIExecutionNextAction,
}                                   from "./bridge-types";
import {
  getAgentInstance,
}                                   from "./agent-instance-registry";
import {
  getAgentEntry,
}                                   from "@/lib/ai/agents/registry";
import {
  evaluateApprovalGate,
}                                   from "./approval-gate";
import type { AIExecutionStep }     from "../orchestrator-types";
import type { AIExecutionPolicy }   from "../orchestrator-types";

// ─── Capability summary builder ───────────────────────────────────────────────

function buildCapabilitySummary(
  ctx:  AIExecutionBridgeContext,
  step: AIExecutionStep,
): AICapabilitySummary {
  const entry = getAgentEntry(step.agent_id);

  return {
    agent_id:               step.agent_id,
    agent_name:             entry?.nameJa ?? step.agent_id,
    task_type:              step.task_type,
    required_feature:       entry?.requiredFeature ?? "ai_gateway",
    required_provider_caps: entry?.requiredProviderCaps ?? [],
    supported_task_types:   entry?.taskTypes ?? [step.task_type],
  };
}

// ─── Next-action derivation ───────────────────────────────────────────────────

function deriveNextActions(
  approval_required:     boolean,
  provider_ready:        boolean,
  initialize_succeeded:  boolean,
): AIExecutionNextAction[] {
  const actions: AIExecutionNextAction[] = [];

  if (!initialize_succeeded) {
    actions.push("retry_with_different_input");
    return actions;
  }

  if (!provider_ready) {
    actions.push("await_provider_configuration");
  }

  if (approval_required) {
    actions.push("submit_for_approval");
  } else if (provider_ready) {
    actions.push("ready_for_dispatch");
  }

  return actions.length > 0 ? actions : ["ready_for_dispatch"];
}

// ─── Execution state computation ──────────────────────────────────────────────

function computeStepState(
  initialize_succeeded:  boolean,
  approval_required:     boolean,
): AIExecutionBridgeState {
  if (!initialize_succeeded) return "failed";
  if (approval_required)     return "awaiting_approval";
  return "ready";
}

// ─── Core step bridge function ────────────────────────────────────────────────

/**
 * runStepBridgeLifecycle — executes lifecycle preparation for one agent step.
 *
 * Calls initialize() only — no validate(), no execute().
 * agent_context must be pre-built by the calling server action.
 * Returns a structured AIExecutionBridgeResult — never throws.
 */
export async function runStepBridgeLifecycle(
  ctx:    AIExecutionBridgeContext,
  step:   AIExecutionStep,
  policy: AIExecutionPolicy,
  now:    string,
): Promise<AIExecutionBridgeResult> {
  const capability_summary = buildCapabilitySummary(ctx, step);

  // Provider readiness from pre-built agent context (no DB call here)
  const provider_ready = ctx.agent_context.gateway.status === "ready";

  // Approval gate check — same logic as dry-run approval-gate.ts
  const approval_gate_status = evaluateApprovalGate(step, policy);
  const approval_required    = approval_gate_status !== "not_required";

  // Look up agent instance
  const agent = getAgentInstance(step.agent_id);
  if (!agent) {
    return {
      execution_id:         ctx.execution_id,
      agent_id:             step.agent_id,
      execution_state:      "failed",
      capability_summary,
      next_actions:         ["retry_with_different_input"],
      approval_required,
      provider_ready,
      initialize_succeeded: false,
      error_message:        `エージェント "${step.agent_id}" はレジストリに登録されていません`,
      execution_timestamp:  now,
    };
  }

  // Run agent.initialize() — the only lifecycle step executed in Sprint 11L
  let initialize_succeeded = false;
  let error_message: string | null = null;

  try {
    await agent.initialize(ctx.agent_context);
    initialize_succeeded = true;
  } catch (err) {
    // Never surface internal error details or stack traces
    error_message = err instanceof Error
      ? `エージェントの初期化に失敗しました（${step.agent_id}）`
      : `エージェントの初期化に失敗しました（${step.agent_id}）`;
  }

  const execution_state = computeStepState(initialize_succeeded, approval_required);
  const next_actions    = deriveNextActions(approval_required, provider_ready, initialize_succeeded);

  return {
    execution_id:         ctx.execution_id,
    agent_id:             step.agent_id,
    execution_state,
    capability_summary,
    next_actions,
    approval_required,
    provider_ready,
    initialize_succeeded,
    error_message,
    execution_timestamp:  now,
  };
}
