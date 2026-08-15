"use server";

// DealerOS — Dealer-scoped pricing catalog provider (Phase E5).
//
// Builds the live PricingCatalog from the dealer's canonical settings, overlaid
// on the defaults. dealer_id is resolved server-side inside
// getCanonicalDealerSettings() (getCurrentDealer) — never from client input.
// Never throws; on any failure it returns DEFAULT_PRICING_CATALOG so estimate
// pricing keeps working with default prices.

import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import {
  type PricingCatalog,
  DEFAULT_PRICING_CATALOG,
  makePricingCatalog,
  dealerSettingsToPricingCatalog,
} from "./pricing-catalog";

export async function getDealerPricingCatalog(): Promise<PricingCatalog> {
  try {
    const s = await getCanonicalDealerSettings();
    return makePricingCatalog(
      dealerSettingsToPricingCatalog(s.service_price_settings, s.ppf_price_tables),
    );
  } catch (err) {
    console.warn("[getDealerPricingCatalog] failed — using defaults:", err);
    return DEFAULT_PRICING_CATALOG;
  }
}
