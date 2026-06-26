// DealerOS — Customer Engagement Platform: Workflow Engine
//
// Production-ready workflow definitions for the complete customer journey:
//
//   Reservation → Work Order → Completion → LINE Message → Review Request
//     → Maintenance Reminder → Marketing Campaign → Repeat Visit
//
// Each workflow is configurable per dealer (Phase G: per-dealer overrides).
// All workflows enforce feature gates — actions silently skip if gate not met.

import type { EngagementWorkflow, EngagementWorkflowId } from "./types";
import type { EngagementEventType }                       from "./events";

// ─── Pre-defined workflows ────────────────────────────────────────────────────

export const ENGAGEMENT_WORKFLOWS: EngagementWorkflow[] = [
  // ── 1. Welcome flow ─────────────────────────────────────────────────────────
  // Trigger: New customer created → send a welcome LINE message if LINE-linked.
  {
    id:             "welcome_flow",
    name_ja:        "ウェルカムフロー",
    description_ja: "新規顧客登録時にウェルカムメッセージをLINEで送信します",
    trigger_event:  "CUSTOMER_CREATED",
    required_feature: "line",
    conditions: [
      { type: "feature_enabled", feature: "line" },
      { type: "customer_has_line" },
    ],
    actions: [
      {
        id:               "welcome_line_message",
        type:             "send_line_message",
        delay_hours:      0,
        config:           { template_id: "welcome_message_v1" },
        conditions:       [{ type: "customer_has_line" }],
        required_feature: "line",
      },
    ],
    enabled: true,
  },

  // ── 2. Completion flow ──────────────────────────────────────────────────────
  // Trigger: Work order completed → send completion notification → (24h) review request.
  // This is the primary touchpoint for reputation management.
  {
    id:             "completion_flow",
    name_ja:        "施工完了フロー",
    description_ja: "施工完了時に完了通知を送信し、24時間後にレビューをリクエストします",
    trigger_event:  "WORK_COMPLETED",
    required_feature: "line",
    conditions: [
      { type: "work_order_is_completed" },
      { type: "customer_has_line" },
    ],
    actions: [
      {
        id:               "completion_notification",
        type:             "send_line_message",
        delay_hours:      0,
        config:           { template_id: "completion_notification_v1" },
        conditions:       [{ type: "customer_has_line" }],
        required_feature: "line",
      },
      {
        id:               "review_request_after_completion",
        type:             "request_review",
        delay_hours:      24,
        config:           { platform: "google" },
        conditions: [
          { type: "customer_has_line" },
          { type: "review_not_yet_requested" },
          { type: "feature_enabled", feature: "ai_reputation" },
        ],
        required_feature: "ai_reputation",
      },
      {
        id:               "tag_completed_customer",
        type:             "update_customer_tag",
        delay_hours:      0,
        config:           { tag_name: "施工完了" },
        conditions:       [],
      },
    ],
    enabled: true,
  },

  // ── 3. Payment flow ─────────────────────────────────────────────────────────
  // Trigger: Payment confirmed → send payment confirmation via LINE.
  {
    id:             "payment_flow",
    name_ja:        "入金確認フロー",
    description_ja: "入金確認後に領収メッセージをLINEで送信します",
    trigger_event:  "PAYMENT_COMPLETED",
    required_feature: "line",
    conditions: [
      { type: "payment_is_completed" },
      { type: "customer_has_line" },
    ],
    actions: [
      {
        id:               "payment_confirmation_message",
        type:             "send_line_message",
        delay_hours:      0,
        config:           { template_id: "payment_confirmation_v1" },
        conditions:       [{ type: "customer_has_line" }],
        required_feature: "line",
      },
    ],
    enabled: true,
  },

  // ── 4. Review request tracking flow ─────────────────────────────────────────
  // Trigger: Review request sent → notify reputation agent for tracking.
  {
    id:             "review_request_flow",
    name_ja:        "レビュー依頼追跡フロー",
    description_ja: "レビューリクエスト送信後に評判エージェントへ通知します",
    trigger_event:  "REVIEW_REQUESTED",
    required_feature: "ai_reputation",
    conditions: [
      { type: "feature_enabled", feature: "ai_reputation" },
    ],
    actions: [
      {
        id:               "notify_reputation_agent_on_request",
        type:             "notify_agent",
        delay_hours:      0,
        config:           { agent_id: "reputation_agent" },
        conditions:       [{ type: "ai_gateway_ready" }],
        required_feature: "ai_reputation",
      },
    ],
    enabled: true,
  },

  // ── 5. Review received flow ──────────────────────────────────────────────────
  // Trigger: Review confirmed → analyze + export marketing feed.
  // This is the "Discovery Feedback Loop" (AI_REPUTATION_AGENT_ROADMAP.md §Principles).
  {
    id:             "review_received_flow",
    name_ja:        "レビュー受信フロー",
    description_ja: "レビュー受信後に評判分析を実行し、マーケティングエージェントにシグナルを送信します",
    trigger_event:  "REVIEW_RECEIVED",
    required_feature: "ai_reputation",
    conditions: [
      { type: "feature_enabled", feature: "ai_reputation" },
    ],
    actions: [
      {
        id:               "notify_reputation_agent_on_receipt",
        type:             "notify_agent",
        delay_hours:      0,
        config:           { agent_id: "reputation_agent" },
        conditions:       [{ type: "ai_gateway_ready" }],
        required_feature: "ai_reputation",
      },
      {
        id:               "tag_reviewed_customer",
        type:             "update_customer_tag",
        delay_hours:      0,
        config:           { tag_name: "レビュー済み" },
        conditions:       [],
      },
    ],
    enabled: true,
  },

  // ── 6. Maintenance reminder flow ─────────────────────────────────────────────
  // Trigger: Maintenance due → LINE reminder → (7 days) follow-up if unresponded.
  {
    id:             "maintenance_flow",
    name_ja:        "メンテナンスリマインダーフロー",
    description_ja: "メンテナンス時期にリマインダーを送信し、7日後にフォローアップします",
    trigger_event:  "MAINTENANCE_DUE",
    required_feature: "line",
    conditions: [
      { type: "feature_enabled", feature: "maintenance" },
      { type: "customer_has_line" },
      { type: "vehicle_has_maintenance_schedule" },
    ],
    actions: [
      {
        id:               "maintenance_reminder_line",
        type:             "send_line_message",
        delay_hours:      0,
        config:           { template_id: "maintenance_reminder_v1" },
        conditions:       [{ type: "customer_has_line" }],
        required_feature: "line",
      },
      {
        id:               "maintenance_followup_line",
        type:             "send_line_message",
        delay_hours:      168,  // 7 days
        config:           { template_id: "maintenance_followup_v1" },
        conditions:       [{ type: "customer_has_line" }],
        required_feature: "auto_notifications",
      },
      {
        id:               "tag_maintenance_due_customer",
        type:             "update_customer_tag",
        delay_hours:      0,
        config:           { tag_name: "メンテナンス時期" },
        conditions:       [],
      },
    ],
    enabled: true,
  },

  // ── 7. Campaign sent flow ────────────────────────────────────────────────────
  // Trigger: Campaign delivered → record interaction + notify growth agent.
  {
    id:             "campaign_flow",
    name_ja:        "キャンペーン追跡フロー",
    description_ja: "キャンペーン配信後にインタラクションを記録し、成長エージェントに通知します",
    trigger_event:  "CAMPAIGN_SENT",
    required_feature: "ai_marketing",
    conditions: [
      { type: "feature_enabled", feature: "ai_marketing" },
    ],
    actions: [
      {
        id:               "tag_campaign_recipient",
        type:             "update_customer_tag",
        delay_hours:      0,
        config:           { tag_name: "キャンペーン受信済み" },
        conditions:       [],
      },
      {
        id:               "notify_growth_agent_on_campaign",
        type:             "notify_agent",
        delay_hours:      0,
        config:           { agent_id: "growth_agent" },
        conditions:       [{ type: "ai_gateway_ready" }],
        required_feature: "ai_growth",
      },
    ],
    enabled: true,
  },
];

// ─── Workflow registry functions ──────────────────────────────────────────────

export function getWorkflow(id: EngagementWorkflowId): EngagementWorkflow | undefined {
  return ENGAGEMENT_WORKFLOWS.find((w) => w.id === id);
}

export function getWorkflowsByTrigger(
  event_type: EngagementEventType,
): EngagementWorkflow[] {
  return ENGAGEMENT_WORKFLOWS.filter((w) => w.trigger_event === event_type);
}

export function getEnabledWorkflows(): EngagementWorkflow[] {
  return ENGAGEMENT_WORKFLOWS.filter((w) => w.enabled);
}

export function getWorkflowsByFeature(
  feature: string,
): EngagementWorkflow[] {
  return ENGAGEMENT_WORKFLOWS.filter((w) => w.required_feature === feature);
}
