import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260918001038_installation_certificate_r2_kind_numbering.sql",
  "utf8",
);

test("R2 migration preserves R1 while adding three exact immutable identities", () => {
  for (const value of [
    "installation-certificate-r1",
    "installation-certificate-coating-r2",
    "installation-certificate-ppf-r2",
    "installation-certificate-cancoat-r2",
    "^CRT/CO/",
    "^CRT/PPF/",
    "^CRT/CC/",
  ]) assert.equal(migration.includes(value), true, value);
  assert.match(migration, /source_contract_version = 1/);
  assert.match(migration, /source_contract_version = 2/);
});

test("R2 issue and finalize functions are definer-safe and exactly granted", () => {
  assert.match(migration, /CREATE FUNCTION public\.issue_installation_certificate_r2_v1[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(migration, /CREATE FUNCTION public\.finalize_installation_certificate_r2_document_v1[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.issue_installation_certificate_r2_v1[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.issue_installation_certificate_r2_v1[\s\S]*TO authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.finalize_installation_certificate_r2_document_v1[\s\S]*TO service_role/);
});

test("R2 kind filtering excludes maintenance and prevents duplicate CanCoat certificates", () => {
  assert.match(migration, /maintenance\|メンテナンス\|wash\|洗車\|cleaning\|クリーニング/);
  assert.match(migration, /v_kind = 'cancoat' AND COALESCE\(v_has_base_coating, false\)/);
  assert.match(migration, /certificate-kind-not-applicable/);
});
