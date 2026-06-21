// DealerOS — Estimate Types (PHASE38 rebuild)
// Column names match the Supabase estimates table exactly (snake_case).
// Supports both legacy uppercase status values and new lowercase values.

export type EstimateStatus =
  | 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'
  | 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';

export type EstimateCategory =
  | 'coating' | 'ppf' | 'window' | 'interior' | 'glass' | 'other';

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
    phone:      string | null;
    email:      string | null;
  } | null;
  vehicles?: {
    maker:        string | null;
    model:        string | null;
    year:         string | null;
    grade:        string | null;
    plate_number: string | null;
  } | null;
  estimate_items?: EstimateItemDB[];
}

// Helpers
export function estimateDisplayNo(e: Pick<EstimateDB, 'estimate_number' | 'estimate_no'>): string {
  return e.estimate_number ?? e.estimate_no ?? '—';
}

export function estimateStatusLabel(status: EstimateStatus): string {
  switch (status.toLowerCase()) {
    case 'draft':    return '下書き';
    case 'sent':     return '送付済み';
    case 'approved': return '承認済み';
    case 'rejected': return '却下';
    case 'expired':  return '期限切れ';
    default:         return status;
  }
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
