// DealerOS — Statement preparation helpers (Phase E8.3, pure, no schema).
//
// Reusable building blocks for FUTURE computed statements (統合請求書). No UI,
// no PDF, no persistence here — just pure selection/aggregation over invoices
// that already exist. A future E8.5 statement generator would call these,
// scoping the invoice query to dealer_id from getCurrentDealer().

import { computeBillingPeriod, type BillingPeriod } from "./billing-terms";

// Reuse the billing-period math to resolve a statement's [start, end] window.
export function resolveStatementPeriod(referenceDate: string, closingDay: number): BillingPeriod {
  return computeBillingPeriod(referenceDate, closingDay);
}

export interface StatementInvoice {
  customer_id?: string | null;
  issue_date?:  string | null; // YYYY-MM-DD
  subtotal?:    number | null;
  tax_amount?:  number | null;
  total?:       number | null;
  paid_amount?: number | null;
  balance_due?: number | null;
}

// Eligible invoices for a statement: same customer, issue_date within [start, end]
// (inclusive). Lexicographic compare on YYYY-MM-DD == chronological.
export function filterInvoicesForStatement<T extends StatementInvoice>(
  invoices: readonly T[],
  opts: { customerId: string; periodStart: string; periodEnd: string },
): T[] {
  return (invoices ?? []).filter(
    (i) =>
      i.customer_id === opts.customerId &&
      typeof i.issue_date === "string" &&
      i.issue_date >= opts.periodStart &&
      i.issue_date <= opts.periodEnd,
  );
}

export interface StatementTotals {
  count:       number;
  subtotal:    number;
  tax_amount:  number;
  total:       number;
  paid_amount: number;
  balance_due: number;
}

// Aggregate from STORED invoice totals only — no recomputation of line items,
// so this never diverges from what each invoice already shows.
export function aggregateInvoiceTotals(invoices: readonly StatementInvoice[]): StatementTotals {
  const sum = (f: keyof StatementInvoice) =>
    (invoices ?? []).reduce((s, i) => s + (Number(i[f]) || 0), 0);
  return {
    count:       (invoices ?? []).length,
    subtotal:    sum("subtotal"),
    tax_amount:  sum("tax_amount"),
    total:       sum("total"),
    paid_amount: sum("paid_amount"),
    balance_due: sum("balance_due"),
  };
}
