"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole }  from "@/lib/staff/require-role";

export async function upsertDealerSettings(
  fd: FormData
): Promise<{ error: string } | { success: true }> {
  try {
    // Requires owner or manager — throws if role is insufficient or unauthenticated.
    // dealer_id is resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const supabase = await createClient();

    const payload = {
      dealer_id:        dealerId,
      line_channel_id:  (fd.get("line_channel_id") as string) || null,
      line_liff_id:     (fd.get("line_liff_id") as string) || null,
      webhook_url:      (fd.get("webhook_url") as string) || null,
      line_enabled:     fd.get("line_enabled") === "true",
      business_name:    (fd.get("business_name") as string) || null,
      business_phone:   (fd.get("business_phone") as string) || null,
      business_email:   (fd.get("business_email") as string) || null,
      business_address: (fd.get("business_address") as string) || null,
      updated_at:       new Date().toISOString(),
    } as Record<string, unknown>;

    // Only update secrets if provided (non-empty) — prevents accidental clearing
    const secret = (fd.get("line_channel_secret") as string) || "";
    const token  = (fd.get("line_access_token") as string) || "";
    if (secret) payload.line_channel_secret = secret;
    if (token)  payload.line_access_token   = token;

    const { error } = await supabase
      .from("dealer_settings")
      .upsert(payload, { onConflict: "dealer_id" });

    if (error) {
      console.error("[upsertDealerSettings] error:", error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[upsertDealerSettings] failed:", err);
    const msg = err instanceof Error ? err.message : "設定の保存に失敗しました";
    return { error: msg };
  }
}
