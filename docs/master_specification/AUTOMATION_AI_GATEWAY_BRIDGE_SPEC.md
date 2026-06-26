# Automation AI Gateway Bridge — Specification

**Sprint:** 12D  
**Status:** Foundation declared — execution deferred to Sprint 13  
**Module path:** `src/lib/automation/ai/`  
**Parent spec:** `AUTOMATION_CENTER_SPEC.md`

---

## Overview

The Automation AI Gateway Bridge connects the Automation Center (`src/lib/automation/`) to the AI Gateway (`src/lib/ai/`) through a typed, safe intermediary layer. It enables future automation workflows to request AI actions without directly coupling to the AI provider layer.

Sprint 12D declares the full bridge type system, registry, and policy model. No AI execution occurs in this sprint. All bridge functions return `execution_deferred: true` results.

---

## Module Structure

```
src/lib/automation/ai/
├── ai-action-types.ts        Core types: request, readiness, result
├── ai-action-registry.ts     10 AI action descriptors with agent/task mappings
├── ai-gateway-bridge.ts      Pure bridge functions (no execution)
├── approval-policy.ts        8-flag safety and approval policy per action
├── communication-flow.ts     Trigger → AI → Approval → Channel pipeline model
└── index.ts                  Sub-module barrel
```

---

## AI Action Types

`AutomationAIActionTypeId` — 10 automation-domain action types:

| Action Type ID | Category | Agent | Task Type | Entitlement |
|---|---|---|---|---|
| `generate_ai_caption` | message_draft | `marketing_agent` | `content_writing` | `communication_ai` |
| `generate_ai_reply` | message_draft | `line_agent` | `content_writing` | `communication_ai` |
| `generate_ai_summary` | summary | `growth_agent` | `reputation_analysis` | `growth_ai` |
| `generate_review_request` | message_draft | `review_agent` | `review_request_generation` | `communication_ai` |
| `generate_maintenance_message` | message_draft | `line_agent` | `content_writing` | `communication_ai` |
| `generate_sns_post` | content_generation | `marketing_agent` | `content_writing` | `marketing_ai` |
| `generate_video_storyboard` | content_generation | `marketing_agent` | `video_generation` | `video_ai` |
| `analyze_customer_inactivity` | analysis | `growth_agent` | `reputation_analysis` | `growth_ai` |
| `analyze_review_sentiment` | analysis | `reputation_agent` | `reputation_analysis` | `growth_ai` |
| `analyze_growth_opportunity` | analysis | `growth_agent` | `reputation_analysis` | `growth_ai` |

These map to **existing** `AIAgentId` (7 agents) and `AITaskType` (8 types) from `src/lib/ai/`. No new gateway types are introduced in Sprint 12D.

---

## Bridge Interface

### Core functions (`ai-gateway-bridge.ts`)

```typescript
// Agent and task type lookups
getRequiredAgentForAction(action_type_id)  → AIAgentId | null
getRequiredTaskTypeForAction(action_type_id) → AITaskType | null

// Context validation
validateAIActionContext(request)  → string[]   // missing context keys

// Payload construction (no execution)
buildGatewayPayload(request)  → AutomationAIGatewayPayload

// Readiness assessment (no async, no DB, no provider)
checkAIActionReadiness(request)  → AutomationAIReadiness

// End-to-end dry run
dryRunAIAction(request)  → AutomationAIResult
```

### Invariants

- `dryRunAIAction()` is a pure synchronous function. Zero side effects.
- `AutomationAIResult.can_execute` is always `false` (compile-time literal).
- `AutomationAIResult.content` is always `null` (no AI output in Sprint 12D).
- `AutomationAIResult.execution_deferred` is always `true` (compile-time literal).
- `AutomationAIRequest.dealer_id` must always come from `getCurrentDealer()`.

---

## Request Type

```typescript
interface AutomationAIRequest {
  ai_action_type_id:     AutomationAIActionTypeId;
  workflow_id:           AutomationWorkflowId;
  trigger_id:            AutomationTriggerId;
  step_id:               string;
  dealer_id:             string;        // Always from getCurrentDealer()
  customer_id:           string | null;
  vehicle_id:            string | null;
  work_order_id:         string | null;
  step_context:          Record<string, string>;
  orchestration_plan_id: string | null; // null in Sprint 12D
  trace_id:              string;
  requested_at:          string;        // ISO 8601
}
```

---

## Readiness Model

```typescript
type AutomationAIReadinessStatus =
  | "ready"               // All checks pass
  | "gateway_not_ready"   // Provider not configured
  | "entitlement_missing" // Plan does not include required AI entitlement
  | "consent_missing"     // Customer consent not granted
  | "context_incomplete"  // Missing required step_context keys
  | "approval_required"   // Gated on dealer approval
  | "execution_deferred"; // Sprint 12D: always returned

interface AutomationAIReadiness {
  status:                 AutomationAIReadinessStatus;
  gateway_status:         AIGatewayStatus | null;
  required_entitlement:   AIEntitlementId | null;
  missing_context_fields: string[];
  requires_approval:      boolean;
  can_execute:            false;     // Compile-time literal
  deferred_until:         string;
}
```

---

## Approval Policy

Each action type has an `AutomationAIApprovalProfile` with 8 flags:

| Flag | Meaning |
|---|---|
| `requires_dealer_approval` | Dealer must approve before dispatch |
| `internal_only` | Never sent to customers |
| `customer_facing` | Output may reach the customer |
| `marketing_content` | Classified as marketing (PIPA/GDPR) |
| `review_compliance_required` | Must comply with review platform policies |
| `sensitive_data_guard` | PII in prompt — extra validation required |
| `provider_readiness_required` | Must check gateway before execution |
| `budget_check_required` | Check AI usage budget before execution |

Actions requiring dealer approval (6/10): `generate_ai_caption`, `generate_ai_reply`, `generate_review_request`, `generate_sns_post`, `generate_video_storyboard`.

Actions with sensitive data guard (4/10): `generate_ai_caption`, `generate_ai_reply`, `generate_maintenance_message`, `analyze_customer_inactivity`.

---

## Communication Flow Pipeline

Full pipeline (Sprint 13):

```
Automation Trigger
      ↓
AI Draft (AI Gateway Bridge → AI Gateway → Agent)
      ↓
Dealer Approval Gate
      ↓
Communication Center (channel adapter routing)
      ↓
LINE / WhatsApp / Email / SMS / (SNS: dealer posts manually)
```

Four flow types:

| Flow Type | AI Actions | Channels | Requires Consent | Requires Approval |
|---|---|---|---|---|
| `message_draft` | caption, reply, maintenance | LINE, WhatsApp, Email, SMS | Yes | Yes |
| `review_request` | review_request | LINE, Email | No | Yes |
| `marketing_post` | sns_post, video_storyboard | None (dealer posts manually) | No | Yes |
| `internal_only` | summary, all analysis types | None | No | No |

**Key rule:** The platform never auto-publishes to SNS or auto-dispatches customer messages. All customer-facing dispatch goes through the Communication Center only after dealer approval.

---

## Dependency Direction

```
src/lib/automation/ai/
    → src/lib/ai/
    → src/lib/ai-orchestrator/
    → src/lib/communication/
    → src/lib/subscription/
```

The modules above must NOT import from `src/lib/automation/ai/`. The dependency is one-way.

---

## Security Constraints

- `dealer_id` always from `getCurrentDealer()` — never from client input, URL, or query parameters.
- No AI provider SDK imports anywhere in this module.
- No real AI execution in Sprint 12D.
- No fake AI output — `content: null` always.
- No message sending — Communication Center dispatch is deferred.
- No schema changes — bridge is pure TypeScript types and constants.
- No migrations.

---

## Sprint 13 Wiring Plan

In Sprint 13, `dryRunAIAction()` will be superseded by a `executeAIAction()` server action that:

1. Calls `checkAiGatewayReady()` from `src/lib/ai/check-ai-gateway.ts`
2. Calls `planHasAIEntitlement()` from `src/lib/subscription/`
3. For customer-facing actions: verifies `ai_communication_permission` consent
4. Calls `buildGatewayPayload()` (from this module, unchanged)
5. Dispatches to `AIProviderAdapter.generateText()` via AI Gateway
6. For `requires_dealer_approval: true`: stores draft, notifies dealer via approval queue
7. After approval: forwards to Communication Center for channel dispatch

The bridge functions in Sprint 12D (`buildGatewayPayload`, `validateAIActionContext`, `checkAIActionReadiness`) are designed to be called unchanged in Sprint 13.

---

## Related Specifications

- `AUTOMATION_CENTER_SPEC.md` — Parent specification (Sprint 12C)
- `AI_AGENT_FRAMEWORK.md` — AI agent system architecture
- `AI_CONTENT_AUTOMATION_SPEC.md` — Content automation use cases
- `src/lib/ai/types.ts` — AITaskType, AITextRequest (gateway contracts)
- `src/lib/ai/agents/types.ts` — AIAgentId, AIAgent interface
- `src/lib/ai/ai-settings-types.ts` — AIGatewayStatus, AIGatewayReadiness
- `src/lib/automation/automation-policy.ts` — AUT-003 through AUT-007 (policy enforcement)
