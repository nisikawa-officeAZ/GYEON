// Estimate Wizard Ver2.2 — canonical coating identity ↔ PricingCatalog id (Phase C2B2A).
//
// THE SINGLE translation source between the Wizard-facing canonical coating identities and the
// legacy PricingCatalog ids in pricing-data.ts. No component may hold its own coating-id mapping —
// both pricing adapters (fixture + config) resolve through here so the two paths cannot diverge.
//
// The Wizard emits ONLY the canonical identities below (coating-matrix.ts is their sole producer).
// PricingCatalog keys/values are preserved verbatim; this module renames NOTHING and invents NO
// price. Where an authoritative PricingCatalog entry does not exist (matte-evo), the mapping is
// `null` so resolution stays FAIL-CLOSED — never zero, never a substitute coating, never a default.

/** Canonical Wizard-facing coating identities. The Wizard state/UI use ONLY these. */
export const CANONICAL_COATING_IDS = [
  "one-evo",
  "cancoat-evo",
  "pure-evo",
  "mohs-evo",
  "syncro-evo",
  "matte-evo",
  "infinite-base-1",
  "infinite-base-2",
  "infinite-topcoat-1",
  "infinite-topcoat-2",
  "cancoat-pro-evo",
] as const;

export type CanonicalCoatingId = (typeof CANONICAL_COATING_IDS)[number];

/** Legacy PricingCatalog ids that must NEVER be emitted from Wizard state or UI. */
export const LEGACY_PRICING_COATING_IDS = [
  "infinit1",
  "infinit2",
  "infinit-t1",
  "infinit-t2",
  "cancoat-evo-pro",
] as const;

/**
 * canonical Wizard id → PricingCatalog id.
 * `null` = no authoritative PricingCatalog price ⇒ resolution must fail closed (matte-evo).
 */
export const CANONICAL_TO_PRICING_COATING_ID: Record<CanonicalCoatingId, string | null> = {
  "one-evo": "one-evo",
  "cancoat-evo": "cancoat-evo",
  "pure-evo": "pure-evo",
  "mohs-evo": "mohs-evo",
  "syncro-evo": "syncro-evo",
  "matte-evo": null, // no authoritative PricingCatalog base price — FAIL CLOSED, never invent
  "infinite-base-1": "infinit1",
  "infinite-base-2": "infinit2",
  "infinite-topcoat-1": "infinit-t1",
  "infinite-topcoat-2": "infinit-t2",
  "cancoat-pro-evo": "cancoat-evo-pro",
};

/**
 * Translate a canonical Wizard coating id to its PricingCatalog id.
 * Returns `null` for matte-evo (no authoritative price) AND for any non-canonical/unknown id, so
 * callers uniformly treat `null` as "no priceable reference" and raise UNKNOWN_PRICING_REFERENCE.
 */
export function toPricingCatalogCoatingId(canonicalId: string | null | undefined): string | null {
  if (!canonicalId) return null;
  if (!(canonicalId in CANONICAL_TO_PRICING_COATING_ID)) return null;
  return CANONICAL_TO_PRICING_COATING_ID[canonicalId as CanonicalCoatingId];
}
