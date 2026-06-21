// DealerOS — Work Order Types (PHASE39)
// Column names match the Supabase work_orders table exactly (snake_case).

export type WorkOrderStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export interface WorkOrderDB {
  id:                 string;
  dealer_id:          string;
  estimate_id:        string | null;
  customer_id:        string | null;
  vehicle_id:         string | null;
  work_order_number:  string | null;
  status:             WorkOrderStatus;
  title:              string | null;
  scheduled_start_at: string | null;
  scheduled_end_at:   string | null;
  actual_start_at:    string | null;
  actual_end_at:      string | null;
  assigned_staff:     string | null;
  service_summary:    string | null;
  notes:              string | null;
  internal_memo:      string | null;
  deleted_at:         string | null;
  created_at:         string;
  updated_at:         string;

  // Joined relations
  customers?: {
    last_name:  string | null;
    first_name: string | null;
  } | null;
  vehicles?: {
    maker:        string | null;
    model:        string | null;
    grade:        string | null;
    plate_number: string | null;
  } | null;
  estimates?: {
    estimate_number: string | null;
    title:           string | null;
    total:           number;
    status:          string;
    estimate_items?: {
      id:            string;
      category:      string;
      item_name:     string;
      description:   string | null;
      quantity:      number;
      unit_price:    number;
      discount_rate: number;
      line_total:    number;
      sort_order:    number;
    }[];
  } | null;
}

// Fields for INSERT
export type WorkOrderInput = {
  dealer_id:          string;   // server-injected
  estimate_id:        string | null;
  customer_id:        string | null;
  vehicle_id:         string | null;
  work_order_number:  string | null;
  status:             WorkOrderStatus;
  title:              string | null;
  scheduled_start_at: string | null;
  scheduled_end_at:   string | null;
  actual_start_at:    string | null;
  actual_end_at:      string | null;
  assigned_staff:     string | null;
  service_summary:    string | null;
  notes:              string | null;
  internal_memo:      string | null;
};

// Fields for UPDATE (all optional except id & dealer_id used as scope)
export type WorkOrderUpdateInput = Partial<Omit<WorkOrderInput, 'dealer_id'>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  scheduled:   '予定',
  in_progress: '施工中',
  completed:   '完了',
  cancelled:   'キャンセル',
  on_hold:     '保留',
};

export function workOrderStatusLabel(status: WorkOrderStatus | string): string {
  return STATUS_LABELS[status as WorkOrderStatus] ?? status;
}

export function workOrderDisplayNo(wo: Pick<WorkOrderDB, 'work_order_number' | 'id'>): string {
  return wo.work_order_number ?? wo.id.slice(0, 8).toUpperCase();
}

export function workOrderCustomerName(
  customers: WorkOrderDB['customers']
): string {
  if (!customers) return '—';
  return [customers.last_name, customers.first_name].filter(Boolean).join(' ') || '—';
}

export function workOrderVehicleLabel(
  vehicles: WorkOrderDB['vehicles']
): string {
  if (!vehicles) return '—';
  return [vehicles.maker, vehicles.model, vehicles.plate_number].filter(Boolean).join(' ') || '—';
}
