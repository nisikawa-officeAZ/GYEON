// DealerOS — Maintenance Reminder types (PHASE48)

export type MaintenanceReminderType =
  | 'maintenance'
  | 'coating_check'
  | 'ppf_check'
  | 'inspection'
  | 'custom';

export type MaintenanceReminderStatus =
  | 'scheduled'
  | 'queued'
  | 'sent'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface MaintenanceReminderDB {
  id:                string;
  dealer_id:         string;
  customer_id:       string;
  vehicle_id:        string | null;
  work_order_id:     string | null;
  reminder_number:   string | null;
  title:             string | null;
  reminder_type:     MaintenanceReminderType;
  status:            MaintenanceReminderStatus;
  due_date:          string | null;    // date ISO "YYYY-MM-DD"
  scheduled_send_at: string | null;   // timestamptz
  sent_at:           string | null;
  line_queue_id:     string | null;
  message_title:     string | null;
  message_body:      string | null;
  notes:             string | null;
  internal_memo:     string | null;
  created_at:        string;
  updated_at:        string;

  // Joined
  customers?: {
    last_name:  string | null;
    first_name: string | null;
    phone:      string | null;
  } | null;
  vehicles?: {
    maker:        string | null;
    model:        string | null;
    grade:        string | null;
    plate_number: string | null;
  } | null;
  work_orders?: {
    work_order_number: string | null;
    title:             string | null;
    status:            string;
  } | null;
}

export interface MaintenanceReminderInput {
  customer_id:       string;
  vehicle_id?:       string | null;
  work_order_id?:    string | null;
  reminder_number?:  string | null;
  title?:            string | null;
  reminder_type?:    MaintenanceReminderType;
  status?:           MaintenanceReminderStatus;
  due_date?:         string | null;
  scheduled_send_at?: string | null;
  message_title?:    string | null;
  message_body?:     string | null;
  notes?:            string | null;
  internal_memo?:    string | null;
}

export interface MaintenanceReminderUpdateInput {
  title?:            string | null;
  reminder_type?:    MaintenanceReminderType;
  status?:           MaintenanceReminderStatus;
  due_date?:         string | null;
  scheduled_send_at?: string | null;
  message_title?:    string | null;
  message_body?:     string | null;
  notes?:            string | null;
  internal_memo?:    string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function maintenanceReminderTypeLabel(type: MaintenanceReminderType): string {
  const map: Record<MaintenanceReminderType, string> = {
    maintenance:    'メンテナンス',
    coating_check:  'コーティング確認',
    ppf_check:      'PPF確認',
    inspection:     '車検・点検',
    custom:         'カスタム',
  };
  return map[type] ?? type;
}

export function maintenanceReminderStatusLabel(status: MaintenanceReminderStatus): string {
  const map: Record<MaintenanceReminderStatus, string> = {
    scheduled:  '予定',
    queued:     'キュー済み',
    sent:       '送信済み',
    completed:  '完了',
    cancelled:  'キャンセル',
    failed:     '失敗',
  };
  return map[status] ?? status;
}

export function maintenanceReminderDisplayNo(r: Pick<MaintenanceReminderDB, 'reminder_number' | 'id'>): string {
  return r.reminder_number ?? `MR-${r.id.slice(0, 8).toUpperCase()}`;
}

export function maintenanceCustomerName(r: MaintenanceReminderDB): string {
  if (!r.customers) return "—";
  return [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ") || "—";
}

export function maintenanceVehicleLabel(r: MaintenanceReminderDB): string {
  if (!r.vehicles) return "—";
  const { maker, model, grade, plate_number } = r.vehicles;
  return [maker, model, grade, plate_number].filter(Boolean).join(" ") || "—";
}

export function defaultMaintenanceMessage(
  type: MaintenanceReminderType,
  vehicleLabel?: string
): { title: string; body: string } {
  const vehicle = vehicleLabel ? `【${vehicleLabel}】` : "";
  switch (type) {
    case "coating_check":
      return {
        title: "コーティングメンテナンスのご案内",
        body:  `${vehicle}コーティングのメンテナンス時期になりました。\n施工後の状態を最良に保つため、ぜひメンテナンスをご検討ください。\nご予約・お問い合わせはお気軽にどうぞ。`,
      };
    case "ppf_check":
      return {
        title: "PPF点検のご案内",
        body:  `${vehicle}PPFの点検時期になりました。\n剥がれや気泡がないかご確認させていただきます。\nご予約・お問い合わせはお気軽にどうぞ。`,
      };
    case "inspection":
      return {
        title: "車検・点検のご案内",
        body:  `${vehicle}車検・定期点検の時期が近づいております。\nお早めにご予約いただけますとスムーズにご対応できます。`,
      };
    case "maintenance":
    default:
      return {
        title: "メンテナンスのご案内",
        body:  `${vehicle}メンテナンスの時期になりました。\n以前の施工状態を維持するため、定期的なメンテナンスをお勧めしております。\nご予約・お問い合わせはお気軽にどうぞ。`,
      };
  }
}

export const MAINTENANCE_REMINDER_TYPES: MaintenanceReminderType[] = [
  'maintenance',
  'coating_check',
  'ppf_check',
  'inspection',
  'custom',
];

export const MAINTENANCE_REMINDER_STATUSES: MaintenanceReminderStatus[] = [
  'scheduled',
  'queued',
  'sent',
  'completed',
  'cancelled',
  'failed',
];
