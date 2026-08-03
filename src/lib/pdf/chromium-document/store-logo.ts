// TEMPLATE-B2 — upper-left store-logo resolution (registered logo contract).
//
// Order: the authenticated dealer's configured logo first; otherwise the canonical GYEON DA UI
// asset public/brand/gyeon-classic/logos/combination.svg. The resolved bytes are embedded as a
// data: URI so the Chromium render stays fully offline.
//
// A dealer logo qualifies ONLY when the server-side brand profile already carries embedded bytes
// (getDealerBranding downloads logo_path from the private branding bucket and emits a data: URI).
// A remote http(s) logo_url is NOT fetched here — remote fetching at render time is forbidden —
// so such a profile falls back to the canonical asset. The lower GYEON certification asset is a
// separate vendored file (assets/gyeon-official/) and is never substituted by this resolution.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrandProfile } from "@/components/documents/types";

const FALLBACK_LOGO_REPO_PATH = ["public", "brand", "gyeon-classic", "logos", "combination.svg"];

let cachedFallback: string | null = null;

export async function loadFallbackStoreLogoDataUri(): Promise<string> {
  if (cachedFallback) return cachedFallback;
  const file = path.join(process.cwd(), ...FALLBACK_LOGO_REPO_PATH);
  const svg = await readFile(file);
  cachedFallback = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return cachedFallback;
}

/** Resolve the upper-left logo per the registered contract. Always returns a data: URI. */
export async function resolveStoreLogoDataUri(brand: BrandProfile): Promise<string> {
  const configured = brand.logoUrl;
  if (typeof configured === "string" && configured.startsWith("data:")) return configured;
  return loadFallbackStoreLogoDataUri();
}
