import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SOURCE = readFileSync(
  join(process.cwd(), "src/lib/pricing/save-authoritative-coating-v34-settings.ts"),
  "utf8",
);

test("save boundary accepts only an untrusted coating payload and no dealer ID", () => {
  assert.match(SOURCE, /saveAuthoritativeCoatingV34Settings\(\s*coating:\s*unknown/);
  assert.doesNotMatch(
    SOURCE,
    /saveAuthoritativeCoatingV34Settings\(\s*dealer/i,
  );
  assert.doesNotMatch(SOURCE, /p_dealer_id:\s*coating/);
});

test("payload is parsed before authorization or database I/O", () => {
  const parseAt = SOURCE.indexOf("parsed = parseCoatingSettingsV34(coating)");
  const roleAt = SOURCE.indexOf('requireRole(["owner", "manager"])');
  const clientAt = SOURCE.indexOf("await createClient()");
  assert.ok(parseAt >= 0 && parseAt < roleAt && roleAt < clientAt);
  assert.match(SOURCE, /status:\s*"INVALID_PAYLOAD"/);
});

test("dealer scope is server-derived and owner-manager restricted", () => {
  assert.match(SOURCE, /requireRole\(\["owner",\s*"manager"\]\)/);
  assert.match(SOURCE, /\{\s*dealerId\s*\}\s*=\s*await requireRole/);
  assert.match(SOURCE, /status:\s*"UNAUTHORIZED"/);
});

test("uses the normal authenticated RPC with exact arguments", () => {
  assert.match(SOURCE, /createClient\(\)/);
  assert.match(SOURCE, /\.rpc\("save_coating_v34_settings",\s*\{/);
  assert.match(SOURCE, /p_dealer_id:\s*dealerId/);
  assert.match(SOURCE, /p_coating:\s*parsed/);
  assert.doesNotMatch(SOURCE, /service[_-]?role/i);
  assert.doesNotMatch(SOURCE, /adminClient|createAdmin/);
});

test("does not bypass the RPC or accept an unvalidated response", () => {
  assert.doesNotMatch(SOURCE, /\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(SOURCE, /settings:\s*parseCoatingSettingsV34\(data\)/);
  assert.match(SOURCE, /status:\s*"SAVE_FAILED"/);
});
