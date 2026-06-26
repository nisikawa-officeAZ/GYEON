# SaaS Enterprise Foundation Specification
## GYEON Detailer Agent — Sprint 11Q

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Architecture Review — Foundation Ready |
| **Sprint** | 11Q |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **CTO Approval Required** | Yes — before any persistence or billing integration |
| **Migrations Applied** | None — this document is review and design only |

---

## §1 — Overview

Sprint 11Q reviews the complete SaaS enterprise architecture across six dimensions: dealer lifecycle, subscription model, feature gate matrix, billing architecture, AI billing, and security. The goal is to confirm architectural alignment before enabling persistence in Sprint 11R.

**Scope of this document:**
- Dealer lifecycle from registration to cancellation
- Subscription tier model (Basic / Pro / Pro+ / Enterprise)
- Complete feature gate matrix with status and plan assignments
- Billing architecture review and Stripe readiness assessment
- Dealer-owned AI billing model
- Security, RLS, and permission model

**Key finding**: The current architecture is production-ready for Basic/Pro/Pro+ tiers. The critical gap before enabling AI persistence is the `dealer_billing.contract_status` disconnection from `checkFeatureAccess()` — billing suspension does not currently revoke AI access.

---

## §2 — Dealer Lifecycle Review (Phase A)

### §2.1 — Lifecycle stages

```
REGISTRATION ─→ PENDING ─→ APPROVED ─→ ONBOARDING ─→ ACTIVE
                    │                                     │
                    ↓                                     ↓
                REJECTED                           SUBSCRIPTION
                                                         │
                                               ┌─────────┼───────────┐
                                               ▼         ▼           ▼
                                           AI_ACTIVE LINE_ACTIVE BILLING
                                               │
                                       ┌───────┼───────┐
                                       ▼       ▼       ▼
                                  SUSPENDED REACTIVATED CANCELLED
```

### §2.2 — Stage definitions

| Stage | Description | DB State |
|-------|-------------|----------|
| **REGISTRATION** | User creates auth account. No dealer row yet. | `auth.users` only |
| **PENDING** | Dealer row created. Awaiting admin review. | `dealers.approval_status = 'pending'` |
| **APPROVED** | Admin approves the application. | `dealers.approval_status = 'approved'` |
| **REJECTED** | Admin rejects. Dealer cannot proceed. | `dealers.approval_status = 'rejected'` |
| **ONBOARDING** | First login after approval. Wizard steps 1–7. | `dealer_settings.onboarding_completed = false` |
| **ACTIVE** | Onboarding complete. Normal operation. | `dealers.status = 'active'`, `onboarding_completed = true` |
| **SUBSCRIPTION** | Plan assigned. Feature access determined by plan. | `dealers.plan`, `dealer_subscriptions` |
| **AI_ACTIVE** | Pro+ plan. `ai_settings` column present. AI gateway configured. | `dealer_settings.ai_settings` non-null |
| **LINE_ACTIVE** | Pro+ plan. LINE credentials configured. | `dealer_settings.line_channel_id` non-null |
| **BILLING** | Annual/monthly contract active. | `dealer_billing.contract_status = 'active'` |
| **SUSPENDED** | Billing lapse or admin action. | `dealer_billing.contract_status = 'suspended'` |
| **REACTIVATED** | Billing resumed after suspension. | `dealer_billing.contract_status = 'active'` |
| **CANCELLED** | Dealer terminates contract. | `dealers.status = 'archived'`, `dealer_billing.contract_status = 'cancelled'` |

### §2.3 — Lifecycle transitions

| From | To | Trigger | Actor |
|------|----|---------|-------|
| REGISTRATION | PENDING | Dealer submits application | Dealer |
| PENDING | APPROVED | Admin approves | Admin |
| PENDING | REJECTED | Admin rejects | Admin |
| APPROVED | ONBOARDING | Dealer first login | Dealer |
| ONBOARDING | ACTIVE | Dealer completes wizard step 7 | Dealer |
| ACTIVE | SUBSCRIPTION | Plan assigned/changed | Admin |
| SUBSCRIPTION | AI_ACTIVE | Dealer configures AI Gateway | Dealer (Pro+) |
| SUBSCRIPTION | LINE_ACTIVE | Dealer configures LINE | Dealer (Pro+) |
| ACTIVE | SUSPENDED | Billing lapse (manual; future: Stripe webhook) | Admin / Stripe |
| SUSPENDED | REACTIVATED | Payment received | Admin / Stripe |
| ACTIVE | CANCELLED | Dealer or Admin terminates | Dealer / Admin |

### §2.4 — Gaps identified

**Gap 1**: `dealers.status` and `dealer_billing.contract_status` are independent columns. A suspended `dealer_billing` does not automatically set `dealers.status = 'suspended'`. `checkFeatureAccess()` reads `dealers.plan` but not `dealer_billing.contract_status`.

**Resolution for Sprint 11R**: `checkFeatureAccess()` must query both `dealers.plan` and `dealer_billing.contract_status`. If `contract_status = 'suspended'`, downgrade effective feature access to `basic` regardless of plan.

**Gap 2**: `dealers.approval_status` is not checked by `checkFeatureAccess()`. An approved dealer with `plan: 'pro_plus'` whose application is later set to `approval_status: 'rejected'` (e.g. fraud detection) retains full feature access until `dealers.status` is also changed.

**Resolution for Sprint 11R**: Add `approval_status = 'approved'` check to `checkFeatureAccess()` or to `getCurrentDealer()`.

---

## §3 — Subscription Architecture (Phase B)

### §3.1 — Current plan tiers

| Plan | Code | Annual Price (JPY) | Monthly Price |
|------|------|--------------------|---------------|
| Basic | `basic` | ¥0 | ¥0 |
| Pro | `pro` | ¥12,000 | ¥0 (annual only) |
| Pro Plus | `pro_plus` | ¥0 (TBD) | ¥0 (TBD) |

**Note**: Pro Plus pricing is not yet set (pending CTO/business decision — OD pending).

### §3.2 — Proposed Enterprise tier

Not yet implemented. Enterprise is the 4th tier above Pro Plus.

| Plan | Code (proposed) | Target | AI Allotment |
|------|----------------|--------|-------------|
| Enterprise | `enterprise` | Multi-location dealers, franchise groups | Dedicated AI budget + usage reporting |

**Enterprise differentiators (proposed):**
- Multi-location support (multiple `dealer_id` under one enterprise account)
- Dedicated AI allotment (prepaid usage, not dealer-owned keys only)
- SLA-backed uptime
- Priority support
- Custom AI model routing
- Annual enterprise contract with Service Order
- SSO / SCIM provisioning (future)

**TypeScript**: `enterprise` is declared in `ExtendedPlanCode` in `saas-foundation-types.ts` (Sprint 11Q addition). The existing `DealerPlan` type (`basic | pro | pro_plus`) is NOT extended — backward compatibility preserved. `enterprise` is handled as an extension type.

### §3.3 — Subscription resolution order

When `getCurrentDealerSubscription()` runs:
1. Query `dealer_subscriptions` table (PHASE58 — may not exist yet)
2. Fall back to `dealers.plan` + `dealers.subscription_status` (legacy columns)
3. Fall back to `basic/active` defaults for new dealers

This dual-read pattern ensures zero breaking changes when `dealer_subscriptions` does not exist.

### §3.4 — Subscription status mapping

| `dealer_subscriptions.status` | `dealers.subscription_status` (legacy) | Effective access |
|------------------------------|----------------------------------------|-----------------|
| `trial` | `trial` | Plan features, time-limited |
| `active` | `active` | Full plan features |
| `past_due` | — (new value) | Warning, still active |
| `suspended` | `expired` | Basic features only |
| `cancelled` | `cancelled` | Basic features only |

### §3.5 — Feature ownership model

Each feature has one owner:
- **Office AZ** — defines which features exist, their plan tier, and their status
- **Dealer** — configures features within their plan (AI keys, LINE setup, etc.)
- **Dealer's AI provider** — bills the dealer directly for AI inference costs

Office AZ does NOT pay for dealer AI inference. Dealers pay their AI provider directly using their own API keys. This ownership model is a non-negotiable architectural constraint.

---

## §4 — Feature Gate Matrix (Phase C)

### §4.1 — Complete feature matrix

| Feature Key | Plan | Status | Category | Notes |
|------------|------|--------|----------|-------|
| `customers` | basic | active | core | Always available |
| `vehicles` | basic | active | core | Always available |
| `estimates` | basic | active | core | Always available |
| `estimate_pdf` | basic | active | core | Always available |
| `products` | basic | active | core | Always available |
| `product_orders` | basic | active | core | Always available |
| `work_orders` | pro | active | core | |
| `calendar` | pro | active | core | |
| `reservations` | pro | active | core | |
| `completion_reports` | pro | active | core | |
| `invoices` | pro | active | core | |
| `payments` | pro | active | core | |
| `maintenance` | pro | active | core | |
| `line` | pro_plus | active | line | LINE credentials required |
| `line_crm` | pro_plus | active | line | |
| `line_rich_menu` | pro_plus | active | line | |
| `message_logs` | pro_plus | active | line | |
| `notification_queue` | pro_plus | active | line | |
| `auto_notifications` | pro_plus | active | line | |
| `ai_gateway` | pro_plus | **in PLAN_FEATURES** | ai_platform | UI not yet built |
| `ai_marketing` | pro_plus | **in PLAN_FEATURES** | ai_platform | UI not yet built |
| `ai_reputation` | pro_plus | **in PLAN_FEATURES** | ai_platform | UI not yet built |
| `ai_growth` | pro_plus | **in PLAN_FEATURES** | ai_platform | UI not yet built |
| `ai_video_generation` | pro_plus | **planned (not in PLAN_FEATURES)** | ai_platform | Not yet gatable |
| `ai_review_assistant` | pro_plus | **planned (not in PLAN_FEATURES)** | ai_platform | Not yet gatable |
| `ai_social_scheduler` | pro_plus | **planned (not in PLAN_FEATURES)** | ai_platform | Not yet gatable |
| `ai_marketing_analytics` | pro_plus | **planned (not in PLAN_FEATURES)** | ai_platform | Not yet gatable |

### §4.2 — Gate evaluation flow

```
checkFeatureAccess(feature)
  → getCurrentDealerSubscription()
       → dealer_subscriptions table (if exists)
       → fallback: dealers.plan
  → canUseFeature(plan, feature)
       → PLAN_FEATURES[plan].includes(feature)
  → returns boolean
```

**Current gate does NOT check**:
- `dealer_billing.contract_status` — billing suspension is ignored
- `dealers.approval_status` — approval rejection is ignored
- `dealers.status` — archival is ignored
- AI feature sub-checks (e.g. `ai_settings` column exists, key stored, provider configured)

### §4.3 — AI feature gate evaluation (proposed for Sprint 11R)

AI features require additional sub-checks beyond plan membership:

```
checkFeatureAccess("ai_gateway")
  → plan check (pro_plus required)
  → dealer_billing.contract_status check (must be 'active' or 'trial')
  → dealers.approval_status check (must be 'approved')
  → returns boolean

checkAiGatewayReadiness(dealer_id)   ← additional AI-specific check
  → ai_settings column exists (migration_required flag)
  → primary_provider configured
  → encrypted key stored
  → returns AIGatewayReadiness
```

These are two distinct checks — plan membership (synchronous, plan-types) and gateway readiness (asynchronous, DB check). They are separate to avoid blocking non-AI features with AI-specific DB queries.

### §4.4 — Feature gate gaps

**Gap 1: `ai_video_generation`, `ai_review_assistant`, `ai_social_scheduler`, `ai_marketing_analytics` are not in `PLAN_FEATURES.pro_plus`**

These 4 features appear in `AppFeature` and `FEATURE_REGISTRY` but are absent from `PLAN_FEATURES.pro_plus`. This means `canUseFeature('pro_plus', 'ai_video_generation')` returns `false` even for Pro+ dealers. This is intentional (UI not built) but requires tracking.

**Resolution for Sprint 11R**: Add these 4 features to `PLAN_FEATURES.pro_plus` when their UI is ready, or maintain the intentional exclusion with a clear code comment.

**Gap 2: `FeatureKey` in `subscription-types.ts` does not include AI features**

`FEATURE_KEY_MAP` in `feature-gates.ts` does not include any `ai_*` entries. `canUseFeatureGate("ai_gateway")` would throw a TypeScript error because `"ai_gateway"` is not a valid `FeatureKey`.

**Resolution for Sprint 11R**: Extend `FeatureKey` and `FEATURE_KEY_MAP` to include all AI features. This is a pure TypeScript change (no migration).

---

## §5 — Billing Architecture (Phase D)

### §5.1 — Current billing model

The current billing model is **manual-only**:
- `dealer_billing` table: one row per dealer, tracks `plan_code` and `contract_status`
- `billing_invoices` table: manual invoice records (no auto-generation)
- No payment processor integration
- No auto-charge or dunning management
- All billing operations: Admin-only (`service_role` or `admin_users` check)

### §5.2 — Billing models to support (future)

| Model | Description | Integration Required |
|-------|-------------|---------------------|
| **Manual billing** | Admin creates invoices; dealer pays via bank transfer | Current (no integration) |
| **Annual subscription** | One annual payment; access for 12 months | Stripe one-time or Stripe Subscriptions |
| **Monthly subscription** | Recurring monthly; auto-renew | Stripe Subscriptions |
| **Enterprise contract** | Custom pricing; Service Order; net-30 payment | Manual + contract management |
| **Trial** | Time-limited access to Pro+ features | Timer-based; `trial_ends_at` field |

### §5.3 — Stripe integration readiness

The database schema is Stripe-ready. Required additions before Stripe goes live:

| Addition | Proposed location | Sprint |
|----------|-----------------|--------|
| `stripe_customer_id` column | `dealers` table | 11S+ |
| `stripe_subscription_id` column | `dealer_subscriptions` table | 11S+ |
| `stripe_payment_method_id` column | `dealer_billing` table | 11S+ |
| Stripe webhook handler | `app/api/webhooks/stripe/route.ts` | 11S+ |
| Idempotency key storage | `dealer_billing` (jsonb extension) | 11S+ |

**Migration for Stripe**: No migration exists yet. The `dealer_billing` JSONB extension pattern (used elsewhere) can accommodate Stripe metadata without a new migration.

### §5.4 — Enterprise contract model

Enterprise contracts differ from subscription billing:

```
Enterprise Contract
  ├── Service Order (signed PDF — outside DB)
  ├── dealer_billing row
  │     ├── plan_code: 'enterprise' (proposed)
  │     ├── contract_status: 'active'
  │     └── notes: "Contract #ENT-2026-001; net-30"
  ├── billing_invoices rows (manual, per milestone/month)
  └── dealer_ai_settings row
        └── budget_policy.budget_strategy: 'balanced'
```

Enterprise dealers may have a prepaid AI allotment (purchased tokens/credits) rather than dealer-owned API keys. This requires a future `dealer_ai_allotment` table — not in scope until Sprint 11U+.

### §5.5 — Annual vs. monthly billing

| Field | Annual | Monthly |
|-------|--------|---------|
| `dealer_billing.plan_code` | `'pro'` or `'pro_plus'` | Same |
| `dealer_subscriptions.trial_ends_at` | null | null (no trial for paid) |
| `dealer_subscriptions.current_period_ends_at` | now + 12 months | now + 1 month |
| Auto-renewal | Via Stripe (future) | Via Stripe (future) |
| Pro discount | Standard annual rate | Higher monthly rate |

---

## §6 — AI Billing (Phase E)

### §6.1 — Ownership model

```
Office AZ                    Dealer                     AI Provider
    │                           │                            │
    │  SaaS subscription        │  Own API key               │
    │ ──────────────────────▶   │ ──────────────────────▶    │
    │  (JPY, to Office AZ)      │  (USD, to provider)        │
    │                           │                            │
    │  DOES NOT intermediate    │  Direct billing            │
    │  AI inference costs       │  relationship              │
```

Office AZ's billing relationship with the dealer covers only the SaaS subscription fee (GYEON Detailer Agent platform access). AI inference costs are a direct relationship between the dealer and their AI provider.

### §6.2 — Supported AI providers for dealer keys

| Provider | Key Format | Required Env Var | Encryption |
|----------|-----------|-----------------|-----------|
| OpenAI | `sk-proj-...` or `sk-...` | `DEALER_AI_KEY_SECRET` | AES-256-GCM |
| Anthropic Claude | `sk-ant-...` | `DEALER_AI_KEY_SECRET` | AES-256-GCM |
| Google Gemini | `AIza...` | `DEALER_AI_KEY_SECRET` | AES-256-GCM |
| Azure OpenAI | Custom endpoint + key | `DEALER_AI_KEY_SECRET` | AES-256-GCM |
| OpenRouter | `sk-or-v1-...` | `DEALER_AI_KEY_SECRET` | AES-256-GCM |

All keys encrypted with the same `DEALER_AI_KEY_SECRET`. Format: `v1:{iv_hex}:{tag_hex}:{ciphertext_hex}`. Keys never logged, never returned to client, never included in audit logs.

### §6.3 — Monthly budget enforcement

Budget enforcement is a 3-layer system:

**Layer 1 — AI Settings Policy** (Sprint 11O):
```
consultAISettingsForExecution()
  → evaluateBudgetPolicy(policy, current_month_usd, estimated_cost_usd)
  → blocked_budget if emergency_stop or monthly_limit exceeded with auto_pause
```

**Layer 2 — Execution Guard** (Sprint 11M):
```
checkProviderExecutionReadiness()
  → Check #9: usage_policy_allows (hard_limit + limit_reached)
  → Check #10: monthly_limit_not_exceeded (projected spend vs. limit)
```

**Layer 3 — Post-execution log** (Sprint 11R+):
```
insertUsageLog(dealer_id, ...)
  → dealer_ai_usage_log row
  → next execution's current_month_usd reads from this table
```

Currently, `current_month_usd` is hardcoded to 0 in all paths because `dealer_ai_usage_log` does not exist. Budget enforcement is structural (the code is correct) but not yet effective (no real spend data).

### §6.4 — Cost reporting model

| Report type | Data source | Sprint |
|-------------|------------|--------|
| Monthly spend by provider | `dealer_ai_usage_log GROUP BY provider` | 11R+ |
| Monthly spend by capability | `dealer_ai_usage_log GROUP BY capability` | 11R+ |
| Per-execution cost breakdown | Single `dealer_ai_usage_log` row | 11R+ |
| Budget utilization % | `SUM(estimated_cost_usd) / monthly_limit_usd` | 11R+ |
| Cost forecast | Rolling 7-day average × 30 | 11S+ |

All cost values are in USD (`numeric(10,6)`). Display conversion to JPY is application-layer only — the DB always stores USD.

### §6.5 — AI billing gaps

**Gap 1**: `current_month_usd = 0` hardcoded — no real budget enforcement until `dealer_ai_usage_log` migration is applied.

**Gap 2**: No `actual_cost_usd` feedback loop — providers don't always report exact cost. OpenAI reports token counts via response headers; actual cost requires multiplication by model price table (application-layer).

**Gap 3**: Model pricing table does not exist in the codebase. Token counts are tracked but USD cost calculation requires a `MODEL_PRICING` constant (not yet created).

**Gap 4**: No dealer-facing cost dashboard UI. The `AIBudgetCard` view model exists (Sprint 11O) but no settings page renders it.

---

## §7 — Security Review (Phase F)

### §7.1 — Dealer isolation

| Layer | Mechanism | Enforced By |
|-------|-----------|------------|
| Application | `getCurrentDealer()` returns `{dealer_id, role}` from `dealer_members` | Every server action |
| Database | RLS policies on all tables | PostgreSQL |
| Type system | `dealer_id: string` always injected — no client param | TypeScript |
| AI Settings | `AISettingsProfile.dealer_id` from `getCurrentDealer()` | Sprint 11O contract |

`dealer_id` MUST NEVER come from:
- Client form input
- URL parameters
- Cookie (except via Supabase session → `auth.uid()` → `dealer_members` lookup)
- Local state

### §7.2 — RLS policy patterns

| Table | Policy Type | Mechanism |
|-------|------------|-----------|
| All business tables | `dealer_members` lookup | `dealer_id IN (SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active')` |
| `dealers` | Owner/member read | `id IN (SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid())` |
| `dealer_billing` | Old pattern (gap) | `dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())` — **uses deprecated `dealers.user_id` pattern** |
| `billing_invoices` | Old pattern (gap) | Same as `dealer_billing` |
| `admin_users` | Self-read | `user_id = auth.uid()` |
| `admin_audit_logs` | Admin-read | via `admin_users` |
| `audit_logs` | `dealer_members` lookup | Standard pattern |

**Security gap**: `dealer_billing` and `billing_invoices` use `dealers.user_id` which does not exist in the `dealers` table (migration 003 has no `user_id` column). These RLS policies may silently return no rows or error. This should be fixed to use the `dealer_members` lookup pattern.

### §7.3 — API key encryption

| Property | Current implementation |
|----------|----------------------|
| Algorithm | AES-256-GCM |
| Key derivation | Direct from `DEALER_AI_KEY_SECRET` env var (32 bytes) |
| IV | Random 12 bytes per encryption (per GCM spec) |
| Auth tag | 16 bytes (included in ciphertext string) |
| Ciphertext format | `v1:{iv_hex}:{tag_hex}:{ciphertext_hex}` |
| Key rotation | Not implemented — no versioned key support yet |
| Supabase Vault | Not used — future migration |

**Known gap**: All providers share the same encryption key (`DEALER_AI_KEY_SECRET`). Key rotation requires re-encrypting all stored keys. Key rotation is out of scope until Sprint 11T+.

### §7.4 — Audit logging

| Action category | Audit log entries | Status |
|----------------|------------------|--------|
| Business operations | 18 action values in CHECK constraint | Active |
| Onboarding | 4 action values (onboarding_*) | Active |
| Feature access denied | `feature_access_denied` | Active |
| AI settings changes | Not yet defined | Requires Sprint 11R + migration 074 |
| AI execution events | Via `dealer_ai_usage_log` (proposed) | Requires Sprint 11R + migration 073 |

### §7.5 — Permission model

| Role | Access level |
|------|-------------|
| `owner` | Full dealer operations + AI settings |
| `manager` | Most operations; AI settings readable (write TBD) |
| `staff` | Operational tasks; no AI settings write |
| `readonly` | Read-only access |
| `super_admin` (admin_users) | Cross-dealer admin; bypasses dealer RLS via service_role |

**Note**: Role-based AI settings write access is NOT currently enforced at the application layer. Any `dealer_members` user with any role can call `saveAiSettings()`. Server actions should check `role IN ('owner', 'manager')` for AI settings writes (Sprint 11R).

---

## §8 — Integration Alignment Summary

### §8.1 — Current state vs. target state

| Component | Current state | Target state (Sprint 11R) |
|-----------|-------------|--------------------------|
| Dealer lifecycle | Stages defined; billing–feature gate disconnected | `contract_status` checked in `checkFeatureAccess()` |
| Plan tiers | 3 tiers (basic/pro/pro_plus) | 4 tiers + Enterprise type |
| Feature gate | `PLAN_FEATURES` lookup; no billing check | + `contract_status` + `approval_status` checks |
| AI features in `FeatureKey` | Not included | All `ai_*` features added |
| Billing | Manual only | Stripe-ready structure; webhook handler pending |
| AI billing | Key storage complete; budget enforcement structural | Real `current_month_usd` from `dealer_ai_usage_log` |
| Cost reporting | No data | Dashboard via `buildBudgetCard()` |
| API key rotation | Not implemented | Versioned key support |
| RLS on billing tables | Uses deprecated `dealers.user_id` pattern | Fixed to `dealer_members` pattern |
| Audit log for AI | No entries | Migration 074 + `dealer_ai_usage_log` |

### §8.2 — Pre-Sprint 11R checklist

Before Sprint 11R (AI Settings Persistence) should proceed:

- [ ] CTO approval: migration 072 (`dealer_ai_settings`)
- [ ] CTO approval: migration 073 (`dealer_ai_usage_log`)
- [ ] CTO approval: migration 074 (audit_logs action extension)
- [ ] Fix `dealer_billing` / `billing_invoices` RLS policies (deprecated `user_id` pattern)
- [ ] Extend `checkFeatureAccess()` to check `contract_status`
- [ ] Extend `FeatureKey` to include `ai_*` features
- [ ] Add `role` check to `saveAiSettings()` server action
- [ ] Confirm `ai_video_generation` / `ai_review_assistant` / `ai_social_scheduler` / `ai_marketing_analytics` intentionally excluded from `PLAN_FEATURES.pro_plus`

---

## §9 — Proposed TypeScript Additions (Sprint 11Q)

Sprint 11Q adds pure TypeScript types at `src/lib/subscription/saas-foundation-types.ts`:
- `DealerLifecycleStage` — 10 lifecycle stages as a TypeScript type
- `ExtendedPlanCode` — 4-tier plan including `enterprise`
- `BillingModel` — current and future billing models
- `AIBillingOwnership` — who pays what
- `SaasFoundationStatus` — platform readiness descriptor
- `FeatureGateEvaluation` — richer gate result for Sprint 11R

These types do not require any migration or persistence. They formalize the architecture documented above.

---

## §10 — Sprint Roadmap

| Sprint | Deliverable | Status |
|--------|-------------|--------|
| Sprint 11J–11N | AI Orchestration + Adapter Registry | Complete |
| Sprint 11O | AI Settings Platform Foundation | Complete |
| Sprint 11P | AI Settings Database Architecture Review | Complete |
| **Sprint 11Q** | **SaaS Enterprise Foundation Review (this document)** | **Complete** |
| Sprint 11R | AI Settings Persistence (CTO: apply migrations 072–074) | Planned |
| Sprint 11R | Fix `dealer_billing` RLS; extend `checkFeatureAccess()` | Planned |
| Sprint 11R | Extend `FeatureKey` + `FEATURE_KEY_MAP` for AI features | Planned |
| Sprint 11S | AI Settings UI (provider cards, capability table, budget panel) | Planned |
| Sprint 11S | Real `current_month_usd` from `dealer_ai_usage_log` | Planned |
| Sprint 11T | Stripe integration foundation (CTO approval) | Planned |
| Sprint 11T | Key rotation support (`DEALER_AI_KEY_SECRET_V2`) | Planned |
| Sprint 11U | Enterprise tier activation (`enterprise` plan code) | Planned |
| Sprint 11U | `dealer_ai_allotment` table (CTO approval) | Planned |
| Sprint 11V | Concrete OpenAI adapter (`adapter_available: true`, `run_execute: true`) | Planned |
