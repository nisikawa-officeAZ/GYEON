// GYEON Business Hub — Automation Center: Policy Registry (Sprint 12C)
//
// Governance policies for the Automation Center.
// All workflow definitions, trigger routing, and action execution must comply.
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

// ─── Policy type ───────────────────────────────────────────────────────────────

export type AutomationPolicyEnforcement = "strict" | "advisory";

export interface AutomationPolicy {
  policy_id:   string;
  title:       string;
  description: string;
  enforcement: AutomationPolicyEnforcement;
  rationale:   string;
  applies_to:  ("trigger" | "condition" | "action" | "workflow" | "execution")[];
}

// ─── Policy registry ───────────────────────────────────────────────────────────

export const AUTOMATION_POLICIES: AutomationPolicy[] = [
  {
    policy_id:   "AUT-001",
    title:       "Dealer ID From Server Only",
    description: "The dealer_id injected into the AutomationContext must always come " +
                 "from getCurrentDealer() on the server. It must never be passed from " +
                 "client input, query parameters, or user-submitted data.",
    enforcement: "strict",
    rationale:   "Multi-tenant isolation. A compromised client-supplied dealer_id would " +
                 "allow cross-tenant data access or workflow execution.",
    applies_to:  ["execution"],
  },
  {
    policy_id:   "AUT-002",
    title:       "No Execution in Sprint 12C",
    description: "No workflow step may be executed in Sprint 12C. All AutomationWorkflow " +
                 "objects have execution_deferred: true as a compile-time literal. " +
                 "The Automation Engine is not implemented until Sprint 13.",
    enforcement: "strict",
    rationale:   "Prevents accidental execution of untested workflows against real customer data. " +
                 "Foundation phase must be validated before live execution begins.",
    applies_to:  ["workflow", "execution"],
  },
  {
    policy_id:   "AUT-003",
    title:       "Customer Consent Required for AI Communication",
    description: "Actions that send AI-generated content to customers " +
                 "(generate_ai_caption → send_line_message, generate_ai_reply → any channel) " +
                 "require the customer's ai_communication_permission consent to be 'granted'. " +
                 "The action executor must verify consent before calling the AI Gateway.",
    enforcement: "strict",
    rationale:   "Customers must not receive AI-generated messages they did not consent to. " +
                 "Consent is stored in customer_communication_preferences and is set by the " +
                 "customer, not the dealer.",
    applies_to:  ["action", "execution"],
  },
  {
    policy_id:   "AUT-004",
    title:       "AI Actions Require Gateway Readiness Check",
    description: "Any action with required_ai_entitlement !== null must call " +
                 "checkAiGatewayReady() before execution. If the gateway returns any status " +
                 "other than 'ready', the AI action step must be skipped and the workflow " +
                 "must fall through to the on_failure path.",
    enforcement: "strict",
    rationale:   "Prevents API key errors and unauthorized AI inference costs. The gateway " +
                 "check validates both provider configuration and plan entitlement.",
    applies_to:  ["action", "execution"],
  },
  {
    policy_id:   "AUT-005",
    title:       "AI-Initiated Workflows Require Approval Policy",
    description: "Workflows triggered by ai_trigger or ai_insight_generated must have " +
                 "a dealer-configured approval policy. The workflow may not auto-send " +
                 "to customers without the dealer having reviewed the content unless " +
                 "the dealer has explicitly enabled autonomous mode for that workflow.",
    enforcement: "strict",
    rationale:   "Dealers must maintain control over automated outbound communication. " +
                 "AI autonomy is opt-in, not opt-out.",
    applies_to:  ["trigger", "workflow", "execution"],
  },
  {
    policy_id:   "AUT-006",
    title:       "Communication Actions Route Through Communication Center",
    description: "Actions of category 'communication' (send_line_message, send_email, etc.) " +
                 "must route through the Communication Center's channel adapter, not call " +
                 "provider SDKs directly. The automation engine must never import LINE, " +
                 "WhatsApp, or Email SDK modules.",
    enforcement: "strict",
    rationale:   "Ensures unified consent management, rate limiting, delivery tracking, " +
                 "and inbox threading through the Communication Center.",
    applies_to:  ["action", "execution"],
  },
  {
    policy_id:   "AUT-007",
    title:       "One Review Request Per Work Order",
    description: "The request_review action may only execute once per work_order_id. " +
                 "Duplicate review requests for the same job are blocked by the execution engine. " +
                 "This aligns with comm-policy COMM-006.",
    enforcement: "strict",
    rationale:   "Multiple review requests for the same job damage customer trust and " +
                 "may violate platform policies of review platforms.",
    applies_to:  ["action", "execution"],
  },
  {
    policy_id:   "AUT-008",
    title:       "Workflow Audit Log Required for All Executions",
    description: "Every workflow execution attempt (success, skip, or failure) must be " +
                 "logged with: workflow_id, trigger_id, customer_id, step results, " +
                 "timestamp, and dealer_id. Logs are immutable. " +
                 "Log schema: automation_execution_log (future migration).",
    enforcement: "advisory",
    rationale:   "Audit logs are required for debugging, compliance, and dealer transparency. " +
                 "Advisory in Sprint 12C because persistence is not yet implemented.",
    applies_to:  ["execution"],
  },
] as const satisfies AutomationPolicy[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getAutomationPolicy(policy_id: string): AutomationPolicy | undefined {
  return AUTOMATION_POLICIES.find(p => p.policy_id === policy_id);
}

export function getStrictAutomationPolicies(): AutomationPolicy[] {
  return AUTOMATION_POLICIES.filter(p => p.enforcement === "strict");
}

export function getAdvisoryAutomationPolicies(): AutomationPolicy[] {
  return AUTOMATION_POLICIES.filter(p => p.enforcement === "advisory");
}

export function getPoliciesFor(
  applies_to: AutomationPolicy["applies_to"][number],
): AutomationPolicy[] {
  return AUTOMATION_POLICIES.filter(p => p.applies_to.includes(applies_to));
}
