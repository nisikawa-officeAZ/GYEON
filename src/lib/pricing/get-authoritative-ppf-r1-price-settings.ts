import "server-only";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import { parsePpfR1PriceSettings, type PpfR1PriceSettings } from "./ppf-r1-price-contract";

export type AuthoritativePpfR1ReadResult =
  | { status: "READY"; settings: PpfR1PriceSettings }
  | { status: "NOT_CONFIGURED" }
  | { status: "MALFORMED" }
  | { status: "UNAUTHENTICATED" }
  | { status: "READ_FAILED" };

/** Authenticated, RLS-scoped read of the PPF R1 price payload for the current dealer only. */
export async function getAuthoritativePpfR1PriceSettings(): Promise<AuthoritativePpfR1ReadResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { status: "UNAUTHENTICATED" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("ppf_price_tables")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error) return { status: "READ_FAILED" };
    if (!data || data.ppf_price_tables === null || data.ppf_price_tables === undefined) {
      return { status: "NOT_CONFIGURED" };
    }

    try {
      return { status: "READY", settings: parsePpfR1PriceSettings(data.ppf_price_tables) };
    } catch {
      return { status: "MALFORMED" };
    }
  } catch {
    return { status: "READ_FAILED" };
  }
}
