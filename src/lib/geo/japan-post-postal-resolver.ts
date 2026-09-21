import { readFileSync } from "node:fs";

interface JapanPostAddressMapFile {
  source: string;
  sourceUrl: string;
  updated: string;
  entries: Record<string, string>;
}

let cachedEntries: Readonly<Record<string, string>> | null = null;

function isAddressMapFile(value: unknown): value is JapanPostAddressMapFile {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.source === "string"
    && typeof record.sourceUrl === "string"
    && typeof record.updated === "string"
    && typeof record.entries === "object"
    && record.entries !== null;
}

function addressEntries(): Readonly<Record<string, string>> {
  if (cachedEntries !== null) return cachedEntries;
  const path = new URL("../../data/postal/japan-post-address-map.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isAddressMapFile(parsed)) {
    throw new Error("Japan Post address map has an invalid structure");
  }
  cachedEntries = parsed.entries;
  return cachedEntries;
}

function normalizeAddress(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/^〒?\s*[0-9]{1,3}\s*[-‐‑‒–—―−ー－]?\s*(?:[0-9]{4})?\s*/u, "")
    .replace(/[\s　]/gu, "");
}

/**
 * Resolve a postal code only when Japan Post's official address data has one
 * unambiguous longest-prefix match. Unknown or ambiguous addresses stay blank.
 */
export function lookupJapanPostPostalCode(rawAddress: unknown): string | null {
  if (typeof rawAddress !== "string") return null;
  const address = normalizeAddress(rawAddress);
  if (address === "") return null;

  const entries = addressEntries();
  for (let length = address.length; length > 0; length -= 1) {
    const postal = entries[address.slice(0, length)];
    if (postal === undefined) continue;
    if (!/^\d{7}$/u.test(postal)) return null;
    return `${postal.slice(0, 3)}-${postal.slice(3)}`;
  }
  return null;
}
