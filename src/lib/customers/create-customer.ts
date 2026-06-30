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
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createEngagementEvent } from "@/lib/customer-engagement/context";
import { EngagementWorkflowRuntime } from "@/lib/customer-engagement/engine/runtime";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

// Clamp trade_discount_pct to [0, 100] and round to 2dp
function parseDiscountPct(formData: FormData): number {
  const raw = parseFloat((formData.get("trade_discount_pct") as string | null) ?? "0");
  if (isNaN(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

export async function createCustomer(formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "ディーラー認証に失敗しました" };

  const lastName = str(formData, "last_name");
  if (!lastName) return { error: "姓は必須です" };

  const supabase = await createClient();

  const firstName   = str(formData, "first_name");
  const isBusiness  = formData.get("is_business") === "true";
  const discountPct = isBusiness ? parseDiscountPct(formData) : 0;
  const creditTerms = isBusiness ? str(formData, "credit_terms") : null;

  const { data: newCustomer, error } = await supabase.from("customers").insert({
    dealer_id:          dealer.dealer_id,   // server-injected — never from form
    customer_code:      str(formData, "customer_code"),
    last_name:          lastName,
    first_name:         firstName,
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

  // Phase 4 Sprint 5 — emit CUSTOMER_CREATED for the welcome engagement flow.
  // dealer_id is resolved server-side inside createEngagementEvent; runtime never throws.
  const event = await createEngagementEvent("CUSTOMER_CREATED", newCustomer.id, {
    customer_name: `${newCustomer.last_name}${newCustomer.first_name ? ` ${newCustomer.first_name}` : ""}`.trim(),
    has_line:      !!str(formData, "line_user_id"),
  });
  if (event) {
    await new EngagementWorkflowRuntime().dispatch(event);
  }

  revalidatePath("/customers");
  return { success: true, customerId: newCustomer.id };
}
