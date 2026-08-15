// C2C2 — Authoritative Wizard runtime configuration resolver (PURE core + builders).
//
// Server-only in effect, but written as a PURE function over injected readers so the whole
// resolution/validation/build logic is unit-testable without a database (the established DI pattern,
// cf. resolveAuthoritativeShopRank). The thin server entry (get-authoritative-wizard-runtime-config.ts)
// wires the real getCurrentDealer / getAuthoritativeShopRank / getDealerPricingCatalog / user-scoped
// Supabase reads.
//
// NO fixtures, NO EXAMPLE_*/preview imports, NO raw-id/label/index fallback. Coating stays
// PricingCatalog-priced; every other category stays manual (operator amount); tax is totals-only.
// The result is fail-closed and never partial.

import type { ServiceOfferings } from "@/lib/estimates/service-categories";
import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { PricingCatalogResolution } from "@/lib/pricing/authoritative-pricing-catalog-core";
import type { RankResolution } from "@/lib/dealer-settings/authoritative-shop-rank-core";
import type { ShopRank } from "@/components/estimates/wizard/screens/step-types";
import type { WizardScreenConfiguration } from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import type { ConfiguredPricingConfiguration } from "@/components/estimates/wizard/pricing/wizard-pricing-input-adapter-config";
import type { ConfiguredCoupon } from "@/lib/pricing/configured-coupon-total";
import type { PpfCoatingAdjustmentRule } from "./ppf-coating-adjustment-core";
import type {
  FilmTypeOption, WindowAreaOption, MaintenanceMenu, WashMenu, RoomMenu,
  InstallationMethodOption, PpfPartOption, PpfTypeGroup, PpfTypeOption,
  OtherWorkPresetItem, StoreGlobalOption, CouponOption, PpfInstallationMethodId,
} from "@/components/estimates/wizard/screens/step-types";

// ── Failure contract ─────────────────────────────────────────────────────────
export type WizardRuntimeConfigFailure =
  | "no-dealer"
  | "rank-unavailable"
  | "catalog-read-failed"
  | "lifecycle-read-failed"
  | "lifecycle-missing"
  | "review-required"
  | "revision-mismatch"
  | "missing-required-globals"
  | "duplicate-code"
  | "malformed-catalog-row"
  | "invalid-rank-category"
  // B2-E2G: the dealer's service-offering map could not be READ. Deliberately a typed failure
  // rather than a fallback to all-OFF: defaulting an unreadable map to "opted out" would hide every
  // configured service behind what looks like the dealer's own choice, and nothing would surface it.
  | "service-offerings-read-failed"
  | "pricing-catalog-failed"
  | "config-build-failed"
  // B1.1-B2: a FAILED adjustment read is never treated as "no rules" — that would silently
  // drop a configured reduction and overcharge the customer.
  | "adjustments-read-failed"
  | "malformed-coupon-row"
  | "malformed-adjustment-row";

// ── Row shapes (hand-typed; no repo-wide generated Supabase types exist) ──────
export interface WizardCatalogRow {
  id: string;
  market: string;
  product_mode: string;
  kind: string;
  owner_scope: string;
  dealer_id: string | null;
  code: string;
  label_ja: string | null;
  display_order: number;
  is_active: boolean;
  default_unit_price: number | null;
  priceable: boolean;
  quantity_required: boolean;
  min_quantity: number;
  max_quantity: number | null;
  ppf_type_group_id: string | null;
  duration_minutes: number | null;
  deleted_at: string | null;
  presentation: unknown;
  ranks: readonly string[];
  categories: readonly string[];
  // ── B1.1-B2 projected columns (110). Optional so existing fixtures/readers compile unchanged;
  //    an absent value means "not configured", never a fabricated default.
  install_coefficient_bp?: number | null;
  /** 'amount' | 'percent'. Percent is stored 0–100 by 103's `wci_coupon_percent_range`. */
  coupon_discount_type?: string | null;
  coupon_discount_value?: number | null;
  coupon_combinable?: boolean | null;
  coupon_valid_from?: string | null;
  coupon_valid_to?: string | null;
}

/** One dealer-scoped PPF + coating reduction rule, as read. `percent` values are basis points. */
export interface WizardPpfCoatingAdjustmentRow {
  id: string;
  dealer_id: string;
  ppf_method_code: string;
  coating_code: string;
  adjustment_type: string;
  adjustment_value: number;
  is_active: boolean;
  deleted_at: string | null;
}

export interface WizardLifecycleRow {
  state: string;
  current_configuration_revision: number;
  reviewed_configuration_revision: number | null;
  reviewed_at: string | null;
}

export interface WizardConfigReaders {
  getDealer: () => Promise<{ dealer_id: string } | null>;
  getRank: () => Promise<RankResolution>;
  getCatalog: () => Promise<PricingCatalogResolution>;
  getLifecycle: (dealerId: string) => Promise<{ ok: true; row: WizardLifecycleRow | null } | { ok: false }>;
  getCatalogRows: (dealerId: string) => Promise<{ ok: true; rows: WizardCatalogRow[] } | { ok: false }>;
  /**
   * B2-E2G — the dealer's explicit service-offering map. REQUIRED, unlike the adjustments reader: an
   * absent adjustments reader honestly means "no rules configured", whereas an absent offerings
   * reader would mean the resolver invented the answer. There is no default here.
   */
  getServiceOfferings: (dealerId: string) => Promise<{ ok: true; offerings: ServiceOfferings } | { ok: false }>;
  /**
   * B1.1-B2 — dealer-scoped PPF + coating reduction rules. OPTIONAL: an absent reader means the
   * dealer has no rules, which is the honest "not configured" state and prices exactly as before.
   * A reader that FAILS is fail-closed (`adjustments-read-failed`) — never silently treated as empty.
   */
  getPpfCoatingAdjustments?: (
    dealerId: string,
  ) => Promise<{ ok: true; rows: WizardPpfCoatingAdjustmentRow[] } | { ok: false }>;
  /**
   * ISO `YYYY-MM-DD` used for coupon validity. Supplied by the server entry so this core reads no
   * clock and stays pure/deterministic. Absent ⇒ dated coupons cannot validate and fail closed.
   */
  getCalculationDate?: () => string;
}

/**
 * EW-UI-5A1-B3-P0 — the DEALER-BOUND reader contract.
 *
 * Every reader — rank, pricing catalog, lifecycle AND catalog rows — receives the tenant EXPLICITLY.
 * In `WizardConfigReaders` above, `getRank`/`getCatalog` take no argument and therefore discover
 * their own dealer internally (in the arg-less server wrapper: `getCurrentDealer()`), while
 * `getLifecycle`/`getCatalogRows` are handed the dealer the resolver discovered. Two independent
 * discoveries can disagree. Here they cannot: the tenant is an explicit parameter of EVERY reader,
 * so a cross-dealer pairing is unrepresentable rather than merely unlikely.
 */
export interface WizardDealerBoundConfigReaders {
  getRank: (dealerId: string) => Promise<RankResolution>;
  getCatalog: (dealerId: string) => Promise<PricingCatalogResolution>;
  getLifecycle: (dealerId: string) => Promise<{ ok: true; row: WizardLifecycleRow | null } | { ok: false }>;
  getCatalogRows: (dealerId: string) => Promise<{ ok: true; rows: WizardCatalogRow[] } | { ok: false }>;
  getServiceOfferings: (dealerId: string) => Promise<{ ok: true; offerings: ServiceOfferings } | { ok: false }>;
  getPpfCoatingAdjustments?: (
    dealerId: string,
  ) => Promise<{ ok: true; rows: WizardPpfCoatingAdjustmentRow[] } | { ok: false }>;
  getCalculationDate?: () => string;
}

export type AuthoritativeWizardRuntimeConfiguration =
  | {
      ok: true;
      /**
       * The EXACT dealer this configuration was resolved for — the `dealer.dealer_id` the resolver
       * actually used to read lifecycle and catalog rows, and against which every row's ownership
       * was validated. Callers that hold their own tenant authority can assert identity against it.
       */
      readonly dealerId: string;
      shopRank: ShopRank;
      catalog: PricingCatalog;
      screenConfig: WizardScreenConfiguration;
      /**
       * B1.1-B2: now carries the projected coupons, PPF coefficients and PPF/coating reduction
       * rules. The extension fields are optional, so every existing consumer typed against
       * `ProductionPricingConfiguration` keeps compiling and behaving identically.
       */
      pricingConfig: ConfiguredPricingConfiguration;
      lifecycle: { state: string; currentRevision: number; reviewedRevision: number };
    }
  | { ok: false; reason: WizardRuntimeConfigFailure };

const fail = (reason: WizardRuntimeConfigFailure): AuthoritativeWizardRuntimeConfiguration => ({ ok: false, reason });

const CODE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDOW_AREA_CODES = ["front-windshield", "front-door-glass", "rear-door-glass", "triangular-window", "quarter-glass", "rear-glass", "sunroof"] as const;
const PPF_METHOD_IDS: readonly PpfInstallationMethodId[] = ["full", "partial", "windshield", "sunroof", "interior"];

// ── Presentation parse (film display attrs only; fail closed on malformed) ────
function parseFilmPresentation(p: unknown): { ok: true; v: Pick<FilmTypeOption, "brand" | "vlt" | "heatRejection" | "color"> } | { ok: false } {
  const out: Pick<FilmTypeOption, "brand" | "vlt" | "heatRejection" | "color"> = {};
  if (p === null || typeof p !== "object" || Array.isArray(p)) return { ok: false };
  const o = p as Record<string, unknown>;
  for (const k of ["brand", "vlt", "heatRejection", "color"] as const) {
    if (k in o && o[k] !== undefined) {
      if (typeof o[k] !== "string") return { ok: false };
      out[k] = o[k] as string;
    }
  }
  return { ok: true, v: out }; // unknown keys (e.g. legacyId) ignored; legacyId never becomes identity
}

const byOrder = <T extends { display_order: number; code: string }>(a: T, b: T) =>
  a.display_order - b.display_order || a.code.localeCompare(b.code);

// ── PURE resolver ──────────────────────────────────────────────────────────
export async function resolveWizardRuntimeConfig(readers: WizardConfigReaders): Promise<AuthoritativeWizardRuntimeConfiguration> {
  const dealer = await readers.getDealer();
  if (!dealer) return fail("no-dealer");

  const rank = await readers.getRank();
  if (!rank.ok) return fail("rank-unavailable");
  const shopRank = rank.rank;

  const lc = await readers.getLifecycle(dealer.dealer_id);
  if (!lc.ok) return fail("lifecycle-read-failed");
  if (!lc.row) return fail("lifecycle-missing");
  const life = lc.row;
  if (life.state !== "CATALOG_REVIEWED" && life.state !== "CATALOG_ACTIVE") return fail("review-required");
  if (life.reviewed_at === null || life.reviewed_configuration_revision === null) return fail("review-required");
  if (life.reviewed_configuration_revision !== life.current_configuration_revision) return fail("revision-mismatch");

  const cat = await readers.getCatalogRows(dealer.dealer_id);
  if (!cat.ok) return fail("catalog-read-failed");

  // ── Validate every resolved row (active/undeleted only; identity/format/ownership/rank) ──
  const seen = new Set<string>();
  for (const r of cat.rows) {
    if (!r.is_active || r.deleted_at !== null) return fail("malformed-catalog-row");
    if (r.market !== "jp" || r.product_mode !== "gyeon") return fail("malformed-catalog-row");
    if (!CODE_RE.test(r.code)) return fail("malformed-catalog-row");
    if (r.owner_scope === "global" ? r.dealer_id !== null : r.dealer_id !== dealer.dealer_id) return fail("malformed-catalog-row");
    const key = JSON.stringify([r.kind, r.code, r.owner_scope]);
    if (seen.has(key)) return fail("duplicate-code");
    seen.add(key);
    if (r.ranks.length === 0 || r.categories.length > 1) return fail("invalid-rank-category");
  }

  // ── Required global families (exact 105 identities) ──
  const globals = cat.rows.filter((r) => r.owner_scope === "global");
  const gWindow = globals.filter((r) => r.kind === "window_area");
  const gMethod = globals.filter((r) => r.kind === "ppf_method");
  const gPart = globals.filter((r) => r.kind === "ppf_part");
  const gGroup = globals.filter((r) => r.kind === "ppf_type_group");
  const windowCodes = new Set(gWindow.map((r) => r.code));
  if (gWindow.length !== 7 || WINDOW_AREA_CODES.some((c) => !windowCodes.has(c))) return fail("missing-required-globals");
  if (gMethod.length !== 5 || gPart.length !== 16 || gGroup.length !== 11) return fail("missing-required-globals");

  // ── Authoritative pricing catalog (fail-closed) — read AFTER all catalog-row/global validation
  //    and BEFORE buildConfigs. Any provider failure — a thrown reader OR ok:false for ANY internal
  //    reason — collapses to a single "pricing-catalog-failed"; the provider's internal reason is
  //    never exposed through the aggregate, and a failed catalog is never defaulted or recovered.
  //    Only the ok:true arm may access the catalog, which is passed through unchanged. ──
  let catalogResult: PricingCatalogResolution;
  try {
    catalogResult = await readers.getCatalog();
  } catch {
    return fail("pricing-catalog-failed");
  }
  if (!catalogResult.ok) return fail("pricing-catalog-failed");
  const catalog = catalogResult.catalog;

  // ── B1.1-B2: dealer-scoped PPF + coating reduction rules. Read AFTER catalog validation and
  //    BEFORE buildConfigs, on the SAME tenant. A reader that fails is fail-closed: treating a
  //    failed read as "no rules" would silently drop a configured reduction. ──
  let adjustmentRows: readonly WizardPpfCoatingAdjustmentRow[] = [];
  if (readers.getPpfCoatingAdjustments) {
    let adj: { ok: true; rows: WizardPpfCoatingAdjustmentRow[] } | { ok: false };
    try {
      adj = await readers.getPpfCoatingAdjustments(dealer.dealer_id);
    } catch {
      return fail("adjustments-read-failed");
    }
    if (!adj.ok) return fail("adjustments-read-failed");
    for (const r of adj.rows) {
      // Ownership is validated here too, exactly as for catalog rows: RLS may legitimately expose
      // two dealers' rows to a multi-membership user, so admission is refused twice over.
      if (r.dealer_id !== dealer.dealer_id) return fail("malformed-adjustment-row");
      if (r.adjustment_type !== "amount" && r.adjustment_type !== "percent") return fail("malformed-adjustment-row");
      if (!Number.isInteger(r.adjustment_value) || r.adjustment_value < 0) return fail("malformed-adjustment-row");
      if (!CODE_RE.test(r.ppf_method_code) || !CODE_RE.test(r.coating_code)) return fail("malformed-adjustment-row");
    }
    adjustmentRows = adj.rows.filter((r) => r.deleted_at === null);
  }

  // ── B2-E2G: the dealer's explicit service-offering map ──
  // Read on the SAME bound tenant as every other reader. A failed read is fail-closed with its own
  // reason and is never coerced to all-OFF — see the failure-contract note. Note what this does NOT
  // do: a family that is simply OFF, or ON with nothing configured, is a perfectly valid
  // configuration and resolves ok. Only an unreadable map fails, because only that is a defect.
  let serviceOfferings: ServiceOfferings;
  try {
    const so = await readers.getServiceOfferings(dealer.dealer_id);
    if (!so.ok) return fail("service-offerings-read-failed");
    serviceOfferings = so.offerings;
  } catch {
    return fail("service-offerings-read-failed");
  }

  // ── Build configurations (rank-filtered) ──
  const built = buildConfigs(
    cat.rows,
    shopRank,
    catalog,
    serviceOfferings,
    adjustmentRows,
    readers.getCalculationDate?.() ?? "",
  );
  if (!built.ok) return fail(built.reason);

  return {
    ok: true,
    dealerId: dealer.dealer_id, // the exact tenant every read above was scoped to
    shopRank,
    catalog,
    screenConfig: built.screenConfig,
    pricingConfig: built.pricingConfig,
    lifecycle: { state: life.state, currentRevision: life.current_configuration_revision, reviewedRevision: life.reviewed_configuration_revision },
  };
}

// ── PURE dealer-bound resolver ───────────────────────────────────────────────
/**
 * EW-UI-5A1-B3-P0 — resolve the runtime configuration for ONE EXPLICIT tenant.
 *
 * The caller supplies the tenant authority; this function guarantees it is the ONLY one in play.
 * `dealerId` is captured once as a single constant and injected into EVERY reader — rank, pricing
 * catalog, lifecycle and catalog rows — so all four reads are provably scoped to the same tenant.
 * The `dealerId` the core passes back to `getLifecycle`/`getCatalogRows` is deliberately ignored in
 * favour of that one constant, leaving no path by which a second tenant could enter.
 *
 * Fail-closed: a blank/whitespace/non-string dealer id is `"no-dealer"`. There is NO fallback, NO
 * default tenant, and NO fixture. Every validation and failure reason of `resolveWizardRuntimeConfig`
 * applies unchanged — this is a strictly narrower entry point, never a weaker one.
 */
export async function resolveWizardRuntimeConfigForDealer(
  dealerId: string,
  readers: WizardDealerBoundConfigReaders,
): Promise<AuthoritativeWizardRuntimeConfiguration> {
  if (typeof dealerId !== "string" || dealerId.trim() === "") return fail("no-dealer");

  // ONE constant, closed over by every reader below. Never reassigned, never re-derived.
  const boundDealerId: string = dealerId;

  return resolveWizardRuntimeConfig({
    getDealer: async () => ({ dealer_id: boundDealerId }),
    getRank: () => readers.getRank(boundDealerId),
    getCatalog: () => readers.getCatalog(boundDealerId),
    getLifecycle: () => readers.getLifecycle(boundDealerId),
    getCatalogRows: () => readers.getCatalogRows(boundDealerId),
    getServiceOfferings: () => readers.getServiceOfferings(boundDealerId),
    // Bound to the SAME single constant tenant as every other reader above.
    ...(readers.getPpfCoatingAdjustments
      ? { getPpfCoatingAdjustments: () => readers.getPpfCoatingAdjustments!(boundDealerId) }
      : {}),
    ...(readers.getCalculationDate ? { getCalculationDate: readers.getCalculationDate } : {}),
  });
}

// ── Pure builders ────────────────────────────────────────────────────────────
function buildConfigs(
  rows: readonly WizardCatalogRow[],
  rank: ShopRank,
  _catalog: PricingCatalog,
  // B2-E2E — REQUIRED, and positioned ahead of the defaulted params so it cannot acquire a default.
  // The opt-in must always be supplied by the resolver, never assumed here.
  serviceOfferings: ServiceOfferings,
  adjustmentRows: readonly WizardPpfCoatingAdjustmentRow[] = [],
  calculationDate = "",
): { ok: true; screenConfig: WizardScreenConfiguration; pricingConfig: ConfiguredPricingConfiguration } | { ok: false; reason: WizardRuntimeConfigFailure } {
  // Rank filtering: an item is offered only when its business ranks include the dealer rank.
  const eligible = rows.filter((r) => r.ranks.includes(rank));
  const of = (kind: string, scope?: "global" | "dealer") =>
    eligible.filter((r) => r.kind === kind && (scope ? r.owner_scope === scope : true)).slice().sort(byOrder);

  const menu = (r: WizardCatalogRow): MaintenanceMenu => ({ id: r.code, name: r.label_ja ?? "", defaultPrice: r.default_unit_price ?? 0, displayOrder: r.display_order });

  // Film types (dealer-owned; malformed presentation fails closed)
  const filmTypes: FilmTypeOption[] = [];
  for (const r of of("film_type", "dealer")) {
    const pres = parseFilmPresentation(r.presentation);
    if (!pres.ok) return { ok: false, reason: "malformed-catalog-row" };
    filmTypes.push({ id: r.code, label: r.label_ja ?? "", ...pres.v, defaultUnitPrice: r.default_unit_price ?? undefined });
  }
  const windowAreas: WindowAreaOption[] = of("window_area", "global").map((r) => ({ id: r.code, label: r.label_ja ?? "" }));

  // B2-E2B: an ABSENT optional product line is no longer a whole-wizard failure. A dealer with no
  // film types configured keeps every other category usable; window film alone becomes unavailable,
  // gated in the live Step-4 path (steps/Step4Estimate.tsx) which locks the section and tells the
  // owner where to register film types. `filmTypes` is simply carried through empty — never
  // defaulted, never seeded with example products. A MALFORMED film row still fails closed above
  // (`malformed-catalog-row`): absence is a configuration state, malformed data is a defect.

  // PPF methods must be the canonical ids (validated globals ⇒ safe narrow).
  const ppfMethods: InstallationMethodOption[] = [];
  for (const r of of("ppf_method", "global")) {
    if (!PPF_METHOD_IDS.includes(r.code as PpfInstallationMethodId)) return { ok: false, reason: "malformed-catalog-row" };
    ppfMethods.push({ id: r.code as PpfInstallationMethodId, label: r.label_ja ?? "" });
  }
  const ppfParts: PpfPartOption[] = of("ppf_part", "global").map((r) => ({
    id: r.code, label: r.label_ja ?? "",
    ...(r.quantity_required ? { quantityRequired: true, minQty: r.min_quantity, maxQty: r.max_quantity ?? undefined } : {}),
  }));

  // PPF type groups: parents (ppf_type_group_id NULL) + their product children.
  const groupRows = of("ppf_type_group", "global");
  const parents = groupRows.filter((r) => r.ppf_type_group_id === null);
  const ppfTypeGroups: PpfTypeGroup[] = parents.map((p) => ({
    id: p.code, label: p.label_ja ?? "",
    products: groupRows.filter((c) => c.ppf_type_group_id === p.id).sort(byOrder).map((c): PpfTypeOption => ({ id: c.code, label: c.label_ja ?? "" })),
  }));

  // ── B1.1-B2: dealer-authored coupons (kind = 'coupon', dealer scope) ─────────
  // 103 stores a percent coupon as 0–100 (`wci_coupon_percent_range`), while the pricing engine
  // consumes integer BASIS POINTS. The conversion happens HERE, once, at the projection boundary —
  // so exactly one place owns the unit and the two can never drift apart.
  const couponRows = of("coupon", "dealer");
  const configuredCoupons: ConfiguredCoupon[] = [];
  for (const r of couponRows) {
    const type = r.coupon_discount_type;
    const value = r.coupon_discount_value;
    if ((type !== "amount" && type !== "percent") || typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return { ok: false, reason: "malformed-coupon-row" };
    }
    if (type === "percent" && value > 100) return { ok: false, reason: "malformed-coupon-row" };
    configuredCoupons.push({
      couponId: r.id,
      code: r.code,
      label: r.label_ja ?? "",
      value: type === "amount"
        ? { kind: "amount", amountYen: value }
        : { kind: "percent", basisPoints: value * 100 }, // 0–100 → basis points
      combinable: r.coupon_combinable ?? false,
      validFrom: r.coupon_valid_from ?? null,
      validTo: r.coupon_valid_to ?? null,
      isActive: r.is_active,
      displayOrder: r.display_order,
    });
  }

  // ── B1.1-B2: PPF installation coefficients, keyed by the item CODE ───────────
  // The wizard's manual PPF identity is the catalog code, so the map is keyed by code and an
  // unconfigured code simply has no entry (the coefficient helper then applies the identity).
  const installCoefficientBpByCode: Record<string, number> = {};
  for (const r of [...of("ppf_type_group"), ...of("film_type")]) {
    const bp = r.install_coefficient_bp;
    if (bp === null || bp === undefined) continue;
    if (!Number.isInteger(bp) || bp <= 0) return { ok: false, reason: "malformed-catalog-row" };
    installCoefficientBpByCode[r.code] = bp;
  }

  const ppfCoatingAdjustments: PpfCoatingAdjustmentRule[] = adjustmentRows.map((r) => ({
    ruleId: r.id,
    ppfMethodCode: r.ppf_method_code,
    coatingCode: r.coating_code,
    adjustmentType: r.adjustment_type === "percent" ? "percent" : "amount",
    adjustmentValue: r.adjustment_value,
    isActive: r.is_active,
  }));

  const screenConfig: WizardScreenConfiguration = {
    // B2-E2G — carried through exactly as read. Rank is NOT consulted for any of the five managed
    // families: every rank may sell them, and this dealer-owned map is the sole authority over
    // whether each is offered. Availability of a family is decided in the Step-4 host, never here.
    serviceOfferings,
    maintenanceMenus: of("maintenance_menu", "dealer").map(menu) as MaintenanceMenu[],
    washMenus: of("wash_menu", "dealer").map(menu) as WashMenu[],
    roomMenus: of("room_cleaning_menu", "dealer").map(menu) as RoomMenu[],
    filmTypes,
    windowAreas,
    otherWorkPresets: of("other_work_preset", "dealer").map((r): OtherWorkPresetItem => ({ id: r.code, name: r.label_ja ?? "", defaultPrice: r.default_unit_price ?? 0, displayOrder: r.display_order })),
    storeGlobalOptions: of("store_global_option", "dealer").map((r): StoreGlobalOption => ({ id: r.code, name: r.label_ja ?? "", defaultPrice: r.default_unit_price ?? 0, editableUnitPrice: false, quantityRequired: r.quantity_required, minQty: r.min_quantity, maxQty: r.max_quantity ?? undefined, displayOrder: r.display_order })),
    coupons: couponRows.map((r): CouponOption => ({
      id: r.code,
      name: r.label_ja ?? "",
      discountType: r.coupon_discount_type === "percent" ? "percent" : "amount",
      discountValue: r.coupon_discount_value ?? 0,
      combinable: r.coupon_combinable ?? false,
      displayOrder: r.display_order,
      ...(r.coupon_valid_from || r.coupon_valid_to
        ? { validityText: `${r.coupon_valid_from ?? ""} 〜 ${r.coupon_valid_to ?? ""}`.trim() }
        : {}),
    })),
    ppfMethods,
    ppfParts,
    ppfTypeGroups,
  };

  const label = (r: WizardCatalogRow) => ({ code: r.code, label: r.label_ja ?? "" });
  const pricingConfig: ConfiguredPricingConfiguration = {
    coupons: configuredCoupons,
    installCoefficientBpByCode,
    ppfCoatingAdjustments,
    calculationDate,
    ppfMethods: of("ppf_method", "global").map(label),
    filmTypes: of("film_type", "dealer").map(label),
    maintenanceMenus: of("maintenance_menu", "dealer").map(label),
    washMenus: of("wash_menu", "dealer").map(label),
    roomCleaningMenus: of("room_cleaning_menu", "dealer").map(label),
    storeGlobalOptions: of("store_global_option", "dealer").map((r) => ({ code: r.code, label: r.label_ja ?? "", priceable: r.priceable, quantityRequired: r.quantity_required, minQuantity: r.min_quantity, maxQuantity: r.max_quantity })),
  };

  return { ok: true, screenConfig, pricingConfig };
}
