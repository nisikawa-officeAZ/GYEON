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
import { createActivityLog } from "@/lib/activity/activity-log";
import { createAuditLog } from "@/lib/audit/audit";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

// Clamp trade_discount_pct to [0, 100] and round to 2dp
function parseDiscountPct(formData: FormData): number {
  const raw = parseFloat((formData.get("trade_discount_pct") as string | null) ?? "0");
  if (isNaN(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const lastName = str(formData, "last_name");
  if (!lastName) return { error: "姓（last name）is required." };

  const firstName   = str(formData, "first_name");
  const isBusiness  = formData.get("is_business") === "true";
  const discountPct = isBusiness ? parseDiscountPct(formData) : 0;
  const creditTerms = isBusiness ? str(formData, "credit_terms") : null;

  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      customer_code:      str(formData, "customer_code"),
      last_name:          lastName,
      first_name:         str(formData, "first_name"),
      last_name_kana:     str(formData, "last_name_kana"),
      first_name_kana:    str(formData, "first_name_kana"),
      phone:              str(formData, "phone"),
      email:              str(formData, "email"),
      postal_code:        str(formData, "postal_code"),
      prefecture:         str(formData, "prefecture"),
      city:               str(formData, "city"),
      address1:           str(formData, "address1"),
      address2:           str(formData, "address2"),
      birthday:           str(formData, "birthday") || null,
      gender:             str(formData, "gender"),
      occupation:         str(formData, "occupation"),
      notes:              str(formData, "notes"),
      line_user_id:       str(formData, "line_user_id"),
      is_business:        isBusiness,
      trade_discount_pct: discountPct,
      credit_terms:       creditTerms,
      updated_at:         new Date().toISOString(),
    })
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateCustomer] error:", error.message);
    return { error: error.message };
  }

  void createActivityLog({
    entity_type: "customer",
    entity_id:   customerId,
    customer_id: customerId,
    action:      "updated",
    title:       `顧客を更新: ${lastName}${firstName ? ` ${firstName}` : ""}`.trim(),
  });

  void createAuditLog({
    action: "update",
    resource_type: "customer",
    resource_id: customerId,
  });

  revalidatePath("/customers");
  return { success: true };
}
