// DealerOS — AI Orchestration Engine: Step Runner (Sprint 11K Phase B + C)
//
// Validates and processes individual execution steps in dry-run mode.
//
// Phase B — Sequential step dry-run:
//   For each step in dependency order:
//     1. Check cancellation token
//     2. Validate all depends_on step_ids have completed
//     3. Validate the step's agent has a required feature active for this dealer
//     4. Check dealer approval gate
//     5. Build the AI Gateway bridge request
//     6. Return AIOrchestratorStepResult
//
// Phase C — Parallel step grouping:
//   Assign each step a depth (max depends_on depth + 1).
//   Steps at the same depth can form a parallel group.
//   Respects is_parallel flag and max_parallel_steps policy.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import { getAgentEntry }             from "@/lib/ai/agents/registry";
import type { AppFeature }           from "@/lib/plans/plan-types";
import type { AIExecutionStep }      from "../orchestrator-types";
import { buildBridgeRequest, buildDeferredBridgeResponse } from "../provider-bridge";
import type {
  AIOrchestratorRuntimeContext,
  AIOrchestratorStepResult,
  AIStepDryRunStatus,
  AIParallelStepGroup,
  AIOrchestratorStepRunner,
}                                    from "./orchestrator-runtime-types";
import { evaluateApprovalGate }      from "./approval-gate";
import { checkCancellationToken }    from "./failure-integration";

// ─── Dependency validation ────────────────────────────────────────────────────

interface DependencyValidation {
  valid:   boolean;
  missing: string[];
}

function validateStepDependencies(
  step:               AIExecutionStep,
  completed_step_ids: Set<string>,
  all_step_ids:       Set<string>,
): DependencyValidation {
  const missing: string[] = [];

  for (const dep_id of step.depends_on) {
    if (!all_step_ids.has(dep_id)) {
      missing.push(`depends_on references unknown step_id "${dep_id}"`);
    } else if (!completed_step_ids.has(dep_id)) {
      missing.push(`depends_on step "${dep_id}" has not been validated yet`);
    }
  }

  return { valid: missing.length === 0, missing };
}

// ─── Feature gate validation ──────────────────────────────────────────────────

interface FeatureGateValidation {
  valid:            boolean;
  required_feature: AppFeature | null;
  error:            string | null;
}

function validateStepFeatureGate(
  step:            AIExecutionStep,
  active_features: AppFeature[],
): FeatureGateValidation {
  const entry = getAgentEntry(step.agent_id);
  if (!entry) {
    return {
      valid:            false,
      required_feature: null,
      error:            `Agent "${step.agent_id}" is not registered in AI_AGENT_REGISTRY`,
    };
  }

  const required = entry.requiredFeature;
  if (!active_features.includes(required)) {
    return {
      valid:            false,
      required_feature: required,
      error:            `Agent "${step.agent_id}" requires feature "${required}" which is not active for this dealer`,
    };
  }

  return { valid: true, required_feature: required, error: null };
}

// ─── Step result builder ──────────────────────────────────────────────────────

function buildStepResult(
  step:                    AIExecutionStep,
  dry_run_status:          AIStepDryRunStatus,
  bridge_request:          ReturnType<typeof buildBridgeRequest> | null,
  validation_errors:       string[],
  approval_gate_triggered: boolean,
  parallel_group_id:       string | null,
  now:                     string,
): AIOrchestratorStepResult {
  const bridge_response = bridge_request
    ? buildDeferredBridgeResponse(step.step_id, bridge_request.plan_id, now)
    : null;

  return {
    step_id:                  step.step_id,
    agent_id:                 step.agent_id,
    task_type:                step.task_type,
    label:                    step.label,
    dry_run_status,
    bridge_request:           bridge_request ?? null,
    bridge_response,
    validation_errors,
    approval_gate_triggered,
    parallel_group_id,
    execution_deferred:       true,
    validated_at:             now,
  };
}

// ─── Core step dry-run function ───────────────────────────────────────────────

/**
 * runStepDryRun — validates one step and returns its dry-run result.
 *
 * Processing order:
 *   1. Cancellation check
 *   2. Dependency validation
 *   3. Feature gate validation
 *   4. Approval gate detection
 *   5. Bridge request construction
 */
export function runStepDryRun(
  step:               AIExecutionStep,
  context:            AIOrchestratorRuntimeContext,
  completed_step_ids: Set<string>,
  parallel_group_id:  string | null,
  now:                string,
): AIOrchestratorStepResult {
  const all_step_ids = new Set(context.plan.steps.map((s) => s.step_id));

  // 1. Cancellation check
  const cancellation = checkCancellationToken(
    context.failure_strategy.cancellation,
    step.step_id,
  );
  if (cancellation.should_cancel) {
    return buildStepResult(
      step, "blocked_cancelled",
      null,
      [cancellation.reason ?? "Plan cancelled"],
      false, parallel_group_id, now,
    );
  }

  // 2. Dependency validation
  const deps = validateStepDependencies(step, completed_step_ids, all_step_ids);
  if (!deps.valid) {
    return buildStepResult(
      step, "blocked_dependency",
      null,
      deps.missing,
      false, parallel_group_id, now,
    );
  }

  // 3. Feature gate validation
  const gate = validateStepFeatureGate(step, context.active_features);
  if (!gate.valid) {
    if (step.is_optional) {
      return buildStepResult(
        step, "skipped_optional",
        null,
        [gate.error ?? "Feature gate check failed"],
        false, parallel_group_id, now,
      );
    }
    return buildStepResult(
      step, "blocked_feature_gate",
      null,
      [gate.error ?? "Feature gate check failed"],
      false, parallel_group_id, now,
    );
  }

  // 4. Approval gate detection
  const approval_gate_status = evaluateApprovalGate(step, context.policy);
  const approval_gate_triggered = approval_gate_status !== "not_required";

  // 5. Build bridge request for structurally valid steps
  const bridge_request = buildBridgeRequest(
    context.dealer_id,
    step.agent_id,
    step.task_type,
    context.plan.workflow_id,
    step.step_id,
    context.plan.plan_id,
    context.trace_id,
    {}, // In dry-run, no actual input payload — cross-agent feed resolver populates this in live mode
    now,
  );

  return buildStepResult(
    step,
    approval_gate_triggered ? "blocked_approval" : "validated",
    bridge_request,
    [],
    approval_gate_triggered,
    parallel_group_id,
    now,
  );
}

// ─── Parallel grouping (Phase C) ──────────────────────────────────────────────

/**
 * computeStepDepths — assigns each step a depth based on its dependency chain.
 * Depth 0 = no dependencies (root steps).
 * Depth N = max(depends_on depths) + 1.
 */
function computeStepDepths(steps: AIExecutionStep[]): Map<string, number> {
  const depths = new Map<string, number>();
  const stepMap = new Map(steps.map((s) => [s.step_id, s]));

  function getDepth(step_id: string, visited = new Set<string>()): number {
    if (depths.has(step_id)) return depths.get(step_id)!;
    if (visited.has(step_id)) return 0; // cycle guard — should not occur in valid plans

    visited.add(step_id);
    const step = stepMap.get(step_id);
    if (!step || step.depends_on.length === 0) {
      depths.set(step_id, 0);
      return 0;
    }
    const maxDep = Math.max(...step.depends_on.map((d) => getDepth(d, visited)));
    const depth  = maxDep + 1;
    depths.set(step_id, depth);
    return depth;
  }

  steps.forEach((s) => getDepth(s.step_id));
  return depths;
}

/**
 * buildParallelGroups — groups steps into parallel execution groups.
 *
 * Steps at the same depth with is_parallel: true are grouped together.
 * Sequential steps (is_parallel: false) at the same depth form single-step groups.
 * Groups respect the policy's max_parallel_steps limit.
 */
export function buildParallelGroups(
  steps:          AIExecutionStep[],
  max_parallel:   number,
): AIParallelStepGroup[] {
  const depths = computeStepDepths(steps);
  const stepMap = new Map(steps.map((s) => [s.step_id, s]));

  // Group steps by depth
  const byDepth = new Map<number, AIExecutionStep[]>();
  for (const step of steps) {
    const d = depths.get(step.step_id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(step);
  }

  const groups: AIParallelStepGroup[] = [];
  const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);

  for (const depth of sortedDepths) {
    const stepsAtDepth = byDepth.get(depth)!;
    const parallel_eligible = stepsAtDepth.filter((s) => s.is_parallel);
    const sequential_only   = stepsAtDepth.filter((s) => !s.is_parallel);

    // Compute which group_ids this depth depends on
    const depends_on_group_ids = groups
      .filter((g) => g.depth === depth - 1)
      .map((g) => g.group_id);

    // Group all parallel-eligible steps together
    if (parallel_eligible.length > 0) {
      const group_id = `group_d${depth}_p`;
      groups.push({
        group_id,
        step_ids:              parallel_eligible.map((s) => s.step_id),
        depends_on_group_ids,
        depth,
        can_execute_parallel:  true,
        effective_parallelism: Math.min(parallel_eligible.length, max_parallel),
      });
    }

    // Each sequential step gets its own group
    for (const seq_step of sequential_only) {
      const group_id = `group_d${depth}_seq_${seq_step.step_id}`;
      const prev_parallel = parallel_eligible.length > 0 ? [`group_d${depth}_p`] : depends_on_group_ids;
      groups.push({
        group_id,
        step_ids:              [seq_step.step_id],
        depends_on_group_ids:  prev_parallel,
        depth,
        can_execute_parallel:  false,
        effective_parallelism: 1,
      });
    }
  }

  // Assign sequential groups to their steps' group IDs for cross-referencing
  // (The consumer will look up group_id from the step_id map)
  return groups;
}

/**
 * buildGroupIdForStep — returns the parallel_group_id for a given step,
 * given the already-computed parallel groups.
 */
export function buildGroupIdForStep(
  step_id: string,
  groups:  AIParallelStepGroup[],
): string | null {
  const group = groups.find((g) => g.step_ids.includes(step_id));
  return group?.group_id ?? null;
}

// ─── AIOrchestratorStepRunner implementation ──────────────────────────────────

export function createStepRunner(): AIOrchestratorStepRunner {
  return {
    execution_mode: "dry_run",

    runStep(
      step,
      context,
      completed_step_ids,
      now,
    ): AIOrchestratorStepResult {
      // Use null as parallel_group_id here — plan_runner resolves groups before calling
      return runStepDryRun(step, context, completed_step_ids, null, now);
    },
  };
}
