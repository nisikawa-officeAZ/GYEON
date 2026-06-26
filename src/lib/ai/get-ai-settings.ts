"use server";

// DealerOS — AI Gateway: Read Dealer AI Settings
// Security:
//   - dealer_id from getCurrentDealer() only — never from client
//   - Raw API keys are NEVER returned — only has_key: boolean
//   - Handles missing ai_settings column gracefully (migration_required flag)

import { createClient }       from "@/lib/supabase/server";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import type { AiSettingsView } from "./ai-settings-types";
import { AI_SETTINGS_DEFAULT } from "./ai-settings-types";
import type { AIProviderId }  from "./types";
import { AI_PROVIDER_REGISTRY } from "./provider-registry";

export async function getAiSettings(): Promise<AiSettingsView> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { ...AI_SETTINGS_DEFAULT };

  const supabase = await createClient();

  let raw: Record<string, unknown> = {};

  try {
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("ai_settings")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error) {
      // 42703 = PostgreSQL "column does not exist" — migration not yet applied
      if (error.code === "42703" || error.message?.includes("ai_settings")) {
        return { ...AI_SETTINGS_DEFAULT, migration_required: true };
      }
      return { ...AI_SETTINGS_DEFAULT };
    }

    raw = (data?.ai_settings as Record<string, unknown>) ?? {};
  } catch {
    return { ...AI_SETTINGS_DEFAULT };
  }

  const providers: AiSettingsView["providers"] = {};

  for (const entry of AI_PROVIDER_REGISTRY) {
    const id = entry.id as AIProviderId;
    const encryptedKey = raw[entry.settingsKey];
    providers[id] = {
      has_key:      typeof encryptedKey === "string" && encryptedKey.length > 0,
      validated_at: typeof raw[`${id}_validated_at`] === "string"
        ? (raw[`${id}_validated_at`] as string)
        : null,
    };
  }

  const primaryProvider = typeof raw.primary_provider === "string"
    ? (raw.primary_provider as AIProviderId)
    : null;

  const validProviderIds = AI_PROVIDER_REGISTRY.map((p) => p.id) as AIProviderId[];

  return {
    enabled:            typeof raw.enabled === "boolean" ? raw.enabled : false,
    primary_provider:   validProviderIds.includes(primaryProvider!) ? primaryProvider : null,
    monthly_limit_usd:  typeof raw.monthly_limit_usd === "number" ? raw.monthly_limit_usd : 0,
    hard_limit:         typeof raw.hard_limit === "boolean" ? raw.hard_limit : false,
    task_routing:       {},
    providers,
    migration_required: false,
  };
}
