// DealerOS — Canonical Pricing Catalog (Phase E4).
//
// The single, injectable price source for the pricing engine. The engine reads
// ALL products / grades / body-size multipliers / options / menus / PPF tables
// from a PricingCatalog rather than importing constants directly, so prices can
// come from Dealer Settings without touching the calculation code.
//
// DEFAULT_PRICING_CATALOG is assembled from the existing pricing-data constants,
// so the default behaviour is byte-for-byte identical to before E4. A
// settings-sourced catalog is produced by merging a Partial<PricingCatalog> over
// the defaults (makePricingCatalog) — the Dealer-Settings → Partial mapper is the
// validated activation step and is intentionally NOT wired live here.
//
// Body sizes are data-driven (an array on the catalog), so adding sizes needs no
// code change. Pure module — no I/O, no dealer data access.

import {
  BODY_SIZES, COATINGS, TOPCOAT_BASE, TOPCOAT_NAME, COATING_OPTIONS,
  MAINTENANCE_MENUS, CARWASH_MENUS, ROOM_CLEAN_PARTS, ROOM_CLEAN_CONDITIONS,
  WINDOW_FILM_PARTS, WINDOW_FILM_GRADES,
  PPF_PLANS, PPF_PLAN_PRICES, PPF_FILM_TYPES, PPF_VEHICLE_RANKS,
  PPF_FRONT_GLASS, PPF_SINGLE_PARTS,
} from "./pricing-data";
import type { EstimateCategory } from "@/lib/estimates/estimate-types";
import type { CoatingSettingsV34 } from "./coating-v34-contract";
import type { PpfR1PriceSettings } from "./ppf-r1-price-contract";
import type { WindowFilmSettingsV1 } from "./window-film-v1-contract";

// Widened element types (the pricing-data constants are `as const`; widening lets
// the mapper produce overlaid arrays that remain assignable to the catalog).
export interface CatalogBodySize   { key: string; name: string; multi: number; }
export interface CatalogCoating    { id: string; name: string; grade: string; base: number; certOnly?: boolean; }
export interface CatalogOption     { id: string; name: string; price: number; cat: EstimateCategory; }
export interface CatalogMenu       { id: string; name: string; price: number; }
export interface CatalogBasePart   { id: string; name: string; basePrice: number; }
export interface CatalogCoeff      { id: string; name: string; coeff: number; }
export interface CatalogCondition  { id: string; label: string; coeff: number; }
export interface CatalogPpfPlan    { id: string; name: string; desc: string; }
export interface CatalogPricedItem { id: string; name: string; price: number; }
export interface CatalogSinglePart { id: string; name: string; price: number; maxQty: number; }

export interface PricingCatalog {
  bodySizes:           readonly CatalogBodySize[];
  coatings:            readonly CatalogCoating[];
  topcoatBase:         Record<string, number>;
  topcoatName:         Record<string, string>;
  coatingOptions:      readonly CatalogOption[];
  maintenanceMenus:    readonly CatalogMenu[];
  carwashMenus:        readonly CatalogMenu[];
  roomCleanParts:      readonly CatalogBasePart[];
  roomCleanConditions: readonly CatalogCondition[];
  windowParts:         readonly CatalogBasePart[];
  windowGrades:        readonly CatalogCoeff[];
  ppfPlans:            readonly CatalogPpfPlan[];
  ppfPlanPrices:       Record<string, Record<string, number>>;
  ppfFilmTypes:        readonly CatalogCoeff[];
  ppfVehicleRanks:     readonly CatalogCoeff[];
  ppfFrontGlass:       readonly CatalogPricedItem[];
  ppfSingleParts:      readonly CatalogSinglePart[];
  // GDA_COATING_V3_4_C2_4 — seven-size direct-price coating contract. `null` for every
  // legacy/default catalog (DEFAULT_PRICING_CATALOG, makePricingCatalog with no V3.4 override);
  // set ONLY by the authoritative resolver once a persisted V34_READY payload is confirmed. Base,
  // layer2, and layer3 stay fully independent — no cross-layer fallback, no size multiplier.
  coatingV34:          CoatingSettingsV34 | null;
  // GDA_PPF_R1_C4B2 — the only PPF price contract the live wizard may consume.
  // Legacy PPF catalog fields remain temporarily for non-wizard compatibility,
  // but are never a fallback for this nullable authority.
  ppfR1:                PpfR1PriceSettings | null;
  // GDA_WINDOW_FILM_SETTINGS_C2 — fixed seven-area direct price/time contract.
  // Legacy windowParts/windowGrades remain for non-wizard compatibility only.
  windowFilmV1:         WindowFilmSettingsV1 | null;
}

export const DEFAULT_PRICING_CATALOG: PricingCatalog = {
  bodySizes:           BODY_SIZES,
  coatings:            COATINGS,
  topcoatBase:         TOPCOAT_BASE,
  topcoatName:         TOPCOAT_NAME,
  coatingOptions:      COATING_OPTIONS,
  maintenanceMenus:    MAINTENANCE_MENUS,
  carwashMenus:        CARWASH_MENUS,
  roomCleanParts:      ROOM_CLEAN_PARTS,
  roomCleanConditions: ROOM_CLEAN_CONDITIONS,
  windowParts:         WINDOW_FILM_PARTS,
  windowGrades:        WINDOW_FILM_GRADES,
  ppfPlans:            PPF_PLANS,
  ppfPlanPrices:       PPF_PLAN_PRICES,
  ppfFilmTypes:        PPF_FILM_TYPES,
  ppfVehicleRanks:     PPF_VEHICLE_RANKS,
  ppfFrontGlass:       PPF_FRONT_GLASS,
  ppfSingleParts:      PPF_SINGLE_PARTS,
  coatingV34:          null,
  ppfR1:                null,
  windowFilmV1:         null,
};

/** Data-driven body-size multiplier (future sizes need no code change). */
export function bodySizeMultiplier(catalog: PricingCatalog, sizeKey: string): number {
  return catalog.bodySizes.find((s) => s.key === sizeKey)?.multi ?? 1.0;
}

/**
 * Build a catalog by overlaying dealer-specific overrides on the defaults.
 * The Dealer-Settings → Partial<PricingCatalog> mapper is the validated
 * activation step; until then callers omit overrides and get DEFAULT behaviour.
 */
export function makePricingCatalog(overrides?: Partial<PricingCatalog>): PricingCatalog {
  return { ...DEFAULT_PRICING_CATALOG, ...(overrides ?? {}) };
}

// ── E5: Dealer Settings → Partial<PricingCatalog> (defensive overlay) ──────────
//
// Overlays dealer-configured PRICES/coeffs/multipliers onto the DEFAULT item set
// BY ID. Names/ids/item-sets stay from the default (so the wizard's selectable
// options and the engine's line items always match), except menus which also
// adopt the dealer's configured name. Every number is validated (finite, and
// >= 0 for prices / > 0 for coefficients); anything missing, malformed, disabled,
// or non-numeric falls back to the default FOR THAT PART ONLY — never NaN, never
// negative, never a broken estimate.

import type { ServicePriceSettings, PpfPriceTables, BodySizeKey } from "@/lib/dealer-settings/dealer-settings-types";

function validPrice(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function validCoeff(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function dealerSettingsToPricingCatalog(
  svc: ServicePriceSettings | null | undefined,
  ppf: PpfPriceTables | null | undefined,
): Partial<PricingCatalog> {
  const out: Partial<PricingCatalog> = {};
  try {
    const c = svc?.coating;
    if (c) {
      const prodPrice = new Map<string, number>();
      for (const p of c.products ?? []) {
        const price = validPrice(p?.base_price_m);
        if (p?.id && price !== null && p.active !== false) prodPrice.set(p.id, price);
      }
      out.coatings = DEFAULT_PRICING_CATALOG.coatings.map((cc) => {
        const pr = prodPrice.get(cc.id);
        return pr !== undefined ? { ...cc, base: pr } : cc;
      });

      out.bodySizes = DEFAULT_PRICING_CATALOG.bodySizes.map((b) => {
        const m = validCoeff(c.size_multipliers?.[b.key as BodySizeKey]);
        return m !== null ? { ...b, multi: m } : b;
      });

      const topcoatBase = { ...DEFAULT_PRICING_CATALOG.topcoatBase };
      for (const [id, v] of Object.entries(c.topcoat_prices ?? {})) {
        const price = validPrice(v);
        if (price !== null) topcoatBase[id] = price;
      }
      out.topcoatBase = topcoatBase;

      out.coatingOptions = DEFAULT_PRICING_CATALOG.coatingOptions.map((o) => {
        const price = validPrice(c.option_prices?.[o.id]);
        return price !== null ? { ...o, price } : o;
      });
    }

    const wf = svc?.window_film;
    if (wf) {
      out.windowParts = DEFAULT_PRICING_CATALOG.windowParts.map((p) => {
        const price = validPrice(wf.base_prices?.[p.id]);
        return price !== null ? { ...p, basePrice: price } : p;
      });
      out.windowGrades = DEFAULT_PRICING_CATALOG.windowGrades.map((g) => {
        const coeff = validCoeff(wf.grade_coeff?.[g.id]);
        return coeff !== null ? { ...g, coeff } : g;
      });
    }

    const overlayMenus = (defs: PricingCatalog["maintenanceMenus"], menus?: { id: string; name: string; price: number }[]) =>
      defs.map((m) => {
        const s = (menus ?? []).find((x) => x.id === m.id);
        const price = validPrice(s?.price);
        const name = s?.name && s.name.trim() !== "" ? s.name : m.name;
        return { ...m, name, price: price !== null ? price : m.price };
      });
    if (svc?.maintenance) out.maintenanceMenus = overlayMenus(DEFAULT_PRICING_CATALOG.maintenanceMenus, svc.maintenance.menus);
    if (svc?.carwash) out.carwashMenus = overlayMenus(DEFAULT_PRICING_CATALOG.carwashMenus, svc.carwash.menus);

    const rc = svc?.room_cleaning;
    if (rc) {
      out.roomCleanParts = DEFAULT_PRICING_CATALOG.roomCleanParts.map((p) => {
        const price = validPrice(rc.base_prices?.[p.id]);
        return price !== null ? { ...p, basePrice: price } : p;
      });
      out.roomCleanConditions = DEFAULT_PRICING_CATALOG.roomCleanConditions.map((cond) => {
        const coeff = validCoeff(rc.condition_coeff?.[cond.id]);
        return coeff !== null ? { ...cond, coeff } : cond;
      });
    }

    if (ppf) {
      // plan_prices are FLAT "plan_size" keys → map onto the nested plan→size table.
      const planPrices: Record<string, Record<string, number>> = {};
      for (const [plan, sizes] of Object.entries(DEFAULT_PRICING_CATALOG.ppfPlanPrices)) {
        planPrices[plan] = { ...sizes };
      }
      for (const [key, v] of Object.entries(ppf.plan_prices ?? {})) {
        const price = validPrice(v);
        if (price === null) continue;
        const idx = key.lastIndexOf("_");
        if (idx <= 0) continue;
        const plan = key.slice(0, idx);
        const size = key.slice(idx + 1);
        if (!planPrices[plan]) planPrices[plan] = {};
        planPrices[plan][size] = price;
      }
      out.ppfPlanPrices = planPrices;

      out.ppfFilmTypes = DEFAULT_PRICING_CATALOG.ppfFilmTypes.map((f) => {
        const coeff = validCoeff(ppf.film_coeff?.[f.id]);
        return coeff !== null ? { ...f, coeff } : f;
      });
      out.ppfVehicleRanks = DEFAULT_PRICING_CATALOG.ppfVehicleRanks.map((r) => {
        const coeff = validCoeff(ppf.rank_coeff?.[r.id]);
        return coeff !== null ? { ...r, coeff } : r;
      });
      out.ppfFrontGlass = DEFAULT_PRICING_CATALOG.ppfFrontGlass.map((g) => {
        const price = validPrice(ppf.glass_prices?.[g.id]);
        return price !== null ? { ...g, price } : g;
      });
      out.ppfSingleParts = DEFAULT_PRICING_CATALOG.ppfSingleParts.map((p) => {
        const price = validPrice(ppf.parts_prices?.[p.id]);
        return price !== null ? { ...p, price } : p;
      });
    }
  } catch (err) {
    console.warn("[dealerSettingsToPricingCatalog] failed — using defaults:", err);
    return {};
  }
  return out;
}
