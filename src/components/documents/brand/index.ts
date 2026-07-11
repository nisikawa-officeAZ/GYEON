// DealerOS Document Design System — Brand layer.
//
// GYEON dealer-rank logo selection + shared formatting (currency, date, honorific, serial). All
// tenant identity is injected via BrandProfile; nothing here hardcodes a tenant.

import type { GyeonRank, GyeonRankColor, PartyKind } from "../types";

// ── GYEON rank resolution ────────────────────────────────────────────────────
// The store's free-form rank label (Brand Profile `business.shopRank`, e.g. "GYEON Certified
// Detailer") is normalized to one of the four official rank keys. The ACTUAL logo image is injected
// as `brand.rankLogoUrl` (Dealer Settings) — this only resolves which rank the store is and its
// canonical asset path (documentation), never a hardcoded tenant logo.
const RANK_LABEL: Record<GyeonRank, string> = {
  "certified-detailer": "GYEON Certified Detailer",
  detailer: "GYEON Detailer",
  shop: "GYEON Shop",
  "ppf-installer": "GYEON PPF Installer",
};

// navy = default (#1f2945); black = mono/FAX; white = dark background. null = variant not yet shipped
// (v3.0.1) → callers fall back to navy. The live URL is injected via BrandProfile.rankLogoUrl.
const RANK_ASSET: Record<GyeonRank, Record<GyeonRankColor, string | null>> = {
  "certified-detailer": {
    navy: "assets/logos/certified-detailer/navy.svg",
    black: "assets/logos/certified-detailer/black.svg",
    white: "assets/logos/certified-detailer/white.svg",
  },
  detailer: {
    navy: "assets/logos/detailer/navy.svg",
    black: "assets/logos/detailer/black.svg",
    white: "assets/logos/detailer/white.svg",
  },
  shop: { navy: "assets/logos/shop/navy.svg", black: null, white: null },
  "ppf-installer": { navy: "assets/logos/ppf-installer/navy.svg", black: "assets/logos/ppf-installer/black.svg", white: null },
};

export const GYEON_RANK_FALLBACK: GyeonRank = "certified-detailer";

/** Normalize a free-form shop-rank label to a canonical GYEON rank key (fallback: certified-detailer). */
export function resolveGyeonRank(shopRank: string | null | undefined): GyeonRank {
  const s = (shopRank ?? "").toLowerCase();
  if (!s.trim()) return GYEON_RANK_FALLBACK;
  if (s.includes("ppf")) return "ppf-installer";
  if (s.includes("certified")) return "certified-detailer";
  if (s.includes("detailer")) return "detailer";
  if (s.includes("shop")) return "shop";
  return GYEON_RANK_FALLBACK;
}

export function gyeonRankLabel(rank: GyeonRank): string {
  return RANK_LABEL[rank];
}

/**
 * Canonical rank asset path for a color variant (reference/default). Falls back to navy when the
 * requested variant is not shipped. The LIVE URL is injected via BrandProfile.rankLogoUrl.
 */
export function gyeonRankAssetPath(rank: GyeonRank, color: GyeonRankColor = "navy"): string {
  return RANK_ASSET[rank][color] ?? RANK_ASSET[rank].navy ?? RANK_ASSET[GYEON_RANK_FALLBACK].navy!;
}

// ── Currency (¥ prefix + 3-digit comma; negatives use a minus sign) ──────────
export function formatYen(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const neg = amount < 0;
  const body = Math.abs(Math.round(amount)).toLocaleString("en-US");
  return `${neg ? "−" : ""}¥${body}`;
}

// ── Date (YYYY.MM.DD) ────────────────────────────────────────────────────────
export function formatDocDate(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  // Already dotted?
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}.${mo.padStart(2, "0")}.${d.padStart(2, "0")}`;
  }
  return trimmed;
}

/** Date range "YYYY.MM.DD 〜 YYYY.MM.DD" (summary-invoice billing period). */
export function formatDocDateRange(from: string, to: string): string {
  return `${formatDocDate(from)} 〜 ${formatDocDate(to)}`;
}

// ── Honorific (敬称) by party kind ───────────────────────────────────────────
export function honorific(kind: PartyKind): string {
  switch (kind) {
    case "corporation":
      return "御中";
    case "business-contact":
      return "ご担当者様";
    case "individual":
    default:
      return "様";
  }
}

// ── Serial validation (PREFIX/YYYY/NNNNN) ────────────────────────────────────
export const SERIAL_RE = /^[A-Z]+(?:\/[A-Z]+)?\/\d{4}\/\d{5}$/;
export function isValidSerial(serial: string): boolean {
  return SERIAL_RE.test(serial);
}
