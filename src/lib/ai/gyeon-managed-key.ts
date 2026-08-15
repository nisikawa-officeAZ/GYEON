// DealerOS — GYEON-managed AI key resolver
// SERVER-ONLY — never import in client code. The resolved key is NEVER returned
// to the browser and NEVER logged.
//
// GYEON-managed features (vehicle registration OCR, GYEON estimate
// recommendation, inventory/sales diagnostics, GYEON system-level AI) run on
// GYEON Japan's own platform key. The dealer is never asked to provide one.
//
// Lookup order (see docs/AI_API_OWNERSHIP_POLICY.md):
//   1) DB-stored GYEON OpenAI key from the AI Center (gyeon_ai_settings, encrypted)
//   2) process.env.OPENAI_API_KEY  (development fallback)
//
// This module reads with the service-role client and decrypts internally. It is
// NOT a "use server" action — it must stay server-internal so the raw key never
// crosses to the client.

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptApiKey, isEncryptionConfigured } from "./crypto";

export type GyeonManagedKeySource = "db" | "env";

export type GyeonManagedKeyResult =
  | { ok: true;  apiKey: string; source: GyeonManagedKeySource }
  | { ok: false; error: "GYEON_MANAGED_KEY_MISSING" };

/**
 * Read and decrypt the GYEON-managed key stored in the AI Center.
 * Returns null on any failure (table/row missing, decrypt fails, no service role).
 */
async function readGyeonKeyFromDb(): Promise<string | null> {
  if (!isEncryptionConfigured()) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("gyeon_ai_settings")
      .select("openai_api_key_encrypted")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return null;
    const encrypted = data.openai_api_key_encrypted;
    if (typeof encrypted !== "string" || encrypted.length === 0) return null;

    return decryptApiKey(encrypted);
  } catch {
    // Missing table / service-role env / network — fall back to env.
    return null;
  }
}

/**
 * Resolve the GYEON-managed OpenAI key.
 * Priority: 1) AI Center DB key, 2) OPENAI_API_KEY env fallback.
 */
export async function getGyeonManagedApiKey(): Promise<GyeonManagedKeyResult> {
  const dbKey = await readGyeonKeyFromDb();
  if (dbKey) return { ok: true, apiKey: dbKey, source: "db" };

  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return { ok: true, apiKey: envKey, source: "env" };

  return { ok: false, error: "GYEON_MANAGED_KEY_MISSING" };
}

/** True when a GYEON-managed key is resolvable (DB or env). */
export async function isGyeonManagedKeyConfigured(): Promise<boolean> {
  const result = await getGyeonManagedApiKey();
  return result.ok;
}
