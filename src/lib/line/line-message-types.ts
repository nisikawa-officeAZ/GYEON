// DealerOS — LINE Message Log & Notification Queue types (PHASE47)

// ─── Status / Purpose enums ───────────────────────────────────────────────────

export type LineMessageStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export type LineMessagePurpose =
  | 'manual'
  | 'completion_report'
  | 'maintenance_reminder'
  | 'reservation'
  | 'campaign'
  | 'system';

export type LineQueueStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

// ─── DB types ────────────────────────────────────────────────────────────────

export interface LineMessageLogDB {
  id:               string;
  dealer_id:        string;
  customer_id:      string | null;
  line_customer_id: string | null;
  line_user_id:     string | null;
  message_type:     string | null;
  purpose:          LineMessagePurpose;
  title:            string | null;
  body:             string | null;
  payload:          Record<string, unknown> | null;
  status:           LineMessageStatus;
  sent_at:          string | null;
  failed_at:        string | null;
  error_message:    string | null;
  retry_count:      number;
  created_at:       string;
  updated_at:       string;

  // Joined
  customers?: {
    last_name:  string | null;
    first_name: string | null;
  } | null;
  line_customers?: {
    display_name: string | null;
    picture_url:  string | null;
  } | null;
}

export interface LineNotificationQueueDB {
  id:               string;
  dealer_id:        string;
  customer_id:      string | null;
  line_customer_id: string | null;
  scheduled_at:     string;
  message_type:     string;
  purpose:          LineMessagePurpose;
  title:            string | null;
  body:             string;
  payload:          Record<string, unknown> | null;
  status:           LineQueueStatus;
  attempts:         number;
  last_attempt_at:  string | null;
  sent_log_id:      string | null;
  error_message:    string | null;
  created_at:       string;
  updated_at:       string;

  // Joined
  customers?: {
    last_name:  string | null;
    first_name: string | null;
  } | null;
  line_customers?: {
    display_name: string | null;
    picture_url:  string | null;
  } | null;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface LineMessageInput {
  customer_id?:      string | null;
  line_customer_id?: string | null;
  line_user_id:      string;
  message_type?:     string;
  purpose:           LineMessagePurpose;
  title?:            string | null;
  body:              string;
  payload?:          Record<string, unknown> | null;
}

export interface LineQueueInput {
  customer_id?:      string | null;
  line_customer_id?: string | null;
  scheduled_at:      string;    // ISO timestamp
  message_type?:     string;
  purpose:           LineMessagePurpose;
  title?:            string | null;
  body:              string;
  payload?:          Record<string, unknown> | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function lineMessageStatusLabel(status: LineMessageStatus): string {
  const map: Record<LineMessageStatus, string> = {
    pending:   '送信中',
    sent:      '送信済み',
    failed:    '失敗',
    cancelled: 'キャンセル',
  };
  return map[status] ?? status;
}

export function lineQueueStatusLabel(status: LineQueueStatus): string {
  const map: Record<LineQueueStatus, string> = {
    scheduled:  '予約済み',
    processing: '処理中',
    sent:       '送信済み',
    failed:     '失敗',
    cancelled:  'キャンセル',
  };
  return map[status] ?? status;
}

export function lineMessagePurposeLabel(purpose: LineMessagePurpose): string {
  const map: Record<LineMessagePurpose, string> = {
    manual:               '手動送信',
    completion_report:    '完了報告',
    maintenance_reminder: 'メンテナンス通知',
    reservation:          '予約案内',
    campaign:             'キャンペーン',
    system:               'システム',
  };
  return map[purpose] ?? purpose;
}
