"use server";

// GYEON-LINE-SETUP-F2 — mint a dealer-scoped LIFF customer-link token.
//
// SERVER ACTION. Every export of a "use server" module must be an async function,
// so the pure token helpers live in ./consume-line-link-token (the shared core).
//
// The raw token is returned to the caller exactly once (inside the LIFF URL) and
// is never persisted: the row stores only its SHA-256 hash.
//
// Authorization chain — nothing here trusts the browser except `customerId`,
// which is then PROVEN to belong to the caller's own dealer:
//   1. getCurrentUser() + getCurrentDealer() → an ACTIVE dealer_members row.
//   2. The customer must belong to that dealer, checked through the caller's
//      RLS-scoped client, so a foreign id simply does not resolve.
//   3. Only after both checks does the service-role client get involved.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  LINE_LINK_TOKEN_TTL_MS,
  buildLiffLinkUrl,
  extractLoginChannelId,
  generateLineLinkToken,
  hashLineLinkToken,
} from "@/lib/line/consume-line-link-token";
import type { CreateLineLinkTokenResult } from "@/lib/line/consume-line-link-token";

export async function createLineLinkToken(
  customerId: string
): Promise<CreateLineLinkTokenResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { kind: "unauthorized" };

    // ACTIVE membership only — getCurrentDealer filters status = 'active'.
    const dealer = await getCurrentDealer();
    if (!dealer) return { kind: "unauthorized" };

    if (typeof customerId !== "string" || customerId.trim() === "") {
      return { kind: "customer-not-found" };
    }

    const supabase = await createClient();

    // Ownership proof, through the caller's own RLS-scoped client.
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (!customer) return { kind: "customer-not-found" };

    const { data: settings } = await supabase
      .from("dealer_settings")
      .select("line_liff_id")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    const liffId = settings?.line_liff_id ?? null;
    const loginChannelId = extractLoginChannelId(liffId);

    // Fail closed: without a well-formed dealer LIFF ID there is no audience to
    // verify against later, so no token is issued at all.
    if (!liffId || !loginChannelId) return { kind: "liff-not-configured" };

    const rawToken = generateLineLinkToken();
    const expiresAt = new Date(Date.now() + LINE_LINK_TOKEN_TTL_MS).toISOString();

    const admin = createAdminClient();
    const { error } = await admin.from("line_link_tokens").insert({
      dealer_id: dealer.dealer_id,
      customer_id: customerId,
      token_hash: hashLineLinkToken(rawToken),
      liff_id: liffId,
      login_channel_id: loginChannelId,
      expires_at: expiresAt,
      created_by: user.id,
    });

    if (error) return { kind: "failed" };

    return { kind: "created", liffUrl: buildLiffLinkUrl(liffId, rawToken) };
  } catch {
    return { kind: "failed" };
  }
}
