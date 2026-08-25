import "server-only";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import {
  resolveStoredCoatingV34,
  type StoredCoatingV34Resolution,
} from "./coating-v34-persisted-payload";

export type AuthoritativeCoatingV34ReadResult =
  | StoredCoatingV34Resolution
  | { status: "UNAUTHENTICATED" }
  | { status: "READ_FAILED" };

/** Authenticated, RLS-scoped read for the current dealer only. */
export async function getAuthoritativeCoatingV34Settings(): Promise<AuthoritativeCoatingV34ReadResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { status: "UNAUTHENTICATED" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("service_price_settings")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error) return { status: "READ_FAILED" };
    if (!data) return { status: "NOT_CONFIGURED" };
    return resolveStoredCoatingV34(data.service_price_settings);
  } catch {
    return { status: "READ_FAILED" };
  }
}
