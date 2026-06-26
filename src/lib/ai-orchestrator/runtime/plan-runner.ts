// DealerOS — AI Orchestration Engine: Plan Runner (Sprint 11K Phase A)
//
// Orchestrates the complete dry-run of an AIExecutionPlan.
//
// Run order:
//   1. Look up workflow spec from ORCHESTRATION_WORKFLOW_REGISTRY
//   2. Build AIExecutionPlan from spec step templates
//   3. Resolve effective AIExecutionPolicy (defaults + workflow overrides + request overrides)
//   4. Build AIFailureStrategyBundle
//   5. Build parallel step groups
//   6. Build cross-agent feed map
//   7. Process steps in topological order:
//      a. Check cancellation token
//      b. Run step dry-run (dependencies → feature gate → approval gate → bridge request)
//      c. Write output_keys to step_outputs context (null placeholders in dry-run)
//      d. Track approval gates
//      e. Simulate failure strategy events for validated steps
//   8. Evaluate overall plan status
//   9. Return AIOrchestratorRuntimeResult
//
// Pure — no "use server", no async, no DB calls, no external calls.

import {
  getWorkflowSpec,
  resolveWorkflowPolicy,
}                                        from "../workflow-registry";
import {
  buildExecutionPlan,
  buildExecutionResult,
  DEFAULT_EXECUTION_POLICY,
}                                        from "../orchestrator-types";
import {
  buildDefaultFailureStrategy,
}                                        from "../failure-strategy";
import type {
  AIOrchestratorRuntimeRequest,
  AIOrchestratorRuntimeResult,
  AIOrchestratorRuntimeContext,
  AIOrchestratorStepResult,
  AIFailureStrategyEvent,
  AIOrchestratorPlanRunner,
}                                        from "./orchestrator-runtime-types";
import {
  buildParallelGroups,
  buildGroupIdForStep,
  runStepDryRun,
}                                        from "./step-runner";
import {
  buildCrossAgentFeedExchanges,
  writeFeedOutputKeys,
}                                        from "./cross-agent-feed";
import {
  validateFailureStrategy,
  simulateFailureStrategyEvents,
  buildDryRunFailureEvent,
}                                        from "./failure-integration";
import type { AIExecutionStatus }        from "../orchestrator-types";

// ─── Context builder ──────────────────────────────────────────────────────────

/**
 * buildRuntimeContext — assembles a full AIOrchestratorRuntimeContext.
 * dealer_id must come from getCurrentDealer() in the calling server action.
 * active_features must be pre-loaded from DB by the calling server action.
 */
export function buildRuntimeContext(
  request:  AIOrchestratorRuntimeRequest,
  plan_id:  string,
  now:      string,
): AIOrchestratorRuntimeContext | null {
  const spec = getWorkflowSpec(request.workflow_id);
  if (!spec) return null;

  // Merge policy: defaults → workflow overrides → request overrides
  const base_policy      = resolveWorkflowPolicy(request.workflow_id);
  const effective_policy = request.policy_overrides
    ? { ...base_policy, ...request.policy_overrides }
    : base_policy;

  // Build the plan from the workflow's step templates
  const plan = buildExecutionPlan(
    plan_id,
    request.dealer_id,
    request.workflow_id,
    request.trigger_event,
    request.trigger_payload,
    spec.step_templates,
    now,
  );

  const failure_strategy = buildDefaultFailureStrategy(request.workflow_id);

  return {
    dealer_id:        request.dealer_id,
    plan,
    policy:           effective_policy,
    failure_strategy,
    execution_mode:   request.execution_mode,
    active_features:  request.active_features,
    step_outputs:     {},
    trace_id:         request.trace_id ?? `trace_${plan_id}`,
    created_at:       now,
  };
}

// ─── Overall status computation ───────────────────────────────────────────────

function computeOverallStatus(
  step_results: AIOrchestratorStepResult[],
): AIExecutionStatus {
  const required = step_results.filter((r) => !r.execution_deferred || r.dry_run_status !== "skipped_optional");

  const has_feature_gate_failure = required.some((r) => r.dry_run_status === "blocked_feature_gate");
  if (has_feature_gate_failure) return "failed";

  const has_cancelled = required.some((r) => r.dry_run_status === "blocked_cancelled");
  if (has_cancelled) return "cancelled";

  const has_dependency_failure = required.some((r) => r.dry_run_status === "blocked_dependency");
  if (has_dependency_failure) return "failed";

  const has_approval_pending = step_results.some((r) => r.dry_run_status === "blocked_approval");
  if (has_approval_pending) return "paused_awaiting_approval";

  const all_validated = step_results.every(
    (r) => r.dry_run_status === "validated" ||
           r.dry_run_status === "skipped_optional" ||
           r.dry_run_status === "blocked_approval", // gates are expected — plan is valid
  );
  if (all_validated) return "pending"; // plan is structurally valid, ready to run

  return "planning";
}

// ─── Plan dry-run function ────────────────────────────────────────────────────

/**
 * runPlanDryRun — executes a complete dry-run of one orchestration plan.
 *
 * dealer_id must come from getCurrentDealer() in the calling server action.
 * plan_id should be a UUID generated by the calling server action.
 */
export function runPlanDryRun(
  request:  AIOrchestratorRuntimeRequest,
  plan_id:  string,
  now:      string,
): AIOrchestratorRuntimeResult {
  // Build context
  const context = buildRuntimeContext(request, plan_id, now);
  if (!context) {
    // Workflow not found — return a failed result
    return {
      plan_id,
      dealer_id:              request.dealer_id,
      workflow_id:            request.workflow_id,
      execution_mode:         request.execution_mode,
      overall_status:         "failed",
      step_results:           [],
      parallel_groups:        [],
      approval_gates_pending: [],
      cross_feed_exchanges:   [],
      failure_strategy_events: [{
        event_type:   "retry_would_exhaust",
        step_id:      null,
        plan_id,
        details:      { reason: `Workflow "${request.workflow_id}" not found in registry` },
        dry_run:      true,
        occurred_at:  now,
      }],
      steps_validated:  0,
      steps_blocked:    0,
      steps_skipped:    0,
      dry_run:          true,
      plan_built_at:    now,
      completed_at:     now,
    };
  }

  const { plan, policy, failure_strategy } = context;
  const steps = plan.steps;

  // Validate failure strategy structurally
  const strategy_validation = validateFailureStrategy(failure_strategy);
  const strategy_events: AIFailureStrategyEvent[] = [];
  if (!strategy_validation.is_valid) {
    // Log structural errors as simulated events
    for (const err of strategy_validation.errors) {
      strategy_events.push(buildDryRunFailureEvent(
        "retry_would_exhaust", null, plan_id, { error: err }, now,
      ));
    }
  }

  // Build parallel groups
  const parallel_groups = buildParallelGroups(steps, policy.max_parallel_steps);

  // Build cross-agent feed exchange map
  const cross_feed_exchanges = buildCrossAgentFeedExchanges(steps, now);

  // Process steps in topological order (depth 0 first, then 1, etc.)
  const step_results:         AIOrchestratorStepResult[] = [];
  const completed_step_ids    = new Set<string>();
  const approval_gates_pending: string[] = [];

  // Sort steps: depth 0 first, then increasing depth
  const depthMap = new Map<string, number>();
  for (const g of parallel_groups) {
    for (const sid of g.step_ids) {
      depthMap.set(sid, g.depth);
    }
  }
  const sorted_steps = [...steps].sort((a, b) => {
    const da = depthMap.get(a.step_id) ?? 0;
    const db = depthMap.get(b.step_id) ?? 0;
    return da - db;
  });

  let step_outputs = { ...context.step_outputs };

  for (const step of sorted_steps) {
    const parallel_group_id = buildGroupIdForStep(step.step_id, parallel_groups);

    // Run the step dry-run
    const result = runStepDryRun(
      step,
      { ...context, step_outputs },
      completed_step_ids,
      parallel_group_id,
      now,
    );

    step_results.push(result);

    if (result.dry_run_status === "validated") {
      // Write output key placeholders to the shared context
      step_outputs = writeFeedOutputKeys(step, step_outputs);
      completed_step_ids.add(step.step_id);

      // Simulate failure strategy events for validated steps (what WOULD happen on failure)
      const step_failure_events = simulateFailureStrategyEvents(
        step.step_id,
        plan_id,
        failure_strategy,
        now,
      );
      strategy_events.push(...step_failure_events);

    } else if (result.dry_run_status === "blocked_approval") {
      // Approval gates don't block dependency resolution in dry-run —
      // we note the gate and continue to show the full plan picture.
      approval_gates_pending.push(step.step_id);
      step_outputs = writeFeedOutputKeys(step, step_outputs);
      completed_step_ids.add(step.step_id); // treat as "complete" for dependency purposes

    } else if (result.dry_run_status === "skipped_optional") {
      // Optional steps are marked as skipped but do not block downstream steps
      completed_step_ids.add(step.step_id);

    }
    // blocked_dependency, blocked_feature_gate, blocked_cancelled, blocked_gateway:
    // Step NOT added to completed_step_ids → downstream steps will see blocked_dependency
  }

  const overall_status = computeOverallStatus(step_results);

  return {
    plan_id,
    dealer_id:               request.dealer_id,
    workflow_id:             request.workflow_id,
    execution_mode:          request.execution_mode,
    overall_status,
    step_results,
    parallel_groups,
    approval_gates_pending,
    cross_feed_exchanges,
    failure_strategy_events: strategy_events,
    steps_validated:         step_results.filter((r) => r.dry_run_status === "validated").length,
    steps_blocked:           step_results.filter((r) => r.dry_run_status.startsWith("blocked_")).length,
    steps_skipped:           step_results.filter((r) => r.dry_run_status === "skipped_optional").length,
    dry_run:                 true,
    plan_built_at:           now,
    completed_at:            now,
  };
}

// ─── AIOrchestratorPlanRunner implementation ──────────────────────────────────

export function createPlanRunner(): AIOrchestratorPlanRunner {
  return {
    execution_mode: "dry_run",

    runPlan(
      request: AIOrchestratorRuntimeRequest,
      plan_id: string,
      now:     string,
    ): AIOrchestratorRuntimeResult {
      return runPlanDryRun(request, plan_id, now);
    },
  };
}
