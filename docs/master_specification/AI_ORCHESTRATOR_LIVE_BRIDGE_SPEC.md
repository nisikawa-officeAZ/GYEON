# AI Orchestrator Live Runtime Bridge Specification
## GYEON Detailer Agent — Sprint 11L

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Live Bridge Complete |
| **Sprint** | 11L |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/ai-orchestrator/runtime/` (bridge-types, agent-instance-registry, runtime-state, step-bridge, approval-pause-handler, plan-bridge) |
| **AI Provider Execution** | Deferred — Sprint 11M+ |
| **Persistence** | Deferred — Sprint 11M+ (CTO approval required) |

---

## §1 — Overview

Sprint 11L implements the first production-ready Live Runtime Bridge for the AI Orchestrator. The bridge replaces Sprint 11K's dry-run null placeholders with real in-memory lifecycle execution — calling `agent.initialize()` for every registered agent and building fully-typed execution payloads.

### What the Live Bridge does

1. Resolves the workflow spec from `ORCHESTRATION_WORKFLOW_REGISTRY`
2. Builds an `AIExecutionPlan` with step templates
3. Resolves the effective `AIExecutionPolicy` and `AIExecutionBridgePolicy`
4. Processes steps in topological order:
   - Runs dry-run step validation (dependency check, feature gate, cancellation)
   - For structurally valid steps: calls `agent.initialize(agent_context)`
   - Checks AI provider readiness from the pre-built `AIAgentContext.gateway`
   - Detects dealer approval gates
   - Builds a typed `AIExecutionBridgeResult` per step
   - If an approval gate triggers: builds `AIApprovalPauseRecord` and stops the chain
5. Returns a complete `AIOrchestratorLiveBridgeResult` with per-step payloads

### What the Live Bridge does NOT do

- Does NOT call `agent.validate()` — no real task input data in Sprint 11L
- Does NOT call `agent.execute()` — no AI provider inference (Sprint 11M+)
- Does NOT send any LINE messages
- Does NOT publish to any social platform
- Does NOT write to any database
- Does NOT automatically continue past an approval gate

---

## §2 — Architecture

```
AILiveRuntimeRequest
  ├── dealer_id (from getCurrentDealer() in calling server action)
  ├── workflow_id
  ├── trigger_event + trigger_payload
  ├── execution_mode: "live"
  ├── active_features: AppFeature[] (pre-loaded from DB by server action)
  └── agent_context: AIAgentContext (pre-built by createAgentContext() in server action)
         │
         ▼
runPlanLiveBridge(request, plan_id, now)
  ├── getWorkflowSpec(workflow_id) → AIOrchestrationWorkflowSpec
  ├── resolveWorkflowPolicy(workflow_id) + policy_overrides → AIExecutionPolicy
  ├── buildExecutionPlan(...) → AIExecutionPlan
  ├── buildParallelGroups(steps, max_parallel) → AIParallelStepGroup[]
  │
  └── For each step in topological order (depth 0 → N):
        ├── runStepDryRun() → validates deps, feature gate, cancellation
        ├── If blocked: record "failed" state, continue
        ├── If skipped_optional: record "completed", continue
        └── If validated or blocked_approval:
              runStepBridgeLifecycle(ctx, step, policy, now)
                ├── getAgentInstance(agent_id)        — Phase B
                ├── agent.initialize(agent_context)   — Phase B
                ├── provider_ready check              — Phase D
                ├── evaluateApprovalGate(step, policy) — Phase E
                ├── buildCapabilitySummary()           — Phase D
                └── → AIExecutionBridgeResult
              │
              If awaiting_approval AND pause_on_approval_required:
                buildApprovalPauseRecord() → AIApprovalPauseRecord
                STOP — no more steps processed
         │
         ▼
AIOrchestratorLiveBridgeResult
  ├── overall_state: AIExecutionBridgeState
  ├── step_results: AIStepBridgeResult[]
  ├── approval_paused_at: string | null
  ├── approval_pause_record: AIApprovalPauseRecord | null
  └── steps_prepared / steps_awaiting_approval / steps_failed / steps_skipped
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `runtime/bridge-types.ts` | A | All bridge types: AIExecutionBridgeState (7), AIExecutionBridgeContext, AIExecutionBridgePolicy (run_validate: false, run_execute: false), AICapabilitySummary, AIExecutionNextAction, AIExecutionBridgeResult, AIStepBridgeResult, AIApprovalPauseRecord, AIOrchestratorLiveBridgeResult, AILiveRuntimeRequest, AIOrchestratorRuntimeBridge, RUNTIME_BRIDGE_CAPABILITIES |
| `runtime/agent-instance-registry.ts` | B | Agent instance registry: concrete ReputationAgent + PlannedAgentStub for all 6 other agents; getAgentInstance(), isConcreteAgent(), isPlannedAgentStub() |
| `runtime/runtime-state.ts` | C | In-memory state model: AIRuntimeExecutionRecord, AIRuntimePlanState, factory functions, state transition helpers, computeOverallPlanState() |
| `runtime/step-bridge.ts` | B + D | Step bridge executor: runStepBridgeLifecycle() — calls initialize(), builds capability summary, derives next_actions, returns AIExecutionBridgeResult |
| `runtime/approval-pause-handler.ts` | E | Approval pause: buildApprovalPauseRecord(), resolveApprovalPause(), computePendingStepIds(), state query helpers |
| `runtime/plan-bridge.ts` | A | Plan bridge runner: runPlanLiveBridge() — orchestrates full plan lifecycle preparation, handles approval gate pause, returns AIOrchestratorLiveBridgeResult |

---

## §4 — Agent Lifecycle Integration (Phase B)

### Agent instances

| Agent | Implementation | Status |
|-------|---------------|--------|
| `reputation_agent` | `ReputationAgent` (concrete) | Sprint 10E — full lifecycle |
| `marketing_agent` | `PlannedAgentStub` | Phase G planned |
| `growth_agent` | `PlannedAgentStub` | Phase G planned |
| `ocr_agent` | `PlannedAgentStub` | Phase G planned |
| `review_agent` | `PlannedAgentStub` | Phase G planned |
| `line_agent` | `PlannedAgentStub` | Phase G planned |
| `seo_agent` | `PlannedAgentStub` | Phase G planned |

### PlannedAgentStub lifecycle behavior

- `initialize(ctx)` — validates `ctx.dealer_id` is non-empty, then succeeds. Phase G will load agent-specific config here.
- `validate(ctx, input)` — checks `input.agent_id === this.id`. Not called by the bridge in Sprint 11L (`run_validate: false`).
- `execute()` — always throws `AIAgentNotImplementedError`. Never called in Sprint 11L.
- `postProcess()` — pass-through.

### Bridge policy constraints

```typescript
AIExecutionBridgePolicy {
  run_initialize:             true,   // Always run initialize()
  run_validate:               false,  // No real input data in Sprint 11L
  run_execute:                false,  // No AI inference in Sprint 11L
  pause_on_approval_required: true,   // Stop chain at approval gate
}
```

---

## §5 — Runtime State Model (Phase C)

### State transitions per step

```
pending → preparing → ready               (no approval gate, initialize succeeded)
pending → preparing → awaiting_approval   (approval gate hit — plan stops here)
pending → preparing → failed              (initialize() threw)
pending → cancelled                       (plan stopped before reaching this step)
```

### AIRuntimePlanState

In-memory only — lives for the duration of one server request. Contains:
- `step_records: Map<string, AIRuntimeExecutionRecord>` — one record per step
- `paused_at_step: string | null` — step_id of the approval gate that paused the plan
- `pending_step_ids: string[]` — steps not reached due to approval pause or failure
- `in_memory_only: true` — literal flag, no persistence in Sprint 11L

---

## §6 — Output Payload Model (Phase D)

### AIExecutionBridgeResult

Every step's bridge execution returns one of these:

```typescript
AIExecutionBridgeResult {
  execution_id:         string          // "exec_<plan_id_prefix>_<step_id>"
  agent_id:             AIAgentId
  execution_state:      AIExecutionBridgeState
  capability_summary:   AICapabilitySummary
  next_actions:         AIExecutionNextAction[]
  approval_required:    boolean
  provider_ready:       boolean         // true if gateway.status === "ready"
  initialize_succeeded: boolean
  error_message:        string | null   // Japanese, user-readable
  execution_timestamp:  string          // ISO 8601
}
```

### AICapabilitySummary

Built from `AI_AGENT_REGISTRY` at bridge execution time:

```typescript
AICapabilitySummary {
  agent_id:               AIAgentId
  agent_name:             string          // Japanese name from registry
  task_type:              AITaskType
  required_feature:       AppFeature
  required_provider_caps: AICapability[]  // Provider-level caps the agent needs
  supported_task_types:   AITaskType[]
}
```

### AIExecutionNextAction derivation

| Condition | next_actions |
|-----------|-------------|
| `initialize_succeeded: false` | `["retry_with_different_input"]` |
| `!provider_ready` | `["await_provider_configuration", ...]` |
| `approval_required: true, provider_ready: true` | `["submit_for_approval"]` |
| `approval_required: true, !provider_ready` | `["await_provider_configuration", "submit_for_approval"]` |
| `initialize_succeeded: true, provider_ready: true, !approval_required` | `["ready_for_dispatch"]` |

---

## §7 — Approval Pause (Phase E)

### Pause trigger conditions

Same as Sprint 11K approval gate detection:
- `step.requires_dealer_approval === true`, OR
- `step.is_customer_facing === true AND policy.pause_on_customer_facing_output === true`

### Pause behavior

In **dry-run mode** (Sprint 11K): gate is noted, plan continues to validate all steps.

In **live bridge mode** (Sprint 11L):
1. `runStepBridgeLifecycle()` returns `execution_state: "awaiting_approval"`
2. `buildApprovalPauseRecord()` captures the paused state
3. `runPlanLiveBridge()` stops processing further steps
4. Returns `AIOrchestratorLiveBridgeResult` with `approval_paused_at` and `approval_pause_record`

### AIApprovalPauseRecord

```typescript
AIApprovalPauseRecord {
  plan_id:          string
  dealer_id:        string          // from getCurrentDealer()
  paused_at_step:   string          // step_id that triggered the pause
  agent_id:         AIAgentId
  pending_step_ids: string[]        // steps not reached because plan stopped
  bridge_result:    AIExecutionBridgeResult
  resolved:         boolean         // false until dealer acts
  resolution:       "approved" | "rejected" | null
  resolved_by:      string | null
  paused_at:        string          // ISO 8601
  resolved_at:      string | null
  in_memory_only:   true            // no persistence in Sprint 11L
}
```

### Pause resolution (Sprint 11M+)

```
resolveApprovalPause(record, "approved", dealer_user_id, now)
  → plan continues from next step in Sprint 11M live execution

resolveApprovalPause(record, "rejected", dealer_user_id, now)
  → plan cancelled; pending_step_ids remain unexecuted
```

---

## §8 — Security Constraints

All Sprint 11K and 11J security constraints remain in force. Additional Sprint 11L constraints:

1. **agent_context pre-loading**: `AILiveRuntimeRequest.agent_context` must be built by `createAgentContext()` in the calling server action — never constructed inside the bridge.
2. **No provider SDK imports**: The bridge never imports any AI provider SDK (OpenAI, Anthropic, Gemini, etc.).
3. **No API key access**: `AIExecutionBridgeResult` and all bridge types contain no API key fields. Gateway readiness is checked via `gateway.status` only.
4. **Error message safety**: `error_message` is always a generic Japanese user-facing string — never includes stack traces, internal error details, or key fragments.
5. **In-memory isolation**: `AIApprovalPauseRecord.in_memory_only: true` — no persistence without CTO-approved migration.

---

## §9 — Sprint Roadmap

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| Sprint 11J | AI Orchestration Engine Foundation | Complete |
| Sprint 11K | AI Orchestrator Runtime Dry-Run | Complete |
| **Sprint 11L** | **AI Orchestrator Live Runtime Bridge (this document)** | **Complete** |
| Sprint 11M+ | Live AI provider execution (`agent.execute()` via AI Gateway) | Planned |
| Sprint 11M+ | Execution history persistence (`dealer_ai_execution_log` — CTO approval required) | Planned |
| Sprint 11M+ | Approval gate UI (dealer reviews output, approves/rejects via server action) | Planned |
| Sprint 11M+ | `agent.validate()` integration (run_validate: true when real trigger payloads available) | Planned |
| Sprint 11M+ | Conditional branching and fan-out/fan-in step graph | Planned |
| Sprint 11M+ | Fallback provider switching at runtime | Planned |
