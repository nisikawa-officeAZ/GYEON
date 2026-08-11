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

// ─── Completion authority (GDA-1W, accepted contract) ─────────────────────────
// The atomic completion operation is `public.complete_work_order_v1`; the pure
// validation/fingerprint rules live in work-order-completion-contract-core.ts.
// These types are the wire shapes the later server adapter binds to that RPC.

import type {
  PerformedWorkItemInput,
  WorkOrderCompletionDomainError,
  WorkOrderCompletionOutcome,
} from './work-order-completion-contract-core';

export type {
  PerformedWorkItemInput,
  WorkOrderCompletionDomainError,
  WorkOrderCompletionOutcome,
} from './work-order-completion-contract-core';

/**
 * The completion command as the CLIENT may express it (§5.1): the four RPC
 * inputs and nothing else. There is deliberately no dealer_id, actor, role,
 * report id/number/date/status, confirmation, version, shared state, or any
 * monetary value here — the database derives or owns all of those.
 *
 * `actualEndAt` is an ISO-8601 instant string (timestamptz on the wire);
 * `performedItems` is the monetary-free snapshot, exactly three fields per
 * item, order-significant (sort order is server-derived from array position).
 */
export interface CompleteWorkOrderCommand {
  workOrderId:     string;
  idempotencyKey:  string;   // generated once, retained for every retry of the same intent
  actualEndAt:     string;
  performedItems:  readonly PerformedWorkItemInput[];
}

/**
 * The single result row of `public.complete_work_order_v1`, snake_case exactly
 * as the RPC returns it (§5.1). `outcome` is 'created' | 'replayed' |
 * 'recovered'; `created` is true only for 'created', `replayed` is true when
 * existing authority was returned.
 */
export interface CompleteWorkOrderRpcRow {
  work_order_id:          string;
  completion_report_id:   string;
  report_number:          string;
  performed_work_version: number;
  request_fingerprint:    string;
  outcome:                WorkOrderCompletionOutcome;
  created:                boolean;
  replayed:               boolean;
}

/** Discriminated adapter result: a stable domain code, never raw SQL text (§6). */
export type CompleteWorkOrderResult =
  | { ok: true;  result: CompleteWorkOrderRpcRow }
  | { ok: false; code: WorkOrderCompletionDomainError };

/**
 * Columns the GENERIC update path must never write (§7.1): completion state is
 * entered/left and `actual_end_at` is set only by the completion authority
 * operations. The database enforces this independently (column grants plus the
 * transition guard trigger); this list lets the adapter strip the fields
 * before they ever reach a query rather than discovering the denial as an
 * error.
 */
export const WORK_ORDER_COMPLETION_PROTECTED_FIELDS = ['actual_end_at'] as const;
export type WorkOrderCompletionProtectedField =
  (typeof WORK_ORDER_COMPLETION_PROTECTED_FIELDS)[number];

/**
 * The generic update surface with the completion-protected column removed.
 * `status` remains present for ordinary non-completion transitions, but
 * 'completed' is excluded from its type: the raw grant keeps the column
 * writable while the guard trigger rejects any raw change entering or leaving
 * 'completed'.
 */
export type WorkOrderGenericUpdateInput =
  Omit<WorkOrderUpdateInput, WorkOrderCompletionProtectedField | 'status'> & {
    status?: Exclude<WorkOrderStatus, 'completed'>;
  };

/**
 * Strip the completion-protected fields (and a 'completed' status) from an
 * arbitrary update input. Pure and non-mutating; the returned object is safe
 * for the generic update path. This is convenience, not security — the
 * database guard remains the authority.
 */
export function stripCompletionProtectedFields(
  input: WorkOrderUpdateInput
): WorkOrderGenericUpdateInput {
  const { actual_end_at: _actual_end_at, status, ...rest } = input;
  if (status === undefined || status === 'completed') {
    return rest;
  }
  return { ...rest, status };
}

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
