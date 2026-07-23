// Client-safe RFC 4122 v4 UUID generator that never throws.
//
// `crypto.randomUUID()` is only exposed in SECURE CONTEXTS (HTTPS or http://localhost). On a
// plain-HTTP LAN origin — e.g. http://192.168.1.148:3000 used for on-device (smartphone) testing —
// `crypto.randomUUID` is `undefined`, so calling it throws "crypto.randomUUID is not a function".
// This helper prefers the native implementation when available, then falls back to
// `crypto.getRandomValues` (which IS available in non-secure contexts), then to a last-resort
// Math.random generator. Each preferred primitive is invoked inside try/catch, so even a
// present-but-throwing `randomUUID()` or `getRandomValues()` degrades to the next source rather than
// crashing — ID generation never throws regardless of origin/secure-context.
//
// NOTE: the Math.random branch is an AVAILABILITY-ONLY fallback for non-security identifiers. It is
// NOT cryptographically secure and must not be used for credentials, tokens, secrets, or any other
// unguessable values.
export function safeRandomUUID(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;

  // 1) Native crypto.randomUUID() — preferred (CSPRNG, secure contexts).
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // present but threw — fall through to getRandomValues()
    }
  }

  const bytes = new Uint8Array(16);
  let filled = false;

  // 2) crypto.getRandomValues() — CSPRNG, also available in non-secure contexts.
  if (c && typeof c.getRandomValues === "function") {
    try {
      c.getRandomValues(bytes);
      filled = true;
    } catch {
      // present but threw — fall through to the Math.random fallback
    }
  }

  // 3) Availability-only fallback (see NOTE above): not cryptographically secure.
  if (!filled) {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // RFC 4122 §4.4: set the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
