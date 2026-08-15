// B2-D.3 — SHARED normalisation vectors for the Screen 1 duplicate warning.
//
// ── WHY THIS FILE EXISTS SEPARATELY ─────────────────────────────────────────────
// Two independent implementations must agree exactly:
//
//   1. `match_phone_digits` / `match_name_norm` / `match_kana_norm`, the STORED generated columns
//      added by 20260727112326_add_customer_match_keys.sql.
//   2. `phoneMatchKey` / `nameMatchKey` / `kanaMatchKey` in find-wizard-customer-duplicates-core.ts,
//      which normalise the OPERATOR'S input before it is compared against those columns.
//
// If they diverge, the warning misfires in a way neither side's own tests can catch, because each is
// individually correct — it is the stored value and the query value that stop meeting. That is the
// same two-sided contract the canonical/legacy column split got wrong.
//
// These vectors are therefore the single source of truth for both. The TypeScript core is asserted
// against them in find-wizard-customer-duplicates-core.test.ts; the database side is asserted against
// the SAME table in the B2-D.4 disposable-database phase, by inserting `input` and comparing the
// generated column to `expected`. Add a case here, and both sides must satisfy it.
//
// No PII: every value is synthetic.

/** One normalisation vector. `expected === null` means "produces no key, so it can never match". */
export interface MatchVector {
  readonly label: string;
  readonly input: string;
  readonly expected: string | null;
}

/**
 * Phone vectors. NFKC folds full-width digits and full-width hyphens; everything non-digit is then
 * stripped; the result is a key ONLY at 10 or 11 digits.
 */
export const PHONE_VECTORS: readonly MatchVector[] = [
  { label: "plain 11-digit mobile",            input: "09012345678",           expected: "09012345678" },
  { label: "ASCII hyphens",                    input: "090-1234-5678",         expected: "09012345678" },
  { label: "spaces as separators",             input: "090 1234 5678",         expected: "09012345678" },
  { label: "full-width digits",                input: "０９０１２３４５６７８",  expected: "09012345678" },
  { label: "full-width digits + full-width hyphen", input: "０９０－１２３４－５６７８", expected: "09012345678" },
  { label: "parenthesised area code",          input: "(03) 1234-5678",        expected: "0312345678" },
  { label: "leading/trailing whitespace",      input: "  090-1234-5678  ",     expected: "09012345678" },
  { label: "10-digit landline",                input: "03-1234-5678",          expected: "0312345678" },
  // Out-of-range lengths produce NO key, so a stored fragment can never match a typed fragment.
  { label: "too short — 2 digits",             input: "03",                    expected: null },
  { label: "too short — 9 digits",             input: "090123456",             expected: null },
  { label: "too long — 12 digits",             input: "090123456789",          expected: null },
  { label: "no digits at all",                 input: "電話なし",               expected: null },
  { label: "empty",                            input: "",                      expected: null },
];

/**
 * Name vectors. NFKC then ALL whitespace removed — Japanese names are entered with and without a
 * separating space and the two must be the same person.
 */
export const NAME_VECTORS: readonly MatchVector[] = [
  { label: "no space",                     input: "山田太郎",        expected: "山田太郎" },
  { label: "ASCII space",                  input: "山田 太郎",       expected: "山田太郎" },
  { label: "ideographic space U+3000",     input: "山田　太郎",      expected: "山田太郎" },
  { label: "leading/trailing whitespace",  input: "  山田太郎  ",    expected: "山田太郎" },
  { label: "multiple internal spaces",     input: "山田   太郎",     expected: "山田太郎" },
  { label: "company name with full-width parens", input: "株式会社（テスト）", expected: "株式会社(テスト)" },
  { label: "whitespace only",              input: "   ",             expected: null },
  { label: "empty",                        input: "",                expected: null },
];

/**
 * Kana vectors. The decisive case is half-width katakana: NFKC recomposes it — including dakuten,
 * which is a SEPARATE code point in half-width form — into full-width katakana.
 */
export const KANA_VECTORS: readonly MatchVector[] = [
  { label: "full-width katakana",              input: "ヤマダタロウ",     expected: "ヤマダタロウ" },
  { label: "half-width katakana with dakuten", input: "ﾔﾏﾀﾞﾀﾛｳ",        expected: "ヤマダタロウ" },
  { label: "full-width with ASCII space",      input: "ヤマダ タロウ",    expected: "ヤマダタロウ" },
  { label: "half-width with half-width space", input: "ﾔﾏﾀﾞ ﾀﾛｳ",       expected: "ヤマダタロウ" },
  { label: "ideographic space",                input: "ヤマダ　タロウ",   expected: "ヤマダタロウ" },
  { label: "handakuten (半濁点) half-width",    input: "ﾊﾟﾝﾀﾛｳ",         expected: "パンタロウ" },
  { label: "whitespace only",                  input: "  ",              expected: null },
  { label: "empty",                            input: "",                expected: null },
];

/**
 * Legacy-column fallback vectors, expressed as the ROW SHAPE the generated columns read.
 *
 * Post-20260727033223 wizard rows carry `last_name` (whole name) and `last_name_kana`. Rows created
 * before that fix, and rows predating migration 035, carry only legacy `name` / `kana`. The coalesce
 * chain must produce the same key from either generation — that is what lets the warning find an old
 * customer without any backfill.
 */
export interface LegacyFallbackVector {
  readonly label: string;
  readonly row: {
    readonly last_name?: string | null;
    readonly first_name?: string | null;
    readonly name?: string | null;
    readonly last_name_kana?: string | null;
    readonly first_name_kana?: string | null;
    readonly kana?: string | null;
  };
  readonly expectedName: string | null;
  readonly expectedKana: string | null;
}

export const LEGACY_FALLBACK_VECTORS: readonly LegacyFallbackVector[] = [
  {
    label: "canonical only (post-B2-B wizard row): whole name in last_name",
    row: { last_name: "山田太郎", first_name: null, name: "山田太郎",
           last_name_kana: "ヤマダタロウ", first_name_kana: null, kana: null },
    expectedName: "山田太郎", expectedKana: "ヤマダタロウ",
  },
  {
    label: "canonical split across last_name + first_name",
    row: { last_name: "山田", first_name: "太郎", name: "山田 太郎",
           last_name_kana: "ヤマダ", first_name_kana: "タロウ", kana: null },
    expectedName: "山田太郎", expectedKana: "ヤマダタロウ",
  },
  {
    label: "legacy only (pre-B2-B wizard row): canonical columns NULL",
    row: { last_name: null, first_name: null, name: "山田 太郎",
           last_name_kana: null, first_name_kana: null, kana: "ヤマダ タロウ" },
    expectedName: "山田太郎", expectedKana: "ヤマダタロウ",
  },
  {
    label: "legacy kana in half-width (pre-035 import)",
    row: { last_name: null, first_name: null, name: "山田太郎",
           last_name_kana: null, first_name_kana: null, kana: "ﾔﾏﾀﾞﾀﾛｳ" },
    expectedName: "山田太郎", expectedKana: "ヤマダタロウ",
  },
  {
    label: "canonical present but blank — falls back to legacy rather than yielding an empty key",
    row: { last_name: "", first_name: "", name: "山田太郎",
           last_name_kana: "", first_name_kana: "", kana: "ヤマダタロウ" },
    expectedName: "山田太郎", expectedKana: "ヤマダタロウ",
  },
  {
    label: "no name material at all",
    row: { last_name: null, first_name: null, name: null,
           last_name_kana: null, first_name_kana: null, kana: null },
    expectedName: null, expectedKana: null,
  },
];
