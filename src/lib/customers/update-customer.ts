"use server";

// Server Action — updates an existing customer.
//
// Security rule:
//   Update is scoped by BOTH id AND dealer_id from dealer_members.
//   A user cannot update a customer belonging to another dealer.
//   dealer_id is NEVER changeable via this action.

import { revalidatePath } from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export async function updateCustomer(customerId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name,
      kana:        (formData.get("kana")        as string | null) || null,
      phone:       (formData.get("phone")       as string | null) || null,
      email:       (formData.get("email")       as string | null) || null,
      postal_code: (formData.get("postal_code") as string | null) || null,
      address:     (formData.get("address")     as string | null) || null,
      line_id:     (formData.get("line_id")     as string | null) || null,
      memo:        (formData.get("memo")        as string | null) || null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateCustomer] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { success: true };
}
