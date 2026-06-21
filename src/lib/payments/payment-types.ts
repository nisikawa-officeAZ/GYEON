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

export interface PaymentDB {
  id:             string;
  dealer_id:      string;
  invoice_id:     string;
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

  // Joined relations
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
  invoice_id:     string;
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

export type PaymentUpdateInput = Partial<Omit<PaymentInput, 'invoice_id'>>;

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

export function paymentCustomerName(
  customers: PaymentDB['customers']
): string {
  if (!customers) return '—';
  return [customers.last_name, customers.first_name].filter(Boolean).join(' ') || '—';
}
