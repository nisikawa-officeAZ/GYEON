"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function getCurrentAdmin() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, user_id, email, name, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}
