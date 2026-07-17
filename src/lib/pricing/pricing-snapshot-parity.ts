// EW-DC-1 — Client/server pricing-parity comparison (PURE, no I/O).
//
// The browser preview and the server recalculation both run the SAME canonical engine
// (computeDiscountCouponPricing). This module compares the two resulting snapshots EXACTLY,
// with NO tolerance. A mismatch must block save — it must NEVER silently overwrite the client
// snapshot, pick whichever total is lower/higher, or accept a total-only match when the
// breakdown differs. There is exactly one calculation implementation; the server caller is
// responsible for re-resolving authoritative catalog/coupon inputs before recalculating.

import type { DiscountCouponPricingResult } from "./discount-coupon-pricing";

export interface PricingParityMismatch {
  readonly path: string;
  readonly client: unknown;
  readonly server: unknown;
}

export type PricingParityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "PRICING_PARITY_MISMATCH"; readonly mismatches: readonly PricingParityMismatch[] };

function cmp(path: string, client: unknown, server: unknown, out: PricingParityMismatch[]): void {
  if (client !== server) out.push({ path, client, server });
}

export function comparePricingSnapshots(
  client: DiscountCouponPricingResult,
  server: DiscountCouponPricingResult,
): PricingParityResult {
  const m: PricingParityMismatch[] = [];

  // contract + scalars
  cmp("contractVersion", client.contractVersion, server.contractVersion, m);
  cmp("calculationDate", client.calculationDate, server.calculationDate, m);
  cmp("subtotal", client.subtotal, server.subtotal, m);
  cmp("dealerTradeBasisPoints", client.dealerTradeBasisPoints, server.dealerTradeBasisPoints, m);
  cmp("dealerTradeDiscount", client.dealerTradeDiscount, server.dealerTradeDiscount, m);
  cmp("remainingAfterDealer", client.remainingAfterDealer, server.remainingAfterDealer, m);
  cmp("manualDiscountApplied", client.manualDiscountApplied, server.manualDiscountApplied, m);
  cmp("remainingAfterManual", client.remainingAfterManual, server.remainingAfterManual, m);
  cmp("couponTotal", client.couponTotal, server.couponTotal, m);
  cmp("totalDiscount", client.totalDiscount, server.totalDiscount, m);
  cmp("taxableAmount", client.taxableAmount, server.taxableAmount, m);
  cmp("taxRatePercent", client.taxRatePercent, server.taxRatePercent, m);
  cmp("taxAmount", client.taxAmount, server.taxAmount, m);
  cmp("grandTotal", client.grandTotal, server.grandTotal, m);

  // manual-discount intent (kind + numeric field)
  cmp("manualDiscount.kind", client.manualDiscount.kind, server.manualDiscount.kind, m);
  const cAmt = client.manualDiscount.kind === "fixed" ? client.manualDiscount.amountYen
    : client.manualDiscount.kind === "percentage" ? client.manualDiscount.basisPoints : null;
  const sAmt = server.manualDiscount.kind === "fixed" ? server.manualDiscount.amountYen
    : server.manualDiscount.kind === "percentage" ? server.manualDiscount.basisPoints : null;
  cmp("manualDiscount.value", cAmt, sAmt, m);

  // lines — identity + every monetary field, in order
  cmp("lines.length", client.lines.length, server.lines.length, m);
  const nLines = Math.min(client.lines.length, server.lines.length);
  for (let i = 0; i < nLines; i++) {
    const cl = client.lines[i], sl = server.lines[i];
    cmp(`lines[${i}].lineId`, cl.lineId, sl.lineId, m);
    cmp(`lines[${i}].quantity`, cl.quantity, sl.quantity, m);
    cmp(`lines[${i}].unitPrice`, cl.unitPrice, sl.unitPrice, m);
    cmp(`lines[${i}].discountRatePercent`, cl.discountRatePercent, sl.discountRatePercent, m);
    cmp(`lines[${i}].lineTotal`, cl.lineTotal, sl.lineTotal, m);
  }

  // coupons — ordered ids + definition snapshots + applied value
  cmp("coupons.length", client.coupons.length, server.coupons.length, m);
  const nC = Math.min(client.coupons.length, server.coupons.length);
  for (let i = 0; i < nC; i++) {
    const cc = client.coupons[i], sc = server.coupons[i];
    cmp(`coupons[${i}].couponId`, cc.couponId, sc.couponId, m);
    cmp(`coupons[${i}].label`, cc.label, sc.label, m);
    cmp(`coupons[${i}].value.kind`, cc.value.kind, sc.value.kind, m);
    const ccv = cc.value.kind === "fixed" ? cc.value.amountYen : cc.value.basisPoints;
    const scv = sc.value.kind === "fixed" ? sc.value.amountYen : sc.value.basisPoints;
    cmp(`coupons[${i}].value.amount`, ccv, scv, m);
    cmp(`coupons[${i}].combinable`, cc.combinable, sc.combinable, m);
    cmp(`coupons[${i}].validFrom`, cc.validFrom, sc.validFrom, m);
    cmp(`coupons[${i}].validTo`, cc.validTo, sc.validTo, m);
    cmp(`coupons[${i}].displayOrder`, cc.displayOrder, sc.displayOrder, m);
    cmp(`coupons[${i}].appliedAmount`, cc.appliedAmount, sc.appliedAmount, m);
  }

  return m.length === 0 ? { ok: true } : { ok: false, code: "PRICING_PARITY_MISMATCH", mismatches: m };
}
