// DealerOS — canonical document item ordering (Phase E7).
//
// One shared category sequence so estimate summary, Estimate PDF, Invoice,
// Invoice PDF, and Completion Report all list line items in the same
// GenSpark-aligned order:
//   coating → ppf → window → maintenance → carwash → roomclean → options → other
//
// "options" is not a stored line-item category (there is no per-item option flag
// without a schema change, which is out of scope). Coating add-on options carry
// their own category — interior / glass rank at the options slot (7); process
// options categorised as "coating" stay grouped with coating; "other"-category
// options fall into the final slot (8). Within a category, the original
// sort_order is preserved. Reordering never changes amounts (sums are
// order-independent; totals are read from stored values).

export const CATEGORY_ORDER: Record<string, number> = {
  coating:     1,
  ppf:         2,
  window:      3,
  maintenance: 4,
  carwash:     5,
  roomclean:   6,
  interior:    7, // options (room/leather add-ons, and legacy roomclean pre-093)
  glass:       7, // options (glass coat add-on)
  other:       8,
};

export function categoryRank(category: string): number {
  return CATEGORY_ORDER[category] ?? 99;
}

export function sortByCategoryOrder<T extends { category: string; sort_order: number }>(
  items: readonly T[],
): T[] {
  return items
    .slice()
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.sort_order - b.sort_order);
}
