// DealerOS — AI Gateway: API Key Encryption
// SERVER-ONLY — never import in client code.
//
// Uses AES-256-GCM via Node.js crypto.
// Requires DEALER_AI_KEY_SECRET env var (64 hex chars = 32 bytes).
//
// Ciphertext format: "v1:{iv_hex}:{auth_tag_hex}:{ciphertext_hex}"
// The "v1:" prefix enables future algorithm migration without data loss.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_HEX = process.env.DEALER_AI_KEY_SECRET;
const EXPECTED_KEY_HEX_LENGTH = 64; // 32 bytes × 2 hex chars

export function isEncryptionConfigured(): boolean {
  return typeof KEY_HEX === "string" && KEY_HEX.length === EXPECTED_KEY_HEX_LENGTH;
}

/** Encrypt an API key. Returns null if DEALER_AI_KEY_SECRET is not configured. */
export function encryptApiKey(plaintext: string): string | null {
  if (!isEncryptionConfigured()) return null;
  const key = Buffer.from(KEY_HEX!, "hex");
  const iv  = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypt an API key. Returns null on any failure (wrong key, bad format, corrupted). */
export function decryptApiKey(ciphertext: string): string | null {
  if (!isEncryptionConfigured()) return null;
  if (!ciphertext.startsWith("v1:")) return null;
  const parts = ciphertext.split(":");
  if (parts.length !== 4) return null;
  const [, ivHex, tagHex, encHex] = parts;
  if (!ivHex || !tagHex || !encHex) return null;
  try {
    const key = Buffer.from(KEY_HEX!, "hex");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return (
      decipher.update(Buffer.from(encHex, "hex")).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    return null;
  }
}
