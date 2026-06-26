// DealerOS — Customer Engagement Engine: Workflow Runtime
//
// EngagementWorkflowRuntime — top-level orchestrator.
// Implements WorkflowExecutionEngine from engine/types.ts.
//
// Sprint 10H: dry-run only.
//   - Validates every precondition for each triggered workflow action
//   - Returns fully typed WorkflowExecutionResults
//   - No LINE API calls, no database writes, no AI inference
//   - Never throws — all errors produce a structured result
//
// Usage (from a server action after work order completion):
//   const engine = new EngagementWorkflowRuntime();
//   const result = await engine.dispatch(event);

import { EngagementEventDispatcherImpl } from "./event-dispatcher";
import type { WorkflowExecutionEngine, WorkflowExecutionResult } from "./types";
import type { EngagementEvent, EngagementEventType }             from "../events";

export class EngagementWorkflowRuntime implements WorkflowExecutionEngine {
  async dispatch<T extends EngagementEventType>(
    event: EngagementEvent<T>,
  ): Promise<WorkflowExecutionResult> {
    try {
      const dispatcher = new EngagementEventDispatcherImpl();
      const result     = await dispatcher.dispatchEvent(event);

      // Aggregate across all workflow results
      const allResults     = result.workflow_results;
      const actions_total     = sum(allResults, "actions_total");
      const actions_completed = sum(allResults, "actions_completed");
      const actions_failed    = sum(allResults, "actions_failed");
      const actions_skipped   = sum(allResults, "actions_skipped");

      const firstWorkflow = allResults[0];

      return {
        success:            actions_failed === 0,
        trace_id:           event.trace_id,
        workflow_id:        firstWorkflow?.workflow_id,
        actions_total,
        actions_completed,
        actions_failed,
        actions_skipped,
      };
    } catch (err) {
      // dispatch() must never throw — convert any unexpected error to a result
      console.error("[EngagementWorkflowRuntime] unexpected error:", err);
      return {
        success:            false,
        trace_id:           event.trace_id,
        actions_total:      0,
        actions_completed:  0,
        actions_failed:     1,
        actions_skipped:    0,
        error:              "エンゲージメントランタイムで予期しないエラーが発生しました",
      };
    }
  }
}

function sum(
  results: WorkflowExecutionResult[],
  key: "actions_total" | "actions_completed" | "actions_failed" | "actions_skipped",
): number {
  return results.reduce((acc, r) => acc + r[key], 0);
}
