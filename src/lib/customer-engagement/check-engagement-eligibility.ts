// DealerOS — Customer Engagement Platform: Eligibility Check
//
// Server-side utility — NOT a "use server" action.
// Evaluates whether a trigger is eligible to fire for the current dealer context.
//
// Integration points:
//   - Feature Registry: AppFeature gate via checkFeatureAccess()
//   - AI Gateway: checkAiGatewayReady() for AI-dependent triggers
//   - Trigger Registry: reads ENGAGEMENT_TRIGGER_REGISTRY

import { checkFeatureAccess }  from "@/lib/plans/can-use-feature";
import { checkAiGatewayReady } from "@/lib/ai/check-ai-gateway";
import type { EngagementTrigger, TriggerEligibilityResult, EngagementTriggerId } from "./triggers";
import { ENGAGEMENT_TRIGGER_REGISTRY }                                           from "./triggers";

// ─── Single-trigger eligibility ───────────────────────────────────────────────

export async function checkTriggerEligibility(
  trigger: EngagementTrigger,
): Promise<TriggerEligibilityResult> {
  if (!trigger.enabled) {
    return {
      eligible:   false,
      trigger_id: trigger.id,
      reason:     "このトリガーは現在無効です",
    };
  }

  // Feature gate
  if (trigger.required_feature) {
    const hasFeature = await checkFeatureAccess(trigger.required_feature);
    if (!hasFeature) {
      return {
        eligible:   false,
        trigger_id: trigger.id,
        reason:     `この機能にはより上位のプランが必要です（${trigger.required_feature}）`,
      };
    }
  }

  // AI Gateway check — required when any action routes through an AI agent
  const needsGateway = trigger.agent_subscribers.length > 0;
  if (needsGateway) {
    const gateway = await checkAiGatewayReady();
    if (gateway.status !== "ready") {
      // Non-blocking: gateway check failure skips AI-dependent actions but
      // allows non-AI actions (e.g., send_line_message) to proceed.
      // The eligibility result is still "eligible" so LINE actions can run;
      // individual action conditions will gate the AI-dependent steps.
      // This is intentional: not all actions in a workflow require the gateway.
    }
  }

  return { eligible: true, trigger_id: trigger.id };
}

// ─── Multi-trigger eligibility for an event ───────────────────────────────────

export interface EventEligibilityResult {
  eligible_triggers: TriggerEligibilityResult[];
  ineligible_triggers: TriggerEligibilityResult[];
}

export async function checkEventEligibility(
  trigger_ids: EngagementTriggerId[],
): Promise<EventEligibilityResult> {
  const triggers = trigger_ids
    .map((id) => ENGAGEMENT_TRIGGER_REGISTRY.find((t) => t.id === id))
    .filter((t): t is EngagementTrigger => t !== undefined);

  const results = await Promise.all(
    triggers.map((t) => checkTriggerEligibility(t)),
  );

  return {
    eligible_triggers:   results.filter((r) => r.eligible),
    ineligible_triggers: results.filter((r) => !r.eligible),
  };
}
