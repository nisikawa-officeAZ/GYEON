// DealerOS — LIFF Link API (PHASE46)
// POST /api/line/liff/link
//
// Called from the LIFF page (/liff/link) after LINE Login.
// Receives: { id_token, customer_id }
// Verifies id_token with LINE, extracts line_user_id, then links customer.
//
// Security:
//   - id_token verified with LINE token verification endpoint
//   - dealer resolved from session (requires auth cookie)
//   - customer ownership verified against dealer_id

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

interface LiffLinkBody {
  id_token:    string;
  customer_id: string;
}

interface LineIdTokenPayload {
  sub:     string;  // line_user_id
  name:    string;
  picture?: string;
}

export async function POST(req: NextRequest) {
  let body: LiffLinkBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id_token, customer_id } = body;
  if (!id_token || !customer_id) {
    return NextResponse.json({ error: "id_token and customer_id are required" }, { status: 400 });
  }

  // Get dealer from session
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch LIFF client_id from dealer_settings
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("dealer_settings")
    .select("line_liff_id")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!settings?.line_liff_id) {
    return NextResponse.json({ error: "LIFF IDが設定されていません" }, { status: 400 });
  }

  // Verify id_token with LINE
  const verifyParams = new URLSearchParams({
    id_token,
    client_id: settings.line_liff_id.split("-")[0] ?? settings.line_liff_id,
  });

  const verifyRes = await fetch(`${LINE_VERIFY_URL}?${verifyParams}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams,
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    return NextResponse.json({ error: "LINE token verification failed", detail: err }, { status: 401 });
  }

  const payload = await verifyRes.json() as LineIdTokenPayload;
  const lineUserId  = payload.sub;
  const displayName = payload.name ?? "LINE User";
  const pictureUrl  = payload.picture ?? null;

  // Validate customer ownership
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customer_id)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Upsert line_customers
  await supabase
    .from("line_customers")
    .upsert(
      {
        dealer_id:    dealer.dealer_id,
        customer_id,
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url:  pictureUrl,
        is_friend:    true,
        linked_at:    now,
        updated_at:   now,
      },
      { onConflict: "dealer_id,line_user_id" }
    );

  // Update customer
  await supabase
    .from("customers")
    .update({
      line_connected:    true,
      line_user_id:      lineUserId,
      line_display_name: displayName,
      line_picture_url:  pictureUrl,
      updated_at:        now,
    })
    .eq("id", customer_id)
    .eq("dealer_id", dealer.dealer_id);

  return NextResponse.json({ success: true, line_user_id: lineUserId, display_name: displayName });
}
