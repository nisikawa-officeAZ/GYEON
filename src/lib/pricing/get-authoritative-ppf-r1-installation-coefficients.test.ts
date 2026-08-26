import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SOURCE = readFileSync(
  join(process.cwd(), "src/lib/pricing/get-authoritative-ppf-r1-installation-coefficients.ts"),
  "utf8",
);
const RUNTIME = readFileSync(
  join(process.cwd(), "src/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer.ts"),
  "utf8",
);

test("coefficient read derives dealer scope and reads only global child products plus same-dealer overrides", () => {
  assert.match(SOURCE, /getCurrentDealer\(\)/);
  assert.match(SOURCE, /\.eq\("kind", "ppf_type_group"\)/);
  assert.match(SOURCE, /\.eq\("owner_scope", "global"\)/);
  assert.match(SOURCE, /\.not\("ppf_type_group_id", "is", null\)/);
  assert.match(SOURCE, /\.eq\("dealer_id", dealer\.dealer_id\)/);
  assert.match(SOURCE, /\.eq\("kind", "ppf_part"\)/);
  assert.match(SOURCE, /parts\.length !== 16/);
  assert.doesNotMatch(SOURCE, /service[_-]?role|createAdmin|adminClient/i);
});

test("coefficient read distinguishes absent, incomplete, malformed and failed states", () => {
  for (const status of ["NOT_CONFIGURED", "INCOMPLETE", "MALFORMED", "READ_FAILED", "UNAUTHENTICATED", "READY"]) {
    assert.match(SOURCE, new RegExp(`status: "${status}"`));
  }
});

test("live runtime merges same-dealer coefficient overrides and fails closed on read error", () => {
  assert.match(RUNTIME, /from\("dealer_wizard_catalog_overrides"\)/);
  assert.match(RUNTIME, /\.eq\("dealer_id", dealerId\)/);
  assert.match(RUNTIME, /if \(coefficientOverrideError \|\| !coefficientOverrides\) return \{ ok: false \}/);
  assert.match(RUNTIME, /coefficientOverrideByItemId\.has\(d\.id as string\)/);
});
