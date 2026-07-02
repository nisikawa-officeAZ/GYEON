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

export interface PricingCatalog {
  bodySizes:           typeof BODY_SIZES;
  coatings:            typeof COATINGS;
  topcoatBase:         typeof TOPCOAT_BASE;
  topcoatName:         typeof TOPCOAT_NAME;
  coatingOptions:      typeof COATING_OPTIONS;
  maintenanceMenus:    typeof MAINTENANCE_MENUS;
  carwashMenus:        typeof CARWASH_MENUS;
  roomCleanParts:      typeof ROOM_CLEAN_PARTS;
  roomCleanConditions: typeof ROOM_CLEAN_CONDITIONS;
  windowParts:         typeof WINDOW_FILM_PARTS;
  windowGrades:        typeof WINDOW_FILM_GRADES;
  ppfPlans:            typeof PPF_PLANS;
  ppfPlanPrices:       typeof PPF_PLAN_PRICES;
  ppfFilmTypes:        typeof PPF_FILM_TYPES;
  ppfVehicleRanks:     typeof PPF_VEHICLE_RANKS;
  ppfFrontGlass:       typeof PPF_FRONT_GLASS;
  ppfSingleParts:      typeof PPF_SINGLE_PARTS;
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
