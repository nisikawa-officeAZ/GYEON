// Phase 3 Sprint 3 — Server-authoritative estimate totals.
//
// Pure module (no schema, no I/O) — importable by both server actions (for
// authoritative validation on persist) and client (for UI preview).
//
// GDA-ESTIMATE-POST-TAX-ADJUSTMENT-R1 — Owner-ratified POST-TAX document discount:
//   - per-line total = round(quantity × unit_price × (1 − discount_rate%))   [unchanged pre-tax line input]
//   - subtotal       = Σ line totals — this IS the tax base
//   - tax_amount     = floor(subtotal × tax_rate%)
//   - discount       = document discount clamped to [0, subtotal + tax_amount]
//   - total          = subtotal + tax_amount − discount
//
// Multiple services in one estimate are supported: items may span several
// service categories; totals are computed over all of them uniformly.

export interface TotalsItemInput {
  quantity:      number;
  unit_price:    number;
  discount_rate: number; // per-line discount, percent
}

export interface EstimateTotals {
  subtotal:        number;
  discount_amount: number; // estimate-level discount actually applied (clamped)
  tax_rate:        number;
  tax_amount:      number;
  total:           number;
}

export function lineTotal(quantity: number, unitPrice: number, discountRate: number): number {
  const q = Number.isFinite(quantity)   ? quantity   : 0;
  const u = Number.isFinite(unitPrice)  ? unitPrice  : 0;
  const d = Number.isFinite(discountRate) ? discountRate : 0;
  return Math.round(q * u * (1 - d / 100));
}

export function calculateEstimateTotals(
  items: TotalsItemInput[],
  discountAmount = 0,
  taxRate = 10,
): EstimateTotals {
  const subtotal = (items ?? []).reduce(
    (sum, it) => sum + lineTotal(it.quantity, it.unit_price, it.discount_rate),
    0,
  );

  // Tax is computed on the FULL subtotal (the tax base), BEFORE the document discount.
  const rate = (Number.isFinite(taxRate) && taxRate >= 0) ? taxRate : 10;
  const tax = Math.floor(subtotal * rate / 100);

  // The document discount is a post-tax adjustment, clamped to the gross amount
  // [0, subtotal + tax] so the total can never go negative.
  const requestedDiscount = Number.isFinite(discountAmount) ? discountAmount : 0;
  const discount = Math.min(Math.max(0, requestedDiscount), subtotal + tax);

  const total = subtotal + tax - discount;

  return {
    subtotal,
    discount_amount: discount,
    tax_rate:        rate,
    tax_amount:      tax,
    total,
  };
}
