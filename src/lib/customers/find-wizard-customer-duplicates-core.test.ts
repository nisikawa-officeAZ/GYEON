// B2-D.3 — unit tests for the pure duplicate-match core (no DB, no mocks).
// Run: node --import tsx --test src/lib/customers/find-wizard-customer-duplicates-core.test.ts
//
// The normalisation cases are driven by duplicate-match-fixtures.ts — the SAME table the B2-D.4
// disposable-database phase asserts the generated columns against. That is the point: these two
// implementations must agree, and a vector added here obliges both.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RESULT_CAP,
  FETCH_LIMIT,
  PHONE_KEY_LENGTHS,
  DUPLICATE_SELECT_COLUMNS,
  normalizeNfkc,
  phoneMatchKey,
  nameMatchKey,
  kanaMatchKey,
  planDuplicateCheck,
  quoteFilterValue,
  buildDuplicateOrFilter,
  classifyReason,
  applyCandidateCap,
} from "./find-wizard-customer-duplicates-core";
import {
  PHONE_VECTORS,
  NAME_VECTORS,
  KANA_VECTORS,
  LEGACY_FALLBACK_VECTORS,
} from "./duplicate-match-fixtures";

// ── shared vectors: phone ────────────────────────────────────────────────────

for (const v of PHONE_VECTORS) {
  test(`phone vector — ${v.label}`, () => {
    assert.equal(phoneMatchKey(v.input), v.expected);
  });
}

test("phone: every accepted key is exactly 10 or 11 digits", () => {
  assert.deepEqual([...PHONE_KEY_LENGTHS], [10, 11]);
  for (const v of PHONE_VECTORS) {
    if (v.expected !== null) {
      assert.ok(/^[0-9]+$/.test(v.expected), `${v.label}: digits only`);
      assert.ok([10, 11].includes(v.expected.length), `${v.label}: length in range`);
    }
  }
});

test("phone: a one-digit difference is NOT the same key", () => {
  assert.notEqual(phoneMatchKey("090-1234-5678"), phoneMatchKey("090-1234-5679"));
});

test("phone: a prefix or suffix of a real number never yields a matching key", () => {
  const full = phoneMatchKey("09012345678");
  assert.equal(phoneMatchKey("0901234"), null, "prefix is too short to be a key");
  assert.equal(phoneMatchKey("2345678"), null, "suffix is too short to be a key");
  assert.notEqual(full, null);
});

test("phone: a non-string never throws", () => {
  for (const bad of [null, undefined, 42, {}, [], true]) {
    assert.equal(phoneMatchKey(bad), null);
  }
});

// ── shared vectors: name and kana ────────────────────────────────────────────

for (const v of NAME_VECTORS) {
  test(`name vector — ${v.label}`, () => {
    assert.equal(nameMatchKey(v.input), v.expected);
  });
}

for (const v of KANA_VECTORS) {
  test(`kana vector — ${v.label}`, () => {
    assert.equal(kanaMatchKey(v.input), v.expected);
  });
}

test("kana: half-width and full-width katakana produce the SAME key", () => {
  assert.equal(kanaMatchKey("ﾔﾏﾀﾞﾀﾛｳ"), kanaMatchKey("ヤマダタロウ"));
  assert.equal(kanaMatchKey("ﾊﾟﾝﾀﾛｳ"), kanaMatchKey("パンタロウ"));
});

test("normalize: NFKC is applied and a non-string is the empty string", () => {
  assert.equal(normalizeNfkc("０９０"), "090");
  for (const bad of [null, undefined, 42, {}]) assert.equal(normalizeNfkc(bad), "");
});

// ── legacy-column fallback (the key the DB derives from a row) ───────────────
// Mirrors the generated columns' coalesce chain: canonical parts first, legacy column second.

function rowNameKey(r: (typeof LEGACY_FALLBACK_VECTORS)[number]["row"]): string | null {
  const canonical = `${r.last_name ?? ""}${r.first_name ?? ""}`.trim();
  return nameMatchKey(canonical !== "" ? canonical : (r.name ?? ""));
}
function rowKanaKey(r: (typeof LEGACY_FALLBACK_VECTORS)[number]["row"]): string | null {
  const canonical = `${r.last_name_kana ?? ""}${r.first_name_kana ?? ""}`.trim();
  return kanaMatchKey(canonical !== "" ? canonical : (r.kana ?? ""));
}

for (const v of LEGACY_FALLBACK_VECTORS) {
  test(`legacy fallback — ${v.label}`, () => {
    assert.equal(rowNameKey(v.row), v.expectedName);
    assert.equal(rowKanaKey(v.row), v.expectedKana);
  });
}

test("legacy fallback: a pre-B2-B row and a post-B2-B row for the same person share both keys", () => {
  const legacy = LEGACY_FALLBACK_VECTORS.find((v) => v.label.startsWith("legacy only"))!;
  const canonical = LEGACY_FALLBACK_VECTORS.find((v) => v.label.startsWith("canonical only"))!;
  assert.equal(rowNameKey(legacy.row), rowNameKey(canonical.row));
  assert.equal(rowKanaKey(legacy.row), rowKanaKey(canonical.row));
});

// ── the two rules ────────────────────────────────────────────────────────────

test("plan: phone alone is enough", () => {
  const r = planDuplicateCheck({ phone: "090-1234-5678" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.keys.phoneKey, "09012345678");
    assert.equal(r.keys.nameKey, null);
  }
});

test("plan: name AND kana together are enough", () => {
  const r = planDuplicateCheck({ name: "山田 太郎", kana: "ﾔﾏﾀﾞﾀﾛｳ" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.keys.nameKey, "山田太郎");
    assert.equal(r.keys.kanaKey, "ヤマダタロウ");
    assert.equal(r.keys.phoneKey, null);
  }
});

test("plan: a name WITHOUT kana never fires — the rule the product forbids", () => {
  const r = planDuplicateCheck({ name: "山田太郎" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOT_APPLICABLE");
});

test("plan: kana without a name never fires either", () => {
  const r = planDuplicateCheck({ kana: "ヤマダタロウ" });
  assert.equal(r.ok, false);
});

test("plan: a too-short phone with no name/kana is NOT_APPLICABLE, never a short-key query", () => {
  const r = planDuplicateCheck({ phone: "03" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOT_APPLICABLE");
});

test("plan: address and email are not inputs at all", () => {
  const r = planDuplicateCheck({ name: "", kana: "", phone: "" } as Record<string, unknown>);
  assert.equal(r.ok, false, "nothing else can make the rule fire");
});

test("plan: name+kana carried only as a PAIR, so half the rule can never reach the filter", () => {
  const r = planDuplicateCheck({ name: "山田太郎", phone: "090-1234-5678" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.keys.nameKey, null, "name is dropped without kana");
    assert.equal(r.keys.kanaKey, null);
    assert.equal(r.keys.phoneKey, "09012345678");
  }
});

// ── filter construction ──────────────────────────────────────────────────────

test("quote: values are double-quoted with embedded quotes and backslashes escaped", () => {
  assert.equal(quoteFilterValue("ab"), '"ab"');
  assert.equal(quoteFilterValue('a"b'), '"a\\"b"');
  assert.equal(quoteFilterValue("a\\b"), '"a\\\\b"');
});

test("filter: both branches are EQUALITY, never ilike or a wildcard", () => {
  const f = buildDuplicateOrFilter({ phoneKey: "09012345678", nameKey: "山田太郎", kanaKey: "ヤマダタロウ" });
  assert.ok(f.includes('match_phone_digits.eq."09012345678"'));
  assert.ok(f.includes("and(match_name_norm.eq."), "name+kana is a nested AND");
  assert.ok(f.includes('match_kana_norm.eq."ヤマダタロウ")'));
  assert.equal(/ilike|like|%/.test(f), false, "no pattern matching anywhere");
});

test("filter: the name branch is a nested AND, so a name alone can never match", () => {
  const f = buildDuplicateOrFilter({ phoneKey: null, nameKey: "山田太郎", kanaKey: "ヤマダタロウ" });
  assert.match(f, /^and\(match_name_norm\.eq\..+,match_kana_norm\.eq\..+\)$/);
});

test("filter: a phone-only plan emits exactly one clause", () => {
  const f = buildDuplicateOrFilter({ phoneKey: "09012345678", nameKey: null, kanaKey: null });
  assert.equal(f, 'match_phone_digits.eq."09012345678"');
});

test("filter: a company name containing parentheses cannot become filter SYNTAX", () => {
  const f = buildDuplicateOrFilter({ phoneKey: null, nameKey: "株式会社(テスト)", kanaKey: "カブシキガイシャ" });
  assert.ok(f.includes('"株式会社(テスト)"'), "the value survives inside quotes");
});

test("select columns include `name` so the legacy display fallback can actually fire", () => {
  for (const col of ["id", "dealer_id", "last_name", "first_name", "name", "phone",
                     "match_phone_digits", "match_name_norm", "match_kana_norm"]) {
    assert.ok(DUPLICATE_SELECT_COLUMNS.includes(col), `missing ${col}`);
  }
});

// ── reason classification ────────────────────────────────────────────────────

test("reason: phone wins when both rules hold — the stronger signal is reported", () => {
  const keys = { phoneKey: "09012345678", nameKey: "山田太郎", kanaKey: "ヤマダタロウ" };
  const row = { match_phone_digits: "09012345678", match_name_norm: "山田太郎", match_kana_norm: "ヤマダタロウ" };
  assert.equal(classifyReason(row, keys), "phone");
});

test("reason: name_kana requires BOTH columns to agree", () => {
  const keys = { phoneKey: null, nameKey: "山田太郎", kanaKey: "ヤマダタロウ" };
  assert.equal(classifyReason({ match_name_norm: "山田太郎", match_kana_norm: "ヤマダタロウ" }, keys), "name_kana");
  assert.equal(classifyReason({ match_name_norm: "山田太郎", match_kana_norm: "ヤマダジロウ" }, keys), null);
});

test("reason: a row no rule explains is null, so the caller can drop it", () => {
  const keys = { phoneKey: "09012345678", nameKey: null, kanaKey: null };
  assert.equal(classifyReason({ match_phone_digits: "08000000000" }, keys), null);
});

// ── cap and truncation ───────────────────────────────────────────────────────

test("cap: FETCH_LIMIT is exactly one more than RESULT_CAP", () => {
  assert.equal(RESULT_CAP, 10);
  assert.equal(FETCH_LIMIT, 11);
});

test("cap: one row over the cap truncates VISIBLY — the property the 200-row helper lacked", () => {
  const rows = Array.from({ length: FETCH_LIMIT }, (_, i) => i);
  const r = applyCandidateCap(rows);
  assert.equal(r.rows.length, RESULT_CAP);
  assert.equal(r.truncated, true);
});

test("cap: at or below the cap is never reported as truncated", () => {
  assert.equal(applyCandidateCap(Array.from({ length: RESULT_CAP }, (_, i) => i)).truncated, false);
  assert.equal(applyCandidateCap([]).truncated, false);
});

// ── tenancy is not expressible here ──────────────────────────────────────────

test("core exposes no dealer parameter — tenancy cannot be decided in this module", () => {
  const src = String(planDuplicateCheck) + String(buildDuplicateOrFilter) + String(applyCandidateCap);
  assert.equal(/dealer/i.test(src), false, "no dealer id may enter the pure core");
});
