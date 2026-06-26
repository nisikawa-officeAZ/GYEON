// GYEON Business Hub — Automation Center: Workflow Templates (Sprint 12C)
//
// Canonical workflow template definitions.
//
// Templates are pre-built workflow skeletons that dealers can activate and
// customize. Each template has:
//   - A trigger that fires the workflow
//   - An ordered list of steps (delays, conditions, actions)
//   - Required channels and applications
//   - AI entitlement requirements (if any)
//
// All templates have execution_deferred: true in Sprint 12C.
// The Automation Engine (Sprint 13+) will instantiate and execute them.
//
// Step ID conventions:
//   "entry"          — always the trigger step
//   "delay_N"        — delay step N
//   "check_N"        — condition branch step N
//   "action_N"       — action step N
//   "parallel_N"     — parallel action group N
//   "end"            — terminal step
//
// Pure — no "use server", no async, no DB calls, no external calls, no execution.

import type { AutomationWorkflow, AutomationStep } from "./automation-types";

// ─── Step builder helpers ─────────────────────────────────────────────────────

function triggerStep(on_success: string): AutomationStep {
  return { step_id: "entry", type: "trigger", on_success, on_failure: null, label: "Trigger" };
}

function delayStep(
  step_id: string,
  amount: number,
  unit: "minutes" | "hours" | "days" | "weeks",
  on_success: string | null,
  label: string,
): AutomationStep {
  return {
    step_id,
    type: "delay",
    delay: {
      type:           "fixed",
      amount,
      unit,
      max_wait_hours: unit === "days" ? amount * 24 * 2 : amount * 4,
    },
    on_success,
    on_failure: null,
    label,
  };
}

function conditionStep(
  step_id: string,
  condition_type: AutomationStep["condition"] extends infer C ? C extends { type: infer T } ? T : never : never,
  on_success: string | null,
  on_failure: string | null,
  label: string,
): AutomationStep {
  return {
    step_id,
    type: "condition",
    condition: { type: condition_type as AutomationStep["condition"] extends undefined ? never : NonNullable<AutomationStep["condition"]>["type"] },
    on_success,
    on_failure,
    label,
  };
}

function actionStep(
  step_id: string,
  action_id: AutomationStep["action_id"] & string,
  on_success: string | null,
  label: string,
): AutomationStep {
  return {
    step_id,
    type:       "action",
    action_id:  action_id as AutomationStep["action_id"],
    on_success,
    on_failure: null,
    label,
  };
}

function parallelStep(
  step_id: string,
  parallel_action_ids: NonNullable<AutomationStep["parallel_action_ids"]>,
  on_success: string | null,
  label: string,
): AutomationStep {
  return {
    step_id,
    type:                "parallel_actions",
    parallel_action_ids,
    on_success,
    on_failure:          null,
    label,
  };
}

function endStep(): AutomationStep {
  return { step_id: "end", type: "end", on_success: null, on_failure: null, label: "End" };
}

// ─── Workflow templates ───────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: AutomationWorkflow[] = [

  // 1. Maintenance Reminder
  {
    id:           "maintenance_reminder",
    version:      1,
    display_name: "Maintenance Reminder",
    description:  "Sends a maintenance reminder message to the customer when their scheduled " +
                  "service window opens. Creates a staff task to follow up if no response.",
    category:     "maintenance",
    trigger: {
      trigger_id:       "maintenance_due",
      ce_event_type:    "MAINTENANCE_DUE",
      entry_conditions: [{ type: "customer_has_line" }],
    },
    steps: [
      triggerStep("check_1"),
      conditionStep("check_1", "customer_has_line", "delay_1", "action_2", "Check: Customer has LINE"),
      delayStep("delay_1", 2, "hours", "action_1", "Wait 2 hours (business hours)"),
      actionStep("action_1", "send_line_message", "action_2", "Send LINE maintenance reminder"),
      actionStep("action_2", "create_task", "end", "Create staff follow-up task"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["maintenance", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 2. Review Campaign
  {
    id:           "review_campaign",
    version:      1,
    display_name: "Review Request After Job",
    description:  "Sends a review request to the customer 24 hours after a job is completed. " +
                  "Waits to ensure the customer has had time to experience the result.",
    category:     "review_management",
    trigger: {
      trigger_id:       "work_completed",
      ce_event_type:    "WORK_COMPLETED",
      entry_conditions: [{ type: "customer_has_line" }],
    },
    steps: [
      triggerStep("delay_1"),
      delayStep("delay_1", 24, "hours", "check_1", "Wait 24 hours"),
      conditionStep("check_1", "customer_has_line", "action_1", "end", "Check: Customer still has LINE"),
      actionStep("action_1", "request_review", "end", "Send review request"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["reviews", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 3. Revisit Campaign
  {
    id:           "revisit_campaign",
    version:      1,
    display_name: "Revisit Campaign",
    description:  "Sends an AI-generated re-engagement message to customers who have not " +
                  "visited in 90+ days. Requires communication_ai entitlement for AI content.",
    category:     "retention",
    trigger: {
      trigger_id:       "customer_inactive",
      ce_event_type:    null,
      entry_conditions: [
        { type: "days_since_last_visit", value: 90 },
        { type: "customer_has_line" },
      ],
    },
    steps: [
      triggerStep("check_1"),
      conditionStep("check_1", "ai_entitlement_active", "action_1", "action_2", "Check: AI entitlement"),
      actionStep("action_1", "generate_ai_caption", "action_3", "Generate AI revisit message"),
      actionStep("action_2", "send_line_message", "end", "Send template revisit message"),
      actionStep("action_3", "send_line_message", "end", "Send AI revisit message"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: "communication_ai",
    analytics_metric_groups: ["crm", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 4. Birthday Greeting
  {
    id:           "birthday_greeting",
    version:      1,
    display_name: "Birthday Greeting",
    description:  "Sends a birthday greeting to the customer on their birthday. " +
                  "Optionally includes a service coupon if configured by the dealer.",
    category:     "retention",
    trigger: {
      trigger_id:       "customer_birthday",
      ce_event_type:    null,
      entry_conditions: [{ type: "customer_has_line" }],
    },
    steps: [
      triggerStep("action_1"),
      actionStep("action_1", "send_line_message", "end", "Send birthday greeting"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["crm", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 5. New Customer Welcome
  {
    id:           "new_customer_welcome",
    version:      1,
    display_name: "New Customer Welcome",
    description:  "Sends a welcome message when a new customer is created and tags them " +
                  "in the CRM. Helps onboard new customers and establishes the LINE relationship.",
    category:     "acquisition",
    trigger: {
      trigger_id:       "customer_created",
      ce_event_type:    "CUSTOMER_CREATED",
      entry_conditions: [],
    },
    steps: [
      triggerStep("check_1"),
      conditionStep("check_1", "customer_has_line", "parallel_1", "action_2", "Check: Customer has LINE"),
      parallelStep("parallel_1", ["send_line_message", "update_crm_tag"], "end", "Send welcome + tag CRM"),
      actionStep("action_2", "update_crm_tag", "end", "Tag customer in CRM (no LINE)"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["crm", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 6. VIP Follow-up
  {
    id:           "vip_follow_up",
    version:      1,
    display_name: "VIP Customer Follow-up",
    description:  "Notifies staff and creates a follow-up task when a high-value payment " +
                  "is received. The threshold for 'VIP' is configurable by the dealer.",
    category:     "retention",
    trigger: {
      trigger_id:       "payment_completed",
      ce_event_type:    "PAYMENT_COMPLETED",
      entry_conditions: [{ type: "amount_greater_than", value: 100000 }],
    },
    steps: [
      triggerStep("check_1"),
      conditionStep("check_1", "amount_greater_than", "parallel_1", "end", "Check: VIP threshold"),
      parallelStep("parallel_1", ["notify_staff", "create_task"], "action_1", "Notify staff + create task"),
      actionStep("action_1", "update_crm_tag", "end", "Tag as VIP in CRM"),
      endStep(),
    ],
    required_channels:       [],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["sales", "crm"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 7. Inactive Customer Recovery
  {
    id:           "inactive_customer_recovery",
    version:      1,
    display_name: "Inactive Customer Recovery",
    description:  "Sends a personalized re-engagement campaign to customers inactive for 180+ days. " +
                  "Uses AI to generate personalized content based on service history.",
    category:     "retention",
    trigger: {
      trigger_id:       "customer_inactive",
      ce_event_type:    null,
      entry_conditions: [
        { type: "days_since_last_visit", value: 180 },
        { type: "customer_has_line" },
      ],
    },
    steps: [
      triggerStep("action_1"),
      actionStep("action_1", "generate_ai_caption", "action_2", "Generate personalized re-engagement message"),
      actionStep("action_2", "send_line_message", "action_3", "Send personalized message"),
      actionStep("action_3", "update_crm_tag", "end", "Tag as re-engagement target"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: "communication_ai",
    analytics_metric_groups: ["crm", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 8. Estimate Follow-up
  {
    id:           "estimate_follow_up",
    version:      1,
    display_name: "Estimate Follow-up",
    description:  "Sends a follow-up message 48 hours after an estimate is created if the " +
                  "customer has not responded. Creates a staff reminder to call if no LINE response.",
    category:     "communication",
    trigger: {
      trigger_id:       "estimate_created",
      ce_event_type:    null,
      entry_conditions: [],
    },
    steps: [
      triggerStep("delay_1"),
      delayStep("delay_1", 48, "hours", "check_1", "Wait 48 hours"),
      conditionStep("check_1", "customer_has_line", "action_1", "action_2", "Check: Customer has LINE"),
      actionStep("action_1", "send_line_message", "action_3", "Send LINE estimate follow-up"),
      actionStep("action_2", "create_reminder", "end", "Create staff call reminder"),
      actionStep("action_3", "create_reminder", "end", "Create staff reminder to confirm"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["estimates", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 9. Invoice Overdue Notice
  {
    id:           "invoice_overdue_notice",
    version:      1,
    display_name: "Invoice Overdue Notice",
    description:  "Notifies staff and creates an urgent task when an invoice becomes overdue. " +
                  "Does not automatically contact the customer — requires staff action.",
    category:     "revenue",
    trigger: {
      trigger_id:       "invoice_overdue",
      ce_event_type:    null,
      entry_conditions: [],
    },
    steps: [
      triggerStep("parallel_1"),
      parallelStep("parallel_1", ["notify_staff", "create_task"], "action_1", "Notify staff + create urgent task"),
      actionStep("action_1", "create_internal_note", "end", "Log overdue notice in customer record"),
      endStep(),
    ],
    required_channels:       [],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["accounting", "sales"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 10. Work Completed Follow-up
  {
    id:           "work_completed_follow_up",
    version:      1,
    display_name: "Work Completed Thank You",
    description:  "Sends a thank-you message and optionally requests a LINE connection " +
                  "when a job is completed. For customers who are not yet LINE-linked.",
    category:     "communication",
    trigger: {
      trigger_id:       "work_completed",
      ce_event_type:    "WORK_COMPLETED",
      entry_conditions: [],
    },
    steps: [
      triggerStep("check_1"),
      conditionStep("check_1", "customer_has_line", "action_1", "action_2", "Check: Customer has LINE"),
      actionStep("action_1", "send_line_message", "end", "Send LINE thank-you message"),
      actionStep("action_2", "create_task", "end", "Create task: invite customer to LINE"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["dealer_operations", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 11. Reservation Confirmation
  {
    id:           "reservation_confirmation",
    version:      1,
    display_name: "Reservation Confirmation",
    description:  "Sends a confirmation message when a reservation is created. " +
                  "Includes appointment date, time, and service details.",
    category:     "communication",
    trigger: {
      trigger_id:       "reservation_created",
      ce_event_type:    null,
      entry_conditions: [{ type: "customer_has_line" }],
    },
    steps: [
      triggerStep("action_1"),
      actionStep("action_1", "send_line_message", "end", "Send reservation confirmation"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["dealer_operations", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 12. Reservation Reminder
  {
    id:           "reservation_reminder",
    version:      1,
    display_name: "Pre-Appointment Reminder",
    description:  "Sends a reminder message 24 hours before a scheduled appointment. " +
                  "Reduces no-shows and helps customers prepare for the service.",
    category:     "communication",
    trigger: {
      trigger_id:       "reservation_reminder",
      ce_event_type:    null,
      entry_conditions: [{ type: "customer_has_line" }],
    },
    steps: [
      triggerStep("action_1"),
      actionStep("action_1", "send_line_message", "end", "Send pre-appointment reminder"),
      endStep(),
    ],
    required_channels:       ["line"],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: null,
    analytics_metric_groups: ["dealer_operations", "communication"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 13",
    execution_deferred:      true,
  },

  // 13. AI Insight Action
  {
    id:           "ai_insight_action",
    version:      1,
    display_name: "AI Insight Action",
    description:  "Executes the recommended action from an AI Insight. " +
                  "Triggered by the AI Insights module when an actionable insight is generated. " +
                  "Requires growth_ai entitlement and Sprint 12D+ AI Gateway connection.",
    category:     "ai_powered",
    trigger: {
      trigger_id:       "ai_insight_generated",
      ce_event_type:    null,
      entry_conditions: [{ type: "ai_entitlement_active", entitlement_id: "growth_ai" }],
    },
    steps: [
      triggerStep("check_1"),
      conditionStep("check_1", "ai_entitlement_active", "action_1", "end", "Check: growth_ai active"),
      actionStep("action_1", "notify_staff", "end", "Notify staff of AI insight action"),
      endStep(),
    ],
    required_channels:       [],
    required_applications:   ["dealer_agent"],
    required_ai_entitlement: "growth_ai",
    analytics_metric_groups: ["ai_usage", "dealer_operations"],
    status:                  "template",
    available_since:         "Sprint 12C",
    target_execution_sprint: "Sprint 12D",
    execution_deferred:      true,
  },
] satisfies AutomationWorkflow[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getWorkflowTemplate(
  id: AutomationWorkflow["id"],
): AutomationWorkflow | undefined {
  return WORKFLOW_TEMPLATES.find(w => w.id === id);
}

export function getWorkflowsByCategory(
  category: AutomationWorkflow["category"],
): AutomationWorkflow[] {
  return WORKFLOW_TEMPLATES.filter(w => w.category === category);
}

export function getAIWorkflows(): AutomationWorkflow[] {
  return WORKFLOW_TEMPLATES.filter(w => w.required_ai_entitlement !== null);
}

export function getWorkflowsForTrigger(
  trigger_id: AutomationWorkflow["trigger"]["trigger_id"],
): AutomationWorkflow[] {
  return WORKFLOW_TEMPLATES.filter(w => w.trigger.trigger_id === trigger_id);
}

export function getWorkflowIds(): AutomationWorkflow["id"][] {
  return WORKFLOW_TEMPLATES.map(w => w.id);
}
