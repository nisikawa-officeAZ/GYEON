// Phase 3 Sprint 2 — Canonical Service Category model.
//
// Single source of truth for estimate service categories. Pure module (no schema,
// no I/O) — safe to import from both server and client.
//
// Approved categories per 05_Business_Rules.md §5.9, plus the two dedicated categories the Owner
// approved on 2026-09-30 (GYEON_DA_COMPLETION_PLAN §24.1): `wheel` (ホイール) and `glass` (ガラス)
// are independent Screen-3 categories driven by dealer-authored wheel/glass service menus — never
// "Other", never a store-global option. Tire remains INTENTIONALLY NOT included (no approved spec).
//
// GDA-OTHER-COATINGS-R1 (C1): `other_coating` (その他コーティング) is the dedicated Screen-3 category for
// NON-BODY coatings — resin trim, seats, engine room and future dealer-added items. It is distinct from
// body `coating` (catalog-priced layers), from the B5 `wheel` / `glass` menus and from `other` (free
// work). C1 establishes the category + draft contract ONLY: no price calculation, no row selection.
//
// Multi-service: any non-empty SUBSET of these categories may be combined into a
// single estimate (e.g. Coating + PPF, Coating + Window, PPF + Window,
// Maintenance + Car Wash). No combination is special-cased; the estimate
// accumulates line items from each selected category (see EstimateWizard +
// src/lib/pricing/pricing-engine.ts).

export type ServiceCategoryId =
  | "coating" | "ppf" | "window" | "maintenance" | "carwash" | "roomclean"
  | "wheel" | "glass"
  | "other_coating"
  | "other";

export interface ServiceCategory {
  id:    ServiceCategoryId;
  label: string;
  emoji: string;
}

// Order matters — this is the canonical selection/sequence order used by the
// estimate wizard. (coating … carwash are the Sprint-2 approved categories;
// roomclean and other are pre-existing approved categories per 05 §5.9;
// wheel and glass are the B5 dedicated categories, kept ahead of `other`;
// other_coating is the C1 non-body coating category, after wheel/glass and ahead of `other`.)
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: "coating",     label: "ボディコーティング",     emoji: "✨" },
  { id: "ppf",         label: "PPF",                   emoji: "🛡" },
  { id: "window",      label: "ウィンドウフィルム",     emoji: "🪟" },
  { id: "maintenance", label: "ボディ定期メンテナンス", emoji: "🔧" },
  { id: "carwash",     label: "メンテナンス洗車",       emoji: "🚿" },
  { id: "roomclean",   label: "ルームクリーニング",     emoji: "🧹" },
  { id: "wheel",       label: "ホイール",               emoji: "🛞" },
  { id: "glass",       label: "ガラス",                 emoji: "🪞" },
  { id: "other_coating", label: "その他コーティング",     emoji: "🧴" },
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

// ── B2-E2G — Dealer service-offering families ────────────────────────────────
//
// THE single source of truth for the mapping between a managed service family and the wizard
// category it drives. Runtime, Step 4, the production reference container and the settings layer all
// import from here; none of them may restate the pairing. Two copies of one availability rule is
// exactly the defect that produced the window-film incident, where the runtime resolver and the
// Step-4 host disagreed about whether `ppf_installer` could sell film.
//
// A family is DEALER-OWNED and opt-in: rank never decides eligibility for any of these five.
// `coating` and `other` are deliberately absent — they are outside the offering model and keep
// their existing behaviour, coating included with its rank rule.
// `wheel` and `glass` (B5, plan §24.1) are ALSO deliberately absent: they are NOT a sixth/seventh
// opt-in family. A dealer-authored wheel/glass catalogue menu row is their availability authority,
// enforced in Step 4 — never a store offering switch, never a rank rule, never an invented opt-in.
// `other_coating` (C1) is likewise NOT a family: dealer-authored other-coating items are its future
// availability authority (C2+); it is never a store offering switch and never a rank rule.

export const SERVICE_FAMILIES = [
  "window_film",
  "ppf",
  "maintenance",
  "room_cleaning",
  "car_wash",
] as const;

export type ServiceFamily = (typeof SERVICE_FAMILIES)[number];

/** Family → the wizard category id it governs. The ONLY place this pairing is written. */
export const SERVICE_FAMILY_CATEGORY: Readonly<Record<ServiceFamily, ServiceCategoryId>> = {
  window_film: "window",
  ppf:         "ppf",
  maintenance: "maintenance",
  room_cleaning: "roomclean",
  car_wash:    "carwash",
};

/**
 * Operator-facing family names. Deliberately the SAME wording as the wizard category labels above,
 * so the settings switch and the section it controls are recognisably the same thing.
 */
export const SERVICE_FAMILY_LABEL_JA: Readonly<Record<ServiceFamily, string>> = {
  window_film:   "ウィンドウフィルム",
  ppf:           "PPF",
  maintenance:   "ボディ定期メンテナンス",
  car_wash:      "メンテナンス洗車",
  room_cleaning: "ルームクリーニング",
};

/** Which family, if any, governs a category. `null` ⇒ unmanaged (coating / wheel / glass / other_coating / other). */
export function serviceFamilyForCategory(id: string): ServiceFamily | null {
  for (const f of SERVICE_FAMILIES) if (SERVICE_FAMILY_CATEGORY[f] === id) return f;
  return null;
}

export function isServiceFamily(v: unknown): v is ServiceFamily {
  return typeof v === "string" && (SERVICE_FAMILIES as readonly string[]).includes(v);
}

/**
 * A dealer's opt-in state for every managed family. TOTAL by construction: every family is always
 * stated, so an absent key can never be silently read as OFF at a boundary.
 */
export type ServiceOfferings = Readonly<Record<ServiceFamily, boolean>>;

/** The default for a NEW dealer: every managed family OFF. Absence of a stored row means this. */
export const ALL_SERVICE_OFFERINGS_OFF: ServiceOfferings = {
  window_film: false,
  ppf:         false,
  maintenance: false,
  room_cleaning: false,
  car_wash:    false,
};

/** Build a total offerings map from whatever subset of rows the database returned. */
export function buildServiceOfferings(
  rows: readonly { family: string; enabled: boolean }[],
): ServiceOfferings {
  const out: Record<ServiceFamily, boolean> = { ...ALL_SERVICE_OFFERINGS_OFF };
  for (const r of rows) if (isServiceFamily(r.family)) out[r.family] = r.enabled === true;
  return out;
}
