// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B1 (+R1) — delivery-date helper tests.
//
// Run: node --import tsx --test src/lib/invoices/invoice-delivery-date.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isValidCalendarDate,
  tokyoDateFromTimestamp,
  parseDeliveryDateField,
  parseDeliveryTimestampField,
  resolveDeliveryDate,
} from "./invoice-delivery-date";

test("1. isValidCalendarDate accepts a real YYYY-MM-DD date", () => {
  assert.equal(isValidCalendarDate("2026-08-04"), true);
  assert.equal(isValidCalendarDate("2024-02-29"), true); // leap year
});

test("2. isValidCalendarDate rejects malformed and impossible dates", () => {
  for (const bad of [
    "2026-02-30", "2026-13-01", "2026-00-10", "2026-08-00", "2025-02-29",
    "2026-8-4", "2026/08/04", "2026-08-04T00:00:00Z", "not-a-date", "", "  ",
  ]) {
    assert.equal(isValidCalendarDate(bad), false, `must reject ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, 20260804, {}, ["2026-08-04"]]) {
    assert.equal(isValidCalendarDate(bad), false, `must reject ${JSON.stringify(bad)}`);
  }
});

// ── tokyoDateFromTimestamp: STRICT ISO only ──────────────────────────────────

test("3. tokyoDateFromTimestamp accepts only strict timezone-qualified ISO timestamps", () => {
  assert.equal(tokyoDateFromTimestamp("2026-08-04T09:00:00Z"), "2026-08-04");
  assert.equal(tokyoDateFromTimestamp("2026-08-04T09:00:00.123Z"), "2026-08-04");
  assert.equal(tokyoDateFromTimestamp("2026-08-04T18:00:00+09:00"), "2026-08-04");
});

test("4. UTC day-boundary conversions land on the correct Tokyo calendar day", () => {
  // 2026-08-03T20:00:00Z → 2026-08-04T05:00 JST → 2026-08-04.
  assert.equal(tokyoDateFromTimestamp("2026-08-03T20:00:00Z"), "2026-08-04");
  // 2026-08-04T14:59:59Z → 2026-08-04T23:59 JST → still 2026-08-04.
  assert.equal(tokyoDateFromTimestamp("2026-08-04T14:59:59Z"), "2026-08-04");
  // 2026-08-04T15:00:00Z → 2026-08-05T00:00 JST → rolls to 2026-08-05.
  assert.equal(tokyoDateFromTimestamp("2026-08-04T15:00:00Z"), "2026-08-05");
});

test("5. tokyoDateFromTimestamp REJECTS locale, space-separated and timezone-less forms", () => {
  for (const bad of [
    "2026-08-04 12:00:00",     // space separator, no timezone
    "08/04/2026",              // locale date
    "08/04/2026 12:00:00",     // locale datetime
    "2026-08-04T12:00:00",     // ISO shape but NO timezone (ambiguous)
    "2026-08-04",              // date-only is not a timestamp
    "2026-08-04T12:00Z",       // missing seconds
    "garbage", "", "   ",
  ]) {
    assert.equal(tokyoDateFromTimestamp(bad), null, `must reject ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, 123, {}]) {
    assert.equal(tokyoDateFromTimestamp(bad as unknown), null, `must reject ${JSON.stringify(bad)}`);
  }
});

// ── tri-state field parsers ──────────────────────────────────────────────────

test("6. parseDeliveryDateField is absent for null/undefined/blank, valid for a real date, invalid otherwise", () => {
  assert.deepEqual(parseDeliveryDateField(null), { kind: "absent" });
  assert.deepEqual(parseDeliveryDateField(undefined), { kind: "absent" });
  assert.deepEqual(parseDeliveryDateField(""), { kind: "absent" });
  assert.deepEqual(parseDeliveryDateField("   "), { kind: "absent" });
  assert.deepEqual(parseDeliveryDateField("2026-08-04"), { kind: "valid", value: "2026-08-04" });
  for (const bad of ["2026-02-30", "2026/08/04", "2026-8-4", "nope", "2026-08-04T00:00:00Z"]) {
    assert.deepEqual(parseDeliveryDateField(bad), { kind: "invalid" }, bad);
  }
  // A non-string FormData value (e.g. a File-like object) is invalid, not absent.
  assert.deepEqual(parseDeliveryDateField({} as unknown), { kind: "invalid" });
});

test("7. parseDeliveryTimestampField mirrors the strict timestamp rule as a tri-state", () => {
  assert.deepEqual(parseDeliveryTimestampField(null), { kind: "absent" });
  assert.deepEqual(parseDeliveryTimestampField(""), { kind: "absent" });
  assert.deepEqual(parseDeliveryTimestampField("2026-08-03T20:00:00Z"), { kind: "valid", value: "2026-08-04" });
  for (const bad of ["2026-08-04 12:00:00", "2026-08-04T12:00:00", "08/04/2026", "garbage"]) {
    assert.deepEqual(parseDeliveryTimestampField(bad), { kind: "invalid" }, bad);
  }
});

// ── resolveDeliveryDate: fail-closed precedence ──────────────────────────────

test("8. a present-but-INVALID manual value fails closed and never falls through", () => {
  // The core R1 defect: an invalid manual date must NOT be silently replaced by report_date.
  const r = resolveDeliveryDate({
    manual: "2026-02-30",
    reportDate: "2026-08-02",
    actualEndAt: "2026-08-03T20:00:00Z",
  });
  assert.deepEqual(r, { kind: "invalid" });
});

test("9. a valid manual value wins over every lower source", () => {
  assert.deepEqual(
    resolveDeliveryDate({ manual: "2026-08-01", reportDate: "2026-08-02", actualEndAt: "2026-08-03T09:00:00Z" }),
    { kind: "resolved", value: "2026-08-01" }
  );
});

test("10. an ABSENT (blank) manual value may proceed to report_date", () => {
  assert.deepEqual(
    resolveDeliveryDate({ manual: "", reportDate: "2026-08-02", actualEndAt: "2026-08-03T09:00:00Z" }),
    { kind: "resolved", value: "2026-08-02" }
  );
  assert.deepEqual(
    resolveDeliveryDate({ manual: null, reportDate: "2026-08-02" }),
    { kind: "resolved", value: "2026-08-02" }
  );
});

test("11. a present-but-INVALID report_date fails closed rather than proceeding to actual_end_at", () => {
  const r = resolveDeliveryDate({ manual: null, reportDate: "2026-13-99", actualEndAt: "2026-08-03T20:00:00Z" });
  assert.deepEqual(r, { kind: "invalid" });
});

test("12. an absent report_date proceeds to the work-order Tokyo date, incl. UTC boundary", () => {
  assert.deepEqual(
    resolveDeliveryDate({ actualEndAt: "2026-08-03T20:00:00Z" }),
    { kind: "resolved", value: "2026-08-04" }
  );
});

test("13. a missing valid source resolves to null (draft stays without a delivery date)", () => {
  assert.deepEqual(resolveDeliveryDate({}), { kind: "resolved", value: null });
  assert.deepEqual(
    resolveDeliveryDate({ manual: null, reportDate: null, actualEndAt: null }),
    { kind: "resolved", value: null }
  );
  assert.deepEqual(
    resolveDeliveryDate({ manual: "", reportDate: "", actualEndAt: "" }),
    { kind: "resolved", value: null }
  );
});

test("14. issue_date is never an input — the source type offers no such field", () => {
  // Documents the contract: there is no way to feed issue_date in, so it can never be a fallback.
  assert.deepEqual(resolveDeliveryDate({ manual: null, reportDate: null, actualEndAt: null }),
    { kind: "resolved", value: null });
});
