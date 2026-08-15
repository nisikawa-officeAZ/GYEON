// DealerOS — Estimate Types (PHASE38 rebuild)
// Column names match the Supabase estimates table exactly (snake_case).
// Supports both legacy uppercase status values and new lowercase values.

// ── Estimate WORKFLOW status (business lifecycle) ─────────────────────────────
// SENT is NOT a workflow status. Transmission (LINE / email / PDF) is tracked
// separately as history — see the 送信履歴 area on the estimate detail screen.
export const ESTIMATE_WORKFLOW_STATUSES = [
  'draft', 'proposal', 'approved', 'lost', 'accepted', 'in_progress', 'completed', 'invoiced',
] as const;
export type EstimateWorkflowStatus = typeof ESTIMATE_WORKFLOW_STATUSES[number];

export const ESTIMATE_STATUS_LABELS: Record<EstimateWorkflowStatus, string> = {
  draft:       '下書き',
  proposal:    '提案中',
  approved:    '承認',
  lost:        '失注',
  accepted:    '受注',
  in_progress: '作業中',
  completed:   '完了',
  invoiced:    '請求済',
};

// EstimateStatus accepts canonical workflow values AND legacy stored values
// (legacy 'sent'/'SENT' → displayed as 提案中; 'rejected' → 失注) until migration 099.
export type EstimateStatus =
  | EstimateWorkflowStatus
  | 'sent' | 'rejected' | 'expired'
  | 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';

export type EstimateCategory =
  | 'coating' | 'ppf' | 'window' | 'interior' | 'glass' | 'other'
  | 'maintenance' | 'carwash' | 'roomclean'; // Plan A (migration 093, gated by ESTIMATE_TAXONOMY_READY)

export interface EstimateItemDB {
  id:            string;
  estimate_id:   string;
  dealer_id:     string;
  category:      EstimateCategory;
  item_name:     string;
  description:   string | null;
  quantity:      number;
  unit_price:    number;
  discount_rate: number;
  line_total:    number;
  sort_order:    number;
  created_at:    string;
  updated_at:    string;
}

export interface EstimateDB {
  id:              string;
  customer_id:     string;
  vehicle_id:      string;
  estimate_no:     string;       // legacy — kept for backward compat
  estimate_number: string | null; // new
  title:           string | null;
  status:          EstimateStatus;
  subtotal:        number;
  tax:             number;       // legacy — kept for backward compat
  tax_rate:        number;
  tax_amount:      number;
  discount_amount: number;
  total:           number;
  valid_until:     string | null;
  notes:           string | null;
  internal_memo:   string | null;
  dealer_id:       string | null;
  deleted_at:      string | null;
  created_at:      string;
  updated_at:      string;

  // Joined relations
  customers?: {
    last_name:  string | null;
    first_name: string | null;
    phone:       string | null;
    email:       string | null;
    postal_code: string | null; // 〒 (PDF customer block; omitted when unset)
    address1:    string | null; // 住所 (PDF customer block)
    is_business: boolean | null; // 法人フラグ → 御中 / 様
  } | null;
  vehicles?: {
    maker:                  string | null;
    model:                  string | null;
    year:                   string | null;
    grade:                  string | null;
    color:                  string | null; // ボディカラー (PDF left column)
    mileage:                number | null; // 走行距離 (PDF; omitted when never recorded)
    plate_number:           string | null;
    body_size:              string | null;
    registration_date:      string | null; // 登録年月日 (current registration)
    inspection_expiry_date: string | null; // 車検満了日
  } | null;
  estimate_items?: EstimateItemDB[];
}

// Helpers
export function estimateDisplayNo(e: Pick<EstimateDB, 'estimate_number' | 'estimate_no'>): string {
  return e.estimate_number ?? e.estimate_no ?? '—';
}

// Normalize any stored/legacy status → canonical WORKFLOW status for display.
// SENT is transmission, not workflow → legacy 'sent' rows display as 'proposal'.
export function normalizeEstimateStatus(status: string): EstimateWorkflowStatus | null {
  switch (String(status).toLowerCase()) {
    case 'draft':       return 'draft';
    case 'sent':                        // legacy: SENT is transmission → show as 提案中
    case 'proposal':    return 'proposal';
    case 'approved':    return 'approved';
    case 'rejected':                    // legacy 却下 → 失注
    case 'lost':        return 'lost';
    case 'accepted':    return 'accepted';
    case 'in_progress': return 'in_progress';
    case 'completed':   return 'completed';
    case 'invoiced':    return 'invoiced';
    default:            return null;    // e.g. legacy 'expired'
  }
}

export function estimateStatusLabel(status: EstimateStatus): string {
  const canonical = normalizeEstimateStatus(String(status));
  if (canonical) return ESTIMATE_STATUS_LABELS[canonical];
  if (String(status).toLowerCase() === 'expired') return '期限切れ';
  return String(status);
}

export function estimateCustomerName(
  customers: EstimateDB['customers']
): string {
  if (!customers) return '—';
  return [customers.last_name, customers.first_name].filter(Boolean).join(' ') || '—';
}

export function estimateVehicleLabel(
  vehicles: EstimateDB['vehicles']
): string {
  if (!vehicles) return '—';
  return [vehicles.maker, vehicles.model, vehicles.plate_number].filter(Boolean).join(' ') || '—';
}
