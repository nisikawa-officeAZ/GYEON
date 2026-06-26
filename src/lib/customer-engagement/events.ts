// DealerOS — Customer Engagement Platform: Event System
//
// Canonical 10 events that drive all customer engagement workflows.
// Events are immutable records — append-only, never mutated.
//
// dealer_id is ALWAYS injected server-side at event creation.
// No event may be emitted without a valid dealer context.

// ─── Event type enumeration ───────────────────────────────────────────────────

export type EngagementEventType =
  | "CUSTOMER_CREATED"       // New customer record created
  | "VEHICLE_REGISTERED"     // Customer's vehicle added to the system
  | "ESTIMATE_APPROVED"      // Customer accepted an estimate
  | "WORK_STARTED"           // Work order moved to in-progress
  | "WORK_COMPLETED"         // Work order marked as completed
  | "PAYMENT_COMPLETED"      // Payment received and recorded
  | "REVIEW_REQUESTED"       // LINE review request sent to customer
  | "REVIEW_RECEIVED"        // Customer posted a review on any platform
  | "MAINTENANCE_DUE"        // Scheduled maintenance window opened
  | "CAMPAIGN_SENT";         // Marketing campaign delivered to customer

// ─── Typed event payloads ─────────────────────────────────────────────────────

export interface CustomerCreatedPayload {
  customer_name:  string;
  has_line:       boolean;   // Whether the customer is LINE-linked at creation
}

export interface VehicleRegisteredPayload {
  vehicle_id:     string;
  make:           string;
  model:          string;
  year?:          number;
  color?:         string;
}

export interface EstimateApprovedPayload {
  estimate_id:    string;
  total_amount:   number;
  currency:       "JPY";
  approved_at:    string;
}

export interface WorkStartedPayload {
  work_order_id:  string;
  estimate_id?:   string;
  started_at:     string;
}

export interface WorkCompletedPayload {
  work_order_id:        string;
  completion_report_id?: string;
  services_performed:   string[];   // Service categories
  completed_at:         string;
}

export interface PaymentCompletedPayload {
  payment_id:     string;
  work_order_id?: string;
  invoice_id?:    string;
  amount:         number;
  currency:       "JPY";
  method:         "cash" | "card" | "transfer" | "other";
  paid_at:        string;
}

export interface ReviewRequestedPayload {
  platform:       string;           // "google" | "instagram" | "facebook" | "website"
  review_url:     string;
  message_sent:   true;             // Only emitted when dealer actually sent the message
  requested_at:   string;
}

export interface ReviewReceivedPayload {
  platform:       string;
  review_id?:     string;           // Platform-specific review ID if available
  rating:         1 | 2 | 3 | 4 | 5;
  has_text:       boolean;
  confirmed_at:   string;
}

export interface MaintenanceDuePayload {
  maintenance_id: string;
  due_date:       string;
  service_type:   string;           // e.g. "annual_coating_check"
  overdue_days:   number;           // 0 = due today, >0 = overdue
}

export interface CampaignSentPayload {
  campaign_id:    string;
  campaign_name:  string;
  channel:        "line" | "email" | "push";
  sent_at:        string;
}

// ─── Payload map ──────────────────────────────────────────────────────────────

export interface EngagementEventPayloadMap {
  CUSTOMER_CREATED:   CustomerCreatedPayload;
  VEHICLE_REGISTERED: VehicleRegisteredPayload;
  ESTIMATE_APPROVED:  EstimateApprovedPayload;
  WORK_STARTED:       WorkStartedPayload;
  WORK_COMPLETED:     WorkCompletedPayload;
  PAYMENT_COMPLETED:  PaymentCompletedPayload;
  REVIEW_REQUESTED:   ReviewRequestedPayload;
  REVIEW_RECEIVED:    ReviewReceivedPayload;
  MAINTENANCE_DUE:    MaintenanceDuePayload;
  CAMPAIGN_SENT:      CampaignSentPayload;
}

// ─── Base event interface ──────────────────────────────────────────────────────

/**
 * All engagement events share this base structure.
 * `dealer_id` is always injected server-side — never from client input.
 */
export interface EngagementEvent<
  T extends EngagementEventType = EngagementEventType,
> {
  event_type:   T;
  /** Always from getCurrentDealer() — never from client. */
  dealer_id:    string;
  customer_id:  string;
  vehicle_id?:  string;
  job_id?:      string;
  payload:      EngagementEventPayloadMap[T];
  occurred_at:  string;  // ISO 8601
  trace_id:     string;  // UUID — for log correlation across the workflow
}

// ─── Convenience typed event aliases ─────────────────────────────────────────

export type CustomerCreatedEvent   = EngagementEvent<"CUSTOMER_CREATED">;
export type VehicleRegisteredEvent = EngagementEvent<"VEHICLE_REGISTERED">;
export type EstimateApprovedEvent  = EngagementEvent<"ESTIMATE_APPROVED">;
export type WorkStartedEvent       = EngagementEvent<"WORK_STARTED">;
export type WorkCompletedEvent     = EngagementEvent<"WORK_COMPLETED">;
export type PaymentCompletedEvent  = EngagementEvent<"PAYMENT_COMPLETED">;
export type ReviewRequestedEvent   = EngagementEvent<"REVIEW_REQUESTED">;
export type ReviewReceivedEvent    = EngagementEvent<"REVIEW_RECEIVED">;
export type MaintenanceDueEvent    = EngagementEvent<"MAINTENANCE_DUE">;
export type CampaignSentEvent      = EngagementEvent<"CAMPAIGN_SENT">;

// ─── Event metadata registry ──────────────────────────────────────────────────

export interface EngagementEventMeta {
  type:           EngagementEventType;
  name_ja:        string;
  description_ja: string;
  /** Primary workflows this event triggers. */
  triggers:       string[];
}

export const ENGAGEMENT_EVENT_REGISTRY: EngagementEventMeta[] = [
  {
    type:           "CUSTOMER_CREATED",
    name_ja:        "顧客登録",
    description_ja: "新規顧客がシステムに登録されました",
    triggers:       ["welcome_flow"],
  },
  {
    type:           "VEHICLE_REGISTERED",
    name_ja:        "車両登録",
    description_ja: "お客様の車両情報が登録されました",
    triggers:       [],
  },
  {
    type:           "ESTIMATE_APPROVED",
    name_ja:        "見積承認",
    description_ja: "お客様が見積もりを承認しました",
    triggers:       [],
  },
  {
    type:           "WORK_STARTED",
    name_ja:        "施工開始",
    description_ja: "作業指示書のステータスが施工中に変更されました",
    triggers:       [],
  },
  {
    type:           "WORK_COMPLETED",
    name_ja:        "施工完了",
    description_ja: "作業指示書が完了しました",
    triggers:       ["completion_flow"],
  },
  {
    type:           "PAYMENT_COMPLETED",
    name_ja:        "入金完了",
    description_ja: "お支払いが確認されました",
    triggers:       ["payment_flow"],
  },
  {
    type:           "REVIEW_REQUESTED",
    name_ja:        "レビュー依頼送信",
    description_ja: "LINEでレビューリクエストが送信されました",
    triggers:       ["review_request_flow"],
  },
  {
    type:           "REVIEW_RECEIVED",
    name_ja:        "レビュー受信",
    description_ja: "お客様がレビューを投稿しました",
    triggers:       ["review_received_flow"],
  },
  {
    type:           "MAINTENANCE_DUE",
    name_ja:        "メンテナンス時期",
    description_ja: "定期メンテナンスの時期になりました",
    triggers:       ["maintenance_flow"],
  },
  {
    type:           "CAMPAIGN_SENT",
    name_ja:        "キャンペーン送信",
    description_ja: "マーケティングキャンペーンが配信されました",
    triggers:       ["campaign_flow"],
  },
];

export function getEventMeta(
  type: EngagementEventType,
): EngagementEventMeta | undefined {
  return ENGAGEMENT_EVENT_REGISTRY.find((e) => e.type === type);
}
