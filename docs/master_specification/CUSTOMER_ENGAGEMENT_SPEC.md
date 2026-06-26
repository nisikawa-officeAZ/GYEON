# Customer Engagement Platform
## GYEON Detailer Agent — Central Orchestration Layer

| Field | Value |
|-------|-------|
| **Document** | Customer Engagement Platform Specification |
| **Status** | Sprint 10F — Foundation implemented; execution engine deferred to Phase G |
| **Created** | 2026-06-26 |
| **Location** | `src/lib/customer-engagement/` |
| **Prerequisite** | AI Agent Framework (Sprint 10D), AI Reputation Agent (Sprint 10E) |

---

## 1. Purpose

The Customer Engagement Platform is the central orchestration layer that connects business events (work completed, payment received, maintenance due) to customer-facing actions (LINE messages, review requests, marketing campaigns) and AI agent workflows.

Every customer touchpoint in GYEON Detailer Agent flows through this layer.

---

## 2. Architecture Position

```
Business Layer (work orders, reservations, payments, maintenance)
        │
        │ emits EngagementEvent
        ▼
Customer Engagement Platform
  ├── Event System    — 10 canonical business events
  ├── Workflow Engine — 7 pre-defined configurable workflows
  ├── Trigger Registry — event → workflow → agent subscriber bindings
  └── Context Factory — dealer_id always from getCurrentDealer()
        │
        │ dispatches to
        ├── LINE Foundation (send_line_message, request_review)
        ├── AI Reputation Agent (reputation_agent)
        ├── AI Marketing Agent (marketing_agent) — future
        ├── AI Growth Agent (growth_agent) — future
        └── AI LINE Agent (line_agent) — future
```

---

## 3. Directory Structure

```
src/lib/customer-engagement/
├── events.ts                          — 10 event types, typed payloads, event base interface
├── types.ts                           — EngagementContext, EngagementAction, EngagementWorkflow, EngagementHistory
├── workflow.ts                        — 7 pre-defined workflows + registry functions
├── triggers.ts                        — EngagementTrigger, ENGAGEMENT_TRIGGER_REGISTRY, lookup functions
├── context.ts                         — createEngagementContext(), createEngagementEvent() (server-side)
├── check-engagement-eligibility.ts    — checkTriggerEligibility(), checkEventEligibility() (server-side)
└── index.ts                           — Public API re-exports
```

---

## 4. Event System

### 4.1 The 10 canonical events

| Event | Trigger point | Primary workflows |
|-------|--------------|-------------------|
| `CUSTOMER_CREATED` | New customer record created | `welcome_flow` |
| `VEHICLE_REGISTERED` | Customer vehicle added | — |
| `ESTIMATE_APPROVED` | Customer accepts estimate | — |
| `WORK_STARTED` | Work order begins | — |
| `WORK_COMPLETED` | Work order completed | `completion_flow` |
| `PAYMENT_COMPLETED` | Payment confirmed | `payment_flow` |
| `REVIEW_REQUESTED` | LINE review request sent | `review_request_flow` |
| `REVIEW_RECEIVED` | Customer posts review | `review_received_flow` |
| `MAINTENANCE_DUE` | Maintenance window opens | `maintenance_flow` |
| `CAMPAIGN_SENT` | Marketing campaign delivered | `campaign_flow` |

### 4.2 Event structure

```typescript
interface EngagementEvent<T extends EngagementEventType> {
  event_type:   T;
  dealer_id:    string;     // Always from getCurrentDealer() — never from client
  customer_id:  string;
  vehicle_id?:  string;
  job_id?:      string;
  payload:      EngagementEventPayloadMap[T];
  occurred_at:  string;     // ISO 8601
  trace_id:     string;     // UUID for log correlation
}
```

Events are immutable. They are never mutated after creation.

### 4.3 Event builder (server-side only)

```typescript
// Always use createEngagementEvent() — never construct manually
const event = await createEngagementEvent("WORK_COMPLETED", customer_id, {
  work_order_id: "...",
  completed_at:  new Date().toISOString(),
  services_performed: ["gyeon_coating"],
});
// event.dealer_id is from getCurrentDealer() — not from input
```

---

## 5. Workflow Engine

### 5.1 The complete customer journey

```
CUSTOMER_CREATED → welcome_flow
                       ↓ (LINE welcome message)

ESTIMATE_APPROVED → [no workflow — future]

WORK_COMPLETED → completion_flow
                       ↓ (LINE completion notification)
                       ↓ (24h delay → review request via Reputation Agent)

PAYMENT_COMPLETED → payment_flow
                       ↓ (LINE payment confirmation)

REVIEW_REQUESTED → review_request_flow
                       ↓ (Reputation Agent notified for tracking)

REVIEW_RECEIVED → review_received_flow
                       ↓ (Reputation Agent → MarketingAgentFeed → Marketing Agent)
                       ↓ (Discovery Feedback Loop)

MAINTENANCE_DUE → maintenance_flow
                       ↓ (LINE reminder)
                       ↓ (7 days → LINE follow-up)

CAMPAIGN_SENT → campaign_flow
                       ↓ (Growth Agent notified for analytics)
                       ↓ (CRM tag: "キャンペーン受信済み")
```

### 5.2 Workflow structure

Each workflow has:
- `trigger_event`: the `EngagementEventType` that fires it
- `conditions`: guard conditions (all must pass)
- `actions`: ordered list of `EngagementAction`
- `required_feature`: optional AppFeature gate

Each action has:
- `type`: `EngagementActionType` (7 types)
- `delay_hours`: wait before executing (0 = immediate)
- `config`: action-specific configuration
- `conditions`: per-action guard conditions
- `required_feature`: optional per-action gate

### 5.3 Pre-defined workflows

| Workflow ID | Trigger | Actions |
|-------------|---------|---------|
| `welcome_flow` | `CUSTOMER_CREATED` | send_line_message |
| `completion_flow` | `WORK_COMPLETED` | send_line_message + request_review (24h) + update_customer_tag |
| `payment_flow` | `PAYMENT_COMPLETED` | send_line_message |
| `review_request_flow` | `REVIEW_REQUESTED` | notify_agent (reputation_agent) |
| `review_received_flow` | `REVIEW_RECEIVED` | notify_agent (reputation_agent) + update_customer_tag |
| `maintenance_flow` | `MAINTENANCE_DUE` | send_line_message + send_line_message (168h) + update_customer_tag |
| `campaign_flow` | `CAMPAIGN_SENT` | update_customer_tag + notify_agent (growth_agent) |

---

## 6. Trigger Registry

### 6.1 Trigger structure

```typescript
interface EngagementTrigger {
  id:                  EngagementTriggerId;
  event_type:          EngagementEventType;
  workflow_id:         EngagementWorkflowId;
  conditions:          EngagementCondition[];
  required_feature?:   AppFeature;
  agent_subscribers:   AIAgentId[];   // AI agents notified when trigger fires
  enabled:             boolean;
}
```

### 6.2 Registered triggers

| Trigger ID | Event | Workflow | Agent Subscribers |
|------------|-------|----------|-------------------|
| `trigger_customer_created_welcome` | `CUSTOMER_CREATED` | `welcome_flow` | `line_agent` |
| `trigger_work_completed_completion` | `WORK_COMPLETED` | `completion_flow` | `reputation_agent`, `line_agent` |
| `trigger_payment_completed_confirmation` | `PAYMENT_COMPLETED` | `payment_flow` | `line_agent` |
| `trigger_review_requested_tracking` | `REVIEW_REQUESTED` | `review_request_flow` | `reputation_agent` |
| `trigger_review_received_feed` | `REVIEW_RECEIVED` | `review_received_flow` | `reputation_agent`, `marketing_agent` |
| `trigger_maintenance_due_reminder` | `MAINTENANCE_DUE` | `maintenance_flow` | `line_agent` |
| `trigger_campaign_sent_tracking` | `CAMPAIGN_SENT` | `campaign_flow` | `marketing_agent`, `growth_agent` |

### 6.3 Eligibility check

```typescript
const result = await checkTriggerEligibility(trigger);
// result.eligible: boolean
// result.reason:   Japanese message if not eligible
```

Checks:
1. Trigger is enabled
2. required_feature gate (Pro+ subscription)
3. AI Gateway readiness (non-blocking for non-AI actions)

---

## 7. Context Factory

```typescript
// Server-side only — createEngagementContext() guarantees dealer_id integrity
const ctx = await createEngagementContext(event);
// ctx.dealer_id === getCurrentDealer().dealer_id — always
// ctx.trace_id === crypto.randomUUID() — server-generated
```

`EngagementContext` is the single source of truth for a workflow execution. It is never constructed from client data.

---

## 8. Engagement History

`EngagementHistory` is the append-only record of all engagement actions taken for a customer.

```typescript
interface EngagementHistoryEntry {
  entry_id:    string;
  event_type:  EngagementEventType;
  workflow_id: EngagementWorkflowId;
  action_type: EngagementActionType | null;
  status:      "pending" | "completed" | "failed" | "skipped";
  trace_id:    string;
  occurred_at: string;
  result_ja?:  string;
}
```

**Persistence:** `customer_engagement_history` table — migration pending CTO approval. Sprint 10F: type contract only.

---

## 9. Integration Points

| System | Integration |
|--------|------------|
| AI Gateway | `checkAiGatewayReady()` in `check-engagement-eligibility.ts` |
| AI Agent Registry | `AIAgentId` in trigger `agent_subscribers` |
| Feature Registry | `AppFeature` gates on triggers and actions |
| LINE Foundation | `send_line_message` action type → `send-line-message.ts` (Phase G) |
| Pro+ Feature Gate | `checkFeatureAccess()` for `line`, `ai_reputation`, `ai_marketing`, etc. |

---

## 10. Future Automation (Phase G+)

When the execution engine is implemented in Phase G:

1. Work order completion fires `WORK_COMPLETED` event
2. `createEngagementEvent()` injects `dealer_id` from `getCurrentDealer()`
3. `getTriggersForEvent("WORK_COMPLETED")` returns `trigger_work_completed_completion`
4. `checkTriggerEligibility()` validates feature gates
5. `completion_flow` executes:
   - Immediately: `send_line_message` (completion notification via LINE API)
   - After 24h: `request_review` (Reputation Agent generates LINE review request)
6. History entry appended for each action
7. `REVIEW_RECEIVED` event fires when dealer confirms review
8. `trigger_review_received_feed` routes signals to `reputation_agent` and `marketing_agent`
9. Discovery Feedback Loop: `MarketingAgentFeed` enriches future content recommendations

---

## 11. Pending Migrations (CTO Approval Required)

| Migration | Purpose |
|-----------|---------|
| `customer_engagement_history` table | Persistent engagement history per customer |
| `dealer_settings.engagement_config` column | Per-dealer workflow customization |

Neither migration is applied in Sprint 10F. The platform operates with type contracts only.

---

## 12. Security Rules

1. `dealer_id` in `EngagementContext` is ONLY set via `createEngagementContext()` → `getCurrentDealer()`
2. `createEngagementEvent()` is the only safe way to emit events — it injects `dealer_id` from the dealer session
3. No workflow or trigger may read `dealer_id` from client-provided input
4. History entries use `context.dealer_id` exclusively
5. All eligibility failures return Japanese user-readable messages — no internal details

---

## 13. Sprint 10G — Runtime Architecture (2026-06-26)

**Status:** Architecture planned. Implementation deferred to Sprint 10H.

### Runtime engine location

```
src/lib/customer-engagement/engine/
└── types.ts    — WorkflowExecutionEngine, EngagementActionDispatcher, EngagementHistoryWriter,
                  EngagementFailureHandler, EngagementRetryPolicy, result types
```

### Phase G-A (zero schema changes — Sprint 10H)

The following flows are fully implementable using existing infrastructure:

| Flow | Existing function | Delivery |
|------|-------------------|---------|
| WORK_COMPLETED → LINE completion notification | `sendCompletionNotification()` | Sprint 10H |
| WORK_COMPLETED → review request (24h delay) | `queueLineNotification(purpose="review_request")` | Sprint 10H |
| MAINTENANCE_DUE → LINE reminder | `sendMaintenanceReminder()` | Sprint 10H |
| CUSTOMER_CREATED → welcome LINE message | `sendLineTextMessage()` | Sprint 10H |

**No CTO approval required for Phase G-A.**

### Phase G-B (with migrations)

Requires 4 migrations (all pending CTO approval — proposals in `CUSTOMER_ENGAGEMENT_RUNTIME_PLAN.md`):
1. `customer_engagement_history` table
2. `dealer_settings.engagement_config` column
3. `dealer_settings.gbp_review_url` column
4. `engagement_job_queue` table (for delayed AI agent dispatch)

### Key finding: `WORK_COMPLETED` canonical location

The canonical event emission point is `updateWorkOrder()` in `src/lib/work-orders/update-work-order.ts`.
Wiring requires one additional `SELECT` before the `UPDATE` to detect the `status → "completed"` transition.
No schema change required.

---

*GYEON Detailer Agent | Customer Engagement Platform | Office AZ | 2026-06-26*
