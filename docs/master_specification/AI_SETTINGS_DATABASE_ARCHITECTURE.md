# AI Settings Database Architecture
## GYEON Detailer Agent — Sprint 11P

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Architecture Review — Proposals Only |
| **Sprint** | 11P |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **CTO Approval Required** | Yes — before any migration is applied |
| **Migrations Applied** | None — this document is proposals only |

---

## §1 — Overview

Sprint 11P reviews the existing database architecture and designs the persistence layer required to support the AI Settings Platform (Sprint 11O). No migrations are applied. No schema changes are made.

**Scope of this document:**
- Existing table inventory and AI-relevant schema
- Proposed `dealer_ai_settings` table (canonical AI Platform configuration)
- Proposed `dealer_ai_usage_log` table (execution usage tracking)
- Integration dependency review
- Security and RLS strategy
- Migration execution plan

**Not in scope:**
- Executing any migration
- Modifying any existing table
- Implementing server actions or persistence logic (Sprint 11Q+)

---

## §2 — Existing Database Architecture (Phase A)

### §2.1 — Migration inventory

| Migration | Purpose | AI-Relevant |
|-----------|---------|-------------|
| 001 | Core tables (customers, vehicles, estimates) | No |
| 002 | Enable RLS | No |
| 003 | `dealers`, `dealer_members` | Yes — tenant identity |
| 004 | SaaS RLS policies | Yes — access pattern |
| 049 | `dealers.plan`, `dealers.subscription_status` | Yes — Pro+ gate |
| 050 | Staff roles | No |
| 051 | Admin tables | No |
| 055 | `audit_logs` (immutable) | Yes — audit requirements |
| 058 | `subscription_plans`, `dealer_subscriptions` | Yes — plan features |
| 064 | `dealer_billing`, `billing_invoices` | Yes — billing context |
| 066 | Company settings | No |
| 067 | Vehicle registration OCR settings | Partial |
| 070 | `dealer_settings` canonical columns (27 additions) | **Yes — current AI storage** |
| 071 | Dealer approval flow | No |

### §2.2 — Tables relevant to AI Settings

#### `dealers`
```
id            uuid    PK
name          text
plan          text    CHECK IN ('basic', 'pro', 'pro_plus')
subscription_status text CHECK IN ('active', 'trial', 'expired', 'cancelled')
started_at    timestamptz
expired_at    timestamptz
```
**AI relevance**: Pro+ plan gates all `ai_*` AppFeatures. `dealers.id` is the foreign key for all AI settings tables.

#### `dealer_members`
```
id         uuid    PK
dealer_id  uuid    FK → dealers.id
user_id    uuid    FK → auth.users.id
role       text    CHECK IN ('owner', 'manager', 'staff', 'readonly')
status     text    CHECK IN ('active', 'invited', 'suspended', 'removed')
```
**AI relevance**: All RLS policies resolve `dealer_id` through `dealer_members` where `user_id = auth.uid() AND status = 'active'`. This is the canonical access pattern.

#### `dealer_settings` (current AI storage)
```
dealer_id       uuid    UNIQUE FK → dealers.id
...             (30+ other settings columns)
ai_settings     jsonb   -- current AI key and gateway config storage
```
**AI relevance — current usage of `ai_settings` jsonb:**
```json
{
  "enabled":                  boolean,
  "primary_provider":         "openai" | "anthropic" | "gemini" | "azure_openai" | "openrouter",
  "monthly_limit_usd":        number,
  "hard_limit":               boolean,
  "openai_key":               "v1:{iv}:{tag}:{ciphertext}",
  "anthropic_key":            "v1:{iv}:{tag}:{ciphertext}",
  "gemini_key":               "v1:{iv}:{tag}:{ciphertext}",
  "azure_openai_key":         "v1:{iv}:{tag}:{ciphertext}",
  "openrouter_key":           "v1:{iv}:{tag}:{ciphertext}",
  "azure_openai_endpoint":    "string",
  "{provider}_validated_at":  "ISO 8601"
}
```
**Known limitations of current approach:**
1. Everything in one JSONB blob — no column-level indexing
2. Encrypted keys and platform configuration share the same column
3. No dedicated row per provider — adding a provider requires application-level JSONB merge
4. Cannot add per-capability configuration, budget strategy, or health policy without further JSONB nesting

#### `audit_logs`
```
id              uuid    PK
dealer_id       uuid    FK → dealers.id
actor_user_id   uuid    FK → auth.users.id (nullable)
action          text    CHECK (16 allowed values)
resource_type   text    CHECK (13 allowed values)
resource_id     uuid
old_value       jsonb
new_value       jsonb
created_at      timestamptz
```
**AI relevance**: AI settings changes should be logged as `action: 'update'`, `resource_type: 'dealer_setting'`. The CHECK constraint will need extension for `'ai_settings_update'`, `'ai_provider_key_added'`, `'ai_capability_updated'` action values when Sprint 11Q implements persistence.

#### `dealer_billing`
```
id              uuid    PK
dealer_id       uuid    UNIQUE FK → dealers.id
plan_code       text
contract_status text    CHECK IN ('trial','active','expired','cancelled','suspended')
expires_at      timestamptz
```
**AI relevance**: `dealer_billing.contract_status` is checked alongside `dealers.plan` in the Pro+ gate evaluation. A dealer with `plan: 'pro_plus'` but `contract_status: 'suspended'` should NOT have AI access.

### §2.3 — Current AI storage analysis

The existing `dealer_settings.ai_settings` jsonb column is acceptable for:
- Encrypted API key storage (keys are opaque blobs; JSONB is fine)
- Simple `enabled` / `primary_provider` / `monthly_limit_usd` / `hard_limit` flags

The `dealer_settings.ai_settings` column is **not sufficient** for:
- Per-capability provider assignment (`AICapabilityAssignmentMap` — 16 capabilities)
- Budget strategy, emergency stop, reset_day
- Execution preference (mode, quality_threshold, max_latency_ms)
- Provider priority ordering with selection rules
- Health policy configuration
- Usage tracking (requires an append-only log table)

**Architecture decision**: Introduce a dedicated `dealer_ai_settings` table for AI Platform configuration, while keeping encrypted API keys in `dealer_settings.ai_settings` for backward compatibility. Key migration is deferred to Sprint 11R+.

---

## §3 — dealer_ai_settings Proposal (Phase B)

### §3.1 — Rationale

A dedicated table separates the AI Settings Platform configuration from the existing AI Gateway key storage. This allows:
- Proper RLS per row (not per JSONB key)
- Column-level indexing on `dealer_id`, `default_provider`, `updated_at`
- Clean migration path — can be added without touching `dealer_settings`
- Future normalization (e.g. per-capability rows) without JSONB schema changes

### §3.2 — Proposed schema

```sql
-- DO NOT APPLY — CTO approval required before executing this migration.
-- Proposed migration number: 072_dealer_ai_settings.sql

CREATE TABLE dealer_ai_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (always from getCurrentDealer() — never from client)
  dealer_id               uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Provider selection
  default_provider        text        CHECK (
    default_provider IN ('openai', 'anthropic', 'gemini', 'azure_openai', 'openrouter')
  ),
  fallback_providers      text[]      NOT NULL DEFAULT '{}',
  provider_priority_order text[]      NOT NULL DEFAULT '{}',

  -- Capability preferences
  -- Stores AICapabilityAssignmentMap as JSON object keyed by AICapability
  capability_preferences  jsonb       NOT NULL DEFAULT '{}',

  -- Execution preferences
  -- Stores AIExecutionPreference (mode, prefer_streaming, max_latency_ms, quality_threshold)
  execution_preferences   jsonb       NOT NULL DEFAULT '{}',

  -- Budget policy
  -- Stores AIBudgetPolicyConfig (monthly_limit_usd, warning_threshold, emergency_stop_usd,
  -- budget_strategy, auto_pause_on_limit, alert_on_warning, reset_day)
  budget_policy           jsonb       NOT NULL DEFAULT '{}',

  -- Health policy
  -- Stores dealer preferences for health check frequency, alert thresholds
  health_policy           jsonb       NOT NULL DEFAULT '{}',

  -- Version tracking for optimistic concurrency
  settings_version        integer     NOT NULL DEFAULT 1,

  -- Timestamps
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- One row per dealer (one-to-one relationship)
  CONSTRAINT dealer_ai_settings_dealer_id_unique UNIQUE (dealer_id)
);
```

### §3.3 — Indexes

```sql
-- Primary access pattern: load settings by dealer_id
CREATE INDEX idx_dealer_ai_settings_dealer_id
  ON dealer_ai_settings (dealer_id);

-- Secondary: find dealers using a specific default provider (admin analytics)
CREATE INDEX idx_dealer_ai_settings_default_provider
  ON dealer_ai_settings (default_provider)
  WHERE default_provider IS NOT NULL;

-- For updated_at ordering in admin views
CREATE INDEX idx_dealer_ai_settings_updated_at
  ON dealer_ai_settings (updated_at DESC);
```

### §3.4 — RLS strategy

```sql
ALTER TABLE dealer_ai_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: dealer members can read their own dealer's AI settings
CREATE POLICY "dealer_ai_settings_member_select"
  ON dealer_ai_settings FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: dealer members (owner/manager only — checked application-side)
CREATE POLICY "dealer_ai_settings_member_insert"
  ON dealer_ai_settings FOR INSERT
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- UPDATE: dealer members only (dealer_id must not change)
CREATE POLICY "dealer_ai_settings_member_update"
  ON dealer_ai_settings FOR UPDATE
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- NO DELETE policy — settings should not be deleted; use soft disable instead.
-- service_role can delete for data retention compliance (GDPR/data erasure).
```

### §3.5 — Normalization decision

**Chosen: One row per dealer (1:1 with dealers)**

Alternative considered: One row per (dealer, provider) for per-provider configuration.
- Rejected: Adds join complexity without benefit for the current feature set.
- `capability_preferences` and `budget_policy` apply dealer-wide, not per-provider.
- Per-provider model overrides are stored inside `capability_preferences` jsonb.

Future normalization path (Sprint 11S+):
- If per-provider settings grow beyond what JSONB handles well, a `dealer_ai_provider_configs` table can be added without breaking `dealer_ai_settings`.

### §3.6 — JSONB column schemas

#### `capability_preferences` jsonb schema
```json
{
  "text_generation": {
    "capability": "text_generation",
    "status": "preferred",
    "preferred_provider": "anthropic",
    "fallback_provider": "openai",
    "notes": ""
  },
  "vision": {
    "capability": "vision",
    "status": "preferred",
    "preferred_provider": "openai",
    "fallback_provider": null,
    "notes": ""
  },
  "video_generation": {
    "capability": "video_generation",
    "status": "disabled",
    "preferred_provider": null,
    "fallback_provider": null,
    "notes": "Not yet available"
  }
}
```
Default: `{}` (all capabilities inherit `default_provider`)

#### `execution_preferences` jsonb schema
```json
{
  "mode": "balanced",
  "prefer_streaming": false,
  "max_latency_ms": null,
  "quality_threshold": null
}
```
Default: `{}` (application applies `DEFAULT_EXECUTION_PREFERENCE` when empty)

#### `budget_policy` jsonb schema
```json
{
  "monthly_limit_usd": 50.00,
  "warning_threshold": 0.8,
  "emergency_stop_usd": null,
  "budget_strategy": "balanced",
  "auto_pause_on_limit": false,
  "alert_on_warning": true,
  "reset_day": 1
}
```
Default: `{}` (application applies `DEFAULT_BUDGET_POLICY` when empty)

#### `health_policy` jsonb schema
```json
{
  "check_interval_minutes": 60,
  "alert_on_degraded": true,
  "alert_on_unreachable": true,
  "latency_warning_ms": 3000,
  "latency_error_ms": 10000
}
```
Default: `{}` (application applies system defaults when empty)

### §3.7 — Relationship to dealer_settings.ai_settings

| Data | Storage | Migration Path |
|------|---------|---------------|
| Encrypted API keys (`*_key`) | `dealer_settings.ai_settings` | Keep in Sprint 11Q; migrate to dedicated vault in Sprint 11R+ |
| `primary_provider` | `dealer_settings.ai_settings` → `dealer_ai_settings.default_provider` | Sprint 11Q: dual-write; Sprint 11R: read from `dealer_ai_settings` |
| `enabled` | `dealer_settings.ai_settings` | Keep (controls AI Gateway, not platform config) |
| `monthly_limit_usd`, `hard_limit` | `dealer_settings.ai_settings` → `dealer_ai_settings.budget_policy` | Sprint 11Q: dual-write; Sprint 11R: read from `dealer_ai_settings` |
| Capability assignments | Not yet stored → `dealer_ai_settings.capability_preferences` | New in Sprint 11Q |
| Budget strategy, emergency stop | Not yet stored → `dealer_ai_settings.budget_policy` | New in Sprint 11Q |
| Execution preferences | Not yet stored → `dealer_ai_settings.execution_preferences` | New in Sprint 11Q |

---

## §4 — dealer_ai_usage_log Proposal (Phase C)

### §4.1 — Rationale

`dealer_ai_usage_log` provides the append-only record of every AI execution attempt. It enables:
- Real `current_month_usd` calculation (currently hardcoded to 0)
- Budget policy enforcement via `consultAISettingsForExecution()`
- Per-provider and per-capability cost analytics
- Audit trail for dealer-owned AI billing disputes
- Rate limiting and abuse detection

### §4.2 — Proposed schema

```sql
-- DO NOT APPLY — CTO approval required before executing this migration.
-- Proposed migration number: 073_dealer_ai_usage_log.sql

CREATE TABLE dealer_ai_usage_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (always from getCurrentDealer() — never from client)
  dealer_id           uuid        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Execution reference (references future dealer_ai_executions table — Sprint 11T+)
  execution_id        uuid,

  -- Provider and capability
  provider            text        NOT NULL
    CHECK (provider IN ('openai', 'anthropic', 'gemini', 'azure_openai', 'openrouter')),
  capability          text        NOT NULL,
  task_type           text,
  model               text        NOT NULL,

  -- Token usage
  prompt_tokens       integer     NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens   integer     NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens        integer     NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),

  -- Cost tracking
  -- estimated_cost_usd: computed before the call from token estimate and model pricing
  -- actual_cost_usd: reported by provider after the call (may differ from estimate)
  estimated_cost_usd  numeric(10,6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  actual_cost_usd     numeric(10,6)              CHECK (actual_cost_usd >= 0),

  -- Execution timing
  execution_time_ms   integer     CHECK (execution_time_ms >= 0),

  -- Execution status
  execution_status    text        NOT NULL
    CHECK (execution_status IN ('success', 'error', 'timeout', 'blocked_budget', 'blocked_guard')),
  error_category      text,
  error_message_safe  text,       -- English, sanitized — no raw API error data

  -- Immutable creation timestamp (no updated_at — this log is append-only)
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### §4.3 — Indexes

```sql
-- Primary: load current month spend for a dealer (used in budget evaluation)
CREATE INDEX idx_dealer_ai_usage_log_dealer_month
  ON dealer_ai_usage_log (dealer_id, created_at DESC);

-- Provider breakdown for analytics
CREATE INDEX idx_dealer_ai_usage_log_provider
  ON dealer_ai_usage_log (dealer_id, provider);

-- Capability breakdown for analytics
CREATE INDEX idx_dealer_ai_usage_log_capability
  ON dealer_ai_usage_log (dealer_id, capability);

-- Status for error monitoring
CREATE INDEX idx_dealer_ai_usage_log_status
  ON dealer_ai_usage_log (dealer_id, execution_status)
  WHERE execution_status != 'success';
```

### §4.4 — RLS strategy

```sql
ALTER TABLE dealer_ai_usage_log ENABLE ROW LEVEL SECURITY;

-- SELECT: dealer members can read their own usage log
CREATE POLICY "dealer_ai_usage_log_member_select"
  ON dealer_ai_usage_log FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: service_role only (via server action after getCurrentDealer())
-- No dealer-side INSERT policy — usage log entries are created by the server,
-- not by the dealer UI directly.

-- NO UPDATE policy — immutable log
-- NO DELETE policy — immutable log
-- service_role can DELETE for GDPR data erasure compliance.
```

### §4.5 — Monthly spend query

The server action that loads `current_month_usd` for `consultAISettingsForExecution()` uses:
```sql
-- NOTE: Run with service_role and dealer_id from getCurrentDealer()
SELECT COALESCE(SUM(actual_cost_usd), SUM(estimated_cost_usd), 0)
FROM dealer_ai_usage_log
WHERE dealer_id = $1
  AND execution_status = 'success'
  AND created_at >= DATE_TRUNC('month', NOW())
  AND created_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
```
When `actual_cost_usd` is null (pre-response estimate), uses `estimated_cost_usd` as the budget basis.

### §4.6 — Append-only constraint

`dealer_ai_usage_log` is an append-only table:
- No `updated_at` column
- No UPDATE policy
- No DELETE policy (service_role exception for GDPR erasure only)
- Future: Supabase `pg_audit` extension for immutability enforcement

---

## §5 — Integration Review (Phase D)

### §5.1 — Dependency diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Dealer Session                                       │
│    auth.users ──→ dealer_members ──→ dealers (plan: pro_plus required)      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                  │ getCurrentDealer() → dealer_id
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI Gateway Layer                                     │
│    dealer_settings.ai_settings (jsonb)                                      │
│      ├── encrypted API keys (AES-256-GCM)                                   │
│      ├── primary_provider                                                    │
│      ├── enabled / hard_limit / monthly_limit_usd                           │
│      └── azure_openai_endpoint                                              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                  │ getAiSettings()
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AI Settings Platform (proposed)                         │
│    dealer_ai_settings                                                       │
│      ├── default_provider / fallback_providers                              │
│      ├── capability_preferences (AICapabilityAssignmentMap)                 │
│      ├── execution_preferences (AIExecutionPreference)                      │
│      ├── budget_policy (AIBudgetPolicyConfig)                               │
│      └── health_policy                                                      │
└────────┬───────────────────────────────────────────────┬────────────────────┘
         │ consultAISettingsForExecution()               │ buildSettingsPlatformView()
         ▼                                               ▼
┌────────────────────┐                      ┌──────────────────────┐
│  AI Orchestrator   │                      │  AI Settings UI      │
│  Execution Guard   │                      │  (Sprint 11Q+)       │
│  (13-check guard)  │                      └──────────────────────┘
└────────┬───────────┘
         │ on execution success/failure
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Usage Tracking (proposed)                             │
│    dealer_ai_usage_log                                                      │
│      ├── provider / capability / model                                      │
│      ├── prompt_tokens / completion_tokens / total_tokens                   │
│      ├── estimated_cost_usd / actual_cost_usd                               │
│      └── execution_status                                                   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                  │ monthly spend aggregate
                                  ▼
                         evaluateBudgetPolicy()
                         (real current_month_usd replaces hardcoded 0)
```

### §5.2 — Integration with AI Gateway

- `dealer_settings.ai_settings` remains the canonical encrypted key storage
- `dealer_ai_settings` adds the platform configuration layer **on top of** the gateway
- No data is moved until Sprint 11R+ migration
- Sprint 11Q server actions will:
  1. Read encrypted keys from `dealer_settings.ai_settings` (existing path)
  2. Read platform config from `dealer_ai_settings` (new path)
  3. Merge into `AISettingsProfile` returned to the orchestrator

### §5.3 — Integration with AI Orchestrator

```
Server Action
  → getCurrentDealer()                         → dealer_id
  → getAiSettings()                            → AiSettingsView (keys, enabled)
  → getAiSettingsProfile(dealer_id)            → AISettingsProfile (Sprint 11Q)
  → consultAISettingsForExecution(...)         → AISettingsConsultResult
  → checkProviderExecutionReadiness(...)       → AIProviderExecutionGuardResult
  → agent.execute()                            → Sprint 11P+
  → insertUsageLog(dealer_id, ...)             → dealer_ai_usage_log
```

### §5.4 — Integration with feature flags

`checkFeatureAccess("ai_gateway")` must pass before any read/write to `dealer_ai_settings`. The feature check uses `dealers.plan === 'pro_plus'` (loaded by `can-use-feature.ts`). This gate is enforced at the server action layer, not at the DB layer.

### §5.5 — Integration with dealer billing

`dealer_billing.contract_status` is NOT currently checked by `checkFeatureAccess()`. For AI inference, the budget guard (`evaluateBudgetPolicy`) enforces the dealer's self-configured limits. A suspended contract should block AI features — this is an open gap to address in Sprint 11Q.

---

## §6 — Security Review (Phase E)

### §6.1 — Encrypted API key handling

| Property | Implementation |
|----------|---------------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key source | `DEALER_AI_KEY_SECRET` env var (64 hex chars = 32 bytes) |
| Format | `v1:{iv_hex}:{auth_tag_hex}:{ciphertext_hex}` |
| Storage | `dealer_settings.ai_settings` JSONB |
| Read path | Server action only — `decryptApiKey()` in `src/lib/ai/crypto.ts` |
| Client exposure | Never — `getAiSettings()` returns `has_key: boolean` only |
| Future path | Migrate to Supabase Vault or external secrets manager (Sprint 11R+) |

**Known gap**: API keys are encrypted at application level but not at Postgres level. The `dealer_settings.ai_settings` column is accessible to any postgres user with the `service_role`. This is accepted for development. Production hardening requires Supabase Vault migration.

### §6.2 — Provider ownership model

All AI inference costs are billed directly to the dealer's own API key. Office AZ does not pay for or intermediate any AI inference costs. This is enforced by:
1. `dealer_billing_acknowledged` check (#11 in execution guard)
2. `key_source: "dealer_ai_settings"` literal type in `AIProviderConfig`
3. No proxy endpoint — all provider calls use the dealer's own key

### §6.3 — Dealer isolation

| Layer | Isolation Mechanism |
|-------|-------------------|
| Application | `dealer_id` always from `getCurrentDealer()` — never from client input or URL |
| Database | RLS on all dealer tables using `dealer_members` lookup pattern |
| AI Settings | `dealer_id` injected into `AISettingsProfile` from `getCurrentDealer()` |
| Usage log | RLS + `dealer_id` column; no cross-dealer aggregation queries |

### §6.4 — RLS strategy for new tables

Both proposed tables follow the existing RLS pattern:
```sql
dealer_id IN (
  SELECT dealer_id FROM dealer_members
  WHERE user_id = auth.uid() AND status = 'active'
)
```

`dealer_ai_usage_log` has no INSERT policy for authenticated users — only `service_role` can insert. This prevents dealers from inserting fake usage records to manipulate billing displays.

### §6.5 — Audit requirements

Proposed audit log entries for AI Settings operations (require `audit_logs.action` CHECK extension in Sprint 11Q):

| Operation | action | resource_type |
|-----------|--------|---------------|
| Save default_provider | `'update'` | `'dealer_setting'` |
| Save capability_preferences | `'update'` | `'dealer_setting'` |
| Save budget_policy | `'update'` | `'dealer_setting'` |
| Add/update API key | `'update'` | `'dealer_setting'` |
| AI execution success | (usage_log row) | n/a — usage_log is the record |
| AI execution blocked | (usage_log row with status='blocked_guard') | n/a |

`old_value` / `new_value` fields in `audit_logs` must NEVER contain raw or encrypted API keys.

### §6.6 — Budget enforcement architecture

```
consultAISettingsForExecution()
  → evaluateBudgetPolicy(policy, current_month_usd, estimated_cost_usd)
  → if blocked_budget: return blocked, log to dealer_ai_usage_log (status='blocked_budget')
  → else: proceed to execution guard

After execution:
  → insertUsageLog(dealer_id, provider, capability, tokens, cost, 'success')
  → budget policy evaluated at query time for next execution
```

Monthly spend is computed by aggregating `dealer_ai_usage_log` for the current month window. No caching of totals — always fresh aggregate to prevent budget overrun.

---

## §7 — Migration Plan (Phase F)

### §7.1 — Migration sequence

All migrations require CTO approval before execution. Do not apply automatically.

| Order | File (proposed) | Depends On | Status |
|-------|-----------------|-----------|--------|
| 1 | `072_dealer_ai_settings.sql` | 070 (dealer_settings canonical) | **Proposed — not written** |
| 2 | `073_dealer_ai_usage_log.sql` | 072 (dealer_ai_settings) | **Proposed — not written** |
| 3 | `074_audit_logs_ai_actions.sql` | 055 (audit_logs) | **Proposed — not written** |
| 4 | `075_dealer_ai_settings_migrate_gateway.sql` | 072 + 070 | **Proposed — Sprint 11R+** |

**Migration 072 creates** `dealer_ai_settings`. Safe to apply at any time after 070. Does NOT modify `dealer_settings.ai_settings`.

**Migration 073 creates** `dealer_ai_usage_log`. Safe to apply after 072. All usage tracking requires `dealer_id` from `dealer_ai_settings` to exist first.

**Migration 074 extends** `audit_logs.action` CHECK constraint to include AI-specific action values.

**Migration 075 migrates** data from `dealer_settings.ai_settings` (`primary_provider`, `monthly_limit_usd`, `hard_limit`) into `dealer_ai_settings`. This is a data migration — requires careful dual-write period. Deferred to Sprint 11R+.

### §7.2 — Rollback strategy

**Migration 072 rollback**: `DROP TABLE dealer_ai_settings;` — safe, no data dependencies if applied before 073.

**Migration 073 rollback**: `DROP TABLE dealer_ai_usage_log;` — loses usage history. Rollback window: before any execution logs are written.

**Migration 074 rollback**: Re-apply original CHECK constraint. Safe at any time.

**Migration 075 rollback**: Keep reading from `dealer_settings.ai_settings`. No permanent data loss since 075 COPIES data, not moves it.

### §7.3 — Backward compatibility

**During Sprint 11Q** (after 072 applied, before 075):
- `getAiSettings()` continues reading from `dealer_settings.ai_settings` — no change
- New `getAiSettingsProfile()` reads from `dealer_ai_settings` for platform config
- `saveAiSettings()` continues writing to `dealer_settings.ai_settings` for keys
- New `saveAiSettingsProfile()` writes to `dealer_ai_settings` for platform config
- Both can be active simultaneously — no dual-write required at this stage

**During Sprint 11R** (after 075 applied):
- Dual-write period: new saves go to both `dealer_settings.ai_settings` and `dealer_ai_settings`
- Read from `dealer_ai_settings` first; fall back to `dealer_settings.ai_settings`
- This ensures zero downtime migration

### §7.4 — Deployment sequence

1. **Pre-deploy**: CTO reviews and approves migrations 072 and 073
2. **Deploy 072**: `dealer_ai_settings` table created (empty)
3. **Deploy 073**: `dealer_ai_usage_log` table created (empty)
4. **Deploy 074**: `audit_logs` action check extended
5. **Deploy Sprint 11Q application code**: new server actions reading from `dealer_ai_settings`
6. **Smoke test**: verify new settings save and load correctly
7. **Sprint 11R+**: plan migration 075 data migration after usage data accumulates

### §7.5 — Gap: `dealer_settings.ai_settings` column does not exist yet

**Critical finding**: The `ai_settings` column referenced throughout the codebase is defined in migration 070, which is marked `DO NOT AUTO-APPLY`. The column may not exist in the current Supabase instance. The existing server actions handle this gracefully with `migration_required: true` fallback. This must be resolved by CTO migration approval before Sprint 11Q server actions can persist AI platform config.

---

## §8 — TypeScript Type Alignment

The proposed `dealer_ai_settings` table schema directly corresponds to `AISettingsProfile` (Sprint 11O):

| Table column | TypeScript field |
|-------------|-----------------|
| `dealer_id` | `AISettingsProfile.dealer_id` |
| `default_provider` | `AISettingsProfile.provider_selection.primary_provider` |
| `fallback_providers` | `AISettingsProfile.provider_selection.fallback_providers` |
| `capability_preferences` | `AISettingsProfile.capability_assignments` |
| `execution_preferences` | `AISettingsProfile.execution_preference` |
| `budget_policy` | `AISettingsProfile.budget_policy` |
| `health_policy` | (new — maps to dealer-configured health check preferences) |
| `settings_version` | `AISettingsProfile.profile_version` (numeric form) |

Note: `AISettingsProfile.provider_configurations` (per-provider model overrides, rate limits) has no corresponding column yet. These will be added to `capability_preferences` jsonb or a future `dealer_ai_provider_configs` table (Sprint 11S+).

Note: `AISettingsProfile.provider_health` is runtime state, not configuration — it is NOT stored in `dealer_ai_settings`. Health check results are computed at runtime and held in memory only until Sprint 11T+ when a `dealer_ai_health_log` table is proposed.

---

## §9 — Sprint Roadmap

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| Sprint 11J | AI Orchestration Engine Foundation | Complete |
| Sprint 11K | AI Orchestrator Runtime Dry-Run | Complete |
| Sprint 11L | AI Orchestrator Live Runtime Bridge | Complete |
| Sprint 11M | AI Provider Execution Readiness | Complete |
| Sprint 11N | AI Provider Adapter Registry Foundation | Complete |
| Sprint 11O | AI Settings Platform Foundation | Complete |
| **Sprint 11P** | **AI Settings Database Architecture Review (this document)** | **Complete** |
| Sprint 11Q | AI Settings Persistence (CTO: apply migrations 072–074 first) | Planned |
| Sprint 11Q | `getAiSettingsProfile()` server action; `saveAiSettingsProfile()` server action | Planned |
| Sprint 11Q | `buildUsagePolicyFromBudgetPolicy()` wired to real `current_month_usd` from DB | Planned |
| Sprint 11R | Migration 075: migrate gateway config to `dealer_ai_settings` (dual-write) | Planned |
| Sprint 11S | AI Settings provider card UI using `buildSettingsPlatformView()` | Planned |
| Sprint 11T | Concrete OpenAI adapter (`adapter_available: true`, `run_execute: true`) | Planned |
