// TEMPORARY read-only auth diagnostic — keep until login is confirmed on THIS
// exact deployment. Returns info about ONLY the current session user (no tokens,
// no secrets, no other users). Evidence for: cookie transport, auth.uid()/email,
// and whether the admin_users row is found/super_admin/active under RLS.

import { NextResponse }   from "next/server";
import { cookies }        from "next/headers";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient }   from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    vercelEnv:  process.env.VERCEL_ENV ?? null,
  };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      authenticated: false, authUid: null, serverAuthEmail: null, transport, context,
    });
  }

  const supabase = await createClient();
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
    authenticated:         true,
    authUid:               user.id,
    serverAuthEmail:       user.email ?? null,
    adminUsersRowFound:    adminFound,
    isSuperAdmin,
    adminRole:             adminRow?.role   ?? null,
    adminStatus:           adminRow?.status ?? null,
    adminQueryError:       adminErr?.message ?? null,
    loginReady,
    dealerMembersRowFound: !!dealerRow,
    transport,
    context,
  });
}
