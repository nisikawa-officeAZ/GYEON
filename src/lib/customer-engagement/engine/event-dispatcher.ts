// DealerOS — Customer Engagement Engine: Event Dispatcher
//
// Implements EngagementEventDispatcher.
// Routes a single EngagementEvent to all eligible triggers and runs each workflow.

import { getTriggersForEvent }         from "../triggers";
import { getWorkflow }                  from "../workflow";
import { createEngagementContext }      from "../context";
import { checkTriggerEligibility }      from "../check-engagement-eligibility";
import { EngagementActionDispatcherImpl } from "./action-dispatcher";
import type {
  EngagementEventDispatcher,
  EventDispatchResult,
  WorkflowExecutionResult,
} from "./types";
import type { EngagementEvent, EngagementEventType } from "../events";
import type { EngagementWorkflowId }                 from "../types";

// ─── Implementation ───────────────────────────────────────────────────────────

export class EngagementEventDispatcherImpl implements EngagementEventDispatcher {
  async dispatchEvent<T extends EngagementEventType>(
    event: EngagementEvent<T>,
  ): Promise<EventDispatchResult> {
    const triggers = getTriggersForEvent(event.event_type);

    if (triggers.length === 0) {
      return {
        trace_id:           event.trace_id,
        triggers_found:     0,
        triggers_eligible:  0,
        triggers_skipped:   0,
        workflow_results:   [],
      };
    }

    let eligible = 0;
    let skipped  = 0;
    const workflowResults: WorkflowExecutionResult[] = [];

    for (const trigger of triggers) {
      const check = await checkTriggerEligibility(trigger);

      if (!check.eligible) {
        skipped++;
        workflowResults.push({
          success:           false,
          trace_id:          event.trace_id,
          workflow_id:       trigger.workflow_id,
          actions_total:     0,
          actions_completed: 0,
          actions_failed:    0,
          actions_skipped:   1,
          error:             check.reason,
        });
        continue;
      }

      eligible++;
      const result = await this._runWorkflow(trigger.workflow_id, event);
      workflowResults.push(result);
    }

    return {
      trace_id:          event.trace_id,
      triggers_found:    triggers.length,
      triggers_eligible: eligible,
      triggers_skipped:  skipped,
      workflow_results:  workflowResults,
    };
  }

  // ─── Private: run one workflow ─────────────────────────────────────────────

  private async _runWorkflow<T extends EngagementEventType>(
    workflowId: EngagementWorkflowId,
    event:      EngagementEvent<T>,
  ): Promise<WorkflowExecutionResult> {
    const workflow = getWorkflow(workflowId);

    if (!workflow) {
      return {
        success:           false,
        trace_id:          event.trace_id,
        workflow_id:       workflowId,
        actions_total:     0,
        actions_completed: 0,
        actions_failed:    1,
        actions_skipped:   0,
        error:             `ワークフロー「${workflowId}」が見つかりません`,
      };
    }

    if (!workflow.enabled) {
      return {
        success:           true,
        trace_id:          event.trace_id,
        workflow_id:       workflowId,
        actions_total:     0,
        actions_completed: 0,
        actions_failed:    0,
        actions_skipped:   workflow.actions.length,
      };
    }

    const ctx = await createEngagementContext(event);
    if (!ctx) {
      return {
        success:           false,
        trace_id:          event.trace_id,
        workflow_id:       workflowId,
        actions_total:     workflow.actions.length,
        actions_completed: 0,
        actions_failed:    1,
        actions_skipped:   0,
        error:             "認証エラー: ディーラーコンテキストを作成できませんでした",
      };
    }

    const dispatcher = new EngagementActionDispatcherImpl();
    const results    = await dispatcher.dispatchAll(workflow.actions, ctx, event);

    const completed = results.filter((r) => r.status === "completed").length;
    const failed    = results.filter((r) => r.status === "failed").length;
    const skipped   = results.filter((r) => r.status === "skipped").length;

    return {
      success:           failed === 0,
      trace_id:          event.trace_id,
      workflow_id:       workflowId,
      actions_total:     results.length,
      actions_completed: completed,
      actions_failed:    failed,
      actions_skipped:   skipped,
    };
  }
}
