# AI Reputation Agent — Future Roadmap
## GYEON Detailer Agent: Authentic Review Collection and Reputation Management

| Field | Value |
|-------|-------|
| **Document** | AI Reputation Agent Roadmap |
| **Status** | Approved Future Feature — Deferred |
| **Created** | 2026-06-26 |
| **Priority** | Future Version (after core platform reaches stable production) |
| **Phases** | PHASE 77 – PHASE 81 |
| **Prerequisite** | AI Gateway Architecture (`AI_GATEWAY_SPEC.md`) must be implemented first |
| **Implementation** | Do not implement now. Specification and roadmap only. |

> **Note on PHASE 77 origin:** PHASE 77 (AI Review Request Agent) was previously listed under `AI_MARKETING_AGENT_ROADMAP.md`. It has been moved here as the first phase of the AI Reputation Agent track. The content is identical to the original PHASE 77 specification.

---

## Vision

Help dealers build authentic online reputation by making it easy to ask satisfied customers for reviews — through natural, polite, non-pressured communication via LINE.

The AI Reputation Agent turns every completed job into an opportunity to collect genuine customer feedback. It does this with strict compliance rules: no fake reviews, no incentives, no pressure, no star rating suggestions.

**Long-term goal:** A reputation management platform that tracks review health, identifies improvement opportunities, and helps dealers maintain a strong local presence on Google Business Profile and other platforms — without compromising review authenticity.

---

## Principles

1. **Authenticity is non-negotiable.** The system never generates, submits, or simulates reviews on behalf of customers. All reviews must be written and submitted by the customer.
2. **Voluntary always.** Review requests are polite and explicitly optional. No pressure messaging. No follow-up until explicitly opted in.
3. **Dealer controls every send.** No review request is sent without dealer approval in v1.0.
4. **Compliance is permanent.** The compliance rules in PHASE 77 (§77.6) cannot be relaxed in any version without explicit legal/ethical review.
5. **MEO-aware, never manipulative.** Content is designed to provide organic keyword context — never to instruct customers on what to write or which star rating to give.
6. **Discovery feedback loop.** Reputation data (review volume, star rating trends, review keyword frequency) feeds back into the AI Marketing Agent's discovery optimization. Strong reputation signals improve MEO, AEO, LLMO, AIO, and SEO performance. This is a cross-track dependency.

---

## AI Gateway Dependency

All AI-generated content in this track (review request messages, writing support prompts, recommendations) is routed through the **AI Gateway** (`AI_GATEWAY_SPEC.md`).

- Dealer must have an AI provider API key configured in `dealer_ai_settings`
- Feature gate: `AppFeature: "ai_reputation"` (Pro+) — defined at implementation time
- Office AZ does not pay inference costs for any AI Reputation Agent operation

---

## PHASE 77 — AI Review Request Agent

**Prerequisite:** LINE integration active (Phase B of core platform). Work order completion event available. AI Gateway configured.

**Status:** Future roadmap. Do not implement now.

> **Purpose:** After job completion, help dealers collect authentic customer reviews and social proof through LINE — increasing MEO signals (Google Business Profile star ratings), AEO authority, and LLMO credibility without generating fake content or pressuring customers.

### 77.1 Trigger Conditions

The review request workflow may be initiated when any of the following occurs:

| Trigger | Condition |
|---------|-----------|
| Work order status → `completed` | Primary trigger. Dealer receives prompt to send review request. |
| Completion report finalized | Alternative trigger if completion reports are used consistently. |
| Manual trigger by dealer | Dealer can initiate from customer record at any time. |

**Default behavior:** Dealer must actively choose to send the request. Auto-sending without dealer action is not permitted in v1.0.

### 77.2 Required Flow

```
Work order marked as completed
  ↓
System prompts dealer: "レビューリクエストを送信しますか？"
  ↓
Dealer reviews AI-generated LINE message
  ↓                          ↓
[編集して送信]           [このまま送信]
  ↓                          ↓
  └──────────┬───────────────┘
             ↓
  Dealer confirms → LINE message sent to customer
             ↓
  System records: review_request_sent_at, sent_by
             ↓
  Dealer manually confirms review received (optional)
  System records: review_confirmed_at (manual)
```

**Dealer approval is required before sending in v1.0.** The dealer must explicitly confirm the message before it is delivered.

### 77.3 AI-Generated LINE Message

The AI generates a polite, natural Japanese review request message using job context. The message is editable by the dealer before sending.

**Required message elements:**

1. **Greeting and thank-you** — references the completed job
2. **Voluntary review request** — asks politely, without pressure
3. **Explicit permission to write freely** — "率直なご感想で問題ございません"
4. **Review destination links** — Google Business Profile review URL, and optionally Instagram and dealer website
5. **Closing** — shop name and contact

**Example message (generated baseline — editable by dealer):**

```
{customer_name} 様

この度は施工をご依頼いただき、誠にありがとうございました。

今後のサービス向上のため、もしよろしければレビュー投稿にご協力いただけますと幸いです。
率直なご感想で問題ございません。

▼ Googleレビューはこちら
{google_business_profile_review_url}

{instagram_url が存在する場合:}
▼ Instagramのフォローもお待ちしています
{instagram_url}

ご不明な点がございましたら、お気軽にご連絡ください。
引き続きよろしくお願いいたします。

{dealer_name}
{dealer_phone}
```

**Context injected from job data:**

| Variable | Source |
|----------|--------|
| `customer_name` | `customers` table |
| `google_business_profile_review_url` | `dealer_settings` (new field: `gbp_review_url`) |
| `instagram_url` | `dealer_settings.sns_urls.instagram` (PHASE70 column) |
| `dealer_name` | `dealer_settings.business_name` |
| `dealer_phone` | `dealer_settings.business_phone` |
| Service context | Work order service category + GYEON product (used for personalization, not mandatory in message body) |

### 77.4 Optional Review Writing Support

The AI may optionally generate a brief, friendly prompt to help customers who want to write a review but don't know how to start. This is **never sent automatically** — the dealer must choose to include it.

**Example support text (optional):**

```
レビューに何を書けばよいかお困りの場合は、以下のような点を参考にしていただけますと幸いです。

・施工前と施工後の印象の違い
・スタッフの対応
・仕上がりのご感想
・どんな方にお勧めしたいか

もちろん、ご自由にお書きいただいて問題ありません。
```

**Key constraint:** The support text provides structural prompts only — never specific opinion suggestions ("素晴らしかった", "5つ星" など). The customer's opinion must remain entirely their own.

### 77.5 MEO/SEO Keyword Awareness

While the review request message itself must remain natural and pressure-free, the AI may **lightly** incorporate context that, if reflected in the customer's review, would support MEO/SEO:

- The message naturally mentions the service performed (e.g., "セラミックコーティングの施工") so that if the customer mentions it in their review, it becomes an organic keyword signal
- The message includes the shop name as it appears on Google Business Profile
- The optional writing support text includes service-neutral prompts that, if answered by the customer, naturally contain service-relevant keywords

**This is keyword awareness, not keyword injection.** The customer writes freely. No specific words are requested or required.

### 77.6 Compliance Rules (Mandatory — Non-Negotiable — Permanent)

These rules are **permanent** and cannot be relaxed in any future version without explicit legal/ethical review:

| Rule | Description |
|------|-------------|
| No fake reviews | The system must never generate, submit, or simulate customer reviews on behalf of any customer |
| No posting on behalf of customers | Reviews must be written and submitted by the customer directly — never by the dealer or the system |
| No pressure | The message tone must be polite and explicitly voluntary. No follow-up pressure messages in v1.0. |
| No positive-only requests | The system must never instruct customers to leave only positive feedback or to submit only if they are satisfied |
| No incentivized reviews | No rewards, discounts, gifts, or loyalty points may be offered in exchange for a review |
| Voluntary and authentic | The customer must be free to write any opinion, including negative feedback |
| No star rating suggestion | The message must never suggest or imply a specific star rating |
| No opinion suggestion | The optional writing support text must not suggest specific adjectives, outcomes, or sentiment |

Violation of any of these rules constitutes a policy violation and must be treated as a critical bug.

### 77.7 Tracking

| Field | Type | Description |
|-------|------|-------------|
| `review_request_sent_at` | `timestamptz` | When the LINE message was sent |
| `review_request_sent_by` | `uuid` | Staff member who approved and sent the request |
| `review_confirmed_at` | `timestamptz \| null` | When dealer manually marks a review as received |
| `review_platform` | `text \| null` | 'google' / 'instagram' / 'website' — manually set by dealer |
| `review_request_work_order_id` | `uuid` | FK to work order that triggered the request |

These fields are stored per work order or per a new `review_requests` table (schema design TBD at implementation time — no migration applied now).

**Dashboard indicator:** Dealer can see:
- How many review requests have been sent this month
- How many reviews have been manually confirmed
- Which jobs have not yet had a review request sent

### 77.8 Future Scope (Deferred Beyond v1.0)

| Feature | Notes |
|---------|-------|
| Automated follow-up (single, optional) | One polite follow-up after N days if no review confirmed — requires opt-in |
| Direct GBP review link generation | Deep link to GBP review modal for specific shop |
| Review content analysis | AI reads received reviews for sentiment and keyword signals (privacy review required) |
| Multi-platform review tracking | Track review counts per platform over time |
| Review response drafting | AI drafts owner response to Google reviews (dealer edits and posts manually) |

---

## PHASE 78 — AI Review Writing Support

**Prerequisite:** PHASE 77 operational. Customer-facing LINE interaction established.

**Status:** Future roadmap. Do not implement now.

Expand the optional writing support from PHASE 77 into a structured, interactive experience:

| Feature | Description |
|---------|-------------|
| Guided review prompts | Structured questions the AI generates based on the job — neutral, non-leading |
| Platform-specific prompts | Different question sets for Google, Instagram, dealer website |
| Review length guidance | Suggest optimal review length per platform (Google: 50–200 words; Instagram caption: shorter) |
| Prompt personalization | Prompts reference the actual service performed (coating, PPF, etc.) — neutral framing only |

**Compliance note:** PHASE 77.6 compliance rules apply to all PHASE 78 content without exception.

---

## PHASE 79 — Google Business Profile Review Integration

**Prerequisite:** PHASE 77 operational. Google Business Profile API access configured.

**Status:** Future roadmap. Do not implement now.

| Feature | Description |
|---------|-------------|
| GBP deep-link generation | Auto-generate the direct Google review URL for each dealer's GBP listing |
| Review count tracking | Pull review count from GBP Insights API to show trend in dealer dashboard |
| Star rating display | Show current average star rating in reputation dashboard |
| Review notification | Notify dealer when a new Google review is detected |
| Review response drafting | AI generates draft response for Google reviews — dealer edits and posts manually, never automated |

**Note:** Google review response drafting is the only AI content in this phase that assists dealers in writing (not customers). The dealer always posts responses manually via their GBP account — the system never posts on behalf of the dealer.

---

## PHASE 80 — Reputation Analytics Dashboard

**Prerequisite:** PHASE 77–79 operational. Review data accumulating.

**Status:** Future roadmap. Do not implement now.

| Metric | Source |
|--------|--------|
| Total reviews sent (LINE requests) | Internal tracking |
| Review conversion rate (requests → confirmed reviews) | Internal tracking |
| Average response time (days from request to review) | Internal tracking |
| Google star rating trend | GBP API |
| Review volume by platform | GBP API + manual logs |
| MEO signal health score | Composite: rating + recency + volume + response rate |
| Best-performing service categories (by review trigger) | Correlated from work order data |

### Discovery Impact Tracking

| Signal | Description |
|--------|-------------|
| GBP ranking trend | Estimated local search rank for primary service keywords |
| Review keyword frequency | How often service-relevant keywords appear in received reviews (aggregate, anonymized) |
| Review velocity | Rate of new reviews — plateaus signal action needed |

---

## PHASE 81 — Reputation Improvement Recommendations

**Prerequisite:** PHASE 80 operational. Sufficient data accumulated (minimum 3 months).

**Status:** Future roadmap. Do not implement now.

The AI analyzes reputation data and generates actionable improvement recommendations:

**Example recommendations:**
- 「レビュー依頼の送信後、平均3日以内に届いたレビューが多い傾向があります。施工完了から2日以内の送信が効果的です」
- 「Googleレビューの星評価が先月から低下しています。最近のレビューを確認し、お客様の声に対応することをお勧めします」
- 「PPF施工のレビュー数が少ない傾向があります。PPF施工完了後のレビュー依頼を積極的に活用してみてください」
- 「レビューへの返信をしているお店は、GBP表示回数が平均1.5倍高くなっています」

All recommendations are AI-generated but dealer-reviewed. No action is taken automatically.

---

## Phase Dependency Map

```
AI Gateway Architecture (prerequisite)
  │
  ▼
PHASE 77 — AI Review Request Agent
  (LINE integration active, work order completion event)
      │
      ├── PHASE 78 — AI Review Writing Support
      │       (guided prompts, platform-specific)
      │
      └── PHASE 79 — Google Business Profile Integration
              (GBP API, review tracking, response drafting)
              │
              ▼
          PHASE 80 — Reputation Analytics Dashboard
              (review metrics, MEO signals, trend data)
              │
              ▼
          PHASE 81 — Reputation Improvement Recommendations
              (AI analysis, actionable suggestions)
```

**Cross-track dependency (Discovery Feedback Loop):** PHASE 80 reputation analytics feeds back into the AI Marketing Agent's PHASE 75 discovery performance analytics. Review volume, star rating trend, and review keyword frequency (aggregate) inform MEO, AEO, LLMO, AIO, and SEO performance recommendations in the Marketing track. Strong reputation signals from the Reputation Agent amplify the discovery impact of content produced by the Marketing Agent.

---

## Technology Considerations

| Capability | Candidate technology |
|------------|---------------------|
| Review request message generation | AI Gateway → Claude or OpenAI (dealer's key) |
| Review writing support prompts | AI Gateway → Claude or OpenAI (dealer's key) |
| Review response drafting | AI Gateway → Claude or OpenAI (dealer's key) |
| GBP review link generation | Static URL pattern: `https://search.google.com/local/writereview?placeid={place_id}` |
| GBP review count / rating | Google Business Profile API (OAuth2 per dealer) |
| Reputation score calculation | Rule-based + AI-assisted — no external API required |
| LINE message delivery | LINE Messaging API (already in core platform) |

**All AI API keys must be stored server-side. No AI API credentials may be exposed to the client.**

---

## Compliance Checklist (Non-Negotiable)

Every feature implemented in this track must pass the following checklist before shipping:

- [ ] No fake review generation path exists in any code
- [ ] No automated send without explicit dealer approval
- [ ] No star rating suggestion in any generated text
- [ ] No positive-only framing in any generated prompt
- [ ] No incentive language in any template or prompt
- [ ] Customer's free choice is preserved in all flows
- [ ] All generated content is editable by dealer before sending

---

## Implementation Gate

**Do not begin any PHASE 77–81 implementation until:**

1. AI Gateway Architecture implemented and validated (see `AI_GATEWAY_SPEC.md`)
2. Core business platform at stable production
3. Sprint 10 (dealer approval flow) complete
4. LINE integration active (Phase B of core platform)
5. Legal review of review request compliance rules against Japanese consumer protection law
6. Privacy policy updated for AI-assisted communications
7. Separate SDD specification pass for each phase

---

## Sprint 10E — Foundation Implementation (2026-06-26)

**Status:** Foundation implemented. AI inference deferred to Phase G.

This sprint establishes the complete reputation agent architecture as the first concrete AI agent in the GYEON Detailer Agent platform.

### Implemented Files

| File | Purpose |
|------|---------|
| `src/lib/ai/agents/reputation/types.ts` | All reputation types: platforms, review model, analysis model, dashboard, marketing feed |
| `src/lib/ai/agents/reputation/workflow.ts` | Workflow stage model, transitions, compliance constants, throttle rules, `computeTrend()` |
| `src/lib/ai/agents/reputation/reputation-agent.ts` | `ReputationAgent` class implementing `AIAgent<ReputationAgentRequest, ReputationAgentResponse>` |
| `src/lib/ai/agents/reputation/run-reputation-task.ts` | Server action — execution policy → context → lifecycle |
| `src/lib/ai/agents/reputation/index.ts` | Public API re-exports |

### Agent Registry Update

`reputation_agent` and `review_agent` status changed from `"planned"` → `"active"` in `src/lib/ai/agents/registry.ts`.

### Architecture summary

```
runReputationTask(input)          ← "use server" — never accepts dealer_id from client
        │
        ▼
checkExecutionPolicy("reputation_agent")
  ├─ ai_reputation feature gate (Pro+)
  ├─ AI Gateway readiness
  ├─ getCurrentDealer() auth
  └─ usage policy (Phase G)
        │
        ▼
createAgentContext("reputation_agent")
  └─ dealer_id from getCurrentDealer() — never from input
        │
        ▼
runAgentLifecycle(new ReputationAgent(), ctx, input)
  ├─ initialize()     → loads dealer platform config (defaults in Sprint 10E)
  ├─ validate()       → production-quality per task_type discriminated union
  ├─ execute()        → AIAgentNotImplementedError (Phase G)
  ├─ postProcess()    → compliance filter (Phase G)
  └─ logAgentUsage()  → no-op (Phase G)
```

### Task types

| Task type | Sprint 10E status | Phase G behavior |
|-----------|------------------|-----------------|
| `review_request_generation` | Validates, defers inference | AI drafts LINE message via dealer's provider |
| `review_response_drafting` | Validates, defers inference | AI drafts GBP review response |
| `reputation_analysis` | Validates, defers inference | AI analyzes review corpus for sentiment, keywords, SEO signals |

### Compliance rules (enforced at type level)

All compliance rules from §77.6 are encoded as TypeScript `true` literal types in `ReputationComplianceRules` and `REPUTATION_COMPLIANCE` — they cannot be toggled off without a type error:

```typescript
no_fake_reviews:                true;  // Can only be assigned true
dealer_approval_required:       true;
manual_review_response_posting: true;
```

### Future compatibility established (Phase F)

| Future consumer | Interface ready |
|----------------|----------------|
| AI Marketing Agent | `MarketingAgentFeed` — reputation signals for MEO/AEO/LLMO/AIO/SEO |
| AI Growth Agent | `ReputationDashboard.trend` — improving / stable / declining |
| LINE Agent | `ReviewRequestOutput.message_text` — LINE message draft |
| Review Analytics | `ReviewAnalysisResult` — full analysis model |
| Monthly Report | `ReputationDashboard` — period summary |

### What Phase G must add

1. `DEALER_AI_KEY_SECRET` env var configured + `ai_settings` column migration applied (CTO approval)
2. AI provider adapter calls inside `execute()` for all three task types
3. `dealer_settings.reputation_settings` column (separate migration, CTO approval) for platform URLs
4. `dealer_ai_usage_log` table (separate migration) for usage tracking
5. `postProcess()` compliance filter implementation
6. Network-level connection test (`test_type: "live_call"`)

---

## Sprint 11C — AI Reputation Platform Foundation

### Completed: 2026-06-26

Sprint 11C implements the production-ready AI Reputation Platform foundation as a new business domain at `src/lib/reputation/`. This sprint connects the existing AI reputation agent types, the Customer Engagement runtime, and the AI Video/Marketing platforms into one unified reputation subsystem.

### Architecture Overview

```
WORK_COMPLETED (Customer Engagement event)
  ↓
prepareWorkCompletedReputationPlan() — async dry-run orchestrator
  ├── validateReviewRequestReadiness() [pure, 7 checks]
  ├── validateLineActionReadiness()    [CE engine async]
  └── validateAgentNotifyReadiness()   [CE engine async]
  ↓
WorkCompletedReputationPlan (require_dealer_approval = true always)
  ↓ [Dealer approves]
ReviewRequest → ReviewDraft (compliance_passed required)
  ↓ [Dealer approves draft]
LINE review request sent → ReviewSignal created
  ↓ Phase 11D+
ReputationInsight → ReputationOptimizationProfile (MEO/AEO/LLMO/AIO)
```

### Phase Completion

| Phase | Description | Status |
|-------|-------------|--------|
| A | Core domain: ReputationProfile, ReviewDestination, ReputationPolicy, ReputationSummary | Complete |
| B | Review request workflow: 7-check readiness validator, ReviewRequest lifecycle | Complete |
| C | Review draft compliance: REVIEW_COMPLIANCE_RULES, 5 blocking flags, validateDraftCompliance() | Complete |
| D | Reputation signal model: ReviewSignal (7 sources, 6 types, 10 analysis dimensions) | Complete |
| E | MEO/AEO/LLMO/AIO optimization: ReputationOptimizationProfile, FAQ candidates, structured summaries | Complete |
| F | Customer Engagement integration: prepareWorkCompletedReputationPlan() async orchestrator | Complete |
| G | Documentation: REPUTATION_PLATFORM_SPEC.md, spec index updated to v3.0 | Complete |

### Files Created

| Module | File | Purpose |
|--------|------|---------|
| Types | `reputation-types.ts` | Domain types + re-exports from agent foundation |
| Profile | `reputation-profile.ts` | ReputationProfile, ReputationPolicy, destination helpers |
| Request | `review-request.ts` | ReviewRequest, 7-check pure validator, state machine |
| Draft | `review-draft.ts` | ReviewDraft, REVIEW_COMPLIANCE_RULES (5 blocking flags) |
| Signal | `review-signal.ts` | ReviewSignal model, signal collection, analysis helpers |
| Optimization | `reputation-optimization.ts` | MEO/AEO/LLMO/AIO profile structures |
| Engagement | `reputation-engagement.ts` | Async plan orchestrator (CE integration) |
| Public API | `index.ts` | Re-exports from all reputation modules |

### Key Design Decisions

- `require_dealer_approval: true` is typed as the literal `true` — not `boolean` — to make the invariant enforceable at compile time
- `validateReviewRequestReadiness()` is a pure synchronous function — all DB lookups are done by the caller and passed in as `ReviewRequestContext`
- 5 compliance rules are "blocking" (prevent approval) — pattern-based static check before any draft can be approved
- `reputation-types.ts` re-exports foundation types from `@/lib/ai/agents/reputation/types` — no duplication; single source of truth
- `ReputationOptimizationProfile` complements (not duplicates) `ContentOptimizationProfile` from `@/lib/marketing` — reputation-specific signals only
- One-way dependency: `@/lib/reputation` imports from `@/lib/customer-engagement`; CE module has zero knowledge of reputation

### Next Steps (Sprint 11D — now complete; see Sprint 11D section below)

1. ~~Implement `reputation_agent` review request message generation (AI Gateway)~~ → deferred to 11E
2. ~~Implement dealer approval UI for review requests~~ → deferred to 11E
3. ~~Implement ReviewRequest DB persistence (`review_requests` table — CTO approval required)~~ → deferred to 11E
4. ~~Implement ReviewSignal ingestion from Google Business Profile review webhook~~ → deferred to 11E
5. ~~Implement `reputation_agent` signal analysis to populate `ReputationInsight[]`~~ → deferred to 11E
6. ~~Implement cross-agent feed from `MarketingAgentFeed` to `ContentOptimizationProfile`~~ → deferred to 11E

---

## Sprint 11D — AI Reputation Agent Runtime

### Completed: 2026-06-26

Sprint 11D implements the first safe runtime layer for the AI Reputation Agent at
`src/lib/reputation/runtime/`. Connects the Sprint 11C domain model to the AI Agent
Framework and AI Gateway without executing any AI inference.

### Architecture Overview

```
Server Action
  ↓
ReputationRuntime.create(destination, policy)  — dealer_id from getCurrentDealer()
  ↓
ReputationExecutionContext
  ↓
runtime.execute(request, now)
  ├── Phase B: checkReputationGatewayReadiness()     [8 checks]
  ├── Phase D: checkReputationCompliance()            [8 rules]
  └── Phase C: buildReviewRequestDryRun()             [9 steps]
  ↓
ReputationExecutionResult
  ├── state: "dry_run" | "blocked_gateway" | "blocked_compliance" | ...
  ├── action_plan: ReputationActionPlan
  └── dealer_approval_required: true  (literal — locked)
```

### Phase Completion

| Phase | Description | Status |
|-------|-------------|--------|
| A | ReputationRuntime class, ReputationExecutionContext, request/result types | Complete |
| B | AI Gateway 8-check readiness validator, ReputationGatewayReadiness | Complete |
| C | Review request generation dry-run, ReputationActionPlan (9 steps, prompt metadata) | Complete |
| D | Compliance guard, REPUTATION_COMPLIANCE_CHECKLIST (8 rules), workflow context | Complete |
| E | CE integration, WorkCompletedRuntimePlan, FutureLineDispatchPayload | Complete |
| F | Documentation: REPUTATION_PLATFORM_SPEC.md §12, roadmap, spec index v3.1 | Complete |

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/reputation/runtime/runtime-types.ts` | All runtime domain types (pure) |
| `src/lib/reputation/runtime/gateway-readiness.ts` | 8-check AI Gateway validator (server-side) |
| `src/lib/reputation/runtime/review-request-dryrun.ts` | Review request dry-run builder (pure) |
| `src/lib/reputation/runtime/compliance-guard.ts` | Workflow compliance guard (pure) |
| `src/lib/reputation/runtime/reputation-runtime.ts` | ReputationRuntime class (server-side) |
| `src/lib/reputation/runtime/engagement-runtime.ts` | CE integration, WorkCompletedRuntimePlan |
| `src/lib/reputation/runtime/index.ts` | Public API exports |

### Key Design Decisions

- `ReputationRuntime` is a class — consistent with `ReputationAgent` in the agent framework
- Phase B runs all 8 gateway checks in a single `Promise.all` call (4 in parallel)
- Phase C is a pure synchronous function — all DB lookups are pre-fetched by the caller
- Phase D checks workflow *context* (selective targeting, auto-posting), not message text; the text-pattern check is in `review-draft.ts`
- `execution_deferred: true` is typed as literal — cannot be overridden
- `WorkCompletedRuntimePlan.line_dispatch_payload.message_text` is permanently `null` until Phase 11E+

### Next Steps (Sprint 11E) — Now Complete

Sprint 11E implemented the dealer-facing review request approval UI. See Sprint 11E section below.

---

## Sprint 11E — Review Request Dealer Approval UI

| Field | Value |
|-------|-------|
| **Commit** | `Sprint 11E: add review request approval UI` |
| **Status** | Complete |

Sprint 11E implements the first dealer-facing review request approval workflow after work completion. The UI is integrated into the existing work order detail panel as a new collapsible section, visible only on completed work orders with a linked customer.

### Architecture

```
WorkOrderDetail (completed + customer exists)
  ↓ renders ReviewRequestApprovalSection
    ↓ useEffect → prepareReviewRequestApproval(workOrderId)   [server action]
      ├── getCurrentDealer()                   — dealer_id (never from client)
      ├── checkFeatureAccess("ai_reputation")  — Pro+ gate
      ├── getWorkOrder(workOrderId)            — dealer_id scoped ownership check
      ├── checkReputationGatewayReadiness()    — 8 gateway checks
      ├── checkReputationCompliance()          — 8 workflow rules
      └── buildReviewRequestDryRun()           — 9-step action plan
    ↓ returns ReviewRequestApprovalData
    ↓ Dealer clicks Approve/Reject/Skip
      → approveReviewRequestDryRun() / rejectReviewRequestDryRun() / skipReviewRequestDryRun()
        ├── Auth + feature gate + ownership check
        ├── Compliance guard re-validation
        └── Returns dry_run: true  (no LINE, no AI, no persistence)
```

### Phase Completion

| Phase | Description | Status |
|-------|-------------|--------|
| A | Inspect existing work order UI, identify integration point | Complete |
| B | `ReviewRequestApprovalSection` — full dealer-facing approval card | Complete |
| C | Non-persistent UI state only — documented constraint, no fake persistence | Complete |
| D | Server actions: prepare/approve/reject/skip — all dry-run, dealer_id from server | Complete |
| E | Feature gate: `ai_reputation` — upgrade prompt if locked | Complete |
| F | Section added to `WorkOrderDetail` after Maintenance, conditional on completion + customer | Complete |
| G | Documentation: REPUTATION_PLATFORM_SPEC §13, roadmap, spec index v3.2 | Complete |

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/reputation/actions/review-request-actions.ts` | Server actions for approval dry-run workflow |
| `src/components/reputation/ReviewRequestApprovalSection.tsx` | Dealer-facing approval UI |

### Files Modified

| File | Change |
|------|--------|
| `src/components/work-orders/WorkOrderDetail.tsx` | Added `ReviewRequestApprovalSection` collapsible section |
| `docs/master_specification/REPUTATION_PLATFORM_SPEC.md` | Added §13 Sprint 11E |
| `docs/master_specification/AI_REPUTATION_AGENT_ROADMAP.md` | Added Sprint 11E section |
| `docs/master_specification/00_MASTER_SPECIFICATION_INDEX.md` | Bumped to v3.2 |

### Security Constraints (all enforced)

- `dealer_id` from `getCurrentDealer()` — never from client input or URL
- All DB reads scoped by `dealer_id` via `getWorkOrder()`
- Pro+ feature gate via `checkFeatureAccess("ai_reputation")`
- `dry_run: true` on all action results — no LINE, no AI, no persistence
- No API keys exposed to client

### Deferred to Future Phases

| Feature | Phase |
|---------|-------|
| LINE message sending | Phase 11F+ |
| AI review draft generation | Phase 11F+ (requires AI provider adapter) |
| ReviewRequest DB persistence | Requires `review_requests` migration (CTO approval) |
| Real destination configuration | Requires reputation settings DB table |

### Next Steps (Sprint 11F+)

1. Implement AI provider adapter — `generateReviewRequestMessage()` via AI Gateway
2. Replace `draft_message: null` with real AI-generated draft in `ReviewRequestApprovalData`
3. Wire `line_dispatch_payload` into real LINE dispatch (post-dealer-approval)
4. Implement `review_requests` table (CTO approval) — enable real persistence
5. Implement ReviewSignal ingestion from Google Business Profile webhook

---

*GYEON Detailer Agent | AI Reputation Agent Roadmap | Office AZ | 2026-06-26*
