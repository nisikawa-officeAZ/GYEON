# AI Orchestrator Runtime Dry-Run Specification
## GYEON Detailer Agent — Sprint 11K

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Dry-Run Runtime Complete |
| **Sprint** | 11K |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/ai-orchestrator/runtime/` |
| **Dry-Run Status** | Available |
| **Live Execution** | Deferred — Phase 11L+ |

---

## §1 — Overview

Sprint 11K implements the first production-safe AI Orchestrator runtime dry-run. The runtime validates, plans, and reports what WOULD happen across all AI agent steps — without making any AI provider calls, sending any LINE messages, or touching any social platform APIs.

### What the dry-run does

1. Looks up the workflow specification from `ORCHESTRATION_WORKFLOW_REGISTRY`
2. Builds an `AIExecutionPlan` with step templates
3. Resolves the effective `AIExecutionPolicy` (defaults → workflow overrides → request overrides)
4. Builds a `AIFailureStrategyBundle` and validates it structurally
5. Computes parallel step groups using topological depth analysis
6. Detects cross-agent data feed exchanges (which agent outputs feed into which agent inputs)
7. Validates each step in dependency order:
   - Cancellation token check
   - Dependency satisfaction (depends_on steps must be validated first)
   - Feature gate check (dealer must have the agent's `requiredFeature` active)
   - Dealer approval gate detection
   - AI Gateway bridge request construction
8. Returns a complete `AIOrchestratorRuntimeResult` with full diagnostics

### What the dry-run does NOT do

- Does NOT call any AI provider API
- Does NOT send any LINE messages
- Does NOT publish to any social platform
- Does NOT write to any database
- Does NOT execute any AI agent `execute()` method
- Does NOT build real AIExecutionContext with live gateway checks

---

## §2 — Architecture

```
AIOrchestratorRuntimeRequest
  ├── dealer_id (from getCurrentDealer() in calling server action)
  ├── workflow_id
  ├── trigger_event + trigger_payload
  ├── execution_mode: "dry_run"
  └── active_features: AppFeature[] (pre-loaded from DB by server action)
         │
         ▼
buildRuntimeContext(request, plan_id, now)
  ├── getWorkflowSpec(workflow_id) → AIOrchestrationWorkflowSpec
  ├── resolveWorkflowPolicy(workflow_id) + policy_overrides → AIExecutionPolicy
  ├── buildExecutionPlan(...) → AIExecutionPlan
  ├── buildDefaultFailureStrategy(workflow_id) → AIFailureStrategyBundle
  └── → AIOrchestratorRuntimeContext
         │
         ▼
runPlanDryRun(request, plan_id, now)
  ├── validateFailureStrategy(bundle) — structural check
  ├── buildParallelGroups(steps, max_parallel_steps) — Phase C
  ├── buildCrossAgentFeedExchanges(steps, now) — Phase F
  │
  └── For each step in topological order (depth 0 → N):
        ├── checkCancellationToken(token, step_id)
        ├── validateStepDependencies(step, completed, all)
        ├── validateStepFeatureGate(step, active_features)
        ├── evaluateApprovalGate(step, policy) — Phase D
        ├── buildBridgeRequest(...) → AIGatewayBridgeRequest
        └── → AIOrchestratorStepResult
         │
         ▼
AIOrchestratorRuntimeResult
  ├── overall_status: AIExecutionStatus
  ├── step_results: AIOrchestratorStepResult[]
  ├── parallel_groups: AIParallelStepGroup[]
  ├── approval_gates_pending: string[]
  ├── cross_feed_exchanges: AICrossAgentFeedExchange[]
  ├── failure_strategy_events: AIFailureStrategyEvent[]
  ├── steps_validated / steps_blocked / steps_skipped
  └── dry_run: true
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `runtime/orchestrator-runtime-types.ts` | A | All runtime domain types: AIOrchestratorRuntime, AIOrchestratorRuntimeContext/Request/Result, AIOrchestratorStepResult, AIParallelStepGroup, AIFailureStrategyEvent, AIOrchestratorStepRunner/PlanRunner interfaces |
| `runtime/step-runner.ts` | B + C | Sequential step dry-run: dependency validation, feature gate check, bridge request build; parallel group computation via topological depth analysis |
| `runtime/approval-gate.ts` | D | AIApprovalGateState, AIApprovalGateStatus (5 states), evaluateApprovalGate, applyApprovalGateDecision, gate helpers |
| `runtime/failure-integration.ts` | E | Failure strategy wiring: retry decision, timeout validation, cancellation check, fallback validation, partial completion evaluation, failure event simulation |
| `runtime/cross-agent-feed.ts` | F | In-memory cross-agent data feed: AICrossAgentFeedExchange detection, feed payload resolution, key compatibility validation |
| `runtime/plan-runner.ts` | A | AIOrchestratorPlanRunner: orchestrates all steps, computes overall status, builds complete result |
| `runtime/index.ts` | — | Public barrel export |

---

## §4 — Sequential Step Processing (Phase B)

Each step is validated in topological order. A step at depth N is processed after all depth N-1 steps have been processed.

### Step dry-run status values

| Status | Meaning |
|--------|---------|
| `validated` | Step passed all checks; bridge request built; ready to run in Phase 11L |
| `blocked_approval` | Step requires dealer approval before the plan can continue |
| `blocked_dependency` | A required depends_on step failed or was itself blocked |
| `blocked_feature_gate` | Dealer does not have the required `AppFeature` active |
| `blocked_cancelled` | Cancellation token was triggered before this step |
| `blocked_gateway` | AI Gateway structural validation failed |
| `skipped_optional` | Step is `is_optional: true` and was skipped due to a feature gate failure |
| `deferred` | Step requires Sprint 11L+ capability |

### Feature gate validation

Each step's agent is looked up in `AI_AGENT_REGISTRY`. The agent's `requiredFeature` is checked against the `active_features` in `AIOrchestratorRuntimeContext` (pre-loaded from DB by the calling server action).

| Agent | Required Feature |
|-------|-----------------|
| marketing_agent | `ai_marketing` |
| reputation_agent | `ai_reputation` |
| growth_agent | `ai_growth` |
| ocr_agent | `ai_gateway` |
| review_agent | `ai_reputation` |
| line_agent | `ai_marketing` |
| seo_agent | `ai_marketing` |

---

## §5 — Parallel Step Grouping (Phase C)

### Algorithm

1. Assign each step a depth using topological sort: `depth = max(depends_on depths) + 1`, root steps = 0
2. Group steps at the same depth
3. Within a depth level: steps with `is_parallel: true` form one `AIParallelStepGroup`; sequential steps each form their own single-step group
4. Effective parallelism = `min(group.step_ids.length, policy.max_parallel_steps)`

### Example (work_to_social_content workflow)

```
Depth 0:  wc_01_storyboard (sequential)
            → group_d0_seq_wc_01_storyboard
Depth 1:  wc_02_caption (sequential, approval gate)
            → group_d1_seq_wc_02_caption
Depth 2:  wc_03_seo (parallel) + wc_04_compliance (parallel)
            → group_d2_p (effective_parallelism: 2)
Depth 3:  wc_05_growth_signal (sequential)
            → group_d3_seq_wc_05_growth_signal
```

---

## §6 — Dealer Approval Gate (Phase D)

### Gate lifecycle

```
Step has requires_dealer_approval: true  OR  (is_customer_facing AND policy.pause_on_customer_facing_output)
         ↓
AIApprovalGateState (status: approval_required_before_next_step)
         ↓
In dry-run: gate is noted, plan continues for complete validation picture
         ↓ (in Sprint 11L live mode)
Plan pauses → dealer reviews output
         ↓
dealer.approve() → approval_approved → plan continues
dealer.reject()  → approval_rejected → plan stops
```

### Approval gate status values

| Status | Meaning |
|--------|---------|
| `not_required` | Step does not need dealer approval |
| `approval_pending` | Gate is open — awaiting dealer action |
| `approval_required_before_next_step` | Plan paused at this gate |
| `approval_approved` | Dealer approved — plan may continue |
| `approval_rejected` | Dealer rejected — plan stops |
| `approval_timed_out` | approval_gate_timeout_ms elapsed (policy: null = indefinite wait) |

In **dry-run mode**: `blocked_approval` steps are noted in `approval_gates_pending[]` but the plan continues processing all subsequent steps. This gives a complete picture of ALL gates in the plan without stopping at the first one.

---

## §7 — Failure Strategy Integration (Phase E)

### What is validated structurally in dry-run

| Policy | Validation |
|--------|-----------|
| Retry | max_attempts > 0, initial_delay_ms > 0, backoff_multiplier ≥ 1.0, retryable_categories non-empty |
| Timeout | step_timeout_ms > 0, plan_timeout_ms > step_timeout_ms, gateway_handshake_timeout_ms > 0 |
| Cancellation | token is not already triggered (warn if it is) |
| Fallback | primary ≠ fallback provider, trigger_on_categories non-empty, max_fallback_attempts > 0 |
| Partial completion | min_steps_required ≥ 0 if set; customer-facing policy self-consistent |

### Simulated failure events

For each `validated` step, the plan runner generates hypothetical `AIFailureStrategyEvent` records showing what would happen if that step encountered a transient error:

- `retry_would_trigger` — if retry policy allows retries
- `fallback_would_activate` — if fallback provider is configured

These are `dry_run: true` events — not real failures.

---

## §8 — Cross-Agent Feed (Phase F)

### Detection algorithm

For each pair of steps (A → B) where B depends on A:
1. If `A.agent_id ≠ B.agent_id` — this is a cross-agent boundary
2. Find `shared_keys = A.output_keys ∩ B.input_keys`
3. Find `missing_keys = B.input_keys \ A.output_keys`
4. Record an `AICrossAgentFeedExchange` with `requires_gateway: true`

### Example feed exchanges (work_to_social_content)

| From Step | To Step | Shared Keys |
|-----------|---------|-------------|
| wc_01_storyboard (marketing_agent) | wc_02_caption (marketing_agent) | — (same agent, no cross-agent feed) |
| wc_02_caption (marketing_agent) | wc_03_seo (seo_agent) | `["base_caption"]` |
| wc_02_caption (marketing_agent) | wc_04_compliance (reputation_agent) | `["base_caption"]` |
| wc_03_seo (seo_agent) | wc_05_growth_signal (growth_agent) | — (no shared keys) |
| wc_04_compliance (reputation_agent) | wc_05_growth_signal (growth_agent) | — (no shared keys) |

In **dry-run mode**: `step_outputs` contains null placeholders for all output keys. No real AI data flows.

---

## §9 — Runtime Result Structure

```typescript
AIOrchestratorRuntimeResult {
  plan_id:                 string        // UUID (caller-provided)
  dealer_id:               string        // always from getCurrentDealer()
  workflow_id:             AIOrchestrationWorkflowId
  execution_mode:          "dry_run"
  overall_status:          AIExecutionStatus
  step_results:            AIOrchestratorStepResult[]
  parallel_groups:         AIParallelStepGroup[]
  approval_gates_pending:  string[]      // step_ids requiring approval
  cross_feed_exchanges:    AICrossAgentFeedExchange[]
  failure_strategy_events: AIFailureStrategyEvent[]
  steps_validated:         number
  steps_blocked:           number
  steps_skipped:           number
  dry_run:                 true          // literal — never false in Sprint 11K
  plan_built_at:           string        // ISO 8601
  completed_at:            string        // ISO 8601
}
```

### Overall status determination

| Condition | overall_status |
|-----------|---------------|
| Any required step has `blocked_feature_gate` | `failed` |
| Any required step has `blocked_cancelled` | `cancelled` |
| Any required step has `blocked_dependency` | `failed` |
| Any step has `blocked_approval` | `paused_awaiting_approval` |
| All steps `validated` or `skipped_optional` or `blocked_approval` | `pending` |

---

## §10 — Security Constraints

All Sprint 11J security constraints remain in force:

1. **dealer_id**: `AIOrchestratorRuntimeRequest.dealer_id` must come from `getCurrentDealer()` in the calling server action — never from form input, URL parameters, or client state.
2. **active_features pre-loading**: The calling server action must load dealer features from DB and pass them as `active_features: AppFeature[]`. The runtime does not make DB calls.
3. **No provider imports**: Runtime files in `src/lib/ai-orchestrator/runtime/` must not import any AI provider SDK. All bridge requests use `AIGatewayBridgeRequest` with `requires_gateway: true`.
4. **No API keys in runtime**: The runtime context contains no API key fields. Keys remain in `dealer_ai_settings` (server-side only).
5. **No schema changes without CTO approval**: Sprint 11L will require execution history persistence. CTO approval required.

---

## §11 — Phase Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| Sprint 11J | AI Orchestration Engine Foundation (types, workflows, patterns, bridge, failure strategy) | Complete |
| **Sprint 11K** | **AI Orchestrator Runtime Dry-Run (this document)** | **Complete** |
| Sprint 11L | Live execution runtime — real agent lifecycle calls through AI Gateway | Planned |
| Sprint 11L | Execution history persistence (`dealer_ai_execution_log` table — CTO approval required) | Planned |
| Sprint 11L | Conditional branching and fan-out/fan-in in step graph | Planned |
| Sprint 11L | Fallback provider switching at runtime | Planned |
| Sprint 11M | Usage tracking per step (token count, estimated cost) | Planned |
| Sprint 11M | Approval gate UI component (pauses plan, shows dealer the AI output) | Planned |
