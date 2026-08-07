// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B2 — pure monthly-statement core.
//
// PURE: no Supabase, no network, no clock. Everything here is a deterministic function of its input.
// The monthly statement AGGREGATES immutable issued invoices — it NEVER recalculates tax or line
// prices, and it selects the period ONLY by invoices.delivery_date (issue_date is never consulted).
// Invalid monetary or date input is REJECTED (thrown), never silently coerced to zero.

import { isValidCalendarDate } from "@/lib/invoices/invoice-delivery-date";
import { ELIGIBLE_INVOICE_STATUSES } from "./monthly-statement-types";

/** A candidate source invoice, carrying only the stored values a statement reads. */
export interface CandidateInvoice {
  id:              string;
  dealer_id:       string;
  customer_id:     string | null;
  invoice_number:  string | null;
  status:          string;
  delivery_date:   string | null;   // the SOLE period-selection date
  subtotal:        number;
  discount_amount: number;
  tax_amount:      number;
  total:           number;
  title?:          string | null;
  item_names?:     string[];        // stored invoice item names, in sort order
}

export interface StatementPeriod {
  period_start: string;  // YYYY-MM-DD inclusive
  period_end:   string;  // YYYY-MM-DD inclusive
}

/** The authoritative tenant scope for a statement selection; both are required and non-blank. */
export interface StatementScope {
  dealerId:   string;
  customerId: string;
}

export interface StatementTotals {
  current_subtotal: number;
  current_discount: number;
  current_tax:      number;
  current_total:    number;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isEligibleInvoiceStatus(status: unknown): boolean {
  return typeof status === "string" && (ELIGIBLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

/**
 * Select the invoices that belong on a statement for one period, in the canonical order.
 *
 * Tenant scope is AUTHORITATIVE and enforced FIRST: only invoices whose dealer_id AND customer_id
 * exactly equal the caller-supplied scope are ever considered — the pure core cannot leak a
 * cross-tenant invoice. Eligibility then requires status in {issued, paid, partially_paid, overdue}
 * and a VALID delivery_date within [period_start, period_end] inclusive. Draft/cancelled invoices
 * and invoices with a missing/invalid delivery_date are excluded. issue_date is never read.
 *
 * Order: delivery_date ascending, then invoice_number ascending, then invoice id ascending.
 * @throws if the scope dealerId/customerId is blank, or the period bounds are invalid / reversed.
 */
export function selectEligibleInvoices(
  invoices: readonly CandidateInvoice[],
  scope: StatementScope,
  period: StatementPeriod,
): CandidateInvoice[] {
  const dealerId = (scope?.dealerId ?? "").trim();
  const customerId = (scope?.customerId ?? "").trim();
  if (dealerId === "" || customerId === "") {
    throw new Error("monthly-statement-core: dealerId and customerId scope are required (fail closed)");
  }
  if (!isValidCalendarDate(period.period_start) || !isValidCalendarDate(period.period_end)) {
    throw new Error("monthly-statement-core: invalid statement period bounds");
  }
  if (period.period_start > period.period_end) {
    throw new Error("monthly-statement-core: period_start is after period_end");
  }

  const eligible = invoices.filter((inv) => {
    // Authoritative tenant scope FIRST — exact dealer_id + customer_id match, or the invoice is dropped.
    if (inv.dealer_id !== dealerId || inv.customer_id !== customerId) return false;
    if (!isEligibleInvoiceStatus(inv.status)) return false;
    const d = inv.delivery_date;
    if (!isValidCalendarDate(d)) return false; // missing/invalid delivery date → excluded (never a fallback date)
    return d >= period.period_start && d <= period.period_end;
  });

  return [...eligible].sort((a, b) => {
    if (a.delivery_date! < b.delivery_date!) return -1;
    if (a.delivery_date! > b.delivery_date!) return 1;
    const an = a.invoice_number ?? "";
    const bn = b.invoice_number ?? "";
    if (an < bn) return -1;
    if (an > bn) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/**
 * Aggregate the statement totals by SUMMING the stored invoice values. Tax and line prices are never
 * recomputed. @throws if any stored monetary field is non-finite (never coerced to zero).
 */
export function aggregateStatementTotals(invoices: readonly CandidateInvoice[]): StatementTotals {
  let current_subtotal = 0;
  let current_discount = 0;
  let current_tax = 0;
  let current_total = 0;
  for (const inv of invoices) {
    for (const [field, value] of [
      ["subtotal", inv.subtotal],
      ["discount_amount", inv.discount_amount],
      ["tax_amount", inv.tax_amount],
      ["total", inv.total],
    ] as const) {
      if (!isFiniteNumber(value)) {
        throw new Error(`monthly-statement-core: invoice ${inv.id} has non-finite ${field}`);
      }
    }
    current_subtotal += inv.subtotal;
    current_discount += inv.discount_amount;
    current_tax += inv.tax_amount;
    current_total += inv.total;
  }
  return { current_subtotal, current_discount, current_tax, current_total };
}

/**
 * Opening balance = the persisted closing_balance of the validated previous statement, or 0 when
 * there is no previous statement. @throws if the previous closing_balance is non-finite.
 */
export function resolveOpeningBalance(previous: { closing_balance: number } | null): number {
  if (previous === null) return 0;
  if (!isFiniteNumber(previous.closing_balance)) {
    throw new Error("monthly-statement-core: previous statement closing_balance is non-finite");
  }
  return previous.closing_balance;
}

export interface ClosingBalanceInput {
  opening_balance:         number;
  current_total:           number;
  payments_received_total: number;   // B3: customer-level receipts in the period (NOT allocation-only)
  adjustments_total:       number;
}

/**
 * B3 closing balance:
 *   closing_balance = opening_balance + current_total - payments_received_total + adjustments_total.
 * payments_received_total is the sum of completed customer receipts selected by payment_date within the
 * statement period (see statement-receipt-core), so prior-invoice payments and unapplied credit both
 * reduce the balance exactly once. @throws if any input is non-finite (never coerced to zero).
 */
export function computeClosingBalance(input: ClosingBalanceInput): number {
  for (const [field, value] of Object.entries(input)) {
    if (!isFiniteNumber(value)) {
      throw new Error(`monthly-statement-core: non-finite ${field} in closing-balance input`);
    }
  }
  return (
    input.opening_balance +
    input.current_total -
    input.payments_received_total +
    input.adjustments_total
  );
}

export interface ReceiptReconciliationInput {
  payments_received_total:  number;
  allocated_payments_total: number;
  unapplied_credit_total:   number;
}

/**
 * B3 reconciliation identity: payments_received_total === allocated_payments_total +
 * unapplied_credit_total. Returns true only when it holds exactly. @throws if any input is non-finite
 * (never coerced to zero) — a NaN/Infinity total is a hard error, not a silent reconciliation pass.
 */
export function reconcileReceiptTotals(input: ReceiptReconciliationInput): boolean {
  for (const [field, value] of Object.entries(input)) {
    if (!isFiniteNumber(value)) {
      throw new Error(`monthly-statement-core: non-finite ${field} in reconciliation input`);
    }
  }
  return (
    input.payments_received_total ===
    input.allocated_payments_total + input.unapplied_credit_total
  );
}

/**
 * Work description for a statement line: a non-blank invoice title first; otherwise a deterministic
 * description from the stored invoice item names (first name, plus "ほかN件" when there are more).
 * Returns "" only when neither a title nor any item name exists.
 */
export function deriveWorkDescription(invoice: { title?: string | null; item_names?: string[] }): string {
  const title = (invoice.title ?? "").trim();
  if (title !== "") return title;

  const names = (invoice.item_names ?? []).map((n) => (n ?? "").trim()).filter((n) => n !== "");
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} ほか${names.length - 1}件`;
}
