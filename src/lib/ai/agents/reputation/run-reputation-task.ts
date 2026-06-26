"use server";

// DealerOS — AI Reputation Agent: Server Action
//
// Entry point for all reputation agent tasks.
// Runs the full execution policy gate → context → lifecycle.
//
// Security:
//   - dealer_id is NEVER accepted from the client; always from createAgentContext()
//   - All errors are user-readable Japanese strings; no internal details leaked
//   - Pro+ feature gate enforced in checkExecutionPolicy()

import { checkExecutionPolicy } from "@/lib/ai/agents/execution-policy";
import { createAgentContext }   from "@/lib/ai/agents/execution-policy";
import { runAgentLifecycle }    from "@/lib/ai/agents/lifecycle";
import { ReputationAgent }      from "./reputation-agent";
import type { ReputationAgentRequest, ReputationAgentResponse } from "./types";

export async function runReputationTask(
  input: ReputationAgentRequest,
): Promise<ReputationAgentResponse> {
  const now = new Date().toISOString();

  // ── Gate 1–4: feature, gateway, auth, usage policy ────────────────────────
  const policy = await checkExecutionPolicy("reputation_agent");
  if (!policy.allowed) {
    return {
      agent_id:    "reputation_agent",
      task_type:   input.task_type,
      success:     false,
      trace_id:    input.trace_id ?? "",
      executed_at: now,
      error:       policy.reason ?? "AI評判管理エージェントは利用できません",
    };
  }

  // ── Context (dealer_id from getCurrentDealer — never from client) ──────────
  const ctx = await createAgentContext("reputation_agent");
  if (!ctx) {
    return {
      agent_id:    "reputation_agent",
      task_type:   input.task_type,
      success:     false,
      trace_id:    input.trace_id ?? "",
      executed_at: now,
      error:       "認証エラーが発生しました。再度ログインしてください",
    };
  }

  // ── Agent lifecycle ────────────────────────────────────────────────────────
  const result = await runAgentLifecycle(new ReputationAgent(), ctx, input);

  if (!result.response) {
    return {
      agent_id:    "reputation_agent",
      task_type:   input.task_type,
      success:     false,
      trace_id:    result.trace_id,
      executed_at: now,
      error:       result.error ?? "エージェントの実行に失敗しました",
    };
  }

  return result.response;
}
