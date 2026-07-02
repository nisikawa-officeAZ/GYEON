// DealerOS — Customer billing terms engine (Phase E8.1, pure, no schema).
//
// Resolves whether a customer/dealer bills per-invoice or on a closing-payment
// cycle, and computes the billing period + payment due date. Pure and
// deterministic (takes the decision date as input; no clock reads), so it is
// unit-testable in isolation.
//
// Independence rule (per E8): closing-payment applies ONLY when BOTH a closing
// day and a payment day exist. The trade/business flag is intentionally NOT an
// input here — being a trade customer must never by itself force closing billing.
// If closing/payment days are blank/invalid, the mode is normal per-invoice.
//
// NOTE: this is customer invoicing, distinct from src/lib/billing (dealer
// subscription billing).

export type BillingMode = "per_invoice" | "closing";

export interface BillingTermsInput {
  // Future per-customer overrides (Plan A schema) — currently always undefined.
  customerClosingDay?: number | null;
  customerPaymentDay?: number | null;
  // Dealer-level defaults (exist today: dealer_settings.dealer_closing_day / _payment_day).
  dealerClosingDay?: number | null;
  dealerPaymentDay?: number | null;
  // Months from the closing month to the payment month (翌月 = 1). Default 1.
  paymentMonthOffset?: number;
}

export interface ResolvedBillingTerms {
  mode: BillingMode;
  closingDay: number | null;         // 1–31 when mode = "closing"
  paymentDay: number | null;         // 1–31 when mode = "closing"
  paymentMonthOffset: number;        // months after closing month
}

export interface BillingPeriod {
  periodStart: string;  // YYYY-MM-DD (inclusive)
  periodEnd:   string;  // YYYY-MM-DD (inclusive; the closing date)
}

// ── Day / date helpers (deterministic, UTC-based to avoid TZ drift) ────────────

function validDay(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

interface YMD { y: number; m: number; d: number } // m is 1–12

function parseYMD(s: string): YMD {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
function toYMD(p: YMD): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
// Days in month m (1–12) of year y — handles Feb/short months and leap years.
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
// Build a valid date for (y, m, day), normalising month over/underflow and
// clamping the day to the month length (month-end & short-month safe).
function clampDay(y: number, m: number, day: number): YMD {
  let yy = y, mm = m;
  while (mm > 12) { mm -= 12; yy += 1; }
  while (mm < 1)  { mm += 12; yy -= 1; }
  return { y: yy, m: mm, d: Math.min(day, daysInMonth(yy, mm)) };
}
function addOneDay(p: YMD): YMD {
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveBillingTerms(input: BillingTermsInput): ResolvedBillingTerms {
  const offset = Number.isInteger(input.paymentMonthOffset) ? (input.paymentMonthOffset as number) : 1;
  const closingDay = validDay(input.customerClosingDay) ?? validDay(input.dealerClosingDay);
  const paymentDay = validDay(input.customerPaymentDay) ?? validDay(input.dealerPaymentDay);
  if (closingDay !== null && paymentDay !== null) {
    return { mode: "closing", closingDay, paymentDay, paymentMonthOffset: offset };
  }
  return { mode: "per_invoice", closingDay: null, paymentDay: null, paymentMonthOffset: offset };
}

// Billing period containing decisionDate for a given closing day.
// The period ends on the first closing date on/after the decision date;
// it starts the day after the previous closing date.
// e.g. closingDay 20, decision 2026-03-21 → 2026-03-21 … 2026-04-20.
export function computeBillingPeriod(decisionDate: string, closingDay: number): BillingPeriod {
  const { y, m, d } = parseYMD(decisionDate);
  const closeThisMonth = clampDay(y, m, closingDay);
  const closing = d <= closeThisMonth.d ? closeThisMonth : clampDay(y, m + 1, closingDay);
  const prevClosing = clampDay(closing.y, closing.m - 1, closingDay);
  return { periodStart: toYMD(addOneDay(prevClosing)), periodEnd: toYMD(closing) };
}

// Payment due date = paymentDay of the month `paymentMonthOffset` after the
// closing (period end) month. e.g. closing 2026-04-20, paymentDay 15 → 2026-05-15.
export function computePaymentDueDate(closingDate: string, paymentDay: number, paymentMonthOffset = 1): string {
  const { y, m } = parseYMD(closingDate);
  return toYMD(clampDay(y, m + paymentMonthOffset, paymentDay));
}

// Resolve the invoice due date from terms. Per-invoice mode returns null so the
// existing nullable due_date behaviour is preserved when no billing terms exist.
export function resolveInvoiceDueDate(issueDate: string, terms: ResolvedBillingTerms): string | null {
  if (terms.mode !== "closing" || terms.closingDay === null || terms.paymentDay === null) return null;
  const period = computeBillingPeriod(issueDate, terms.closingDay);
  return computePaymentDueDate(period.periodEnd, terms.paymentDay, terms.paymentMonthOffset);
}
