"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function searchUsersAdmin(query: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Supabase Auth Admin: listUsers returns all users (paginated)
  // Filter by email on the client side (Auth API doesn't support full-text search)
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) throw new Error(error.message);

  const users = data?.users ?? [];
  const filtered = query.trim()
    ? users.filter(
        (u) =>
          u.email?.toLowerCase().includes(query.toLowerCase()) ||
          u.id.includes(query)
      )
    : users;

  // Enrich with dealer info
  const userIds = filtered.map((u) => u.id);
  const dealerMap: Record<string, { dealer_name: string | null; dealer_role: string | null }> = {};

  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from("dealer_members")
      .select("user_id, role, dealers(name)")
      .in("user_id", userIds)
      .eq("status", "active");

    if (members) {
      for (const m of members) {
        dealerMap[m.user_id] = {
          dealer_name: (m.dealers as unknown as { name: string | null } | null)?.name ?? null,
          dealer_role: m.role,
        };
      }
    }
  }

  return filtered.slice(0, 100).map((u) => ({
    id:                  u.id,
    email:               u.email ?? null,
    created_at:          u.created_at,
    last_sign_in_at:     u.last_sign_in_at ?? null,
    banned_until:        u.banned_until ?? null,
    email_confirmed_at:  u.email_confirmed_at ?? null,
    dealer_name:         dealerMap[u.id]?.dealer_name ?? null,
    dealer_role:         dealerMap[u.id]?.dealer_role ?? null,
  }));
}
