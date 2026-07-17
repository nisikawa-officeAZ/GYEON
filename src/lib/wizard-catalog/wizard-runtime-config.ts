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

import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { RankResolution } from "@/lib/dealer-settings/authoritative-shop-rank-core";
import type { ShopRank } from "@/components/estimates/wizard/screens/step-types";
import type { WizardScreenConfiguration } from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import type { ProductionPricingConfiguration } from "@/components/estimates/wizard/pricing/wizard-manual-pricing-config";
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
  | "window-film-no-film-types"
  | "pricing-catalog-failed"
  | "config-build-failed";

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
  getCatalog: () => Promise<PricingCatalog>;
  getLifecycle: (dealerId: string) => Promise<{ ok: true; row: WizardLifecycleRow | null } | { ok: false }>;
  getCatalogRows: (dealerId: string) => Promise<{ ok: true; rows: WizardCatalogRow[] } | { ok: false }>;
}

export type AuthoritativeWizardRuntimeConfiguration =
  | {
      ok: true;
      shopRank: ShopRank;
      catalog: PricingCatalog;
      screenConfig: WizardScreenConfiguration;
      pricingConfig: ProductionPricingConfiguration;
      lifecycle: { state: string; currentRevision: number; reviewedRevision: number };
    }
  | { ok: false; reason: WizardRuntimeConfigFailure };

const fail = (reason: WizardRuntimeConfigFailure): AuthoritativeWizardRuntimeConfiguration => ({ ok: false, reason });

const CODE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDOW_AREA_CODES = ["front-windshield", "front-door-glass", "rear-door-glass", "triangular-window", "quarter-glass", "rear-glass", "sunroof"] as const;
const PPF_METHOD_IDS: readonly PpfInstallationMethodId[] = ["full", "partial", "windshield", "sunroof", "interior"];
const RANKS_WITH_WINDOW_FILM: readonly ShopRank[] = ["detailer", "certified"];

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

  const catalog = await readers.getCatalog();

  // ── Build configurations (rank-filtered; fail closed on window-film gap) ──
  const built = buildConfigs(cat.rows, shopRank, catalog);
  if (!built.ok) return fail(built.reason);

  return {
    ok: true,
    shopRank,
    catalog,
    screenConfig: built.screenConfig,
    pricingConfig: built.pricingConfig,
    lifecycle: { state: life.state, currentRevision: life.current_configuration_revision, reviewedRevision: life.reviewed_configuration_revision },
  };
}

// ── Pure builders ────────────────────────────────────────────────────────────
function buildConfigs(
  rows: readonly WizardCatalogRow[],
  rank: ShopRank,
  _catalog: PricingCatalog,
): { ok: true; screenConfig: WizardScreenConfiguration; pricingConfig: ProductionPricingConfiguration } | { ok: false; reason: WizardRuntimeConfigFailure } {
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

  // Window Film fail-closed: rank can sell it (areas present) but no film types configured.
  if (RANKS_WITH_WINDOW_FILM.includes(rank) && windowAreas.length > 0 && filmTypes.length === 0) {
    return { ok: false, reason: "window-film-no-film-types" };
  }

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

  const screenConfig: WizardScreenConfiguration = {
    maintenanceMenus: of("maintenance_menu", "dealer").map(menu) as MaintenanceMenu[],
    washMenus: of("wash_menu", "dealer").map(menu) as WashMenu[],
    roomMenus: of("room_cleaning_menu", "dealer").map(menu) as RoomMenu[],
    filmTypes,
    windowAreas,
    otherWorkPresets: of("other_work_preset", "dealer").map((r): OtherWorkPresetItem => ({ id: r.code, name: r.label_ja ?? "", defaultPrice: r.default_unit_price ?? 0, displayOrder: r.display_order })),
    storeGlobalOptions: of("store_global_option", "dealer").map((r): StoreGlobalOption => ({ id: r.code, name: r.label_ja ?? "", defaultPrice: r.default_unit_price ?? 0, editableUnitPrice: false, quantityRequired: r.quantity_required, minQty: r.min_quantity, maxQty: r.max_quantity ?? undefined, displayOrder: r.display_order })),
    coupons: [] as CouponOption[], // coupons remain unsupported until stable dealer-authored coupon rows exist
    ppfMethods,
    ppfParts,
    ppfTypeGroups,
  };

  const label = (r: WizardCatalogRow) => ({ code: r.code, label: r.label_ja ?? "" });
  const pricingConfig: ProductionPricingConfiguration = {
    ppfMethods: of("ppf_method", "global").map(label),
    filmTypes: of("film_type", "dealer").map(label),
    maintenanceMenus: of("maintenance_menu", "dealer").map(label),
    washMenus: of("wash_menu", "dealer").map(label),
    roomCleaningMenus: of("room_cleaning_menu", "dealer").map(label),
    storeGlobalOptions: of("store_global_option", "dealer").map((r) => ({ code: r.code, label: r.label_ja ?? "", priceable: r.priceable, quantityRequired: r.quantity_required, minQuantity: r.min_quantity, maxQuantity: r.max_quantity })),
  };

  return { ok: true, screenConfig, pricingConfig };
}
