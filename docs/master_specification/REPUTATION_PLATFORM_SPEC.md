# AI Reputation Platform Specification
## Sprint 11C: Reputation as a First-Class Business Domain

| Field | Value |
|-------|-------|
| **Document** | AI Reputation Platform Architecture |
| **Status** | Sprint 11C baseline — architecture complete, no API integrations |
| **Module** | `src/lib/reputation/` |
| **Created** | 2026-06-26 |

> **Design principle:** Reputation is not a bolt-on feature for collecting reviews.
> Reputation is a first-class platform business domain that connects completed jobs,
> customer relationships, LINE communication, AI analysis, and search optimization
> into a unified authenticity-first platform.
>
> Every future review request, signal analysis, and optimization workflow flows through this layer.

---

## 1. Platform Overview

The AI Reputation Platform orchestrates:

- **Review request workflow** — prepare, validate, draft, approve, and dispatch
- **Compliance enforcement** — protect against fake reviews, pressure, and incentives
- **Signal collection** — aggregate reputation data from multiple sources
- **AI analysis** (Phase 11D+) — sentiment, keywords, service quality scoring
- **Search optimization** — MEO, AEO, LLMO, AIO metadata derived from signals
- **Customer Engagement integration** — WORK_COMPLETED triggers review request pipeline

### Platform Architecture

```
WORK_COMPLETED (Customer Engagement event)
  ↓
ReputationEngagementInput (pre-fetched context)
  ↓
prepareWorkCompletedReputationPlan() — dry-run orchestrator
  ├── validateReviewRequestReadiness() — 7 pure checks
  ├── validateLineActionReadiness()    — CE engine async check
  └── validateAgentNotifyReadiness()   — CE engine async check
  ↓
WorkCompletedReputationPlan (overall_readiness)
  ↓ [Dealer approval gate — require_dealer_approval = true]
  ↓
ReviewRequest (status = "approved")
  ↓
ReviewDraft (compliance_passed = true required)
  ↓ [Dealer approves draft]
LINE message dispatched
  ↓
Customer posts review → ReviewSignal created
  ↓
ReviewSignal analysis (Phase 11D+ — reputation_agent)
  ↓
ReputationInsight → ReputationOptimizationProfile
  ↓
MEO/AEO/LLMO/AIO metadata → ContentOptimizationProfile (cross-module feed)
```

---

## 2. Core Domain Objects (Phase A)

### 2.1 ReputationProfile

The dealer-level reputation state object. Aggregates destinations, policy, summary, and insights.

```typescript
interface ReputationProfile {
  dealer_id:        string;   // Always from getCurrentDealer()
  shop_name:        string;
  status:           ReputationProfileStatus;
  destinations:     ReviewDestination[];
  policy:           ReputationPolicy;
  summary:          ReputationSummary | null;
  insights:         ReputationInsight[];
  created_at:       string;
  last_updated_at:  string | null;
}
```

### 2.2 ReputationPolicy — Governance Defaults

| Policy Field | Default | Override |
|-------------|---------|---------|
| `require_dealer_approval` | `true` (literal — locked) | Cannot be disabled |
| `max_requests_per_customer_per_30_days` | `1` | Dealer configuration |
| `min_hours_after_completion` | `24` | Dealer configuration |
| `send_window_start_hour` | `9` | Dealer configuration |
| `send_window_end_hour` | `20` | Dealer configuration |
| `response_window_days` | `14` | Dealer configuration |

### 2.3 ReviewDestination

Each destination is a specific platform URL where a customer can post a review.

```typescript
interface ReviewDestination {
  platform:      ReviewPlatform;
  review_url:    string | null;   // null until dealer configures it
  enabled:       boolean;
  available_now: boolean;
}
```

Supported platforms: `google`, `instagram`, `facebook`, `website`, `trip_advisor`, `custom`

### 2.4 ReputationSummary

Aggregated metrics derived from ReviewSignal[]. Null until 5+ reviews collected.

Fields: `total_reviews`, `average_rating`, `rating_distribution`, `review_velocity_30d`, `review_velocity_90d`, `top_platforms`, `trend`

---

## 3. Review Request Workflow (Phase B)

### 3.1 ReviewRequest Lifecycle

```
draft → pending_approval → approved → sent → review_received
                         ↘ cancelled         ↘ no_response
```

### 3.2 Seven Readiness Checks

`validateReviewRequestReadiness()` runs 7 sequential checks in this order:

| # | Check | Blocking Condition |
|---|-------|-------------------|
| 1 | `feature_enabled` | Dealer plan does not include reputation feature |
| 2 | `destination_configured` | No enabled destination with a review_url |
| 3 | `dealer_settings_available` | Reputation settings not initialized |
| 4 | `customer_has_line` | Customer has no linked LINE account |
| 5 | `consent_verified` | Customer has denied LINE messaging consent |
| 6 | `policy_window_passed` | min_hours_after_completion not yet elapsed |
| 7 | `customer_eligible` | A request was sent within the last 30 days |

Returns `ReviewRequestReadinessResult` with per-check details and a prepared ReviewRequest if all pass.

### 3.3 Phase F Orchestration

`prepareWorkCompletedReputationPlan()` runs all three validations in sequence:
1. Review request readiness (pure, sync)
2. LINE action readiness (async, CE engine — validates LINE feature + dealer LINE settings + customer LINE link)
3. Agent notification readiness (async, CE engine — validates AI Gateway + reputation_agent feature + agent registration)

Returns `WorkCompletedReputationPlan` with `overall_readiness`: `ready_all` | `ready_partial` | `not_ready`.

**Dealer approval is required regardless of readiness status.**

---

## 4. Review Draft Compliance Model (Phase C)

### 4.1 Compliance Rules (Non-Negotiable)

These rules cannot be weakened in any version without explicit legal/ethical review:

| Rule | Flag | Severity |
|------|------|----------|
| Never suggest a star rating | `star_rating_suggestion` | Blocking |
| Never use pressure language | `pressure_language` | Blocking |
| Never offer incentives | `incentive_offer` | Blocking |
| Never simulate a customer review | `fake_review_attempt` | Blocking |
| Never auto-post on customer's behalf | `auto_post_attempt` | Blocking |

### 4.2 Required Message Elements

The following elements should appear in every review request:
- `greeting_and_thanks` — thank the customer for their business
- `voluntary_freedom` — explicitly state the customer is free to write honestly
- `explicit_optionality` — make clear the review is optional

### 4.3 Compliance Validation

`validateDraftCompliance(messageText, now)` scans for prohibited Japanese and English patterns.

Returns `DraftComplianceResult` with `passed`, `blocking_flags`, `warning_flags`.

A draft with `compliance_passed = false` **cannot be approved** by the dealer.

---

## 5. Reputation Signal Model (Phase D)

### 5.1 Signal Sources (7)

| Source | Description |
|--------|-------------|
| `google_review` | Posted on Google Business Profile |
| `line_survey` | LINE survey or question response |
| `customer_feedback` | In-app or form feedback |
| `website_testimonial` | Dealer website testimonial form |
| `sns_comment` | Instagram, Facebook, X mentions |
| `completion_report` | Dealer observations at job completion |
| `manual_input` | Dealer-recorded verbal feedback |

### 5.2 Signal Types (6)

`star_rating`, `text_review`, `survey_response`, `testimonial`, `sns_mention`, `verbal_feedback`

### 5.3 Analysis Dimensions (Phase 11D+)

Each signal supports analysis for:
- Sentiment (positive / neutral / negative)
- Service quality score
- Response time score
- Pricing perception score
- NPS score
- Repeat visit likelihood
- Local SEO keywords
- AEO FAQ candidates

All analysis fields are null/empty in Sprint 11C — populated by `reputation_agent` in Phase 11D+.

---

## 6. MEO / AEO / LLMO / AIO Optimization Model (Phase E)

### 6.1 Optimization Targets

| Target | Focus | Reputation Signals Used |
|--------|-------|------------------------|
| MEO | Google Maps local ranking | Local keywords, review volume, star rating |
| AEO | Featured snippets, PAA boxes | FAQ candidates from review text |
| LLMO | ChatGPT/Claude citation | Entity clarity, expertise signals |
| AIO | Perplexity, AI Overview | Structured summaries, semantic clusters |

### 6.2 ReputationOptimizationProfile

Counterpart to `ContentOptimizationProfile` in `@/lib/marketing`.
Covers reputation-specific optimization signals not present in campaign data.

```typescript
interface ReputationOptimizationProfile {
  dealer_id:              string;
  active_targets:         OptimizationTarget[];
  local_keywords:         ReputationLocalKeywords;
  service_keywords:       ReputationServiceKeywords;
  vehicle_keywords:       ReputationVehicleKeywords;
  aeo:                    ReputationAEOProfile;
  llmo:                   ReputationLLMOProfile;
  aio:                    ReputationAIOProfile;
  last_signals_processed: number;
  last_optimized_at:      string | null;
}
```

`buildEmptyReputationOptimizationProfile(dealerId)` creates a blank profile for initial setup.

---

## 7. Review Compliance Policy (Phase C — permanent)

The following rules are permanently enforced and must not be weakened:

1. **No fake reviews.** The system never generates, submits, or simulates reviews on behalf of customers.
2. **No star rating suggestions.** Messages never suggest, imply, or request a specific number of stars.
3. **Voluntary always.** Messages explicitly state the customer is free to write their own honest opinion.
4. **No pressure.** No urgency, no guilt, no follow-up harassment.
5. **No incentives.** No discounts, gifts, points, or rewards offered in exchange for reviews.
6. **No selective targeting.** Review requests cannot be limited to customers with positive sentiment.
7. **No auto-posting.** The system never submits a review via any API or automation on behalf of a customer.
8. **Dealer approval required.** No review request message is sent without explicit dealer confirmation.

These rules are enforced at three layers:
- `REVIEW_COMPLIANCE_RULES` — machine-readable pattern rules
- `validateDraftCompliance()` — static pre-check on every draft
- Dealer review UI — human approval gate before any send

---

## 8. Customer Engagement Integration (Phase F)

### 8.1 Integration Point

`WORK_COMPLETED` event → `prepareWorkCompletedReputationPlan()` → `WorkCompletedReputationPlan`

### 8.2 Three-Component Dry-Run

| Component | Validator | Source |
|-----------|-----------|--------|
| Review request | `validateReviewRequestReadiness()` | `review-request.ts` (pure) |
| LINE messaging | `validateLineActionReadiness()` | CE engine (async) |
| Agent notification | `validateAgentNotifyReadiness()` | CE engine (async) |

### 8.3 Plan Result

```typescript
interface WorkCompletedReputationPlan {
  overall_readiness:        "ready_all" | "ready_partial" | "not_ready";
  review_request_readiness: ReviewRequestReadinessResult;
  line_readiness:           LineActionReadinessResult;
  agent_readiness:          AgentNotifyReadinessResult;
  dealer_approval_required: true;   // Permanently locked
}
```

---

## 12. Sprint 11D — Reputation Agent Runtime Layer

### 12.1 Overview

Sprint 11D implements the production-safe runtime layer at `src/lib/reputation/runtime/`.
It connects the Sprint 11C domain model to the AI Agent Framework and AI Gateway,
without executing any AI inference.

### 12.2 ReputationRuntime (Phase A)

`ReputationRuntime` is the main adapter class. Instantiated server-side via
`ReputationRuntime.create()` which resolves `dealer_id` from `createAgentContext()` →
`getCurrentDealer()`. Never constructed with a client-supplied dealer_id.

```
ReputationRuntime.create(destination, policy)
  ↓
ReputationExecutionContext
  ├── agent_context   (dealer_id, plan, gateway, policy, trace_id)
  ├── feature_access  (ai_gateway, ai_reputation)
  └── primary_destination, reputation_policy, runtime_trace_id

runtime.checkReadiness()    → ReputationReadinessCheck[] (Phase B)
runtime.buildActionPlan()   → ReputationActionPlan (Phase C)
runtime.execute()           → ReputationExecutionResult (Phases B+C+D)
```

### 12.3 AI Gateway Readiness (Phase B)

`checkReputationGatewayReadiness()` runs 8 checks in sequence:

| # | Check | Blocking | Source |
|---|-------|---------|--------|
| 1 | `ai_gateway_feature` | Yes | `checkFeatureAccess("ai_gateway")` |
| 2 | `ai_reputation_feature` | Yes | `checkFeatureAccess("ai_reputation")` |
| 3 | `provider_configured` | Yes | `checkAiGatewayReady()` |
| 4 | `provider_enabled` | Yes | `checkAiGatewayReady()` |
| 5 | `api_key_configured` | Yes | `checkAiGatewayReady()` |
| 6 | `dealer_provider_policy` | Yes | `getAiSettings()` + provider non-null |
| 7 | `usage_policy_available` | No (warning) | `getAiSettings().migration_required` |
| 8 | `feature_capability_support` | Yes | `getAgentEntry("reputation_agent")` |

### 12.4 Review Request Generation Dry-Run (Phase C)

`buildReviewRequestDryRun()` is a pure synchronous function. Input must include
pre-fetched gateway readiness, customer eligibility, and destination configuration.

**Output includes:**
- `readiness_status` — `"ready"` | `"not_ready"`
- `required_missing_settings` — list of settings the dealer must configure
- `action_plan` — 9 steps, prompt metadata, compliance checklist, action_id
- `prompt_metadata` — template ID, estimated tokens, required context fields

**The 9 action steps:**
1. `1_gateway_check` — verify AI Gateway
2. `2_destination_check` — verify review destination URL
3. `3_customer_check` — verify 30-day customer eligibility
4. `4_compliance_guard` — run Phase D compliance guard
5. `5_prompt_build` — (deferred) build prompt from context
6. `6_ai_generate` — (deferred) generate message via AI provider
7. `7_draft_compliance` — (deferred) run `validateDraftCompliance()`
8. `8_dealer_approval` — (deferred) present draft to dealer
9. `9_line_dispatch` — (deferred) dispatch via LINE

### 12.5 Compliance Guard (Phase D)

`checkReputationCompliance()` validates the workflow context against 8 rules.
`REPUTATION_COMPLIANCE_CHECKLIST` documents all 8 rules in machine-readable form.
Included in every `ReputationActionPlan`.

**The 8 permanent rules:**
1. `no_fake_reviews` — never generate or simulate customer reviews
2. `no_posting_on_behalf` — never auto-post to review platforms
3. `no_selective_targeting` — no targeting by sentiment or rating
4. `no_pressure_language` — no urgency, guilt, or follow-up pressure
5. `no_incentive_offer` — no rewards in exchange for reviews
6. `voluntary_and_authentic` — reviews must be voluntary
7. `customer_owns_content` — customer is sole author of any review
8. `dealer_approval_required` — explicit dealer confirmation always required

### 12.6 Customer Engagement Integration (Phase E)

`buildWorkCompletedRuntimePlan()` wraps the Sprint 11C engagement plan with runtime metadata:

```typescript
interface WorkCompletedRuntimePlan {
  engagement_plan:          WorkCompletedReputationPlan;   // from Sprint 11C
  execution_request:        ReputationExecutionRequest;    // for Phase 11E+ runtime
  action_plan:              ReputationActionPlan | null;   // from ReputationRuntime
  line_dispatch_payload:    FutureLineDispatchPayload;     // dry-run, no message
  agent_execution_request:  FutureAgentExecutionRequest;  // dry-run, no inference
  dealer_approval_required: true;
  execution_deferred:       true;
}
```

### 12.7 Sprint 11D Files

| File | Purpose |
|------|---------|
| `src/lib/reputation/runtime/runtime-types.ts` | Phase A: all runtime domain types (pure) |
| `src/lib/reputation/runtime/gateway-readiness.ts` | Phase B: 8-check AI Gateway validator (server) |
| `src/lib/reputation/runtime/review-request-dryrun.ts` | Phase C: review request dry-run builder (pure) |
| `src/lib/reputation/runtime/compliance-guard.ts` | Phase D: workflow compliance guard (pure) |
| `src/lib/reputation/runtime/reputation-runtime.ts` | Phase A: ReputationRuntime main adapter (server) |
| `src/lib/reputation/runtime/engagement-runtime.ts` | Phase E: CE integration + WorkCompletedRuntimePlan |
| `src/lib/reputation/runtime/index.ts` | Public API exports for the runtime submodule |

---

## 9. Files Created (Sprint 11C)

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/reputation/reputation-types.ts` | Created | Phase A: domain types + re-exports from agent foundation |
| `src/lib/reputation/reputation-profile.ts` | Created | Phase A: ReputationProfile, ReputationPolicy, ReputationSummary |
| `src/lib/reputation/review-request.ts` | Created | Phase B: ReviewRequest, 7-check readiness validator |
| `src/lib/reputation/review-draft.ts` | Created | Phase C: ReviewDraft, REVIEW_COMPLIANCE_RULES, validateDraftCompliance() |
| `src/lib/reputation/review-signal.ts` | Created | Phase D: ReviewSignal, signal collection, analysis helpers |
| `src/lib/reputation/reputation-optimization.ts` | Created | Phase E: MEO/AEO/LLMO/AIO optimization metadata structures |
| `src/lib/reputation/reputation-engagement.ts` | Created | Phase F: async engagement plan orchestrator |
| `src/lib/reputation/index.ts` | Created | Public API exports |
| `docs/master_specification/REPUTATION_PLATFORM_SPEC.md` | Created | Phase G: this document |
| `docs/master_specification/AI_REPUTATION_AGENT_ROADMAP.md` | Updated | Phase G: Sprint 11C section |
| `docs/master_specification/00_MASTER_SPECIFICATION_INDEX.md` | Updated | Phase G: v3.0 |

---

## 10. What Is NOT Implemented (by design)

| Feature | Reason |
|---------|--------|
| Real LINE message sending | Phase 11D — requires LINE API credentials + dealer approval UI |
| `reputation_agent` review request generation | Phase 11D — requires AI Gateway + agent capability routing |
| ReviewSignal AI analysis | Phase 11D — requires `reputation_agent` analysis implementation |
| ReputationInsight generation | Phase 11D — requires analysis to run first |
| ReputationOptimizationProfile population | Phase 11D — requires analysis and seo_agent |
| Google Business Profile review read API | Phase 11D+ — requires GBP API v4.9 integration |
| `reputation_platform` DB tables | Requires CTO approval — schema proposal pending |
| ReviewRequest persistence | Phase 11D — requires `review_requests` table |
| Dealer approval UI for review requests | Phase 11D — requires UI design pass |

---

## 11. Dependency Map

```
@/lib/reputation/reputation-types       → @/lib/ai/agents/reputation/types
@/lib/reputation/reputation-profile     → reputation-types
@/lib/reputation/review-request         → reputation-types, reputation-profile
@/lib/reputation/review-draft           → reputation-types
@/lib/reputation/review-signal          → reputation-types
@/lib/reputation/reputation-optimization → reputation-types, @/lib/marketing/marketing-optimization
@/lib/reputation/reputation-engagement  → reputation-types, reputation-profile,
                                           review-request, @/lib/customer-engagement,
                                           @/lib/customer-engagement/engine/line-dry-run,
                                           @/lib/customer-engagement/engine/agent-dry-run

@/lib/customer-engagement → (no knowledge of @/lib/reputation)
@/lib/media               → (no knowledge of @/lib/reputation)
@/lib/marketing           → (no knowledge of @/lib/reputation)
```

---

*GYEON Detailer Agent | AI Reputation Platform Specification | Office AZ | 2026-06-26*
