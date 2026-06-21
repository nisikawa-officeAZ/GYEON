"use server";

// SERVER ONLY — Uses LINE access token from dealer_settings.
// Never expose access_token to client.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { LineMessage } from "./line-types";

const LINE_API_BASE = "https://api.line.me/v2/bot";

// ─── Fetch LINE profile (server-side) ────────────────────────────────────────

export async function fetchLineProfile(
  lineUserId: string,
  accessToken: string
): Promise<{ userId: string; displayName: string; pictureUrl?: string; statusMessage?: string } | null> {
  const res = await fetch(`${LINE_API_BASE}/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Send push message ───────────────────────────────────────────────────────

export async function sendLineMessage(
  lineUserId: string,
  messages: LineMessage[]
): Promise<{ error: string } | { success: true }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  // Fetch access token server-side
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("dealer_settings")
    .select("line_access_token, line_enabled")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!settings?.line_enabled) return { error: "LINE連携が無効です" };
  if (!settings?.line_access_token) return { error: "LINEアクセストークンが設定されていません" };

  // Update last_message_at
  await supabase
    .from("line_customers")
    .update({ last_message_at: new Date().toISOString() })
    .eq("dealer_id", dealer.dealer_id)
    .eq("line_user_id", lineUserId);

  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${settings.line_access_token}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("sendLineMessage error:", err);
    return { error: `LINE送信エラー: ${(err as { message?: string }).message ?? res.statusText}` };
  }

  return { success: true };
}

// ─── Send text message (convenience) ─────────────────────────────────────────

export async function sendLineTextMessage(
  lineUserId: string,
  text: string
): Promise<{ error: string } | { success: true }> {
  return sendLineMessage(lineUserId, [{ type: "text", text }]);
}

// ─── Completion report notification ──────────────────────────────────────────

export async function sendCompletionNotification(
  customerId: string,
  workOrderNumber: string,
  reportUrl?: string
): Promise<{ error: string } | { success: true } | { skipped: true; reason: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Find LINE connection for this customer
  const { data: lineCustomer } = await supabase
    .from("line_customers")
    .select("line_user_id, is_friend")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .eq("is_friend", true)
    .maybeSingle();

  if (!lineCustomer) {
    return { skipped: true, reason: "顧客のLINE連携がありません" };
  }

  const text = reportUrl
    ? `施工が完了しました。\n作業指示書: ${workOrderNumber}\n\n完了報告書はこちら:\n${reportUrl}`
    : `施工が完了しました。\n作業指示書: ${workOrderNumber}\n\nご不明な点はお気軽にご連絡ください。`;

  return sendLineTextMessage(lineCustomer.line_user_id, text);
}

// ─── Maintenance reminder notification ───────────────────────────────────────

export async function sendMaintenanceReminder(
  customerId: string,
  bookingUrl?: string
): Promise<{ error: string } | { success: true } | { skipped: true; reason: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  const { data: lineCustomer } = await supabase
    .from("line_customers")
    .select("line_user_id, is_friend")
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId)
    .eq("is_friend", true)
    .maybeSingle();

  if (!lineCustomer) {
    return { skipped: true, reason: "顧客のLINE連携がありません" };
  }

  const text = bookingUrl
    ? `そろそろメンテナンスの時期です。\nコーティングのメンテナンスでお車を最良の状態に保ちましょう。\n\nご予約はこちら:\n${bookingUrl}`
    : `そろそろメンテナンスの時期です。\nコーティングのメンテナンスでお車を最良の状態に保ちましょう。\nお気軽にご相談ください。`;

  return sendLineTextMessage(lineCustomer.line_user_id, text);
}
