// Post-login redirect-target sanitizer.
//
// The input comes from useSearchParams().get("next"), which has ALREADY removed the single
// transport-encoding layer applied by the middleware's URLSearchParams.set("next", pathname+search).
// Decoding again here would corrupt legitimate percent-encoded path/query data — turning "%2F",
// "%26", "%23", or double-encoded "%252F" into URL delimiters (new path segments, injected query
// parameters, or a spurious fragment) before router.push. So this function performs NO decoding:
// it validates the already-decoded value structurally and returns it byte-for-byte, preserving any
// valid percent-encoding.
//
// Accepts ONLY safe internal absolute paths. Rejects null/empty, protocol-relative ("//"),
// scheme-like forms ("/javascript:" ...), backslash tricks, and control characters, falling back to
// the default route ("/"). Total function: never throws, always returns a safe internal path.

const DEFAULT_AFTER_LOGIN = "/";

// A path that begins with "/<scheme>:" ("/javascript:", "/http:" ...) — rejected defensively.
const SCHEME_LIKE = /^\/[a-z][a-z0-9+.-]*:/i;

// True if the string contains any control character U+0000–U+001F or U+007F. Implemented with
// charCodeAt so no literal control byte or fragile escape appears in this source file.
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function sanitizeNextPath(raw: string | null): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;                     // absent or empty
  const value = raw;                                        // already transport-decoded by searchParams.get
  if (!value.startsWith("/")) return DEFAULT_AFTER_LOGIN;   // internal absolute path only
  if (value.startsWith("//")) return DEFAULT_AFTER_LOGIN;   // protocol-relative -> external
  if (value.includes("\\")) return DEFAULT_AFTER_LOGIN;     // backslash tricks (incl. "/\")
  if (hasControlChar(value)) return DEFAULT_AFTER_LOGIN;    // control chars U+0000–U+001F, U+007F
  if (SCHEME_LIKE.test(value)) return DEFAULT_AFTER_LOGIN;  // "/javascript:" etc.
  return value;                                             // preserve internal percent-encoding verbatim
}
