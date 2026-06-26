# LINE Automation Platform Specification
## GYEON Detailer Agent — Sprint 11G

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Foundation Complete — Dispatch Deferred |
| **Sprint** | 11G |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/line-automation/` |
| **Dispatch Status** | Deferred — Phase 11H+ |
| **AI Execution Status** | Deferred — Phase 11H+ |

---

## §1 — Overview

The LINE Automation Platform is the canonical automation layer for all LINE messaging workflows in GYEON Detailer Agent. It defines a structured, policy-governed execution model for sending LINE messages to customers at the right moment in the customer lifecycle.

### Key design decisions

- **dispatch_deferred: true** — No real LINE messages are sent in Sprint 11G. All execution plans are dry-run only. Real dispatch requires Phase 11H+ (LINE Messaging API adapter).
- **ai_deferred: true** — No real AI inference is triggered in Sprint 11G. AI integration specs describe what WILL happen; execution is Phase 11H+.
- **dealer_id always from getCurrentDealer()** — Never from client input, URL parameters, or local state. Enforced in every server-side function.
- **Policy-first** — Every workflow has a default policy that governs approval mode, compliance requirements, cooldown windows, and rate limits.
- **Provider-agnostic AI** — All AI calls go through the AI Gateway. The platform declares WHAT it needs (agent ID, task type, language) — not which LLM provider.

---

## §2 — Architecture

```
Customer Event (CE Platform)
         │
         ▼
LineAutomationTrigger
  ├── CE_EVENT_TO_TRIGGER (WORK_COMPLETED, MAINTENANCE_DUE, PAYMENT_COMPLETED)
  └── Future: RESERVATION_*, ESTIMATE_EXPIRED, CUSTOMER_BIRTHDAY, AI_TRIGGER
         │
         ▼
LINE_TRIGGER_WORKFLOW_MAP
  └── Resolves trigger → [workflow_id[]]
         │
         ▼
LineAutomationContext (built server-side)
  ├── dealer_id from getCurrentDealer()
  ├── customer_id, line_user_id
  ├── trigger, required_features
  └── prepared_at
         │
         ▼
LineAutomationPolicy (from DEFAULT_WORKFLOW_POLICIES)
  ├── approval_mode: automatic | dealer_approval | manager_approval | disabled
  ├── compliance_required
  ├── cooldown_hours
  └── enabled
         │
         ▼
LineAutomationApprovalGate (buildApprovalGate)
  └── gate_open: true | false
         │
         ▼
LineAutomationExecutionPlan
  ├── actions: LineAutomationAction[]
  ├── estimated_message (deterministic preview when available)
  ├── approval_required
  ├── ai_plan_summary (null if no AI needed)
  ├── schedule (null if event-driven)
  └── dispatch_deferred: true
         │
         ▼
LineAutomationResult
  ├── state: LineAutomationExecutionState
  ├── actions_planned
  ├── blocking_reasons
  ├── dispatch_deferred: true  ← literal type
  └── ai_deferred: true        ← literal type
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `line-automation-types.ts` | A | Core domain types: WorkflowId, TriggerType, ActionType, ExecutionState, Context, Result, Schedule, Approval, ExecutionPlan |
| `workflow-registry.ts` | B | WORKFLOW_REGISTRY (10 workflows), getWorkflowEntry, getEnabledWorkflows |
| `trigger-model.ts` | C | CE_EVENT_TO_TRIGGER, LINE_TRIGGER_WORKFLOW_MAP, lineAutomationTriggerFromCEEvent |
| `line-automation-policy.ts` | D | LineAutomationApprovalMode, DEFAULT_WORKFLOW_POLICIES (10), buildApprovalGate |
| `ai-integration.ts` | E | LINE_AI_INTEGRATION_REGISTRY, LineAutomationAIPlan (deferred), buildAIPlan |
| `rich-menu-compat.ts` | F | RICH_MENU_BUTTON_REGISTRY (8 buttons), getRichMenuButton, getRichMenuButtonsForWorkflow |
| `index.ts` | — | Public barrel export |

---

## §4 — Workflow Registry

All 10 workflows with their triggers, features, and implementation status:

| Workflow ID | Label | Triggers | Required Features | AI | Status |
|-------------|-------|----------|-------------------|----|--------|
| `review_request` | Review Request | WORK_COMPLETED, MANUAL | line, ai_reputation | No | Partial (UI done, dispatch deferred) |
| `maintenance_reminder` | Maintenance Reminder | MAINTENANCE_DUE, MANUAL | line, maintenance | No | Complete (Phase 47) |
| `reservation_confirmation` | Reservation Confirmation | RESERVATION_CREATED | line, reservations | No | Planned (Sprint 11H+) |
| `reservation_reminder` | Reservation Reminder | RESERVATION_TOMORROW | line, reservations | No | Planned (Sprint 11H+) |
| `estimate_followup` | Estimate Follow-up | ESTIMATE_EXPIRED, MANUAL | line, estimates | marketing_agent | Planned (Sprint 11H+) |
| `invoice_notification` | Invoice Notification | PAYMENT_COMPLETED | line, invoices, payments | No | Planned (Sprint 11H+) |
| `campaign_delivery` | Campaign Delivery | WORK_COMPLETED, MANUAL, AI | line, ai_marketing | marketing_agent | Planned (Sprint 11H+) |
| `birthday_message` | Birthday Message | CUSTOMER_BIRTHDAY | line | No | Planned (Sprint 11H+) |
| `inspection_reminder` | Inspection Reminder | MAINTENANCE_DUE | line, maintenance | No | Planned (Sprint 11H+) |
| `custom_workflow` | Custom Workflow | MANUAL, AI | line, ai_gateway | line_agent | Planned (Sprint 11H+) |

---

## §5 — Trigger Model

### CE Event → Automation Trigger Mapping

| EngagementEventType | LineAutomationTriggerType | Available |
|--------------------|--------------------------|-----------|
| WORK_COMPLETED | WORK_COMPLETED | Yes (Sprint 11E) |
| MAINTENANCE_DUE | MAINTENANCE_DUE | Yes (Phase 47) |
| PAYMENT_COMPLETED | PAYMENT_COMPLETED | Yes (Phase 58) |
| (none — reservations table) | RESERVATION_CREATED | Sprint 11H+ |
| (none — reservations table) | RESERVATION_TOMORROW | Sprint 11H+ |
| (none — estimates table) | ESTIMATE_EXPIRED | Sprint 11H+ |
| (none — customer dob field) | CUSTOMER_BIRTHDAY | Sprint 11H+ |
| (dealer action) | MANUAL_TRIGGER | Sprint 11G |
| (AI agent decision) | AI_TRIGGER | Sprint 11H+ |

### Trigger → Workflow Routing

| Trigger | Workflows Activated |
|---------|---------------------|
| WORK_COMPLETED | review_request |
| MAINTENANCE_DUE | maintenance_reminder, inspection_reminder |
| RESERVATION_CREATED | reservation_confirmation |
| RESERVATION_TOMORROW | reservation_reminder |
| ESTIMATE_EXPIRED | estimate_followup |
| PAYMENT_COMPLETED | invoice_notification |
| CUSTOMER_BIRTHDAY | birthday_message |
| MANUAL_TRIGGER | review_request, maintenance_reminder, reservation_confirmation, estimate_followup, campaign_delivery, custom_workflow |
| AI_TRIGGER | review_request, campaign_delivery, birthday_message, custom_workflow |

---

## §6 — Approval Model

### LineAutomationApprovalMode values

| Mode | Description | Workflows |
|------|-------------|-----------|
| `automatic` | Dispatch immediately after trigger | maintenance_reminder, reservation_confirmation, reservation_reminder, invoice_notification, birthday_message, inspection_reminder |
| `dealer_approval` | Dealer must approve in UI before dispatch | review_request, estimate_followup, custom_workflow |
| `manager_approval` | Escalated — requires manager role | campaign_delivery |
| `disabled` | Workflow is off — no dispatches | (none by default; policy override available) |

### Approval Gate

`buildApprovalGate(policy, approval)` is a pure function — no DB calls. The caller is responsible for fetching any stored `LineAutomationApproval` record before calling.

Gate is **open** when:
- mode is `automatic` (always open)
- mode is `dealer_approval` or `manager_approval` AND a valid, non-expired `LineAutomationApproval` record exists

Gate is **closed** when:
- mode is `disabled`
- mode is `dealer_approval`/`manager_approval` AND no approval exists
- Approval exists but `expires_at` has passed

---

## §7 — Policy Defaults

Key policy values for each workflow:

| Workflow | Approval Mode | Compliance | Cooldown | Enabled |
|----------|---------------|------------|----------|---------|
| review_request | dealer_approval | Yes | 720h (30d) | false (dispatch deferred) |
| maintenance_reminder | automatic | No | 168h (7d) | **true** |
| reservation_confirmation | automatic | No | 1h | false |
| reservation_reminder | automatic | No | 24h | false |
| estimate_followup | dealer_approval | No | 72h (3d) | false |
| invoice_notification | automatic | No | 0h (transactional) | false |
| campaign_delivery | manager_approval | Yes | 720h (30d) | false |
| birthday_message | automatic | No | 8760h (365d) | false |
| inspection_reminder | automatic | No | 168h (7d) | false |
| custom_workflow | dealer_approval | Yes | 24h | false |

Only `maintenance_reminder` has `enabled: true` in Sprint 11G — it was fully implemented in Phase 47. All others are disabled until LINE dispatch is wired in Phase 11H+.

---

## §8 — AI Integration

### Workflows that use AI (Phase 11H+)

| Workflow | Agent | Task | Review Required |
|----------|-------|------|-----------------|
| estimate_followup | marketing_agent | content_writing | Yes — dealer reviews before send |
| campaign_delivery | marketing_agent | content_writing | Yes — manager must approve |
| custom_workflow | line_agent | content_writing | Yes — dealer reviews before send |

### Workflows using deterministic builders (no AI)

| Workflow | Builder |
|----------|---------|
| review_request | `buildReviewLineMessage()` from Sprint 11F |
| maintenance_reminder | Fixed template |
| reservation_confirmation | Fixed confirmation template |
| reservation_reminder | Fixed reminder template |
| invoice_notification | Fixed invoice template |
| birthday_message | Fixed birthday template |
| inspection_reminder | Fixed inspection template |

### LineAutomationAIPlan

`buildAIPlan(workflowId, now)` creates a deferred plan:
- Returns `null` for non-AI workflows
- `execution_deferred: true` — literal type, always set in Sprint 11G
- `estimated_output: null` — no AI inference is triggered

---

## §9 — Rich Menu Compatibility

8 button types mapping to LINE automation workflows or LIFF screens:

| Button | Label (JP) | Action | Workflow | Status |
|--------|-----------|--------|----------|--------|
| maintenance | メンテナンス | open_liff_url | — | Planned |
| reservation | ご予約 | open_liff_url | — | Planned |
| review | 口コミを書く | trigger_workflow | review_request | Partial |
| estimate | お見積り | open_liff_url | — | Planned |
| campaign | キャンペーン | open_liff_url | — | Planned |
| ai_chat | AIチャット | open_liff_url | — | Planned |
| customer_gallery | マイギャラリー | open_liff_url | — | Planned |
| before_after_gallery | ビフォーアフター | open_liff_url | — | Planned |

`rich_menu_api_deferred: true` is set on all buttons. LINE Rich Menu API integration (createRichMenu, setRichMenuToUser) requires Phase 11H+.

---

## §10 — LineAutomationExecutionState Reference

| State | Description |
|-------|-------------|
| `dry_run` | All checks passed; execution deferred to Phase 11H+ |
| `blocked_no_line_link` | Customer is not linked to LINE |
| `blocked_no_approval` | Dealer/manager approval required but not given |
| `blocked_disabled` | Workflow is disabled in policy |
| `blocked_compliance` | A compliance rule blocked execution |
| `blocked_ai_unavailable` | AI agent required but AI Gateway is not ready |
| `deferred_ai` | AI step cannot execute; rest of workflow deferred |
| `deferred_dispatch` | LINE dispatch layer not yet implemented |
| `error` | System error during preparation |

---

## §11 — Security Constraints

All security constraints from the master specification apply:

1. **dealer_id**: Always from `getCurrentDealer()` in `LineAutomationContext`. Never from client input, URL parameters, or form data.
2. **LINE secrets**: `line_channel_secret` and `line_access_token` are never returned to client-side code. The LINE dispatch adapter (Phase 11H+) must read secrets server-side only.
3. **RLS**: Not weakened. All Supabase queries scoped by both `id` AND `dealer_id`.
4. **No schema changes without CTO approval**: The `LineAutomationApproval` persistence table requires CTO approval before migration is created.
5. **Compliance gate**: Workflows with `compliance_required: true` must pass message validation before dispatch is allowed.

---

## §12 — Phase Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| Sprint 11E | Review Request Approval UI | Complete |
| Sprint 11F | Review LINE Message Builder | Complete |
| **Sprint 11G** | **LINE Automation Platform Foundation** | **Complete (this document)** |
| Sprint 11H | LINE Messaging API Adapter — real dispatch | Planned |
| Sprint 11H | Reservation trigger integration | Planned |
| Sprint 11H | Estimate expiry scheduler | Planned |
| Sprint 11H | approval_log DB table (CTO approval required) | Planned |
| Sprint 11I | AI-powered workflow execution (via AI Gateway) | Planned |
| Sprint 11J | LIFF customer-facing app (screens for all buttons) | Planned |
| Sprint 11K | Rich Menu API integration | Planned |

---

## §13 — Implementation Notes

### dispatch_deferred: true as a literal type

`LineAutomationResult.dispatch_deferred` and `LineAutomationExecutionPlan.dispatch_deferred` are typed as the literal `true`, not `boolean`. This prevents any code path from accidentally treating dispatch as possible in Sprint 11G. TypeScript will error if an assignment attempts `dispatch_deferred: false`.

### ai_deferred: true as a literal type

Same pattern: `LineAutomationResult.ai_deferred` is `true` (literal), not `boolean`. Prevents AI execution from being triggered before the Phase 11H+ AI Gateway integration.

### Pure modules

All Sprint 11G modules are pure TypeScript — no `"use server"`, no async, no DB calls, no external network calls. They can be imported freely from both server and client contexts.

### Adding a new workflow

1. Add workflow ID to `LineAutomationWorkflowId` in `line-automation-types.ts`
2. Add entry to `WORKFLOW_REGISTRY` in `workflow-registry.ts`
3. Add trigger mapping in `LINE_TRIGGER_WORKFLOW_MAP` in `trigger-model.ts`
4. Add default policy in `DEFAULT_WORKFLOW_POLICIES` in `line-automation-policy.ts`
5. Add AI integration spec in `LINE_AI_INTEGRATION_REGISTRY` in `ai-integration.ts`
6. Export from `index.ts` if new types are added
