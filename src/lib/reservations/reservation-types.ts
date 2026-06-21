// Pure types — no "use server" directive

export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type ReservationServiceType = "coating" | "maintenance" | "ppf" | "window" | "wheel" | "interior" | "other";

export interface ReservationDB {
  id:                 string;
  dealer_id:          string;
  reservation_number: string | null;
  customer_id:        string | null;
  vehicle_id:         string | null;
  work_order_id:      string | null;
  reservation_date:   string;   // ISO date "YYYY-MM-DD"
  start_time:         string | null;  // "HH:MM:SS"
  end_time:           string | null;
  service_type:       ReservationServiceType;
  assigned_staff_id:  string | null;
  status:             ReservationStatus;
  notes:              string | null;
  calendar_provider:  string | null;
  external_event_id:  string | null;
  created_at:         string;
  updated_at:         string;

  // Joined
  customers?: { last_name: string | null; first_name: string | null; phone: string | null } | null;
  vehicles?:  { maker: string | null; model: string | null; plate_number: string | null } | null;
}

export function reservationDisplayNo(r: ReservationDB): string {
  return r.reservation_number ?? `RSV-${r.id.slice(0, 8).toUpperCase()}`;
}

export function reservationStatusLabel(status: ReservationStatus): string {
  switch (status) {
    case "pending":   return "仮予約";
    case "confirmed": return "確定";
    case "completed": return "完了";
    case "cancelled": return "キャンセル";
    case "no_show":   return "無断キャンセル";
  }
}

export function reservationStatusColor(status: ReservationStatus): string {
  switch (status) {
    case "pending":   return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "confirmed": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "completed": return "bg-green-500/10 text-green-400 border-green-500/30";
    case "cancelled": return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    case "no_show":   return "bg-red-500/10 text-red-400 border-red-500/30";
  }
}

export function serviceTypeLabel(type: ReservationServiceType): string {
  switch (type) {
    case "coating":     return "コーティング";
    case "maintenance": return "メンテナンス";
    case "ppf":         return "PPF";
    case "window":      return "ウィンドウフィルム";
    case "wheel":       return "ホイールコーティング";
    case "interior":    return "内装施工";
    case "other":       return "その他";
  }
}

export function serviceTypeColor(type: ReservationServiceType): string {
  switch (type) {
    case "coating":     return "bg-blue-600";
    case "maintenance": return "bg-green-600";
    case "ppf":         return "bg-purple-600";
    case "window":      return "bg-cyan-600";
    case "wheel":       return "bg-orange-600";
    case "interior":    return "bg-pink-600";
    case "other":       return "bg-slate-600";
  }
}
