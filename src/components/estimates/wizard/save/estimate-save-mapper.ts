// Estimate Wizard Ver2.2 — Estimate Save mapper (Phase 11A → 11B, pure transformation).
//
// EstimateSaveMapperInput ({ draft, pricingResult }) → EstimateSaveRequest. PURE and DETERMINISTIC:
// NO persistence, NO DB, NO API, NO server action, NO side effects, NO Date.now/new Date/random, NO
// dealer id. Screen state is never reused as the DTO; this is the single translation point.
//
// Monetary values come from the PRICING RESULT (§8) — the mapper performs no business arithmetic.
// Per-line identity comes from the pure pricing INPUT bundle (`buildWizardPricingInput`) and is
// correlated to pricing-result lines by an authoritative identity key (never a label, index, or order).

import { buildWizardPricingInput } from "../pricing/wizard-pricing-input-adapter";
import { EXAMPLE_STORE_GLOBAL_OPTIONS } from "../screens/store-global-options-config";
import type { EstimateSaveMapperInput } from "./estimate-save-contracts";
import type {
  EstimateSaveRequest, EstimateSaveCustomer, EstimateSaveVehicle, EstimateSaveServiceLine,
  EstimateSaveDiscount, EstimateSaveCoupon, EstimateSavePricing, EstimateSaveNonPriceableSelection,
} from "./estimate-save-dto";

const trimOrNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());
const numOrNull = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
};

export function mapDraftToEstimateSaveRequest(input: EstimateSaveMapperInput): EstimateSaveRequest {
  const { draft, pricingResult, shopRank } = input;
  const c = draft.customer;
  const v = draft.vehicle;
  const nc = c.newCustomer;
  const nv = v.newVehicle;

  // ── Customer ──
  const customer: EstimateSaveCustomer =
    c.sourceMode === "existing" && c.customerId
      ? { mode: "existing", customerId: c.customerId }
      : {
          mode: "new",
          name: nc.name.trim(),
          phone: trimOrNull(nc.phone),
          email: trimOrNull(nc.email),
          postalCode: trimOrNull(nc.postal),
          address: trimOrNull(nc.address),
          lineId: trimOrNull(nc.lineId),
          isBusiness: nc.isBusiness,
          tradeRatePercent: numOrNull(nc.tradeRate),
          accountsReceivableAllowed: nc.arAllowed,
          closingDay: trimOrNull(nc.closingDay),
          paymentDay: trimOrNull(nc.paymentDay),
        };

  // ── Vehicle ──
  const vehicle: EstimateSaveVehicle =
    v.sourceMode === "existing" && v.vehicleId
      ? { mode: "existing", vehicleId: v.vehicleId, bodySizeKey: trimOrNull(v.bodySizeKey) }
      : {
          mode: "new",
          maker: trimOrNull(nv.maker),
          model: trimOrNull(nv.model),
          grade: trimOrNull(nv.grade),
          vehicleCode: trimOrNull(nv.vehicle_code),
          vin: trimOrNull(nv.vin),
          firstRegistration: trimOrNull(nv.first_registration_year_month),
          registrationDate: trimOrNull(nv.registration_date),
          inspectionExpiry: trimOrNull(nv.inspection_expiry_date),
          displacement: trimOrNull(nv.displacement),
          color: trimOrNull(nv.color),
          plateNumber: trimOrNull(nv.plate_number),
          bodySizeKey: trimOrNull(v.bodySizeKey),
        };

  // ── Service lines: identity from the pure input bundle; amounts from the pricing result ──
  // The bundle is built with the AUTHORITATIVE shopRank (never from the draft). A multi-layer coating
  // that is not fully priced under this rank (missing rank → MULTI_LAYER_NOT_MAPPED; invalid rank →
  // a coating error) fails closed here: we refuse to serialize a partial coating price into a save.
  const bundle = buildWizardPricingInput(draft, shopRank);
  const co = draft.serviceConfiguration.coating;
  const isMultiLayerCoating = draft.serviceSelection.selectedCategories.includes("coating") && !!(co.layer2Id || co.layer3Id);
  if (isMultiLayerCoating &&
      (bundle.errors.some((e) => e.category === "coating") ||
       bundle.warnings.some((w) => w.code === "MULTI_LAYER_NOT_MAPPED"))) {
    throw new Error("save refused: multi-layer coating is not fully priced under the authoritative shop rank (rank missing or invalid); a partial coating price must not be saved.");
  }
  const coatingReferenceId = draft.serviceConfiguration.coating.layer1Id;

  // Authoritative identity map for manual lines, keyed by `${category}:${manualPricingIdentity}`.
  const manualByKey = new Map(
    bundle.manualLines.map((m) => [`${m.sourceCategory}:${m.manualPricingIdentity}`, m]),
  );

  const services: EstimateSaveServiceLine[] = [];
  for (const line of pricingResult.lines) {
    if (line.kind === "catalog") {
      services.push({
        lineId: `catalog:${line.category}:${coatingReferenceId ?? "unknown"}`,
        category: line.category,
        pricingSource: "catalog",
        pricingReferenceId: coatingReferenceId,
        manualPricingIdentity: null,
        label: line.label,
        description: null,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? 0,
        subtotal: line.lineTotal ?? 0,
        selectedOptionReferenceIds: [],
        metadata: {},
      });
    } else {
      // Correlate by the authoritative identity key (sourceId = `${category}:${identity}`).
      const m = manualByKey.get(line.sourceId);
      services.push({
        lineId: `manual:${line.category}:${m?.manualPricingIdentity ?? line.sourceId}`,
        category: line.category,
        pricingSource: "manual",
        pricingReferenceId: null,
        manualPricingIdentity: m?.manualPricingIdentity ?? null,
        label: line.label,
        description: null,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? 0,
        subtotal: line.lineTotal ?? 0,
        selectedOptionReferenceIds: m?.optionIdentity ? [m.optionIdentity] : [],
        metadata: m?.metadata ?? {},
      });
    }
  }

  // ── Non-priceable selections (operational only — never monetary lines) ──
  const nonPriceableSelections: EstimateSaveNonPriceableSelection[] = draft.serviceConfiguration.storeGlobalOptions.selectedOptionIds
    .map((id) => EXAMPLE_STORE_GLOBAL_OPTIONS.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => !!o && o.editableUnitPrice === false)
    .map((o) => ({ category: "store_global_options", identity: o.id, label: o.name }));

  // ── Discount: requested INTENT and applied RESULT kept separate ──
  const dc = draft.discountAndCoupon;
  const fixed = dc.mode === "amount" ? numOrNull(dc.amountInput) : null;
  const percent = dc.mode === "percent" ? numOrNull(dc.percentInput) : null;
  const discountMode: EstimateSaveDiscount["intent"]["mode"] =
    fixed != null && fixed > 0 ? "fixed_amount" : percent != null ? "percentage" : "none";
  const discount: EstimateSaveDiscount = {
    intent: {
      mode: discountMode,
      fixedAmount: fixed,
      percentage: percent,
      percentageSupported: discountMode === "percentage" ? false : true, // production has no % path
    },
    appliedAmount: pricingResult.discountTotal, // engine-applied; never recalculated
  };

  // ── Coupon: intent only (deferred; never financially applied) ──
  const coupon: EstimateSaveCoupon = {
    selectedCouponIds: [...dc.selectedCouponIds],
    status: pricingResult.couponState.status === "selected_not_priced" ? "selected_not_priced" : "none",
    appliedAmount: pricingResult.couponTotal, // always 0
  };

  // ── Pricing summary: exact production figures + preserved warnings/errors/unresolved ──
  const pricing: EstimateSavePricing = {
    currency: "JPY",
    completeness: pricingResult.completeness,
    subtotal: pricingResult.subtotal,
    discountTotal: pricingResult.discountTotal,
    couponTotal: pricingResult.couponTotal,
    taxableSubtotal: pricingResult.taxableSubtotal,
    taxRatePercent: 10,
    taxTotal: pricingResult.taxTotal,
    grandTotal: pricingResult.grandTotal,
    warnings: pricingResult.warnings.map((w) => ({ code: w.code, message: w.message })),
    errors: pricingResult.errors.map((e) => ({ code: e.code, message: e.message })),
    unresolvedItems: pricingResult.unresolvedItems.map((u) => ({ code: u.code, message: u.message })),
  };

  return {
    customer,
    vehicle,
    services,
    nonPriceableSelections,
    discount,
    coupon,
    pricing,
    notes: { customerNotes: draft.notes.customerNotes, internalMemo: draft.notes.internalMemo },
    metadata: {
      source: "estimate-wizard-v2.2",
      schemaVersion: "2.2",
      createdFromWizard: true,
      draftLastUpdatedAt: draft.metadata.lastUpdatedAt,
      previewConfirmed: draft.review.previewConfirmed,
      estimateNumber: null,
    },
  };
}
