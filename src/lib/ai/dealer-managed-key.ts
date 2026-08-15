// DealerOS — Dealer-managed AI key resolver
// SERVER-ONLY — never import in client code, and NEVER expose via a "use server"
// action (this module returns a raw decrypted key and must stay server-internal).
//
// Resolves the dealer's own AI provider key for dealer-managed features. The key
// is stored encrypted (AES-256-GCM) in dealer_settings.ai_settings by the AI
// Gateway. When the dealer has not configured a key, the resolver returns a
// standard "key required" result carrying DEALER_AI_KEY_REQUIRED_MESSAGE so the
// UI can prompt the dealer to set one up.
//
// Billing / usage metering is intentionally NOT implemented here yet.
// See: docs/AI_API_OWNERSHIP_POLICY.md

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { decryptApiKey, isEncryptionConfigured } from "./crypto";
import { getProviderEntry } from "./provider-registry";
import { DEALER_AI_KEY_REQUIRED_MESSAGE } from "./ownership";
import type { AIProviderId } from "./types";

export type DealerManagedKeyResult =
  | { ok: true;  apiKey: string; provider: AIProviderId }
  | {
      ok: false;
      error:
        | "DEALER_KEY_REQUIRED"        // no key configured for this dealer/provider
        | "NOT_AUTHENTICATED"          // no active dealer context
        | "ENCRYPTION_NOT_CONFIGURED"; // DEALER_AI_KEY_SECRET missing on server
      /** User-facing message — safe to display as-is. */
      message: string;
    };

/**
 * Resolve the dealer's own API key for a given provider.
 * Returns { ok: false, message: DEALER_AI_KEY_REQUIRED_MESSAGE } whenever a key
 * cannot be produced, so callers can surface a consistent prompt to the dealer.
 */
export async function resolveDealerManagedApiKey(
  provider: AIProviderId,
): Promise<DealerManagedKeyResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return { ok: false, error: "NOT_AUTHENTICATED", message: DEALER_AI_KEY_REQUIRED_MESSAGE };
  }

  if (!isEncryptionConfigured()) {
    // Cannot decrypt without DEALER_AI_KEY_SECRET — treat as "not configured".
    return { ok: false, error: "ENCRYPTION_NOT_CONFIGURED", message: DEALER_AI_KEY_REQUIRED_MESSAGE };
  }

  const entry = getProviderEntry(provider);
  if (!entry) {
    return { ok: false, error: "DEALER_KEY_REQUIRED", message: DEALER_AI_KEY_REQUIRED_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dealer_settings")
    .select("ai_settings")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  // Missing column / row / read error → dealer simply has no key configured.
  if (error || !data) {
    return { ok: false, error: "DEALER_KEY_REQUIRED", message: DEALER_AI_KEY_REQUIRED_MESSAGE };
  }

  const raw = (data.ai_settings as Record<string, unknown>) ?? {};
  const encrypted = raw[entry.settingsKey];
  if (typeof encrypted !== "string" || encrypted.length === 0) {
    return { ok: false, error: "DEALER_KEY_REQUIRED", message: DEALER_AI_KEY_REQUIRED_MESSAGE };
  }

  const apiKey = decryptApiKey(encrypted);
  if (!apiKey) {
    return { ok: false, error: "DEALER_KEY_REQUIRED", message: DEALER_AI_KEY_REQUIRED_MESSAGE };
  }

  return { ok: true, apiKey, provider };
}
