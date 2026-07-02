// DealerOS — Accounts Receivable calculations (Phase E8.6, pure, no schema).
//
// Single source for AR math over EXISTING stored invoice/payment values
// (invoice.total / paid_amount, payment.amount). Never mutates invoice totals.
// Reusable by the customer AR panel, invoice screen, and future dashboard /
// reports / accounting export — no duplicated calculations.

export type ARStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue";

export const AR_STATUS_LABEL: Record<ARStatus, string> = {
  draft:          "下書き",
  issued:         "発行済み",
  partially_paid: "一部入金",
  paid:           "入金済み",
  overdue:        "期限超過",
};

export interface ARInvoice {
  total?:       number | null;
  paid_amount?: number | null;
  due_date?:    string | null;
  status?:      string | null;
}

export interface ARPayment {
  payment_date?: string | null;
  amount?:       number | null;
  status?:       string | null;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Outstanding = max(0, total − paid). Display/derivation only; totals unchanged.
export function invoiceOutstanding(inv: ARInvoice): number {
  return Math.max(0, num(inv.total) - num(inv.paid_amount));
}

// Payment progress percent, clamped to [0, 100].
export function paymentProgress(inv: ARInvoice): number {
  const total = num(inv.total);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((num(inv.paid_amount) / total) * 100)));
}

// Computed (non-persisted) invoice status from amounts + due date.
export function computeInvoiceStatus(inv: ARInvoice, today: string): ARStatus {
  const total = num(inv.total);
  const outstanding = Math.max(0, total - num(inv.paid_amount));
  if (total > 0 && outstanding <= 0) return "paid";
  if (outstanding > 0 && inv.due_date && inv.due_date < today) return "overdue";
  if (num(inv.paid_amount) > 0 && outstanding > 0) return "partially_paid";
  if (inv.status === "draft") return "draft";
  return "issued";
}

export interface AccountsReceivableSummary {
  totalInvoiced:    number;
  totalPaid:        number;
  outstanding:      number;
  invoiceCount:     number;
  outstandingCount: number;   // invoices with a remaining balance
  overdueCount:     number;
  nextDueDate:      string | null;
  lastPaymentDate:  string | null;
  status:           ARStatus; // customer-level computed statement status
}

export function summarizeAccountsReceivable(
  invoices: readonly ARInvoice[],
  payments: readonly ARPayment[],
  today: string,
): AccountsReceivableSummary {
  const active = (invoices ?? []).filter((i) => i.status !== "cancelled");

  let totalInvoiced = 0, totalPaid = 0, outstanding = 0, outstandingCount = 0, overdueCount = 0;
  let nextDueDate: string | null = null;

  for (const inv of active) {
    const total = num(inv.total);
    const paid = num(inv.paid_amount);
    const out = Math.max(0, total - paid);
    totalInvoiced += total;
    totalPaid += paid;
    outstanding += out;
    if (out > 0) {
      outstandingCount += 1;
      if (inv.due_date && (nextDueDate === null || inv.due_date < nextDueDate)) nextDueDate = inv.due_date;
    }
    if (computeInvoiceStatus(inv, today) === "overdue") overdueCount += 1;
  }

  let lastPaymentDate: string | null = null;
  for (const p of payments ?? []) {
    if (p.status && p.status !== "completed") continue;
    if (p.payment_date && (lastPaymentDate === null || p.payment_date > lastPaymentDate)) {
      lastPaymentDate = p.payment_date;
    }
  }

  const status = customerStatementStatus(active, overdueCount, totalPaid, outstanding);
  return {
    totalInvoiced, totalPaid, outstanding,
    invoiceCount: active.length, outstandingCount, overdueCount,
    nextDueDate, lastPaymentDate, status,
  };
}

function customerStatementStatus(
  active: readonly ARInvoice[],
  overdueCount: number,
  totalPaid: number,
  outstanding: number,
): ARStatus {
  if (active.length === 0) return "draft";
  if (overdueCount > 0) return "overdue";
  if (outstanding <= 0) return "paid";
  if (totalPaid > 0) return "partially_paid";
  return active.some((i) => i.status !== "draft") ? "issued" : "draft";
}
