import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SOURCE_PATH = join(
  process.cwd(),
  "src/lib/pricing/get-authoritative-ppf-r1-price-settings.ts",
);
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

test("server read boundary accepts no dealer-controlled argument", () => {
  assert.match(SOURCE, /getAuthoritativePpfR1PriceSettings\(\s*\)/);
  assert.doesNotMatch(SOURCE, /dealerId\s*:/);
});

test("resolves current dealer and uses the normal authenticated client", () => {
  assert.match(SOURCE, /getCurrentDealer\(\)/);
  assert.match(SOURCE, /createClient\(\)/);
  assert.doesNotMatch(SOURCE, /service[_-]?role/i);
  assert.doesNotMatch(SOURCE, /adminClient|createAdmin/);
});

test("reads exactly ppf_price_tables under resolved dealer RLS scope", () => {
  assert.match(SOURCE, /\.from\("dealer_settings"\)/);
  assert.match(SOURCE, /\.select\("ppf_price_tables"\)/);
  assert.match(SOURCE, /\.eq\("dealer_id",\s*dealer\.dealer_id\)/);
  assert.match(SOURCE, /\.maybeSingle\(\)/);
  assert.doesNotMatch(SOURCE, /select\("\*"\)/);
});

test("exposes the exact five explicit failure/ready states without defaults", () => {
  assert.match(SOURCE, /status:\s*"READY"/);
  assert.match(SOURCE, /status:\s*"NOT_CONFIGURED"/);
  assert.match(SOURCE, /status:\s*"MALFORMED"/);
  assert.match(SOURCE, /status:\s*"UNAUTHENTICATED"/);
  assert.match(SOURCE, /status:\s*"READ_FAILED"/);
  assert.doesNotMatch(SOURCE, /DEFAULT_PPF|buildFallback|fallback/i);
});

test("uses the strict parser and never treats missing as zero", () => {
  assert.match(SOURCE, /parsePpfR1PriceSettings\(data\.ppf_price_tables\)/);
  assert.doesNotMatch(SOURCE, /\?\?\s*0/);
});

test("is read-only and does not expose unrelated columns", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(SOURCE, /service_price_settings|line_|auth\.|storage\./i);
});
