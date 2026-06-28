// TEMPORARY read-only auth diagnostic — keep until login is confirmed, then remove.
// Returns info about ONLY the current session user (no tokens, no secrets, no
// other users). Used as evidence to determine, on a SPECIFIC preview:
//   - whether the session cookie reaches the server (transport)
//   - what auth.uid()/email the server resolves
//   - whether the admin_users row is found under RLS, and is super_admin/active

import { NextResponse }   from "next/server";
import { cookies }        from "next/headers";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient }   from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Transport: which cookies did the SERVER actually receive? (names only)
  const cookieStore   = await cookies();
  const receivedNames = cookieStore.getAll().map((c) => c.name);
  const supabaseAuthCookieNames = receivedNames.filter(
    (n) => n.startsWith("sb-") && n.includes("auth-token"),
  );
  const transport = {
    receivedCookieNames:     receivedNames,
    supabaseAuthCookieSeen:  supabaseAuthCookieNames.length > 0,
    supabaseAuthCookieNames,
  };

  const context = {
    requestUrl: request.url,
    referer:    request.headers.get("referer"),
  };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      authUid:       null,
      serverAuthEmail: null,
      transport,
      context,
    });
  }

  const supabase = await createClient();

  // Same session client + RLS as getCurrentAdmin(); no status filter so we can
  // see the row's actual role/status for evidence.
  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("user_id, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: dealerRow } = await supabase
    .from("dealer_members")
    .select("dealer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const adminFound   = !!adminRow;
  const isSuperAdmin = adminRow?.role === "super_admin";
  const loginReady   = adminFound && isSuperAdmin && adminRow?.status === "active";

  return NextResponse.json({
    authenticated:          true,
    authUid:                user.id,            // = auth.uid() the server resolves
    serverAuthEmail:        user.email ?? null,
    adminUsersRowFound:     adminFound,
    isSuperAdmin,
    adminRole:              adminRow?.role   ?? null,
    adminStatus:            adminRow?.status ?? null,
    adminQueryError:        adminErr?.message ?? null,
    loginReady,
    dealerMembersRowFound:  !!dealerRow,
    transport,
    context,
  });
}
