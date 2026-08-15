// Estimate Wizard Ver2.2 — Catalog projection DEV fixtures (Phase 10C).
//
// DEVELOPMENT-ONLY example presentation metadata for projection verification. This is a FIXTURE,
// not production data, and is NOT wired into any Screen. It deliberately contains ONLY presentation
// metadata (icon / display order / badge / grouping / description) keyed by production catalog id —
// NO prices, NO tax, NO pricing ids of its own. Do not use in a production data path.

import type { WizardPresentationMetadata } from "./wizard-catalog-types";

/** FIXTURE: presentation metadata keyed by production catalog id. Extend freely — missing entries
 *  simply produce MISSING_PRESENTATION_METADATA warnings and fall back to catalog defaults. */
export const FIXTURE_PRESENTATION_METADATA: WizardPresentationMetadata = {
  categoryLabels: {
    coating: "ボディコーティング",
    ppf: "PPF",
    window: "ウィンドウフィルム",
  },
  byId: {
    // Coatings
    "cancoat-evo": { displayOrder: 1, iconKey: "sparkle", groupKey: "entry", badge: null, description: "エントリー" },
    "one-evo":     { displayOrder: 2, iconKey: "sparkle", groupKey: "entry", badge: null, description: "エントリー" },
    "pure-evo":    { displayOrder: 3, iconKey: "sparkle", groupKey: "standard", badge: null, description: "スタンダード" },
    "mohs-evo":    { displayOrder: 4, iconKey: "sparkle", groupKey: "standard", badge: null, description: "スタンダード" },
    "syncro-evo":  { displayOrder: 5, iconKey: "sparkle", groupKey: "premium", badge: "人気", description: "プレミアム" },
    "infinit1":    { displayOrder: 6, iconKey: "shield", groupKey: "certified", badge: "CERTIFIED", description: "CERTIFIED" },
    "infinit2":    { displayOrder: 7, iconKey: "shield", groupKey: "certified", badge: "CERTIFIED", description: "CERTIFIED" },
    // Coating options (store global options)
    "iron":     { displayOrder: 1, iconKey: "wrench", groupKey: "prep" },
    "polish":   { displayOrder: 2, iconKey: "wrench", groupKey: "prep" },
    "headlight":{ displayOrder: 3, iconKey: "wrench", groupKey: "repair" },
    // Car wash
    "cw-hand":  { displayOrder: 1, iconKey: "shower" },
    // PPF plan
    "front-half": { displayOrder: 1, iconKey: "shield", description: "フロントフル" },
    "full-body":  { displayOrder: 2, iconKey: "shield", description: "フルボディ" },
  },
};
