# AI Settings Platform Specification
## GYEON Detailer Agent — Sprint 11O

| Field | Value |
|-------|-------|
| **Version** | 2.0 |
| **Status** | Persistence Layer Complete |
| **Sprint** | 11R (updated from 11O) |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/ai-settings/` |
| **AI Provider Execution** | Deferred — Sprint 11V+ |
| **DB Persistence** | Implemented — Sprint 11R (two-layer strategy) |

---

## §1 — Overview

Sprint 11O implements the AI Settings Platform foundation — a canonical configuration layer for dealer-owned AI providers. The platform sits between the AI Orchestrator (which executes plans) and the AI Gateway (which stores provider keys), providing a richer per-dealer configuration model with provider selection, capability assignment, budget policy, and execution preference.

This sprint delivers the architecture and runtime foundation only. No real provider execution, no DB migrations, no SDK imports.

### What Sprint 11O delivers

1. **Settings profile domain** — `AISettingsProfile`: the canonical in-memory dealer AI configuration, with provider selection, capability assignments, budget policy, execution preference, and provider health
2. **Provider selection model** — `AIProviderSelectionConfig`, `AIProviderSelectionRule`, `buildDefaultProviderSelection()`, `getProviderForCapability()`, `getOrderedProviders()`
3. **Capability assignment** — per-capability provider routing with `preferred/fallback/disabled` status for all 16 `AICapability` values
4. **Budget policy** — `AIBudgetPolicyConfig` with monthly limit, warning threshold, emergency stop, budget strategy, and `evaluateBudgetPolicy()`
5. **Settings view models** — `AISettingsPlatformView` with provider cards, capability cards, budget card, health cards; `buildSettingsPlatformView()` factory
6. **Orchestrator integration** — `consultAISettingsForExecution()` pre-guard consult; `buildExecutionContextFromSettings()` for populating `AIProviderExecutionContext`
7. **`buildUsagePolicyFromBudgetPolicy()`** — bridge from `AIBudgetPolicyConfig` to `AIUsagePolicy` for execution guard compatibility

### What Sprint 11O does NOT do

- Does NOT implement DB persistence for settings (requires future migration — CTO approval)
- Does NOT import any AI provider SDK
- Does NOT make network calls
- Does NOT expose dealer API keys in any type or function
- Does NOT execute AI inference or generate fake output
- Does NOT modify any database schema

---

## §2 — Architecture

```
src/lib/ai-settings/
  ├── settings-profile-types.ts    Phase A — core domain (AISettingsProfile, AIProviderHealth, AIExecutionPreference)
  ├── provider-selection.ts        Phase B — provider selection model
  ├── capability-assignment.ts     Phase C — per-capability provider routing
  ├── budget-policy.ts             Phase D — dealer billing policy
  ├── settings-view-models.ts      Phase E — UI view models
  ├── orchestrator-integration.ts  Phase F — orchestrator integration layer
  └── index.ts                     barrel export

Integration data flow (Sprint 11P+):
  Server Action
    → getCurrentDealer()                            dealer_id
    → load AISettingsProfile from DB
    → consultAISettingsForExecution()               ai-settings (this module)
    → checkProviderExecutionReadiness()             ai-orchestrator/provider-execution
    → agent.execute()                               Sprint 11P+
```

### Module position in the AI stack

| Layer | Module | Purpose |
|-------|--------|---------|
| Gateway | `src/lib/ai/` | Key storage, provider registry, task routing |
| Settings Platform | `src/lib/ai-settings/` | Dealer configuration, capability assignment, budget |
| Orchestrator | `src/lib/ai-orchestrator/` | Execution planning, guard evaluation, adapter registry |
| Agent Framework | `src/lib/ai/agents/` | Agent definitions, registry, coordination |

### Dependency direction

`ai-settings` imports from `ai` (gateway types) and `ai-orchestrator/provider-adapters` (for `AIAdapterSelectionStrategy`). Neither `ai` nor `ai-orchestrator` imports from `ai-settings` — no circular dependencies.

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `settings-profile-types.ts` | A | AIProviderHealthStatus (6), AIProviderHealth, AIProviderHealthMap, AIExecutionPreferenceMode (4), AIExecutionPreference, AIProviderConfiguration, AIProviderPriority, AISettingsProfile, AISettingsPlatformDescriptor, AI_SETTINGS_PLATFORM |
| `provider-selection.ts` | B | AIProviderSelectionRule, AIProviderSelectionConfig, DEFAULT_PROVIDER_SELECTION, buildDefaultProviderSelection(), getProviderForCapability(), getOrderedProviders(), isProviderSelectionConfigured() |
| `capability-assignment.ts` | C | AICapabilityAssignmentStatus (3), AICapabilityAssignment, AICapabilityAssignmentMap, DEFAULT_CAPABILITY_ASSIGNMENTS, buildDefaultCapabilityAssignments(), getAssignmentForCapability(), isCapabilityEnabled(), getEnabledCapabilities(), getDisabledCapabilities() |
| `budget-policy.ts` | D | AIBudgetStrategy (3), AIBudgetPolicyConfig, DEFAULT_BUDGET_POLICY, AIBudgetPolicyEvaluation, evaluateBudgetPolicy(), isBudgetPolicyBlocking(), buildUsagePolicyFromBudgetPolicy() |
| `settings-view-models.ts` | E | AIProviderStatusCard, AICapabilityAssignmentCard, AIBudgetCard, AIHealthCard, AISettingsPlatformView, buildProviderStatusCards(), buildCapabilityAssignmentCards(), buildBudgetCard(), buildHealthCards(), buildSettingsPlatformView() |
| `orchestrator-integration.ts` | F | AISettingsConsultDecision (6), AISettingsConsultResult, AISettingsExecutionContext, AISettingsIntegrationStatus, AI_SETTINGS_INTEGRATION, consultAISettingsForExecution(), buildExecutionContextFromSettings(), getSettingsIntegrationStatus() |
| `index.ts` | all | Barrel export; also re-exports AIUsagePolicy from gateway layer |

---

## §4 — Settings Profile Domain (Phase A)

### AISettingsProfile

The canonical in-memory representation of a dealer's complete AI configuration.

```typescript
interface AISettingsProfile {
  dealer_id:               string;                                    // Always from getCurrentDealer()
  provider_selection:      AIProviderSelectionConfig;
  provider_configurations: Partial<Record<AIProviderId, AIProviderConfiguration>>;
  capability_assignments:  AICapabilityAssignmentMap;
  budget_policy:           AIBudgetPolicyConfig;
  execution_preference:    AIExecutionPreference;
  provider_health:         AIProviderHealthMap;
  is_ai_enabled:           boolean;
  is_configured:           boolean;
  profile_version:         string;
  built_at:                string;
}
```

`dealer_id` must always come from `getCurrentDealer()` in the server action that assembles the profile. Never from client input, never from URL parameters.

### AIProviderHealth

| Status | Meaning |
|--------|---------|
| `healthy` | Last check succeeded; provider responded within latency threshold |
| `degraded` | Elevated latency or partial failure |
| `unreachable` | Could not reach the provider endpoint |
| `not_checked` | Health check not yet performed (default) |
| `key_invalid` | Authentication error on last check |
| `rate_limited` | Rate limit response on last check |

### AIExecutionPreference modes

| Mode | Description |
|------|-------------|
| `quality` | Prioritize response quality (Anthropic / GPT-4); may be slower and costlier |
| `cost` | Prioritize cost efficiency (Gemini / OpenRouter) |
| `speed` | Prioritize low latency |
| `balanced` | Balance cost, quality, and speed (default) |

---

## §5 — Provider Selection Model (Phase B)

### AIProviderSelectionConfig

```typescript
interface AIProviderSelectionConfig {
  primary_provider:    AIProviderId | null;
  fallback_providers:  AIProviderId[];
  selection_rules:     AIProviderSelectionRule[];
  strategy:            AIAdapterSelectionStrategy;  // from adapter registry
}
```

`buildDefaultProviderSelection(primary?)` — creates a minimal config with one selection rule for the primary provider.

`getProviderForCapability(selection, capability, assignments)` — returns the preferred provider for a capability by checking the capability assignment map first, then falling back to `primary_provider`.

`getOrderedProviders(selection)` — returns all providers in priority order (primary first, then fallbacks), deduplicated.

### Supported providers

All 5 providers are supported: `openai`, `anthropic`, `gemini`, `azure_openai`, `openrouter`. New providers can be added to `AIProviderId` and the adapter registry without changes to this module.

---

## §6 — Capability Assignment (Phase C)

### AICapabilityAssignmentStatus

| Status | Meaning |
|--------|---------|
| `preferred` | Dealer explicitly assigned a preferred provider for this capability |
| `fallback` | Assigned as fallback only; prefers a different provider |
| `disabled` | Dealer explicitly disabled this capability |

Unassigned capabilities (not in the map) are considered **enabled** and inherit the `primary_provider`.

### AICapabilityAssignmentMap

Partial record over all 16 `AICapability` values. Each entry carries:
- `capability` — the AICapability key
- `status` — preferred / fallback / disabled
- `preferred_provider` — AIProviderId or null
- `fallback_provider` — AIProviderId or null
- `notes` — English note for diagnostics

### buildDefaultCapabilityAssignments(primary_provider)

Pre-assigns 6 core text capabilities (`text_generation`, `chat_completion`, `function_calling`, `social_post`, `analytics`, `reporting`) to the primary provider. Specialized capabilities are left unassigned.

---

## §7 — Budget Policy (Phase D)

### AIBudgetStrategy

| Strategy | Description |
|----------|-------------|
| `preferred_cost` | Minimize cost; accept good quality (Gemini / OpenRouter preferred) |
| `quality` | Maximize quality regardless of cost (Anthropic / GPT-4 preferred) |
| `balanced` | Balance cost, quality, and speed per request (default) |

### AIBudgetPolicyConfig

| Field | Default | Description |
|-------|---------|-------------|
| `monthly_limit_usd` | 0 | Monthly spend cap. 0 = no limit |
| `warning_threshold` | 0.8 | Fraction of limit at which to warn (80%) |
| `emergency_stop_usd` | null | Absolute hard stop regardless of limit |
| `budget_strategy` | "balanced" | Cost/quality strategy |
| `auto_pause_on_limit` | false | Pause executions when limit is reached |
| `alert_on_warning` | true | Emit dealer alert at warning threshold |
| `reset_day` | 1 | Day of month budget counter resets (1–28) |

### evaluateBudgetPolicy evaluation order

1. **Emergency stop** — if `emergency_stop_usd` is set and projected spend exceeds it, always blocks
2. **Monthly limit** — if `monthly_limit_usd > 0` and projected exceeds it:
   - `auto_pause_on_limit: true` → blocks with `blocking_reason`
   - `auto_pause_on_limit: false` → proceeds with `warning_message`
3. **Warning threshold** — if projected exceeds `monthly_limit_usd × warning_threshold` → `warning_message` (non-blocking)
4. **No limit** — proceeds cleanly

### buildUsagePolicyFromBudgetPolicy

Converts `AIBudgetPolicyConfig` to `AIUsagePolicy` for compatibility with the existing 13-check execution guard. `dealer_id` must come from `getCurrentDealer()`.

---

## §8 — Settings View Models (Phase E)

### AISettingsPlatformView structure

```
AISettingsPlatformView
  provider_cards        []  5 AIProviderStatusCard (all providers)
  capability_cards      []  16 AICapabilityAssignmentCard (all capabilities)
  budget_card               AIBudgetCard
  health_cards          []  5 AIHealthCard (all providers)
  default_provider          AIProviderId | null
  fallback_providers    []  AIProviderId[]
  execution_preference      AIExecutionPreference
  is_fully_configured       boolean
  configuration_issues  []  English descriptions of missing config
  view_built_at             ISO 8601
```

### buildSettingsPlatformView(profile, settings, current_month_usd, now)

The main factory. Takes:
- `AISettingsProfile` — from server action (includes getCurrentDealer())
- `AiSettingsView` — gateway key status (has_key per provider, never the key itself)
- `current_month_usd` — defaults to 0 until `dealer_ai_usage_log` migration
- `now` — ISO 8601 timestamp

Configuration issues are detected and reported in English:
- AI features disabled
- No primary provider configured
- No provider API key stored

No UI is implemented in Sprint 11O.

---

## §9 — Orchestrator Integration (Phase F)

### AISettingsConsultDecision

| Decision | Meaning |
|----------|---------|
| `proceed` | Settings allow this execution; proceed to execution guard |
| `proceed_with_warnings` | Allowed, but soft warnings exist (e.g. near budget limit) |
| `blocked_gateway` | AI features not enabled for this dealer |
| `blocked_capability` | Capability is explicitly disabled in assignments |
| `blocked_no_provider` | No provider configured for this capability |
| `blocked_budget` | Budget policy blocks this execution |

### consultAISettingsForExecution evaluation order

1. Is AI enabled? → `blocked_gateway` if not
2. Is capability enabled in assignments? → `blocked_capability` if disabled
3. Is a provider configured for this capability? → `blocked_no_provider` if not
4. Does budget policy allow? → `blocked_budget` if not
5. → `proceed` or `proceed_with_warnings`

### AISettingsExecutionContext

Returned by `buildExecutionContextFromSettings()`. Contains settings-derived fields that the calling server action merges into `AIProviderExecutionContext`:
- `selected_provider` → `gateway_provider`
- `required_caps` → `required_caps`
- `estimated_cost_usd` → `estimated_cost_usd` for budget guard
- `budget_strategy` → informational
- `run_execute: false` — always false in Sprint 11O

### Circular dependency prevention

`ai-settings/orchestrator-integration.ts` does NOT import `AIProviderExecutionContext` from `ai-orchestrator`. The `AISettingsExecutionContext` is a standalone type. The calling server action merges both into the final context.

---

## §10 — Security Constraints

All Sprint 11J–11N security constraints remain in force. Sprint 11O adds:

1. **No API key fields**: all types in `ai-settings/` have no `api_key`, `token`, or `secret` fields
2. **dealer_id in AISettingsProfile**: always sourced from `getCurrentDealer()` in the server action that builds the profile — never from client input
3. **adapter_available: false**: AIProviderStatusCard has `adapter_available: false` as a literal type — no Sprint 11O type can advertise an adapter as available
4. **run_execute: false**: AISettingsExecutionContext has `run_execute: false` as a literal type — no Sprint 11O type can authorize execution
5. **No DB calls in pure module**: `consultAISettingsForExecution()` and all helpers are pure functions — they accept pre-loaded data, make no DB or network calls
6. **No SDK imports**: `ai-settings/` imports no AI provider SDK

---

## §11 — Sprint Roadmap

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| Sprint 11J | AI Orchestration Engine Foundation | Complete |
| Sprint 11K | AI Orchestrator Runtime Dry-Run | Complete |
| Sprint 11L | AI Orchestrator Live Runtime Bridge | Complete |
| Sprint 11M | AI Provider Execution Readiness | Complete |
| Sprint 11N | AI Provider Adapter Registry Foundation | Complete |
| **Sprint 11O** | **AI Settings Platform Foundation (this document)** | **Complete** |
| **Sprint 11R** | **Persistence layer: repository + server actions + provider resolution + errors** | **Complete** |
| Sprint 11S | AI Settings provider card UI using `buildSettingsPlatformView()` | Planned |
| Sprint 11S | Wire `consultAISettingsForExecution()` in orchestrator server actions | Planned |
| Sprint 11S | Real `current_month_usd` (requires CTO to apply migration 073) | Planned |
| Sprint 11V | Concrete OpenAI adapter (`adapter_available: true`, `run_execute: true`) | Planned |

---

## §12 — Sprint 11R: Persistence Layer (Addendum)

Sprint 11R implements the persistence layer for the AI Settings Platform.

### New source files

```
src/lib/ai-settings/
  ├── errors.ts                          Phase E — canonical error types + AISettingsResult<T>
  ├── provider-resolution.ts             Phase D — 4-level provider resolution chain
  ├── repository/
  │   ├── repository-types.ts            Phase A — AISettingsRepository + AIUsageRepository interfaces
  │   ├── settings-repository.ts         Phase A — Supabase two-layer implementation
  │   ├── usage-repository.ts            Phase A — Supabase usage log reader
  │   ├── repository-factory.ts          Phase A — AI_SETTINGS_REPOSITORY_FACTORY
  │   └── index.ts
  └── actions/
      ├── get-ai-settings-profile.ts     Phase B — getAISettingsProfile() server action
      ├── save-ai-settings-profile.ts    Phase B — saveAISettingsProfile() server action
      ├── get-ai-usage-summary.ts        Phase B — getAIUsageSummary() server action
      ├── validate-ai-settings.ts        Phase E — validateAISettingsInput()
      └── index.ts
```

### Canonical storage model (Architecture clarification)

**`dealer_ai_settings` table is the ONLY long-term canonical source of truth.**

| Layer | Table | Role | Write? |
|-------|-------|------|--------|
| Canonical | `dealer_ai_settings` (migration 072) | AI Settings profile storage | Yes — only write target |
| Compat read | `dealer_settings.ai_settings` JSONB (migration 070) | Backward compat during migration window | No — read-only |
| Key status | `dealer_settings.ai_settings` JSONB (migration 070) | Provider key presence (always from here) | Via `saveAiSettings()` only |

**Save policy**: `saveAISettingsProfile()` writes to `dealer_ai_settings` table **only**. If the table does not exist (migration 072 not yet applied), the save returns `MIGRATION_REQUIRED` — it does **not** fall back to writing JSONB. This enforces migration 072 as a hard prerequisite for extended AI settings persistence.

**Load policy**: Load tries `dealer_ai_settings` first, then falls back to `dealer_settings.ai_settings` JSONB for compat read (basic config + any pre-architecture extended keys). The `storage_source` field in `AISettingsLoadResult` reports which layer responded:
- `"dealer_ai_settings_table"` — canonical, migration 072 applied
- `"dealer_settings_compat"` — compat read, migration 072 not yet applied
- `"defaults"` — no stored data found

**Future cleanup task**: Once all dealers have migrated to the `dealer_ai_settings` table and no JSONB-stored data remains, the compat read path should be removed from `settings-repository.ts`. Tracked as Sprint 11T+ cleanup item.

### Repository design

```typescript
// Interface (independent of Supabase)
interface AISettingsRepository {
  load(dealer_id: string): Promise<AISettingsResult<AISettingsLoadResult>>;
  save(dealer_id: string, payload: AISettingsSavePayload): Promise<AISettingsPersistenceResult>;
}

interface AIUsageRepository {
  getMonthlySpend(dealer_id: string, period: string): Promise<number>;
  getSummary(dealer_id: string, period: string): Promise<AIUsageSummaryResult>;
}
```

Implementations are created by `AI_SETTINGS_REPOSITORY_FACTORY`. Server actions import the factory and never depend on the Supabase implementation directly.

### Provider resolution chain (4 levels)

| Level | Source | Field |
|-------|--------|-------|
| 1 | Capability assignment preferred | `capability_assignments[cap].preferred_provider` |
| 2 | Capability assignment fallback | `capability_assignments[cap].fallback_provider` |
| 3 | Primary + fallback providers | `provider_selection.primary_provider`, `.fallback_providers` |
| 4 | System default | First `is_enabled && is_selected` in `provider_configurations` |

### Canonical error codes

| Code | Meaning |
|------|---------|
| `SETTINGS_NOT_CONFIGURED` | No AI settings found |
| `PROVIDER_DISABLED` | Dealer disabled the provider |
| `PROVIDER_NOT_AVAILABLE` | Adapter not yet implemented |
| `FEATURE_NOT_LICENSED` | Pro+ required |
| `SUBSCRIPTION_REQUIRED` | Active subscription required |
| `BUDGET_LIMIT_REACHED` | Monthly budget exceeded |
| `PROVIDER_UNKNOWN` | Provider not in registry |
| `ENCRYPTION_NOT_CONFIGURED` | DEALER_AI_KEY_SECRET missing |
| `VALIDATION_FAILED` | Input validation failed |
| `PERSISTENCE_ERROR` | Database write failed |
| `AUTHENTICATION_FAILED` | getCurrentDealer() returned null |
| `MIGRATION_REQUIRED` | Required DB column/table missing |
| `USAGE_NOT_AVAILABLE` | dealer_ai_usage_log not yet created |

### Settings availability update

- `AISettingsPlatformDescriptor.settings_available` → `true` (was `false`)
- `AISettingsIntegrationStatus.settings_available` → `true` (was `false`)
- Both version fields updated to `"1.1.0-persisted"`

### What Sprint 11R does NOT do

- Does NOT apply migrations 072 or 073 (CTO approval still required)
- Does NOT implement AI provider execution (`run_execute` still `false`)
- Does NOT import AI provider SDKs
- Does NOT make external API calls
- Does NOT expose raw API keys in any type or path
