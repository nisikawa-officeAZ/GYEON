// Build a safe /login redirect target that preserves the original internal destination as `next`.
// Server-side guard for redirect SOURCES (middleware/layouts/pages). The /login page re-validates the
// value on read (sanitizeNextPath), so this is defense-in-depth. Only safe internal relative paths are
// preserved; anything else falls back to plain /login (which then uses the normal default route).
export function loginRedirectTarget(pathname: string | null | undefined): string {
  const p = (pathname ?? "").trim();
  const hasControlChar = Array.from(p).some((ch) => ch.charCodeAt(0) < 0x20);
  const safe =
    p.startsWith("/") &&                    // internal absolute path
    !p.startsWith("//") &&                  // not protocol-relative (external)
    !p.includes("\\") &&                    // no backslash tricks
    !/^\/[a-z][a-z0-9+.-]*:/i.test(p) &&    // no "/javascript:" style scheme
    !hasControlChar;                        // no control characters
  return safe ? `/login?next=${encodeURIComponent(p)}` : "/login";
}
