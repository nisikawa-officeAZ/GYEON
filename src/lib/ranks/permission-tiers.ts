// GYEON Permission Tiers — canonical, GLOBAL three-level eligibility vocabulary.
//
// Pure module (no DB / no "use server"). Safe for client or server import.
//
// FINAL business rule: purchase and install permissions have EXACTLY three
// levels, and this vocabulary is GLOBAL (market-independent):
//
//   all            — every dealer
//   detailer_plus  — professional rank and above
//   certified_only — certified rank only   (Global Certified restriction)
//
// The mapping from a tier to the rank threshold it requires is taken from the
// ACTIVE MARKET PROFILE (see ./market-profiles), so a market may rename or add
// ranks without changing these tiers — Japan's rank names are never hardcoded
// here. Two SEPARATE product-master fields both use this vocabulary:
//   minimum_purchase_rank  — who may BUY a product SKU
//   minimum_install_rank   — who may INSTALL / quote a coating service

import { getActiveProfile, type PermissionTier } from "./market-profiles";
import { rankLevel } from "./dealer-ranks";

export type { PermissionTier };

export const PERMISSION_TIERS: PermissionTier[] = ["all", "detailer_plus", "certified_only"];
export const DEFAULT_PERMISSION_TIER: PermissionTier = "all";

export function isValidTier(v: string | null | undefined): v is PermissionTier {
  return !!v && (PERMISSION_TIERS as string[]).includes(v);
}

/** Map any stored/legacy value onto a canonical tier (unknown -> 'all'). */
export function normalizeTier(
  raw: string | null | undefined,
  fallback: PermissionTier = DEFAULT_PERMISSION_TIER,
): PermissionTier {
  return isValidTier(raw) ? raw : fallback;
}

/** Minimum rank LEVEL a tier requires, per the active market profile. */
export function tierRequiredLevel(tier: string | null | undefined): number {
  return getActiveProfile().tierFloorLevel[normalizeTier(tier)];
}

/** The active market's rank value at a tier's floor (for display / config). */
export function tierRequiredRank(tier: string | null | undefined): string {
  const profile = getActiveProfile();
  const lvl = tierRequiredLevel(tier);
  const exact = profile.ranks.find((r) => r.level === lvl);
  const atLeast = profile.ranks.filter((r) => r.level >= lvl).sort((a, b) => a.level - b.level)[0];
  return (exact ?? atLeast ?? profile.ranks[profile.ranks.length - 1]).value;
}

/** Does a dealer of `dealerRank` satisfy the permission `tier`? */
export function meetsTier(dealerRank: string | null | undefined, tier: string | null | undefined): boolean {
  return rankLevel(dealerRank) >= tierRequiredLevel(tier);
}

// ── Labels (derived from the active profile's rank names; not JP-hardcoded) ────
function floorRankLabel(tier: PermissionTier, lang: "ja" | "en"): string {
  const profile = getActiveProfile();
  const lvl = profile.tierFloorLevel[tier];
  const rank =
    profile.ranks.find((r) => r.level === lvl) ?? profile.ranks[profile.ranks.length - 1];
  return lang === "ja" ? rank.labelJa : rank.labelEn;
}

export function tierLabelJa(tier: string | null | undefined): string {
  const t = normalizeTier(tier);
  if (t === "all") return "全ランク";
  if (t === "detailer_plus") return `${floorRankLabel("detailer_plus", "ja")}以上`;
  return `${floorRankLabel("certified_only", "ja")}限定`;
}

export function tierLabelEn(tier: string | null | undefined): string {
  const t = normalizeTier(tier);
  if (t === "all") return "All ranks";
  if (t === "detailer_plus") return `${floorRankLabel("detailer_plus", "en")} or higher`;
  return `${floorRankLabel("certified_only", "en")} only`;
}
