// Server-side function — fetches a single customer for the current dealer.
//
// Architecture rule:
//   dealer_id comes from dealer_members, NOT from auth.uid().
//   Only a customer belonging to the current dealer (and not soft-deleted) is
//   returned; otherwise null.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { CustomerDB }       from "./customer-types";

export async function getCustomerById(id: string): Promise<CustomerDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id",        id)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return data as CustomerDB;
}
