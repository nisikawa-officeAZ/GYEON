import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SOURCE_PATH = join(
  process.cwd(),
  "src/lib/pricing/get-authoritative-coating-v34-settings.ts",
);
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

test("server read boundary accepts no dealer-controlled argument", () => {
  assert.match(
    SOURCE,
    /getAuthoritativeCoatingV34Settings\(\s*\)/,
  );
  assert.doesNotMatch(SOURCE, /dealerId\s*:/);
});

test("resolves current dealer and uses the normal authenticated client", () => {
  assert.match(SOURCE, /getCurrentDealer\(\)/);
  assert.match(SOURCE, /createClient\(\)/);
  assert.doesNotMatch(SOURCE, /service[_-]?role/i);
  assert.doesNotMatch(SOURCE, /adminClient|createAdmin/);
});

test("reads exactly service_price_settings under resolved dealer RLS scope", () => {
  assert.match(SOURCE, /\.from\("dealer_settings"\)/);
  assert.match(SOURCE, /\.select\("service_price_settings"\)/);
  assert.match(SOURCE, /\.eq\("dealer_id",\s*dealer\.dealer_id\)/);
  assert.match(SOURCE, /\.maybeSingle\(\)/);
  assert.doesNotMatch(SOURCE, /select\("\*"\)/);
});

test("uses the strict resolver and exposes explicit failure states without defaults", () => {
  assert.match(SOURCE, /resolveStoredCoatingV34\(data\.service_price_settings\)/);
  assert.match(SOURCE, /status:\s*"UNAUTHENTICATED"/);
  assert.match(SOURCE, /status:\s*"READ_FAILED"/);
  assert.match(SOURCE, /status:\s*"NOT_CONFIGURED"/);
  assert.doesNotMatch(SOURCE, /DEFAULT_SERVICE_PRICE_SETTINGS|buildFallback|fallback/i);
});

test("is read-only and does not expose unrelated columns", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(SOURCE, /ppf_price_tables|line_|auth\.|storage\./i);
});
