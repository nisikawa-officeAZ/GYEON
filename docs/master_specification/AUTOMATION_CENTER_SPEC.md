# GYEON Business Hub — Automation Center Specification

**Version**: 1.0.0 — Sprint 12C  
**Status**: Foundation implemented — execution deferred to Sprint 13  
**Last Updated**: 2026-06-26

---

## 1. Purpose

The Automation Center is the platform-level workflow engine shared by all GYEON Business Hub applications. It provides a declarative, trigger-condition-action model for automating customer communication, staff operations, CRM updates, and AI content generation.

---

## 2. Architecture Position

```
Customer Engagement Platform (CE events)
  └── EngagementEventType → AutomationTriggerId mapping
Scheduler (Sprint 13+)
  └── birthday, inactivity, invoice overdue → AutomationTriggerId
AI Insights Module
  └── ai_insight_generated → AutomationTriggerId
Dealer UI — Manual Trigger (Sprint 13+)
  └── dealer action → manual_trigger

All sources
  └── AutomationContext (dealer_id from getCurrentDealer())
      └── Automation Engine (Sprint 13+)
              ├── checkAiGatewayReady() — for AI actions
              ├── planHasAIEntitlement() — for entitlement gate
              ├── Communication Center adapter — for send_* actions
              └── CRM / task system — for staff actions
```

### Relationship to `src/lib/line-automation/`

`line-automation` (Sprint 11G) is a LINE-channel-specific implementation that handles workflow dispatch for LINE messages. In Sprint 12C:
- Automation Center and line-automation are parallel, independent modules.
- Automation Center does NOT import from line-automation.
- In Sprint 13, line-automation channel adapters will forward to Automation Center.

---

## 3. Module Structure

```
src/lib/automation/
├── automation-types.ts       Core domain type definitions
├── trigger-registry.ts       21 trigger types with metadata
├── action-registry.ts        15 action types with metadata
├── workflow-templates.ts     13 workflow templates
├── automation-policy.ts      AUT-001 through AUT-008 governance policies
├── platform-core-bridge.ts   Platform integration mapping
└── index.ts                  Package barrel
```

---

## 4. Core Type: AutomationWorkflow

```typescript
interface AutomationWorkflow {
  id:                       AutomationWorkflowId;
  version:                  number;
  display_name:             string;
  description:              string;
  category:                 AutomationWorkflowCategory;
  trigger:                  AutomationTriggerDescriptor;
  steps:                    AutomationStep[];
  required_channels:        CommunicationChannelId[];
  required_applications:    PlatformApplicationId[];
  required_ai_entitlement:  AIEntitlementId | null;
  analytics_metric_groups:  AnalyticsMetricGroupId[];
  status:                   AutomationWorkflowStatus;
  execution_deferred:       true;  // Always true in Sprint 12C
}
```

### AutomationWorkflowStatus

| Status | Meaning |
|---|---|
| `template` | Uninstantiated — all WORKFLOW_TEMPLATES entries |
| `draft` | Dealer is editing, not yet active |
| `active` | Running — fires on trigger |
| `paused` | Temporarily suspended |
| `archived` | No longer in use |

### AutomationStep types

| Type | Purpose |
|---|---|
| `trigger` | Entry point — exactly one per workflow |
| `condition` | Branch on a condition check |
| `delay` | Wait before proceeding |
| `action` | Execute a single action |
| `parallel_actions` | Execute multiple actions simultaneously |
| `end` | Terminal step |

---

## 5. Trigger Registry (21 triggers)

### CE-mapped triggers (10) — mirror EngagementEventType

| Trigger ID | CE Event | Available |
|---|---|---|
| `customer_created` | `CUSTOMER_CREATED` | Yes |
| `vehicle_registered` | `VEHICLE_REGISTERED` | Yes |
| `estimate_approved` | `ESTIMATE_APPROVED` | Yes |
| `work_started` | `WORK_STARTED` | Yes |
| `work_completed` | `WORK_COMPLETED` | Yes |
| `payment_completed` | `PAYMENT_COMPLETED` | Yes |
| `review_requested` | `REVIEW_REQUESTED` | Yes |
| `review_received` | `REVIEW_RECEIVED` | Yes |
| `maintenance_due` | `MAINTENANCE_DUE` | Yes |
| `campaign_sent` | `CAMPAIGN_SENT` | Yes |

### Extended triggers (9) — scheduler, system, or AI

| Trigger ID | Source | Available |
|---|---|---|
| `estimate_created` | system | Planned (Sprint 13+) |
| `invoice_overdue` | scheduler | Planned (Sprint 13+) |
| `customer_birthday` | scheduler | Planned (Sprint 13+) |
| `review_missing` | system | Planned (Sprint 13+) |
| `new_lead` | system | Planned (Sprint 13+) |
| `customer_inactive` | scheduler | Planned (Sprint 13+) |
| `reservation_created` | system | Planned (Sprint 13+) |
| `reservation_reminder` | scheduler | Planned (Sprint 13+) |
| `ai_insight_generated` | ai_agent | Planned (Sprint 12D+) |

### Control triggers (2)

| Trigger ID | Source | Available |
|---|---|---|
| `manual_trigger` | dealer_manual | Planned (Sprint 13+ UI) |
| `ai_trigger` | ai_agent | Planned (Sprint 12D+) |

---

## 6. Action Registry (15 actions)

### Communication actions (6)

| Action ID | Channel | Available | AI Entitlement |
|---|---|---|---|
| `send_line_message` | line | Yes (Sprint 11G) | None |
| `send_whatsapp_message` | whatsapp | Planned | None |
| `send_email` | email | Planned | None |
| `send_sms` | sms | Planned | None |
| `send_to_channel` | dynamic | Planned | None |
| `request_review` | dynamic | Yes (Sprint 11G) | None |

### Staff actions (4)

| Action ID | Available |
|---|---|
| `create_task` | Planned (Sprint 13+) |
| `create_reminder` | Planned (Sprint 13+) |
| `notify_staff` | Planned (Sprint 13+) |
| `create_internal_note` | Planned (Sprint 13+) |

### CRM actions (2)

| Action ID | Available |
|---|---|
| `update_crm_tag` | Planned (Sprint 13+) |
| `schedule_reservation` | Planned (Sprint 13+) |

### AI content actions (3) — require AI Gateway

| Action ID | Required Entitlement | Available |
|---|---|---|
| `generate_ai_caption` | `communication_ai` | Planned (Sprint 12D+) |
| `generate_ai_video` | `video_ai` | Planned (Sprint 13+) |
| `generate_ai_reply` | `communication_ai` | Planned (Sprint 12D+) |
| `generate_ai_summary` | `growth_ai` | Planned (Sprint 12D+) |

---

## 7. Workflow Templates (13 templates)

| ID | Category | Trigger | AI Required | Target Sprint |
|---|---|---|---|---|
| `maintenance_reminder` | maintenance | `maintenance_due` | No | Sprint 13 |
| `review_campaign` | review_management | `work_completed` | No | Sprint 13 |
| `revisit_campaign` | retention | `customer_inactive` | `communication_ai` | Sprint 13 |
| `birthday_greeting` | retention | `customer_birthday` | No | Sprint 13 |
| `new_customer_welcome` | acquisition | `customer_created` | No | Sprint 13 |
| `vip_follow_up` | retention | `payment_completed` | No | Sprint 13 |
| `inactive_customer_recovery` | retention | `customer_inactive` | `communication_ai` | Sprint 13 |
| `estimate_follow_up` | communication | `estimate_created` | No | Sprint 13 |
| `invoice_overdue_notice` | revenue | `invoice_overdue` | No | Sprint 13 |
| `work_completed_follow_up` | communication | `work_completed` | No | Sprint 13 |
| `reservation_confirmation` | communication | `reservation_created` | No | Sprint 13 |
| `reservation_reminder` | communication | `reservation_reminder` | No | Sprint 13 |
| `ai_insight_action` | ai_powered | `ai_insight_generated` | `growth_ai` | Sprint 12D |

---

## 8. Governance Policies

| Policy | Title | Enforcement |
|---|---|---|
| AUT-001 | Dealer ID From Server Only | Strict |
| AUT-002 | No Execution in Sprint 12C | Strict |
| AUT-003 | Customer Consent for AI Communication | Strict |
| AUT-004 | AI Actions Require Gateway Readiness Check | Strict |
| AUT-005 | AI-Initiated Workflows Require Approval Policy | Strict |
| AUT-006 | Communication Actions Route Through Communication Center | Strict |
| AUT-007 | One Review Request Per Work Order | Strict |
| AUT-008 | Workflow Audit Log Required for All Executions | Advisory |

---

## 9. Platform Integration

### Communication Center

All `send_*` and `request_review` actions route through Communication Center channel adapters. Automation Center does not call channel SDKs directly. The `ACTION_CHANNEL_MAP` in `platform-core-bridge.ts` maps each action to the correct channel.

### AI Gateway

AI actions (`generate_ai_*`) call `checkAiGatewayReady()` before execution. If the gateway is not ready, the action falls through to its `on_failure` path. The `ACTION_AI_ENTITLEMENT_MAP` maps actions to required entitlements for plan gating.

### Analytics Center

The `AUTOMATION_ANALYTICS_IMPACT` map in `platform-core-bridge.ts` declares which metric groups each workflow affects. Used by the analytics execution layer (Sprint 13) to route events.

### AI Insights

The `ai_insight_generated` trigger connects the AI Insights module to the Automation Center. When the AI Insights module emits an actionable insight, the `ai_insight_action` workflow fires. Requires `growth_ai` entitlement.

### Subscription Center

The `WORKFLOW_CATEGORY_ENTITLEMENT` map in `platform-core-bridge.ts` documents minimum AI entitlements per workflow category. The `ACTION_AI_ENTITLEMENT_MAP` is used by the engine at execution time via `planHasAIEntitlement()`.

---

## 10. Future Visual Builder (Phase F)

### Planned architecture (Sprint 14+)

```
/automation/builder         Visual drag-and-drop workflow editor
├── TriggerPicker           Select trigger type from registry
├── ConditionBuilder        Add branch conditions
├── ActionCard              Configure action parameters
├── DelayBlock              Set timing for delays
└── WorkflowCanvas          Drag-and-drop canvas (React Flow)
```

### Builder constraints
- Only triggers marked `available: true` can be activated immediately.
- Planned triggers show "coming soon" badges in the picker.
- AI actions show entitlement badges — upgrade prompt if not entitled.
- Parallel action blocks shown side-by-side in the canvas.
- Template library allows one-click installation of WORKFLOW_TEMPLATES.

---

## 11. Execution Engine (Sprint 13+)

### Planned execution flow

```
1. Trigger received (CE event, scheduler, or manual)
2. AutomationContext built (dealer_id from getCurrentDealer())
3. Entry conditions evaluated
4. Steps executed in order
   a. delay: scheduler job created for future step
   b. condition: evaluate → route to on_success or on_failure
   c. action: execute via appropriate adapter
      - Communication → Communication Center adapter
      - Staff ops → task / notification system
      - CRM → CRM module
      - AI → AI Gateway (after checkAiGatewayReady())
5. AutomationExecutionResult recorded in audit log
```

### Key invariants for the engine
- dealer_id: always from getCurrentDealer()
- AI execution: always after checkAiGatewayReady() + planHasAIEntitlement()
- AI communication consent: always verified before send
- Review requests: one per work_order_id (AUT-007 / COMM-006)

---

## 12. Remaining Work Before Sprint 13

| Item | Notes |
|---|---|
| Automation Engine | Execute workflows against real data |
| Scheduler integration | Wire birthday, inactivity, invoice overdue triggers |
| Communication Center adapter bridge | Forward send_* actions to channel adapters |
| Task / reminder system | Implement create_task, create_reminder actions |
| Dealer UI — workflow list | Show installed workflows in settings |
| Dealer UI — workflow toggle | Enable/pause/archive workflows |
| Execution audit log | automation_execution_log Supabase table (requires CTO migration approval) |
| Visual builder | Drag-and-drop canvas (Sprint 14+) |
| AI trigger wiring | Connect ai_insight_generated to Automation Engine (Sprint 12D) |
| Custom workflow support | Allow dealers to create workflows from scratch |
