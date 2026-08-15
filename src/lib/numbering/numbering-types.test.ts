// EW-UI-5A1-B7-0P — canonical document-number format + Asia/Tokyo clock.
//
// Run: node --import tsx --test src/lib/numbering/numbering-types.test.ts
//
// Pure module: no Supabase, no database, no network, no module mocks, no host-timezone dependency.
// Every clock assertion pins an absolute UTC instant, so the results are identical regardless of the
// machine's TZ — which is itself part of the contract under test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  formatDocumentNumber,
  computeFiscalYear,
  defaultPrefix,
  defaultResetPolicy,
  sequenceTypeLabel,
  DOCUMENT_NUMBER_TIME_ZONE,
  type DocumentResetPolicy,
  type DocumentSequenceType,
} from "./numbering-types";

const SRC = "src/lib/numbering/numbering-types.ts";

// ─── 1. The six canonical prefix × reset-policy examples (padding 5) ─────────
// fiscalYear encodes the policy: 0 = never, YYYY = yearly, YYYYMM = monthly.

const CANONICAL: Array<[string, string, number, string]> = [
  // prefix, policy label,  fiscalYear, expected
  ["",    "never",   0,      "00001"],
  ["",    "yearly",  2026,   "2026-00001"],
  ["",    "monthly", 202607, "2026-07-00001"],
  ["EST", "never",   0,      "EST-00001"],
  ["EST", "yearly",  2026,   "EST-2026-00001"],
  ["EST", "monthly", 202607, "EST-2026-07-00001"],
];

for (const [prefix, policy, fiscalYear, expected] of CANONICAL) {
  test(`format: prefix="${prefix}" policy=${policy} → ${expected}`, () => {
    assert.equal(formatDocumentNumber(prefix, 1, 5, fiscalYear), expected);
  });
}

// ─── 2. The regression this phase exists for ────────────────────────────────

test("a blank prefix never duplicates the sequence number (the old defect)", () => {
  const out = formatDocumentNumber("", 1, 5, 0);
  assert.equal(out, "00001");
  assert.equal(out, "0000100001".slice(0, 0) + "00001", "not the doubled form");
  assert.equal(/^(\d+)\1$/.test(out), false, "the padded number appears exactly once");
});

test("no leading, trailing or doubled hyphens in any combination", () => {
  const prefixes = ["", "EST", "A"];
  const years    = [0, 2026, 202607];
  const paddings = [1, 3, 5, 10];
  for (const p of prefixes) {
    for (const y of years) {
      for (const pad of paddings) {
        const out = formatDocumentNumber(p, 7, pad, y);
        assert.equal(out.startsWith("-"), false, `leading hyphen: ${out}`);
        assert.equal(out.endsWith("-"), false, `trailing hyphen: ${out}`);
        assert.equal(out.includes("--"), false, `doubled hyphen: ${out}`);
      }
    }
  }
});

// ─── 3. Padding semantics preserved ─────────────────────────────────────────

test("padding pads to width and never truncates a longer number", () => {
  assert.equal(formatDocumentNumber("EST", 1, 5, 0), "EST-00001");
  assert.equal(formatDocumentNumber("EST", 42, 5, 0), "EST-00042");
  assert.equal(formatDocumentNumber("EST", 1, 1, 0), "EST-1");
  assert.equal(formatDocumentNumber("EST", 123456, 5, 0), "EST-123456", "never truncated");
  assert.equal(formatDocumentNumber("EST", 1, 10, 0), "EST-0000000001");
});

test("existing non-empty-prefix output is unchanged from the previous implementation", () => {
  // These three were already correct before this phase and must not move.
  assert.equal(formatDocumentNumber("EST", 1, 5, 2026), "EST-2026-00001");
  assert.equal(formatDocumentNumber("EST", 1, 5, 0), "EST-00001");
  assert.equal(formatDocumentNumber("EST", 1, 5, 202606), "EST-2026-06-00001");
});

test("stored prefixes are used exactly as given — no trim, no default", () => {
  assert.equal(formatDocumentNumber(" ", 1, 5, 0), " -00001", "whitespace prefix is not trimmed");
  assert.equal(formatDocumentNumber("x-y", 1, 5, 0), "x-y-00001", "inner hyphen preserved");
});

test("monthly zero-pads a single-digit month", () => {
  assert.equal(formatDocumentNumber("EST", 1, 5, 202601), "EST-2026-01-00001");
  assert.equal(formatDocumentNumber("", 1, 5, 202612), "2026-12-00001");
});

// ─── 4. defaultPrefix is untouched ──────────────────────────────────────────

test("defaultPrefix still maps every sequence type", () => {
  const expected: Record<DocumentSequenceType, string> = {
    estimate: "EST", work_order: "WO", completion_report: "REP", invoice: "INV",
    payment: "PAY", maintenance_reminder: "MNT", product_order: "PO", reservation: "RSV",
    monthly_invoice: "MIV",
  };
  for (const [type, prefix] of Object.entries(expected)) {
    assert.equal(defaultPrefix(type as DocumentSequenceType), prefix);
  }
});

// ─── 5. "never" always returns 0 ────────────────────────────────────────────

test('"never" returns 0 for every instant', () => {
  for (const iso of [
    "2025-12-31T14:59:59.999Z", "2025-12-31T15:00:00.000Z",
    "2026-07-20T00:00:00.000Z", "1999-01-01T00:00:00.000Z",
  ]) {
    assert.equal(computeFiscalYear("never", new Date(iso)), 0, iso);
  }
  assert.equal(computeFiscalYear("never"), 0, "also with the default clock");
});

// ─── 6. JST year boundary (UTC+9) ───────────────────────────────────────────

test("JST year boundary: 2025-12-31T14:59:59.999Z is still 2025 in Tokyo", () => {
  const d = new Date("2025-12-31T14:59:59.999Z");   // 23:59:59.999 JST, 31 Dec
  assert.equal(computeFiscalYear("yearly", d), 2025);
  assert.equal(computeFiscalYear("monthly", d), 202512);
});

test("JST year boundary: 2025-12-31T15:00:00.000Z is already 2026 in Tokyo", () => {
  const d = new Date("2025-12-31T15:00:00.000Z");   // 00:00:00 JST, 1 Jan
  assert.equal(computeFiscalYear("yearly", d), 2026);
  assert.equal(computeFiscalYear("monthly", d), 202601);
});

// ─── 7. JST month boundary ──────────────────────────────────────────────────

test("JST month boundary: 2026-01-31T14:59:59.999Z is still 202601", () => {
  assert.equal(computeFiscalYear("monthly", new Date("2026-01-31T14:59:59.999Z")), 202601);
});

test("JST month boundary: 2026-01-31T15:00:00.000Z is already 202602", () => {
  assert.equal(computeFiscalYear("monthly", new Date("2026-01-31T15:00:00.000Z")), 202602);
});

test("the yearly value does not move across a month boundary", () => {
  assert.equal(computeFiscalYear("yearly", new Date("2026-01-31T15:00:00.000Z")), 2026);
});

// ─── 8. The result is independent of the host timezone ──────────────────────

test("computeFiscalYear is unaffected by the ambient TZ", () => {
  // The instant is absolute; only the module's explicit Asia/Tokyo conversion may decide the answer.
  const boundary = new Date("2025-12-31T15:00:00.000Z");
  const first = computeFiscalYear("monthly", boundary);
  const saved = process.env.TZ;
  try {
    // Mutating TZ after Date/Intl are initialised must not change an already-explicit conversion.
    process.env.TZ = "America/Los_Angeles";
    assert.equal(computeFiscalYear("monthly", boundary), first, "TZ must not influence the result");
    process.env.TZ = "UTC";
    assert.equal(computeFiscalYear("monthly", boundary), first, "TZ must not influence the result");
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
  assert.equal(first, 202601);
});

test("the canonical timezone constant is exported and is Asia/Tokyo", () => {
  assert.equal(DOCUMENT_NUMBER_TIME_ZONE, "Asia/Tokyo");
});

// ─── 9. Source-boundary: no host-local clock reads ──────────────────────────

test("the implementation reads no host-local date component and no process.env.TZ", () => {
  const code = readFileSync(SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.equal(/\.getFullYear\s*\(/.test(code), false, "no host-local getFullYear()");
  assert.equal(/\.getMonth\s*\(/.test(code), false, "no host-local getMonth()");
  assert.equal(/\.getDate\s*\(/.test(code), false, "no host-local getDate()");
  assert.equal(/process\.env/.test(code), false, "no process.env dependency (incl. TZ)");
  assert.match(code, /timeZone:\s*DOCUMENT_NUMBER_TIME_ZONE/, "converts through the explicit zone");
  assert.match(code, /"Asia\/Tokyo"/, "the canonical zone is named exactly once, as a constant");
});

test("the formatter no longer contains the doubling replace", () => {
  const code = readFileSync(SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.equal(/replace\(\/\^-\/,\s*numStr\)/.test(code), false, "the defective branch is gone");
  assert.match(code, /segments\.join\("-"\)/, "output is assembled from segments");
});

// ─── 10. Exhaustiveness over the policy union ───────────────────────────────

test("every DocumentResetPolicy is handled", () => {
  const policies: DocumentResetPolicy[] = ["never", "yearly", "monthly"];
  const d = new Date("2026-07-20T03:00:00.000Z");   // 12:00 JST
  const got = policies.map((p) => computeFiscalYear(p, d));
  assert.deepEqual(got, [0, 2026, 202607]);
  for (const v of got) assert.equal(Number.isSafeInteger(v), true);
});

// ─── MONTHLY-DATA-B2: the monthly_invoice sequence type ──────────────────────

test("monthly_invoice: MIV prefix, Japanese label, monthly reset formatting", () => {
  assert.equal(defaultPrefix("monthly_invoice"), "MIV");
  assert.equal(sequenceTypeLabel("monthly_invoice"), "月次請求書");
  // MIV-2026-08-00001 (monthly reset: fiscalYear = YYYYMM).
  assert.equal(formatDocumentNumber("MIV", 1, 5, 202608), "MIV-2026-08-00001");
  // The Asia/Tokyo clock produces YYYYMM for a monthly reset.
  const d = new Date("2026-08-03T20:00:00.000Z"); // 05:00 JST next day
  assert.equal(computeFiscalYear("monthly", d), 202608);
});

test("defaultResetPolicy: only monthly_invoice defaults to monthly; every existing type stays never", () => {
  assert.equal(defaultResetPolicy("monthly_invoice"), "monthly");
  const existing: DocumentSequenceType[] = [
    "estimate", "work_order", "completion_report", "invoice",
    "payment", "maintenance_reminder", "product_order", "reservation",
  ];
  for (const t of existing) {
    assert.equal(defaultResetPolicy(t), "never", `${t} must keep the never default`);
  }
});

test("every existing sequence type retains its prefix and label", () => {
  const expected: Record<string, [string, string]> = {
    estimate: ["EST", "見積書"], work_order: ["WO", "作業指示書"],
    completion_report: ["REP", "作業完了報告"], invoice: ["INV", "請求書"],
    payment: ["PAY", "入金"], maintenance_reminder: ["MNT", "メンテナンス通知"],
    product_order: ["PO", "商品注文"], reservation: ["RSV", "予約"],
  };
  for (const [t, [pfx, label]] of Object.entries(expected)) {
    assert.equal(defaultPrefix(t as DocumentSequenceType), pfx);
    assert.equal(sequenceTypeLabel(t as DocumentSequenceType), label);
  }
});
