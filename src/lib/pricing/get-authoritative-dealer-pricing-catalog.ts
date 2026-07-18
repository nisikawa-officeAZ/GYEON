import "server-only";

// EW-UI-4A2-1 — Strict authoritative PricingCatalog — SERVER WRAPPER.
//
// The ONLY public entry point. It supplies the two real dependencies — the authenticated dealer and
// the raw stored pricing columns — to the pure core, which owns every decision. Modeled on
// `getAuthoritativeShopRank`.
//
// ── SECURITY PROPERTIES ─────────────────────────────────────────────────────────
//   • Takes NO PARAMETERS. There is no `dealerId` argument, so a caller cannot name the dealer it
//     wants a catalog for. Enforced by the type, not by review.
//   • The dealer is resolved solely through `getCurrentDealer()` (auth.uid() → active membership).
//   • Reads through the NORMAL authenticated `createClient()` under RLS — never a service-role client.
//   • Selects EXACTLY the two required columns (no `select("*")`), scoped by the resolved dealer_id,
//     with `maybeSingle()` so an absent row is represented distinctly (data === null ⇒ core "no-row").
//   • A query error is a FAILED READ — never a reason to fall back to a default catalog.
//   • `getCanonicalDealerSettings` / `getDealerPricingCatalog` / `dealerSettingsToPricingCatalog` are
//     deliberately NOT used: each of those fails open to defaults, which is exactly what this replaces.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  resolveAuthoritativePricingCatalog,
  type PricingCatalogResolution,
  type PricingSettingsReadResult,
} from "./authoritative-pricing-catalog-core";

export {
  type PricingCatalogResolution,
  type PricingCatalogResolutionFailure,
  type PricingSettingsReadResult,
  type PricingCatalogResolverDeps,
} from "./authoritative-pricing-catalog-core";

/**
 * The authoritative PricingCatalog for the CURRENT dealer, or a typed failure carrying no catalog.
 *
 * Takes no arguments — by design. Never returns a default catalog on an operational or malformed-data
 * failure; a catalog is produced only from a successful, authenticated read of an existing row.
 */
export async function getAuthoritativeDealerPricingCatalog(): Promise<PricingCatalogResolution> {
  return resolveAuthoritativePricingCatalog({
    getDealerId: async () => {
      const dealer = await getCurrentDealer();
      return dealer?.dealer_id ?? null;
    },

    readPricingSettings: async (dealerId: string): Promise<PricingSettingsReadResult> => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("dealer_settings")
          .select("service_price_settings, ppf_price_tables")
          .eq("dealer_id", dealerId)
          .maybeSingle();

        // A query error is a FAILED READ — never an absent row and never a default.
        if (error) return { ok: false };

        // No row (RLS-hidden or not created) ⇒ distinct "no-row" in the core. A present row hands the
        // RAW unknown column values to the pure resolver — no coercion happens here.
        return {
          ok: true,
          row: data
            ? {
                service_price_settings: data.service_price_settings,
                ppf_price_tables: data.ppf_price_tables,
              }
            : null,
        };
      } catch {
        return { ok: false };
      }
    },
  });
}
