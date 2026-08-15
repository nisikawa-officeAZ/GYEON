// DealerOS — Payment Types (PHASE43)

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'credit_card'
  | 'paypay'
  | 'other';

export type PaymentStatus =
  | 'completed'
  | 'pending'
  | 'cancelled'
  | 'refunded';

// B3-B1B I1: how a payment is applied. legacy_direct = bound to one invoice at creation
// (invoice-detail flow only); allocated = split across invoices via payment_allocations;
// unapplied = customer credit with no allocations yet.
export type PaymentMode = 'legacy_direct' | 'allocated' | 'unapplied';

export interface PaymentDB {
  id:             string;
  dealer_id:      string;
  invoice_id:     string | null;
  customer_id:    string | null;
  payment_number: string | null;
  payment_date:   string | null;
  payment_method: PaymentMethod;
  amount:         number;
  fee_amount:     number;
  net_amount:     number;
  status:         PaymentStatus;
  reference_no:   string | null;
  notes:          string | null;
  internal_memo:  string | null;
  created_at:     string;
  updated_at:     string;

  // I1-R1 read-model field (invoice-scoped reads only): the amount applied to the
  // REQUESTED invoice — the full payment amount for a legacy-direct row, or only the
  // persisted allocated_amount for an allocated row. Display-only; never an input.
  invoice_context_amount?: number;

  // Joined relations
  payment_allocations?: { allocated_amount: number }[] | null;
  invoices?: {
    invoice_number: string | null;
    title:          string | null;
    total:          number;
    paid_amount:    number;
    balance_due:    number;
    status:         string;
  } | null;
  customers?: {
    last_name:  string | null;
    first_name: string | null;
  } | null;
}

export type PaymentInput = {
  invoice_id:     string | null;
  payment_number: string | null;
  payment_date:   string | null;
  payment_method: PaymentMethod;
  amount:         number;
  fee_amount:     number;
  status:         PaymentStatus;
  reference_no:   string | null;
  notes:          string | null;
  internal_memo:  string | null;
};

// I1-R1: after creation, ONLY the two non-financial memo fields are updatable.
export type PaymentUpdateInput = {
  notes:         string | null;
  internal_memo: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          '現金',
  bank_transfer: '銀行振込',
  credit_card:   'クレジットカード',
  paypay:        'PayPay',
  other:         'その他',
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  completed: '完了',
  pending:   '保留',
  cancelled: 'キャンセル',
  refunded:  '返金',
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: '現金' },
  { value: 'bank_transfer', label: '銀行振込' },
  { value: 'credit_card',   label: 'クレジットカード' },
  { value: 'paypay',        label: 'PayPay' },
  { value: 'other',         label: 'その他' },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'completed', label: '完了' },
  { value: 'pending',   label: '保留' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'refunded',  label: '返金' },
];

export function paymentMethodLabel(method: PaymentMethod | string): string {
  return METHOD_LABELS[method as PaymentMethod] ?? method;
}

export function paymentStatusLabel(status: PaymentStatus | string): string {
  return STATUS_LABELS[status as PaymentStatus] ?? status;
}

export function paymentDisplayNo(
  p: Pick<PaymentDB, 'payment_number' | 'id'>
): string {
  return p.payment_number ?? `PAY-${p.id.slice(0, 8).toUpperCase()}`;
}

export function calculateNetAmount(amount: number, feeAmount: number): number {
  return Math.max(0, amount - feeAmount);
}

// ─── B3-B1B I1: allocation + global-creation option types ─────────────────────

/** One allocation row submitted to the recording/conversion RPCs. */
export type PaymentAllocationInput = {
  invoice_id:       string;
  allocated_amount: number;
  allocation_order: number;
};

/** Persisted allocation row with the invoice display fields the UI needs. */
export interface PaymentAllocationRow {
  id:               string;
  payment_id:       string;
  invoice_id:       string;
  allocated_amount: number;
  allocation_order: number;
  invoices?: {
    invoice_number: string | null;
    title:          string | null;
    due_date:       string | null;
    total:          number;
    balance_due:    number;
    status:         string;
  } | null;
}

/** Dealer-scoped customer option for the global payment creation flow. */
export interface PayableCustomerOption {
  id:         string;
  name:       string | null;
  last_name:  string | null;
  first_name: string | null;
}

/** Open (payable) invoice option for the allocation editor. */
export interface OpenInvoiceOption {
  id:             string;
  invoice_number: string | null;
  title:          string | null;
  due_date:       string | null;
  total:          number;
  paid_amount:    number;
  balance_due:    number;
  status:         string;
}

/**
 * Derives the DISPLAY mode of a persisted payment. invoice_id wins (legacy_direct);
 * otherwise any allocation row means allocated; otherwise the amount is unapplied credit.
 * Display-only — the database rows remain the financial authority.
 */
export function derivePaymentMode(p: Pick<PaymentDB, 'invoice_id' | 'payment_allocations'>): PaymentMode {
  if (p.invoice_id) return 'legacy_direct';
  if ((p.payment_allocations ?? []).length > 0) return 'allocated';
  return 'unapplied';
}

export function paymentModeLabel(mode: PaymentMode): string {
  switch (mode) {
    case 'legacy_direct': return '請求書直接';
    case 'allocated':     return '割当';
    case 'unapplied':     return '前受金';
  }
}

/** Sum of a payment's allocations (display helper only). */
export function allocatedTotal(p: Pick<PaymentDB, 'payment_allocations'>): number {
  return (p.payment_allocations ?? []).reduce((s, a) => s + a.allocated_amount, 0);
}

export function paymentCustomerName(
  customers: PaymentDB['customers']
): string {
  if (!customers) return '—';
  return [customers.last_name, customers.first_name].filter(Boolean).join(' ') || '—';
}
