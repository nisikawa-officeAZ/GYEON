# Customer Engagement Platform — Runtime Implementation Plan
## GYEON Detailer Agent: Sprint 10G Planning Document

| Field | Value |
|-------|-------|
| **Document** | Customer Engagement Platform Runtime Plan |
| **Status** | Sprint 10H — Phase G-A dry-run runtime implemented (zero schema changes) |
| **Created** | 2026-06-26 |
| **Prerequisite** | Sprint 10F foundation (Customer Engagement Platform types, workflows, triggers) |
| **Scope** | Runtime engine design, migration proposals, integration analysis, sequencing |

---

## 1. Executive Summary

Sprint 10F established the complete type system for the Customer Engagement Platform (events, workflows, triggers, context). Sprint 10G plans the production runtime.

**Key finding:** The highest-value customer engagement flows — completion notification and review request — can be wired **without any new schema changes**, using existing infrastructure:
- `sendCompletionNotification()` (LINE, existing)
- `queueLineNotification()` with `purpose: "review_request"` and `scheduled_at + 24h` (LINE queue, existing)

This means Sprint 10H can deliver a functional `WORK_COMPLETED → LINE notification + review request` flow without waiting for CTO migration approval.

---

## 2. Runtime Engine Architecture

### 2.1 Component hierarchy

```
WorkflowExecutionEngine          ← top-level orchestrator
        │
        ▼
EngagementEventDispatcher        ← routes event → eligible triggers
        │
        ├── checkTriggerEligibility(trigger)
        ├── getWorkflow(trigger.workflow_id)
        └── createEngagementContext(event)
                │
                ▼
        EngagementActionDispatcher   ← executes each action
                │
                ├── Immediate (delay_hours === 0)
                │       → LINE: sendCompletionNotification / sendMaintenanceReminder / sendLineTextMessage
                │       → Agent: runAgentLifecycle() [Phase G-B, after ai_settings migration]
                │       → Tag: customer CRM tag write [Phase G-B, after schema]
                │
                └── Delayed (delay_hours > 0)
                        → LINE: queueLineNotification(scheduled_at = now + delay_hours) [Phase G-A]
                        → Agent: EngagementJobQueue [Phase G-B, new table]
                │
                ▼
        EngagementHistoryWriter      ← append-only log
                └── Phase G-A: no-op  |  Phase G-B: INSERT into customer_engagement_history
                │
                ▼
        EngagementFailureHandler     ← catch, classify, retry or give-up
                └── DEFAULT_RETRY_POLICY: 3 attempts, exponential backoff (max 30s)
```

### 2.2 Engine guarantees

- `dispatch()` never throws — all failures produce a structured `WorkflowExecutionResult`
- `dealer_id` is always from `EngagementContext.dealer_id` → `getCurrentDealer()` — never from event payload
- Each action produces an `ActionDispatchResult` regardless of success/failure
- Delayed actions produce `scheduled_for` + `queue_id` in the result
- History entries use `context.dealer_id` exclusively

### 2.3 Engine type contracts

Defined in `src/lib/customer-engagement/engine/types.ts`:

| Interface | Purpose |
|-----------|---------|
| `WorkflowExecutionEngine` | `dispatch(event)` → `WorkflowExecutionResult` |
| `EngagementEventDispatcher` | Routes event to eligible triggers |
| `EngagementActionDispatcher` | Executes or schedules each action |
| `EngagementHistoryWriter` | Append-only history (no-op Phase G-A) |
| `EngagementFailureHandler` | Retry vs give-up classification |
| `EngagementRetryPolicy` | `shouldRetry()` + `nextRetryDelayMs()` |
| `EngagementScheduledAction` | Queued future action record |

---

## 3. Implementation Sequencing

### Phase G-A — Zero schema changes (implement first)

All items below use existing tables and server actions. No CTO approval needed.

| Item | Integration point | Status |
|------|-------------------|--------|
| Wire `WORK_COMPLETED` event emission | `updateWorkOrder()` — detect `status → "completed"` transition | **Done (Sprint 10H)** |
| `send_line_message` (completion notification) | `sendCompletionNotification()` — dry-run validated | **Done (Sprint 10H dry-run)** |
| `request_review` (24h delay) | `queueLineNotification(purpose="review_request", scheduled_at+24h)` — dry-run validated | **Done (Sprint 10H dry-run)** |
| `MAINTENANCE_DUE` emission | `process-line-notification-queue.ts` trigger or cron | Plan ready |
| `send_line_message` (maintenance reminder) | `sendMaintenanceReminder()` — existing | Ready to wire |
| `CUSTOMER_CREATED` emission | `create customer` server action | Plan ready |
| Welcome LINE message | `sendLineTextMessage()` — existing | Ready to wire |

**Phase G-A delivers:** Functional `WORK_COMPLETED → LINE completion notification + queued review request` with no migrations.

### Phase G-B — With migrations (CTO approval required)

| Item | Migration required | Approval needed |
|------|--------------------|-----------------|
| Engagement history logging | `customer_engagement_history` table | Yes |
| Per-dealer workflow config | `dealer_settings.engagement_config` column | Yes |
| Google Business Profile URL | `dealer_settings.gbp_review_url` column | Yes |
| AI agent dispatch (notify_agent) | `ai_settings` column (Sprint 10C proposal) + Phase G adapters | Yes |
| Delayed AI actions | `engagement_job_queue` table | Yes |

---

## 4. WORK_COMPLETED Integration Analysis

### 4.1 Canonical trigger location

**File:** `src/lib/work-orders/update-work-order.ts`
**Action:** `updateWorkOrder(workOrderId, formData)`
**Condition:** `status === "completed"` AND previous status was not `"completed"`

### 4.2 Available data at completion time

| Field | Source | Available |
|-------|--------|-----------|
| `work_order_id` | `workOrderId` param | ✅ Yes |
| `dealer_id` | `getCurrentDealer()` | ✅ Yes |
| `customer_id` | `formData.get("customer_id")` or prior SELECT | ✅ Yes |
| `vehicle_id` | `formData.get("vehicle_id")` | ✅ Yes |
| `work_order_number` | `formData.get("work_order_number")` | ✅ Yes |
| `service_summary` | `formData.get("service_summary")` (free text) | ✅ Yes |
| `actual_end_at` | `formData.get("actual_end_at")` | ✅ Yes |
| `completion_report_id` | Not in `updateWorkOrder` — separate report creation | ⚠️ Indirect |
| `services_performed` (structured) | Not stored — only `service_summary` (free text) | ❌ Missing |

### 4.3 Status transition detection

`updateWorkOrder()` does not currently fetch the prior work order status before the UPDATE. To safely detect "transition to completed" (and not fire on every `updateWorkOrder` call with `status=completed`), the wiring must:

```typescript
// Proposed addition inside updateWorkOrder() before the main UPDATE:
const { data: prior } = await supabase
  .from("work_orders")
  .select("status, customer_id, vehicle_id")
  .eq("id", workOrderId)
  .eq("dealer_id", dealer.dealer_id)
  .single();

const isNewCompletion =
  prior?.status !== "completed" && status === "completed";

if (isNewCompletion && prior?.customer_id) {
  const event = await createEngagementEvent("WORK_COMPLETED", prior.customer_id, {
    work_order_id:      workOrderId,
    services_performed: [],  // Phase G-B: parse from service_summary or structured items
    completed_at:       actualEnd ?? new Date().toISOString(),
  }, { vehicle_id: prior.vehicle_id ?? undefined, job_id: workOrderId });

  if (event) await engine.dispatch(event);
}
```

**No schema change required.** The existing `work_orders` table has all needed columns.

### 4.4 Missing data to note

- `services_performed: string[]` — the `WorkCompletedPayload` expects an array of service categories, but `service_summary` is free text. Phase G-A: pass `[]`. Phase G-B: either parse `service_summary` or add a structured `services_json` column (separate migration decision).
- `completion_report_id` — the completion report is created separately. The Reputation Agent can look it up via `work_order_id` when needed.

### 4.5 No schema change required for Phase G-A wiring ✅

---

## 5. LINE Dispatch Analysis

### 5.1 Customer LINE linkage

| Store | Table | Column | Notes |
|-------|-------|--------|-------|
| LINE user ID | `line_customers` | `line_user_id` | Required for push messages |
| Customer link | `line_customers` | `customer_id` | FK to `customers` table |
| Is friend | `line_customers` | `is_friend` | Must be `true` for message delivery |
| Linked at | `line_customers` | `linked_at` | When customer linked via LIFF |

**Lookup path:** `customer_id` → `line_customers WHERE customer_id = ? AND is_friend = true` → `line_user_id`

This pattern is already implemented in `sendCompletionNotification()` and `sendMaintenanceReminder()`.

### 5.2 Dealer LINE credentials

| Credential | Store | Notes |
|------------|-------|-------|
| `line_access_token` | `dealer_settings.line_access_token` | Server-side only; never returned to client |
| `line_enabled` | `dealer_settings.line_enabled` | Must be `true` |
| `line_channel_id` | `dealer_settings.line_channel_id` | For LIFF |

All credentials are read inside `sendLineMessage()` from the server — they never come from client input.

### 5.3 Review request message path

**Phase G-A (static text, no AI):**
```typescript
await queueLineNotification({
  customer_id,
  line_customer_id: lineCustomer.id,
  scheduled_at:     new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  purpose:          "review_request",   // Already in LineMessagePurpose ✅
  title:            "レビューのお願い",
  body:             `${customer_name}様、施工ありがとうございました。\nよろしければGoogleレビューにご協力ください。\n${gbp_review_url ?? "(URL未設定)"}`,
});
```

**Phase G-B (AI-generated, with Reputation Agent):**
```typescript
await runAgentLifecycle(new ReputationAgent(), ctx, {
  agent_id:  "reputation_agent",
  task_type: "review_request_generation",
  payload: {
    customer_id, customer_name,
    job_id: work_order_id,
    platform: "google",
    review_url: dealer_settings.gbp_review_url,
    job_summary: work_order.service_summary,
  },
});
// Use result.review_request.message_text → queueLineNotification
```

### 5.4 Missing fields required

| Field | Location | Status | Required for |
|-------|----------|--------|-------------|
| `dealer_settings.gbp_review_url` | `dealer_settings` table | ❌ Missing | Review request generation |
| `dealer_settings.instagram_url` | `dealer_settings.sns_urls.instagram` | ⚠️ Check Phase 70 column | Review request fallback |

**Migration proposal for `gbp_review_url`:** see §6.3.

### 5.5 Existing LINE actions — fully ready for Phase G-A

| Action | Function | Status |
|--------|----------|--------|
| Completion notification | `sendCompletionNotification(customer_id, work_order_number, report_url)` | ✅ Ready |
| Maintenance reminder | `sendMaintenanceReminder(customer_id, booking_url)` | ✅ Ready |
| Custom text message | `sendLineTextMessage(line_user_id, text, opts)` | ✅ Ready |
| Delayed message scheduling | `queueLineNotification(input)` — supports `scheduled_at` | ✅ Ready |
| Review request (static) | `queueLineNotification({ purpose: "review_request", ... })` | ✅ Ready (static text only) |

---

## 6. Migration Proposals

**IMPORTANT: These are proposals only. Do not apply without CTO approval.**

### 6.1 `customer_engagement_history` table

```sql
-- Sprint 10G Migration Proposal — customer_engagement_history
-- ⚠️ Requires CTO approval before execution.

CREATE TABLE public.customer_engagement_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid        NOT NULL,
  customer_id     uuid        NOT NULL,
  vehicle_id      uuid,
  workflow_id     text        NOT NULL,
  trigger_event   text        NOT NULL,
  action_id       text,
  action_type     text,
  action_status   text        NOT NULL DEFAULT 'pending',
                              -- 'pending' | 'completed' | 'failed' | 'skipped'
  action_payload  jsonb       NOT NULL DEFAULT '{}',
                              -- Input config for the action (no secrets)
  result_payload  jsonb       NOT NULL DEFAULT '{}',
                              -- Output result (queue_id, message_id, agent trace_id, etc.)
  error_message   text,       -- Japanese user-readable error; null on success
  retry_count     int         NOT NULL DEFAULT 0,
  trace_id        uuid        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  executed_at     timestamptz             -- null until action completes or fails
);

-- RLS: dealers can only access their own engagement history
ALTER TABLE public.customer_engagement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dealer_isolation_engagement_history"
  ON public.customer_engagement_history
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_engagement_history_dealer_customer
  ON public.customer_engagement_history (dealer_id, customer_id);

CREATE INDEX idx_engagement_history_trace_id
  ON public.customer_engagement_history (trace_id);

CREATE INDEX idx_engagement_history_created_at
  ON public.customer_engagement_history (dealer_id, created_at DESC);
```

**Schema design notes:**
- `dealer_id` is server-injected from `EngagementContext.dealer_id` — never from client
- `action_payload` stores action config with no secrets (no LINE tokens, no API keys)
- `result_payload` stores references only (queue_id, not message body)
- RLS mirrors the pattern used across all dealer-scoped tables

### 6.2 `dealer_settings.engagement_config` column

```sql
-- Sprint 10G Migration Proposal — dealer_settings.engagement_config
-- ⚠️ Requires CTO approval before execution.

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS engagement_config jsonb NOT NULL DEFAULT '{}';

-- Column structure:
-- {
--   "welcome_flow":          { "enabled": true,  "template_id": "welcome_message_v1" },
--   "completion_flow":       { "enabled": true,  "review_delay_hours": 24 },
--   "maintenance_flow":      { "enabled": true,  "reminder_days": 30, "followup_days": 7 },
--   "review_request_flow":   { "enabled": true },
--   "campaign_flow":         { "enabled": false },
--   "ai_agents_enabled":     false,
--   "default_review_platform": "google"
-- }
```

**Notes:**
- Default `{}` means "use platform defaults" — backward compatible
- `ai_agents_enabled: false` default prevents unexpected AI dispatching before Phase G-B
- Per-dealer overrides for `review_delay_hours` (default: 24h, adjustable to 12–72h)
- No new RLS needed — inherits `dealer_settings` existing RLS

### 6.3 `dealer_settings.gbp_review_url` column

```sql
-- Sprint 10G Migration Proposal — dealer_settings.gbp_review_url
-- ⚠️ Requires CTO approval before execution.
-- Small addition — can be bundled with engagement_config migration.

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS gbp_review_url text;
  -- Google Business Profile review URL
  -- e.g. "https://search.google.com/local/writereview?placeid={place_id}"
  -- Stored as plain text; shown to dealer in LINE Settings UI
```

**Notes:**
- Required for AI-generated review request messages (Reputation Agent, Phase G-B)
- Phase G-A: static fallback text used when null
- Should be added to `DealerSettingsDB` type in `line-types.ts` when migration applies

### 6.4 `engagement_job_queue` table (Phase G-B AI delayed actions)

```sql
-- Sprint 10G Migration Proposal — engagement_job_queue
-- ⚠️ Requires CTO approval before execution.
-- Needed ONLY for delayed AI agent dispatch (delay_hours > 0, action_type = "notify_agent")
-- Phase G-A: LINE delayed actions use existing line_notification_queue

CREATE TABLE public.engagement_job_queue (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid        NOT NULL,
  customer_id     uuid        NOT NULL,
  agent_id        text        NOT NULL,
  action_type     text        NOT NULL,
  payload         jsonb       NOT NULL DEFAULT '{}',
  trace_id        uuid        NOT NULL,
  scheduled_for   timestamptz NOT NULL,
  status          text        NOT NULL DEFAULT 'scheduled',
                              -- 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled'
  attempts        int         NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.engagement_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dealer_isolation_engagement_job_queue"
  ON public.engagement_job_queue
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_engagement_job_queue_scheduled
  ON public.engagement_job_queue (status, scheduled_for)
  WHERE status = 'scheduled';
```

---

## 7. AI Agent Dispatch Design

### 7.1 notify_agent action routing

When `EngagementActionDispatcher` processes an action with `type = "notify_agent"`:

```
action.config.agent_id → lookup in AI_AGENT_REGISTRY
        │
        ▼
checkExecutionPolicy(agent_id)
  ├─ Feature gate (ai_reputation / ai_marketing / ai_growth)
  ├─ AI Gateway readiness (dealer key configured, enabled)
  ├─ getCurrentDealer() auth
  └─ Usage policy
        │
        ▼ (allowed: true)
createAgentContext(agent_id)
  → EngagementContext.dealer_id passed through
        │
        ▼
runAgentLifecycle(agent, context, input)
  → Returns AIAgentLifecycleResult
  → Sprint 10G: AIAgentNotImplementedError (expected — Phase G-B)
        │
        ▼
ActionDispatchResult { status: "failed", error: "フェーズGで実装予定" }
  → EngagementHistoryWriter.append({ status: "skipped" })
```

### 7.2 Agent subscription examples

| Trigger event | Agent | Task type | Phase |
|---------------|-------|-----------|-------|
| `WORK_COMPLETED` | `reputation_agent` | `review_request_generation` | G-B |
| `REVIEW_RECEIVED` | `reputation_agent` | `reputation_analysis` | G-B |
| `REVIEW_RECEIVED` | `marketing_agent` | `keyword_extraction` | G-B |
| `CAMPAIGN_SENT` | `growth_agent` | `reputation_analysis` | G-B |
| `CUSTOMER_CREATED` | `line_agent` | `content_writing` | G-B |

### 7.3 AI Gateway readiness — non-blocking for LINE actions

The eligibility check (`checkTriggerEligibility`) currently returns `eligible: true` even if the AI Gateway is not ready, because LINE actions (send_line_message, request_review) do not require the gateway. This is intentional:

- Phase G-A: LINE completion notification + review request work without AI Gateway
- Phase G-B: AI-generated messages replace static text when AI Gateway is ready

The `EngagementActionDispatcher` skips `notify_agent` actions when the gateway is not ready, logging `status: "skipped"` to history.

---

## 8. Settings UI Plan

### 8.1 Location

New category in the Settings screen: **エンゲージメント設定** (alongside AI設定、LINE設定).

Feature gate: `"line"` (Pro+) — visible to all Pro+ dealers.

### 8.2 Proposed sections

| Section | Fields | Feature required |
|---------|--------|-----------------|
| 完了フロー | Enable/disable; LINE notification on/off; Review request on/off; Review request delay (12h/24h/48h) | `line` |
| レビュー設定 | Google Business Profile URL; Default review platform; | `line` |
| メンテナンスリマインダー | Enable/disable; Reminder timing; Follow-up timing | `line` |
| AI エージェント連携 | Enable/disable per-agent; AI-generated messages on/off | `ai_reputation`, `ai_marketing` |
| マーケティングフロー | Enable/disable campaign flow; Marketing agent on/off | `ai_marketing` |

### 8.3 UI pattern

Follows the existing Settings screen pattern:
- Category in `SettingsCategoryNav` with badge
- Component: `EngagementSettings.tsx` (new)
- Server actions: `get-engagement-config.ts`, `save-engagement-config.ts`
- Data source: `dealer_settings.engagement_config` (migration required)

### 8.4 Implementation dependencies

1. `engagement_config` column migration (CTO approval)
2. `gbp_review_url` column migration (CTO approval)
3. Settings component + server actions (Sprint 10H candidate)

---

## 9. Pending Migrations Summary

| Migration | Tables/Columns | CTO Approval Required | Phase |
|-----------|---------------|----------------------|-------|
| `customer_engagement_history` | New table | Yes | G-B |
| `dealer_settings.engagement_config` | New column | Yes | G-B |
| `dealer_settings.gbp_review_url` | New column | Yes | G-B |
| `engagement_job_queue` | New table | Yes | G-B |
| `dealer_settings.ai_settings` | New column (Sprint 10C proposal) | Yes | G-B |
| `dealer_ai_usage_log` | New table (Sprint 10D proposal) | Yes | G-B |

**Zero migrations required for Phase G-A.** The platform delivers functional LINE engagement without any schema changes.

---

## 10. Sprint 10H Recommended Scope

Based on this analysis, Sprint 10H should implement **Phase G-A** — functional engagement without schema changes:

1. Wire `WORK_COMPLETED` event emission in `updateWorkOrder()`
2. Implement `WorkflowExecutionEngine` (no-op history writer, Phase G-A action dispatcher)
3. Wire `completion_flow`:
   - `sendCompletionNotification()` (immediate, delay 0h)
   - `queueLineNotification(purpose="review_request", +24h)` (delayed)
4. Wire `maintenance_flow`:
   - `sendMaintenanceReminder()` (immediate)
   - Scheduled follow-up (delayed, +168h)
5. Wire `welcome_flow`:
   - `sendLineTextMessage()` on CUSTOMER_CREATED
6. Add `EngagementSettings.tsx` (basic UI — enable/disable flows per dealer)

**Unblocked:** All of the above requires no CTO approval and no new migrations.

---

*GYEON Detailer Agent | Customer Engagement Runtime Plan | Office AZ | 2026-06-26*
