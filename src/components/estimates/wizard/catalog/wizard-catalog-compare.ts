// Estimate Wizard Ver2.2 — DEV-only config↔catalog identity comparison (Phase 10C).
//
// A development verification utility (NOT wired into any Screen; changes no runtime behavior). It
// compares the CURRENT Wizard preview-config ids against the projected production-catalog ids and
// reports identity mismatches, so the id-alignment work (10A/§14 blockers) can be tracked. Pure and
// deterministic; no arithmetic, no pricing, no side effects. It reads existing config arrays as data
// only. Labels are never used as identity — comparison is id-based.

import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import { projectProductionCatalogToWizard } from "./project-production-catalog";
import { FIXTURE_PRESENTATION_METADATA } from "./wizard-catalog-fixtures";
import type { WizardCatalogCategoryId } from "./wizard-catalog-types";

import { EXAMPLE_MAINTENANCE_MENUS } from "../screens/body-maintenance-config";
import { EXAMPLE_WASH_MENUS } from "../screens/car-wash-config";
import { EXAMPLE_ROOM_MENUS } from "../screens/room-cleaning-config";
import { EXAMPLE_STORE_GLOBAL_OPTIONS } from "../screens/store-global-options-config";

export type CatalogComparisonRow = {
  category:          WizardCatalogCategoryId;
  wizardOnlyIds:     string[]; // preview-config ids with NO matching production id
  catalogOnlyIds:    string[]; // production ids not present in the preview config
  matchedIds:        string[]; // ids present in both
};

/** Compare current Wizard preview-config ids against projected catalog ids, per category. Only the
 *  categories whose Wizard configs are simple id lists are compared here (others require model
 *  projection — see the audit doc). Returns a structural, id-based mismatch report. */
export function compareWizardConfigToCatalog(): CatalogComparisonRow[] {
  const projection = projectProductionCatalogToWizard(DEFAULT_PRICING_CATALOG, FIXTURE_PRESENTATION_METADATA);
  const catalogIdsByCategory = new Map<WizardCatalogCategoryId, Set<string>>();
  for (const cat of projection.categories) {
    catalogIdsByCategory.set(cat.categoryId, new Set(cat.items.map((i) => i.pricingReferenceId).filter((x): x is string => !!x)));
  }

  const wizardConfig: { category: WizardCatalogCategoryId; ids: string[] }[] = [
    { category: "maintenance", ids: EXAMPLE_MAINTENANCE_MENUS.map((m) => m.id) },
    { category: "carwash", ids: EXAMPLE_WASH_MENUS.map((m) => m.id) },
    { category: "roomclean", ids: EXAMPLE_ROOM_MENUS.map((m) => m.id) },
    { category: "store_global_options", ids: EXAMPLE_STORE_GLOBAL_OPTIONS.map((o) => o.id) },
  ];

  return wizardConfig.map(({ category, ids }) => {
    const catalogIds = catalogIdsByCategory.get(category) ?? new Set<string>();
    const wizardSet = new Set(ids);
    return {
      category,
      wizardOnlyIds: ids.filter((id) => !catalogIds.has(id)),
      catalogOnlyIds: [...catalogIds].filter((id) => !wizardSet.has(id)),
      matchedIds: ids.filter((id) => catalogIds.has(id)),
    };
  });
}
