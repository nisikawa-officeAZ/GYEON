#!/usr/bin/env node
// GDA_POSTAL_R5_IMPORT_RESUME -- import lane.
//
// Proves the service-role import RPC state machine (status -> begin ->
// append -> finalize -> rollback) directly against the local PostgREST RPC
// endpoint, using only deterministic synthetic rows -- never real Japan Post
// data. Per the R5 plan's canonical project-ref boundary, this driver NEVER
// goes through the production importer's own HTTP client (that CLI
// intentionally refuses a local URL as NON_CANONICAL_SUPABASE_URL); the
// import-RPC state-machine proof below calls the local RPC directly. Only
// the two production-importer-specific proofs at the end -- validate-only
// and the local-URL refusal itself -- exercise the real
// scripts/postal-master/import-japan-post.ts source, through injected
// dependencies, with zero real network access in either case.
//
// This script runs as two independent OS processes, gated by
// GDA_POSTAL_R5_IMPORT_PHASE=1 / =2, both inheriting the same R5 environment
// variables. Phase 1 begins identity A and appends only sequence 0, then
// exits; phase 2 starts fresh -- it never reads any file or process-memory
// state left by phase 1 -- and re-derives identity A deterministically from
// GDA_POSTAL_R5_SUFFIX before asking the server, via a fresh status RPC
// call, what has already been appended. Only that server-returned answer
// decides what remains to be appended.

import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONFIRM = 'I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE';
const apiUrl = process.env.R5_API_URL;
const serviceKey = process.env.R5_SERVICE_ROLE_KEY;
const anonKey = process.env.R5_ANON_KEY;
const repoRoot = process.env.GDA_POSTAL_R5_REPO_ROOT;
const phase = process.env.GDA_POSTAL_R5_IMPORT_PHASE;

function fail(message) {
  throw new Error(`R5_IMPORT_RESUME_ERROR: ${message}`);
}

if (process.env.GDA_POSTAL_R5_DISPOSABLE_CONFIRM !== CONFIRM) fail('explicit disposable confirmation is missing');
if (!apiUrl || !serviceKey) fail('R5_API_URL and R5_SERVICE_ROLE_KEY are required');
if (phase !== '1' && phase !== '2') fail('GDA_POSTAL_R5_IMPORT_PHASE must be exactly "1" or "2"');
if (phase === '2' && !repoRoot) fail('GDA_POSTAL_R5_REPO_ROOT is required in phase 2 (read-only import of the production importer source for the validate-only/localhost-refusal proofs)');
if (phase === '2' && !anonKey) fail('R5_ANON_KEY is required in phase 2 for the real authenticated active-member lookup proof');
const parsedApi = new URL(apiUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedApi.hostname)) fail('API URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(apiUrl)) fail('API URL must never resolve to a hosted Supabase host');

const runId = process.env.GDA_POSTAL_R5_SUFFIX ?? randomUUID().slice(0, 8);

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${JSON.stringify({ type: 'assertion', name, ok, detail })}\n`);
  if (!ok) process.exitCode = 1;
}

const REQUEST_TIMEOUT_MS = 15000;

async function httpRequest(requestPath, { method = 'GET', key, token, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${apiUrl}${requestPath}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { unparsed: true }; }
  return { status: response.status, payload };
}

async function rpc(name, body) {
  return httpRequest(`/rest/v1/rpc/${name}`, { method: 'POST', key: serviceKey, token: serviceKey, body });
}

async function serviceInsert(table, rows) {
  const response = await httpRequest(`/rest/v1/${table}`, { method: 'POST', key: serviceKey, token: serviceKey, body: rows, prefer: 'return=minimal' });
  if (response.status !== 201) fail(`service fixture insert failed for ${table}: HTTP ${response.status}`);
}

// Creates a real GoTrue user, an active dealer_members row for it, and a
// real password-grant session -- used only in phase 2 for the post-finalize
// authenticated lookup proof. Never logs the password, token, or user id.
async function createActiveMemberSession(label) {
  const email = `r5-import-${label}-${runId}@example.invalid`;
  const password = `R5-${randomUUID()}-aA1!`;
  const created = await httpRequest('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email, password, email_confirm: true, app_metadata: { gda_postal_r5: true } },
  });
  if (created.status !== 200 && created.status !== 201) fail(`admin user creation failed for ${label}: HTTP ${created.status}`);
  const user = created.payload?.user ?? created.payload;
  if (!user?.id) fail(`admin user response had no id for ${label}`);
  const dealerId = randomUUID();
  await serviceInsert('dealers', [{ id: dealerId, name: `R5 Import Resume Dealer 〔GDA-R5-SYNTHETIC〕 ${runId}`, dealer_type: 'GYEON_DETAILER', status: 'active' }]);
  await serviceInsert('dealer_members', [{ dealer_id: dealerId, user_id: user.id, role: 'owner', status: 'active' }]);
  const signed = await httpRequest('/auth/v1/token?grant_type=password', {
    method: 'POST', key: anonKey, token: anonKey, body: { email, password },
  });
  if (signed.status !== 200 || !signed.payload?.access_token) fail(`real sign-in failed for ${label}: HTTP ${signed.status}`);
  return { id: user.id, token: signed.payload.access_token };
}

async function anonTokenLookup(name, token, body) {
  return httpRequest(`/rest/v1/rpc/${name}`, { method: 'POST', key: anonKey, token, body });
}

function syntheticSha256(label) {
  return createHash('sha256').update(`gda-postal-r5-import-lane-${runId}-${label}`, 'utf8').digest('hex');
}

function syntheticRow(overrides = {}) {
  return {
    jisCode: '99991', oldPostalCode: '', postalCode: '0000002',
    prefectureKana: 'ｼﾞｯｹﾝﾄﾞｳ', cityKana: 'ｺﾞｳｾｲｼ', townKana: 'ｺﾞｳｾｲﾏﾁ',
    prefectureKanji: '実験県〔GDA-R5-SYNTHETIC〕', cityKanji: '合成市〔GDA-R5-SYNTHETIC〕', townKanji: '合成町一丁目〔GDA-R5-SYNTHETIC〕',
    flagMultiPostalPerTown: '0', flagKoazaBanchi: '0', flagHasChome: '0', flagMultiTownPerPostal: '0',
    updateFlag: '0', changeReasonCode: '0',
    ...overrides,
  };
}

const SAFE_STATUS_KEYS = new Set(['result_code', 'batch_id', 'status', 'expected_row_count', 'appended_sequences', 'is_active']);

function assertStatusPayloadSafe(payload, label) {
  const keys = Object.keys(payload ?? {});
  const unexpected = keys.filter((key) => !SAFE_STATUS_KEYS.has(key));
  record(`${label}: status RPC response contains only safe metadata keys`, unexpected.length === 0, `unexpected keys: ${unexpected.join(',') || 'none'}`);
  const serialized = JSON.stringify(payload ?? {});
  const hasNonAscii = /[^\x00-\x7f]/.test(serialized);
  record(
    `${label}: status RPC response never contains a non-ASCII (address-shaped) value`,
    !hasNonAscii,
    hasNonAscii ? 'non-ASCII byte detected in status payload' : 'no non-ASCII byte detected in status payload',
  );
}

// ---------------------------------------------------------------------------
// Identity A's deterministic parameters are a pure function of runId, so
// phase 1 and phase 2 -- two independent OS processes -- each derive the
// identical (date, sha256, rows) without sharing any file or memory state.
// ---------------------------------------------------------------------------

function deriveIdentityA() {
  const sourceDate = '2026-09-13';
  const sha256 = syntheticSha256('identity-a');
  const rowsSeq0 = [syntheticRow({ postalCode: '0000002' }), syntheticRow({ postalCode: '0000003', townKanji: '合成町二丁目〔GDA-R5-SYNTHETIC〕' })];
  const rowsSeq1 = [syntheticRow({ postalCode: '0000004', townKanji: '合成町三丁目〔GDA-R5-SYNTHETIC〕' })];
  return { sourceDate, sha256, rowsSeq0, rowsSeq1, expectedRowCount: rowsSeq0.length + rowsSeq1.length };
}

if (phase === '1') {
  // -------------------------------------------------------------------------
  // Phase 1: begin identity A and append only sequence 0, then exit. Nothing
  // written here (memory or disk) is read by phase 2.
  // -------------------------------------------------------------------------
  const identityA = deriveIdentityA();

  const statusBeforeBegin = await rpc('jp_postal_import_status', { p_source_date: identityA.sourceDate, p_sha256: identityA.sha256, p_expected_row_count: identityA.expectedRowCount });
  record('fresh identity A reports NOT_FOUND before any begin', statusBeforeBegin.status === 200 && statusBeforeBegin.payload?.result_code === 'NOT_FOUND', `HTTP ${statusBeforeBegin.status} ${statusBeforeBegin.payload?.result_code}`);

  const beginA = await rpc('jp_postal_import_begin', { p_source_date: identityA.sourceDate, p_sha256: identityA.sha256, p_expected_row_count: identityA.expectedRowCount });
  record('phase 1: begin succeeds for a fresh identity A', beginA.status === 200 && beginA.payload?.result_code === 'OK', `HTTP ${beginA.status} ${beginA.payload?.result_code}`);
  const batchIdA = beginA.payload?.batch_id;

  const appendSeq0 = await rpc('jp_postal_import_append', { p_batch_id: batchIdA, p_sequence: 0, p_rows: identityA.rowsSeq0 });
  record('phase 1: append of sequence 0 succeeds, simulating work before an interruption', appendSeq0.status === 200 && appendSeq0.payload?.result_code === 'OK' && appendSeq0.payload?.already_appended === false, `HTTP ${appendSeq0.status} ${JSON.stringify(appendSeq0.payload)}`);

  const passed = results.filter((entry) => entry.ok).length;
  process.stdout.write(`${JSON.stringify({ type: 'summary', phase: 1, passed, total: results.length, secrets_logged: false })}\n`);
  if (passed !== results.length) process.exitCode = 1;
} else {
  // -------------------------------------------------------------------------
  // Phase 2: starts fresh in a brand-new process. Identity A's parameters
  // are re-derived deterministically from runId, but the batch id and
  // already-appended sequences come ONLY from a fresh status RPC call --
  // never from phase 1's memory or any file.
  // -------------------------------------------------------------------------
  const identityA = deriveIdentityA();

  const statusAfterInterruption = await rpc('jp_postal_import_status', { p_source_date: identityA.sourceDate, p_sha256: identityA.sha256, p_expected_row_count: identityA.expectedRowCount });
  const resumedBatchId = statusAfterInterruption.payload?.batch_id;
  const resumedAppendedSequences = statusAfterInterruption.payload?.appended_sequences ?? [];
  record(
    'phase 2: a fresh status call is the sole basis for resume (server-persisted, not process-memory or file-cached)',
    statusAfterInterruption.status === 200
      && statusAfterInterruption.payload?.result_code === 'OK'
      && ['staged', 'validating'].includes(statusAfterInterruption.payload?.status)
      && !!resumedBatchId
      && Array.isArray(resumedAppendedSequences)
      && resumedAppendedSequences.includes(0)
      && !resumedAppendedSequences.includes(1),
    `HTTP ${statusAfterInterruption.status} ${JSON.stringify(statusAfterInterruption.payload)}`,
  );
  assertStatusPayloadSafe(statusAfterInterruption.payload, 'phase 2 post-interruption status');

  // Duplicate resend of the already-appended sequence, BEFORE the remaining
  // sequence is appended: a real zero-write no-op, proven indirectly below
  // by finalize's exact row-count match (a silent re-insert would instead
  // surface as ROW_COUNT_MISMATCH).
  const duplicateResend = await rpc('jp_postal_import_append', { p_batch_id: resumedBatchId, p_sequence: 0, p_rows: identityA.rowsSeq0 });
  record('phase 2: resending the already-appended sequence 0 is an explicit successful zero-write no-op', duplicateResend.status === 200 && duplicateResend.payload?.result_code === 'OK' && duplicateResend.payload?.already_appended === true, `HTTP ${duplicateResend.status} ${JSON.stringify(duplicateResend.payload)}`);

  const remainingSequences = [1].filter((sequence) => !resumedAppendedSequences.includes(sequence));
  for (const sequence of remainingSequences) {
    const appended = await rpc('jp_postal_import_append', { p_batch_id: resumedBatchId, p_sequence: sequence, p_rows: identityA.rowsSeq1 });
    record(`phase 2: resume appends the remaining sequence ${sequence} using only server-derived resume evidence`, appended.status === 200 && appended.payload?.result_code === 'OK', `HTTP ${appended.status} ${JSON.stringify(appended.payload)}`);
  }

  const finalizeA = await rpc('jp_postal_import_finalize', { p_batch_id: resumedBatchId });
  record(
    'phase 2: finalize succeeds with the exact expected row count, proving the earlier duplicate resend wrote zero extra rows',
    finalizeA.status === 200 && finalizeA.payload?.result_code === 'OK' && finalizeA.payload?.total_count === identityA.expectedRowCount,
    `HTTP ${finalizeA.status} ${JSON.stringify(finalizeA.payload)}`,
  );

  const replayBeginAWhileActive = await rpc('jp_postal_import_begin', { p_source_date: identityA.sourceDate, p_sha256: identityA.sha256, p_expected_row_count: identityA.expectedRowCount });
  record('replaying the identical (date, sha256) for A while still active is an already-promoted no-write success', replayBeginAWhileActive.status === 200 && replayBeginAWhileActive.payload?.result_code === 'OK' && replayBeginAWhileActive.payload?.already_promoted === true, `HTTP ${replayBeginAWhileActive.status} ${JSON.stringify(replayBeginAWhileActive.payload)}`);

  const statusAfterPromotion = await rpc('jp_postal_import_status', { p_source_date: identityA.sourceDate, p_sha256: identityA.sha256, p_expected_row_count: identityA.expectedRowCount });
  assertStatusPayloadSafe(statusAfterPromotion.payload, 'post-promotion status');

  // ---------------------------------------------------------------------------
  // Real authenticated active-member lookup: after finalize, prove the
  // just-promoted fictional row is actually retrievable through the real
  // local GoTrue + PostgREST request path, not merely via the service-role
  // RPC state machine above.
  // ---------------------------------------------------------------------------
  const lookupSession = await createActiveMemberSession('lookup');
  const promotedPostalCode = identityA.rowsSeq0[0].postalCode;
  const promotedHyphenatedPostalCode = `${promotedPostalCode.slice(0, 3)}-${promotedPostalCode.slice(3)}`;
  const promotedLookup = await anonTokenLookup('jp_postal_master_lookup_forward', lookupSession.token, { p_postal_code: promotedHyphenatedPostalCode });
  record('a real authenticated active-member session resolves the just-promoted identity-A row to FOUND', promotedLookup.status === 200 && promotedLookup.payload?.result_code === 'FOUND', `HTTP ${promotedLookup.status} ${promotedLookup.payload?.result_code}`);

  // ---------------------------------------------------------------------------
  // Terminal identity non-reuse proof 1: a fresh identity R is rejected at
  // finalize via an expected-row-count mismatch, then proven fail-closed
  // against a later replay begin.
  // ---------------------------------------------------------------------------
  const sourceDateR = '2026-09-16';
  const sha256R = syntheticSha256('identity-rejected');
  const rowsR = [syntheticRow({ postalCode: '0000005', townKanji: '合成町五丁目〔GDA-R5-SYNTHETIC〕' })];
  const expectedRowCountR = rowsR.length + 1;

  const beginR = await rpc('jp_postal_import_begin', { p_source_date: sourceDateR, p_sha256: sha256R, p_expected_row_count: expectedRowCountR });
  record('begin succeeds for the later-rejected identity R', beginR.status === 200 && beginR.payload?.result_code === 'OK', `HTTP ${beginR.status} ${beginR.payload?.result_code}`);
  const batchIdR = beginR.payload?.batch_id;

  const appendR = await rpc('jp_postal_import_append', { p_batch_id: batchIdR, p_sequence: 0, p_rows: rowsR });
  record('append succeeds for identity R', appendR.status === 200 && appendR.payload?.result_code === 'OK', `HTTP ${appendR.status} ${appendR.payload?.result_code}`);

  const finalizeR = await rpc('jp_postal_import_finalize', { p_batch_id: batchIdR });
  record('finalize rejects identity R via an expected-row-count mismatch, never silently truncating or padding', finalizeR.status === 200 && finalizeR.payload?.result_code === 'ROW_COUNT_MISMATCH', `HTTP ${finalizeR.status} ${JSON.stringify(finalizeR.payload)}`);

  const replayBeginR = await rpc('jp_postal_import_begin', { p_source_date: sourceDateR, p_sha256: sha256R, p_expected_row_count: expectedRowCountR });
  record('a later begin for the now-rejected identity R is fail-closed (never recycled)', replayBeginR.status === 200 && replayBeginR.payload?.result_code === 'CHECKSUM_REPLAY_CONFLICT', `HTTP ${replayBeginR.status} ${replayBeginR.payload?.result_code}`);

  // ---------------------------------------------------------------------------
  // Second identity (B): promote (superseding A), then roll back, proving
  // both a superseded identity and a rolled_back identity are fail-closed
  // and never recycled by a later begin.
  // ---------------------------------------------------------------------------
  const sourceDateB = '2026-09-14';
  const sha256B = syntheticSha256('identity-b');
  const rowsB = [syntheticRow({ postalCode: '0000006', townKanji: '合成町九丁目〔GDA-R5-SYNTHETIC〕' })];

  const beginB = await rpc('jp_postal_import_begin', { p_source_date: sourceDateB, p_sha256: sha256B, p_expected_row_count: rowsB.length });
  record('begin succeeds for identity B (the later rollback target)', beginB.status === 200 && beginB.payload?.result_code === 'OK', `HTTP ${beginB.status} ${beginB.payload?.result_code}`);
  const batchIdB = beginB.payload?.batch_id;

  const appendB = await rpc('jp_postal_import_append', { p_batch_id: batchIdB, p_sequence: 0, p_rows: rowsB });
  record('append succeeds for identity B', appendB.status === 200 && appendB.payload?.result_code === 'OK', `HTTP ${appendB.status} ${appendB.payload?.result_code}`);

  const finalizeB = await rpc('jp_postal_import_finalize', { p_batch_id: batchIdB });
  record('finalize promotes identity B, which supersedes identity A as the active batch', finalizeB.status === 200 && finalizeB.payload?.result_code === 'OK', `HTTP ${finalizeB.status} ${finalizeB.payload?.result_code}`);

  // Terminal identity non-reuse proof 2: after B's promotion, before any
  // rollback, A is now superseded and fail-closed against replay.
  const replayBeginASuperseded = await rpc('jp_postal_import_begin', { p_source_date: identityA.sourceDate, p_sha256: identityA.sha256, p_expected_row_count: identityA.expectedRowCount });
  record('a begin replay of A is fail-closed once B has superseded it, before any rollback', replayBeginASuperseded.status === 200 && replayBeginASuperseded.payload?.result_code === 'CHECKSUM_REPLAY_CONFLICT', `HTTP ${replayBeginASuperseded.status} ${replayBeginASuperseded.payload?.result_code}`);

  const rollbackToA = await rpc('jp_postal_import_rollback', { p_batch_id: resumedBatchId });
  record('rollback repoints the active batch back to identity A', rollbackToA.status === 200 && rollbackToA.payload?.result_code === 'OK', `HTTP ${rollbackToA.status} ${rollbackToA.payload?.result_code}`);

  // Terminal identity non-reuse proof 3: after rollback to A, B is now
  // rolled_back and fail-closed against replay.
  const beginReplayB = await rpc('jp_postal_import_begin', { p_source_date: sourceDateB, p_sha256: sha256B, p_expected_row_count: rowsB.length });
  record('a later begin for the now rolled_back identity B is fail-closed (never recycled as staged)', beginReplayB.status === 200 && beginReplayB.payload?.result_code === 'CHECKSUM_REPLAY_CONFLICT', `HTTP ${beginReplayB.status} ${beginReplayB.payload?.result_code}`);

  const statusB = await rpc('jp_postal_import_status', { p_source_date: sourceDateB, p_sha256: sha256B, p_expected_row_count: rowsB.length });
  record('status reports the rolled_back terminal identity as non-active, non-resumable evidence', statusB.status === 200 && statusB.payload?.status === 'rolled_back' && statusB.payload?.is_active === false, `HTTP ${statusB.status} ${JSON.stringify(statusB.payload)}`);
  assertStatusPayloadSafe(statusB.payload, 'rolled-back identity status');

  // ---------------------------------------------------------------------------
  // Production importer proofs: the REAL scripts/postal-master/import-japan-post.ts
  // source, through injected dependencies. Never SUPABASE_URL/network; the
  // module is loaded read-only from the repository, never copied into the
  // disposable runtime. The synthetic CSV lives only in this script's own
  // runtime directory (never /tmp) and is always removed in finally.
  // ---------------------------------------------------------------------------

  const importerPath = path.join(repoRoot, 'scripts', 'postal-master', 'import-japan-post.ts');
  const { runImportCli } = await import(pathToFileURL(importerPath).href);

  const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
  const csvHeader = '99999,000,0000007,ｼﾞｯｹﾝｹﾝ,ｺﾞｳｾｲｼ,ｺﾞｳｾｲﾁｮｳ,実験県〔GDA-R5-SYNTHETIC〕,合成市〔GDA-R5-SYNTHETIC〕,合成町四丁目〔GDA-R5-SYNTHETIC〕,0,0,0,0,0,0\n';
  const csvSha256 = createHash('sha256').update(csvHeader, 'utf8').digest('hex');
  const csvPath = path.join(runtimeDir, `.gda-postal-r5-synthetic-${runId}.csv`);
  writeFileSync(csvPath, csvHeader, 'utf8');

  try {
    let validateOnlyClientConstructions = 0;
    try {
      const validateOnlyOutcome = await runImportCli(
        [
          '--csv', csvPath, '--source-date', '2026-09-15', '--sha256', csvSha256,
          '--expected-project-ref', 'abcdefghijklmnopqrst', '--validate-only',
        ],
        {
          readFile: (filePath) => filePath === csvPath ? csvHeader : fail(`unexpected readFile path: ${filePath}`),
          sha256: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
          log: () => {},
          createRpcClient: async () => { validateOnlyClientConstructions += 1; fail('validate-only must never construct an RPC client'); },
        },
      );
      record(
        'the real production importer --validate-only performs full local planning with zero client construction and zero RPC',
        validateOnlyOutcome.ok === true && validateOnlyOutcome.kind === 'validated' && validateOnlyOutcome.totalCount === 1 && validateOnlyClientConstructions === 0,
        `outcome=${JSON.stringify(validateOnlyOutcome)} client_constructions=${validateOnlyClientConstructions}`,
      );
    } catch (error) {
      record('the real production importer --validate-only performs full local planning with zero client construction and zero RPC', false, String(error));
    }

    let localUrlClientConstructions = 0;
    try {
      const localUrlOutcome = await runImportCli(
        [
          '--csv', csvPath, '--source-date', '2026-09-15', '--sha256', csvSha256,
          '--expected-project-ref', 'abcdefghijklmnopqrst', '--confirm-project-ref', 'abcdefghijklmnopqrst',
        ],
        {
          readFile: (filePath) => filePath === csvPath ? csvHeader : fail(`unexpected readFile path: ${filePath}`),
          sha256: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
          log: () => {},
          // The ACTUAL local loopback URL is deliberately supplied here (never
          // via SUPABASE_URL/network) to prove the real production-importer
          // canonical-URL guard rejects it before any client is constructed.
          supabaseUrl: apiUrl,
          serviceRoleKey: 'unused-because-the-guard-must-fail-first',
          createRpcClient: async () => { localUrlClientConstructions += 1; fail('a local/non-canonical Supabase URL must never reach RPC client construction'); },
        },
      );
      record(
        'the real production importer rejects the local loopback URL as NON_CANONICAL_SUPABASE_URL before any client construction (no localhost bypass exists)',
        localUrlOutcome.ok === false && localUrlOutcome.errorCode === 'NON_CANONICAL_SUPABASE_URL' && localUrlClientConstructions === 0,
        `outcome=${JSON.stringify(localUrlOutcome)} client_constructions=${localUrlClientConstructions}`,
      );
    } catch (error) {
      record('the real production importer rejects the local loopback URL as NON_CANONICAL_SUPABASE_URL before any client construction (no localhost bypass exists)', false, String(error));
    }
  } finally {
    unlinkSync(csvPath);
  }

  const passed = results.filter((entry) => entry.ok).length;
  process.stdout.write(`${JSON.stringify({ type: 'summary', phase: 2, passed, total: results.length, secrets_logged: false })}\n`);
  if (passed !== results.length) process.exitCode = 1;
}
