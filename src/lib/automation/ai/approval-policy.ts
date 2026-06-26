// GYEON Business Hub — Automation AI Gateway Bridge: Approval Policy (Sprint 12D)
//
// Safety and approval policy metadata for all AI automation actions (Phase F).
//
// Each AutomationAIActionTypeId has an associated AutomationAIApprovalProfile that
// declares 8 safety and approval flags. These flags are used by:
//   - The approval gate in the Automation Engine (Sprint 13)
//   - The Communication Center before dispatching AI-generated content
//   - The dashboard to show dealers what requires their review
//
// Flag semantics:
//   requires_dealer_approval    — Dealer must explicitly approve before dispatch
//   internal_only               — Output is never sent to customers directly
//   customer_facing             — Output reaches the customer (requires consent check)
//   marketing_content           — Classified as marketing — GDPR/PIPA implications
//   review_compliance_required  — Must comply with review platform policies (AUT-007)
//   sensitive_data_guard        — Involves PII — extra validation before prompt construction
//   provider_readiness_required — Must call checkAiGatewayReady() before execution
//   budget_check_required       — Check AI usage budget before execution
//
// None of these flags are enforced at runtime in Sprint 12D.
// Runtime enforcement is implemented in Sprint 13 via the Automation Engine.
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type { AutomationAIActionTypeId } from "./ai-action-types";

// ─── Policy type ───────────────────────────────────────────────────────────────

export interface AutomationAIApprovalProfile {
  action_type_id:              AutomationAIActionTypeId;
  requires_dealer_approval:    boolean;
  internal_only:               boolean;
  customer_facing:             boolean;
  marketing_content:           boolean;
  review_compliance_required:  boolean;
  sensitive_data_guard:        boolean;
  provider_readiness_required: boolean;
  budget_check_required:       boolean;
  /** Summary of why this profile has its flags set. */
  rationale:                   string;
}

// ─── Policy registry ───────────────────────────────────────────────────────────

export const AUTOMATION_AI_APPROVAL_POLICIES: AutomationAIApprovalProfile[] = [
  {
    action_type_id:              "generate_ai_caption",
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           true,
    review_compliance_required:  false,
    sensitive_data_guard:        true,
    provider_readiness_required: true,
    budget_check_required:       true,
    rationale:
      "Generates customer-facing marketing messages. Dealer approval ensures " +
      "brand voice consistency and prevents unsolicited or inappropriate content. " +
      "Customer name and context are in the prompt — requires sensitive data guard.",
  },
  {
    action_type_id:              "generate_ai_reply",
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        true,
    provider_readiness_required: true,
    budget_check_required:       true,
    rationale:
      "Drafts replies to inbound customer messages. Customer consent " +
      "(ai_communication_permission) is required. Dealer must approve — " +
      "auto-replying to customers without review violates AUT-005.",
  },
  {
    action_type_id:              "generate_ai_summary",
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    rationale:
      "Internal business summary — shown on owner dashboard only. " +
      "No customer data in the prompt. No customer-facing dispatch. " +
      "No approval needed — equivalent to a report generation.",
  },
  {
    action_type_id:              "generate_review_request",
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           false,
    review_compliance_required:  true,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       false,
    rationale:
      "Review requests are highly regulated by Google and Apple policies. " +
      "Must be neutral tone, no incentivization. Dealer approval ensures " +
      "compliance before sending. AUT-007 (one per work order) enforced at execution.",
  },
  {
    action_type_id:              "generate_maintenance_message",
    requires_dealer_approval:    false,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        true,
    provider_readiness_required: true,
    budget_check_required:       false,
    rationale:
      "Maintenance reminders are service-oriented, not marketing. " +
      "Low-risk approval waiver since content is constrained by template context. " +
      "Vehicle and service data in prompt — sensitive data guard required.",
  },
  {
    action_type_id:              "generate_sns_post",
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           true,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    rationale:
      "SNS posts are public marketing content. Dealer must review and post manually " +
      "— the platform never auto-publishes. Classified as marketing for PIPA/GDPR " +
      "content tracking purposes.",
  },
  {
    action_type_id:              "generate_video_storyboard",
    requires_dealer_approval:    true,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           true,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    rationale:
      "Storyboard is internal — the resulting video is the customer-facing output. " +
      "Dealer approves the storyboard before video generation is triggered. " +
      "Highest token usage — budget check always required.",
  },
  {
    action_type_id:              "analyze_customer_inactivity",
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        true,
    provider_readiness_required: true,
    budget_check_required:       false,
    rationale:
      "Pure internal analysis — output feeds re-engagement workflow decision. " +
      "Visit history in prompt is customer PII — sensitive data guard required. " +
      "No customer-facing output at this step.",
  },
  {
    action_type_id:              "analyze_review_sentiment",
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       false,
    rationale:
      "Internal analysis of publicly-posted review text. " +
      "No PII in prompt beyond the review content itself. " +
      "Output is an internal urgency score — no customer dispatch.",
  },
  {
    action_type_id:              "analyze_growth_opportunity",
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    rationale:
      "Aggregate KPI analysis — no individual customer data in prompt. " +
      "Output feeds AI Insights Panel growth_opportunity slot. " +
      "No customer-facing dispatch.",
  },
] as const satisfies AutomationAIApprovalProfile[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getApprovalProfile(
  action_type_id: AutomationAIActionTypeId,
): AutomationAIApprovalProfile | undefined {
  return AUTOMATION_AI_APPROVAL_POLICIES.find(p => p.action_type_id === action_type_id);
}

export function getActionsRequiringApprovalPolicy(): AutomationAIApprovalProfile[] {
  return AUTOMATION_AI_APPROVAL_POLICIES.filter(p => p.requires_dealer_approval);
}

export function getCustomerFacingApprovalProfiles(): AutomationAIApprovalProfile[] {
  return AUTOMATION_AI_APPROVAL_POLICIES.filter(p => p.customer_facing);
}

export function getSensitiveDataActions(): AutomationAIApprovalProfile[] {
  return AUTOMATION_AI_APPROVAL_POLICIES.filter(p => p.sensitive_data_guard);
}

export function getReviewComplianceActions(): AutomationAIApprovalProfile[] {
  return AUTOMATION_AI_APPROVAL_POLICIES.filter(p => p.review_compliance_required);
}
