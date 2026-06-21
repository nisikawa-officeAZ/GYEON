// DealerOS — LINE Webhook Handler (PHASE46)
// POST /api/line/webhook
//
// Security:
//   - Signature verified with HMAC-SHA256 using channel_secret (server-only)
//   - Service role client used for DB access (no auth context in webhook)
//   - dealer is identified via LINE destination ID matched to dealer_settings
//
// Supported events:
//   follow   → fetch profile, upsert line_customers, update customer.line_connected
//   unfollow → mark is_friend = false
//   message  → update last_message_at
//   postback → handled (extensible)

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { LineWebhookBody, LineFollowEvent, LineUnfollowEvent, LineMessageEvent } from "@/lib/line/line-types";

const LINE_API_BASE = "https://api.line.me/v2/bot";

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(body: string, secret: string, signature: string): boolean {
  const expected = crypto
    .createHmac("SHA256", secret)
    .update(body)
    .digest("base64");
  return expected === signature;
}

// ─── Service client (bypasses RLS for webhook context) ───────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── LINE Profile fetch ───────────────────────────────────────────────────────

async function fetchProfile(lineUserId: string, accessToken: string) {
  const res = await fetch(`${LINE_API_BASE}/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    userId: string; displayName: string; pictureUrl?: string; statusMessage?: string;
  }>;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleFollow(
  event: LineFollowEvent,
  dealerId: string,
  accessToken: string
) {
  const supabase = getServiceClient();
  const lineUserId = event.source.userId;

  const profile = await fetchProfile(lineUserId, accessToken);
  if (!profile) return;

  const now = new Date().toISOString();

  // Upsert line_customers
  const { data: existing } = await supabase
    .from("line_customers")
    .select("id, customer_id")
    .eq("dealer_id", dealerId)
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("line_customers")
      .update({
        display_name:   profile.displayName,
        picture_url:    profile.pictureUrl   ?? null,
        status_message: profile.statusMessage ?? null,
        is_friend:      true,
        updated_at:     now,
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("line_customers")
      .insert({
        dealer_id:      dealerId,
        customer_id:    null,
        line_user_id:   lineUserId,
        display_name:   profile.displayName,
        picture_url:    profile.pictureUrl   ?? null,
        status_message: profile.statusMessage ?? null,
        is_friend:      true,
        linked_at:      now,
        created_at:     now,
        updated_at:     now,
      });
  }

  // If already linked to a customer, update line_connected
  if (existing?.customer_id) {
    await supabase
      .from("customers")
      .update({
        line_connected:    true,
        line_display_name: profile.displayName,
        line_picture_url:  profile.pictureUrl ?? null,
        updated_at:        now,
      })
      .eq("id", existing.customer_id)
      .eq("dealer_id", dealerId);
  }
}

async function handleUnfollow(event: LineUnfollowEvent, dealerId: string) {
  const supabase = getServiceClient();
  const lineUserId = event.source.userId;
  const now = new Date().toISOString();

  const { data: lc } = await supabase
    .from("line_customers")
    .select("id, customer_id")
    .eq("dealer_id", dealerId)
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (!lc) return;

  await supabase
    .from("line_customers")
    .update({ is_friend: false, updated_at: now })
    .eq("id", lc.id);

  if (lc.customer_id) {
    await supabase
      .from("customers")
      .update({ line_connected: false, updated_at: now })
      .eq("id", lc.customer_id)
      .eq("dealer_id", dealerId);
  }
}

async function handleMessage(event: LineMessageEvent, dealerId: string) {
  const supabase = getServiceClient();
  await supabase
    .from("line_customers")
    .update({ last_message_at: new Date().toISOString() })
    .eq("dealer_id", dealerId)
    .eq("line_user_id", event.source.userId);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  // Look up dealer by channel_id from the webhook body destination
  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find dealer_settings by matching destination (channel user ID)
  // LINE sends `destination` = bot's user ID in the webhook body
  const supabase = getServiceClient();
  const { data: settings } = await supabase
    .from("dealer_settings")
    .select("dealer_id, line_channel_secret, line_access_token, line_enabled")
    .eq("line_enabled", true)
    .not("line_channel_secret", "is", null)
    .limit(50);  // Iterate to find matching channel

  if (!settings || settings.length === 0) {
    return NextResponse.json({ status: "no_settings" }, { status: 200 });
  }

  // Verify signature against each dealer's channel secret
  let matched: typeof settings[0] | null = null;
  for (const s of settings) {
    if (s.line_channel_secret && verifySignature(rawBody, s.line_channel_secret, signature)) {
      matched = s;
      break;
    }
  }

  if (!matched) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const dealerId    = matched.dealer_id as string;
  const accessToken = matched.line_access_token as string;

  // Process events
  for (const event of body.events) {
    try {
      if (event.type === "follow") {
        await handleFollow(event as LineFollowEvent, dealerId, accessToken);
      } else if (event.type === "unfollow") {
        await handleUnfollow(event as LineUnfollowEvent, dealerId);
      } else if (event.type === "message") {
        await handleMessage(event as LineMessageEvent, dealerId);
      }
      // postback: extensible in future phase
    } catch (err) {
      console.error(`Webhook event error (${event.type}):`, err);
    }
  }

  return NextResponse.json({ status: "ok" });
}
