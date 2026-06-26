# AI Provider Adapter Registry Specification
## GYEON Detailer Agent — Sprint 11N

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Registry Foundation Complete |
| **Sprint** | 11N |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/ai-orchestrator/provider-adapters/` |
| **AI Provider Execution** | Deferred — Sprint 11O+ |
| **Concrete Adapters** | Deferred — Sprint 11O+ |

---

## §1 — Overview

Sprint 11N implements the AI Provider Adapter Registry foundation — a static declarative registry of all 5 supported AI providers, with per-capability support declarations, selection policy models, and AI Settings UI compatibility.

This sprint does not implement concrete adapter classes or execute any AI provider calls. All 5 descriptors have `adapter_available: false`. The registry is purely declarative.

### What Sprint 11N delivers

1. **Adapter registry domain** — `AIProviderAdapterDescriptor`, `AIProviderAdapterCapabilityMap`, `AICapabilitySupportStatus`, `AIAdapterRegistryDecision`, selection policy types
2. **5 built-in provider descriptors** — OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, OpenRouter; all `adapter_status: "planned"`, `adapter_available: false`
3. **Capability maps** — per-provider capability declarations with `support_status` (planned / supported_later / unavailable / requires_review) for all 16 AICapability values
4. **Selection policy model** — 6 strategies, 4 pre-built policies (default, quality-first, cost-optimized, enterprise), `resolveSelectionOrder()` for Sprint 11O+
5. **Execution guard integration** — check #13 (`adapter_registry_check`) added to the 13-check guard; 3 new decision values: `needs_adapter`, `provider_unknown`, `capability_unavailable`
6. **AI Settings compatibility** — `getAdapterSummariesForSettings()`, `getCapabilityBadgesForProvider()`, and `AIProviderAdapterSummaryForSettings` for the future settings UI provider cards

### What Sprint 11N does NOT do

- Does NOT implement concrete provider adapter classes
- Does NOT import any AI provider SDK
- Does NOT make network calls or test provider connectivity
- Does NOT expose dealer API keys in any type or function
- Does NOT execute any AI inference or generate fake output
- Does NOT modify any database schema or migrate data

---

## §2 — Architecture

```
src/lib/ai-orchestrator/provider-adapters/
  ├── adapter-registry-types.ts     Phase A — domain types
  ├── capability-map.ts             Phase C — per-provider capability declarations
  ├── provider-descriptors.ts       Phase B — 5 built-in descriptors + AI_PROVIDER_ADAPTER_DESCRIPTORS
  ├── selection-policy.ts           Phase D — selection strategy model + helpers
  ├── settings-compatibility.ts     Phase F — AI Settings UI bridge
  └── index.ts                      barrel export + inspectAdapterRegistry()

Integration:
  provider-execution/
    execution-readiness-types.ts   Sprint 11N: AIProviderExecutionDecision extended (+3 values)
                                               AIProviderExecutionCheckId extended (+adapter_registry_check)
    execution-guard.ts             Sprint 11N: check #13 added; classifyAdapterRegistryDecision()
```

### Registry vs. gateway-layer registry

| Registry | Location | Purpose |
|----------|----------|---------|
| `AI_PROVIDER_REGISTRY` | `src/lib/ai/provider-registry.ts` | Gateway layer — key storage metadata, model defaults, basic capabilities |
| `AI_PROVIDER_ADAPTER_DESCRIPTORS` | `provider-adapters/provider-descriptors.ts` | Orchestration layer — adapter status, detailed capability maps, selection tiers |

These registries coexist. The Sprint 11N registry is richer: it adds `support_status` per capability, selection tiers (cost/quality/speed), and adapter lifecycle state.

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `adapter-registry-types.ts` | A | AIProviderAdapterStatus (4), AICapabilitySupportStatus (4), AIProviderCapabilityDeclaration, AIProviderAdapterCapabilityMap, AIProviderAdapterDefaultModels, AIProviderAdapterDescriptor, AIProviderAdapterRegistry, AIAdapterRegistryDecision (4), AIAdapterRegistryInspection, AIAdapterSelectionStrategy (6), AIProviderAdapterSelectionPolicy, AIProviderAdapterValidationResult |
| `capability-map.ts` | C | OPENAI_CAPABILITY_MAP, ANTHROPIC_CAPABILITY_MAP, GEMINI_CAPABILITY_MAP, AZURE_OPENAI_CAPABILITY_MAP, OPENROUTER_CAPABILITY_MAP, PROVIDER_CAPABILITY_MAPS, getCapabilityDeclaration(), getUnavailableCapabilities(), getCapabilityGroupsForProvider() |
| `provider-descriptors.ts` | B | OPENAI/ANTHROPIC/GEMINI/AZURE_OPENAI/OPENROUTER_ADAPTER_DESCRIPTOR, AI_PROVIDER_ADAPTER_DESCRIPTORS (5), getAdapterDescriptor(), isProviderInAdapterRegistry(), getPlannedDescriptors(), getAvailableDescriptors() |
| `selection-policy.ts` | D | DEFAULT/QUALITY_FIRST/COST_OPTIMIZED/ENTERPRISE_SELECTION_POLICY, filterDescriptorsByPolicy(), rankDescriptorsByStrategy(), resolveSelectionOrder(), getSelectionPolicyLabel() |
| `settings-compatibility.ts` | F | AIProviderAdapterSummaryForSettings, AIProviderCapabilityBadge, AIAdapterRegistrySummaryForSettings, getAdapterSummary/SummariesForSettings(), getAdapterRegistrySummaryForSettings(), getCapabilityBadgesForProvider() |
| `index.ts` | all | Barrel export + inspectAdapterRegistry() |
| `provider-execution/execution-readiness-types.ts` | E | AIProviderExecutionDecision +3 values; AIProviderExecutionCheckId +adapter_registry_check; guard_checks_count updated 12→13; version bumped to 1.1.0-readiness |
| `provider-execution/execution-guard.ts` | E | checkAdapterRegistryStatus() (check #13); classifyAdapterRegistryDecision(); inspectAdapterRegistry() integrated |

---

## §4 — Provider Descriptors

### Summary table

| Provider | display_name | cost_tier | speed_tier | quality_tier | weight |
|----------|-------------|-----------|-----------|-------------|--------|
| openai | OpenAI | standard | fast | better | 0.8 |
| anthropic | Anthropic Claude | premium | standard | best | 0.9 |
| gemini | Google Gemini | budget | fast | better | 0.75 |
| azure_openai | Azure OpenAI | premium | fast | better | 0.7 |
| openrouter | OpenRouter | budget | fast | good | 0.65 |

All 5 descriptors have `adapter_status: "planned"`, `adapter_available: false`, `planned_adapter_sprint: "Sprint 11O+"`.

### Azure OpenAI note

`requires_endpoint: true` — Azure OpenAI dealers must provide a custom endpoint URL in AI Gateway settings. This is the only provider with this requirement.

---

## §5 — Capability Maps

### Capability support status values

| Status | Meaning |
|--------|---------|
| `planned` | Provider API supports it natively; adapter will implement in Sprint 11O+ |
| `supported_later` | Provider has limited/experimental access; no firm sprint commitment |
| `unavailable` | Provider's API cannot do this; will never be implemented |
| `requires_review` | Model-layer support exists but needs compliance/legal/policy review |

### Provider capability matrix

| AICapability | OpenAI | Anthropic | Gemini | Azure | OpenRouter |
|-------------|--------|-----------|--------|-------|------------|
| text_generation | planned | planned | planned | planned | planned |
| chat_completion | planned | planned | planned | planned | planned |
| function_calling | planned | planned | planned | planned | planned |
| embeddings | planned | **unavailable** | planned | planned | supported_later |
| vision | planned | planned | planned | planned | planned |
| ocr | planned | planned | planned | planned | planned |
| image_generation | supported_later | **unavailable** | supported_later | supported_later | planned |
| video_generation | **unavailable** | **unavailable** | supported_later | **unavailable** | **unavailable** |
| seo_analysis | requires_review | planned | planned | requires_review | planned |
| meo_analysis | requires_review | requires_review | requires_review | requires_review | requires_review |
| aeo_analysis | requires_review | requires_review | requires_review | requires_review | requires_review |
| llmo_analysis | requires_review | requires_review | requires_review | requires_review | requires_review |
| aio_analysis | requires_review | requires_review | planned | requires_review | requires_review |
| social_post | planned | planned | planned | planned | planned |
| analytics | planned | planned | planned | planned | planned |
| reporting | planned | planned | planned | planned | planned |

### Key "unavailable" capabilities

- `embeddings` is **unavailable** for Anthropic — the Messages API has no embeddings endpoint
- `image_generation` is **unavailable** for Anthropic — Anthropic has no image generation API
- `video_generation` is **unavailable** for OpenAI (text API), Anthropic, Azure OpenAI, OpenRouter

---

## §6 — Selection Policy Model

### Strategies

| Strategy | Description |
|----------|-------------|
| `dealer_default` | Use the dealer's configured `primary_provider` from AI Gateway settings |
| `lowest_estimated_cost` | Rank by `estimated_cost_tier` (budget < standard < premium) |
| `best_quality` | Rank by `quality_tier` (best > better > good) |
| `fastest_response` | Rank by `response_speed_tier` (fast < standard < slow) |
| `capability_required` | Filter to providers supporting required caps, then apply `dealer_default` order |
| `fallback_provider` | Try `preferred_provider` first, then `fallback_providers` in order |

### Pre-built policies

| Policy | Strategy | Notes |
|--------|----------|-------|
| `DEFAULT_ADAPTER_SELECTION_POLICY` | dealer_default | Used when no policy configured |
| `QUALITY_FIRST_SELECTION_POLICY` | best_quality | Anthropic preferred; min quality: "best" |
| `COST_OPTIMIZED_SELECTION_POLICY` | lowest_estimated_cost | Gemini/OpenRouter preferred; max tier: "standard" |
| `ENTERPRISE_SELECTION_POLICY` | fallback_provider | azure_openai → openai fallback |

No runtime selection in Sprint 11N. `resolveSelectionOrder()` returns a ranked `AIProviderId[]` for planning and Sprint 11O+ execution.

---

## §7 — Execution Guard Integration (Phase E)

### Check #13: adapter_registry_check

Added to the execution guard in `execution-guard.ts`. Calls `inspectAdapterRegistry(provider_id, required_caps)`.

| Registry Outcome | required | Decision |
|-----------------|----------|---------|
| provider_unknown | true | `provider_unknown` |
| capability_unavailable | true | `capability_unavailable` |
| needs_adapter | **false** | `needs_adapter` (informational) |
| adapter_available | false | passes |

`needs_adapter` is non-blocking (required: false) in Sprint 11N because all adapters have `adapter_available: false` by design. Check #1 (`run_execute_flag`) still fails first in Sprint 11N. Once Sprint 11O+ sets `run_execute: true` AND implements a concrete adapter, check #13 will naturally block if `capability_unavailable` or `provider_unknown` applies.

### Extended AIProviderExecutionDecision

```typescript
export type AIProviderExecutionDecision =
  | "allow"                  // Sprint 11M — all checks passed
  | "deny"                   // Sprint 11M — hard block
  | "needs_configuration"    // Sprint 11M — dealer must configure AI Gateway
  | "needs_adapter"          // Sprint 11N — adapter descriptor exists; not yet implemented
  | "provider_unknown"       // Sprint 11N — provider not in descriptor registry
  | "capability_unavailable"; // Sprint 11N — required capability unavailable for provider
```

### Updated guard check count

Sprint 11M: 12 checks. Sprint 11N: 13 checks (check #13 = `adapter_registry_check`).
`AI_PROVIDER_EXECUTION_READINESS.guard_checks_count` updated from 12 to 13.
`AI_PROVIDER_EXECUTION_READINESS.version` updated from `"1.0.0-readiness"` to `"1.1.0-readiness"`.

---

## §8 — AI Settings Compatibility (Phase F)

### Integration approach

The existing `AiSettingsView` type (`src/lib/ai/ai-settings-types.ts`) provides key-level provider status (`has_key: boolean`). The adapter registry provides richer adapter-level metadata.

The bridge type `AIProviderAdapterSummaryForSettings` combines:
- `provider_id`, `display_name` — for rendering provider cards
- `adapter_status`, `adapter_available`, `planned_sprint` — for showing adapter readiness
- `estimated_cost_tier`, `response_speed_tier`, `quality_tier` — for dealer comparison UI
- `planned_capability_groups` — routing group labels for capability badge display
- `requires_endpoint` — whether to show Azure endpoint input

`AIProviderCapabilityBadge` provides per-capability badge data sorted by status priority (planned → supported_later → requires_review → unavailable).

### Future Settings UI wiring

```
AiSettingsView.providers                   → key-level status (has_key, validated_at)
getAdapterSummariesForSettings()           → adapter-level status (tiers, capabilities)
getCapabilityBadgesForProvider(provider)   → per-capability badge list
getAdapterRegistrySummaryForSettings()     → registry overview for settings header
```

No UI is implemented in Sprint 11N. These helpers are ready for the settings UI sprint.

---

## §9 — Security Constraints

All Sprint 11K–11M security constraints remain in force. Sprint 11N adds:

1. **No SDK imports**: `provider-adapters/` imports no AI provider SDK
2. **No API key fields**: all types in `provider-adapters/` have no `api_key`, `token`, or `secret` fields
3. **adapter_available: false locked**: all 5 descriptors have `adapter_available: false`; attempting to type it as `true` causes a TypeScript compile error
4. **dealer_id never stored in registry**: the adapter registry stores no dealer-specific state
5. **inspection is pure lookup**: `inspectAdapterRegistry()` makes no DB calls or network calls

---

## §10 — Sprint Roadmap

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| Sprint 11J | AI Orchestration Engine Foundation | Complete |
| Sprint 11K | AI Orchestrator Runtime Dry-Run | Complete |
| Sprint 11L | AI Orchestrator Live Runtime Bridge | Complete |
| Sprint 11M | AI Provider Execution Readiness | Complete |
| **Sprint 11N** | **AI Provider Adapter Registry (this document)** | **Complete** |
| Sprint 11O+ | Concrete OpenAI adapter (adapter_available: true, run_execute: true) | Planned |
| Sprint 11O+ | Concrete Anthropic/Gemini/Azure/OpenRouter adapters | Planned |
| Sprint 11O+ | Execution history persistence (dealer_ai_execution_log — CTO approval) | Planned |
| Sprint 11O+ | Budget tracking migration (dealer_ai_usage_log — CTO approval) | Planned |
| Sprint 11O+ | AI Settings provider card UI using adapter registry summaries | Planned |
