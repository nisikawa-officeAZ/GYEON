// GYEON Permission Tiers — canonical three-level eligibility vocabulary.
//
// Pure module (no DB / no "use server"). Safe for client or server import.
//
// FINAL business rule: purchase and install permissions have EXACTLY three
// levels, decoupled from the rank list so ranks can grow without changing these:
//
//   all            — every dealer (shop and above)
//   detailer_plus  — GYEON Detailer and above
//   certified_only — GYEON Certified Detailer only
//
// Two SEPARATE product-master fields both use this vocabulary:
//   minimum_purchase_rank  — who may BUY a product SKU
//   minimum_install_rank   — who may INSTALL / quote a coating service
//
// The dealer's rank alone never decides eligibility — the product master's tier
// does. This module only maps a tier to the rank threshold it requires.

import type { DealerRank } from "./dealer-ranks";
import { rankAtLeast } from "./dealer-ranks";

export type PermissionTier = "all" | "detailer_plus" | "certified_only";

export const PERMISSION_TIERS: PermissionTier[] = ["all", "detailer_plus", "certified_only"];

export const PERMISSION_TIER_LABEL_JA: Record<PermissionTier, string> = {
  all:            "全ランク",
  detailer_plus:  "GYEON Detailer以上",
  certified_only: "GYEON Certified Detailer限定",
};

export const PERMISSION_TIER_LABEL_EN: Record<PermissionTier, string> = {
  all:            "All ranks",
  detailer_plus:  "GYEON Detailer or higher",
  certified_only: "GYEON Certified Detailer only",
};

/** The minimum dealer rank each tier requires. */
const TIER_REQUIRED_RANK: Record<PermissionTier, DealerRank> = {
  all:            "shop",
  detailer_plus:  "detailer",
  certified_only: "certified_detailer",
};

export const DEFAULT_PERMISSION_TIER: PermissionTier = "all";

export function isValidTier(v: string | null | undefined): v is PermissionTier {
  return !!v && PERMISSION_TIERS.includes(v as PermissionTier);
}

/** Map any stored/legacy value onto a canonical tier (unknown -> 'all'). */
export function normalizeTier(
  raw: string | null | undefined,
  fallback: PermissionTier = DEFAULT_PERMISSION_TIER,
): PermissionTier {
  return isValidTier(raw) ? raw : fallback;
}

/** The rank threshold a tier maps to. */
export function tierRequiredRank(tier: string | null | undefined): DealerRank {
  return TIER_REQUIRED_RANK[normalizeTier(tier)];
}

/** Does a dealer of `dealerRank` satisfy the permission `tier`? */
export function meetsTier(dealerRank: string | null | undefined, tier: string | null | undefined): boolean {
  return rankAtLeast(dealerRank, tierRequiredRank(tier));
}

export function tierLabelJa(tier: string | null | undefined): string {
  return PERMISSION_TIER_LABEL_JA[normalizeTier(tier)];
}
export function tierLabelEn(tier: string | null | undefined): string {
  return PERMISSION_TIER_LABEL_EN[normalizeTier(tier)];
}
