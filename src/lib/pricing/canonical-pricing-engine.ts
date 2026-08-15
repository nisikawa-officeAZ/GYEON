// DealerOS — Canonical Pricing Engine (Phase E4).
//
// THE single entry point for all estimate pricing. Every consumer — Estimate,
// Estimate Detail, Estimate Summary, Estimate PDF, Invoice, Completion Report,
// and future Customer Portal / API — should import pricing from HERE, so there
// is exactly one pricing engine and no duplicated calculations.
//
// Canonical calculation pipeline (implemented by calculateEstimate):
//   Base price
//     → Options              (added as line items)
//     → Additional services  (added as line items; all summed into subtotal)
//     → Manual adjustment    (DiscountInput.extraAmount)
//     → Dealer discount      (subtotal × (1 − dealerRate%) when isDealer)
//        [+ coupon: DiscountInput.couponTotal is reserved — coupons NOT implemented]
//     → Tax                  (floor(taxable × rate%); discount clamped to [0, subtotal])
//     → Grand total
// The totals math is the single authoritative function (calculateEstimateTotals),
// shared by client preview and server persist so UI, saved estimate, and PDF agree.
//
// Prices come from an injectable PricingCatalog:
//   - DEFAULT_PRICING_CATALOG — current values (behaviour unchanged).
//   - makePricingCatalog(overrides) — overlay Dealer-Settings-sourced overrides.
// Pure module — no I/O, no dealer data access; dealer_id is never handled here
// (callers resolve it via getCurrentDealer() when building a settings catalog).

export type {
  ServiceInput,
  CoatingInput,
  MaintenanceInput,
  CarwashInput,
  RoomCleanInput,
  OtherInput,
  PpfInput,
  WindowInput,
  PricedLineItem,
  CatalogLineRole,
  ServiceSubtotal,
  DiscountInput,
  EstimateResult,
  PpfConfig,
} from "./pricing-engine";

export {
  calculateEstimate,
  calculateService,
  buildLineItems,
  buildPpfConfig,
} from "./pricing-engine";

export {
  calculateEstimateTotals,
  lineTotal,
  type EstimateTotals,
  type TotalsItemInput,
} from "./estimate-totals";

export {
  type PricingCatalog,
  DEFAULT_PRICING_CATALOG,
  makePricingCatalog,
  bodySizeMultiplier,
} from "./pricing-catalog";

// Phase 10B — forward-looking pricing contract extensions (TYPES ONLY; no runtime behavior).
// Exposed from the canonical entry point so future pricing phases import contracts from here.
export type {
  PricingPolicy,
  ManualPricePolicy,
  PricingDiscountIntent,
  PricingCouponState,
  PricingWarningCode,
  PricingWarning,
  PricingErrorCode,
  PricingError,
  ExtendedDiscountInput,
  PricingContractInputExtension,
  ExtendedPricingResult,
} from "./pricing-contracts";

// EW-DC-1 — canonical discount/coupon monetary contract + client/server parity (pure; not
// yet wired to UI/save/RPC/DB). Exposed here so future Wizard/server/persistence phases
// consume ONE calculation implementation from the canonical entry point.
export {
  computeDiscountCouponPricing,
  DISCOUNT_COUPON_CONTRACT_VERSION,
  BASIS_POINTS_PER_PERCENT,
  FULL_BASIS_POINTS,
  type DiscountCouponContractVersion,
  type ManualDiscountIntent,
  type CouponValue,
  type ResolvedCoupon,
  type PricingLineInput,
  type DiscountCouponPricingInput,
  type LineSnapshot,
  type CouponApplication,
  type DiscountCouponErrorCode,
  type DiscountCouponError,
  type DiscountCouponWarning,
  type DiscountCouponPricingResult,
} from "./discount-coupon-pricing";

export {
  comparePricingSnapshots,
  type PricingParityMismatch,
  type PricingParityResult,
} from "./pricing-snapshot-parity";
