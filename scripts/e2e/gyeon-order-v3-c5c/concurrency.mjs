#!/usr/bin/env node
// GYEON_ORDER_V3_C5C_R4_CONCURRENCY
// Every race below runs as two independent OS `psql` processes plus a third
// observer connection. No Promise-only simulation, no shared database
// session, and no single-connection pseudo-parallelism is accepted as proof.
// This file implements exactly the ten races in plan section C5C-7.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const CONFIRM = 'I_UNDERSTAND_GYEON_ORDER_V3_C5C_IS_DISPOSABLE';
const dbUrl = process.env.C5C_DB_URL;
if (process.env.GYEON_ORDER_V3_C5C_DISPOSABLE_CONFIRM !== CONFIRM) throw new Error('C5C_CONCURRENCY_ERROR: explicit disposable confirmation is missing');
if (!dbUrl) throw new Error('C5C_CONCURRENCY_ERROR: C5C_DB_URL is required');
const db = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(db.hostname)) throw new Error('C5C_CONCURRENCY_ERROR: database URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(dbUrl)) throw new Error('C5C_CONCURRENCY_ERROR: database URL must never resolve to a hosted Supabase host');

const suffix = process.env.GYEON_ORDER_V3_C5C_SUFFIX ?? randomUUID().slice(0, 8);

// Every psql invocation is bounded. A process that hangs (e.g. a genuine
// deadlock) is killed and classified TIMEOUT -- a disqualifying UNKNOWN
// result, never guessed as a pass or a clean fail.
const PROCESS_TIMEOUT_MS = 20000;

function psql(sql, label) {
  return new Promise((resolve) => {
    const child = spawn('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PAGER: 'cat', PGAPPNAME: `gyeon-c5c-${label}` },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, code: 'TIMEOUT', stdout: stdout.trim(), stderr: stderr.trim(), timedOut: true });
    }, PROCESS_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ label, code, stdout: stdout.trim(), stderr: stderr.trim(), timedOut: false });
    });
  });
}

async function query(sql, label) {
  const result = await psql(sql, label);
  if (result.timedOut) throw new Error(`${label} timed out after ${PROCESS_TIMEOUT_MS}ms: UNKNOWN, not guessed`);
  if (result.code !== 0) throw new Error(`${label} failed: ${result.stderr}`);
  return result.stdout;
}

// Every genuine race invocation uses this wrapper so the exact backend PID
// that ran it is captured as proof of a distinct OS/database session, never
// inferred or assumed. A timed-out invocation never yields a fabricated PID.
async function psqlWithPid(sql, label) {
  const result = await psql(`select pg_backend_pid();\n${sql}`, label);
  if (result.timedOut) return { ...result, pid: null };
  const lines = result.stdout.split('\n');
  const pid = Number(lines[0]);
  return { ...result, pid, stdout: lines.slice(1).join('\n') };
}

// Runs the two racing invocations for one named race, polls an independent
// third connection mid-flight to prove both sessions are simultaneously
// "active" in pg_stat_activity (not merely started back-to-back), and
// records distinct-PID evidence for that race. A TIMEOUT on either side is
// classified UNKNOWN and always disqualifies the race.
async function raceTwo(raceName, sqlA, labelA, sqlB, labelB) {
  const promiseA = psqlWithPid(sqlA, labelA);
  const promiseB = psqlWithPid(sqlB, labelB);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const observedActive = await query(
    `select count(distinct pid) from pg_stat_activity where application_name in ('gyeon-c5c-${labelA}','gyeon-c5c-${labelB}') and state = 'active'`,
    `${raceName}-observer`,
  );
  const [a, b] = await Promise.all([promiseA, promiseB]);
  const timedOut = Boolean(a.timedOut || b.timedOut);
  if (timedOut) {
    record(`${raceName}: a racing process exceeded the bounded timeout`, false, { classification: 'UNKNOWN', aCode: a.code, bCode: b.code });
  }
  const distinctPids = timedOut ? false : recordPids(raceName, labelA, labelB, a.pid, b.pid);
  const activeObserved = observedActive === '2';
  if (!timedOut && !activeObserved) {
    record(`${raceName}: an independent third connection did not observe two simultaneously active sessions`, false, { observedActive });
  }
  return { a, b, distinctPids, activeObserved, timedOut, proven: !timedOut && distinctPids && activeObserved };
}

const backendPids = [];
const raceResults = [];
function record(name, ok, detail) {
  raceResults.push({ name, ok, detail });
  process.stdout.write(`${JSON.stringify({ type: 'assertion', name, ok, detail })}\n`);
  if (!ok) process.exitCode = 1;
}
function recordPids(raceName, labelA, labelB, pidA, pidB) {
  const distinct = pidA && pidB && pidA !== pidB;
  backendPids.push({ race: raceName, a: { label: labelA, pid: pidA }, b: { label: labelB, pid: pidB }, distinct });
  process.stdout.write(`${JSON.stringify({ type: 'backend_pid', race: raceName, a: pidA, b: pidB, distinct })}\n`);
  if (!distinct) process.exitCode = 1;
  return distinct;
}

async function racePids(sqlA, labelA, sqlB, labelB) {
  const [a, b] = await Promise.all([psql(sqlA, labelA), psql(sqlB, labelB)]);
  return { a, b };
}

async function backendPidOf(label) {
  return Number(await query(`select pid from pg_stat_activity where application_name = 'gyeon-c5c-${label}' order by backend_start desc limit 1`, `${label}-pid-lookup`));
}

function claimSql(actorId, body) {
  return `begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${actorId}',true);
select set_config('request.jwt.claims','{"sub":"${actorId}","role":"authenticated"}',true);
${body}
commit;`;
}

// A short server-side pg_sleep inside each race's first statement widens the
// interleaving window so both sessions are provably active at once, without
// changing the transaction's final outcome (the sleep runs before the
// contended lock is taken).
const WIDEN = "select pg_sleep(0.4);";

// ---------------------------------------------------------------------------
// Shared fixture: one dealer, one owner actor, catalog, calendar, and a
// handful of independent draft/submitted orders -- one per race family so
// races never interfere with each other's rows.
// ---------------------------------------------------------------------------

const dealerId = randomUUID();
const ownerId = randomUUID();
const productId = randomUUID();

await query(`
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','${ownerId}','authenticated','authenticated','c5c-concurrency-${suffix}@example.invalid','',now(),'{}','{}',now(),now());
insert into public.dealers(id,name,dealer_type,status) values ('${dealerId}','C5C Concurrency Dealer','GYEON_DETAILER','active');
insert into public.dealer_members(dealer_id,user_id,role,status) values ('${dealerId}','${ownerId}','owner','active');
insert into public.gyeon_ordering_memberships(dealer_id,membership_status,buyer_rank,effective_from) values ('${dealerId}','active','detailer',now()-interval '1 day');
insert into public.gyeon_dealer_qualification_mode_projection(dealer_id,qualification_mode,projection_version,authority_state,effective_from) values ('${dealerId}','none',1,'CONFIGURED',now()-interval '1 day');
insert into public.gyeon_products(id,sku,product_name,category,is_active) values ('${productId}','C5C-CONC','C5C Concurrency Product','coating',true);
insert into public.gyeon_product_order_offers_v3(product_id,buyer_rank,tax_rate_bps,list_price_ex_tax_yen,list_price_inc_tax_yen,purchase_price_ex_tax_yen,purchase_price_inc_tax_yen,backorder_permitted,publication_state,is_sellable,offer_version,effective_from,authority_updated_at)
values ('${productId}','detailer',1000,20000,22000,15000,16500,true,'published',true,1,now()-interval '1 day',now());
insert into public.gyeon_order_supply_projection(product_id,authority_state,formal_inventory_qty,reserved_qty,inbound_confirmed_pending_stocktake_qty,orderable_qty,backorder_allowed,source_version,observed_at)
values ('${productId}','CONFIGURED',100,0,0,100,true,'c5c-conc-v1',now());
-- gyeon_warehouse_calendar_days has a single global warehouse_date primary
-- key (it is not dealer-scoped). real-auth.mjs commits a row for today in
-- the same disposable database, so this insert must not assume no prior row
-- exists for any date in this range.
insert into public.gyeon_warehouse_calendar_days(warehouse_date,operating_mode,cutoff_minute_jst,calendar_version)
select ((now() at time zone 'Asia/Tokyo')::date + g), 'normal', 1439, 1 from generate_series(0,6) g
on conflict (warehouse_date) do nothing;
`, 'fixture');

function draftOrderSql(orderId) {
  return `
insert into public.product_orders(id,dealer_id,status,created_by,aggregate_version,owner_review_state,payment_status,destination_kind,delivery_snapshot,merchandise_list_ex_tax_yen,shipping_fee_ex_tax_yen,tax_yen,grand_total_inc_tax_yen,contains_backorder)
values ('${orderId}','${dealerId}','draft','${ownerId}',1,'not_requested','selection_required','own_store','{}'::jsonb,20000,0,2000,22000,false);
insert into public.product_order_items(order_id,product_id,sku,product_name_snapshot,retail_price_snapshot,quantity,subtotal,list_price_ex_tax_snapshot)
values ('${orderId}','${productId}','C5C-CONC','C5C Concurrency Product',22000,1,15000,20000);
`;
}

// ===========================================================================
// Race 1: two independent processes insert the same (provider,
// provider_event_id) evidence row concurrently. Exactly one may commit.
// ===========================================================================

{
  const orderId = randomUUID();
  await query(draftOrderSql(orderId), 'r1-fixture');
  const eventId = `evt-race1-${suffix}`;
  const insertSql = (evidenceId) => `${WIDEN}
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash)
values ('${evidenceId}','initial_authorization','stub_card_psp','${eventId}','${dealerId}','${orderId}',1,'fp-race1',22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-race1');`;

  const { a, b, proven } = await raceTwo('race-1', insertSql(randomUUID()), 'race1-a', insertSql(randomUUID()), 'race1-b');
  const successes = [a, b].filter((r) => r.code === 0).length;
  const rowCount = await query(`select count(*) from public.gyeon_order_external_evidence_v1 where provider_event_id = '${eventId}'`, 'race1-observer');
  const ok = proven && successes === 1 && rowCount === '1';
  record('race 1: concurrent same-provider-event evidence insert has exactly one winner', ok, { successes, rowCount });
}

// ===========================================================================
// Race 2: identical owner-submit finalize (same prepared operation, same
// evidence, same idempotency key) run by two independent processes. Both
// must observe the identical canonical response; exactly one real transition
// occurs.
// ===========================================================================

{
  const orderId = randomUUID();
  const preparedId = randomUUID();
  const evidenceId = randomUUID();
  const idemKey = randomUUID();
  const fingerprint = await query(
    `select private.gyeon_order_v3_fingerprint('owner_submit_finalize','${orderId}',1,jsonb_build_object('payment_method','card','backorder_policy',null::text))`,
    'r2-fingerprint',
  );
  await query(`
${draftOrderSql(orderId)}
insert into public.gyeon_order_prepared_operations_v1(id,kind,dealer_id,order_id,expected_order_version,request_fingerprint,amount_inc_tax_yen,currency,evidence_purpose,prepared_by,expires_at)
values ('${preparedId}','owner_submit','${dealerId}','${orderId}',1,'${fingerprint}',22000,'JPY','initial_authorization','${ownerId}',now()+interval '10 minutes');
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash)
values ('${evidenceId}','initial_authorization','stub_card_psp','evt-race2-${suffix}','${dealerId}','${orderId}',1,'${fingerprint}',22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-race2');
`, 'r2-fixture');

  const finalizeSql = claimSql(ownerId, `${WIDEN}
select public.finalize_gyeon_order_v3_owner_submit_rpc('${dealerId}','${ownerId}','${orderId}',1,'${idemKey}','card',null,'${preparedId}','${evidenceId}');`);

  const { a, b, proven } = await raceTwo('race-2', finalizeSql, 'race2-a', finalizeSql, 'race2-b');
  const bothOk = a.code === 0 && b.code === 0;
  const ledgerCount = await query(`select count(*) from public.gyeon_order_idempotency_v3 where dealer_id='${dealerId}' and idempotency_key='${idemKey}'`, 'race2-ledger');
  const orderState = await query(`select status||':'||aggregate_version from public.product_orders where id='${orderId}'`, 'race2-state');
  const consumedCount = await query(`select count(*) from public.gyeon_order_external_evidence_v1 where id='${evidenceId}' and consumed_at is not null`, 'race2-consumed');
  const ok = proven && bothOk && ledgerCount === '1' && orderState === 'submitted:2' && consumedCount === '1';
  record('race 2: identical concurrent finalize serializes to exactly one durable transition', ok, { a: a.code, b: b.code, ledgerCount, orderState, consumedCount });
}

// ===========================================================================
// Race 3: owner-submit finalize (bank transfer, no prepared operation) races
// cancel_before_warehouse on the same draft order and expected version.
// ===========================================================================

{
  const orderId = randomUUID();
  await query(draftOrderSql(orderId), 'r3-fixture');
  const finalizeSql = claimSql(ownerId, `${WIDEN}
select public.finalize_gyeon_order_v3_owner_submit_rpc('${dealerId}','${ownerId}','${orderId}',1,'${randomUUID()}','bank_transfer_prepaid',null);`);
  const cancelSql = claimSql(ownerId, `${WIDEN}
select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${ownerId}','${orderId}',1,'${randomUUID()}');`);

  const { a, b, proven } = await raceTwo('race-3', finalizeSql, 'race3-a', cancelSql, 'race3-b');
  const finalState = await query(`select status from public.product_orders where id='${orderId}'`, 'race3-state');
  const oneWinner = ['submitted', 'cancelled'].includes(finalState);
  const outcomes = [a, b];
  const successes = outcomes.filter((outcome) => outcome.code === 0).length;
  const loser = outcomes.find((outcome) => outcome.code !== 0);
  const expectedLoser = Boolean(
    loser
    && !loser.timedOut
    && /ORDER_VERSION_CONFLICT|OWNER_SUBMIT_NOT_ALLOWED/.test(loser.stderr),
  );
  const ok = proven && successes === 1 && expectedLoser && oneWinner;
  record('race 3: finalize and cancel on the same order/version resolve to exactly one winning status', ok, {
    finalState,
    successes,
    aCode: a.code,
    bCode: b.code,
    loserReason: expectedLoser ? 'expected_conflict' : 'unexpected',
  });
}

// ===========================================================================
// Race 4: two concurrent finalize calls that both detect the same newly
// succeeded card authorization must be denied (credit terms already active)
// and must generate at most one compensation-outbox row for it.
// ===========================================================================

{
  const orderId = randomUUID();
  const preparedId = randomUUID();
  const evidenceId = randomUUID();
  const fingerprint = await query(
    `select private.gyeon_order_v3_fingerprint('owner_submit_finalize','${orderId}',1,jsonb_build_object('payment_method','card','backorder_policy',null::text))`,
    'r4-fingerprint',
  );
  await query(`
${draftOrderSql(orderId)}
insert into public.gyeon_order_prepared_operations_v1(id,kind,dealer_id,order_id,expected_order_version,request_fingerprint,amount_inc_tax_yen,currency,evidence_purpose,prepared_by,expires_at)
values ('${preparedId}','owner_submit','${dealerId}','${orderId}',1,'${fingerprint}',22000,'JPY','initial_authorization','${ownerId}',now()+interval '10 minutes');
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash)
values ('${evidenceId}','initial_authorization','stub_card_psp','evt-race4-${suffix}','${dealerId}','${orderId}',1,'${fingerprint}',22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-race4');
insert into public.gyeon_dealer_credit_terms(dealer_id,credit_state,terms_version,effective_from) values ('${dealerId}','active',1,now()-interval '1 minute');
`, 'r4-fixture');

  const finalizeSql = (idemKey) => claimSql(ownerId, `${WIDEN}
select public.finalize_gyeon_order_v3_owner_submit_rpc('${dealerId}','${ownerId}','${orderId}',1,'${idemKey}','card',null,'${preparedId}','${evidenceId}');`);

  const { a, b, proven } = await raceTwo('race-4', finalizeSql(randomUUID()), 'race4-a', finalizeSql(randomUUID()), 'race4-b');
  const compCount = await query(`select count(*) from public.gyeon_order_external_compensation_outbox where evidence_id='${evidenceId}'`, 'race4-outbox');
  const ok = proven && a.code === 0 && b.code === 0 && compCount === '1';
  record('race 4: two concurrent denials for the same new authorization insert at most one compensation intent', ok, { compCount });
  await query(`delete from public.gyeon_dealer_credit_terms where dealer_id = '${dealerId}'`, 'r4-cleanup');
}

// ===========================================================================
// Race 5: two concurrent edit-finalize calls (amount-preserving path, no
// prepared operation) against the same submitted order and expected version.
// Exactly one succeeds; the other observes a version conflict, never both.
// ===========================================================================

{
  const orderId = randomUUID();
  await query(`
${draftOrderSql(orderId)}
update public.product_orders set status='submitted', owner_review_state='owner_confirmed', payment_method='bank_transfer_prepaid', payment_status='payment_pending', payment_contract_kind='standard_payment', aggregate_version=2 where id='${orderId}';
`, 'r5-fixture');

  const lines = `[{"product_id":"${productId}","quantity":1}]`;
  const editSql = claimSql(ownerId, `${WIDEN}
select public.finalize_gyeon_order_v3_edit_rpc('${dealerId}','${ownerId}','${orderId}',2,'${randomUUID()}','${lines}'::jsonb);`);

  const { a, b, proven } = await raceTwo('race-5', editSql, 'race5-a', editSql, 'race5-b');
  const finalVersion = await query(`select aggregate_version from public.product_orders where id='${orderId}'`, 'race5-state');
  const ok = proven && a.code === 0 && b.code === 0 && finalVersion === '3';
  record('race 5: concurrent amount-preserving edit finalize has exactly one winning version bump', ok, { finalVersion });
}

// ===========================================================================
// Race 6: warehouse release run twice concurrently on the same submitted,
// fully-authorized order. Exactly one unaccepted task is ever created.
// ===========================================================================

{
  const orderId = randomUUID();
  const reservationId = randomUUID();
  const cardEvidenceId = randomUUID();
  await query(`
${draftOrderSql(orderId)}
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,consumed_at,consumed_by_operation,payload_hash)
values ('${cardEvidenceId}','initial_authorization','stub_card_psp','evt-race6-card-${suffix}','${dealerId}','${orderId}',1,'fp-race6-card',22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes',now(),'owner_submit_finalize','hash-race6-card');
update public.product_orders
set status='submitted',
    owner_review_state='owner_confirmed',
    payment_method='card',
    payment_status='authorized',
    payment_contract_kind='standard_payment',
    earliest_ship_date=(now() at time zone 'Asia/Tokyo')::date,
    aggregate_version=2,
    card_authority_evidence_id='${cardEvidenceId}',
    card_authority_request_fingerprint='fp-race6-card'
where id='${orderId}';
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash)
select '${reservationId}','inventory_reservation','office_az_stub','evt-race6-inv-${suffix}','${dealerId}','${orderId}',2,private.gyeon_order_v3_fingerprint('inventory_reservation','${orderId}',2,'{}'::jsonb),22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-race6-inv';
`, 'r6-fixture');

  const releaseSql = (idemKey) => `${WIDEN}
select public.release_gyeon_order_v3_warehouse_rpc('${orderId}','${ownerId}','${idemKey}');`;

  const { a, b, proven } = await raceTwo('race-6', releaseSql(randomUUID()), 'race6-a', releaseSql(randomUUID()), 'race6-b');
  const taskCount = await query(`select count(*) from public.gyeon_order_warehouse_tasks where order_id='${orderId}'`, 'race6-tasks');
  const consumedCount = await query(`select count(*) from public.gyeon_order_external_evidence_v1 where id='${reservationId}' and consumed_at is not null`, 'race6-consumed');
  const ok = proven && a.code === 0 && b.code === 0 && taskCount === '1' && consumedCount === '1';
  record('race 6: concurrent warehouse release creates exactly one task and consumes reservation evidence exactly once', ok, { taskCount, consumedCount });
}

// ===========================================================================
// Race 7: warehouse accept run twice concurrently against the same
// unaccepted task. Exactly one accept wins; the loser never re-inserts.
// ===========================================================================

{
  const orderId = randomUUID();
  await query(`
${draftOrderSql(orderId)}
update public.product_orders set status='submitted', owner_review_state='owner_confirmed', payment_method='cash_on_delivery', payment_status='not_required', payment_contract_kind='standard_payment', aggregate_version=2 where id='${orderId}';
insert into public.gyeon_order_warehouse_tasks(order_id,dealer_id,task_state,task_version) values ('${orderId}','${dealerId}','unaccepted',1);
`, 'r7-fixture');

  const acceptSql = (idemKey) => `${WIDEN}
select public.accept_gyeon_order_v3_warehouse_rpc('${orderId}','${ownerId}',2,1,'${idemKey}');`;

  const { a, b, proven } = await raceTwo('race-7', acceptSql(randomUUID()), 'race7-a', acceptSql(randomUUID()), 'race7-b');
  const successes = [a, b].filter((r) => r.code === 0).length;
  const taskState = await query(`select task_state||':'||task_version from public.gyeon_order_warehouse_tasks where order_id='${orderId}'`, 'race7-task');
  const ok = proven && successes === 1 && taskState === 'accepted:2';
  record('race 7: concurrent warehouse accept has exactly one winner and never double-accepts', ok, { successes, taskState });
}

// ===========================================================================
// Race 8: cancel races accept on an order whose task is already unaccepted.
// Exactly one of {cancelled, approved} survives; never both.
// ===========================================================================

{
  const orderId = randomUUID();
  await query(`
${draftOrderSql(orderId)}
update public.product_orders set status='submitted', owner_review_state='owner_confirmed', payment_method='cash_on_delivery', payment_status='not_required', payment_contract_kind='standard_payment', aggregate_version=2 where id='${orderId}';
insert into public.gyeon_order_warehouse_tasks(order_id,dealer_id,task_state,task_version) values ('${orderId}','${dealerId}','unaccepted',1);
`, 'r8-fixture');

  const cancelSql = claimSql(ownerId, `${WIDEN}
select public.cancel_gyeon_order_v3_before_warehouse_rpc('${dealerId}','${ownerId}','${orderId}',2,'${randomUUID()}');`);
  const acceptSql = `${WIDEN}
select public.accept_gyeon_order_v3_warehouse_rpc('${orderId}','${ownerId}',2,1,'${randomUUID()}');`;

  const { a, b, proven } = await raceTwo('race-8', cancelSql, 'race8-a', acceptSql, 'race8-b');
  const finalState = await query(`select status from public.product_orders where id='${orderId}'`, 'race8-state');
  const oneWinner = ['cancelled', 'approved'].includes(finalState);
  const oneSucceeded = [a, b].filter((r) => r.code === 0).length === 1;
  const ok = proven && oneWinner && oneSucceeded;
  record('race 8: cancel and warehouse accept on the same order resolve to exactly one final state', ok, { finalState, aCode: a.code, bCode: b.code });
}

// ===========================================================================
// Race 9: a new card authorization succeeds (evidence becomes succeeded)
// concurrently with credit-account terms activation, immediately followed by
// finalize. Regardless of interleaving, the outcome is either a clean
// success or a single durable compensation intent -- never both, never
// neither, and the original order is corrupted in no case.
// ===========================================================================

{
  const orderId = randomUUID();
  const preparedId = randomUUID();
  const evidenceId = randomUUID();
  const fingerprint = await query(
    `select private.gyeon_order_v3_fingerprint('owner_submit_finalize','${orderId}',1,jsonb_build_object('payment_method','card','backorder_policy',null::text))`,
    'r9-fingerprint',
  );
  await query(`
${draftOrderSql(orderId)}
insert into public.gyeon_order_prepared_operations_v1(id,kind,dealer_id,order_id,expected_order_version,request_fingerprint,amount_inc_tax_yen,currency,evidence_purpose,prepared_by,expires_at)
values ('${preparedId}','owner_submit','${dealerId}','${orderId}',1,'${fingerprint}',22000,'JPY','initial_authorization','${ownerId}',now()+interval '10 minutes');
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash)
values ('${evidenceId}','initial_authorization','stub_card_psp','evt-race9-${suffix}','${dealerId}','${orderId}',1,'${fingerprint}',22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-race9');
`, 'r9-fixture');

  const activateCreditSql = `${WIDEN}
insert into public.gyeon_dealer_credit_terms(dealer_id,credit_state,terms_version,effective_from) values ('${dealerId}','active',1,now());`;
  const finalizeSql = claimSql(ownerId, `${WIDEN}
select public.finalize_gyeon_order_v3_owner_submit_rpc('${dealerId}','${ownerId}','${orderId}',1,'${randomUUID()}','card',null,'${preparedId}','${evidenceId}');`);

  const { a: creditRace, b: finalizeRace, proven } = await raceTwo('race-9', activateCreditSql, 'race9-credit', finalizeSql, 'race9-finalize');
  const finalOrder = await query(`select coalesce(status,'')||':'||coalesce(payment_contract_kind,'none') from public.product_orders where id='${orderId}'`, 'race9-order');
  const compCount = await query(`select count(*) from public.gyeon_order_external_compensation_outbox where evidence_id='${evidenceId}'`, 'race9-outbox');
  const cleanSuccess = finalOrder === 'submitted:standard_payment' && compCount === '0';
  const cleanDenial = finalOrder === 'draft:none' && compCount === '1';
  const ok = proven && creditRace.code === 0 && finalizeRace.code === 0 && (cleanSuccess || cleanDenial);
  record('race 9: new-authorization-vs-credit-activation race is always either a clean success or exactly one compensation intent', ok, { finalOrder, compCount });
}

// ===========================================================================
// Race 10: a card order already finalized under a frozen standard-payment
// snapshot races warehouse release against a concurrent credit-terms
// activation. Release must complete under the original frozen contract
// regardless of interleaving; no automatic void intent is ever created.
// ===========================================================================

{
  const orderId = randomUUID();
  const cardEvidenceId = randomUUID();
  const reservationId = randomUUID();
  await query(`
${draftOrderSql(orderId)}
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,consumed_at,consumed_by_operation,payload_hash)
values ('${cardEvidenceId}','initial_authorization','stub_card_psp','evt-race10-card-${suffix}','${dealerId}','${orderId}',1,'fp-race10-card',22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes',now(),'owner_submit_finalize','hash-race10-card');
update public.product_orders
set status='submitted',
    owner_review_state='owner_confirmed',
    payment_method='card',
    payment_status='authorized',
    payment_contract_kind='standard_payment',
    earliest_ship_date=(now() at time zone 'Asia/Tokyo')::date,
    aggregate_version=2,
    card_authority_evidence_id='${cardEvidenceId}',
    card_authority_request_fingerprint='fp-race10-card'
where id='${orderId}';
insert into public.gyeon_order_external_evidence_v1(id,purpose,provider,provider_event_id,dealer_id,order_id,order_version,request_fingerprint,amount_inc_tax_yen,currency,authority,state,server_verified_at,expires_at,payload_hash)
select '${reservationId}','inventory_reservation','office_az_stub','evt-race10-inv-${suffix}','${dealerId}','${orderId}',2,private.gyeon_order_v3_fingerprint('inventory_reservation','${orderId}',2,'{}'::jsonb),22000,'JPY','server_verified','succeeded',now(),now()+interval '10 minutes','hash-race10-inv';
`, 'r10-fixture');

  const activateCreditSql = `${WIDEN}
insert into public.gyeon_dealer_credit_terms(dealer_id,credit_state,terms_version,effective_from) values ('${dealerId}','active',1,now());`;
  const releaseSql = `${WIDEN}
select public.release_gyeon_order_v3_warehouse_rpc('${orderId}','${ownerId}','${randomUUID()}');`;

  const { a: creditRace, b: releaseRace, proven } = await raceTwo('race-10', activateCreditSql, 'race10-credit', releaseSql, 'race10-release');
  const taskState = await query(`select task_state from public.gyeon_order_warehouse_tasks where order_id='${orderId}'`, 'race10-task');
  const snapshotUnchanged = await query(`select payment_contract_kind from public.product_orders where id='${orderId}'`, 'race10-snapshot');
  const noAutoVoid = await query(`select count(*) from public.gyeon_order_external_compensation_outbox where evidence_id='${cardEvidenceId}'`, 'race10-outbox');
  const ok = proven && creditRace.code === 0 && releaseRace.code === 0 && taskState === 'unaccepted' && snapshotUnchanged === 'standard_payment' && noAutoVoid === '0';
  record('race 10: warehouse release completes under the frozen standard-payment contract despite a concurrent credit-terms activation', ok, { taskState, snapshotUnchanged, noAutoVoid });
}

// ---------------------------------------------------------------------------
// Third-observer proof. Every race above widens its interleaving window with
// the same server-side pg_sleep and records each side's own backend PID, but
// this section additionally proves -- from a fully independent third
// connection querying pg_stat_activity -- that two racing sessions are
// genuinely concurrently active at the database level, not merely started
// back-to-back by the OS scheduler.
// ---------------------------------------------------------------------------

{
  const orderId = randomUUID();
  await query(draftOrderSql(orderId), 'observer-fixture');
  const holdA = psql(`select pg_backend_pid(); ${WIDEN}`, 'observer-hold-a');
  const holdB = psql(`select pg_backend_pid(); ${WIDEN}`, 'observer-hold-b');
  await new Promise((resolve) => setTimeout(resolve, 150));
  const observedActive = await query(
    "select count(distinct pid) from pg_stat_activity where application_name in ('gyeon-c5c-observer-hold-a','gyeon-c5c-observer-hold-b') and state = 'active'",
    'third-observer',
  );
  const [heldA, heldB] = await Promise.all([holdA, holdB]);
  const pidA = Number(heldA.stdout.split('\n')[0]);
  const pidB = Number(heldB.stdout.split('\n')[0]);
  const distinct = recordPids('third-observer-proof', 'observer-hold-a', 'observer-hold-b', pidA, pidB);
  record('an independent third connection observes two simultaneously active distinct backend PIDs', heldA.code === 0 && heldB.code === 0 && observedActive === '2' && distinct, { observedActive, pidA, pidB });
}

const passed = raceResults.filter((entry) => entry.ok).length;
process.stdout.write(`${JSON.stringify({ type: 'summary', passed, total: raceResults.length, backend_pids_recorded: backendPids.length, secrets_logged: false })}\n`);
if (passed !== raceResults.length) process.exitCode = 1;
