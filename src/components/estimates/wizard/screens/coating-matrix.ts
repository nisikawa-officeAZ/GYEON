// Estimate Wizard Ver2.2 — coating matrix as PRESENTATION configuration (Phase 4A).
//
// This is availability/label configuration ONLY — it computes NO prices and creates NO
// estimate line items. It expresses the approved Ver2.2 coating layer matrix (which
// products are selectable for layer 1/2/3 given the shop rank and the chosen first-layer
// product). The owner / preview uses these helpers to derive the `availableLayerN`
// product lists passed as props into <CoatingSelector/>, which itself stays purely
// prop-driven. No pricing / business logic.

import type { CoatingProductOption, ShopRank } from "./step-types";

/** Product id → operator-facing label (exact wording, do not translate). Canonical Wizard ids
 *  only (C2B2A): INFINITE TOPCOAT uses infinite-topcoat-1/2; CANCOAT PRO EVO added. */
export const COATING_PRODUCT_LABELS: Record<string, string> = {
  "one-evo":            "Q² ONE EVO",
  "cancoat-evo":        "Q² CANCOAT EVO",
  "pure-evo":           "Q² PURE EVO",
  "mohs-evo":           "Q² MOHS EVO",
  "syncro-evo":         "Q² SYNCRO EVO",
  "matte-evo":          "Q² MATTE EVO",
  "infinite-base-1":    "Q² INFINITE BASE TYPE 1",
  "infinite-base-2":    "Q² INFINITE BASE TYPE 2",
  "infinite-topcoat-1": "Q² INFINITE TOPCOAT TYPE 1",
  "infinite-topcoat-2": "Q² INFINITE TOPCOAT TYPE 2",
  "cancoat-pro-evo":    "Q² CANCOAT PRO EVO",
};

/** First-layer / standalone products available per shop rank (C2B2A ruling). ppf_installer =
 *  coating locked (none). CANCOAT EVO is standalone for shop/detailer/certified; CANCOAT PRO EVO
 *  and INFINITE BASE 1/2 are certified-only. INFINITE TOPCOAT 1/2 are never standalone (absent). */
const FIRST_LAYER_BY_RANK: Record<ShopRank, string[]> = {
  shop:          ["one-evo", "cancoat-evo"],
  detailer:      ["one-evo", "cancoat-evo", "pure-evo", "mohs-evo", "syncro-evo", "matte-evo"],
  certified:     ["one-evo", "cancoat-evo", "pure-evo", "mohs-evo", "syncro-evo", "matte-evo", "infinite-base-1", "infinite-base-2", "cancoat-pro-evo"],
  ppf_installer: [],
};

/** Second-layer options keyed by the chosen first-layer product (approved matrix).
 *  CANCOAT PRO EVO is an allowed upper layer over exactly six bases: ONE/PURE/MOHS/SYNCRO and
 *  INFINITE BASE 1/2 — never over MATTE or CANCOAT EVO. CANCOAT EVO and CANCOAT PRO EVO as the
 *  first/standalone product fabricate NO further layers (no key ⇒ empty options). */
const LAYER2_BY_FIRST: Record<string, string[]> = {
  "one-evo":         ["one-evo", "cancoat-evo", "cancoat-pro-evo"],
  "pure-evo":        ["pure-evo", "cancoat-evo", "cancoat-pro-evo"],
  "mohs-evo":        ["mohs-evo", "cancoat-evo", "cancoat-pro-evo"],
  "matte-evo":       ["matte-evo"], // MATTE-only repeated layer; never CANCOAT EVO / CANCOAT PRO
  "syncro-evo":      ["mohs-evo", "cancoat-pro-evo"], // SYNCRO: MOHS (existing) + CANCOAT PRO (one of the six bases)
  "infinite-base-1": ["infinite-base-1", "infinite-topcoat-1", "infinite-topcoat-2", "cancoat-pro-evo"],
  "infinite-base-2": ["infinite-base-2", "infinite-topcoat-1", "infinite-topcoat-2", "cancoat-pro-evo"],
  // one-evo/pure-evo/mohs-evo layer-1 selecting CANCOAT EVO or CANCOAT PRO EVO at layer-2 is fine;
  // cancoat-evo / cancoat-pro-evo as layer-1 have no key ⇒ standalone, no fabricated layers.
};

/** Third-layer options keyed by the chosen first-layer product (approved matrix). Unchanged upper
 *  relationships; INFINITE TOPCOAT renamed to canonical. CANCOAT PRO EVO is NOT added at layer-3
 *  (upper-layer allowance is the direct layer over the base only — no broadening). */
const LAYER3_BY_FIRST: Record<string, string[]> = {
  "one-evo":         ["cancoat-evo"],
  "pure-evo":        ["cancoat-evo"],
  "mohs-evo":        ["cancoat-evo"],
  "infinite-base-1": ["infinite-topcoat-1", "infinite-topcoat-2"],
  "infinite-base-2": ["infinite-topcoat-1", "infinite-topcoat-2"],
  // matte-evo / syncro-evo: no approved 3rd layer → layer-3 control disabled
};

function toOptions(ids: string[]): CoatingProductOption[] {
  return ids.map((id) => ({ id, label: COATING_PRODUCT_LABELS[id] ?? id }));
}

/** Whether the given shop rank can perform coating at all (ppf_installer cannot). */
export function isCoatingAvailableForRank(rank: ShopRank): boolean {
  return FIRST_LAYER_BY_RANK[rank].length > 0;
}

export function firstLayerOptions(rank: ShopRank): CoatingProductOption[] {
  return toOptions(FIRST_LAYER_BY_RANK[rank]);
}

/** GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1: `cancoat-pro-evo` is Certified-only even as a
 *  second layer. An omitted rank fails closed (excluded) exactly like every non-Certified rank —
 *  callers must supply the authoritative rank to see it at all. */
export function secondLayerOptions(firstLayerId: string | null, rank?: ShopRank): CoatingProductOption[] {
  if (!firstLayerId) return [];
  const ids = LAYER2_BY_FIRST[firstLayerId] ?? [];
  return toOptions(rank === "certified" ? ids : ids.filter((id) => id !== "cancoat-pro-evo"));
}

export function thirdLayerOptions(firstLayerId: string | null): CoatingProductOption[] {
  return firstLayerId ? toOptions(LAYER3_BY_FIRST[firstLayerId] ?? []) : [];
}
