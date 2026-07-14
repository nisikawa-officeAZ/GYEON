import "server-only";

// Authoritative shop-rank resolution — SERVER WRAPPER (Phase 8-B2F-A).
//
// This module is the ONLY public entry point. It supplies the two real dependencies — the
// authenticated dealer and the stored rank — to the pure core, which owns every decision.
//
// ── SECURITY PROPERTIES ─────────────────────────────────────────────────────────
//   • The public function takes NO PARAMETERS. There is no `dealerId` argument and no `rank`
//     argument, so a caller cannot name the dealer it wants a rank for, and cannot assert a rank.
//     This is enforced by the type, not by review.
//   • The dealer is resolved solely through `getCurrentDealer()`, which reads `dealer_members`
//     for `auth.uid()` with `status = 'active'` (auth/get-current-dealer.ts:25). A suspended,
//     invited, or removed member resolves to `null` ⇒ `"no-dealer"`.
//   • The rank is read from `dealers.detailer_rank` — the AUTHORITATIVE column
//     (admin/dealer-lifecycle-actions.ts:57 treats it as such and mirrors it into
//     `dealer_settings`). We read the source, not the mirror.
//   • `getCanonicalDealerSettings()` is deliberately NOT used: it runs the value through
//     `normalizeRank()` and falls back to defaults on missing/unknown/error, which is precisely the
//     fail-open behaviour this module replaces.
//   • `normalizeRank()` and `DEFAULT_DEALER_RANK` are never imported here or in the core.
//
// A read that returns no row is reported as `"read-failed"` rather than `"missing"`: a dealer whose
// `dealers` row cannot be found is not a dealer with an absent rank — it is a failed read, and we
// refuse either way.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  resolveAuthoritativeShopRank,
  type RankResolution,
  type StoredRankRead,
} from "./authoritative-shop-rank-core";

export {
  SHOP_RANKS,
  isShopRank,
  type ShopRank,
  type RankResolution,
  type RankResolutionFailure,
} from "./authoritative-shop-rank-core";

/**
 * The authoritative rank for the CURRENT dealer, or a typed failure carrying no rank.
 *
 * Takes no arguments — by design. Never returns a rank the database did not literally store.
 */
export async function getAuthoritativeShopRank(): Promise<RankResolution> {
  return resolveAuthoritativeShopRank({
    getDealerId: async () => {
      const dealer = await getCurrentDealer();
      return dealer?.dealer_id ?? null;
    },

    readStoredRank: async (dealerId: string): Promise<StoredRankRead> => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("dealers")
          .select("detailer_rank")
          .eq("id", dealerId)
          .single();

        // A query error, or no row at all, is a FAILED READ — never an absent rank, and never a
        // reason to fall back to a default.
        if (error || !data) return { ok: false };

        return { ok: true, value: data.detailer_rank };
      } catch {
        return { ok: false };
      }
    },
  });
}
