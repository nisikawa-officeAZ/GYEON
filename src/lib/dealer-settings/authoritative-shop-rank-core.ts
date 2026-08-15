// Authoritative shop-rank resolution — PURE CORE (Phase 8-B2F-A).
//
// No React, no server module, no Supabase, no DB, no `server-only`, no clock, no randomness,
// no `any`, no cast. Every dependency arrives through `RankResolverDeps`, so this module is
// exhaustively testable under plain `node:test` without importing anything server-only.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
// The pre-existing read path FAILS OPEN. `getCanonicalDealerSettings()` runs the stored value
// through `toDetailerRank()` → `normalizeRank()`, which returns `DEFAULT_DEALER_RANK` ("detailer")
// for null, unknown, or legacy values (lib/ranks/dealer-ranks.ts:37-43; market-profiles.ts:44) — and
// `buildFallback("")` returns the same defaults when there is no authenticated dealer or the query
// fails. Rank is an AUTHORIZATION input: `shop` may not sell PPF or window film, `ppf_installer` may
// not sell coating. Silently resolving an unknown rank to "detailer" therefore GRANTS services the
// dealer is not authorized to sell.
//
// This module never normalizes, never defaults, and never guesses. Anything that is not a literal,
// canonical, stored rank returns a typed failure that carries no usable rank at all.
//
// ── SOURCE OF TRUTH ─────────────────────────────────────────────────────────────
// `SHOP_RANKS` is the narrow literal union the Wizard screens require. It is NOT a competing
// vocabulary: it is pinned, by test, to BOTH existing definitions —
//   • the runtime/DB vocabulary `DEALER_RANK_VALUES` (lib/ranks/dealer-ranks.ts), which mirrors the
//     `detailer_rank` CHECK constraint (migrations 070 → 091 → 097), and
//   • the Wizard's `ShopRank` union (wizard/screens/step-types.ts:70).
// If any of the three ever drifts, the test suite fails loudly rather than the sets diverging in
// silence. The union is declared HERE rather than imported from `dealer-ranks` because that module's
// `DealerRank` is `string` (market-configurable by design) and cannot narrow; and it is not imported
// from the Wizard's `step-types` because `lib/` must not depend on `components/`.

/** The four canonical ranks. Ordered as in the market profile (level 1 → 4). */
export const SHOP_RANKS = ["shop", "detailer", "ppf_installer", "certified"] as const;

export type ShopRank = (typeof SHOP_RANKS)[number];

/**
 * Why no usable rank could be produced. Each is distinct and none is recoverable into a rank.
 *
 *   "no-dealer"   — no authenticated dealer membership. Nothing to read a rank FOR.
 *   "missing"     — the dealer exists but stores no rank (null / empty).
 *   "invalid"     — a value is stored, but it is not one of the four canonical ranks
 *                   (unknown, legacy, or the wrong type). NEVER coerced onto a default.
 *   "read-failed" — the query itself failed. An error is not an authorization decision.
 */
export type RankResolutionFailure = "no-dealer" | "missing" | "invalid" | "read-failed";

/** Discriminated: `rank` exists ONLY on the success arm, so a failure cannot be read as a rank. */
export type RankResolution =
  | { readonly ok: true;  readonly rank: ShopRank }
  | { readonly ok: false; readonly reason: RankResolutionFailure };

/** Exact, literal membership test. No trimming, no casing, no aliasing. */
export function isShopRank(value: unknown): value is ShopRank {
  return typeof value === "string" && (SHOP_RANKS as readonly string[]).includes(value);
}

/**
 * Parse a raw stored `dealers.detailer_rank` value.
 *
 * The ONLY path to `{ ok: true, rank: "detailer" }` is a stored value that is literally the string
 * `"detailer"`. Not null, not "", not " detailer ", not "Detailer", not a legacy alias, not a
 * failed read. `normalizeRank()` and `DEFAULT_DEALER_RANK` are deliberately not imported.
 */
export function parseStoredRank(raw: unknown): RankResolution {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "missing" };
  }
  if (typeof raw !== "string") {
    // A non-string in an authorization column is a data defect, not an absence.
    return { ok: false, reason: "invalid" };
  }
  if (raw.trim() === "") {
    return { ok: false, reason: "missing" };
  }
  // Matched against the RAW value, never a trimmed one: `" detailer "` is not the literal rank, and
  // quietly accepting it would be exactly the kind of coercion this module exists to refuse.
  if (!isShopRank(raw)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, rank: raw };
}

/** The result of reading the stored rank. Distinguishes "read failed" from "read a null". */
export type StoredRankRead =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

/**
 * Injected dependencies. Note what is NOT here: there is no way to pass in a `dealerId` or a `rank`.
 * The dealer is discovered, never supplied.
 */
export interface RankResolverDeps {
  /** Resolve the authenticated dealer. `null` ⇒ no active membership. */
  readonly getDealerId: () => Promise<string | null>;
  /** Read `dealers.detailer_rank` for exactly that dealer. */
  readonly readStoredRank: (dealerId: string) => Promise<StoredRankRead>;
}

/**
 * Resolve the authoritative rank, fail-closed at every step.
 *
 * A thrown dependency is treated as `"read-failed"` — never as an absent rank and never as a
 * default. There is no branch in this function that produces a rank the database did not store.
 */
export async function resolveAuthoritativeShopRank(
  deps: RankResolverDeps,
): Promise<RankResolution> {
  try {
    const dealerId = await deps.getDealerId();
    if (dealerId === null || dealerId.trim() === "") {
      return { ok: false, reason: "no-dealer" };
    }

    const read = await deps.readStoredRank(dealerId);
    if (!read.ok) {
      return { ok: false, reason: "read-failed" };
    }

    return parseStoredRank(read.value);
  } catch {
    return { ok: false, reason: "read-failed" };
  }
}
