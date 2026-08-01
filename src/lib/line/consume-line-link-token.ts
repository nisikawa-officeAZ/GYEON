// GYEON-LINE-SETUP-F2 — LIFF link-token core + consume path.
//
// SERVER ONLY. This module is the entire trust boundary for LIFF linking:
//   * the browser supplies only { token, id_token };
//   * dealer_id, customer_id and the expected audience come from the token row;
//   * the LINE ID token is verified against THAT dealer's LINE Login channel id;
//   * only after LINE accepts the ID token is the link token consumed, so a bad
//     or forged id_token can never burn an otherwise valid link.
//
// The pure helpers below also serve the minting action (create-line-link-token),
// which is a "use server" module and therefore may export async functions only.
// Imports here stay relative so this module is unit-testable under node:test.

import { randomBytes, createHash } from "node:crypto";

import { createAdminClient } from "../supabase/admin";

export const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/** Entropy of the opaque token: 32 bytes = 256 bits (contract minimum is 128). */
export const LINE_LINK_TOKEN_BYTES = 32;

/** How long a minted link stays usable. Short — it is handed over in person. */
export const LINE_LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Result of minting a link token. Declared here rather than in the minting
 * module because that module carries the "use server" directive, whose exports
 * must all be async functions.
 */
export type CreateLineLinkTokenResult =
  | { readonly kind: "created"; readonly liffUrl: string }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "customer-not-found" }
  | { readonly kind: "liff-not-configured" }
  | { readonly kind: "failed" };

export type ConsumeLineLinkResult =
  | { readonly kind: "linked"; readonly displayName: string }
  | { readonly kind: "invalid-token" }
  | { readonly kind: "line-verification-failed" }
  | { readonly kind: "account-conflict" }
  | { readonly kind: "failed" };

interface LineVerifyPayload {
  sub?: string;
  aud?: string;
  name?: string;
  picture?: string;
}

export function generateLineLinkToken(): string {
  return randomBytes(LINE_LINK_TOKEN_BYTES).toString("base64url");
}

/** Only this hash is ever persisted; the raw token exists in the URL alone. */
export function hashLineLinkToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * A LIFF ID is `{LINE Login channel id}-{suffix}`. The numeric prefix is the
 * audience the LINE ID token must carry — NOT the Messaging API channel id.
 * Anything that does not match this exact shape is a configuration error rather
 * than a value to guess at.
 */
export function extractLoginChannelId(liffId: string | null | undefined): string | null {
  if (!liffId) return null;
  const match = /^([0-9]{6,})-[0-9a-zA-Z]+$/.exec(liffId.trim());
  return match ? match[1] : null;
}

/**
 * The customer-facing URL. It carries the opaque token and nothing else.
 *
 * Shape: https://liff.line.me/{liffId}/{liffId}?t={token}
 *
 * The FIRST segment selects the LIFF app. The SECOND is "additional LIFF URL
 * path information": LINE appends it to the app's configured Endpoint URL. With
 * the endpoint registered once as https://{host}/liff/link, the secondary
 * redirect deterministically lands on /liff/link/{liffId} — the page that knows
 * its own LIFF ID before liff.init(). Without that extra segment the redirect
 * would land on the retired /liff/link page, which handles nothing.
 */
export function buildLiffLinkUrl(liffId: string, rawToken: string): string {
  return `https://liff.line.me/${liffId}/${liffId}?t=${encodeURIComponent(rawToken)}`;
}

/**
 * POST to LINE's verification endpoint with the ID token in the BODY.
 * Never as a query string: URLs land in proxy logs and browser history.
 */
export async function verifyLineIdToken(
  idToken: string,
  expectedAudience: string
): Promise<LineVerifyPayload | null> {
  const body = new URLSearchParams({ id_token: idToken, client_id: expectedAudience });

  const res = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const payload = (await res.json().catch(() => null)) as LineVerifyPayload | null;
  if (!payload?.sub) return null;

  // The audience must be present AND exactly the channel we asked about. A
  // missing `aud` is treated as failure, not as permission: we never infer an
  // audience we did not see. (LINE also rejects a mismatched client_id upstream;
  // this is the independent check.)
  if (payload.aud !== expectedAudience) return null;

  return payload;
}

export async function consumeLineLinkToken(
  rawToken: string,
  idToken: string
): Promise<ConsumeLineLinkResult> {
  try {
    if (typeof rawToken !== "string" || rawToken.trim() === "") {
      return { kind: "invalid-token" };
    }
    if (typeof idToken !== "string" || idToken.trim() === "") {
      return { kind: "line-verification-failed" };
    }

    const tokenHash = hashLineLinkToken(rawToken);
    const admin = createAdminClient();

    // Read-only lookup purely to learn which audience to verify against. The
    // token is NOT consumed here — that happens only after LINE accepts the
    // id_token, so an invalid id_token cannot burn a valid link.
    const { data: row } = await admin
      .from("line_link_tokens")
      .select("login_channel_id, used_at, revoked_at, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    // Unknown / used / revoked / expired all collapse to one opaque outcome so
    // nothing leaks about whether a dealer or customer exists.
    if (
      !row ||
      row.used_at !== null ||
      row.revoked_at !== null ||
      new Date(row.expires_at as string).getTime() <= Date.now()
    ) {
      return { kind: "invalid-token" };
    }

    const profile = await verifyLineIdToken(idToken, row.login_channel_id as string);
    if (!profile?.sub) return { kind: "line-verification-failed" };

    const displayName = profile.name?.trim() || "LINE User";

    // Atomic: winner-gated consume + every linking write in one transaction.
    const { data, error } = await admin.rpc("consume_line_link_token", {
      p_token_hash: tokenHash,
      p_line_user_id: profile.sub,
      p_display_name: displayName,
      p_picture_url: profile.picture ?? null,
    });

    if (error) return { kind: "failed" };

    const outcome = (data as { outcome?: string } | null)?.outcome;
    if (outcome === "linked") return { kind: "linked", displayName };
    if (outcome === "account-conflict") return { kind: "account-conflict" };
    return { kind: "invalid-token" };
  } catch {
    return { kind: "failed" };
  }
}
