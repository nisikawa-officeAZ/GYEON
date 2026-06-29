// GYEON Market Profiles — per-market (region) dealer-rank configuration.
//
// Pure module (no DB / no "use server"). Safe for client or server import.
//
// PURPOSE: dealer-rank NAMES, COUNT, ORDERING, the default rank, legacy value
// aliases, and the tier->rank mapping are all CONFIGURABLE per market. Japan's
// ranks are therefore a PROFILE, never hardcoded for global deployments. The
// active market is selected by env (NEXT_PUBLIC_DEALEROS_MARKET / DEALEROS_MARKET),
// defaulting to "JP".
//
// The permission-tier vocabulary (all | detailer_plus | certified_only) is
// GLOBAL and stable. Each profile only declares the LEVEL floor each tier maps
// to, so "Global Certified restrictions" are supported in every market — even if
// a market renames or adds ranks.

export type PermissionTier = "all" | "detailer_plus" | "certified_only";

export interface RankDef {
  value:    string;   // machine value stored in DB (per market)
  level:    number;   // ordinal; higher = more privileges (nested supersets)
  labelJa:  string;
  labelEn:  string;
  emoji:    string;
  certified?: boolean; // marks this market's "certified" anchor rank
}

export interface MarketProfile {
  market:         string;
  ranks:          RankDef[];
  defaultRank:    string;
  legacyAliases:  Record<string, string>;          // old stored value -> canonical value
  tierFloorLevel: Record<PermissionTier, number>;  // tier -> minimum rank level
}

// ── Japan (default profile) ───────────────────────────────────────────────────
export const JP_PROFILE: MarketProfile = {
  market: "JP",
  ranks: [
    { value: "shop",               level: 1, labelJa: "GYEON Shop",               labelEn: "GYEON Shop",               emoji: "🏪" },
    { value: "detailer",           level: 2, labelJa: "GYEON Detailer",           labelEn: "GYEON Detailer",           emoji: "🔵" },
    { value: "certified_detailer", level: 3, labelJa: "GYEON Certified Detailer", labelEn: "GYEON Certified Detailer", emoji: "⭐", certified: true },
  ],
  defaultRank:    "detailer",
  legacyAliases:  { certified: "certified_detailer" }, // pre-PHASE91 dealer_settings value
  tierFloorLevel: { all: 1, detailer_plus: 2, certified_only: 3 },
};

/**
 * Registry of market profiles. Add a market here (or load from config/DB later)
 * without touching any rank/permission call site. Japan is the default; other
 * markets define their own rank names and tier floors.
 */
export const MARKET_PROFILES: Record<string, MarketProfile> = {
  JP: JP_PROFILE,
};

export function getActiveMarket(): string {
  const raw =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_DEALEROS_MARKET || process.env.DEALEROS_MARKET)) || "JP";
  return String(raw).toUpperCase();
}

/** The active market's profile (falls back to Japan). */
export function getActiveProfile(): MarketProfile {
  return MARKET_PROFILES[getActiveMarket()] ?? JP_PROFILE;
}
