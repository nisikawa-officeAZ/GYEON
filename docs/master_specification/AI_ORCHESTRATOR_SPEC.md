# AI Orchestration Engine Specification
## GYEON Detailer Agent — Sprint 11J

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Foundation Complete — Execution Deferred |
| **Sprint** | 11J |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/ai-orchestrator/` |
| **Execution Status** | Deferred — Phase 11K+ |
| **AI Execution** | Deferred — Phase 11K+ |

---

## §1 — Overview

The AI Orchestration Engine is the canonical execution layer for all AI agents in GYEON Detailer Agent. It coordinates every multi-agent workflow — from a work order completion to social content publishing, from a reputation scan to a monthly business report.

### Purpose

The orchestrator:

1. Receives a trigger (CE event, schedule, or manual dealer action)
2. Looks up the matching workflow from `ORCHESTRATION_WORKFLOW_REGISTRY`
3. Builds an `AIExecutionPlan` with ordered `AIExecutionStep` objects
4. Routes each step through the `AIGatewayBridge` — never to providers directly
5. Coordinates parallel/sequential agent execution
6. Pauses at `dealer_approval` gates for customer-facing output
7. Applies retry and fallback policies on failure
8. Records execution history in `AIExecutionHistory`

### Key design decisions

- **execution_deferred: true** — No real execution in Sprint 11J. All plans are typed structures describing WHAT WILL happen in Sprint 11K+.
- **requires_gateway: true** — Literal type on `AIExecutionPlan` and `AIGatewayBridgeRequest`. The orchestrator can never express a direct provider reference.
- **dealer_id always from getCurrentDealer()** — Every server-side plan builder scopes by dealer, never by client input.
- **No provider imports** — `GATEWAY_BRIDGE_CONSTRAINTS` documents five provider-independence invariants enforced at the type level.
- **Pure modules** — All Sprint 11J files have no `"use server"`, no async, no DB calls, no external calls.
- **video_agent not yet registered** — video_agent is planned for a future sprint. It cannot be used as an `AIAgentId` until it is added to the AI Agent Framework type registry.

---

## §2 — Architecture

```
Trigger (CE event / Schedule / Manual)
         │
         ▼
Workflow Registry lookup (getWorkflowSpec)
         │
         ▼
AIExecutionPlan (execution_deferred: true, requires_gateway: true)
  └── AIExecutionStep[] (ordered by depends_on graph)
         │
         ▼
Execution Policy + Failure Strategy resolved
(merges DEFAULT_EXECUTION_POLICY + workflow policy_overrides)
(builds AIFailureStrategyBundle: retry + timeout + cancellation)
         │
         ▼
For each step (Sprint 11K+):
  AIGatewayBridgeRequest (requires_gateway: true)
         │
         ▼ AI Gateway
  Provider Adapter (OpenAI / Anthropic / Gemini / etc.)
         │
         ▼
  AIGatewayBridgeResponse → step_outputs in AIExecutionContext
         │
  [approval gate if requires_dealer_approval: true]
         │
         ▼ (after all steps)
AIExecutionResult → AIExecutionHistory
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `orchestrator-types.ts` | A | 8 core domain objects: AIOrchestrator, AIExecutionPlan, AIExecutionStep, AIExecutionContext, AIExecutionPolicy, AIExecutionResult, AIExecutionHistory, AIExecutionCapability |
| `agent-coordination.ts` | B | 7 agent roles, 4 coordination patterns, AgentCoordinationStep/Pattern interfaces |
| `workflow-registry.ts` | C | 8 orchestration workflows, AIOrchestrationWorkflowSpec, trigger/status types, lookup helpers |
| `provider-bridge.ts` | D | AIGatewayBridgeRequest/Response, GATEWAY_BRIDGE_CONSTRAINTS, bridge state management |
| `failure-strategy.ts` | E | AIRetryPolicy, AITimeoutPolicy, AICancellationToken, AIFallbackProviderSpec, AIPartialCompletionPolicy, AIFailureStrategyBundle |
| `index.ts` | — | Public barrel export for `@/lib/ai-orchestrator` |

---

## §4 — Domain Objects

### AIOrchestrator

Static descriptor of the orchestration engine itself.

```typescript
const AI_ORCHESTRATOR: AIOrchestrator = {
  version:                 "0.1.0-foundation",
  capabilities:            [...],   // 10 declared, 0 available in Sprint 11J
  registered_workflow_ids: [...],   // 8 workflows
  max_concurrent_plans:    3,
  gateway_required:        true,    // literal — never remove
  execution_deferred:      true,    // literal — Sprint 11J
  execution_target_sprint: "Sprint 11K",
};
```

### AIExecutionPlan

Represents one orchestration run. Created per trigger event. Immutable after creation.

Key fields:
- `plan_id` — UUID per run
- `dealer_id` — always from `getCurrentDealer()`
- `workflow_id` — which workflow triggered this plan
- `steps: AIExecutionStep[]` — ordered step graph
- `requires_gateway: true` — literal, cannot be falsified
- `execution_deferred: true` — literal

### AIExecutionStep

One agent task within a plan.

Key fields:
- `agent_id: AIAgentId` — always a valid, registered agent
- `depends_on: string[]` — step_ids that must complete before this runs
- `is_parallel: boolean` — whether sibling steps at the same depth run concurrently
- `is_optional: boolean` — whether failure blocks the pipeline
- `requires_dealer_approval: boolean` — stops the plan for dealer sign-off
- `is_customer_facing: boolean` — always pauses plan per policy

### AIExecutionContext

Runtime state passed to each step. Contains:
- `dealer_id` — always from `getCurrentDealer()`
- `step_outputs: Record<string, unknown>` — inter-step key-value store

### AIExecutionPolicy

Rules governing an orchestration run:
- `max_parallel_steps: 3` (default)
- `step_timeout_ms: 30_000` (default)
- `plan_timeout_ms: 120_000` (default)
- `require_dealer_approval_before_dispatch: true` — literal, always required
- `pause_on_customer_facing_output: true` (default)

### AIExecutionCapability

The orchestrator declares 10 capabilities. None are available in Sprint 11J:

| Capability | Sprint |
|------------|--------|
| sequential_execution | 11K |
| parallel_execution | 11K |
| retry_with_backoff | 11K |
| partial_completion | 11K |
| dealer_approval_gate | 11K |
| cross_agent_feed | 11K |
| usage_tracking | 11K |
| conditional_branching | 11L |
| fan_out_fan_in | 11L |
| fallback_provider | 11L |

---

## §5 — Agent Coordination

### Registered Agent Roles

All 7 registered `AIAgentId` agents have an `AgentOrchestrationRole`:

| Agent | Role in Orchestration | Parallel | Approval Required |
|-------|----------------------|----------|------------------|
| marketing_agent | Primary content producer — storyboard, captions, enrichment | No | Yes |
| reputation_agent | Review analysis and compliance check | Yes | Yes (GBP responses) |
| growth_agent | Performance signal feed — KPIs, publish-time suggestions | Yes | No |
| line_agent | LINE message delivery coordinator | No | Yes |
| review_agent | Review request generation and GBP response drafting | No | Yes |
| ocr_agent | On-demand document reading — not in standard workflows | Yes | No |
| seo_agent | SEO/MEO/AEO keyword enrichment — runs in parallel with reputation check | Yes | No |

Note: `video_agent` is planned for a future sprint. It is not yet a valid `AIAgentId` and is not registered in the coordination layer.

### Coordination Patterns

4 canonical patterns:

| Pattern | Agents Involved | Workflows |
|---------|----------------|-----------|
| work_order_content_chain | marketing_agent → [seo_agent ‖ reputation_agent] → growth_agent | work_to_social_content |
| review_request_chain | review_agent → line_agent | work_to_review_request |
| reputation_analysis_chain | reputation_agent → review_agent + marketing_agent (conditional) | periodic_reputation_scan, work_to_reputation_report |
| growth_analysis_chain | growth_agent → marketing_agent | periodic_growth_analysis, monthly_business_report |

---

## §6 — Workflow Registry

8 orchestration workflows:

| Workflow | Trigger | Agents | Required Features | Available From |
|----------|---------|--------|------------------|----------------|
| work_to_social_content | WORK_COMPLETED | marketing, seo, reputation, growth | ai_marketing, ai_gateway | Sprint 11K |
| work_to_review_request | WORK_COMPLETED | review, line | ai_reputation, line, ai_gateway | Sprint 11K |
| work_to_reputation_report | WORK_COMPLETED | reputation, review | ai_reputation, ai_gateway | Sprint 11K |
| periodic_growth_analysis | Weekly (Mon 09:00 JST) | growth, marketing | ai_growth, ai_gateway | Sprint 11K |
| periodic_reputation_scan | Weekly (Wed 10:00 JST) | reputation, review, marketing | ai_reputation, ai_gateway | Sprint 11K |
| line_workflow_execution | MAINTENANCE_DUE / manual | line | line, ai_gateway | Sprint 11K |
| monthly_business_report | Monthly (1st business day) | growth, reputation, marketing, seo | ai_growth, ai_reputation, ai_marketing | Sprint 11L |
| seo_batch_optimization | Bi-weekly (Sun 03:00 JST) | seo, marketing | ai_marketing, ai_gateway | Sprint 11K |

### Trigger cooldowns

| Workflow | Cooldown |
|----------|---------|
| work_to_review_request | 168 hours (7 days) — prevents duplicate review requests |
| line_workflow_execution (MAINTENANCE_DUE) | 720 hours (30 days) |
| monthly_business_report | 672 hours (28 days) |
| periodic_growth_analysis | 168 hours (7 days) |
| periodic_reputation_scan | 168 hours (7 days) |
| seo_batch_optimization | 336 hours (14 days) |

---

## §7 — Provider Bridge

### Architecture invariant

```
AIOrchestrator → AIGatewayBridgeRequest → AI Gateway → Provider Adapter
```

The orchestrator is forbidden from:
- Importing any AI provider SDK
- Specifying a provider by name in a bridge request
- Receiving raw API keys
- Calling provider endpoints directly

Five constraints are documented in `GATEWAY_BRIDGE_CONSTRAINTS` as literal `true` values:

```typescript
{
  orchestrator_may_not_import_provider_sdk:  true,
  orchestrator_may_not_specify_provider:     true,
  agents_never_receive_raw_api_keys:         true,
  office_az_never_pays_inference_costs:      true,
  agents_communicate_via_gateway_only:       true,
}
```

### Bridge request structure

The `requires_gateway: true` literal on `AIGatewayBridgeRequest` is the type-level enforcement:

```typescript
interface AIGatewayBridgeRequest {
  dealer_id:        string;   // always from getCurrentDealer()
  agent_id:         AIAgentId;
  task_type:        AITaskType;
  workflow_id:      AIOrchestrationWorkflowId;
  step_id:          string;
  plan_id:          string;
  input_payload:    Record<string, unknown>;
  requires_gateway: true;     // literal — not boolean
}
```

---

## §8 — Failure Strategy

### Retry policy (defaults)

| Setting | Default |
|---------|---------|
| max_attempts | 2 |
| initial_delay_ms | 1,000 |
| backoff_multiplier | 2.0 |
| max_delay_ms | 16,000 |
| jitter | true |

Retryable error categories: `provider_rate_limit`, `provider_server_error`, `provider_timeout`, `gateway_unavailable`, `network_error`.

Non-retryable errors (fail immediately): validation errors, authorization errors, `non_retryable`, `unknown`.

### Timeout policy (defaults)

| Setting | Default |
|---------|---------|
| step_timeout_ms | 30,000 (30s) |
| plan_timeout_ms | 120,000 (2m) |
| approval_gate_timeout_ms | null (wait indefinitely) |
| gateway_handshake_timeout_ms | 5,000 (5s) |

### Cancellation reasons

7 cancellation reasons: `dealer_cancelled`, `plan_timeout`, `hard_limit_reached`, `gateway_unavailable`, `step_failed_no_retry`, `approval_gate_timeout`, `system_shutdown`.

### Partial completion

Default policy allows partial completion when:
- All non-optional (`is_optional: false`) steps complete
- All customer-facing steps complete
- All approval gate steps complete

---

## §9 — Security Constraints

1. **dealer_id**: Always from `getCurrentDealer()` in `AIExecutionPlan`, `AIExecutionContext`, `AIGatewayBridgeRequest`, `AIExecutionHistory`. Never from form input or URL parameters.
2. **No direct provider imports**: The orchestrator module (`src/lib/ai-orchestrator/`) must never import OpenAI, Anthropic, Gemini, Azure OpenAI, or OpenRouter SDKs. All calls go through `@/lib/ai/` AI Gateway.
3. **No API keys in orchestrator context**: Raw API keys are stored only in dealer settings. The orchestrator never reads or passes keys.
4. **No schema changes without CTO approval**: Sprint 11K will require `dealer_ai_execution_log` table. CTO approval required before migration.
5. **AI cost isolation**: Each agent step is billed to the dealer's own AI provider key via the gateway. Office AZ never pays inference costs.
6. **require_dealer_approval_before_dispatch: true**: This field is a literal type on `AIExecutionPolicy` — it cannot be set to false without a type error.

---

## §10 — Relationship to Other AI Subsystems

| Subsystem | Relationship to Orchestrator |
|-----------|------------------------------|
| AI Gateway (`@/lib/ai`) | The orchestrator's sole communication channel to all AI providers |
| AI Agent Framework (`@/lib/ai/agents`) | Provides AIAgentId, AIAgentContext, runAgentLifecycle — orchestrator coordinates agents defined here |
| AI Marketing Platform | `work_to_social_content` workflow drives content automation pipeline |
| AI Reputation Platform | `periodic_reputation_scan` and `work_to_reputation_report` workflows |
| AI Growth Platform | `periodic_growth_analysis` and `monthly_business_report` workflows |
| LINE Automation Platform | `line_workflow_execution` and `work_to_review_request` workflows |
| AI Content Automation Platform | `work_to_social_content` workflow drives the Sprint 11I content pipeline |

The orchestrator is the only subsystem that has references to all other AI platforms. No other platform imports from `@/lib/ai-orchestrator`.

---

## §11 — Phase Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **Sprint 11J** | **AI Orchestration Engine Foundation** | **Complete (this document)** |
| Sprint 11K | Execution runtime — sequential and parallel step execution | Planned |
| Sprint 11K | Retry with backoff + partial completion | Planned |
| Sprint 11K | Dealer approval gate UI | Planned |
| Sprint 11K | Cross-agent feed wiring (via gateway) | Planned |
| Sprint 11K | Usage tracking per step (requires CTO-approved migration) | Planned |
| Sprint 11L | Conditional branching and fan-out/fan-in | Planned |
| Sprint 11L | Fallback provider switching | Planned |
| Sprint 11L | Execution history persistence (dealer_ai_execution_log table) | Planned |
| Sprint 11L | Monthly business report workflow activation | Planned |
