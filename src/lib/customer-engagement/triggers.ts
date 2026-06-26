// DealerOS — Customer Engagement Platform: Trigger Registry
//
// Central registry mapping EngagementEvents → EngagementWorkflows + AI Agent subscribers.
//
// Future AI agents subscribe to events through this registry.
// No runtime execution in Sprint 10F — routing table only.
//
// Dependency direction:
//   Customer Engagement Platform → AI Agent Registry (consumers)
//   AI Agents are downstream — they never import this module.

import type { AppFeature }              from "@/lib/plans/plan-types";
import type { AIAgentId }               from "@/lib/ai/agents/types";
import type { EngagementEventType }     from "./events";
import type { EngagementWorkflowId, EngagementCondition } from "./types";

// ─── Trigger types ────────────────────────────────────────────────────────────

export type EngagementTriggerId =
  | "trigger_customer_created_welcome"
  | "trigger_work_completed_completion"
  | "trigger_payment_completed_confirmation"
  | "trigger_review_requested_tracking"
  | "trigger_review_received_feed"
  | "trigger_maintenance_due_reminder"
  | "trigger_campaign_sent_tracking";

export interface EngagementTrigger {
  id:                  EngagementTriggerId;
  event_type:          EngagementEventType;
  workflow_id:         EngagementWorkflowId;
  /** Conditions that must pass before the trigger fires. */
  conditions:          EngagementCondition[];
  /** Feature gate — trigger is skipped if dealer lacks this feature. */
  required_feature?:   AppFeature;
  /**
   * AI agents that subscribe to this trigger.
   * Phase G: these agents will be invoked as part of the workflow.
   * Sprint 10F: routing table only — no invocation.
   */
  agent_subscribers:   AIAgentId[];
  enabled:             boolean;
  name_ja:             string;
  description_ja:      string;
}

// ─── Trigger eligibility result ────────────────────────────────────────────────

export interface TriggerEligibilityResult {
  eligible:    boolean;
  trigger_id:  EngagementTriggerId;
  reason?:     string;   // Japanese — user-readable
}

// ─── Centralized trigger registry ────────────────────────────────────────────

export const ENGAGEMENT_TRIGGER_REGISTRY: EngagementTrigger[] = [
  // ── Customer created → welcome flow ────────────────────────────────────────
  {
    id:               "trigger_customer_created_welcome",
    event_type:       "CUSTOMER_CREATED",
    workflow_id:      "welcome_flow",
    required_feature: "line",
    conditions: [
      { type: "feature_enabled", feature: "line" },
      { type: "customer_has_line" },
    ],
    agent_subscribers: ["line_agent"],
    enabled:           true,
    name_ja:           "ウェルカムトリガー",
    description_ja:    "新規顧客登録時にLINEウェルカムメッセージを送信します",
  },

  // ── Work completed → completion flow ───────────────────────────────────────
  // Most important trigger: feeds LINE notification + reputation agent.
  {
    id:               "trigger_work_completed_completion",
    event_type:       "WORK_COMPLETED",
    workflow_id:      "completion_flow",
    required_feature: "line",
    conditions: [
      { type: "work_order_is_completed" },
      { type: "customer_has_line" },
    ],
    agent_subscribers: ["reputation_agent", "line_agent"],
    enabled:           true,
    name_ja:           "施工完了トリガー",
    description_ja:    "施工完了通知を送信し、評判エージェントにシグナルを渡します",
  },

  // ── Payment completed → confirmation flow ──────────────────────────────────
  {
    id:               "trigger_payment_completed_confirmation",
    event_type:       "PAYMENT_COMPLETED",
    workflow_id:      "payment_flow",
    required_feature: "line",
    conditions: [
      { type: "payment_is_completed" },
      { type: "customer_has_line" },
    ],
    agent_subscribers: ["line_agent"],
    enabled:           true,
    name_ja:           "入金確認トリガー",
    description_ja:    "入金確認メッセージをLINEで送信します",
  },

  // ── Review requested → tracking flow ──────────────────────────────────────
  {
    id:               "trigger_review_requested_tracking",
    event_type:       "REVIEW_REQUESTED",
    workflow_id:      "review_request_flow",
    required_feature: "ai_reputation",
    conditions: [
      { type: "feature_enabled", feature: "ai_reputation" },
    ],
    agent_subscribers: ["reputation_agent"],
    enabled:           true,
    name_ja:           "レビュー依頼追跡トリガー",
    description_ja:    "レビューリクエスト送信を評判エージェントに通知します",
  },

  // ── Review received → discovery feedback loop ──────────────────────────────
  // Critical: connects Reputation Agent → Marketing Agent for MEO/AEO/LLMO/AIO signals.
  // See AI_REPUTATION_AGENT_ROADMAP.md §Principles "Discovery feedback loop."
  {
    id:               "trigger_review_received_feed",
    event_type:       "REVIEW_RECEIVED",
    workflow_id:      "review_received_flow",
    required_feature: "ai_reputation",
    conditions: [
      { type: "feature_enabled", feature: "ai_reputation" },
    ],
    agent_subscribers: ["reputation_agent", "marketing_agent"],
    enabled:           true,
    name_ja:           "レビュー受信フィードバックトリガー",
    description_ja:    "レビュー受信シグナルを評判・マーケティングエージェントに送信します（ディスカバリーフィードバックループ）",
  },

  // ── Maintenance due → reminder flow ────────────────────────────────────────
  {
    id:               "trigger_maintenance_due_reminder",
    event_type:       "MAINTENANCE_DUE",
    workflow_id:      "maintenance_flow",
    required_feature: "line",
    conditions: [
      { type: "feature_enabled", feature: "maintenance" },
      { type: "customer_has_line" },
      { type: "vehicle_has_maintenance_schedule" },
    ],
    agent_subscribers: ["line_agent"],
    enabled:           true,
    name_ja:           "メンテナンスリマインダートリガー",
    description_ja:    "メンテナンス時期にLINEリマインダーを送信します",
  },

  // ── Campaign sent → analytics flow ────────────────────────────────────────
  {
    id:               "trigger_campaign_sent_tracking",
    event_type:       "CAMPAIGN_SENT",
    workflow_id:      "campaign_flow",
    required_feature: "ai_marketing",
    conditions: [
      { type: "feature_enabled", feature: "ai_marketing" },
    ],
    agent_subscribers: ["marketing_agent", "growth_agent"],
    enabled:           true,
    name_ja:           "キャンペーン追跡トリガー",
    description_ja:    "キャンペーン配信後のインタラクションを成長・マーケティングエージェントに通知します",
  },
];

// ─── Registry lookup functions ────────────────────────────────────────────────

export function getTrigger(id: EngagementTriggerId): EngagementTrigger | undefined {
  return ENGAGEMENT_TRIGGER_REGISTRY.find((t) => t.id === id);
}

export function getTriggersForEvent(
  event_type: EngagementEventType,
): EngagementTrigger[] {
  return ENGAGEMENT_TRIGGER_REGISTRY.filter(
    (t) => t.event_type === event_type && t.enabled,
  );
}

export function getAgentSubscribers(
  event_type: EngagementEventType,
): AIAgentId[] {
  const triggers = getTriggersForEvent(event_type);
  const all = triggers.flatMap((t) => t.agent_subscribers);
  return [...new Set(all)];
}

export function getTriggersByAgent(agent_id: AIAgentId): EngagementTrigger[] {
  return ENGAGEMENT_TRIGGER_REGISTRY.filter((t) =>
    t.agent_subscribers.includes(agent_id),
  );
}

export function getEnabledTriggers(): EngagementTrigger[] {
  return ENGAGEMENT_TRIGGER_REGISTRY.filter((t) => t.enabled);
}
