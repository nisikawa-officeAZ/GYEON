// TEMPLATE-B2-R1 — legacy store-logo bridge (pure validation, zero I/O).
//
// Some dealers configured their logo before logo_path existed, so dealer_settings.logo_url holds
// the PUBLIC Storage URL of the SAME project's dealer-branding object. Those dealers must still
// render their configured logo — but rendering stays fully offline, so the URL itself is never
// fetched and never forwarded to Chromium. Instead this parser acts as a GATE:
//
//   - it accepts ONLY the canonical public Storage URL of the current Supabase project, the
//     dealer-branding bucket, and the EXACT authenticated dealer's canonical logo object
//     (brandingStoragePath(dealerId, "logo")), and
//   - on success it returns the canonical storage path RECOMPUTED FROM dealerId ALONE — nothing
//     derived from the URL is ever used for the download, so even a parser defect could not make
//     dealer A read dealer B's object.
//
// Everything else fails closed to null: other projects, other buckets, other dealers, credentials,
// fragments, query strings, backslashes, dot segments, any percent-encoding (the canonical path
// needs none, so encoding is by definition non-canonical), malformed URLs, and every arbitrary
// http(s) address. No network client exists in this module.

import { BRANDING_BUCKET, brandingStoragePath } from "@/lib/branding/branding-types";

/** Matches the existing branding upload limit — legacy bytes above this are rejected. */
export const LEGACY_LOGO_MAX_BYTES = 5 * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a legacy logo_url. Returns the canonical dealer-branding storage path for THIS dealer
 * when — and only when — the URL is exactly that object's canonical public URL; otherwise null.
 */
export function parseLegacyBrandingLogoUrl(
  rawUrl: string | null | undefined,
  dealerId: string,
  projectUrl: string | null | undefined,
): string | null {
  if (typeof rawUrl !== "string" || typeof projectUrl !== "string") return null;
  const url = rawUrl.trim();
  const project = projectUrl.trim();
  if (!url || !project) return null;
  if (!UUID_RE.test(dealerId)) return null;

  // Byte-level guards before any parsing: the canonical URL contains none of these.
  if (/\s/.test(url)) return null;
  if (url.includes("\\") || url.includes("%") || url.includes("..")) return null;
  if (url.includes("#") || url.includes("?") || url.includes("@")) return null;

  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(project);
  } catch {
    return null;
  }

  // Same project only: identical scheme and identical host (including port).
  if (parsed.protocol !== expected.protocol || parsed.host !== expected.host) return null;
  if (parsed.username !== "" || parsed.password !== "") return null;
  if (parsed.search !== "" || parsed.hash !== "") return null;

  const canonicalPath = brandingStoragePath(dealerId, "logo");
  if (parsed.pathname !== `/storage/v1/object/public/${BRANDING_BUCKET}/${canonicalPath}`) return null;

  // The URL was only the gate — the download path is derived from dealerId alone.
  return canonicalPath;
}
