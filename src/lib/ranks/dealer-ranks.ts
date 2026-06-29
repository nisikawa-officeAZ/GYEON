// GYEON Official Dealer Ranks — single source of truth.
//
// Pure module (no DB / no "use server"). Safe for client or server import.
//
// The three official ranks are STRICTLY ORDINAL and NESTED:
//   shop (1)  <  detailer (2)  <  certified_detailer (3)
// Every rank gate in the app is expressed as `rankAtLeast(dealerRank, required)`,
// so adding a future rank = append one entry here + widen the DB CHECK
// constraints. No call-site logic changes.
//
// This module is intentionally LEGACY-TOLERANT: `normalizeRank()` maps the old
// two-rank conventions ('certified', and a null/blank dealers.detailer_rank) onto
// the canonical values, so the app keeps working both BEFORE and AFTER migration
// 091 normalizes the stored data.

export type DealerRank = "shop" | "detailer" | "certified_detailer";

export interface DealerRankMeta {
  value:   DealerRank;
  level:   number;        // ordinal; higher = more privileges (nested supersets)
  labelJa: string;
  labelEn: string;
  emoji:   string;
}

export const DEALER_RANKS: DealerRankMeta[] = [
  { value: "shop",               level: 1, labelJa: "GYEON Shop",               labelEn: "GYEON Shop",               emoji: "🏪" },
  { value: "detailer",           level: 2, labelJa: "GYEON Detailer",           labelEn: "GYEON Detailer",           emoji: "🔵" },
  { value: "certified_detailer", level: 3, labelJa: "GYEON Certified Detailer", labelEn: "GYEON Certified Detailer", emoji: "⭐" },
];

/** Locked default for backfill / new dealers (see migration 091). */
export const DEFAULT_DEALER_RANK: DealerRank = "detailer";

export const DEALER_RANK_VALUES: DealerRank[] = DEALER_RANKS.map((r) => r.value);

const BY_VALUE = new Map<DealerRank, DealerRankMeta>(DEALER_RANKS.map((r) => [r.value, r]));

/** True only for the three canonical machine values. */
export function isValidRank(v: string | null | undefined): v is DealerRank {
  return !!v && BY_VALUE.has(v as DealerRank);
}

/**
 * Map any stored/legacy value onto a canonical rank.
 *   'certified' (old dealer_settings convention) -> 'certified_detailer'
 *   null / '' / unknown                          -> DEFAULT_DEALER_RANK
 */
export function normalizeRank(raw: string | null | undefined): DealerRank {
  switch ((raw ?? "").trim()) {
    case "shop":               return "shop";
    case "detailer":           return "detailer";
    case "certified":
    case "certified_detailer": return "certified_detailer";
    default:                   return DEFAULT_DEALER_RANK;
  }
}

export function rankMeta(r: string | null | undefined): DealerRankMeta {
  return BY_VALUE.get(normalizeRank(r))!;
}

export function rankLevel(r: string | null | undefined): number {
  return rankMeta(r).level;
}

/** Does `dealerRank` meet or exceed `required`? Legacy-tolerant on `dealerRank`. */
export function rankAtLeast(dealerRank: string | null | undefined, required: DealerRank): boolean {
  return rankLevel(dealerRank) >= BY_VALUE.get(required)!.level;
}

export function rankLabelJa(r: string | null | undefined): string { return rankMeta(r).labelJa; }
export function rankLabelEn(r: string | null | undefined): string { return rankMeta(r).labelEn; }
export function rankEmoji(r: string | null | undefined): string { return rankMeta(r).emoji; }

/** Display helper that preserves an explicit "unset" state (admin lists). */
export function rankLabelOrDash(raw: string | null | undefined): string {
  return raw && raw.trim() ? rankLabelEn(raw) : "—";
}
