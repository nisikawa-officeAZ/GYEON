// DealerOS — LIFF Link API (GYEON-LINE-SETUP-F2)
// POST /api/line/liff/link
//
// Called from the LIFF page running inside the LINE app on the CUSTOMER's phone.
// That browser has no DealerOS session, so this route must NOT require one.
//
// Receives exactly: { token, id_token }
//
// Security:
//   - `token` is opaque; the dealer, the customer and the expected LINE Login
//     audience are resolved server-side from its SHA-256 hash. No browser-supplied
//     identifier ever selects a row — the old raw-customer parameter is gone.
//   - the LINE ID token is verified against that dealer's LINE Login channel id,
//     as an x-www-form-urlencoded POST body — never in a URL.
//   - the link token is consumed only after LINE accepts the ID token, and the
//     consume + all linking writes are one atomic, winner-gated transaction.
//   - unknown / forged / expired / revoked / replayed tokens return one opaque
//     failure that reveals nothing about dealers or customers.

import { NextRequest, NextResponse } from "next/server";

import { consumeLineLinkToken } from "@/lib/line/consume-line-link-token";

export const dynamic = "force-dynamic";

interface LiffLinkBody {
  token?: unknown;
  id_token?: unknown;
}

export async function POST(req: NextRequest) {
  let body: LiffLinkBody;
  try {
    body = (await req.json()) as LiffLinkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const idToken = typeof body.id_token === "string" ? body.id_token : "";

  if (!token || !idToken) {
    return NextResponse.json({ error: "token と id_token が必要です" }, { status: 400 });
  }

  const result = await consumeLineLinkToken(token, idToken);

  switch (result.kind) {
    case "linked":
      return NextResponse.json({ success: true, display_name: result.displayName });

    case "account-conflict":
      return NextResponse.json(
        { error: "このLINEアカウントは既に別の顧客と連携されています" },
        { status: 409 }
      );

    // Deliberately identical shape for both failures: no probing signal about
    // whether the link token or the LINE identity was the problem.
    case "line-verification-failed":
    case "invalid-token":
      return NextResponse.json({ error: "連携リンクが無効です" }, { status: 401 });

    default:
      return NextResponse.json({ error: "連携に失敗しました" }, { status: 500 });
  }
}
