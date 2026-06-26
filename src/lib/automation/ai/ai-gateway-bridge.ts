// GYEON Business Hub — Automation AI Gateway Bridge: Bridge Interface (Sprint 12D)
//
// Pure functions that prepare, validate, and dry-run AI requests from the Automation Center.
//
// Functions in this module:
//   getRequiredAgentForAction()  — look up which AIAgentId handles an action type
//   buildGatewayPayload()        — construct the AITextRequest-compatible payload shape
//   validateAIActionContext()    — check that required step_context keys are present
//   checkAIActionReadiness()     — full readiness assessment (gateway + entitlement + context)
//   dryRunAIAction()             — end-to-end dry run returning AutomationAIResult
//
// None of these functions calls any AI provider, database, or external service.
// In Sprint 12D, dryRunAIAction() always returns execution_deferred: true.
//
// Live execution path (Sprint 13+):
//   1. checkAiGatewayReady()         — verify dealer has configured provider
//   2. planHasAIEntitlement()        — verify plan includes required entitlement
//   3. verifyCustomerConsent()       — for customer-facing actions
//   4. buildGatewayPayload()         — construct AITextRequest
//   5. AIProviderAdapter.generateText(payload) — execute via AI Gateway
//   6. require dealer approval       — for actions with requires_dealer_approval: true
//   7. Communication Center dispatch — for customer-facing results
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type {
  AutomationAIActionTypeId,
  AutomationAIRequest,
  AutomationAIGatewayPayload,
  AutomationAIReadiness,
  AutomationAIReadinessStatus,
  AutomationAIResult,
  AIAgentId,
  AITaskType,
} from "./ai-action-types";
import { getAIActionDescriptor } from "./ai-action-registry";

// ─── Agent lookup ──────────────────────────────────────────────────────────────

/**
 * Returns the AIAgentId that handles a given AI action type.
 * Returns null when the action type is not registered.
 */
export function getRequiredAgentForAction(
  action_type_id: AutomationAIActionTypeId,
): AIAgentId | null {
  return getAIActionDescriptor(action_type_id)?.agent_id ?? null;
}

/**
 * Returns the AITaskType dispatched to the AI Gateway for a given action type.
 * Returns null when the action type is not registered.
 */
export function getRequiredTaskTypeForAction(
  action_type_id: AutomationAIActionTypeId,
): AITaskType | null {
  return getAIActionDescriptor(action_type_id)?.task_type ?? null;
}

// ─── Context validation ────────────────────────────────────────────────────────

/**
 * Validates that the AutomationAIRequest's step_context contains all required
 * keys for the specified action type.
 *
 * Returns the list of missing context keys. Empty array = validation passes.
 */
export function validateAIActionContext(
  request: AutomationAIRequest,
): string[] {
  const descriptor = getAIActionDescriptor(request.ai_action_type_id);
  if (!descriptor) return [`unknown_action_type:${request.ai_action_type_id}`];

  return descriptor.required_context_keys.filter(
    key => !(key in request.step_context) || request.step_context[key] === "",
  );
}

// ─── Gateway payload builder ───────────────────────────────────────────────────

/**
 * Constructs the AITextRequest-compatible payload shape for a given request.
 *
 * This function produces the payload structure without executing it.
 * The returned object is compatible with AITextRequest from src/lib/ai/types.ts.
 *
 * Prompt templates are intentionally minimal in Sprint 12D —
 * they will be replaced by production-quality prompt engineering in Sprint 13.
 */
export function buildGatewayPayload(
  request: AutomationAIRequest,
): AutomationAIGatewayPayload {
  const descriptor = getAIActionDescriptor(request.ai_action_type_id);

  // Fallback for unknown action types — should never occur in production
  if (!descriptor) {
    return {
      dealer_id:     request.dealer_id,
      task_type:     "content_writing",
      system_prompt: "You are a helpful assistant.",
      user_prompt:   `Perform action: ${request.ai_action_type_id}`,
      max_tokens:    256,
      temperature:   0.5,
      trace_id:      request.trace_id,
    };
  }

  const systemPrompt = buildSystemPrompt(request.ai_action_type_id);
  const userPrompt   = buildUserPrompt(request);

  return {
    dealer_id:     request.dealer_id,
    task_type:     descriptor.task_type,
    system_prompt: systemPrompt,
    user_prompt:   userPrompt,
    max_tokens:    descriptor.default_max_tokens,
    temperature:   descriptor.default_temperature,
    trace_id:      request.trace_id,
  };
}

function buildSystemPrompt(action_type_id: AutomationAIActionTypeId): string {
  const prompts: Record<AutomationAIActionTypeId, string> = {
    generate_ai_caption:
      "You are a professional automotive detailing shop communication assistant. " +
      "Write warm, natural Japanese messages for customer communication. " +
      "Be concise, friendly, and professional. Never fabricate service details.",
    generate_ai_reply:
      "You are a professional automotive detailing shop assistant helping draft replies. " +
      "Match the customer's tone. Be helpful and clear. " +
      "Flag anything requiring human judgment in [brackets].",
    generate_ai_summary:
      "You are a business intelligence assistant for an automotive detailing shop owner. " +
      "Summarize business performance data accurately. " +
      "Highlight positives and areas for improvement factually. No fabrication.",
    generate_review_request:
      "You are writing a review request for an automotive detailing shop. " +
      "Use neutral language. Do not incentivize or pressure. " +
      "Comply with Google and Apple review platform policies.",
    generate_maintenance_message:
      "You are writing a vehicle maintenance reminder for a detailing shop customer. " +
      "Include the vehicle details and service type naturally. " +
      "Keep the message warm and helpful.",
    generate_sns_post:
      "You are a social media content creator for an automotive detailing shop. " +
      "Create engaging, authentic content. Include relevant hashtags. " +
      "Focus on craftsmanship and quality.",
    generate_video_storyboard:
      "You are a marketing video director for an automotive detailing shop. " +
      "Create a structured shot list and narration script from the job context. " +
      "Focus on before/after transformation and craftsmanship.",
    analyze_customer_inactivity:
      "You are a customer retention analyst for an automotive detailing shop. " +
      "Assess customer inactivity risk from visit data. " +
      "Return structured analysis with risk level and recommended action.",
    analyze_review_sentiment:
      "You are a reputation analyst for an automotive detailing shop. " +
      "Analyze the review sentiment, key themes, and urgency of response needed. " +
      "Return structured analysis. Do not fabricate details.",
    analyze_growth_opportunity:
      "You are a business growth analyst for an automotive detailing shop. " +
      "Identify revenue and retention opportunities from KPI patterns. " +
      "Base all analysis strictly on the provided data.",
  };
  return prompts[action_type_id];
}

function buildUserPrompt(request: AutomationAIRequest): string {
  const ctx = request.step_context;
  const customerName   = ctx["customer_name"]   ?? "(not provided)";
  const serviceType    = ctx["service_type"]    ?? "(not provided)";
  const vehicleInfo    = ctx["vehicle_info"]    ?? "(not provided)";
  const dueDate        = ctx["service_due_date"] ?? "(not provided)";
  const inboundMsg     = ctx["inbound_message"] ?? "(not provided)";
  const reviewText     = ctx["review_text"]     ?? "(not provided)";
  const daysSinceLast  = ctx["days_since_last_visit"] ?? "(not provided)";
  const visitCount     = ctx["visit_count"]     ?? "(not provided)";
  const photoCount     = ctx["photo_count"]     ?? "(not provided)";

  const prompts: Record<AutomationAIActionTypeId, string> = {
    generate_ai_caption:
      `Write a short, friendly LINE message for customer: ${customerName}. ` +
      `Context: ${serviceType}. Workflow: ${request.workflow_id}.`,
    generate_ai_reply:
      `Draft a reply to this customer message from ${customerName}:\n"${inboundMsg}"`,
    generate_ai_summary:
      `Generate a business performance summary for a detailing shop.`,
    generate_review_request:
      `Write a review request for ${customerName} after a ${serviceType} service.`,
    generate_maintenance_message:
      `Write a maintenance reminder for ${customerName}, vehicle: ${vehicleInfo}, ` +
      `service due: ${dueDate}.`,
    generate_sns_post:
      `Create an SNS post for a ${serviceType} detailing service completion.`,
    generate_video_storyboard:
      `Create a video storyboard for a ${serviceType} service with ${photoCount} completion photos.`,
    analyze_customer_inactivity:
      `Analyze inactivity risk for a customer: last visit ${daysSinceLast} days ago, ` +
      `total visits: ${visitCount}.`,
    analyze_review_sentiment:
      `Analyze this customer review:\n"${reviewText}"`,
    analyze_growth_opportunity:
      `Identify growth opportunities for a detailing shop.`,
  };

  return prompts[request.ai_action_type_id];
}

// ─── Readiness check ──────────────────────────────────────────────────────────

/**
 * Performs a full readiness assessment for an AI action request.
 *
 * In Sprint 12D, always returns execution_deferred status.
 * In Sprint 13, this function will call checkAiGatewayReady() and
 * planHasAIEntitlement() using server-side async functions.
 *
 * The check order when live (Sprint 13):
 *   1. Context validation (synchronous)
 *   2. Gateway readiness (async — checkAiGatewayReady())
 *   3. Entitlement check (async — planHasAIEntitlement())
 *   4. Consent check for customer-facing actions
 *   5. Approval requirement declaration
 */
export function checkAIActionReadiness(
  request: AutomationAIRequest,
): AutomationAIReadiness {
  const descriptor = getAIActionDescriptor(request.ai_action_type_id);
  const missingContext = validateAIActionContext(request);

  const status: AutomationAIReadinessStatus = "execution_deferred";

  return {
    status,
    gateway_status:         null,   // Not checked until Sprint 13
    required_entitlement:   descriptor?.required_ai_entitlement ?? null,
    missing_context_fields: missingContext,
    requires_approval:      descriptor?.requires_dealer_approval ?? false,
    can_execute:            false,  // Always false in Sprint 12D
    deferred_until:         descriptor?.target_execution_sprint ?? "Sprint 13",
  };
}

// ─── Dry run ──────────────────────────────────────────────────────────────────

/**
 * Performs a complete dry run of an AI action without executing.
 *
 * Returns an AutomationAIResult with:
 *   - readiness: full readiness assessment
 *   - gateway_payload_shape: the AITextRequest payload that WOULD be sent
 *   - content: null (no AI execution in Sprint 12D)
 *   - execution_deferred: true
 *
 * Safe to call from any context — no network calls, no DB queries, no AI.
 */
export function dryRunAIAction(
  request: AutomationAIRequest,
): AutomationAIResult {
  const descriptor      = getAIActionDescriptor(request.ai_action_type_id);
  const readiness       = checkAIActionReadiness(request);
  const gatewayPayload  = buildGatewayPayload(request);

  return {
    ai_action_type_id:     request.ai_action_type_id,
    workflow_id:           request.workflow_id,
    step_id:               request.step_id,
    trace_id:              request.trace_id,
    agent_id:              descriptor?.agent_id ?? "marketing_agent",
    task_type:             descriptor?.task_type ?? "content_writing",
    readiness,
    gateway_payload_shape: gatewayPayload,
    content:               null,    // No AI execution
    provider:              null,    // No provider selected
    approved_for_dispatch: false,   // Never approved in Sprint 12D
    execution_deferred:    true,
    created_at:            new Date().toISOString(),
  };
}

// ─── Action-to-workflow mapping ───────────────────────────────────────────────

/**
 * Maps each AutomationAIActionTypeId to the automation action IDs in the
 * Automation Center registry that invoke it.
 * Used for documentation and future registry cross-referencing.
 */
export const AI_ACTION_TO_AUTOMATION_ACTION: Record<
  AutomationAIActionTypeId,
  string[]   // AutomationActionId values
> = {
  generate_ai_caption:          ["generate_ai_caption"],
  generate_ai_reply:            ["generate_ai_reply"],
  generate_ai_summary:          ["generate_ai_summary"],
  generate_review_request:      ["request_review"],
  generate_maintenance_message: ["generate_ai_caption"],  // via maintenance_reminder workflow
  generate_sns_post:            ["generate_ai_caption"],  // via marketing_ai action
  generate_video_storyboard:    ["generate_ai_video"],
  analyze_customer_inactivity:  [],  // Internal — no direct automation action yet
  analyze_review_sentiment:     [],  // Internal — feeds insight panel
  analyze_growth_opportunity:   [],  // Internal — feeds insight panel
} as const;
