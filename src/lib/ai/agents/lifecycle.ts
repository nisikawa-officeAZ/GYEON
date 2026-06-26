// DealerOS — AI Agent Framework: Lifecycle Runner
// Server-side only — orchestrates the full agent lifecycle.
//
// Lifecycle order:
//   Initialize → Validate → Execute → Post-process → Log Usage → Return
//
// Sprint 10D: execute() throws AIAgentNotImplementedError for all agents.
// Phase G: concrete agents override execute() with provider adapter calls.
//
// Usage logging is a no-op until dealer_ai_usage_log table exists (Phase G migration).

import type {
  AIAgent,
  AIAgentRequest,
  AIAgentResponse,
  AIAgentContext,
  AIAgentLifecycleResult,
} from "./types";
import {
  AIAgentNotImplementedError,
  AIAgentError,
} from "./types";

// ─── Usage logging (no-op — Phase G migration pending) ────────────────────────

async function logAgentUsage(
  _ctx:      AIAgentContext,
  _response: AIAgentResponse,
): Promise<void> {
  // Phase G: INSERT into dealer_ai_usage_log
  //   dealer_id, agent_id, task_type, provider, tokens, cost_usd, trace_id
  // Requires: dealer_ai_usage_log table migration (CTO approval)
  return;
}

// ─── Lifecycle runner ─────────────────────────────────────────────────────────

/**
 * Runs the full agent lifecycle for a given agent, context, and input.
 *
 * This function is the single entry point for all agent executions.
 * It handles all lifecycle stages, catches known errors, and always
 * returns a structured AIAgentLifecycleResult — it never throws.
 */
export async function runAgentLifecycle<
  TInput  extends AIAgentRequest  = AIAgentRequest,
  TOutput extends AIAgentResponse = AIAgentResponse,
>(
  agent:   AIAgent<TInput, TOutput>,
  context: AIAgentContext,
  input:   TInput,
): Promise<AIAgentLifecycleResult<TOutput>> {
  const start    = Date.now();
  const trace_id = context.trace_id;

  // ── Usage policy gate ────────────────────────────────────────────────────
  if (context.policy.hard_limit && context.policy.limit_reached) {
    return {
      state:       "failed",
      error:       "月間AI使用上限に達しました。設定から上限を変更するか、来月までお待ちください。",
      duration_ms: Date.now() - start,
      trace_id,
    };
  }

  // ── Initialize ───────────────────────────────────────────────────────────
  try {
    await agent.initialize(context);
  } catch {
    return {
      state:       "failed",
      error:       "エージェントの初期化に失敗しました",
      duration_ms: Date.now() - start,
      trace_id,
    };
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  let validation;
  try {
    validation = await agent.validate(context, input);
  } catch {
    return {
      state:       "failed",
      error:       "入力の検証中にエラーが発生しました",
      duration_ms: Date.now() - start,
      trace_id,
    };
  }

  if (!validation.valid) {
    return {
      state:       "failed",
      error:       validation.errors.map((e) => e.message).join("、"),
      duration_ms: Date.now() - start,
      trace_id,
    };
  }

  // ── Execute ──────────────────────────────────────────────────────────────
  let output: TOutput;
  try {
    output = await agent.execute(context, input);
  } catch (err) {
    if (err instanceof AIAgentNotImplementedError) {
      return {
        state:       "failed",
        error:       `このエージェントはまだ実装されていません（Phase G で実装予定）`,
        duration_ms: Date.now() - start,
        trace_id,
      };
    }
    const message = err instanceof AIAgentError ? err.message : "エージェントの実行中にエラーが発生しました";
    return {
      state:       "failed",
      error:       message,
      duration_ms: Date.now() - start,
      trace_id,
    };
  }

  // ── Post-process ─────────────────────────────────────────────────────────
  try {
    output = await agent.postProcess(context, output);
  } catch {
    // Post-process failure is non-fatal — return the raw output
    return {
      state:       "complete",
      response:    output,
      duration_ms: Date.now() - start,
      trace_id,
    };
  }

  // ── Log usage ────────────────────────────────────────────────────────────
  await logAgentUsage(context, output);

  return {
    state:       "complete",
    response:    output,
    duration_ms: Date.now() - start,
    trace_id,
  };
}
