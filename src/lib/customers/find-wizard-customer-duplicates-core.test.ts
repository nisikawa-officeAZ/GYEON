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

// ── B2-D.13: an exact FULL NAME alone is now a rule ─────────────────────────

test("plan: an exact full name WITHOUT kana is applicable", () => {
  const r = planDuplicateCheck({ name: "山田太郎" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.keys.nameKey, "山田太郎");
    assert.equal(r.keys.kanaKey, null, "no kana was entered");
    assert.equal(r.keys.phoneKey, null);
  }
});

test("plan: kana WITHOUT a name is still not a rule — kana alone identifies nobody", () => {
  const r = planDuplicateCheck({ kana: "ヤマダタロウ" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOT_APPLICABLE");
});

test("plan: the name key is carried even when kana is absent", () => {
  const r = planDuplicateCheck({ name: "山田 太郎", phone: "03" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.keys.nameKey, "山田太郎", "normalised, whitespace removed");
    assert.equal(r.keys.phoneKey, null, "a 2-digit phone yields no key");
  }
});

test("plan: NOT_APPLICABLE only when neither a phone key nor a name key exists", () => {
  for (const raw of [{}, { name: "  " }, { kana: "ヤマダ" }, { phone: "03" }, { name: "", kana: "ヤマダ", phone: "090" }]) {
    const r = planDuplicateCheck(raw);
    assert.equal(r.ok, false, JSON.stringify(raw));
  }
});

test("full-name rule is EXACT identity — a surname or partial can never equal the whole name", () => {
  const whole = nameMatchKey("山田太郎");
  for (const partial of ["山田", "太郎", "山田太", "田太郎", "山"]) {
    assert.notEqual(nameMatchKey(partial), whole, `partial ${partial} must not equal the full name`);
  }
});

test("surname / partial entry never MATCHES a longer full name", () => {
  // A surname typed alone is still a full name from the system's point of view — it produces a key
  // and therefore a branch. What it must never do is match a customer whose whole name is LONGER.
  // That is the difference between full-name equality and surname matching, and it is the property
  // the product rule actually forbids.
  const stored = { match_name_norm: "山田太郎", match_kana_norm: "ヤマダタロウ" };
  for (const partial of ["山田", "太郎", "山田太", "田太郎"]) {
    const r = planDuplicateCheck({ name: partial });
    assert.equal(r.ok, true, `${partial} still forms a plan`);
    if (r.ok) {
      assert.equal(classifyReason(stored, r.keys), null,
        `entering "${partial}" must not match the customer named 山田太郎`);
    }
  }
});

test("a non-exact name never matches: one differing character is a different customer", () => {
  const stored = { match_name_norm: "山田太郎" };
  const r = planDuplicateCheck({ name: "山田太朗" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(classifyReason(stored, r.keys), null);
});

test("filter: a name-only plan emits an exact equality on match_name_norm", () => {
  const f = buildDuplicateOrFilter({ phoneKey: null, nameKey: "山田太郎", kanaKey: null });
  assert.equal(f, 'match_name_norm.eq."山田太郎"');
  assert.equal(/ilike|like|%|\*/.test(f), false, "no wildcard or pattern matching");
});

test("filter: with kana present BOTH the nested pair and the name-only clause are emitted", () => {
  const f = buildDuplicateOrFilter({ phoneKey: null, nameKey: "山田太郎", kanaKey: "ヤマダタロウ" });
  assert.ok(f.includes("and(match_name_norm.eq."), "nested pair preserved");
  assert.ok(f.includes('match_kana_norm.eq."ヤマダタロウ")'));
  assert.ok(f.split(",").some((c) => c === 'match_name_norm.eq."山田太郎"'),
    "a top-level name-only clause is also emitted, so a differing-kana row is still retrieved");
  assert.equal(/ilike|like|%/.test(f), false);
});

test("reason: a matching name with a DIFFERENT kana is reported as name-only, not dropped", () => {
  const keys = { phoneKey: null, nameKey: "山田太郎", kanaKey: "ヤマダタロウ" };
  const row = { match_name_norm: "山田太郎", match_kana_norm: "ヤマダジロウ" };
  assert.equal(classifyReason(row, keys), "name");
});

test("reason: name-only when no kana was entered at all", () => {
  const keys = { phoneKey: null, nameKey: "山田太郎", kanaKey: null };
  assert.equal(classifyReason({ match_name_norm: "山田太郎", match_kana_norm: "ヤマダタロウ" }, keys), "name");
});

test("reason precedence is phone > name_kana > name", () => {
  const keys = { phoneKey: "09012345678", nameKey: "山田太郎", kanaKey: "ヤマダタロウ" };
  const all = { match_phone_digits: "09012345678", match_name_norm: "山田太郎", match_kana_norm: "ヤマダタロウ" };
  assert.equal(classifyReason(all, keys), "phone", "phone outranks both name rules");
  assert.equal(classifyReason({ ...all, match_phone_digits: "08000000000" }, keys), "name_kana",
    "name+kana outranks name-only");
  assert.equal(classifyReason({ ...all, match_phone_digits: "08000000000", match_kana_norm: "チガウ" }, keys), "name",
    "name-only is the fallback");
});

test("reason: a row whose name does NOT match is still null — no rule invented for it", () => {
  const keys = { phoneKey: null, nameKey: "山田太郎", kanaKey: null };
  assert.equal(classifyReason({ match_name_norm: "鈴木一郎" }, keys), null);
});

test("OCR needs no bypass: a name-only input plans and filters identically however it was typed", () => {
  // Step 1 feeds the SAME invoker in every regMethod except "search"; the core has no entry mode.
  const manual = planDuplicateCheck({ name: "山田太郎", kana: "", phone: "" });
  const ocr = planDuplicateCheck({ name: "山田太郎" });
  assert.deepEqual(manual, ocr, "no per-mode branch exists in the core");
  if (manual.ok && ocr.ok) {
    assert.equal(buildDuplicateOrFilter(manual.keys), buildDuplicateOrFilter(ocr.keys));
  }
});

test("plan: a too-short phone with no name/kana is NOT_APPLICABLE, never a short-key query", () => {
  const r = planDuplicateCheck({ phone: "03" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NOT_APPLICABLE");
});

test("plan: address and email are not inputs at all", () => {
  const r = planDuplicateCheck({ name: "", kana: "", phone: "" } as Record<string, unknown>);
  assert.equal(r.ok, false, "nothing else can make a rule fire");
});

test("plan: kana is never carried without a name, but a name IS carried without kana", () => {
  const r = planDuplicateCheck({ name: "山田太郎", phone: "090-1234-5678" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.keys.nameKey, "山田太郎", "the full-name rule stands on its own");
    assert.equal(r.keys.kanaKey, null, "no kana was entered");
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

test("filter: the name+kana pair is still expressed as a nested AND, not two loose clauses", () => {
  const f = buildDuplicateOrFilter({ phoneKey: null, nameKey: "山田太郎", kanaKey: "ヤマダタロウ" });
  assert.match(f, /^and\(match_name_norm\.eq\..+,match_kana_norm\.eq\..+\)/,
    "the pair remains one nested clause so kana can never be dropped from it");
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

test("reason: name_kana needs both columns; a differing kana falls back to name, never to nothing", () => {
  // Both halves of the precedence contract, asserted together:
  //   same name + same kana      → "name_kana", the stronger of the two name rules;
  //   same name + DIFFERING kana → "name",      the full-name rule still holds on its own.
  // The second case used to expect null, under the pre-B2-D.13 rule that a name without an agreeing
  // kana was not a candidate at all. Exact full-name equality is now independently sufficient, so
  // dropping that row would hide a real duplicate rather than avoid a false one.
  const keys = { phoneKey: null, nameKey: "山田太郎", kanaKey: "ヤマダタロウ" };
  assert.equal(classifyReason({ match_name_norm: "山田太郎", match_kana_norm: "ヤマダタロウ" }, keys), "name_kana");
  assert.equal(classifyReason({ match_name_norm: "山田太郎", match_kana_norm: "ヤマダジロウ" }, keys), "name");
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
