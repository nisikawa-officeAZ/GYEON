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
    .select(`
      id,
      dealer_id,
      customer_code,
      last_name,
      first_name,
      last_name_kana,
      first_name_kana,
      phone,
      email,
      postal_code,
      prefecture,
      city,
      address1,
      address2,
      birthday,
      gender,
      occupation,
      notes,
      line_user_id,
      line_display_name,
      line_picture_url,
      line_connected,
      deleted_at,
      created_at,
      updated_at
    `)
    .eq("dealer_id", dealer.dealer_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getCustomers] error:", error.message);
    return [];
  }

  return (data as CustomerDB[]) ?? [];
}
