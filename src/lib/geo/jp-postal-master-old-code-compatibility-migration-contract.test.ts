import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  directory,
  "../../../supabase/migrations/20260908045111_jp_postal_old_code_official_padding_compatibility.sql",
);
const sql = readFileSync(migrationPath, "utf8");

test("corrective migration replaces only the legacy-code constraint and append RPC", () => {
  assert.match(sql, /drop constraint jp_postal_master_old_postal_code_format/);
  assert.match(sql, /add constraint jp_postal_master_old_postal_code_format/);
  assert.match(sql, /create or replace function public\.jp_postal_import_append/);
  assert.equal(/create table/i.test(sql), false);
  assert.equal(/delete\s+from\s+private\.jp_postal/i.test(sql), false);
  assert.equal(/truncate\s+(table\s+)?private\.jp_postal/i.test(sql), false);
});

test("database constraint and append validation accept only the two official fixed-width shapes", () => {
  const exactPattern = "^(\\d{5}|\\d{3} {2})$";
  assert.equal(sql.split(exactPattern).length - 1, 2);
  assert.equal(sql.includes("^\\d{0,5}$"), false);
});

test("replacement append RPC preserves the privilege and security boundary", () => {
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(
    sql,
    /revoke all on function public\.jp_postal_import_append\(uuid, integer, jsonb\)\s+from public, anon, authenticated, service_role/,
  );
  assert.match(
    sql,
    /grant execute on function public\.jp_postal_import_append\(uuid, integer, jsonb\) to service_role/,
  );
  assert.equal(/grant execute[^;]*to (public|anon|authenticated)/i.test(sql), false);
});

test("replacement append RPC retains bounded batches, row locking, fail-closed typing, and server derivation", () => {
  assert.match(sql, /jsonb_array_length\(p_rows\) = 0 or jsonb_array_length\(p_rows\) > 1000/);
  assert.match(sql, /where id = p_batch_id\s+for update;/);
  assert.match(sql, /jsonb_typeof\(r\) is distinct from 'object'/);
  assert.match(sql, /'result_code', 'INVALID_ROW_PAYLOAD'/);
  assert.equal(/r ->> 'addressKey'/.test(sql), false);
  assert.equal(/r ->> 'addressPrefixHead'/.test(sql), false);
  assert.equal(/r ->> 'isNonSpecificTown'/.test(sql), false);
});
