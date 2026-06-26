"use server";

// DealerOS — Get LINE Rich Menu Config
// Reads from dealer_settings.line_public_settings.rich_menu (PHASE70 jsonb column).
// Security: dealer_id from getCurrentDealer() only — never from client.

import { createClient }        from "@/lib/supabase/server";
import { getCurrentDealer }    from "@/lib/auth/get-current-dealer";
import { parseRichMenuConfig, DEFAULT_RICH_MENU_CONFIG } from "./line-rich-menu-types";
import type { LineRichMenuConfig } from "./line-rich-menu-types";

export async function getLineRichMenuConfig(): Promise<LineRichMenuConfig> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { ...DEFAULT_RICH_MENU_CONFIG };

  const supabase = await createClient();
  const { data } = await supabase
    .from("dealer_settings")
    .select("line_public_settings")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!data?.line_public_settings) return { ...DEFAULT_RICH_MENU_CONFIG };

  const settings = data.line_public_settings as Record<string, unknown>;
  return parseRichMenuConfig(settings.rich_menu);
}
