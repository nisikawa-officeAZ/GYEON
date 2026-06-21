"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getDealersAdmin() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dealers")
    .select("id, name, email, phone, plan, subscription_status, started_at, expired_at, created_at, owner_user_id")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
