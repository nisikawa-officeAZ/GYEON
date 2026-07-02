// DealerOS — Payment allocation engine (Phase E8.6, pure, no schema).
//
// Distributes a payment amount across one or more invoices, oldest-due first
// (FIFO). Supports full/partial payments and multiple invoices, and reports the
// remaining balance per invoice plus any leftover (unapplied) credit. Pure and
// non-mutating — it NEVER changes invoice totals or persists anything; callers
// decide what to record. Reusable by future payment entry / dashboard / reports.

export interface AllocatableInvoice {
  id:           string;
  total?:       number | null;
  paid_amount?: number | null;
  due_date?:    string | null;
}

export interface PaymentAllocation {
  invoiceId:         string;
  outstandingBefore: number;
  applied:           number;
  outstandingAfter:  number;
}

export interface PaymentAllocationResult {
  allocations:  PaymentAllocation[];
  totalApplied: number;
  leftover:     number;   // amount that could not be applied (overpayment / credit)
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function allocatePayment(
  amount: number,
  invoices: readonly AllocatableInvoice[],
): PaymentAllocationResult {
  let remaining = Math.max(0, num(amount));

  // Oldest due date first; invoices without a due date go last.
  const sorted = (invoices ?? []).slice().sort((a, b) => {
    const ad = a.due_date ?? "9999-12-31";
    const bd = b.due_date ?? "9999-12-31";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });

  const allocations: PaymentAllocation[] = sorted.map((inv) => {
    const outstanding = Math.max(0, num(inv.total) - num(inv.paid_amount));
    const applied = Math.min(remaining, outstanding);
    remaining -= applied;
    return {
      invoiceId:         inv.id,
      outstandingBefore: outstanding,
      applied,
      outstandingAfter:  outstanding - applied,
    };
  });

  const totalApplied = allocations.reduce((s, a) => s + a.applied, 0);
  return { allocations, totalApplied, leftover: remaining };
}
