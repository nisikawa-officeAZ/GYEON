import type { CatalogCoating, PricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { ShopRank } from "@/lib/dealer-settings/authoritative-shop-rank-core";
import {
  firstLayerOptions,
  secondLayerOptionsForRank,
  thirdLayerOptionsForRank,
} from "./wizard/screens/coating-matrix";

// The legacy editor catalog predates the wizard's canonical INFINITE ids. Keep the
// compatibility mapping in one place, then delegate every rank/layer decision to the
// same approved matrix used by the new-estimate wizard.
const LEGACY_TO_CANONICAL: Readonly<Record<string, string>> = {
  infinit1: "infinite-base-1",
  infinit2: "infinite-base-2",
  "infinit-t1": "infinite-topcoat-1",
  "infinit-t2": "infinite-topcoat-2",
  "cancoat-evo-pro": "cancoat-pro-evo",
};

export function canonicalCoatingId(id: string): string {
  return LEGACY_TO_CANONICAL[id] ?? id;
}

function allowedIds(options: readonly { id: string }[]): ReadonlySet<string> {
  return new Set(options.map((option) => option.id));
}

export function editorFirstLayerOptions(
  coatings: readonly CatalogCoating[],
  shopRank: ShopRank,
): readonly CatalogCoating[] {
  const allowed = allowedIds(firstLayerOptions(shopRank));
  return coatings.filter((coating) => allowed.has(canonicalCoatingId(coating.id)));
}

export function editorSecondLayerIds(baseId: string, shopRank: ShopRank): readonly string[] {
  const allowed = allowedIds(secondLayerOptionsForRank(canonicalCoatingId(baseId), shopRank));
  return [...allowed];
}

export function editorThirdLayerIds(baseId: string, shopRank: ShopRank): readonly string[] {
  const allowed = allowedIds(thirdLayerOptionsForRank(canonicalCoatingId(baseId), shopRank));
  return [...allowed];
}

export function editorTopcoatKeys(
  catalog: PricingCatalog,
  baseId: string,
  layer: 2 | 3,
  shopRank: ShopRank,
): readonly string[] {
  if (!baseId) return [];
  const allowed = new Set(
    layer === 2
      ? editorSecondLayerIds(baseId, shopRank)
      : editorThirdLayerIds(baseId, shopRank),
  );
  return Object.keys(catalog.topcoatBase).filter((id) => allowed.has(canonicalCoatingId(id)));
}

export function isEditorCoatingSelectionAllowed(
  catalog: PricingCatalog,
  shopRank: ShopRank,
  baseId: string,
  topcoat2?: string,
  topcoat3?: string,
): boolean {
  // Options-only coating work is valid for every coating-capable rank.
  if (!baseId) return shopRank !== "ppf_installer" && !topcoat2 && !topcoat3;

  const baseAllowed = editorFirstLayerOptions(catalog.coatings, shopRank)
    .some((coating) => coating.id === baseId);
  if (!baseAllowed) return false;

  const layer2 = new Set(editorTopcoatKeys(catalog, baseId, 2, shopRank));
  const layer3 = new Set(editorTopcoatKeys(catalog, baseId, 3, shopRank));
  return (!topcoat2 || layer2.has(topcoat2)) && (!topcoat3 || layer3.has(topcoat3));
}
