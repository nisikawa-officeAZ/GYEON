"use server";

// Server Action — creates a new customer.
//
// Security rule:
//   dealer_id is ALWAYS injected server-side from dealer_members.
//   dealer_id is NEVER accepted from client form input.

import { revalidatePath } from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export async function createCustomer(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();

  const { error } = await supabase.from("customers").insert({
    name,
    kana:        (formData.get("kana")        as string | null) || null,
    phone:       (formData.get("phone")       as string | null) || null,
    email:       (formData.get("email")       as string | null) || null,
    postal_code: (formData.get("postal_code") as string | null) || null,
    address:     (formData.get("address")     as string | null) || null,
    line_id:     (formData.get("line_id")     as string | null) || null,
    memo:        (formData.get("memo")        as string | null) || null,
    dealer_id:   dealer.dealer_id,   // server-injected — never from form
  });

  if (error) {
    console.error("[createCustomer] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { success: true };
}
