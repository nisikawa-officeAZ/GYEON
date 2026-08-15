// GYEON News Distribution — shared types & display metadata.
// Pure module (no DB / no "use server"). Safe for client or server import.

// ── Target audience ───────────────────────────────────────────────────────────
export type NewsAudience =
  | "all_dealers"
  | "certified_dealers"
  | "regular_dealers"
  | "active_dealers"
  | "selected_dealers";

export const NEWS_AUDIENCES: NewsAudience[] = [
  "all_dealers", "certified_dealers", "regular_dealers", "active_dealers", "selected_dealers",
];

export const NEWS_AUDIENCE_LABEL: Record<NewsAudience, string> = {
  all_dealers:       "すべての店舗",
  certified_dealers: "認定店舗のみ",
  regular_dealers:   "一般店舗のみ",
  active_dealers:    "アクティブな店舗のみ",
  selected_dealers:  "選択した店舗",
};

// ── Distribution channels (on the news item) ──────────────────────────────────
export type NewsChannels = "in_app" | "email" | "line" | "email_and_line";

export const NEWS_CHANNELS: NewsChannels[] = ["in_app", "email", "line", "email_and_line"];

export const NEWS_CHANNELS_LABEL: Record<NewsChannels, string> = {
  in_app:         "アプリ内のみ",
  email:          "メール",
  line:           "LINE",
  email_and_line: "メールとLINE",
};

/** The concrete delivery channels implied by a NewsChannels value. */
export function channelsToDelivery(c: NewsChannels): DeliveryChannel[] {
  switch (c) {
    case "email":          return ["email"];
    case "line":           return ["line"];
    case "email_and_line": return ["email", "line"];
    case "in_app":
    default:               return [];
  }
}

// ── Delivery jobs / recipients ────────────────────────────────────────────────
export type DeliveryChannel = "email" | "line";

export type DeliveryJobStatus =
  | "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";

export type DeliveryRecipientStatus =
  | "pending" | "sending" | "sent" | "failed" | "skipped";

export const DELIVERY_JOB_STATUS_LABEL: Record<DeliveryJobStatus, string> = {
  draft:     "下書き",
  scheduled: "予約済み",
  sending:   "送信中",
  sent:      "送信済み",
  failed:    "失敗",
  cancelled: "キャンセル",
};

export const DELIVERY_CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  email: "メール",
  line:  "LINE",
};

export interface NewsDeliveryJob {
  id:              string;
  news_id:         string;
  channel:         DeliveryChannel;
  target_audience: NewsAudience;
  status:          DeliveryJobStatus;
  is_test:         boolean;
  total_count:     number;
  pending_count:   number;
  sent_count:      number;
  failed_count:    number;
  skipped_count:   number;
  scheduled_at:    string | null;
  sent_at:         string | null;
  created_by:      string | null;
  created_at:      string;
  updated_at:      string;
}

export interface NewsDeliveryRecipient {
  id:            string;
  job_id:        string;
  dealer_id:     string | null;
  channel:       DeliveryChannel;
  destination:   string | null;
  status:        DeliveryRecipientStatus;
  error_message: string | null;
  sent_at:       string | null;
  created_at:    string;
  updated_at:    string;
}
