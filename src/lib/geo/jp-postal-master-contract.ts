// GDA-2A-OCR-POSTAL-MASTER-R2 — shared pure contract for the Japan Post internal postal master.
//
// Every module in this feature (CSV parser, import CLI, Server Actions, Wizard planner, and the
// SQL migration's TypeScript-facing shape) imports its normalization rules and result vocabulary
// from HERE, so the deterministic behavior described in the governing directive cannot drift
// between the browser-facing planner and the server-facing lookup.
//
// This module performs NO I/O, NO database access, and NO network call. It is pure data shape and
// pure normalization functions only.

/**
 * The five-value result vocabulary fixed by the directive. `FOUND` is the only code that may fill
 * a blank target field; every other code leaves the current draft untouched.
 */
export type JpPostalLookupResultCode =
  | "FOUND"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "INVALID_INPUT"
  | "MASTER_UNAVAILABLE";

/** One authoritative master address, projected to exactly what the Wizard may display/apply. */
export interface JpPostalMasterAddress {
  readonly postalCode: string;
  readonly prefectureKanji: string;
  readonly cityKanji: string;
  readonly townKanji: string;
  readonly prefectureKana: string;
  readonly cityKana: string;
  readonly townKana: string;
}

export interface JpPostalForwardLookupFound {
  readonly code: "FOUND";
  readonly address: JpPostalMasterAddress;
}
export interface JpPostalForwardLookupNotFound {
  readonly code: Exclude<JpPostalLookupResultCode, "FOUND">;
}
export type JpPostalForwardLookupResult = JpPostalForwardLookupFound | JpPostalForwardLookupNotFound;

export interface JpPostalReverseLookupFound {
  readonly code: "FOUND";
  readonly postalCode: string;
}
export interface JpPostalReverseLookupNotFound {
  readonly code: Exclude<JpPostalLookupResultCode, "FOUND">;
}
export type JpPostalReverseLookupResult = JpPostalReverseLookupFound | JpPostalReverseLookupNotFound;

/**
 * Fixed length of the deterministic reverse-lookup index-narrowing prefix key. Both the import
 * pipeline (which stores `address_prefix_head` per master row) and the SQL RPC (which filters by
 * `(batch_id, address_prefix_head)` before evaluating the exact `starts_with` rule) must derive it
 * with this exact constant, or the prefilter and the true match set silently diverge.
 */
export const JP_POSTAL_ADDRESS_PREFIX_HEAD_LENGTH = 8;

/**
 * The three official `utf_ken_all` town-name forms that never identify one specific town. A record
 * carrying one of these exact strings in the town-kanji column is excluded from reverse
 * auto-resolution and is never treated as an exact town, per the R2 corrected contract.
 */
export const JP_POSTAL_NON_SPECIFIC_TOWN_TEXTS = [
  "以下に掲載がない場合",
  "市区町村名の次に番地がくる場合",
  "市区町村名一円",
] as const;

export type JpPostalNonSpecificTownText = (typeof JP_POSTAL_NON_SPECIFIC_TOWN_TEXTS)[number];

export function isNonSpecificTownText(townKanji: string): boolean {
  return (JP_POSTAL_NON_SPECIFIC_TOWN_TEXTS as readonly string[]).includes(townKanji);
}

// ── Normalization ────────────────────────────────────────────────────────────
//
// Both forward (postal → address) and reverse (address → postal) lookup share the SAME
// normalization so a value normalized once by the Wizard planner and again by the server RPC can
// never disagree about whether an input was "the same" input.

const FULLWIDTH_HYPHEN_VARIANTS = ["‐", "‑", "‒", "–", "—", "―", "−", "ー", "－"];

/**
 * Normalize a candidate postal-code input to a plain 7-digit string, or `null` if the input is not
 * a well-formed postal code after normalization.
 *
 * Steps: Unicode NFKC width normalization (full-width digits → half-width), strip hyphen variants
 * and whitespace, then require exactly 7 ASCII digits. This never throws.
 */
export function normalizeJpPostalCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s: string;
  try {
    s = raw.normalize("NFKC");
  } catch {
    return null;
  }
  for (const h of FULLWIDTH_HYPHEN_VARIANTS) s = s.split(h).join("-");
  s = s.replace(/[-\s]/g, "");
  return /^\d{7}$/.test(s) ? s : null;
}

/**
 * Normalize a candidate address input for reverse-lookup matching, or `null` if the input carries
 * no usable text after normalization.
 *
 * Steps: Unicode NFKC width normalization, hyphen-variant unification, and whitespace collapse.
 * This is deliberately NOT a lossy fuzzy key — no kana/kanji conversion, no prefecture/city
 * splitting — it only removes representation noise a human or OCR engine may introduce.
 */
export function normalizeJpAddressInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s: string;
  try {
    s = raw.normalize("NFKC");
  } catch {
    return null;
  }
  for (const h of FULLWIDTH_HYPHEN_VARIANTS) s = s.split(h).join("-");
  s = s.replace(/\s+/g, "").trim();
  return s.length > 0 ? s : null;
}

/**
 * The specific-address key stored per master row and matched against a normalized reverse-lookup
 * input: prefecture + city + town, in kanji, concatenated with no separator. Non-specific town rows
 * never produce this as a matchable key (callers must check `isNonSpecificTownText` first).
 */
export function buildJpPostalAddressKey(address: Pick<JpPostalMasterAddress, "prefectureKanji" | "cityKanji" | "townKanji">): string {
  return `${address.prefectureKanji}${address.cityKanji}${address.townKanji}`;
}

/** The fixed-length index-narrowing prefix derived from an address key. */
export function buildJpPostalAddressPrefixHead(addressKey: string): string {
  return addressKey.slice(0, JP_POSTAL_ADDRESS_PREFIX_HEAD_LENGTH);
}

// ── RPC payload mapping ──────────────────────────────────────────────────────
//
// Pure, dependency-free mapping from an untyped `jsonb` RPC payload (as returned by
// `supabase.rpc(...)`) to the typed result vocabulary above. Kept HERE, not in the Server Action
// file, because a `"use server"` module may only export async functions — every other export
// throws a Next.js build error — so this shape-validation logic must live in a plain module to
// remain unit-testable without a live Supabase/Next.js request context.

const JP_POSTAL_RESULT_CODES: readonly JpPostalLookupResultCode[] = [
  "FOUND", "NOT_FOUND", "AMBIGUOUS", "INVALID_INPUT", "MASTER_UNAVAILABLE",
];

function isJpPostalResultCode(value: unknown): value is JpPostalLookupResultCode {
  return typeof value === "string" && (JP_POSTAL_RESULT_CODES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseJpPostalMasterAddress(raw: unknown): JpPostalMasterAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const { postal_code: postalCode, prefecture_kanji: prefectureKanji, city_kanji: cityKanji, town_kanji: townKanji,
    prefecture_kana: prefectureKana, city_kana: cityKana, town_kana: townKana } = r;
  if (
    !isNonEmptyString(postalCode) || !isNonEmptyString(prefectureKanji) || !isNonEmptyString(cityKanji)
    || !isNonEmptyString(townKanji) || !isNonEmptyString(prefectureKana) || !isNonEmptyString(cityKana)
    || !isNonEmptyString(townKana)
  ) {
    return null;
  }
  return { postalCode, prefectureKanji, cityKanji, townKanji, prefectureKana, cityKana, townKana };
}

/** Maps an untyped forward-lookup RPC payload (`{ result_code, address? }`) to the typed result. */
export function mapJpPostalForwardRpcPayload(data: unknown): JpPostalForwardLookupResult {
  if (!data || typeof data !== "object") return { code: "MASTER_UNAVAILABLE" };
  const row = data as Record<string, unknown>;
  const code = row.result_code;
  if (!isJpPostalResultCode(code)) return { code: "MASTER_UNAVAILABLE" };
  if (code !== "FOUND") return { code };
  const address = parseJpPostalMasterAddress(row.address);
  return address ? { code: "FOUND", address } : { code: "MASTER_UNAVAILABLE" };
}

/** Maps an untyped reverse-lookup RPC payload (`{ result_code, postal_code? }`) to the typed result. */
export function mapJpPostalReverseRpcPayload(data: unknown): JpPostalReverseLookupResult {
  if (!data || typeof data !== "object") return { code: "MASTER_UNAVAILABLE" };
  const row = data as Record<string, unknown>;
  const code = row.result_code;
  if (!isJpPostalResultCode(code)) return { code: "MASTER_UNAVAILABLE" };
  if (code !== "FOUND") return { code };
  const postalCode = row.postal_code;
  return isNonEmptyString(postalCode) && /^\d{7}$/.test(postalCode)
    ? { code: "FOUND", postalCode }
    : { code: "MASTER_UNAVAILABLE" };
}
