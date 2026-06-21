// Server-side function — fetches customers for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only customers belonging to the current dealer are returned.

import { createClient }       from "@/lib/supabase/server";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { CustomerDB }         from "./customer-types";

export async function getCustomers(): Promise<CustomerDB[]> {
  const dealer = await getCurrentDealer();

  // No active dealer membership — return empty list safely.
  if (!dealer) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getCustomers] error:", error.message);
    return [];
  }

  return (data as CustomerDB[]) ?? [];
}
