// Estimate Wizard Ver2.2 — Estimate Save DTO (Phase 11A → 11B).
//
// The canonical, UI-INDEPENDENT save object. Plain data: it imports NO screen state, NO React, NO
// draft type, NO pricing type, NO database/Supabase/PDF type — a future Estimate Save Service
// (server-side, transactional) consumes exactly this shape. Screen state is NEVER reused directly;
// the mapper (estimate-save-mapper.ts) translates the canonical draft + pricing result into this DTO.
//
// NO persistence, NO DB, NO API, NO server action, NO dealer id. Shape only (11B refines 11A additively).

export type EstimateSaveCompleteness = "complete" | "partial" | "unavailable" | "error";

// ── Customer ─────────────────────────────────────────────────────────────────────
// Existing = id reference only (no new customer id generated). New = approved-field snapshot
// (operator intent; no customer write, no destructive normalization, no payment-date calculation).
export type EstimateSaveCustomer =
  | { mode: "existing"; customerId: string }
  | {
      mode: "new";
      name: string;
      phone: string | null;
      email: string | null;
      postalCode: string | null;
      address: string | null;
      lineId: string | null;
      isBusiness: boolean;
      tradeRatePercent: number | null;   // trade discount INTENT only — never applied here
      accountsReceivableAllowed: boolean; // credit-billing flag
      closingDay: string | null;
      paymentDay: string | null;          // payment-due rule text — never calculated into a date
    };

// ── Vehicle ──────────────────────────────────────────────────────────────────────
export type EstimateSaveVehicle =
  | { mode: "existing"; vehicleId: string; bodySizeKey: string | null }
  | {
      mode: "new";
      maker: string | null;
      model: string | null;
      grade: string | null;
      vehicleCode: string | null;
      vin: string | null;
      firstRegistration: string | null;
      registrationDate: string | null;
      inspectionExpiry: string | null;
      displacement: string | null;
      color: string | null;
      plateNumber: string | null;
      bodySizeKey: string | null;         // preserved as entered; never inferred
    };

// ── Service line ─────────────────────────────────────────────────────────────────
// A priced line tagged by its authoritative identity source (hybrid model). Exactly one of
// `pricingReferenceId` / `manualPricingIdentity` is populated. `lineId` is a DETERMINISTIC composite
// of existing canonical identities (never generated, never a label, never an array index). Monetary
// values come from the pricing result (§8) — the mapper performs no arithmetic beyond passthrough.
export type EstimateSaveServiceLine = {
  lineId: string;                       // deterministic: `${source}:${category}:${identity}`
  category: string;                     // canonical category id (incl. store_global_options)
  pricingSource: "catalog" | "manual";
  pricingReferenceId: string | null;    // catalog identity (null for manual)
  manualPricingIdentity: string | null; // manual identity (null for catalog)
  label: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;                     // line subtotal from the pricing result (not recalculated)
  selectedOptionReferenceIds: string[];
  metadata: Record<string, string | number | boolean | null>;
};

// ── Non-priceable selection (operational only — NEVER a monetary line, never zero-priced) ──
export type EstimateSaveNonPriceableSelection = {
  category: string;
  identity: string;
  label: string;
};

// ── Discount — requested INTENT and applied RESULT are kept strictly separate (§11) ──
export type EstimateSaveDiscountIntent = {
  mode: "none" | "fixed_amount" | "percentage";
  fixedAmount: number | null;
  percentage: number | null;
  percentageSupported: boolean; // false → forwarded intent NOT applied to the total
};
export type EstimateSaveDiscount = {
  intent: EstimateSaveDiscountIntent;
  appliedAmount: number | null; // from the pricing result (engine-applied); never recalculated here
};

// ── Coupon — intent only; coupons remain deferred (never financially applied) ──
export type EstimateSaveCoupon = {
  selectedCouponIds: string[];
  status: "none" | "selected_not_priced";
  appliedAmount: number | null; // ALWAYS null/0 until a production coupon model exists
};

// ── Pricing summary (final figures from the production engine; nullable until complete) ──
export type EstimateSavePricingIssue = { code: string; message: string };
export type EstimateSavePricing = {
  currency: "JPY";
  completeness: EstimateSaveCompleteness;
  subtotal: number | null;
  discountTotal: number | null;
  couponTotal: number | null;
  taxableSubtotal: number | null;
  taxRatePercent: number;
  taxTotal: number | null;
  grandTotal: number | null;
  warnings: EstimateSavePricingIssue[];
  errors: EstimateSavePricingIssue[];
  unresolvedItems: EstimateSavePricingIssue[]; // selected priceable services with no pricing line
};

export type EstimateSaveNotes = {
  customerNotes: string; // may appear on customer output later — line breaks preserved
  internalMemo: string;  // staff-only — NEVER customer-facing, NEVER concatenated with customerNotes
};

// Metadata: only non-generated, already-available values. NO estimate number / db id / created-at /
// created-by / dealer id / sequence are generated here — those belong to the persistence service.
export type EstimateSaveMetadata = {
  source: "estimate-wizard-v2.2";
  schemaVersion: "2.2";
  createdFromWizard: true;
  draftLastUpdatedAt: string | null; // from draft.metadata.lastUpdatedAt (existing; not generated)
  previewConfirmed: boolean;         // from draft.review.previewConfirmed
  estimateNumber: null;              // reserved — server-assigned in a FUTURE numbering phase
};

// ── Root save request (dealer id intentionally OMITTED — the server enriches via getCurrentDealer) ──
export type EstimateSaveRequest = {
  customer: EstimateSaveCustomer;
  vehicle: EstimateSaveVehicle;
  services: EstimateSaveServiceLine[];
  nonPriceableSelections: EstimateSaveNonPriceableSelection[];
  discount: EstimateSaveDiscount;
  coupon: EstimateSaveCoupon;
  pricing: EstimateSavePricing;
  notes: EstimateSaveNotes;
  metadata: EstimateSaveMetadata;
};
