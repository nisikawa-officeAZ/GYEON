// TEMPORARY read-only auth diagnostic — REMOVE after debugging. Preview only.
// Returns information about ONLY the currently-authenticated session user
// (no tokens, no secrets, no other users' data). Used to compare the server's
// session user_id/email against the intended Super Admin and to check whether
// getCurrentAdmin()'s lookup finds the admin_users row under RLS.

import { NextResponse }   from "next/server";
import { cookies }        from "next/headers";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient }   from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Transport check: which cookies did the SERVER actually receive? (names only)
  const cookieStore   = await cookies();
  const receivedNames = cookieStore.getAll().map((c) => c.name);
  const supabaseAuthCookies = receivedNames.filter(
    (n) => n.startsWith("sb-") && n.includes("auth-token"),
  );
  const transport = {
    receivedCookieNames:    receivedNames,
    supabaseAuthCookieSeen: supabaseAuthCookies.length > 0,
    supabaseAuthCookieNames: supabaseAuthCookies,
  };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, transport });
  }

  const supabase = await createClient();

  // Same session client + RLS as getCurrentAdmin(); query WITHOUT the status
  // filter so we can see the row's actual role/status for diagnosis.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // Best-effort dealer membership check (subject to dealer_members RLS).
  const { data: dealerRow } = await supabase
    .from("dealer_members")
    .select("dealer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const adminFound  = !!adminRow;
  const loginReady  = adminFound
    && adminRow?.role === "super_admin"
    && adminRow?.status === "active";

  return NextResponse.json({
    authenticated:          true,
    serverAuthUserId:       user.id,
    serverAuthEmail:        user.email ?? null,
    adminUsersRowFound:     adminFound,
    adminRole:              adminRow?.role   ?? null,
    adminStatus:            adminRow?.status ?? null,
    loginReady,
    dealerMembersRowFound:  !!dealerRow,
    transport,
  });
}
