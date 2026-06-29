// GYEON Dealer Ranks — public rank API, driven by the active market profile.
//
// Pure module (no DB / no "use server"). Safe for client or server import.
//
// Rank NAMES/COUNT/ORDER come from the active MarketProfile (see
// ./market-profiles), so nothing here is hardcoded to Japan for global
// deployments. For the default JP market the ranks are, strictly ordinal/nested:
//   shop (1) < detailer (2) < certified_detailer (3)
//
// Every rank gate is expressed as `rankAtLeast(dealerRank, required)` /
// `rankLevel(...)`, so adding a future rank = edit the profile only.
//
// Legacy-tolerant: `normalizeRank` applies the profile's legacyAliases (e.g. the
// old 'certified' value) and falls back to the profile default, so reads never
// break across the data migration.

import { getActiveProfile, type RankDef } from "./market-profiles";

/** Rank machine value. Configurable per market — kept as `string`, validated at runtime. */
export type DealerRank = string;
export type DealerRankMeta = RankDef;

const PROFILE = getActiveProfile();

export const DEALER_RANKS: RankDef[] = PROFILE.ranks;
export const DEALER_RANK_VALUES: DealerRank[] = DEALER_RANKS.map((r) => r.value);
export const DEFAULT_DEALER_RANK: DealerRank = PROFILE.defaultRank;

const BY_VALUE = new Map<string, RankDef>(DEALER_RANKS.map((r) => [r.value, r]));

/** True only for a canonical machine value in the active market. */
export function isValidRank(v: string | null | undefined): v is DealerRank {
  return !!v && BY_VALUE.has(v);
}

/** Map any stored/legacy value onto a canonical rank (via profile aliases; unknown -> default). */
export function normalizeRank(raw: string | null | undefined): DealerRank {
  const v = (raw ?? "").trim();
  if (BY_VALUE.has(v)) return v;
  const alias = PROFILE.legacyAliases[v];
  if (alias && BY_VALUE.has(alias)) return alias;
  return DEFAULT_DEALER_RANK;
}

export function rankMeta(r: string | null | undefined): RankDef {
  return BY_VALUE.get(normalizeRank(r))!;
}

export function rankLevel(r: string | null | undefined): number {
  return rankMeta(r).level;
}

/** Does `dealerRank` meet or exceed `required`? Legacy-tolerant on both. */
export function rankAtLeast(dealerRank: string | null | undefined, required: string): boolean {
  return rankLevel(dealerRank) >= rankLevel(required);
}

export function rankLabelJa(r: string | null | undefined): string { return rankMeta(r).labelJa; }
export function rankLabelEn(r: string | null | undefined): string { return rankMeta(r).labelEn; }
export function rankEmoji(r: string | null | undefined): string { return rankMeta(r).emoji; }

/** Display helper that preserves an explicit "unset" state (admin lists). */
export function rankLabelOrDash(raw: string | null | undefined): string {
  return raw && raw.trim() ? rankLabelEn(raw) : "—";
}
