import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const literalPath = "supabase/migrations/20260920093931_office_az_operator_authority.sql";
const sql = readFileSync(resolve(process.cwd(), literalPath), "utf8");

test("migration remains on the reserved literal path with one pinned resolver RPC", () => {
  assert.match(sql, /create function public\.resolve_office_az_inventory_authority\(/i);
  assert.equal((sql.match(/create function public\.resolve_office_az_inventory_authority\(/gi) ?? []).length, 1);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/);
});

test("closed sets and Office AZ owner are enforced in storage", () => {
  for (const token of [
    "owner = 'OFFICE_AZ'",
    "'human', 'service'",
    "'active', 'suspended', 'revoked'",
    "office_az_warehouse_operator",
    "office_az_warehouse_manager",
    "office_az_inventory_super_admin",
    "office_az_inventory_service",
    "inventory.operator.manage",
    "authority_version > 0",
    "valid_until > valid_from",
  ]) assert.ok(sql.includes(token), `missing closed contract: ${token}`);
});

test("private tables have no direct browser or service-role grants", () => {
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assert.match(
      sql,
      new RegExp(`revoke all on all tables in schema office_az_inventory_authority_private from ${role}`, "i"),
    );
  }
  assert.match(sql, /grant execute on function public\.resolve_office_az_inventory_authority\(text, text\) to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete).*office_az_inventory_authority_private/i);
});

test("migration contains no seed, mutation RPC, trigger, service bypass, or destructive replacement", () => {
  assert.doesNotMatch(sql, /insert\s+into/i);
  assert.doesNotMatch(sql, /create\s+trigger/i);
  assert.doesNotMatch(sql, /create\s+(or\s+replace\s+)?function\s+[^\s(]*(grant|revoke|assign|mutat|write)/i);
  assert.doesNotMatch(sql, /create\s+or\s+replace/i);
  assert.doesNotMatch(sql, /drop\s+(table|schema|function)/i);
  assert.doesNotMatch(sql, /service_role\s*\)/i);
});

test("RPC accepts only actor and operator while returning candidates and known locations", () => {
  const signature = sql.match(/create function public\.resolve_office_az_inventory_authority\(([\s\S]*?)\)\s*returns jsonb/i)?.[1] ?? "";
  assert.match(signature, /p_actor_id text/);
  assert.match(signature, /p_operator_id text/);
  for (const forbidden of ["authenticated", "owner", "role", "capability", "location", "time"]) {
    assert.doesNotMatch(signature, new RegExp(forbidden, "i"));
  }
  assert.match(sql, /'candidates'/);
  assert.match(sql, /'knownLocationIds'/);
});
