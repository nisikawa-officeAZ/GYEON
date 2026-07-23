import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeNextPath } from "./sanitize-next-path";

// The input is the value returned by useSearchParams().get("next") — i.e. ALREADY transport-decoded.
// sanitizeNextPath must return valid internal path+query byte-for-byte (no further decoding), and fall
// back to "/" for absent, external, or malformed input.

// Valid internal destinations must be preserved EXACTLY, including their percent-encoding. If any of
// these were decoded again, %2F/%26/%23/%252F would corrupt path segments, query boundaries, or add a
// fragment — the R86B-D1 defect. Byte-for-byte equality is the regression guard.
const PRESERVE = [
  "/estimates/new?filter=%2Fvip",
  "/estimates/new?note=%26admin%3D1",
  "/estimates/new?anchor=%23summary",
  "/files/a%2Fb",
  "/search?q=%252F",
  "/admin/dev-preview/estimate-wizard",
  "/estimates/new?tab=1",
];

for (const input of PRESERVE) {
  test(`preserves ${JSON.stringify(input)} byte-for-byte`, () => {
    assert.equal(sanitizeNextPath(input), input);
  });
}

// Control-character inputs are constructed via fromCharCode so no literal control byte appears in this
// source file: U+000A (newline) and U+007F (delete).
const NEWLINE = "/foo" + String.fromCharCode(0x0a) + "bar";
const DEL = "/foo" + String.fromCharCode(0x7f) + "bar";

// Absent, external, or malformed values must all fall back to the default route.
const REJECT: Array<readonly [string, string | null]> = [
  ["null", null],
  ["empty string", ""],
  ["protocol-relative //evil.com", "//evil.com"],
  ["absolute http URL", "http://evil.com"],
  ["backslash form /\\evil", "/\\evil"],
  ["still-encoded %2F%2Fevil", "%2F%2Fevil"],
  ["scheme-like /javascript:alert(1)", "/javascript:alert(1)"],
  ["literal newline control char", NEWLINE],
  ["U+007F delete char", DEL],
];

for (const [label, input] of REJECT) {
  test(`rejects ${label} -> "/"`, () => {
    assert.equal(sanitizeNextPath(input), "/");
  });
}
