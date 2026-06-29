// GYEON Product Category Defaults — default PURCHASE permission per category.
//
// Pure module (no DB / no "use server"). Safe for client or server import.
//
// Canonical rule: a product's OWN minimum_purchase_rank (product master) is
// authoritative and always wins. This map only supplies the DEFAULT tier when a
// product is created / seeded / CSV-imported in a given category, so operators
// don't have to set common cases by hand.
//
// FINAL business rule captured here:
//   - PPF category  ->  detailer_plus   (PPF products require Detailer or higher)
//
// Tier values come from the GLOBAL permission vocabulary, so these defaults are
// market-portable (not tied to Japan rank names).

import type { PermissionTier } from "@/lib/ranks/permission-tiers";

/** Default minimum PURCHASE tier keyed by normalized (lower-case) category. */
export const CATEGORY_DEFAULT_PURCHASE_TIER: Record<string, PermissionTier> = {
  ppf: "detailer_plus",
};

/** Fallback when a category has no specific default. */
export const DEFAULT_CATEGORY_PURCHASE_TIER: PermissionTier = "all";

/** Resolve the default purchase tier for a product category. */
export function defaultPurchaseTierForCategory(category: string | null | undefined): PermissionTier {
  const key = (category ?? "").trim().toLowerCase();
  return CATEGORY_DEFAULT_PURCHASE_TIER[key] ?? DEFAULT_CATEGORY_PURCHASE_TIER;
}
