// GYEON Business Hub — Automation AI Gateway Bridge: Action Registry (Sprint 12D)
//
// Static registry of all 10 Automation AI action types.
//
// Each entry maps an AutomationAIActionTypeId to:
//   - The AIAgentId that handles the action (from src/lib/ai/agents/types.ts)
//   - The AITaskType dispatched to the AI Gateway (from src/lib/ai/types.ts)
//   - Required AIEntitlementId (from subscription center)
//   - Default token budget and temperature for gateway payload construction
//   - Approval and safety policy flags (see approval-policy.ts)
//   - Communication flow compatibility
//
// No modifications to AIAgentId, AITaskType, or AIGatewayStatus — bridge only.
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type {
  AutomationAIActionTypeId,
  AutomationAIActionCategory,
  AIAgentId,
  AITaskType,
  AIEntitlementId,
} from "./ai-action-types";
import type { CommunicationChannelId } from "@/lib/communication/communication-types";

// ─── Registry entry ────────────────────────────────────────────────────────────

export interface AutomationAIActionDescriptor {
  action_type_id:          AutomationAIActionTypeId;
  display_name:            string;
  description:             string;
  category:                AutomationAIActionCategory;

  // Gateway routing
  agent_id:                AIAgentId;
  task_type:               AITaskType;
  required_ai_entitlement: AIEntitlementId;

  // Gateway payload defaults
  default_max_tokens:      number;
  default_temperature:     number;

  // Required step_context keys from prior workflow steps
  required_context_keys:   string[];

  // Channel compatibility (which channels can receive this action's output)
  compatible_channels:     CommunicationChannelId[];

  // Safety and approval policy
  requires_dealer_approval:     boolean;
  internal_only:                boolean;  // Never sent to customers directly
  customer_facing:              boolean;  // Output may reach the customer
  marketing_content:            boolean;  // Classified as marketing content
  review_compliance_required:   boolean;  // Must comply with review platform policies
  sensitive_data_guard:         boolean;  // May involve PII — extra care required
  provider_readiness_required:  boolean;  // Must call checkAiGatewayReady() first
  budget_check_required:        boolean;  // Usage budget check before execution

  // Availability
  available:                boolean;
  available_since:          string;
  target_execution_sprint:  string;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

export const AUTOMATION_AI_ACTION_REGISTRY: AutomationAIActionDescriptor[] = [

  // ── Content generation actions ─────────────────────────────────────────────

  {
    action_type_id:          "generate_ai_caption",
    display_name:            "Generate AI Caption",
    description:             "Generates a message caption or LINE message body using the " +
                             "marketing_agent. Output is a text draft for staff review. " +
                             "Used in revisit_campaign and inactive_customer_recovery workflows.",
    category:                "message_draft",
    agent_id:                "marketing_agent",
    task_type:               "content_writing",
    required_ai_entitlement: "communication_ai",
    default_max_tokens:      400,
    default_temperature:     0.7,
    required_context_keys:   ["customer_name"],
    compatible_channels:     ["line", "email", "whatsapp"],
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           true,
    review_compliance_required:  false,
    sensitive_data_guard:        true,
    provider_readiness_required: true,
    budget_check_required:       true,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "generate_ai_reply",
    display_name:            "Generate AI Reply Draft",
    description:             "Drafts a reply to an inbound customer message using the " +
                             "line_agent. Staff must review and approve before dispatch. " +
                             "Requires ai_communication_permission consent from customer.",
    category:                "message_draft",
    agent_id:                "line_agent",
    task_type:               "content_writing",
    required_ai_entitlement: "communication_ai",
    default_max_tokens:      300,
    default_temperature:     0.5,
    required_context_keys:   ["customer_name", "inbound_message"],
    compatible_channels:     ["line", "whatsapp"],
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        true,
    provider_readiness_required: true,
    budget_check_required:       true,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "generate_ai_summary",
    display_name:            "Generate AI Business Summary",
    description:             "Generates a narrative performance summary for the dealer owner " +
                             "using the growth_agent. Output populates the AI Insights Panel. " +
                             "Requires minimum 30 days of business data.",
    category:                "summary",
    agent_id:                "growth_agent",
    task_type:               "reputation_analysis",
    required_ai_entitlement: "growth_ai",
    default_max_tokens:      800,
    default_temperature:     0.3,
    required_context_keys:   [],
    compatible_channels:     [],   // Internal only — shown on dashboard, not sent
    requires_dealer_approval:    false,  // Dashboard display, not customer-facing
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "generate_review_request",
    display_name:            "Generate AI Review Request",
    description:             "Drafts a personalized review request message using the " +
                             "review_agent. Complies with platform review policies — neutral tone, " +
                             "no incentivization. Requires AUT-007 (one per work order).",
    category:                "message_draft",
    agent_id:                "review_agent",
    task_type:               "review_request_generation",
    required_ai_entitlement: "communication_ai",
    default_max_tokens:      250,
    default_temperature:     0.5,
    required_context_keys:   ["customer_name", "service_type"],
    compatible_channels:     ["line", "email"],
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           false,
    review_compliance_required:  true,   // Must comply with Google/Apple review policies
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       false,  // Short prompt — budget impact minimal
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "generate_maintenance_message",
    display_name:            "Generate AI Maintenance Reminder",
    description:             "Drafts a personalized maintenance reminder message for a specific " +
                             "customer and vehicle using the line_agent. Includes service details " +
                             "and suggested timing.",
    category:                "message_draft",
    agent_id:                "line_agent",
    task_type:               "content_writing",
    required_ai_entitlement: "communication_ai",
    default_max_tokens:      300,
    default_temperature:     0.5,
    required_context_keys:   ["customer_name", "vehicle_info", "service_due_date"],
    compatible_channels:     ["line", "email", "sms"],
    requires_dealer_approval:    false,   // Template-style — low risk with predefined context
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        true,    // Includes vehicle and service PII
    provider_readiness_required: true,
    budget_check_required:       false,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "generate_sns_post",
    display_name:            "Generate AI SNS Post",
    description:             "Generates a complete SNS post (caption, hashtags, SEO metadata) " +
                             "using the marketing_agent. Suitable for Instagram, X, and LINE. " +
                             "Does not publish — dealer reviews and posts manually.",
    category:                "content_generation",
    agent_id:                "marketing_agent",
    task_type:               "content_writing",
    required_ai_entitlement: "marketing_ai",
    default_max_tokens:      500,
    default_temperature:     0.8,
    required_context_keys:   ["service_type"],
    compatible_channels:     [],   // Dealer posts manually — no channel dispatch
    requires_dealer_approval:    true,
    internal_only:               false,
    customer_facing:             true,
    marketing_content:           true,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "generate_video_storyboard",
    display_name:            "Generate AI Video Storyboard",
    description:             "Generates a shot list and script for a marketing video from " +
                             "completed job photos using the marketing_agent. Output is a " +
                             "structured storyboard for the AI video generation pipeline.",
    category:                "content_generation",
    agent_id:                "marketing_agent",
    task_type:               "video_generation",
    required_ai_entitlement: "video_ai",
    default_max_tokens:      600,
    default_temperature:     0.7,
    required_context_keys:   ["service_type", "photo_count"],
    compatible_channels:     [],   // No channel output — storyboard only
    requires_dealer_approval:    true,
    internal_only:               true,   // Storyboard is internal — video is the output
    customer_facing:             false,
    marketing_content:           true,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 14 (execution)",
    target_execution_sprint: "Sprint 14",
  },

  // ── Analysis actions ──────────────────────────────────────────────────────

  {
    action_type_id:          "analyze_customer_inactivity",
    display_name:            "AI Customer Inactivity Analysis",
    description:             "Scores customer churn risk from visit frequency and recency data " +
                             "using the growth_agent. Output is an inactivity risk score and " +
                             "recommended re-engagement action.",
    category:                "analysis",
    agent_id:                "growth_agent",
    task_type:               "reputation_analysis",
    required_ai_entitlement: "growth_ai",
    default_max_tokens:      400,
    default_temperature:     0.2,
    required_context_keys:   ["days_since_last_visit", "visit_count"],
    compatible_channels:     [],   // Analysis result — used by downstream action steps
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        true,   // Visit history is customer PII
    provider_readiness_required: true,
    budget_check_required:       false,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "analyze_review_sentiment",
    display_name:            "AI Review Sentiment Analysis",
    description:             "Analyzes received reviews for sentiment, themes, and response priority " +
                             "using the reputation_agent. Output guides whether a response draft " +
                             "is needed and at what urgency level.",
    category:                "analysis",
    agent_id:                "reputation_agent",
    task_type:               "reputation_analysis",
    required_ai_entitlement: "growth_ai",
    default_max_tokens:      300,
    default_temperature:     0.2,
    required_context_keys:   ["review_text"],
    compatible_channels:     [],   // Analysis result only
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       false,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

  {
    action_type_id:          "analyze_growth_opportunity",
    display_name:            "AI Growth Opportunity Analysis",
    description:             "Identifies untapped revenue and retention opportunities from " +
                             "KPI patterns using the growth_agent. Requires 60+ days of " +
                             "business data. Output feeds the AI Insights Panel growth_opportunity slot.",
    category:                "analysis",
    agent_id:                "growth_agent",
    task_type:               "reputation_analysis",
    required_ai_entitlement: "growth_ai",
    default_max_tokens:      600,
    default_temperature:     0.3,
    required_context_keys:   [],
    compatible_channels:     [],   // Insight panel — not dispatched to channel
    requires_dealer_approval:    false,
    internal_only:               true,
    customer_facing:             false,
    marketing_content:           false,
    review_compliance_required:  false,
    sensitive_data_guard:        false,
    provider_readiness_required: true,
    budget_check_required:       true,
    available:               false,
    available_since:         "Sprint 12D (declared) / Sprint 13 (execution)",
    target_execution_sprint: "Sprint 13",
  },

] as const satisfies AutomationAIActionDescriptor[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getAIActionDescriptor(
  action_type_id: AutomationAIActionTypeId,
): AutomationAIActionDescriptor | undefined {
  return AUTOMATION_AI_ACTION_REGISTRY.find(a => a.action_type_id === action_type_id);
}

export function getAIActionsByCategory(
  category: AutomationAIActionCategory,
): AutomationAIActionDescriptor[] {
  return AUTOMATION_AI_ACTION_REGISTRY.filter(a => a.category === category);
}

export function getAIActionsForAgent(
  agent_id: AIAgentId,
): AutomationAIActionDescriptor[] {
  return AUTOMATION_AI_ACTION_REGISTRY.filter(a => a.agent_id === agent_id);
}

export function getCustomerFacingAIActions(): AutomationAIActionDescriptor[] {
  return AUTOMATION_AI_ACTION_REGISTRY.filter(a => a.customer_facing);
}

export function getActionsRequiringApproval(): AutomationAIActionDescriptor[] {
  return AUTOMATION_AI_ACTION_REGISTRY.filter(a => a.requires_dealer_approval);
}

export function getAIActionTypeIds(): AutomationAIActionTypeId[] {
  return AUTOMATION_AI_ACTION_REGISTRY.map(a => a.action_type_id);
}
