#!/usr/bin/env node
// GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_CONCURRENCY
// Implements exactly the two deterministic offering/save interleavings the
// governing directive requires. Every racing step below runs as a separate OS
// `psql` process; a third observer connection proves genuine simultaneous
// activity where required. No Promise-only simulation, no shared database
// session, and no single-connection pseudo-parallelism is accepted as proof.
//
// Structurally reuses the accepted scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs
// spawn/timeout/PID-proof idioms. It copies no GYEON-order fixture, table,
// RPC name, or evidence vocabulary; every fixture and assertion below belongs
// to the Estimate Wizard managed-service offering guard only.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const CONFIRM = 'I_UNDERSTAND_GDA_ESTIMATE_OFFERING_R1B_IS_DISPOSABLE';
const dbUrl = process.env.R1B_DB_URL;
if (process.env.GDA_ESTIMATE_OFFERING_R1B_DISPOSABLE_CONFIRM !== CONFIRM) throw new Error('R1B_CONCURRENCY_ERROR: explicit disposable confirmation is missing');
if (!dbUrl) throw new Error('R1B_CONCURRENCY_ERROR: R1B_DB_URL is required');
const db = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(db.hostname)) throw new Error('R1B_CONCURRENCY_ERROR: database URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(dbUrl)) throw new Error('R1B_CONCURRENCY_ERROR: database URL must never resolve to a hosted Supabase host');

const suffix = process.env.GDA_ESTIMATE_OFFERING_R1B_SUFFIX ?? randomUUID().slice(0, 8);

// Every psql invocation is bounded. A process that hangs (e.g. a genuine
// deadlock) is killed and classified TIMEOUT -- a disqualifying UNKNOWN
// result, never guessed as a pass or a clean fail.
const PROCESS_TIMEOUT_MS = 20000;

function psql(sql, label) {
  return new Promise((resolve) => {
    const child = spawn('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PAGER: 'cat', PGAPPNAME: `gda-r1b-${label}` },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, code: 'TIMEOUT', stdout: stdout.trim(), stderr: stderr.trim(), timedOut: true, finishedAt: Date.now() });
    }, PROCESS_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ label, code, stdout: stdout.trim(), stderr: stderr.trim(), timedOut: false, finishedAt: Date.now() });
    });
  });
}

// Start one controllable psql session that keeps its transaction and row lock
// open until release() is called. The holder emits its PID only AFTER the
// SELECT ... FOR UPDATE statement has completed, so HOLDER_READY is direct
// proof that the target row lock was acquired. There is deliberately no
// pg_sleep-based auto-release: the caller controls the ordering explicitly.
function startControlledHolder(dealerId, label) {
  const child = spawn('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PAGER: 'cat', PGAPPNAME: `gda-r1b-${label}` },
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let readySettled = false;
  let releaseRequested = false;
  let resolveReady;
  let rejectReady;
  let resolveDone;

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const done = new Promise((resolve) => { resolveDone = resolve; });

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill('SIGKILL');
    if (!readySettled) {
      readySettled = true;
      rejectReady(new Error(`${label} timed out before HOLDER_READY after ${PROCESS_TIMEOUT_MS}ms: UNKNOWN, not guessed`));
    }
    resolveDone({ label, code: 'TIMEOUT', stdout: stdout.trim(), stderr: stderr.trim(), timedOut: true, pid: null });
  }, PROCESS_TIMEOUT_MS);

  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    const match = stdout.match(/R1B_HOLDER_READY\|(\d+)/);
    if (match && !readySettled) {
      readySettled = true;
      resolveReady({ pid: Number(match[1]), marker: match[0] });
    }
  });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.on('error', () => {
    // A close event provides the authoritative result and captured stderr.
  });
  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (!readySettled) {
      readySettled = true;
      rejectReady(new Error(`${label} exited before HOLDER_READY (code=${code}): ${stderr.trim()}`));
    }
    const marker = stdout.match(/R1B_HOLDER_READY\|(\d+)/);
    resolveDone({
      label,
      code,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      timedOut: false,
      pid: marker ? Number(marker[1]) : null,
    });
  });

  child.stdin.write(`begin;
select 1 from public.document_sequences
 where dealer_id = '${dealerId}'
   and sequence_type = 'estimate'
   and fiscal_year = 0
 for update;
select 'R1B_HOLDER_READY|' || pg_backend_pid();
`);

  return {
    appName: `gda-r1b-${label}`,
    ready,
    done,
    release() {
      if (releaseRequested || settled) return;
      releaseRequested = true;
      child.stdin.write("commit;\n\\q\n");
      child.stdin.end();
    },
    abort() {
      if (!settled) child.kill('SIGKILL');
    },
  };
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

// Bounded polling primitive: retries fn() until it reports { ok: true, value
// }, or throws on a monotonic deadline. A timeout, ambiguous result, or
// missing PID is a hard failure -- never guessed as a pass, never satisfied
// by a fixed sleep.
async function pollUntil(fn, { timeoutMs = 8000, intervalMs = 100, label }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result && result.ok) return result.value;
    if (Date.now() >= deadline) {
      throw new Error(`${label} timed out after ${timeoutMs}ms: UNKNOWN, not guessed`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Discover a backend's real PID from pg_stat_activity by its distinct
// PGAPPNAME, without ever reading that backend's own (still-blocked) stdout.
async function findBackendPid(appName) {
  const raw = await query(
    `select pid from pg_stat_activity where application_name = '${appName}' order by backend_start desc limit 1`,
    `find-pid-${appName}`,
  );
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function estimatePayloadJson(idempotencyKey, category, configurationRevision = null) {
  const payload = {
    idempotencyKey,
    customer: {
      mode: 'new', name: 'R1B Concurrency Customer', phone: '090-0000-0000', email: 'r1b-conc@example.test',
      postalCode: '1000001', address: '東京都', lineId: '',
      isBusiness: false, tradeRatePercent: null,
      accountsReceivableAllowed: false, closingDay: null, paymentDay: null,
    },
    vehicle: {
      mode: 'new', maker: 'TOYOTA', model: 'CROWN', grade: '', vehicleCode: '', vin: '',
      firstRegistration: '', registrationDate: '', inspectionExpiry: '',
      displacement: '', color: '', plateNumber: '', bodySizeKey: 'M',
    },
    services: [{
      lineId: `manual:${category}:conc-a`, category, wizardCategory: category, pricingSource: 'manual',
      pricingReferenceId: null, manualPricingIdentity: `${category}:conc-a`,
      pricingPolicy: 'manual_only', manualPricePolicy: 'required',
      label: 'R1B Concurrency Line', description: null,
      quantity: 1, unitPrice: 5000, lineTotal: 5000,
      optionReferenceIds: [], lineMetadata: {},
    }],
    nonPriceableSelections: [],
    discountIntent: { mode: 'none', fixedAmount: null, percentage: null, percentageSupported: false },
    discountAppliedAmount: null,
    couponIntent: { selectedCouponIds: [], status: 'none' },
    couponAppliedAmount: null,
    pricingSnapshot: {
      currency: 'JPY', completeness: 'complete',
      subtotal: 5000, discountTotal: 0, couponTotal: 0, taxableSubtotal: 5000,
      taxRatePercent: 10, taxTotal: 500, grandTotal: 5500,
      warnings: [], errors: [],
    },
    notes: { customerNotes: '', internalMemo: '' },
    metadata: {
      source: 'estimate-wizard-v2.2', schemaVersion: '2.2', createdFromWizard: true,
      draftLastUpdatedAt: new Date().toISOString(), previewConfirmed: true,
      configurationRevision,
    },
  };
  // Single-quote-safe for embedding as a SQL string literal.
  return JSON.stringify(payload).replace(/'/g, "''");
}

function saveCallSql(dealerId, actorId, payloadJson) {
  return `begin;
set local role service_role;
select public.save_estimate_from_wizard('${dealerId}'::uuid, '${actorId}'::uuid, '${payloadJson}'::jsonb);
commit;`;
}

// ===========================================================================
// Shared fixture: two independent dealers, one owner actor each, so the two
// races never interfere with each other's rows.
// ===========================================================================

const dealer1 = randomUUID();
const owner1 = randomUUID();
const dealer2 = randomUUID();
const owner2 = randomUUID();

await query(`
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','${owner1}','authenticated','authenticated','r1b-conc-1-${suffix}@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','${owner2}','authenticated','authenticated','r1b-conc-2-${suffix}@example.invalid','',now(),'{}','{}',now(),now());
insert into public.dealers(id,name) values
  ('${dealer1}','R1B Concurrency Dealer 1'),
  ('${dealer2}','R1B Concurrency Dealer 2');
insert into public.dealer_members(dealer_id,user_id,role,status) values
  ('${dealer1}','${owner1}','owner','active'),
  ('${dealer2}','${owner2}','owner','active');
`, 'fixture');

// ===========================================================================
// Race 1: disable-before-snapshot.
//
// The offering disable is COMMITTED, in full, on its own connection, before
// the save starts on a second, separate connection. This is a deterministic
// ordering, not an unconstrained race: the save's C.9a snapshot can only ever
// observe the already-disabled state, so it MUST reject. Zero writes for
// customer, vehicle, estimate, item, and document number are then proved.
// ===========================================================================

{
  const key = `r1bdisablefirst${suffix}`.slice(0, 60);
  await query(`insert into public.dealer_service_offerings(dealer_id,family,enabled) values ('${dealer1}','ppf',true);`, 'race1-enable-fixture');

  const disable = await psqlWithPid(`update public.dealer_service_offerings set enabled = false where dealer_id = '${dealer1}' and family = 'ppf';`, 'race1-disable');
  if (disable.timedOut || disable.code !== 0) {
    record('race 1: the offering disable committed cleanly before the save started', false, { code: disable.code });
  } else {
    record('race 1: the offering disable committed cleanly before the save started', true, { pid: disable.pid });
  }

  // The exact post-disable configuration revision, read from a separate
  // bounded query AFTER the disable committed. The frozen deterministic
  // contract requires the fresh save's own payload to carry this exact
  // revision.
  const postDisableRevision = await query(
    `select current_configuration_revision from public.dealer_wizard_catalog_lifecycle where dealer_id = '${dealer1}'`,
    'race1-post-disable-revision',
  );
  const postDisableRevisionNumber = Number(postDisableRevision);
  record('race 1: the post-disable configuration revision was read from a separate bounded query',
    Number.isInteger(postDisableRevisionNumber), { postDisableRevision });

  const stateSql = (label) => `select ${label}||'|'||(select count(*) from public.customers)||'|'||(select count(*) from public.vehicles)||'|'||(select count(*) from public.estimates)||'|'||(select count(*) from public.estimate_items)||'|'||coalesce((select current_number from public.document_sequences where dealer_id='${dealer1}' and sequence_type='estimate' and fiscal_year=0),0)||'|'||(select count(*) from public.estimates where dealer_id='${dealer1}' and idempotency_key='${key}')||'|'||(select current_configuration_revision from public.dealer_wizard_catalog_lifecycle where dealer_id='${dealer1}')`;
  const beforeState = await query(stateSql("'before'"), 'race1-before');

  const saveSql = saveCallSql(dealer1, owner1, estimatePayloadJson(key, 'ppf', postDisableRevisionNumber));
  const save = await psqlWithPid(saveSql, 'race1-save');
  const rejectedCorrectly = !save.timedOut && save.code !== 0 && /service-not-offered/.test(save.stderr);
  record('race 1: a fresh direct RPC save carrying the exact post-disable configuration revision rejects with service-not-offered',
    rejectedCorrectly, { code: save.code, stderrTail: save.stderr.slice(-200) });

  const afterState = await query(stateSql("'after'"), 'race1-after');
  record('race 1: customer/vehicle/estimate/item/document-number/idempotency-record/lifecycle-revision state is unchanged after the rejection (baseline = post-disable, pre-save)',
    beforeState.replace(/^before\|/, '') === afterState.replace(/^after\|/, ''), { before: beforeState, after: afterState });

  recordPids('race-1-distinct-backends', 'race1-disable', 'race1-save', disable.pid, save.pid);
}

// ===========================================================================
// Race 2: snapshot-before-disable.
//
// The family starts enabled. A holder connection locks the dealer's
// document_sequences row (FOR UPDATE, uncommitted) so the save can pass C.9a
// but blocks at the first C.10 number-allocation write. While the save is
// genuinely blocked there (proved via pg_stat_activity/pg_locks from a third
// connection), a separate connection commits the offering disable. The
// holder then releases the lock; the save must complete successfully from
// its earlier guard snapshot, with one complete estimate and no partial or
// torn state.
// ===========================================================================

{
  const key = `r1bsnapshotfirst${suffix}`.slice(0, 60);
  await query(`
insert into public.dealer_service_offerings(dealer_id,family,enabled) values ('${dealer2}','maintenance',true);
insert into public.document_sequences(dealer_id,sequence_type,fiscal_year,prefix,padding,reset_policy,current_number)
values ('${dealer2}','estimate',0,'EST',5,'never',0);
`, 'race2-fixture');

  const saveAppName = 'gda-r1b-race2-save';
  const holder = startControlledHolder(dealer2, 'race2-holder');
  const holderReady = await holder.ready;
  const holderPid = holderReady.pid;
  record('race 2: the holder backend genuinely acquired the document_sequences row lock and remains explicitly held',
    Boolean(holderPid), { holderPid, marker: holderReady.marker });

  const savePromise = psqlWithPid(saveCallSql(dealer2, owner2, estimatePayloadJson(key, 'maintenance')), 'race2-save');

  // Discover the save's real backend PID from pg_stat_activity WITHOUT
  // waiting for the save itself to finish -- it is deliberately still
  // blocked. This is the exact PID every proof below uses.
  const savePid = await pollUntil(async () => {
    const pid = await findBackendPid(saveAppName);
    return pid ? { ok: true, value: pid } : { ok: false };
  }, { timeoutMs: 8000, intervalMs: 100, label: 'race 2 save backend discovery' });
  record('race 2: the save backend PID was captured without waiting for the save to finish', Boolean(savePid), { savePid });

  // Third, fully independent observer connection. Bounded polling proves,
  // BEFORE the offering disable commits: distinct holder/save/observer
  // backends, the save waiting on a Lock event, pg_blocking_pids(save)
  // containing the holder, relation-lock evidence for both backends tied to
  // document_sequences, and that the save has not completed.
  const observation = await pollUntil(async () => {
    // One atomic observer query returns every proof field from the same
    // backend and statement snapshot. The returned observer PID therefore
    // really belongs to the connection that collected the evidence.
    const raw = await query(`
select json_build_object(
  'observerPid', pg_backend_pid(),
  'waitEventType', coalesce((select wait_event_type from pg_stat_activity where pid = ${savePid}), ''),
  'blockingPids', pg_blocking_pids(${savePid}),
  'saveHasLockEvidence', exists(
    select 1 from pg_locks where pid = ${savePid} and relation = 'public.document_sequences'::regclass
  ),
  'holderHasLockEvidence', exists(
    select 1 from pg_locks where pid = ${holderPid} and relation = 'public.document_sequences'::regclass and granted = true
  ),
  'saveStillRunning', exists(select 1 from pg_stat_activity where pid = ${savePid})
)::text`, 'race2-observer-snapshot');
    const snapshot = JSON.parse(raw);
    const distinct = Number.isInteger(snapshot.observerPid)
      && snapshot.observerPid !== holderPid && snapshot.observerPid !== savePid;
    const ok = distinct && snapshot.waitEventType === 'Lock'
      && snapshot.blockingPids.includes(holderPid)
      && snapshot.saveHasLockEvidence === true
      && snapshot.holderHasLockEvidence === true
      && snapshot.saveStillRunning === true;
    return ok ? { ok: true, value: snapshot } : { ok: false };
  }, { timeoutMs: 8000, intervalMs: 100, label: 'race 2 blocked-save proof' });
  record('race 2: bounded polling proves distinct holder/save/observer backends, the save waiting on Lock, pg_blocking_pids(save) containing the holder, relation-lock evidence for both, and the save not yet completed',
    true, observation);
  recordPids('race-2-holder-vs-save-distinct-backends', 'race2-holder', 'race2-save', holderPid, savePid);
  recordPids('race-2-save-vs-observer-distinct-backends', 'race2-save', 'race2-observer', savePid, observation.observerPid);

  // Only now, with the blocked-save proof established, commit the offering
  // disable from another distinct backend. Only after that command has
  // completed do we explicitly release the holder's transaction and row
  // lock. No timer or fixed sleep is allowed to release it early.
  const disable = await psqlWithPid(`update public.dealer_service_offerings set enabled = false where dealer_id = '${dealer2}' and family = 'maintenance';`, 'race2-disable');
  record('race 2: the offering disable commits, from another distinct backend, only after the save was proven blocked past its guard snapshot',
    !disable.timedOut && disable.code === 0, { code: disable.code });
  recordPids('race-2-save-vs-disable-distinct-backends', 'race2-save', 'race2-disable', savePid, disable.pid);

  holder.release();
  const [holderResult, save] = await Promise.all([holder.done, savePromise]);
  const holderPidFromStdout = holderResult.pid;
  record('race 2: the holder backend PID observed live via pg_stat_activity matches the PID it reported itself',
    holderPidFromStdout === holderPid, { holderPidFromStdout, holderPid });
  record('race 2: the holder transaction committed cleanly only after the disable command completed',
    !holderResult.timedOut && holderResult.code === 0, { code: holderResult.code });

  const saveSucceeded = !save.timedOut && save.code === 0;
  record('race 2: the save completes successfully from its earlier (still-enabled) guard snapshot',
    saveSucceeded, { code: save.code, stderrTail: save.timedOut ? '' : save.stderr.slice(-200) });
  record('race 2: the save backend PID captured live before completion matches the PID the completed save reports',
    save.pid === savePid, { livePid: savePid, completedPid: save.pid });

  const estimateState = await query(
    `select coalesce((select count(*)::text from public.estimates where dealer_id='${dealer2}' and idempotency_key='${key}'),'0')||'|'||
            coalesce((select ei.item_count::text from (select estimate_id, count(*) item_count from public.estimate_items group by estimate_id) ei
                       join public.estimates e on e.id = ei.estimate_id
                      where e.dealer_id='${dealer2}' and e.idempotency_key='${key}'),'0')||'|'||
            coalesce((select estimate_number from public.estimates where dealer_id='${dealer2}' and idempotency_key='${key}'),'')`,
    'race2-estimate-state',
  );
  const [estimateCount, itemCount, estimateNumber] = estimateState.split('|');
  record('race 2: exactly one complete estimate exists with exactly one item and an allocated estimate number -- no partial/torn state',
    estimateCount === '1' && itemCount === '1' && estimateNumber !== '', { estimateCount, itemCount, estimateNumber });
}

const passed = raceResults.filter((entry) => entry.ok).length;
process.stdout.write(`${JSON.stringify({ type: 'summary', passed, total: raceResults.length, backend_pids_recorded: backendPids.length, secrets_logged: false })}\n`);
if (passed !== raceResults.length) process.exitCode = 1;
