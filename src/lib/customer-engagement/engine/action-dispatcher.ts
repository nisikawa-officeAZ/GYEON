// DealerOS — Customer Engagement Engine: Action Dispatcher
//
// Implements EngagementActionDispatcher.
// Routes each workflow action to the appropriate dry-run validator.
//
// Sprint 10H produces typed ActionDispatchResults for every action.
// No external API calls. No database writes.
// All action types return a typed result — no action is silently dropped.

import { checkFeatureAccess }           from "@/lib/plans/can-use-feature";
import { validateLineActionReadiness }   from "./line-dry-run";
import { validateAgentNotifyReadiness }  from "./agent-dry-run";
import { runLineAction, runMaintenanceReminderAction } from "./action-runtime";
import type {
  EngagementActionDispatcher,
  ActionDispatchResult,
} from "./types";
import type { EngagementAction, EngagementContext } from "../types";
import type { EngagementEvent }                     from "../events";

// ─── Implementation ───────────────────────────────────────────────────────────

export class EngagementActionDispatcherImpl implements EngagementActionDispatcher {
  async dispatchAction(
    action:  EngagementAction,
    context: EngagementContext,
    _event:  EngagementEvent,
  ): Promise<ActionDispatchResult> {
    // ── Per-action feature gate ──────────────────────────────────────────────
    if (action.required_feature) {
      const has = await checkFeatureAccess(action.required_feature);
      if (!has) {
        return skipped(action, `機能が無効です（${action.required_feature}）`);
      }
    }

    // ── Route by action type ─────────────────────────────────────────────────
    switch (action.type) {

      case "send_line_message":
      case "request_review": {
        const lineResult = await validateLineActionReadiness(action, context);
        if (lineResult.status !== "ready" || !lineResult.payload) {
          return skipped(action, lineResult.reason ?? "LINE条件が満たされていません");
        }
        // Phase 4 Sprint 5: enqueue to line_notification_queue (line_connected-gated,
        // deduped, audited). Actual delivery is handled by the Sprint 3 queue processor.
        return runLineAction(action, context, lineResult.payload);
      }

      case "notify_agent": {
        const agentResult = await validateAgentNotifyReadiness(action, context);
        if (agentResult.status === "ready") {
          // Should not happen in Sprint 10H (all agents are skipped_not_implemented).
          return skipped(action, "エージェント実行はPhase G-Bで実装予定です");
        }
        return skipped(action, agentResult.reason ?? "エージェント通知をスキップしました");
      }

      case "schedule_maintenance_reminder": {
        const lineResult = await validateLineActionReadiness(action, context);
        if (lineResult.status !== "ready" || !lineResult.payload) {
          return skipped(action, lineResult.reason ?? "LINE条件が満たされていません");
        }
        // Phase 4 Sprint 5: create a maintenance_reminders row (Sprint 1 infra).
        return runMaintenanceReminderAction(action, context);
      }

      case "update_customer_tag":
        // No customer_tags table in Sprint 10H — skip with clear reason.
        return skipped(action, "顧客タグ機能はPhase G-Bで実装予定です（テーブル未作成）");

      case "create_task":
        return skipped(action, "タスク作成機能はPhase G-Bで実装予定です（テーブル未作成）");

      case "send_marketing_campaign":
        return skipped(action, "マーケティングキャンペーン機能はPhase G-Bで実装予定です");

      default:
        return skipped(action, "未知のアクションタイプです");
    }
  }

  async dispatchAll(
    actions: EngagementAction[],
    context: EngagementContext,
    event:   EngagementEvent,
  ): Promise<ActionDispatchResult[]> {
    const results: ActionDispatchResult[] = [];
    for (const action of actions) {
      const result = await this.dispatchAction(action, context, event);
      results.push(result);
    }
    return results;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function skipped(action: EngagementAction, reason: string): ActionDispatchResult {
  return {
    action_id:   action.id,
    action_type: action.type,
    status:      "skipped",
    error:       reason,
  };
}
