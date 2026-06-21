// DealerOS — Invoice Types (PHASE42)
// Column names match the Supabase invoices / invoice_items tables exactly.

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled';

export type InvoiceCategory =
  | 'coating' | 'ppf' | 'window' | 'interior' | 'glass' | 'other';

export interface InvoiceItemDB {
  id:            string;
  invoice_id:    string;
  dealer_id:     string;
  category:      InvoiceCategory;
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

export interface InvoiceDB {
  id:                   string;
  dealer_id:            string;
  customer_id:          string | null;
  vehicle_id:           string | null;
  estimate_id:          string | null;
  work_order_id:        string | null;
  completion_report_id: string | null;
  invoice_number:       string | null;
  status:               InvoiceStatus;
  title:                string | null;
  issue_date:           string | null;
  due_date:             string | null;
  subtotal:             number;
  discount_amount:      number;
  tax_rate:             number;
  tax_amount:           number;
  total:                number;
  paid_amount:          number;
  balance_due:          number;
  notes:                string | null;
  internal_memo:        string | null;
  pdf_file_path:        string | null;
  pdf_file_url:         string | null;
  deleted_at:           string | null;
  created_at:           string;
  updated_at:           string;

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
    color:        string | null;
  } | null;
  estimates?: {
    estimate_number: string | null;
    title:           string | null;
    total:           number;
  } | null;
  work_orders?: {
    work_order_number: string | null;
    title:             string | null;
    status:            string;
  } | null;
  invoice_items?: InvoiceItemDB[];
}

// ─── Input types ─────────────────────────────────────────────────────────────

export type InvoiceItemInput = {
  category:              InvoiceCategory;
  item_name:             string;
  description:           string;
  quantity:              number;
  unit_price:            number;
  discount_rate:         number;
  sort_order:            number;
  // Product link (optional)
  item_type?:            "manual" | "product";
  product_id?:           string | null;
  sku?:                  string | null;
  product_name_snapshot?: string | null;
  retail_price_snapshot?: number | null;
};

export type InvoiceInput = {
  dealer_id:            string;   // server-injected
  customer_id:          string | null;
  vehicle_id:           string | null;
  estimate_id:          string | null;
  work_order_id:        string | null;
  completion_report_id: string | null;
  invoice_number:       string | null;
  status:               InvoiceStatus;
  title:                string | null;
  issue_date:           string | null;
  due_date:             string | null;
  subtotal:             number;
  discount_amount:      number;
  tax_rate:             number;
  tax_amount:           number;
  total:                number;
  paid_amount:          number;
  balance_due:          number;
  notes:                string | null;
  internal_memo:        string | null;
};

export type InvoiceUpdateInput = Partial<Omit<InvoiceInput, 'dealer_id'>>;

// ─── Calculation ──────────────────────────────────────────────────────────────

export interface InvoiceTotals {
  subtotal:        number;
  tax_amount:      number;
  total:           number;
  balance_due:     number;
}

export function calculateInvoiceTotals(
  items:          { quantity: number; unit_price: number; discount_rate: number }[],
  discountAmount: number,
  taxRate:        number,
  paidAmount:     number,
): InvoiceTotals {
  const subtotal   = items.reduce((s, item) => {
    return s + Math.round(item.quantity * item.unit_price * (1 - item.discount_rate / 100));
  }, 0);
  const taxBase    = subtotal - discountAmount;
  const taxAmount  = Math.floor(taxBase * taxRate / 100);
  const total      = taxBase + taxAmount;
  const balanceDue = total - paidAmount;
  return { subtotal, tax_amount: taxAmount, total, balance_due: balanceDue };
}

export function lineTotal(
  quantity: number, unitPrice: number, discountRate: number
): number {
  return Math.round(quantity * unitPrice * (1 - discountRate / 100));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          '下書き',
  issued:         '発行済み',
  paid:           '入金済み',
  partially_paid: '一部入金',
  overdue:        '期限超過',
  cancelled:      'キャンセル',
};

const CATEGORY_LABELS: Record<InvoiceCategory, string> = {
  coating:  'コーティング',
  ppf:      'PPF',
  window:   'ウィンドウ',
  interior: 'インテリア',
  glass:    'ガラス',
  other:    'その他',
};

export const INVOICE_CATEGORIES: { value: InvoiceCategory; label: string }[] = [
  { value: 'coating',  label: 'コーティング' },
  { value: 'ppf',      label: 'PPF' },
  { value: 'window',   label: 'ウィンドウ' },
  { value: 'interior', label: 'インテリア' },
  { value: 'glass',    label: 'ガラス' },
  { value: 'other',    label: 'その他' },
];

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft',          label: '下書き' },
  { value: 'issued',         label: '発行済み' },
  { value: 'paid',           label: '入金済み' },
  { value: 'partially_paid', label: '一部入金' },
  { value: 'overdue',        label: '期限超過' },
  { value: 'cancelled',      label: 'キャンセル' },
];

export function invoiceStatusLabel(status: InvoiceStatus | string): string {
  return STATUS_LABELS[status as InvoiceStatus] ?? status;
}

export function invoiceCategoryLabel(category: InvoiceCategory | string): string {
  return CATEGORY_LABELS[category as InvoiceCategory] ?? category;
}

export function invoiceDisplayNo(
  inv: Pick<InvoiceDB, 'invoice_number' | 'id'>
): string {
  return inv.invoice_number ?? `INV-${inv.id.slice(0, 8).toUpperCase()}`;
}

export function invoiceCustomerName(
  customers: InvoiceDB['customers']
): string {
  if (!customers) return '—';
  return [customers.last_name, customers.first_name].filter(Boolean).join(' ') || '—';
}

export function invoiceVehicleLabel(
  vehicles: InvoiceDB['vehicles']
): string {
  if (!vehicles) return '—';
  return [vehicles.maker, vehicles.model, vehicles.plate_number].filter(Boolean).join(' ') || '—';
}
