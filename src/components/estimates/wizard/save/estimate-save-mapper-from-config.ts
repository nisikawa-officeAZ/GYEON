// EW-UI-5A1-B2 — Fixture-free, config-driven Estimate Save mapper (pure, deterministic).
//
// { draft, server-computed pricingResult, pricingConfig, catalog, shopRank } → EstimateSaveRequest,
// as a DISCRIMINATED result. PURE: NO persistence, DB, API, server action, route, Supabase, React,
// clock, randomness, UUID, or dealer id. It NEVER throws a raw internal error (unexpected failure →
// `mapping-failed` with an operator-safe message).
//
// Monetary values are COPIED from `pricingResult` — never recomputed, never `?? 0` / `|| 0`. The tax
// rate comes from the rebuilt config bundle. Catalog line identity is the engine-produced
// `(category, catalogLineRole, pricingReferenceId)` (never label/index/order); manual identity is the
// authoritative `(category, manualPricingIdentity)` from the config bundle.
//
// This is the production twin of the legacy fixture mapper (`estimate-save-mapper.ts`, imported by the
// frozen dev preview). It imports NEITHER that module NOR any fixture/default: it uses ONLY the
// config-driven builder `buildWizardPricingInputFromConfig`.

import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { ServiceInput, CatalogLineRole, PricingDiscountIntent } from "@/lib/pricing/canonical-pricing-engine";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { ShopRank } from "../screens/step-types";
import type { WizardPricingResult } from "../pricing/wizard-pricing-types";
import type { ProductionPricingConfiguration } from "../pricing/wizard-manual-pricing-config";
import { buildWizardPricingInputFromConfig } from "../pricing/wizard-pricing-input-adapter-config";
import type {
  EstimateSaveRequest, EstimateSaveCustomer, EstimateSaveVehicle, EstimateSaveServiceLine,
  EstimateSaveDiscount, EstimateSaveCoupon, EstimateSavePricing,
} from "./estimate-save-dto";

// ── Public contract ────────────────────────────────────────────────────────────────

export type ConfigSaveMapperInput = {
  readonly draft: EstimateWizardDraftV22;
  readonly pricingResult: WizardPricingResult;
  readonly pricingConfig: ProductionPricingConfiguration;
  readonly catalog: PricingCatalog;
  readonly shopRank: ShopRank;
  /**
   * B1.1-B2 — `lifecycle.currentRevision` from the resolved runtime configuration. Server-derived;
   * never accepted from a client. Optional so existing callers compile; absent ⇒ `null`
   * ("unattributed"), never a fabricated revision.
   */
  readonly configurationRevision?: number | null;
};

export type ConfigSaveMapperFailure =
  | "pricing-incomplete"
  | "pricing-error"
  | "unresolved-items"
  | "null-line-amount"
  | "null-aggregate-total"
  | "non-finite-amount"
  | "negative-amount"
  | "invalid-quantity"
  | "missing-catalog-identity"
  | "missing-manual-identity"
  | "unknown-configured-item"
  | "duplicate-line-identity"
  | "result-bundle-mismatch"
  | "percentage-discount-unsupported"
  | "coupon-unpriced"
  | "mapping-failed";

export type ConfigSaveMapperIssue = {
  readonly code: ConfigSaveMapperFailure;
  readonly message: string;
};

export type ConfigSaveMapperResult =
  | { readonly ok: true; readonly request: EstimateSaveRequest }
  | { readonly ok: false; readonly reason: ConfigSaveMapperFailure; readonly issues: readonly ConfigSaveMapperIssue[] };

// ── Internals ────────────────────────────────────────────────────────────────────

const trimOrNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());
const numOrNull = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
};

function fail(reason: ConfigSaveMapperFailure, message: string): ConfigSaveMapperResult {
  return { ok: false, reason, issues: [{ code: reason, message }] };
}

// ── Public mapper ──────────────────────────────────────────────────────────────────

export function mapWizardDraftToSaveRequestFromConfig(input: ConfigSaveMapperInput): ConfigSaveMapperResult {
  try {
    return mapInner(input);
  } catch {
    // Never expose or throw a raw internal error.
    return fail("mapping-failed", "見積内容を保存用に変換できませんでした。");
  }
}

function mapInner(input: ConfigSaveMapperInput): ConfigSaveMapperResult {
  const { draft, pricingResult: pr, pricingConfig, catalog, shopRank } = input;

  // Structural re-derivation of the authoritative bundle (identities + labels + tax rate). This is
  // VERIFICATION only — it never calls calculateEstimate/computeWizardPricingFromConfig.
  const bundle = buildWizardPricingInputFromConfig(draft, pricingConfig, catalog, shopRank);

  // ── J. Deterministic failure precedence (order is pinned in tests) ──

  // 2. unknown-configured-item — an authoritative config-bundle error (a selected code not in config).
  if (bundle.errors.some((e) => e.code === "UNKNOWN_CONFIGURED_ITEM")) {
    return fail("unknown-configured-item", "選択された項目が店舗の設定に見つかりません。");
  }
  // 3. pricing-error — ANY authoritative bundle error (other than the UNKNOWN_CONFIGURED_ITEM handled
  //    above) OR any pricingResult error/error-state fails closed. Checking `bundle.errors` FIRST means
  //    a forged complete/success pricingResult can never hide a genuine config-bundle error.
  if (
    bundle.errors.length > 0 ||
    pr.status === "error" ||
    pr.completeness === "error" ||
    pr.errors.length > 0
  ) {
    return fail("pricing-error", "価格計算にエラーがあるため保存できません。");
  }
  // 4. pricing-incomplete
  if (pr.completeness !== "complete" || pr.status !== "success") {
    return fail("pricing-incomplete", "価格が未確定のため保存できません。");
  }
  // 5. unresolved-items
  if (pr.unresolvedItems.length > 0) {
    return fail("unresolved-items", "価格が算出できない選択項目があるため保存できません。");
  }
  // 6/7. B1.1 — percentage discounts and configured coupons are now AUTHORIZED, so the two blanket
  //      refusals that stood here are gone. What replaces them is narrower, not weaker: a coupon
  //      selection that could not be RESOLVED still fails closed, so an unknown, inactive, expired
  //      or non-combinable selection can never be saved as if it had been applied.
  if (bundle.couponState.status === "selected_not_priced" || pr.couponState.status === "selected_not_priced") {
    return fail("coupon-unpriced", "選択されたクーポンを適用できません。内容を確認してください。");
  }
  // A coupon amount may only exist when the authoritative bundle actually resolved coupons —
  // otherwise a forged non-zero couponTotal could reach persistence.
  if (pr.couponTotal !== 0 && bundle.couponApplications.length === 0) {
    return fail("coupon-unpriced", "クーポン金額を確認できません。");
  }

  // ── D. Monetary contract (copied from the result; never recomputed) ──
  const aggregates: Array<[string, number | null]> = [
    ["subtotal", pr.subtotal], ["discountTotal", pr.discountTotal], ["couponTotal", pr.couponTotal],
    ["taxableSubtotal", pr.taxableSubtotal], ["taxTotal", pr.taxTotal], ["grandTotal", pr.grandTotal],
  ];
  // 8. null-aggregate-total
  if (aggregates.some(([, v]) => v === null)) return fail("null-aggregate-total", "合計金額が確定していません。");
  // 9. null-line-amount
  if (pr.lines.some((l) => l.unitPrice === null || l.lineTotal === null)) {
    return fail("null-line-amount", "明細金額が確定していません。");
  }
  // 10. non-finite-amount (aggregates + line amounts — all non-null by now)
  const lineAmounts = pr.lines.flatMap((l) => [l.unitPrice as number, l.lineTotal as number]);
  const allAmounts = [...aggregates.map(([, v]) => v as number), ...lineAmounts];
  if (allAmounts.some((v) => !Number.isFinite(v))) return fail("non-finite-amount", "金額が不正です。");
  // 11. negative-amount
  if (allAmounts.some((v) => v < 0)) return fail("negative-amount", "金額が不正です。");
  // 12. invalid-quantity
  if (pr.lines.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0)) {
    return fail("invalid-quantity", "数量が不正な明細があります。");
  }

  // ── E. Structural result/bundle parity — expected catalog tuples from coating ServiceInputs ──
  const expectedCatalog = new Map<string, number>(); // key `${category}:${role}:${id}` → count
  const bump = (m: Map<string, number>, k: string) => {
    const n = m.get(k);
    m.set(k, (n === undefined ? 0 : n) + 1);
  };
  for (const s of bundle.services) {
    if (s.type !== "coating") continue;
    const c = s as Extract<ServiceInput, { type: "coating" }>;
    bump(expectedCatalog, catKey("coating", "base", c.coatingId));
    if (c.topcoat2) bump(expectedCatalog, catKey("coating", "topcoat2", c.topcoat2));
    if (c.topcoat3) bump(expectedCatalog, catKey("coating", "topcoat3", c.topcoat3));
    for (const id of c.optionIds ?? []) {
      const cat = catalog.coatingOptions.find((o) => o.id === id)?.cat ?? "coating";
      bump(expectedCatalog, catKey(cat, "option", id));
    }
  }
  // Manual identities from the authoritative bundle, keyed by the stable sourceId contract.
  const manualByKey = new Map(bundle.manualLines.map((m) => [`${m.sourceCategory}:${m.manualPricingIdentity}`, m]));

  // ── F. Build the service lines from the pricing result ──
  const services: EstimateSaveServiceLine[] = [];
  const lineIds = new Set<string>();
  const resultCatalog = new Map<string, number>();

  for (const line of pr.lines) {
    if (line.kind === "catalog") {
      // 13. missing-catalog-identity (defensive — the type + adapter already guarantee both).
      if (!line.pricingReferenceId || !line.catalogLineRole) {
        return fail("missing-catalog-identity", "カタログ明細の識別子がありません。");
      }
      bump(resultCatalog, catKey(line.category, line.catalogLineRole, line.pricingReferenceId));
      const lineId = `catalog:${line.category}:${line.catalogLineRole}:${line.pricingReferenceId}`;
      if (lineIds.has(lineId)) return fail("duplicate-line-identity", "重複する明細識別子があります。");
      lineIds.add(lineId);
      services.push({
        lineId,
        category: line.category,
        pricingSource: "catalog",
        pricingReferenceId: line.pricingReferenceId,
        manualPricingIdentity: null,
        label: line.label,
        description: null,
        quantity: line.quantity,
        unitPrice: line.unitPrice as number,
        subtotal: line.lineTotal as number,
        selectedOptionReferenceIds: [],
        metadata: { catalogLineRole: line.catalogLineRole },
      });
    } else {
      // 14. missing-manual-identity — the result manual line must correlate to an authoritative bundle line.
      const m = manualByKey.get(line.sourceId);
      if (!m || !m.manualPricingIdentity) {
        return fail("missing-manual-identity", "手入力明細の識別子が確認できません。");
      }
      const lineId = `manual:${line.category}:${m.manualPricingIdentity}`;
      if (lineIds.has(lineId)) return fail("duplicate-line-identity", "重複する明細識別子があります。");
      lineIds.add(lineId);
      services.push({
        lineId,
        category: line.category,
        pricingSource: "manual",
        pricingReferenceId: null,
        manualPricingIdentity: m.manualPricingIdentity,
        label: m.label, // authoritative bundle/config label — never a raw code
        description: null,
        quantity: line.quantity,
        unitPrice: line.unitPrice as number,
        subtotal: line.lineTotal as number,
        selectedOptionReferenceIds: m.optionIdentity ? [m.optionIdentity] : [],
        metadata: m.metadata,
      });
    }
  }

  // 16. result-bundle-mismatch — catalog tuple multiset, manual count/category, discount-intent, coupon.
  if (!sameMultiset(expectedCatalog, resultCatalog)) {
    return fail("result-bundle-mismatch", "価格結果が設定内容と一致しません。");
  }
  const resultManualCount = pr.lines.filter((l) => l.kind === "manual").length;
  if (resultManualCount !== bundle.manualLines.length) {
    return fail("result-bundle-mismatch", "価格結果が設定内容と一致しません。");
  }
  // D. Manual-line category parity — every manual result line's category MUST equal its authoritative
  //    source category. A manual line is never accepted by sourceId alone: a matched sourceId with a
  //    different category is a mismatch. (Missing/duplicate identities were rejected above.)
  for (const line of pr.lines) {
    if (line.kind !== "manual") continue;
    const m = manualByKey.get(line.sourceId);
    if (!m || line.category !== m.sourceCategory) {
      return fail("result-bundle-mismatch", "価格結果が設定内容と一致しません。");
    }
  }
  // C. Complete discount-intent parity — full discriminated comparison (mode AND, for fixed_amount, the
  //    exact finite yen amount). A forged mode/value that differs from the authoritative bundle rejects.
  if (!discountIntentMatches(pr.discountIntent, bundle.discountIntent)) {
    return fail("result-bundle-mismatch", "価格結果が設定内容と一致しません。");
  }
  if (pr.couponState.status !== bundle.couponState.status) {
    return fail("result-bundle-mismatch", "価格結果が設定内容と一致しません。");
  }

  // ── G. Customer / vehicle / notes / metadata (canonical passthrough; no invented id) ──
  const c = draft.customer;
  const v = draft.vehicle;
  const nc = c.newCustomer;
  const nv = v.newVehicle;

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
          kana: trimOrNull(nc.kana ?? ""),
          creditTerms: trimOrNull(nc.creditTerms ?? ""),
        };

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

  // ── H. Discount / coupon — B1.1: both are now recorded as APPLIED, never as deferred intent ──
  const di = pr.discountIntent;
  const discount: EstimateSaveDiscount = {
    intent: {
      // The DTO records only the operator-authored modes; `dealer_rate` is a customer attribute
      // carried by `isDealer`/`dealerRate`, not an authored discount, so it maps to "none".
      mode: di.mode === "fixed_amount" || di.mode === "percentage" ? di.mode : "none",
      fixedAmount: di.mode === "fixed_amount" ? di.amount : null,
      // The authored percentage is preserved so the estimate can be explained later; the yen the
      // engine actually applied is `appliedAmount`, and the two are never conflated.
      percentage: di.mode === "percentage" ? di.percentage : null,
      percentageSupported: true,
    },
    appliedAmount: pr.discountTotal, // engine-applied — copied, never recalculated
  };
  const coupon: EstimateSaveCoupon = {
    // Every selected coupon, in the authoritative resolved order — not just the first.
    selectedCouponIds: bundle.couponApplications.map((a) => a.couponId),
    status: bundle.couponApplications.length > 0 ? "applied" : "none",
    appliedAmount: pr.couponTotal, // engine-applied — copied, never recalculated
    // B1.1-B2 — the per-coupon SNAPSHOT. Label, type, authored value and applied yen are frozen
    // here so a later coupon edit or archive cannot change how this estimate is explained.
    applications: bundle.couponApplications.map((a) => ({
      couponId: a.couponId,
      code: a.code,
      label: a.label,
      discountType: a.valueKind,
      discountValue: a.valueRaw,
      appliedAmount: a.appliedAmount,
    })),
  };

  // ── Pricing summary — figures copied verbatim; taxRatePercent from the rebuilt bundle ──
  const pricing: EstimateSavePricing = {
    currency: "JPY",
    completeness: pr.completeness,
    subtotal: pr.subtotal,
    discountTotal: pr.discountTotal,
    couponTotal: pr.couponTotal,
    taxableSubtotal: pr.taxableSubtotal,
    taxRatePercent: bundle.taxRate,
    taxTotal: pr.taxTotal,
    grandTotal: pr.grandTotal,
    warnings: pr.warnings.map((w) => ({ code: w.code, message: w.message })),
    errors: pr.errors.map((e) => ({ code: e.code, message: e.message })),
    unresolvedItems: pr.unresolvedItems.map((u) => ({ code: u.code, message: u.message })),
  };

  const request: EstimateSaveRequest = {
    customer,
    vehicle,
    services,
    nonPriceableSelections: [], // I. blocking policy preserved: a selected non-priceable option blocks pricing upstream
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
      // Server-derived attribution. A non-integer or negative value is rejected to null rather than
      // persisted, so the column's CHECK can never be the first thing to notice a bad value.
      configurationRevision:
        typeof input.configurationRevision === "number" &&
        Number.isInteger(input.configurationRevision) &&
        input.configurationRevision >= 0
          ? input.configurationRevision
          : null,
    },
  };

  return { ok: true, request };
}

function catKey(category: string, role: CatalogLineRole, id: string): string {
  return `${category}:${role}:${id}`;
}
function sameMultiset(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, n] of a) if (b.get(k) !== n) return false;
  return true;
}
// Full discriminated discount-intent parity. Modes must be identical; a fixed_amount intent must carry
// the SAME finite yen amount on both sides, and (B1.1) a percentage intent the SAME finite percentage.
// A forged mode/value that differs from the authoritative bundle rejects. No monetary recompute —
// only an equality comparison of the authoritative payloads.
function discountIntentMatches(a: PricingDiscountIntent, b: PricingDiscountIntent): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "fixed_amount" && b.mode === "fixed_amount") {
    return Number.isFinite(a.amount) && Number.isFinite(b.amount) && a.amount === b.amount;
  }
  if (a.mode === "percentage" && b.mode === "percentage") {
    return Number.isFinite(a.percentage) && Number.isFinite(b.percentage) && a.percentage === b.percentage;
  }
  return true;
}
