// Estimate Wizard Ver2.2 — Production catalog → Wizard presentation projection (Phase 10C).
//
// PURE, deterministic, side-effect-free. No API/DB, no React, no screen import, NO pricing/tax/
// discount/coupon calculation, NO price values exposed. Identity comes ONLY from the production
// catalog (`pricingReferenceId` = catalog id; `presentationId` intentionally reuses it). Labels are
// never used as identity; array position is used only for a presentation `displayOrder` fallback,
// never for identity. Missing metadata and identity conflicts are reported, never invented or
// auto-repaired. Running twice with identical inputs yields structurally identical output.

import type { PricingCatalog } from "@/lib/pricing/canonical-pricing-engine";
import type { PricingPolicy, ManualPricePolicy } from "@/lib/pricing/canonical-pricing-engine";
import type {
  WizardCatalogProjection, WizardCatalogCategory, WizardCatalogItem,
  WizardCatalogCategoryId, WizardPresentationMetadata, WizardCatalogWarning, WizardCatalogError,
} from "./wizard-catalog-types";
import { warn, err } from "./wizard-catalog-errors";

const CATEGORY_LABELS: Record<WizardCatalogCategoryId, string> = {
  coating: "ボディコーティング",
  ppf: "PPF",
  window: "ウィンドウフィルム",
  maintenance: "ボディ定期メンテナンス",
  carwash: "メンテナンス洗車",
  roomclean: "ルームクリーニング",
  other: "その他作業",
  store_global_options: "追加サービスオプション",
};

// 10A-approved pricing policy per category. Manual-override policy is NOT authoritatively provable
// from the catalog (no manual-price metadata exists), so the safest non-behavioral fallback
// ("disabled") is used and a MANUAL_POLICY_UNRESOLVED warning is raised for the pending categories.
const CATEGORY_PRICING_POLICY: Record<WizardCatalogCategoryId, PricingPolicy> = {
  coating: "catalog_only",
  ppf: "catalog_only",
  window: "catalog_only",
  maintenance: "catalog_only",
  carwash: "catalog_only",
  roomclean: "catalog_only",
  other: "manual_only",
  store_global_options: "catalog_only",
};
const MANUAL_POLICY_UNRESOLVED_CATEGORIES: WizardCatalogCategoryId[] = [
  "ppf", "window", "maintenance", "carwash", "roomclean", "store_global_options",
];

export function projectProductionCatalogToWizard(
  catalog: PricingCatalog,
  presentationMetadata: WizardPresentationMetadata,
): WizardCatalogProjection {
  const warnings: WizardCatalogWarning[] = [];
  const errors: WizardCatalogError[] = [];
  const categories: WizardCatalogCategory[] = [];

  try {
    const meta = presentationMetadata?.byId ?? {};
    const sizeKeys = catalog.bodySizes.map((s) => s.key);
    const optionIds = catalog.coatingOptions.map((o) => o.id);

    // Build one item from a catalog entry (identity from catalog; presentation from metadata).
    const mkItem = (
      id: string,
      name: string,
      category: WizardCatalogCategoryId,
      index: number,
      opts: { description?: string | null; supportedBodySizes?: string[]; optionReferenceIds?: string[] } = {},
    ): WizardCatalogItem => {
      const m = meta[id];
      if (!m) warnings.push(warn("MISSING_PRESENTATION_METADATA", `No presentation metadata for "${id}" — using catalog defaults.`, id, category));
      else if (m.iconKey == null) warnings.push(warn("MISSING_ICON_METADATA", `No icon for "${id}".`, id, category));
      return {
        presentationId: id,
        pricingReferenceId: id,
        category,
        label: m?.labelOverride?.trim() ? m.labelOverride!.trim() : name,
        description: m?.description ?? opts.description ?? null,
        pricingPolicy: CATEGORY_PRICING_POLICY[category],
        manualPricePolicy: "disabled" as ManualPricePolicy,
        active: true,
        eligible: true,
        supportedBodySizes: opts.supportedBodySizes ?? [],
        optionReferenceIds: dedupeOptionIds(id, category, opts.optionReferenceIds ?? [], errors),
        presentation: {
          displayOrder: m?.displayOrder ?? index,
          iconKey: m?.iconKey ?? null,
          badge: m?.badge ?? null,
          groupKey: m?.groupKey ?? null,
        },
      };
    };

    const label = (c: WizardCatalogCategoryId) => presentationMetadata?.categoryLabels?.[c] ?? CATEGORY_LABELS[c];

    // Coating — size-priced base products; coating options are attachable.
    categories.push({
      categoryId: "coating", label: label("coating"),
      items: catalog.coatings.map((c, i) =>
        mkItem(c.id, c.name, "coating", i, { description: c.grade, supportedBodySizes: sizeKeys, optionReferenceIds: optionIds })),
    });

    // Store Global Options — production models these as coating options.
    categories.push({
      categoryId: "store_global_options", label: label("store_global_options"),
      items: catalog.coatingOptions.map((o, i) => mkItem(o.id, o.name, "store_global_options", i)),
    });

    // Body Maintenance / Car Wash — flat-priced menus.
    categories.push({
      categoryId: "maintenance", label: label("maintenance"),
      items: catalog.maintenanceMenus.map((m, i) => mkItem(m.id, m.name, "maintenance", i)),
    });
    categories.push({
      categoryId: "carwash", label: label("carwash"),
      items: catalog.carwashMenus.map((m, i) => mkItem(m.id, m.name, "carwash", i)),
    });

    // Room Cleaning — base parts (condition coefficient is a modifier, not a standalone item).
    categories.push({
      categoryId: "roomclean", label: label("roomclean"),
      items: catalog.roomCleanParts.map((p, i) => mkItem(p.id, p.name, "roomclean", i)),
    });

    // Window Film — base parts (grade coefficient is a modifier).
    categories.push({
      categoryId: "window", label: label("window"),
      items: catalog.windowParts.map((p, i) => mkItem(p.id, p.name, "window", i)),
    });

    // PPF — plans (size-priced) + single parts + front glass (film/rank are coefficient modifiers).
    const ppfItems: WizardCatalogItem[] = [];
    catalog.ppfPlans.forEach((p, i) => {
      const table = catalog.ppfPlanPrices[p.id];
      const sizes = table ? Object.keys(table) : [];
      if (sizes.length === 0) warnings.push(warn("NO_BODY_SIZE_PRICE_TABLE", `PPF plan "${p.id}" has no size price table.`, p.id, "ppf"));
      ppfItems.push(mkItem(p.id, p.name, "ppf", i, { description: p.desc, supportedBodySizes: sizes }));
    });
    catalog.ppfSingleParts.forEach((p, i) => ppfItems.push(mkItem(p.id, p.name, "ppf", catalog.ppfPlans.length + i)));
    catalog.ppfFrontGlass.forEach((g, i) => ppfItems.push(mkItem(g.id, g.name, "ppf", catalog.ppfPlans.length + catalog.ppfSingleParts.length + i)));
    categories.push({ categoryId: "ppf", label: label("ppf"), items: ppfItems });

    // Other Work — NO production catalog category (OtherInput is free name+price → manual_only).
    categories.push({ categoryId: "other", label: label("other"), items: [] });
    warnings.push(warn("UNSUPPORTED_WIZARD_CATEGORY", "other_work has no production catalog source; it is manual_only (free name+price).", null, "other"));

    // Manual-policy-unresolved warnings (one per pending category).
    for (const c of MANUAL_POLICY_UNRESOLVED_CATEGORIES) {
      warnings.push(warn("MANUAL_POLICY_UNRESOLVED", `Manual-override policy for "${c}" is not authoritatively defined in the catalog; defaulted to "disabled".`, null, c));
    }

    // Duplicate identity detection across ALL projected items (no auto-repair — explicit errors).
    const seenPresentation = new Map<string, WizardCatalogCategoryId>();
    const seenProduction = new Map<string, WizardCatalogCategoryId>();
    for (const cat of categories) {
      for (const item of cat.items) {
        if (!item.pricingReferenceId && item.pricingPolicy !== "manual_only" && item.pricingPolicy !== "not_priceable") {
          errors.push(err("MISSING_PRICING_REFERENCE", `Item "${item.presentationId}" has no production pricing reference.`, item.presentationId, cat.categoryId));
        }
        if (seenPresentation.has(item.presentationId)) {
          errors.push(err("DUPLICATE_PRESENTATION_ID", `Presentation id "${item.presentationId}" appears in "${seenPresentation.get(item.presentationId)}" and "${cat.categoryId}".`, item.presentationId, cat.categoryId));
        } else {
          seenPresentation.set(item.presentationId, cat.categoryId);
        }
        if (item.pricingReferenceId) {
          if (seenProduction.has(item.pricingReferenceId)) {
            errors.push(err("DUPLICATE_PRODUCTION_ID", `Production id "${item.pricingReferenceId}" mapped to "${seenProduction.get(item.pricingReferenceId)}" and "${cat.categoryId}".`, item.pricingReferenceId, cat.categoryId));
          } else {
            seenProduction.set(item.pricingReferenceId, cat.categoryId);
          }
        }
      }
    }
  } catch {
    errors.push(err("CATALOG_PROJECTION_FAILED", "Catalog projection failed unexpectedly."));
  }

  return { schemaVersion: "2.2", categories, warnings, errors };
}

function dedupeOptionIds(
  itemId: string,
  category: WizardCatalogCategoryId,
  ids: string[],
  errors: WizardCatalogError[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(err("DUPLICATE_OPTION_ID", `Option id "${id}" duplicated within item "${itemId}".`, itemId, category));
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}
