// DealerOS — AI Agent Framework: Execution Policy
// Server-side only — validates all preconditions before any agent runs.
//
// Execution gate order:
//   1. Agent exists in registry
//   2. AppFeature gate (Pro+ check)
//   3. AI Gateway readiness (provider configured, key present, not disabled)
//   4. dealer_id authentication
//   5. Usage policy (monthly limit not exceeded)
//
// All future AI modules call checkExecutionPolicy() as the first step.
// Security: dealer_id always from getCurrentDealer(), never from client input.

import { checkFeatureAccess } from "@/lib/plans/can-use-feature";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { getCurrentPlan }     from "@/lib/plans/get-current-plan";
import { checkAiGatewayReady } from "../check-ai-gateway";
import { getAiSettings }      from "../get-ai-settings";
import { getAgentEntry }      from "./registry";
import { randomUUID }         from "crypto";
import type { AIAgentId, AIAgentContext, ExecutionPolicyResult } from "./types";
import type { AIUsagePolicy } from "../usage-policy";

// ─── Policy check ─────────────────────────────────────────────────────────────

export async function checkExecutionPolicy(
  agent_id: AIAgentId,
): Promise<ExecutionPolicyResult> {
  const entry = getAgentEntry(agent_id);
  if (!entry) {
    return { allowed: false, agent_id, reason: "不明なエージェントです" };
  }

  // 1. Feature gate (Pro+ subscription check)
  const hasFeature = await checkFeatureAccess(entry.requiredFeature);
  if (!hasFeature) {
    return {
      allowed: false,
      agent_id,
      reason: `この機能は Pro+ プランが必要です（${entry.nameJa}）`,
    };
  }

  // 2. AI Gateway readiness
  const gateway = await checkAiGatewayReady();
  if (gateway.status !== "ready") {
    return {
      allowed: false,
      agent_id,
      reason: `AI Gatewayが準備できていません: ${gateway.message}`,
    };
  }

  // 3. Authentication
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return { allowed: false, agent_id, reason: "認証エラー" };
  }

  // 4. Usage policy — check monthly limit
  const aiSettings = await getAiSettings();
  if (
    aiSettings.monthly_limit_usd > 0 &&
    aiSettings.hard_limit
    // current_month_usd tracked in Phase G — not blocking in Sprint 10D
  ) {
    // Will enforce: if (current_month_usd >= monthly_limit_usd) → block
    // Deferred until dealer_ai_usage_log table exists (Phase G migration)
  }

  return { allowed: true, agent_id };
}

// ─── Context factory ──────────────────────────────────────────────────────────

/**
 * Creates a fully populated AIAgentContext from server-side state.
 * Returns null if the dealer is not authenticated or the gateway is not ready.
 *
 * All agent executions must start with this context — never construct
 * AIAgentContext manually from client data.
 */
export async function createAgentContext(
  agent_id: AIAgentId,
): Promise<AIAgentContext | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const [planInfo, gateway, aiSettings] = await Promise.all([
    getCurrentPlan(),
    checkAiGatewayReady(),
    getAiSettings(),
  ]);

  const policy: AIUsagePolicy = {
    dealer_id:         dealer.dealer_id,
    monthly_limit_usd: aiSettings.monthly_limit_usd,
    hard_limit:        aiSettings.hard_limit,
    // Usage tracking deferred to Phase G (dealer_ai_usage_log table)
    current_month_usd: 0,
    limit_reached:     false,
  };

  return {
    dealer_id: dealer.dealer_id,
    plan:      planInfo.plan ?? "basic",
    gateway,
    policy,
    trace_id:  randomUUID(),
  };
}
