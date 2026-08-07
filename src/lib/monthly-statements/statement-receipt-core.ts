// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — pure statement-receipt core.
//
// PURE: no Supabase, no network, no clock. A monthly statement's payment figure is a CUSTOMER-LEVEL
// RECEIPTS view: completed customer receipts selected ONLY by authoritative payment_date within the
// inclusive statement period — INCLUDING receipts that reconcile invoices from earlier statements and
// receipts carrying unapplied credit. created_at is NEVER a fallback; invoices.paid_amount is never the
// source. Invalid monetary/date input is REJECTED (thrown), never silently coerced to zero.
//
// Single active membership (a payment in at most one non-voided statement) and the atomic snapshot are
// DATABASE concerns (issue_monthly_statement_rpc + the receipt trigger). This core only decides which
// receipts fall in a period and how each splits into allocated vs unapplied.

import { isValidCalendarDate } from "@/lib/invoices/invoice-delivery-date";

/** A candidate customer receipt, carrying only the stored values a statement reads. */
export interface CandidatePayment {
  id:              string;
  dealer_id:       string;
  customer_id:     string | null;
  status:          string;
  payment_date:    string | null;   // the SOLE authoritative period-selection date
  amount:          number;
  invoice_id:      string | null;   // legacy-direct when present; null for allocated/unapplied
  allocated_sum?:  number | null;   // sum of persisted payment_allocations for this payment
  payment_number?: string | null;
  payment_method?: string | null;
}

export interface StatementScope {
  dealerId:   string;
  customerId: string;
}

export interface StatementPeriod {
  period_start: string;  // YYYY-MM-DD inclusive
  period_end:   string;  // YYYY-MM-DD inclusive
}

export interface ReceiptSplit {
  paymentId: string;
  amount:    number;
  allocated: number;
  unapplied: number;
}

export interface ReceiptTotals {
  payments_received_total:  number;
  allocated_payments_total: number;
  unapplied_credit_total:   number;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A payment is a statement-eligible completed receipt only with an authoritative payment_date. */
export function isEligibleReceipt(status: unknown, payment_date: unknown): boolean {
  return status === "completed" && isValidCalendarDate(payment_date);
}

/**
 * Select the completed receipts that belong on a statement for one period, in canonical order.
 * Tenant scope is AUTHORITATIVE and enforced FIRST (exact dealer_id + customer_id). Selection is by
 * payment_date ONLY, within [period_start, period_end] inclusive. A missing/invalid payment_date drops
 * the row (never a created_at fallback). Order: payment_date asc, then id asc.
 * @throws if the scope is blank or the period bounds are invalid/reversed.
 */
export function selectPeriodReceipts(
  payments: readonly CandidatePayment[],
  scope: StatementScope,
  period: StatementPeriod,
): CandidatePayment[] {
  const dealerId = (scope?.dealerId ?? "").trim();
  const customerId = (scope?.customerId ?? "").trim();
  if (dealerId === "" || customerId === "") {
    throw new Error("statement-receipt-core: dealerId and customerId scope are required (fail closed)");
  }
  if (!isValidCalendarDate(period.period_start) || !isValidCalendarDate(period.period_end)) {
    throw new Error("statement-receipt-core: invalid statement period bounds");
  }
  if (period.period_start > period.period_end) {
    throw new Error("statement-receipt-core: period_start is after period_end");
  }

  const selected = payments.filter((p) => {
    if (p.dealer_id !== dealerId || p.customer_id !== customerId) return false;
    if (!isEligibleReceipt(p.status, p.payment_date)) return false;
    const d = p.payment_date as string;
    return d >= period.period_start && d <= period.period_end;
  });

  return [...selected].sort((a, b) => {
    const ad = a.payment_date!;
    const bd = b.payment_date!;
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/**
 * Split one receipt into its allocated and unapplied portions:
 *   legacy-direct (invoice_id present) → allocated = amount, unapplied = 0;
 *   otherwise                          → allocated = allocated_sum, unapplied = amount − allocated_sum.
 * @throws on non-finite amount/allocated_sum, negative values, or an allocation that exceeds the amount.
 */
export function splitReceipt(payment: CandidatePayment): ReceiptSplit {
  if (!isFiniteNumber(payment.amount) || payment.amount < 0) {
    throw new Error(`statement-receipt-core: payment ${payment.id} has a non-finite/negative amount`);
  }
  let allocated: number;
  if (payment.invoice_id != null) {
    allocated = payment.amount;
  } else {
    const sum = payment.allocated_sum ?? 0;
    if (!isFiniteNumber(sum) || sum < 0) {
      throw new Error(`statement-receipt-core: payment ${payment.id} has a non-finite/negative allocated_sum`);
    }
    if (sum > payment.amount) {
      throw new Error(`statement-receipt-core: payment ${payment.id} allocated_sum exceeds amount`);
    }
    allocated = sum;
  }
  return { paymentId: payment.id, amount: payment.amount, allocated, unapplied: payment.amount - allocated };
}

/**
 * Aggregate the receipt totals from the period receipts. The reconciliation identity
 * payments_received_total = allocated_payments_total + unapplied_credit_total holds by construction
 * (each split satisfies amount = allocated + unapplied). @throws if any amount is non-finite.
 */
export function summarizeReceiptTotals(payments: readonly CandidatePayment[]): ReceiptTotals {
  let payments_received_total = 0;
  let allocated_payments_total = 0;
  let unapplied_credit_total = 0;
  for (const p of payments) {
    const s = splitReceipt(p);
    payments_received_total += s.amount;
    allocated_payments_total += s.allocated;
    unapplied_credit_total += s.unapplied;
  }
  return { payments_received_total, allocated_payments_total, unapplied_credit_total };
}
