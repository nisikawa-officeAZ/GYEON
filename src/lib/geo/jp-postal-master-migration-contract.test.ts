// GDA-2A-OCR-POSTAL-MASTER-R2 — static source-contract test for the migration SQL.
//
// No database, Supabase CLI, or pgTAP runs here (forbidden by the directive's local-verification
// boundary). This test reads the migration file as TEXT and asserts on its literal SQL, which is
// the only way to prove the required privilege/search-path/index/immutability contract without a
// runtime database in this phase. `supabase/tests/jp_postal_master_rpc.test.sql` is the later
// disposable-DB-gate pgTAP counterpart that proves the same contract at runtime.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(__dirname, "../../../supabase/migrations/20260901001246_jp_postal_master.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");
const GYEON_ORDER_MIGRATION_PATH = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260829101726_gyeon_order_v3_contract.sql",
);
const gyeonOrderSql = readFileSync(GYEON_ORDER_MIGRATION_PATH, "utf8");

test("migration file is present and non-empty", () => {
  assert.equal(sql.length > 0, true);
});

// ── search_path ───────────────────────────────────────────────────────────

test("every security definer function pins search_path to empty", () => {
  const definerBlocks = sql.split(/create or replace function/i).slice(1);
  assert.equal(definerBlocks.length > 0, true);
  for (const block of definerBlocks) {
    if (!/security definer/i.test(block)) continue;
    assert.match(block, /set search_path = ''/);
  }
});

// ── Privileges: default-deny then minimum grants ────────────────────────────

test("postal migration never resets shared private-schema privileges", () => {
  assert.equal(/revoke\s+all\s+on\s+schema\s+private/i.test(sql), false);
  assert.equal(/revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+private/i.test(sql), false);
  assert.match(sql, /grant usage on schema private to service_role/);
});

test("postal migration revokes direct access on exactly the three postal tables", () => {
  for (const table of ["jp_postal_import_batches", "jp_postal_master", "jp_postal_active_batch"]) {
    assert.match(
      sql,
      new RegExp(`revoke all on table private\\.${table} from public, anon, authenticated, service_role`),
    );
    const grantRegex = new RegExp(`grant [^;]*on private\\.${table}`, "i");
    assert.equal(grantRegex.test(sql), false, `expected no direct grant of any kind on private.${table}`);
  }
});

test("earlier GYEON-order migration retains authenticated private-schema/function authority", () => {
  assert.match(gyeonOrderSql, /grant usage on schema private to authenticated/);
  assert.match(
    gyeonOrderSql,
    /grant execute on function private\.gyeon_order_v3_can_read_dealer\(uuid\) to authenticated/,
  );
});

test("no role/table pair grants direct access to a browser-reachable role (anon/authenticated) on any private table", () => {
  for (const table of ["jp_postal_import_batches", "jp_postal_master", "jp_postal_active_batch"]) {
    const grantRegex = new RegExp(`grant [^;]*on private\\.${table}[^;]*to [^;]*\\b(anon|authenticated)\\b`, "i");
    assert.equal(grantRegex.test(sql), false, `expected no anon/authenticated grant on private.${table}`);
  }
});

test("the two lookup RPCs are revoked from every role then granted only to authenticated", () => {
  for (const fn of ["jp_postal_master_lookup_forward(text)", "jp_postal_master_lookup_reverse(text)"]) {
    const escaped = fn.replace(/[()]/g, (c) => `\\${c}`);
    const revokeRegex = new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated, service_role`);
    const grantRegex = new RegExp(`grant execute on function public\\.${escaped} to authenticated`);
    assert.match(sql, revokeRegex, `missing full revoke for ${fn}`);
    assert.match(sql, grantRegex, `missing authenticated-only grant for ${fn}`);
    assert.equal(new RegExp(`grant execute on function public\\.${escaped} to (public|anon|service_role)`).test(sql), false);
  }
});

test("the five import RPCs are revoked from every role then granted only to service_role", () => {
  const importFns = [
    "jp_postal_import_status\\(date, text, integer\\)",
    "jp_postal_import_begin\\(date, text, integer\\)",
    "jp_postal_import_append\\(uuid, integer, jsonb\\)",
    "jp_postal_import_finalize\\(uuid\\)",
    "jp_postal_import_rollback\\(uuid\\)",
  ];
  for (const fn of importFns) {
    const revokeRegex = new RegExp(`revoke all on function public\\.${fn} from public, anon, authenticated, service_role`);
    const grantRegex = new RegExp(`grant execute on function public\\.${fn} to service_role`);
    assert.match(sql, revokeRegex, `missing full revoke for ${fn}`);
    assert.match(sql, grantRegex, `missing service_role-only grant for ${fn}`);
    assert.equal(new RegExp(`grant execute on function public\\.${fn} to (public|anon|authenticated)`).test(sql), false);
  }
});

// ── Active-member lookup guard ───────────────────────────────────────────────

test("both lookup RPCs independently call the existing active-member guard before returning data", () => {
  const forward = sql.slice(sql.indexOf("function public.jp_postal_master_lookup_forward"), sql.indexOf("function public.jp_postal_master_lookup_reverse"));
  const reverse = sql.slice(sql.indexOf("function public.jp_postal_master_lookup_reverse"), sql.indexOf("function public.jp_postal_import_begin"));
  for (const block of [forward, reverse]) {
    assert.match(block, /if not public\.wiz_is_any_active_member\(\) then/);
    assert.match(block, /raise exception 'not authorized'/);
  }
});

test("no new private membership helper is introduced (the existing wiz_is_any_active_member is reused)", () => {
  assert.equal(/jp_postal_actor_has_active_dealer_membership/.test(sql), false);
});

test("repair A1-3: no import RPC depends on auth.role(); authorization is GRANT-only", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const importSection = sql.slice(beginIdx);
  assert.equal(/auth\.role\(\)/.test(importSection), false);
});

test("duplicate append sequence is an explicit successful zero-write no-op", () => {
  assert.match(sql, /appended_sequences\s+integer\[\]\s+not null default '\{\}'/);
  assert.match(sql, /if p_sequence = ANY\(v_appended_sequences\) then/);
  assert.match(sql, /'result_code', 'OK', 'appended_count', 0, 'already_appended', true/);
});

test("service-role status RPC is keyed by identity/count and returns only stable safe metadata", () => {
  const statusIdx = sql.indexOf("function public.jp_postal_import_status");
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const statusBody = sql.slice(statusIdx, beginIdx);
  assert.match(statusBody, /where source_date = p_source_date and sha256 = p_sha256/);
  assert.match(statusBody, /v_batch\.expected_row_count is distinct from p_expected_row_count/);
  assert.match(statusBody, /'result_code', 'EXPECTED_ROW_COUNT_MISMATCH'/);
  for (const field of ["batch_id", "status", "expected_row_count", "appended_sequences", "is_active"]) {
    assert.match(statusBody, new RegExp(`'${field}'`));
  }
  assert.equal(/postal_code|address_key|prefecture|city_kanji|town_kanji/.test(statusBody), false);
});

test("repair adds no abort/delete/truncate/reset or terminal-batch recycling path", () => {
  assert.equal(/jp_postal_import_abort/i.test(sql), false);
  assert.equal(/delete\s+from\s+private\.jp_postal/i.test(sql), false);
  assert.equal(/truncate\s+(table\s+)?private\.jp_postal/i.test(sql), false);
  assert.equal(/set\s+status\s*=\s*'staged'/.test(sql), false);
});

test("repair A1-5: begin/append/finalize/rollback each lock their batch row with SELECT ... FOR UPDATE", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const importSection = sql.slice(beginIdx);
  const occurrences = importSection.match(/for update;/g) ?? [];
  assert.equal(occurrences.length >= 4, true);
});

test("repair A1-5: rollback marks the outgoing promoted batch rolled_back with rolled_back_at and never touches jp_postal_master", () => {
  const rollbackIdx = sql.indexOf("function public.jp_postal_import_rollback");
  const rollbackBody = sql.slice(rollbackIdx);
  assert.match(rollbackBody, /set status = 'rolled_back', rolled_back_at = now\(\)/);
  assert.equal(/update private\.jp_postal_master/.test(rollbackBody), false);
  assert.equal(/delete from private\.jp_postal_master/.test(rollbackBody), false);
});

test("repair A1-6: append validates every row before insert and recomputes address_key server-side", () => {
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const finalizeIdx = sql.indexOf("function public.jp_postal_import_finalize");
  const appendBody = sql.slice(appendIdx, finalizeIdx);
  assert.match(appendBody, /'result_code', 'INVALID_ROW_PAYLOAD'/);
  assert.match(appendBody, /\(r ->> 'flagMultiPostalPerTown'\) in \('0', '1'\)/);
  assert.equal(/r ->> 'addressKey'/.test(appendBody), false);
  assert.equal(/r ->> 'addressPrefixHead'/.test(appendBody), false);
  assert.equal(/r ->> 'isNonSpecificTown'/.test(appendBody), false);
  assert.match(appendBody, /\(r ->> 'prefectureKanji'\) \|\| \(r ->> 'cityKanji'\) \|\| \(r ->> 'townKanji'\) as derived_address_key/);
});

test("repair A1-2: reverse lookup generates candidate prefix heads instead of one fixed-length prefix", () => {
  const reverseIdx = sql.indexOf("function public.jp_postal_master_lookup_reverse");
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const reverseBody = sql.slice(reverseIdx, beginIdx);
  assert.match(reverseBody, /generate_series\(1, least\(8, length\(v_norm\)\)\)/);
  assert.match(reverseBody, /address_prefix_head = ANY\(v_prefix_candidates\)/);
});

test("repair A1-7: forward lookup reduces by distinct address_key, not raw row count", () => {
  const forwardIdx = sql.indexOf("function public.jp_postal_master_lookup_forward");
  const reverseIdx = sql.indexOf("function public.jp_postal_master_lookup_reverse");
  const forwardBody = sql.slice(forwardIdx, reverseIdx);
  assert.match(forwardBody, /count\(distinct address_key\) filter \(where is_non_specific_town = false\)/);
  assert.match(forwardBody, /v_ambiguous or v_distinct_addr_count is distinct from 1/);
});

// ── Batch size bound ──────────────────────────────────────────────────────

test("the append RPC bounds the payload batch size", () => {
  assert.match(sql, /jsonb_array_length\(p_rows\) = 0 or jsonb_array_length\(p_rows\) > 1000/);
});

// ── Indexes ───────────────────────────────────────────────────────────────

test("a forward-lookup index exists on (batch_id, postal_code_norm)", () => {
  assert.match(sql, /create index jp_postal_master_batch_postal_idx on private\.jp_postal_master \(batch_id, postal_code_norm\)/);
});

test("a reverse-lookup prefilter index exists on (batch_id, address_prefix_head)", () => {
  assert.match(sql, /create index jp_postal_master_batch_prefix_idx on private\.jp_postal_master \(batch_id, address_prefix_head\)/);
});

// ── Pointer promotion / rollback ─────────────────────────────────────────────

test("the active-batch pointer is a singleton table", () => {
  assert.match(sql, /create table private\.jp_postal_active_batch \(\s*singleton\s+boolean primary key default true check \(singleton\)/);
});

test("finalize promotes by updating only the active-batch pointer, never by rewriting jp_postal_master", () => {
  const finalizeIdx = sql.indexOf("function public.jp_postal_import_finalize");
  const rollbackIdx = sql.indexOf("function public.jp_postal_import_rollback");
  const finalizeBody = sql.slice(finalizeIdx, rollbackIdx);
  assert.match(finalizeBody, /update private\.jp_postal_active_batch set batch_id = p_batch_id, updated_at = now\(\) where singleton/);
  assert.equal(/update private\.jp_postal_master/.test(finalizeBody), false);
  assert.equal(/delete from private\.jp_postal_master/.test(finalizeBody), false);
});

test("rollback updates only the active-batch pointer and requires the target batch to already be promoted", () => {
  const rollbackIdx = sql.indexOf("function public.jp_postal_import_rollback");
  const rollbackBody = sql.slice(rollbackIdx);
  assert.match(rollbackBody, /if v_status is distinct from 'promoted' then/);
  assert.match(rollbackBody, /update private\.jp_postal_active_batch set batch_id = p_batch_id, updated_at = now\(\) where singleton/);
  assert.equal(/update private\.jp_postal_master/.test(rollbackBody), false);
  assert.equal(/delete from private\.jp_postal_master/.test(rollbackBody), false);
});

// ── Immutability ──────────────────────────────────────────────────────────

test("jp_postal_master receives no UPDATE or DELETE grant for any role (append-only)", () => {
  assert.equal(/grant[^;]*update[^;]*on private\.jp_postal_master/i.test(sql), false);
  assert.equal(/grant[^;]*delete[^;]*on private\.jp_postal_master/i.test(sql), false);
});

test("jp_postal_import_batches identity fields are protected by an immutability trigger", () => {
  assert.match(sql, /jp_postal_import_batches identity fields are immutable/);
  assert.match(sql, /before update on private\.jp_postal_import_batches/);
});

// ── Non-specific-town and flag-10 semantics referenced by the SQL (paired with the pure TS tests) ──

test("reverse lookup excludes non-specific-town rows from producing a match", () => {
  const reverseIdx = sql.indexOf("function public.jp_postal_master_lookup_reverse");
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const reverseBody = sql.slice(reverseIdx, beginIdx);
  assert.match(reverseBody, /is_non_specific_town = false/);
});

test("forward lookup treats flag_multi_town_per_postal and non-specific town as ambiguous, not found", () => {
  const forwardIdx = sql.indexOf("function public.jp_postal_master_lookup_forward");
  const reverseIdx = sql.indexOf("function public.jp_postal_master_lookup_reverse");
  const forwardBody = sql.slice(forwardIdx, reverseIdx);
  assert.match(forwardBody, /bool_or\(flag_multi_town_per_postal or is_non_specific_town\)/);
});

test("reverse lookup treats a winning row with flag_multi_postal_per_town as ambiguous", () => {
  const reverseIdx = sql.indexOf("function public.jp_postal_master_lookup_reverse");
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const reverseBody = sql.slice(reverseIdx, beginIdx);
  assert.match(reverseBody, /bool_or\(flag_multi_postal_per_town\)/);
});

// ── A2 repair 1: pgTAP candidate never accesses a private table directly as service_role ──────

test("repair A2-1: the pgTAP candidate never directly SELECTs/INSERTs/UPDATEs a private.jp_postal_* table while service_role is the active role", () => {
  const rpcSqlPath = path.resolve(__dirname, "../../../supabase/tests/jp_postal_master_rpc.test.sql");
  const rpcSql = readFileSync(rpcSqlPath, "utf8");
  const lines = rpcSql.split("\n");
  let inServiceRole = false;
  const violations: string[] = [];
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (/^SET LOCAL ROLE service_role;$/i.test(line)) {
      inServiceRole = true;
      return;
    }
    if (/^RESET ROLE;$/i.test(line)) {
      inServiceRole = false;
      return;
    }
    if (inServiceRole && /private\.jp_postal/.test(line)) {
      violations.push(`line ${i + 1}: ${line}`);
    }
  });
  assert.deepEqual(violations, [], "expected zero direct private.jp_postal_* references while current_user = service_role");
});

test("repair A2-1: the pgTAP candidate defines its private-table inspection helpers before any service_role role switch", () => {
  const rpcSqlPath = path.resolve(__dirname, "../../../supabase/tests/jp_postal_master_rpc.test.sql");
  const rpcSql = readFileSync(rpcSqlPath, "utf8");
  const firstServiceRoleIdx = rpcSql.search(/^SET LOCAL ROLE service_role;$/im);
  assert.equal(firstServiceRoleIdx > 0, true);
  for (const fn of ["jpm_batch_id", "jpm_batch_status", "jpm_active_batch_id", "jpm_master_row", "jpm_master_row_count"]) {
    const defIdx = rpcSql.indexOf(`CREATE FUNCTION pg_temp.${fn}`);
    assert.equal(defIdx >= 0, true, `missing pg_temp.${fn} helper definition`);
    assert.equal(defIdx < firstServiceRoleIdx, true, `pg_temp.${fn} must be defined before the first service_role role switch`);
    assert.match(rpcSql.slice(defIdx, defIdx + 400), /SECURITY DEFINER/, `pg_temp.${fn} must be SECURITY DEFINER`);
  }
});

// ── A2 repair 2: finalize/rollback lock the pointer before any batch row, in the same order ────

test("repair A2-2: jp_postal_import_rollback locks and reads the singleton pointer with SELECT ... FOR UPDATE before locking the target batch row", () => {
  const rollbackIdx = sql.indexOf("function public.jp_postal_import_rollback");
  const rollbackBody = sql.slice(rollbackIdx);
  const pointerLockIdx = rollbackBody.search(/select batch_id into v_outgoing_batch_id from private\.jp_postal_active_batch where singleton for update;/);
  const targetLockIdx = rollbackBody.search(/select status into v_status from private\.jp_postal_import_batches where id = p_batch_id for update;/);
  assert.equal(pointerLockIdx >= 0, true);
  assert.equal(targetLockIdx >= 0, true);
  assert.equal(pointerLockIdx < targetLockIdx, true, "the pointer lock must precede the target batch row lock");
});

test("repair A2-2: jp_postal_import_finalize locks the singleton pointer before locking the target batch row, matching rollback's lock order", () => {
  const finalizeIdx = sql.indexOf("function public.jp_postal_import_finalize");
  const rollbackIdx = sql.indexOf("function public.jp_postal_import_rollback");
  const finalizeBody = sql.slice(finalizeIdx, rollbackIdx);
  const pointerLockIdx = finalizeBody.search(/perform 1 from private\.jp_postal_active_batch where singleton for update;/);
  const targetLockIdx = finalizeBody.search(/select status, expected_row_count into v_status, v_expected/);
  assert.equal(pointerLockIdx >= 0, true);
  assert.equal(targetLockIdx >= 0, true);
  assert.equal(pointerLockIdx < targetLockIdx, true, "the pointer lock must precede the target batch row lock");
});

// ── A2 repair 3: begin rejects a staged/validating replay instead of returning a resumable OK ──

test("repair A2-3: begin returns a stable non-OK IMPORT_IN_PROGRESS for a staged/validating replay, exposing no batch_id", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const beginBody = sql.slice(beginIdx, appendIdx);
  assert.match(beginBody, /if v_existing\.status in \('staged', 'validating'\) then/);
  assert.match(beginBody, /return jsonb_build_object\('result_code', 'IMPORT_IN_PROGRESS'\);/);
  assert.equal(/'result_code', 'OK', 'batch_id', v_existing\.id, 'already_promoted', false/.test(beginBody), false);
});

// ── R2 repair: a lost first-time-begin insert race falls back to ON CONFLICT DO NOTHING ────────

test("repair R2: begin attempts INSERT ... ON CONFLICT (source_date, sha256) DO NOTHING ... RETURNING id INTO v_batch_id only when the initial lookup found no row", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const beginBody = sql.slice(beginIdx, appendIdx);
  assert.match(beginBody, /if not found then/);
  assert.match(beginBody, /on conflict \(source_date, sha256\) do nothing/i);
  assert.match(beginBody, /returning id into v_batch_id;/);
});

test("repair R2: begin never introduces ON CONFLICT ... DO UPDATE", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const beginBody = sql.slice(beginIdx, appendIdx);
  assert.equal(/on conflict[^;]*do update/i.test(beginBody), false);
});

test("repair R2: begin returns the fresh-winner OK result only when v_batch_id is non-null after the race-fallback insert", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const beginBody = sql.slice(beginIdx, appendIdx);
  assert.match(
    beginBody,
    /if v_batch_id is not null then\s*\n\s*return jsonb_build_object\('result_code', 'OK', 'batch_id', v_batch_id, 'already_promoted', false\);/
  );
});

test("repair R2: begin re-reads the winning identity row with a second SELECT ... FOR UPDATE after a lost insert race", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const beginBody = sql.slice(beginIdx, appendIdx);
  const lockOccurrences = beginBody.match(/for update;/g) ?? [];
  assert.equal(
    lockOccurrences.length,
    2,
    "expected exactly two SELECT ... FOR UPDATE lock attempts in begin: the initial lookup and the post-race re-read"
  );
});

test("repair R2: begin retains exactly one IMPORT_IN_PROGRESS branch and one CHECKSUM_REPLAY_CONFLICT branch, so pre-existing identities and conflict losers share one status-result block", () => {
  const beginIdx = sql.indexOf("function public.jp_postal_import_begin");
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const beginBody = sql.slice(beginIdx, appendIdx);
  const inProgressOccurrences = beginBody.match(/'IMPORT_IN_PROGRESS'/g) ?? [];
  const conflictOccurrences = beginBody.match(/'CHECKSUM_REPLAY_CONFLICT'/g) ?? [];
  assert.equal(inProgressOccurrences.length, 1, "expected exactly one IMPORT_IN_PROGRESS branch in begin");
  assert.equal(conflictOccurrences.length, 1, "expected exactly one CHECKSUM_REPLAY_CONFLICT branch in begin");
});

// ── A2 repair 4: append closes NULL/non-object payload validation holes ────────────────────────

test("repair A2-4: append rejects a NULL sequence before the negative-sequence check can silently pass it through", () => {
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const finalizeIdx = sql.indexOf("function public.jp_postal_import_finalize");
  const appendBody = sql.slice(appendIdx, finalizeIdx);
  assert.match(appendBody, /if p_sequence is null or p_sequence < 0 then/);
});

test("repair A2-4: append rejects a NULL rows payload explicitly, not only via jsonb_typeof NULL propagation", () => {
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const finalizeIdx = sql.indexOf("function public.jp_postal_import_finalize");
  const appendBody = sql.slice(appendIdx, finalizeIdx);
  assert.match(appendBody, /if p_rows is null or jsonb_typeof\(p_rows\) is distinct from 'array' then/);
});

test("repair A2-4: append rejects a non-object array element and guards every required field's JSON type before its shape", () => {
  const appendIdx = sql.indexOf("function public.jp_postal_import_append");
  const finalizeIdx = sql.indexOf("function public.jp_postal_import_finalize");
  const appendBody = sql.slice(appendIdx, finalizeIdx);
  assert.match(appendBody, /where jsonb_typeof\(r\) is distinct from 'object'/);
  for (const field of [
    "jisCode", "postalCode", "oldPostalCode", "prefectureKanji", "cityKanji", "townKanji",
    "prefectureKana", "cityKana", "townKana", "flagMultiPostalPerTown", "flagKoazaBanchi",
    "flagHasChome", "flagMultiTownPerPostal", "updateFlag", "changeReasonCode",
  ]) {
    const guard = new RegExp(`coalesce\\(jsonb_typeof\\(r -> '${field}'\\), ''\\) = 'string'`);
    assert.match(appendBody, guard, `missing determinate JSON-type guard for ${field}`);
  }
});

// ── A3 repair: the test-27/test-28 identity-b fixture never calls begin a second time ──────────

test("repair A3: the test-27/test-28 identity-b fixture performs exactly one begin before append, and append uses the staged batch id helper", () => {
  const rpcSqlPath = path.resolve(__dirname, "../../../supabase/tests/jp_postal_master_rpc.test.sql");
  const rpcSql = readFileSync(rpcSqlPath, "utf8");
  const blockStart = rpcSql.indexOf("-- 27-32: end-to-end begin/append/finalize promotes exactly the inserted rows.");
  const blockEnd = rpcSql.indexOf("-- 31: repair A1-1");
  assert.equal(blockStart >= 0, true, "missing the test 27-32 fixture comment marker");
  assert.equal(blockEnd > blockStart, true, "missing the test 31 fixture comment marker");
  const fixtureBlock = rpcSql.slice(blockStart, blockEnd);
  const beginCalls = fixtureBlock.match(/public\.jp_postal_import_begin\(/g) ?? [];
  assert.equal(beginCalls.length, 1, "expected exactly one jp_postal_import_begin call across tests 27-30 for identity b");
  assert.match(
    fixtureBlock,
    /public\.jp_postal_import_append\(\s*pg_temp\.jpm_batch_id\(repeat\('b', 64\)\)/,
    "expected test 28 to obtain the staged batch id via pg_temp.jpm_batch_id instead of a second begin"
  );
});

test("repair A3: the intentional identity-i conflict replay (tests 54-57) still calls begin repeatedly to prove IMPORT_IN_PROGRESS", () => {
  const rpcSqlPath = path.resolve(__dirname, "../../../supabase/tests/jp_postal_master_rpc.test.sql");
  const rpcSql = readFileSync(rpcSqlPath, "utf8");
  const blockStart = rpcSql.indexOf("-- 54-57: begin itself never returns resumable data");
  const blockEnd = rpcSql.indexOf("-- 58-64: repair A2-4");
  assert.equal(blockStart >= 0, true, "missing the test 54-57 fixture comment marker");
  assert.equal(blockEnd > blockStart, true, "missing the test 58-64 fixture comment marker");
  const conflictBlock = rpcSql.slice(blockStart, blockEnd);
  const beginCalls = conflictBlock.match(/public\.jp_postal_import_begin\(/g) ?? [];
  assert.equal(beginCalls.length >= 3, true, "expected the identity-i conflict block to still call begin repeatedly (fresh + two IMPORT_IN_PROGRESS replays)");
  assert.match(conflictBlock, /'IMPORT_IN_PROGRESS'/, "expected the identity-i conflict block to still assert IMPORT_IN_PROGRESS");
  assert.match(conflictBlock, /'batch_id'\),\s*\n\s*NULL,/, "expected the identity-i conflict block to still assert no batch_id is exposed");
});
