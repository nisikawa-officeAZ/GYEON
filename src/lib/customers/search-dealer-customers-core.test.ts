// B2.2B — unit tests for the pure dealer customer-search core (no DB, no mocks).
// Run: node --import tsx --test src/lib/customers/search-dealer-customers-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_TERM_LENGTH,
  RESULT_CAP,
  FETCH_LIMIT,
  CUSTOMER_SEARCH_ORDER,
  CUSTOMER_TEXT_COLUMNS,
  normalizeSearchTerm,
  escapeLikeWildcards,
  isPlateLastFourTerm,
  quoteFilterValue,
  buildCustomerOrFilter,
  plateSuffixCandidates,
  plateLastFourMatches,
  toAsciiDigits,
  digitsOnly,
  planCustomerSearch,
  applyResultCap,
} from "./search-dealer-customers-core";

// ── normalisation ────────────────────────────────────────────────────────────

test("normalize: trims and collapses internal whitespace", () => {
  assert.equal(normalizeSearchTerm("  山田  太郎  "), "山田 太郎");
  assert.equal(normalizeSearchTerm("\t090\n1234\t"), "090 1234");
});

test("normalize: a non-string is the empty string, never a throw", () => {
  for (const bad of [null, undefined, 42, {}, [], true]) {
    assert.equal(normalizeSearchTerm(bad), "");
  }
});

// ── short / blank refusal ────────────────────────────────────────────────────

test("plan: blank and whitespace-only terms are refused before any query", () => {
  for (const t of ["", "   ", "\t\n", null, undefined]) {
    const r = planCustomerSearch(t);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "QUERY_TOO_SHORT");
  }
});

test("plan: a term shorter than MIN_TERM_LENGTH is refused; exactly MIN is accepted", () => {
  assert.equal(MIN_TERM_LENGTH, 2);
  const short = planCustomerSearch("山");
  assert.equal(short.ok, false);
  const ok = planCustomerSearch("山田");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.plan.term, "山田");
});

// ── wildcard escaping ────────────────────────────────────────────────────────

test("escape: % and _ become literals, backslash is escaped first", () => {
  assert.equal(escapeLikeWildcards("100%"), "100\\%");
  assert.equal(escapeLikeWildcards("a_b"), "a\\_b");
  assert.equal(escapeLikeWildcards("a\\b"), "a\\\\b");
  // backslash-first ordering: the escapes this function adds are not re-escaped
  assert.equal(escapeLikeWildcards("\\%"), "\\\\\\%");
});

test("plan: a wildcard term is searchable and carries an escaped body", () => {
  const r = planCustomerSearch("50%");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.plan.term, "50%");
    assert.equal(r.plan.likeBody, "50\\%");
    assert.equal(r.plan.plateLastFour, null, "a wildcard term is not a plate term");
  }
});

// ── plate branching ──────────────────────────────────────────────────────────

test("plate: exactly four ASCII digits takes the plate branch", () => {
  assert.equal(isPlateLastFourTerm("1234"), true);
  const r = planCustomerSearch("1234");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.plateLastFour, "1234");
});

test("plate: five digits does NOT take the plate branch", () => {
  assert.equal(isPlateLastFourTerm("12345"), false);
  const r = planCustomerSearch("12345");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.plateLastFour, null);
});

test("plate: three digits and mixed content never take the plate branch", () => {
  for (const t of ["123", "12 34", "12a4", "-234"]) {
    assert.equal(isPlateLastFourTerm(normalizeSearchTerm(t)), false, `term ${JSON.stringify(t)}`);
  }
});

// ── B2.2C: full-width digits ─────────────────────────────────────────────────

test("width: full-width digits map to ASCII", () => {
  assert.equal(toAsciiDigits("１２３４"), "1234");
  assert.equal(toAsciiDigits("滋賀３３０に１２３４"), "滋賀330に1234");
  assert.equal(digitsOnly("滋賀 ３３０ に １２３４"), "3301234");
});

test("plate: full-width １２３４ takes the SAME branch as ASCII 1234", () => {
  assert.equal(isPlateLastFourTerm("１２３４"), true);
  const fw = planCustomerSearch("１２３４");
  const ascii = planCustomerSearch("1234");
  assert.equal(fw.ok && ascii.ok, true);
  if (fw.ok && ascii.ok) {
    assert.equal(fw.plan.plateLastFour, "1234", "normalised to ASCII for the rest of the pipeline");
    assert.equal(fw.plan.plateLastFour, ascii.plan.plateLastFour);
  }
});

test("plate: surrounding whitespace does not defeat the branch", () => {
  for (const t of ["  1234  ", "\t１２３４\n"]) {
    const r = planCustomerSearch(t);
    assert.equal(r.ok, true, `term ${JSON.stringify(t)}`);
    if (r.ok) assert.equal(r.plan.plateLastFour, "1234");
  }
});

test("plate: five digits are rejected in BOTH widths", () => {
  for (const t of ["12345", "１２３４５"]) {
    assert.equal(isPlateLastFourTerm(t), false, `term ${JSON.stringify(t)}`);
    const r = planCustomerSearch(t);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.plan.plateLastFour, null);
  }
});

test("plate: non-numeric terms are rejected", () => {
  for (const t of ["abcd", "１２ab", "山田太郎", "12-34"]) {
    assert.equal(isPlateLastFourTerm(t), false, `term ${JSON.stringify(t)}`);
  }
});

// ── B2.2C: stored-plate final-four verification ──────────────────────────────

test("plate pre-filter: both widths are offered as suffix candidates, anchored to the END", () => {
  const c = plateSuffixCandidates("1234");
  assert.ok(c.includes("%1234"));
  assert.ok(c.includes("%１２３４"));
  assert.ok(c.every((p) => p.startsWith("%") && !p.endsWith("%")), "no trailing wildcard");
});

test("stored plate: the FINAL four numeric digits must equal the query", () => {
  for (const stored of ["滋賀 330 に 1234", "滋賀330に1234", "滋賀 ３３０ に １２３４", " 1234 "]) {
    assert.equal(plateLastFourMatches(stored, "1234"), true, `stored ${JSON.stringify(stored)}`);
  }
});

test("stored plate: digits occurring elsewhere are NOT a match", () => {
  // 1234 appears, but the plate does not END with it — the exact case a suffix-only match misses.
  assert.equal(plateLastFourMatches("品川 123 あ 12345", "1234"), false);
  assert.equal(plateLastFourMatches("1234 5678", "1234"), false);
  assert.equal(plateLastFourMatches("練馬 1234 の 9999", "1234"), false);
});

test("stored plate: too few digits, blanks and non-strings never match", () => {
  for (const bad of ["", "   ", "あ", "12", null, undefined, 1234, {}]) {
    assert.equal(plateLastFourMatches(bad, "1234"), false, `stored ${JSON.stringify(bad)}`);
  }
});

// ── filter construction ──────────────────────────────────────────────────────

test("quote: values are double-quoted with embedded quotes and backslashes escaped", () => {
  assert.equal(quoteFilterValue("ab"), '"ab"');
  assert.equal(quoteFilterValue('a"b'), '"a\\"b"');
  assert.equal(quoteFilterValue("a\\b"), '"a\\\\b"');
});

test("or-filter: covers every declared text column and quotes the pattern", () => {
  const f = buildCustomerOrFilter("yama");
  for (const col of CUSTOMER_TEXT_COLUMNS) {
    assert.ok(f.includes(`${col}.ilike."%yama%"`), `missing column ${col}`);
  }
  assert.ok(!f.includes("id.in."), "no plate clause when no ids are supplied");
});

test("or-filter: a comma or parenthesis in the term cannot become filter SYNTAX", () => {
  const f = buildCustomerOrFilter("a,b(c)");
  // the term survives inside quotes rather than splitting the or-expression
  assert.ok(f.includes('"%a,b(c)%"'));
  // one clause per text column, and the commas inside the quoted value do not add clauses
  assert.equal(f.split(".ilike.").length - 1, CUSTOMER_TEXT_COLUMNS.length);
});

test("or-filter: plate-resolved ids are folded in as a single id.in clause", () => {
  const f = buildCustomerOrFilter("1234", ["id-1", "id-2"]);
  assert.ok(f.includes("id.in.(id-1,id-2)"));
});

// ── cap and truncation ───────────────────────────────────────────────────────

test("cap: FETCH_LIMIT is exactly one more than RESULT_CAP", () => {
  assert.equal(RESULT_CAP, 50);
  assert.equal(FETCH_LIMIT, 51);
});

test("cap: at or below the cap is never reported as truncated", () => {
  const rows = Array.from({ length: RESULT_CAP }, (_, i) => i);
  const r = applyResultCap(rows);
  assert.equal(r.rows.length, RESULT_CAP);
  assert.equal(r.truncated, false);
});

test("cap: one row over the cap truncates and discards the surplus", () => {
  const rows = Array.from({ length: FETCH_LIMIT }, (_, i) => i);
  const r = applyResultCap(rows);
  assert.equal(r.rows.length, RESULT_CAP);
  assert.equal(r.truncated, true);
  assert.equal(r.rows[r.rows.length - 1], RESULT_CAP - 1, "the extra row is dropped, not shown");
});

test("cap: an empty result is not truncated", () => {
  const r = applyResultCap([]);
  assert.deepEqual(r.rows, []);
  assert.equal(r.truncated, false);
});

// ── ordering contract ────────────────────────────────────────────────────────

test("order: kana, then family name, then id as the final tie-break", () => {
  assert.deepEqual(
    CUSTOMER_SEARCH_ORDER.map((o) => o.column),
    ["last_name_kana", "last_name", "id"],
  );
  assert.ok(CUSTOMER_SEARCH_ORDER.every((o) => o.ascending === true));
  assert.ok(
    CUSTOMER_SEARCH_ORDER.every((o) => o.nullsFirst === false),
    "NULL kana must sort last, not first",
  );
});

test("order: the tie-break is id, so the sequence cannot depend on insertion order", () => {
  assert.equal(CUSTOMER_SEARCH_ORDER[CUSTOMER_SEARCH_ORDER.length - 1].column, "id");
});

// ── tenancy is not expressible here ──────────────────────────────────────────

test("core exposes no dealer parameter — tenancy cannot be decided in this module", () => {
  const src = String(planCustomerSearch) + String(buildCustomerOrFilter) + String(applyResultCap);
  assert.equal(/dealer/i.test(src), false, "no dealer id may enter the pure core");
});
