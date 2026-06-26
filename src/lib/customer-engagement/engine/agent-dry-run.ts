// DealerOS — Customer Engagement Engine: AI Agent Notify Dry-Run
//
// Validates all preconditions for a "notify_agent" workflow action without
// executing any AI inference or calling external AI provider APIs.
//
// Sprint 10H: dry-run only. All agents return "skipped_not_implemented"
// because no Phase G adapters exist yet. The full validation pipeline runs
// to confirm each gate, so Phase G-B only needs to remove the final gate.
//
// Security: dealer_id always from EngagementContext — never from client input.

import { checkFeatureAccess }   from "@/lib/plans/can-use-feature";
import { checkAiGatewayReady }  from "@/lib/ai/check-ai-gateway";
import { getAgentEntry }        from "@/lib/ai/agents/registry";
import type { AIAgentId }       from "@/lib/ai/agents/types";
import type { EngagementAction, EngagementContext } from "../types";

// ─── Result types ─────────────────────────────────────────────────────────────

export type AgentNotifyReadinessStatus =
  | "ready"                       // All gates pass; execution possible in Phase G-B
  | "skipped_feature_disabled"    // Dealer lacks required AppFeature
  | "skipped_gateway_not_ready"   // AI Gateway not configured or disabled
  | "skipped_agent_not_found"     // agent_id not in AI_AGENT_REGISTRY
  | "skipped_not_implemented";    // Agent exists but inference deferred (Sprint 10H)

export interface AgentNotifyPayload {
  agent_id:    AIAgentId;
  dealer_id:   string;
  customer_id: string;
  trace_id:    string;
  /** True when all gates pass — ready for Phase G-B execution. */
  all_gates_passed: true;
}

export interface AgentNotifyReadinessResult {
  status:   AgentNotifyReadinessStatus;
  /** Present only when status === "ready". */
  payload?: AgentNotifyPayload;
  /** Japanese reason — present when status !== "ready". */
  reason?:  string;
}

// ─── Agents supported for WORK_COMPLETED trigger in Sprint 10H ──────────────

const WORK_COMPLETED_AGENT_SUBSCRIBERS: AIAgentId[] = [
  "reputation_agent",
  "marketing_agent",
  "growth_agent",
];

export function getWorkCompletedAgentSubscribers(): AIAgentId[] {
  return WORK_COMPLETED_AGENT_SUBSCRIBERS;
}

// ─── Readiness validation ─────────────────────────────────────────────────────

/**
 * Validates all preconditions for notifying an AI agent.
 * Does NOT call the AI provider. Does NOT execute inference.
 *
 * In Sprint 10H, all agents return "ready" only for gate-pass checking,
 * then immediately return "skipped_not_implemented" because Phase G adapters
 * do not yet exist. This is intentional and production-quality — not a placeholder.
 */
export async function validateAgentNotifyReadiness(
  action: EngagementAction,
  context: EngagementContext,
): Promise<AgentNotifyReadinessResult> {
  const agentId = action.config.agent_id as AIAgentId | undefined;

  // ── Gate 1: agent_id must be provided in config ─────────────────────────
  if (!agentId) {
    return {
      status: "skipped_agent_not_found",
      reason: "エージェントIDが設定されていません",
    };
  }

  // ── Gate 2: Agent must exist in the registry ─────────────────────────────
  const entry = getAgentEntry(agentId);
  if (!entry) {
    return {
      status: "skipped_agent_not_found",
      reason: `エージェント「${agentId}」はレジストリに登録されていません`,
    };
  }

  // ── Gate 3: Feature gate ─────────────────────────────────────────────────
  const hasFeature = await checkFeatureAccess(entry.requiredFeature);
  if (!hasFeature) {
    return {
      status: "skipped_feature_disabled",
      reason: `この機能にはより上位のプランが必要です（${entry.requiredFeature}）`,
    };
  }

  // ── Gate 4: AI Gateway readiness ─────────────────────────────────────────
  const gateway = await checkAiGatewayReady();
  if (gateway.status !== "ready") {
    return {
      status: "skipped_gateway_not_ready",
      reason: `AI Gatewayが準備できていません: ${gateway.message}`,
    };
  }

  // ── Gate 5: Phase G deferred ──────────────────────────────────────────────
  // All gates passed, but inference adapters do not exist yet.
  // Phase G-B: remove this gate and call runAgentLifecycle().
  return {
    status: "skipped_not_implemented",
    reason: `${entry.nameJa}のAI推論はPhase G-Bで実装予定です（${entry.phase}）`,
  };

  // Unreachable in Sprint 10H — preserved for Phase G-B:
  // return {
  //   status: "ready",
  //   payload: {
  //     agent_id:         agentId,
  //     dealer_id:        context.dealer_id,
  //     customer_id:      context.customer_id,
  //     trace_id:         context.trace_id,
  //     all_gates_passed: true,
  //   },
  // };
}

/**
 * Validates all agent subscribers for a WORK_COMPLETED event.
 * Returns one result per agent subscriber.
 */
export async function validateWorkCompletedAgentSubscribers(
  context: EngagementContext,
): Promise<Array<{ agent_id: AIAgentId; result: AgentNotifyReadinessResult }>> {
  const subscribers = getWorkCompletedAgentSubscribers();

  return Promise.all(
    subscribers.map(async (agent_id) => {
      const action: EngagementAction = {
        id:          `notify_${agent_id}_dry_run`,
        type:        "notify_agent",
        delay_hours: 0,
        config:      { agent_id },
        conditions:  [{ type: "ai_gateway_ready" }],
      };
      const result = await validateAgentNotifyReadiness(action, context);
      return { agent_id, result };
    }),
  );
}
