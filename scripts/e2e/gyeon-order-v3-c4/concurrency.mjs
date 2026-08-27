#!/usr/bin/env node
// GYEON_ORDER_V3_C4_R1_CONCURRENCY
// Uses separate operating-system psql processes and a third observer. No
// Promise-only simulation and no shared database session is accepted.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const CONFIRM = 'I_UNDERSTAND_GYEON_ORDER_V3_C4_IS_DISPOSABLE';
const dbUrl = process.env.C4_DB_URL;
if (process.env.GYEON_ORDER_V3_C4_DISPOSABLE_CONFIRM !== CONFIRM) throw new Error('C4_CONCURRENCY_ERROR: explicit disposable confirmation is missing');
if (!dbUrl) throw new Error('C4_CONCURRENCY_ERROR: C4_DB_URL is required');
const db = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(db.hostname)) throw new Error('C4_CONCURRENCY_ERROR: database URL must be loopback-only');

function psql(sql, label) {
  return new Promise((resolve) => {
    const child = spawn('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PAGER: 'cat', PGAPPNAME: `gyeon-c4-${label}` },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ label, code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function query(sql, label) {
  const result = await psql(sql, label);
  if (result.code !== 0) throw new Error(`${label} failed: ${result.stderr}`);
  return result.stdout;
}

const suffix = process.env.GYEON_ORDER_V3_C4_SUFFIX ?? randomUUID().slice(0, 8);
const dealerId = randomUUID();
const actorId = randomUUID();
const orderId = randomUUID();
const keySame = randomUUID();
const keyA = randomUUID();
const keyB = randomUUID();

await query(`
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','${actorId}','authenticated','authenticated','c4-concurrency-${suffix}@example.invalid','',now(),'{}','{}',now(),now());
insert into public.dealers(id,name,dealer_type,status) values ('${dealerId}','C4 Concurrency','GYEON_DETAILER','active');
insert into public.dealer_members(dealer_id,user_id,role,status) values ('${dealerId}','${actorId}','owner','active');
insert into public.gyeon_ordering_memberships(dealer_id,membership_status,buyer_rank,effective_from) values ('${dealerId}','active','detailer',now()-interval '1 day');
insert into public.product_orders(id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status)
values ('${orderId}','${dealerId}','draft','${actorId}',1,'not_requested','selection_required');
`, 'fixture');

const holdA = psql("select pg_backend_pid(); select pg_sleep(2)", 'session-a');
const holdB = psql("select pg_backend_pid(); select pg_sleep(2)", 'session-b');
await new Promise((resolve) => setTimeout(resolve, 300));
const observedActive = await query("select count(distinct pid) from pg_stat_activity where application_name in ('gyeon-c4-session-a','gyeon-c4-session-b') and state='active'", 'observer');
const [heldA, heldB] = await Promise.all([holdA, holdB]);
const distinctPids = heldA.code === 0 && heldB.code === 0 && observedActive === '2';
process.stdout.write(`${JSON.stringify({ type: 'assertion', name: 'observer sees two simultaneous backend sessions', ok: distinctPids, detail: { observed_active: observedActive } })}\n`);
if (!distinctPids) process.exitCode = 1;

function claimSql(body) {
  return `begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${actorId}',true);
select set_config('request.jwt.claims','{"sub":"${actorId}","role":"authenticated"}',true);
${body}
commit;`;
}

// Family 1: identical operation, same key, same payload. Exactly one ledger row
// and one cancellation transition must survive; both callers may receive the
// same response after row-lock serialization.
const sameCall = `select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${actorId}','${orderId}',1,'${keySame}');`;
const [sameA, sameB] = await Promise.all([
  psql(claimSql(sameCall), 'same-key-a'),
  psql(claimSql(sameCall), 'same-key-b'),
]);
const sameLedger = await query(`select count(*) from public.gyeon_order_idempotency_v3 where dealer_id='${dealerId}' and idempotency_key='${keySame}'`, 'same-ledger');
const sameState = await query(`select status||':'||aggregate_version from public.product_orders where id='${orderId}'`, 'same-state');
const sameOk = sameA.code === 0 && sameB.code === 0 && sameLedger === '1' && sameState === 'cancelled:2';
process.stdout.write(`${JSON.stringify({ type: 'assertion', name: 'same key same payload is one durable transition', ok: sameOk, detail: { a: sameA.code, b: sameB.code, ledger: sameLedger, state: sameState } })}\n`);
if (!sameOk) process.exitCode = 1;

// Restore a second draft for the two remaining race families.
const order2A = randomUUID();
const order2B = randomUUID();
await query(`insert into public.product_orders(id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status) values
('${order2A}','${dealerId}','draft','${actorId}',1,'not_requested','selection_required'),
('${order2B}','${dealerId}','draft','${actorId}',1,'not_requested','selection_required')`, 'fixture-order-2');

// Family 2: same key, different operation/fingerprint. Exactly one succeeds;
// the loser must fail without a second transition.
const cancelDifferent = `select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${actorId}','${order2A}',1,'${keyA}');`;
const cancelDifferentOrder = `select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${actorId}','${order2B}',1,'${keyA}');`;
const [diffA, diffB] = await Promise.all([
  psql(claimSql(cancelDifferent), 'different-payload-a'),
  psql(claimSql(cancelDifferentOrder), 'different-payload-b'),
]);
const diffSuccesses = [diffA, diffB].filter((entry) => entry.code === 0).length;
const diffLedger = await query(`select count(*) from public.gyeon_order_idempotency_v3 where dealer_id='${dealerId}' and idempotency_key='${keyA}'`, 'different-ledger');
const diffOk = diffSuccesses === 1 && diffLedger === '1';
process.stdout.write(`${JSON.stringify({ type: 'assertion', name: 'same key different request has one winner', ok: diffOk, detail: { successes: diffSuccesses, ledger: diffLedger } })}\n`);
if (!diffOk) process.exitCode = 1;

// Family 3: different keys against one aggregate version. Exactly one update
// wins; the other must observe a version/state conflict.
const order3 = randomUUID();
await query(`insert into public.product_orders(id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status) values ('${order3}','${dealerId}','draft','${actorId}',1,'not_requested','selection_required')`, 'fixture-order-3');
const [versionA, versionB] = await Promise.all([
  psql(claimSql(`select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${actorId}','${order3}',1,'${keyB}');`), 'version-a'),
  psql(claimSql(`select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${actorId}','${order3}',1,'${randomUUID()}');`), 'version-b'),
]);
const versionSuccesses = [versionA, versionB].filter((entry) => entry.code === 0).length;
const versionState = await query(`select status||':'||aggregate_version from public.product_orders where id='${order3}'`, 'version-state');
const versionOk = versionSuccesses === 1 && versionState === 'cancelled:2';
process.stdout.write(`${JSON.stringify({ type: 'assertion', name: 'different keys same version has one winner', ok: versionOk, detail: { successes: versionSuccesses, state: versionState } })}\n`);
if (!versionOk) process.exitCode = 1;

process.stdout.write(`${JSON.stringify({ type: 'classification', owner_submit: 'BLOCKED_EXTERNAL_AUTHORITY:QUALIFICATION_AUTHORITY_NOT_CONFIGURED', edit_before_warehouse: 'BLOCKED_EXTERNAL_AUTHORITY:SERVER_REPRICE_EDIT_ADAPTER_NOT_CONFIGURED' })}\n`);
