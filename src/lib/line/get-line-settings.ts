"use server";

// SERVER ONLY — LINE credentials must never reach the client.
// Returns full DealerSettingsDB (including secrets) only for server-side use.
// For client display, use getDealerSettingsPublic() which omits secrets.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { DealerSettingsDB, DealerSettingsPublic } from "./line-types";

export async function getDealerSettings(): Promise<DealerSettingsDB | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dealer_settings")
    .select("*")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (error) {
    console.error("getDealerSettings error:", error);
    return null;
  }

  return data as DealerSettingsDB | null;
}

// Safe for client — strips line_channel_secret and line_access_token
export async function getDealerSettingsPublic(): Promise<DealerSettingsPublic | null> {
  const settings = await getDealerSettings();
  if (!settings) return null;

  const { line_channel_secret, line_access_token, ...safe } = settings;
  void line_channel_secret;
  void line_access_token;
  return safe;
}

// Used by webhook handler — looks up by dealer_id directly (no auth context)
export async function getDealerSettingsByDealerId(
  dealerId: string,
  serviceSupabase: ReturnType<typeof import("@/lib/supabase/server")["createClient"]> extends Promise<infer T> ? T : never
): Promise<DealerSettingsDB | null> {
  const { data, error } = await serviceSupabase
    .from("dealer_settings")
    .select("*")
    .eq("dealer_id", dealerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DealerSettingsDB;
}
