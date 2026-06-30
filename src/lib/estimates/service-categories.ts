// Phase 3 Sprint 2 — Canonical Service Category model.
//
// Single source of truth for estimate service categories. Pure module (no schema,
// no I/O) — safe to import from both server and client.
//
// Approved categories per 05_Business_Rules.md §5.9. Wheel and Tire are
// INTENTIONALLY NOT included here — they are out of scope and require a separate
// approved specification before being added.
//
// Multi-service: any non-empty SUBSET of these categories may be combined into a
// single estimate (e.g. Coating + PPF, Coating + Window, PPF + Window,
// Maintenance + Car Wash). No combination is special-cased; the estimate
// accumulates line items from each selected category (see EstimateWizard +
// src/lib/pricing/pricing-engine.ts).

export type ServiceCategoryId =
  | "coating" | "ppf" | "window" | "maintenance" | "carwash" | "roomclean" | "other";

export interface ServiceCategory {
  id:    ServiceCategoryId;
  label: string;
  emoji: string;
}

// Order matters — this is the canonical selection/sequence order used by the
// estimate wizard. (coating … carwash are the Sprint-2 approved categories;
// roomclean and other are pre-existing approved categories per 05 §5.9.)
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: "coating",     label: "ボディコーティング",     emoji: "✨" },
  { id: "ppf",         label: "PPF",                   emoji: "🛡" },
  { id: "window",      label: "ウィンドウフィルム",     emoji: "🪟" },
  { id: "maintenance", label: "ボディ定期メンテナンス", emoji: "🔧" },
  { id: "carwash",     label: "メンテナンス洗車",       emoji: "🚿" },
  { id: "roomclean",   label: "ルームクリーニング",     emoji: "🧹" },
  { id: "other",       label: "その他作業",             emoji: "📋" },
];

export const SERVICE_CATEGORY_IDS: ServiceCategoryId[] = SERVICE_CATEGORIES.map((c) => c.id);

export function getServiceCategory(id: string): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((c) => c.id === id);
}

export function serviceCategoryLabel(id: string): string {
  return getServiceCategory(id)?.label ?? id;
}

export function isServiceCategoryId(id: string): id is ServiceCategoryId {
  return SERVICE_CATEGORY_IDS.includes(id as ServiceCategoryId);
}
