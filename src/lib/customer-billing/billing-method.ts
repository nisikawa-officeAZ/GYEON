// DealerOS — Billing method resolution (Phase E8.4, pure, no schema).
//
// Option A: billing method is resolved from DEALER-level settings
// (dealer_closing_day / dealer_payment_day). Per-customer closing/payment terms
// are deferred to a future schema phase (E8.6+). Closing billing applies only
// when BOTH dealer days exist; otherwise per-invoice. The trade flag is never
// consulted here (it must not force closing billing).

import { resolveBillingTerms } from "./billing-terms";

export interface BillingMethodInfo {
  mode:       "per_invoice" | "closing";
  labelJa:    string;   // 都度請求 | 締め請求
  labelEn:    string;   // Per Invoice | Closing Billing
  closingDay: number | null;
  paymentDay: number | null;
}

export function resolveDealerBillingMethod(
  dealerClosingDay?: number | null,
  dealerPaymentDay?: number | null,
): BillingMethodInfo {
  const t = resolveBillingTerms({ dealerClosingDay, dealerPaymentDay });
  const closing = t.mode === "closing";
  return {
    mode:       t.mode,
    labelJa:    closing ? "締め請求" : "都度請求",
    labelEn:    closing ? "Closing Billing" : "Per Invoice",
    closingDay: t.closingDay,
    paymentDay: t.paymentDay,
  };
}

// Statement eligibility is DERIVED (never persisted): an invoice is statement
// eligible when the dealer bills on a closing cycle.
export function isStatementEligible(info: Pick<BillingMethodInfo, "mode">): boolean {
  return info.mode === "closing";
}
