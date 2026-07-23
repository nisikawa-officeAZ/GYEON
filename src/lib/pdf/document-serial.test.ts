import { test } from "node:test";
import assert from "node:assert/strict";

import { formatDocumentSerial } from "./document-serial";

test("canonical EST conversion", () => {
  assert.equal(formatDocumentSerial("EST-2026-00012"), "EST/2026/00012");
});

test("canonical CRT/CO conversion (slashed prefix preserved)", () => {
  assert.equal(formatDocumentSerial("CRT/CO-2026-00012"), "CRT/CO/2026/00012");
});

test("already-slashed value passes through unchanged", () => {
  assert.equal(formatDocumentSerial("EST/2026/00012"), "EST/2026/00012");
});

test("unexpected shapes pass through unchanged", () => {
  assert.equal(formatDocumentSerial("SOME-RANDOM-THING"), "SOME-RANDOM-THING");
  assert.equal(formatDocumentSerial("AB-12-3"), "AB-12-3");
});

test("null / empty / whitespace return empty string", () => {
  assert.equal(formatDocumentSerial(null), "");
  assert.equal(formatDocumentSerial(undefined), "");
  assert.equal(formatDocumentSerial(""), "");
  assert.equal(formatDocumentSerial("   "), "");
});
