// PHASE64: Billing types and helpers.
// No "use server" directive — types only. Import freely from client or server code.

export type ContractStatus = "trial" | "active" | "expired" | "cancelled" | "suspended";
export type InvoiceStatus  = "draft" | "issued" | "paid" | "overdue" | "cancelled";
export type Currency       = "JPY";

export const PLAN_CODES = ["trial", "basic", "pro", "pro_plus"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export interface DealerBilling {
  id:              string;
  dealer_id:       string;
  plan_code:       string;
  contract_status: ContractStatus;
  started_at:      string | null;
  expires_at:      string | null;
  renewal_date:    string | null;
  cancelled_at:    string | null;
  notes:           string | null;
  created_at:      string;
  updated_at:      string;
}

export interface BillingInvoice {
  id:             string;
  dealer_id:      string;
  invoice_number: string;
  plan_code:      string;
  amount:         number;
  currency:       Currency;
  status:         InvoiceStatus;
  issued_at:      string | null;
  due_at:         string | null;
  paid_at:        string | null;
  notes:          string | null;
  created_at:     string;
}

export interface DealerBillingWithInvoices extends DealerBilling {
  dealer_name?: string;
  invoices:     BillingInvoice[];
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export function contractStatusLabel(s: ContractStatus): string {
  switch (s) {
    case "trial":     return "トライアル";
    case "active":    return "有効";
    case "expired":   return "期限切れ";
    case "cancelled": return "解約済み";
    case "suspended": return "停止中";
  }
}

export function contractStatusColor(s: ContractStatus): string {
  switch (s) {
    case "trial":     return "text-blue-300 border-blue-700/50 bg-blue-950/30";
    case "active":    return "text-green-300 border-green-700/50 bg-green-950/30";
    case "expired":   return "text-orange-300 border-orange-700/50 bg-orange-950/30";
    case "cancelled": return "text-slate-400 border-slate-700/50 bg-slate-900/30";
    case "suspended": return "text-red-300 border-red-700/50 bg-red-950/30";
  }
}

export function invoiceStatusLabel(s: InvoiceStatus): string {
  switch (s) {
    case "draft":     return "下書き";
    case "issued":    return "発行済み";
    case "paid":      return "入金済み";
    case "overdue":   return "支払い期限超過";
    case "cancelled": return "キャンセル";
  }
}

export function invoiceStatusColor(s: InvoiceStatus): string {
  switch (s) {
    case "draft":     return "text-slate-400 border-slate-700/50 bg-slate-900/30";
    case "issued":    return "text-blue-300 border-blue-700/50 bg-blue-950/30";
    case "paid":      return "text-green-300 border-green-700/50 bg-green-950/30";
    case "overdue":   return "text-red-300 border-red-700/50 bg-red-950/30";
    case "cancelled": return "text-slate-500 border-slate-700/50 bg-slate-900/20";
  }
}

export function planCodeLabel(p: string): string {
  switch (p) {
    case "trial":    return "Trial";
    case "basic":    return "Basic";
    case "pro":      return "Pro";
    case "pro_plus": return "Pro Plus";
    default:         return p;
  }
}

export function formatJPY(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}
