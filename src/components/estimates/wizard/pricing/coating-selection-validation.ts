// Estimate Wizard Ver2.2 — pure structural validation of a coating layer selection (Phase C2B3B2).
//
// PURE. No pricing, no catalog, no I/O. It re-uses the authoritative coating matrix
// (coating-matrix.ts) as the single source of allowed layer relationships and adds the rank axis
// the matrix does not encode (certified-only upper-layer products). It never broadens the matrix.
//
// Used by both Wizard pricing adapters BEFORE any multi-layer price is produced, so an invalid
// selection fails closed and never yields a partial coating price.

import {
  firstLayerOptions,
  secondLayerOptions,
  thirdLayerOptions,
  isCoatingAvailableForRank,
} from "../screens/coating-matrix";
import type { ShopRank } from "../screens/step-types";

/** Canonical upper-layer products that only a certified dealer may add over a base. INFINITE BASE
 *  repeats are implicitly certified (their layer-1 is certified-only), but are listed for clarity. */
const CERTIFIED_ONLY_UPPER = new Set<string>([
  "cancoat-pro-evo",
  "infinite-base-1",
  "infinite-base-2",
  "infinite-topcoat-1",
  "infinite-topcoat-2",
]);

export type CoatingSelectionValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validate a coating layer selection against the authoritative matrix + shop rank.
 * Returns a fail-closed result; the caller maps `reason` onto its existing issue mechanism.
 */
export function validateCoatingSelection(
  layer1Id: string | null,
  layer2Id: string | null,
  layer3Id: string | null,
  rank: ShopRank,
): CoatingSelectionValidation {
  if (!layer1Id) return { ok: false, reason: "コーティング製品が選択されていません。" };
  if (!isCoatingAvailableForRank(rank)) {
    return { ok: false, reason: `このランク（${rank}）はコーティングを見積できません。` };
  }
  if (!firstLayerOptions(rank).some((o) => o.id === layer1Id)) {
    return { ok: false, reason: `製品「${layer1Id}」はこのランクでは選択できません。` };
  }

  // layer-3 requires layer-2.
  if (layer3Id && !layer2Id) {
    return { ok: false, reason: "3層目は2層目の選択が必要です。" };
  }

  if (layer2Id) {
    if (!secondLayerOptions(layer1Id, rank).some((o) => o.id === layer2Id)) {
      return { ok: false, reason: `2層目「${layer2Id}」は「${layer1Id}」の上に施工できません。` };
    }
    if (CERTIFIED_ONLY_UPPER.has(layer2Id) && rank !== "certified") {
      return { ok: false, reason: `2層目「${layer2Id}」は認定店限定です。` };
    }
  }

  if (layer3Id) {
    if (!thirdLayerOptions(layer1Id).some((o) => o.id === layer3Id)) {
      return { ok: false, reason: `3層目「${layer3Id}」は「${layer1Id}」の上に施工できません。` };
    }
    if (CERTIFIED_ONLY_UPPER.has(layer3Id) && rank !== "certified") {
      return { ok: false, reason: `3層目「${layer3Id}」は認定店限定です。` };
    }
  }

  return { ok: true };
}
