"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function createPendingDealer(params: {
  businessName: string;
  ownerUserId:  string;
  email:        string;
}): Promise<{ success: true; dealerId: string } | { success: false; error: string }> {
  const supabase = createAdminClient();

  // Idempotency guard — never create a second dealer for an email that already
  // has one. Returning/suspended users must be restored by Super Admin, not
  // re-registered. The signup form pre-checks via checkEmailAccountState(); this
  // is the server-side backstop against races and direct calls.
  const { data: existing } = await supabase
    .from("dealers")
    .select("id")
    .ilike("email", params.email.trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: false, error: "account_exists" };
  }

  const { data, error } = await supabase
    .from("dealers")
    .insert({
      name:                params.businessName,
      owner_user_id:       params.ownerUserId,
      email:               params.email,
      approval_status:     "pending",
      subscription_status: "pending",
      plan:                "basic",
      status:              "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createPendingDealer] insert error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, dealerId: data.id };
}
