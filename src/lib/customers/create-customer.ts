"use server";

// Server Action — creates a new customer.
//
// Security rule:
//   dealer_id is ALWAYS injected server-side from dealer_members.
//   dealer_id is NEVER accepted from client form input.

import { revalidatePath } from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createActivityLog } from "@/lib/activity/activity-log";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function createCustomer(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "ディーラー認証に失敗しました" };

  const lastName = str(formData, "last_name");
  if (!lastName) return { error: "姓は必須です" };

  const supabase = await createClient();

  const firstName = str(formData, "first_name");

  const { data: newCustomer, error } = await supabase.from("customers").insert({
    dealer_id:        dealer.dealer_id,   // server-injected — never from form
    customer_code:    str(formData, "customer_code"),
    last_name:        lastName,
    first_name:       firstName,
    last_name_kana:   str(formData, "last_name_kana"),
    first_name_kana:  str(formData, "first_name_kana"),
    phone:            str(formData, "phone"),
    email:            str(formData, "email"),
    postal_code:      str(formData, "postal_code"),
    prefecture:       str(formData, "prefecture"),
    city:             str(formData, "city"),
    address1:         str(formData, "address1"),
    address2:         str(formData, "address2"),
    birthday:         str(formData, "birthday") || null,
    gender:           str(formData, "gender"),
    occupation:       str(formData, "occupation"),
    notes:            str(formData, "notes"),
    line_user_id:     str(formData, "line_user_id"),
  }).select("id, last_name, first_name").single();

  if (error) {
    console.error("[createCustomer] error:", error.message);
    return { error: error.message };
  }

  if (!newCustomer) return { error: "顧客の作成に失敗しました" };

  void createActivityLog({
    entity_type: "customer",
    entity_id:   newCustomer.id,
    customer_id: newCustomer.id,
    action:      "created",
    title:       `顧客を作成: ${newCustomer.last_name}${newCustomer.first_name ? ` ${newCustomer.first_name}` : ""}`.trim(),
  });

  revalidatePath("/customers");
  return { success: true, customerId: newCustomer.id };
}
