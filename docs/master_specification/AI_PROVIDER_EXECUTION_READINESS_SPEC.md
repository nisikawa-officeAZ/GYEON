# AI Provider Execution Readiness Specification
## GYEON Detailer Agent — Sprint 11M

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Readiness Layer Complete |
| **Sprint** | 11M |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/ai-orchestrator/provider-execution/` |
| **AI Provider Execution** | Deferred — Sprint 11N+ |
| **Persistence** | Deferred — CTO approval required |

---

## §1 — Overview

Sprint 11M implements the AI provider execution readiness layer — a 12-check safety gate that must be satisfied before any AI provider inference call is ever allowed to execute.

This sprint creates the final structural safety layer between the Live Runtime Bridge (Sprint 11L) and real AI inference (Sprint 11N+). It is not an inference sprint. No AI provider SDK is imported. No provider API calls are made. No fake outputs are generated.

### What Sprint 11M delivers

1. **Execution guard** — 12-check gate evaluating dealer plan, feature flags, provider configuration, capability support, budget policy, and billing acknowledgement
2. **Capability routing** — maps `AIAgentCapability` (agent-level) and `AITaskType` to required `AICapability` (provider-level) values
3. **Budget guard** — evaluates dealer's monthly spending position before execution is attempted
4. **Provider adapter contract** — typed interface that all concrete provider adapters (Sprint 11N+) must satisfy; no implementations here
5. **Live bridge integration** — the execution guard runs inside `runStepBridgeLifecycle()` for every lifecycle-prepared step; the `AIExecutionBridgeResult` now carries a `readiness_check` payload

### What Sprint 11M does NOT do

- Does NOT call `agent.execute()` — no AI provider inference
- Does NOT import any AI provider SDK (OpenAI, Anthropic, Gemini, etc.)
- Does NOT make any external API calls
- Does NOT generate placeholder or fake AI output
- Does NOT modify any database schema
- Does NOT expose raw API keys in any type or response

---

## §2 — Architecture

```
runStepBridgeLifecycle(ctx, step, policy, now)
  │
  ├── (existing) agent.initialize(agent_context)
  ├── (existing) evaluateApprovalGate(step, policy)
  ├── (existing) buildCapabilitySummary()
  │
  └── (Sprint 11M) checkProviderExecutionReadiness(request, policy, now)
            │
            ├── resolveRequiredCaps(agent_id, task_type)   ← capability routing
            │
            └── 12 guard checks (in order):
                  1.  run_execute_flag                → policy.run_execute must be true
                  2.  dealer_pro_plus_access          → ai_gateway in active_features
                  3.  ai_gateway_feature_enabled      → gateway.status not blocking
                  4.  target_agent_feature_enabled    → agent.requiredFeature in active_features
                  5.  provider_configured             → gateway.provider non-null
                  6.  provider_enabled                → gateway.status not "disabled"
                  7.  encrypted_key_exists            → gateway.status not "no_key"
                  8.  capability_supported_by_provider→ provider supports all required_caps
                  9.  usage_policy_allows             → policy.limit_reached not hard-blocking
                  10. monthly_limit_not_exceeded      → projected spend within monthly_limit_usd
                  11. dealer_billing_acknowledged     → policy.dealer_billing_policy_confirmed
                  12. no_key_exposure_risk            → structural: no raw key in context
                        │
                        ▼
                  AIProviderExecutionGuardResult
                    decision: "allow" | "deny" | "needs_configuration"
                    failed_check: AIProviderExecutionCheckId | null
                    denial_reason: string | null
                    configuration_step: string | null

Return: AIExecutionBridgeResult + readiness_check: AIProviderExecutionGuardResult
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `provider-execution/execution-readiness-types.ts` | A | All Phase A types: AIProviderExecutionCheckId (12), AIProviderExecutionDecision (3), AIProviderExecutionCheckResult, AIProviderExecutionGuardResult, AIProviderExecutionContext, AIProviderExecutionRequest, AIProviderExecutionResult, AIProviderExecutionPolicy, AIProviderExecutionReadiness, AIProviderExecutionGuard |
| `provider-execution/execution-guard.ts` | B | 12-check guard: checkProviderExecutionReadiness(), PROVIDER_EXECUTION_GUARD, classifyDecision() |
| `provider-execution/capability-routing.ts` | C | TASK_TO_PROVIDER_CAPS, CAPABILITY_GROUP_LABEL, getRequiredCapsForAgent(), getRequiredCapsForTask(), resolveRequiredCaps(), getMissingCapabilities(), getCapabilityGroups() |
| `provider-execution/budget-guard.ts` | D | AIBudgetGuardDecision (4), AIBudgetGuardState, evaluateBudgetGuard(), isBudgetBlocking(), shouldWarnAboutBudget(), formatRemainingBudget() |
| `provider-execution/provider-adapter-contract.ts` | E | AIProviderAdapterCapability, AIProviderAdapterRequest, AIProviderAdapterResponse, AIProviderAdapterHealthCheck, AIProviderAdapterErrorCategory (10), AIProviderAdapterError, AIProviderAdapterContract interface |
| `provider-execution/index.ts` | F | Barrel export for all provider-execution types and helpers |
| `runtime/bridge-types.ts` | F | Added: active_features to AIExecutionBridgeContext; readiness_check to AIExecutionBridgeResult |
| `runtime/step-bridge.ts` | F | runStepBridgeLifecycle() now runs checkProviderExecutionReadiness() and includes result |
| `runtime/plan-bridge.ts` | F | buildStepBridgeContext() now passes active_features; inline bridge results updated |

---

## §4 — Execution Guard: 12 Checks

### Check table

| # | Check ID | Decision on Fail | Description |
|---|----------|-----------------|-------------|
| 1 | `run_execute_flag` | deny | `context.run_execute` and `policy.run_execute` both must be true |
| 2 | `dealer_pro_plus_access` | deny | `active_features` must include `"ai_gateway"` |
| 3 | `ai_gateway_feature_enabled` | needs_configuration | gateway.status must not be `"not_pro_plus"`, `"not_configured"`, or `"migration_required"` |
| 4 | `target_agent_feature_enabled` | needs_configuration | agent's `requiredFeature` must be in `active_features` |
| 5 | `provider_configured` | needs_configuration | `gateway.provider` must be non-null |
| 6 | `provider_enabled` | needs_configuration | `gateway.status` must not be `"disabled"` |
| 7 | `encrypted_key_exists` | needs_configuration | `gateway.status` must not be `"no_key"` |
| 8 | `capability_supported_by_provider` | needs_configuration | Provider must support all `required_caps` |
| 9 | `usage_policy_allows` | deny | `usage_policy.limit_reached && hard_limit && enforce_hard_limit` blocks |
| 10 | `monthly_limit_not_exceeded` | deny | `current_month_usd + estimated_cost_usd <= monthly_limit_usd` (if limit set) |
| 11 | `dealer_billing_acknowledged` | deny | `policy.dealer_billing_policy_confirmed` must be true |
| 12 | `no_key_exposure_risk` | deny | Structural: no `key/secret/token` fields in execution context object |

### Decision classification

- **deny** — execution is fundamentally not allowed (policy, billing, security)
- **needs_configuration** — dealer can unblock by configuring the AI Gateway settings

### Sprint 11M behavior

Check #1 (`run_execute_flag`) always fails in Sprint 11M because `DEFAULT_PROVIDER_EXECUTION_POLICY.run_execute` is `false`. This is by design — the guard runs as diagnostic infrastructure, returning `decision: "deny"` with `failed_check: "run_execute_flag"` on every step. Sprint 11N+ will set `run_execute: true` when concrete provider adapters are implemented.

---

## §5 — Capability Routing

### Task type → provider capabilities

| AITaskType | Required AICapability[] |
|------------|------------------------|
| `content_writing` | text_generation, chat_completion |
| `image_analysis` | vision, ocr |
| `video_generation` | video_generation |
| `review_request_generation` | text_generation, chat_completion |
| `review_writing_support` | text_generation, chat_completion |
| `review_response_drafting` | text_generation, chat_completion |
| `keyword_extraction` | text_generation, seo_analysis |
| `reputation_analysis` | text_generation, analytics |

### Capability group labels

| AICapability | Routing Group |
|-------------|--------------|
| text_generation, chat_completion, function_calling | chat |
| embeddings | embeddings |
| vision | vision |
| ocr | ocr |
| image_generation | image_generation |
| video_generation | video_generation |
| seo_analysis | seo |
| meo_analysis | meo |
| aeo_analysis | aeo |
| llmo_analysis | llmo |
| aio_analysis | aio |
| social_post | social_post |
| analytics | analytics |
| reporting | reporting |

### resolveRequiredCaps

`resolveRequiredCaps(agent_id, task_type)` merges `AI_AGENT_REGISTRY[agent_id].requiredProviderCaps` with `TASK_TO_PROVIDER_CAPS[task_type]`, deduplicated. This is the definitive required capability list for the execution guard's check #8.

---

## §6 — Budget Guard

### Decision model

| Condition | Decision |
|-----------|----------|
| `monthly_limit_usd === 0` | allow (no limit configured) |
| `!usage_tracking_available` | usage_unknown (tracking not yet migrated) |
| `hard_limit && limit_reached` | hard_stop |
| `current_month_usd + estimated_cost_usd > monthly_limit_usd` | hard_stop |
| `current_month_usd / monthly_limit_usd >= warning_threshold` | soft_warning |
| otherwise | allow |

### Sprint 11M behavior

`usage_tracking_available` is always `false` in Sprint 11M — the `dealer_ai_usage_log` table requires a CTO-approved migration that has not been created yet. This means `budget_decision` will be `"usage_unknown"` whenever `monthly_limit_usd > 0`, and `"allow"` when no limit is set.

`isBudgetBlocking()` returns false for `usage_unknown` — the budget guard does not block execution when tracking data is unavailable. Only `hard_stop` is blocking.

### Office AZ billing principle

AI inference costs are ALWAYS billed to the dealer's own provider API key. Office AZ never pays inference costs. This is enforced by:
1. The `dealer_billing_acknowledged` check in the execution guard
2. The `AIProviderAdapterContract` — the adapter fetches the dealer's encrypted key by `dealer_id`; it NEVER accepts an `api_key` parameter

---

## §7 — Provider Adapter Contract

### Interface summary

```typescript
AIProviderAdapterContract {
  readonly provider_id:       AIProviderId
  readonly capabilities:      AIProviderAdapterCapability[]
  readonly adapter_available: false    // Always false until Sprint 11N+

  healthCheck(dealer_id: string, now: string): Promise<AIProviderAdapterHealthCheck>
  execute(request: AIProviderAdapterRequest): Promise<AIProviderAdapterResponse>
}
```

### Security constraints on the contract

- `AIProviderAdapterRequest` has NO `api_key` field — the concrete adapter fetches the encrypted key from the server-side store using `dealer_id` only
- `dealer_id` in the request must come from `getCurrentDealer()` in the calling server action
- `AIProviderAdapterResponse.output_payload` is `null` in Sprint 11M — `execution_deferred: true` is a literal on the response type
- `AIProviderAdapterError.message` must be user-readable and safe to display in dealer UI — never includes raw API errors, stack traces, or key fragments

### Sprint 11N+ implementation location

Concrete adapters will be created in `src/lib/ai/adapters/{provider_id}.ts` for each of the 5 supported providers (openai, anthropic, gemini, azure_openai, openrouter). They will implement `AIProviderAdapterContract` and register themselves in the provider registry.

---

## §8 — Live Bridge Integration (Phase F)

### Changes to Sprint 11L files

#### `runtime/bridge-types.ts`

Added to `AIExecutionBridgeContext`:
```typescript
active_features: AppFeature[]   // forwarded to readiness guard
```

Added to `AIExecutionBridgeResult`:
```typescript
readiness_check: AIProviderExecutionGuardResult | null
// null for skipped/blocked steps that never reach the guard
// present for all lifecycle-prepared steps
```

#### `runtime/step-bridge.ts`

`runStepBridgeLifecycle()` now:
1. Calls `resolveRequiredCaps(step.agent_id, step.task_type)` from capability routing
2. Builds `AIProviderExecutionRequest` from the step bridge context
3. Calls `checkProviderExecutionReadiness(request, DEFAULT_PROVIDER_EXECUTION_POLICY, now)`
4. Includes the resulting `AIProviderExecutionGuardResult` in the returned `AIExecutionBridgeResult`

In Sprint 11M, the readiness check always returns `decision: "deny"` (check #1 fails — `run_execute: false`). This is the correct and expected behavior — the bridge returns full diagnostic readiness information without ever triggering execution.

#### `runtime/plan-bridge.ts`

`buildStepBridgeContext()` now passes `active_features: request.active_features` to `AIExecutionBridgeContext`. The two inline bridge results (for `skipped_optional` and `blocked_*` paths) now include `readiness_check: null`.

---

## §9 — Security Constraints

All Sprint 11K, 11L, and 11J security constraints remain in force. Sprint 11M adds:

1. **No adapter SDK imports**: `provider-execution/` contains no imports from any AI provider SDK (openai, @anthropic-ai/sdk, @google/generative-ai, etc.)
2. **No raw API key fields**: `AIProviderAdapterRequest`, `AIProviderExecutionContext`, and all types in this sprint have no `api_key`, `api_token`, or `bearer_token` fields
3. **no_key_exposure_risk structural check**: Check #12 in the execution guard performs a runtime field-name scan of the execution context to verify no sensitive-sounding fields were accidentally added. Always passes by architectural convention — fails only if the type contract is violated.
4. **run_execute: false is the safety default**: `DEFAULT_PROVIDER_EXECUTION_POLICY.run_execute` is `false`. Execution must be explicitly unlocked in Sprint 11N+ by setting it to `true` in the execution policy.
5. **Budget guard does not block on unknown**: When `usage_tracking_available: false`, the guard returns `usage_unknown` (not `hard_stop`). This is safe — real spending limits are enforced at the provider key level (dealer's account).

---

## §10 — Sprint Roadmap

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| Sprint 11J | AI Orchestration Engine Foundation | Complete |
| Sprint 11K | AI Orchestrator Runtime Dry-Run | Complete |
| Sprint 11L | AI Orchestrator Live Runtime Bridge | Complete |
| **Sprint 11M** | **AI Provider Execution Readiness (this document)** | **Complete** |
| Sprint 11N+ | Concrete provider adapters (OpenAI first), run_execute: true, real agent.execute() calls | Planned |
| Sprint 11N+ | Execution history persistence (dealer_ai_execution_log — CTO approval required) | Planned |
| Sprint 11N+ | Budget tracking migration (dealer_ai_usage_log — CTO approval required) | Planned |
| Sprint 11N+ | run_validate: true (when real trigger payloads available) | Planned |
| Sprint 11N+ | Approval gate UI (dealer reviews output, approves/rejects) | Planned |
