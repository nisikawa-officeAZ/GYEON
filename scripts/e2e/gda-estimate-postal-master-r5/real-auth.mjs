#!/usr/bin/env node
// GDA_POSTAL_R5_REAL_AUTH -- fresh lane.
//
// Real local GoTrue tokens + real PostgREST requests against
// public.jp_postal_master_lookup_forward/reverse. No token, password, anon
// key, service key, or postal address is logged. SQL-only claim simulation
// (as used by the pgTAP files) is never accepted as a substitute for this
// proof: this script proves the actual Auth/PostgREST request-scope
// boundary that a real Estimate Wizard Server Action would go through.

import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { accessSync, constants as fsConstants } from 'node:fs';

const CONFIRM = 'I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE';
const apiUrl = process.env.R5_API_URL;
const dbUrl = process.env.R5_DB_URL;
const anonKey = process.env.R5_ANON_KEY;
const serviceKey = process.env.R5_SERVICE_ROLE_KEY;
const psqlBin = process.env.GDA_POSTAL_R5_PSQL_BIN;

function fail(message) {
  throw new Error(`R5_REAL_AUTH_ERROR: ${message}`);
}

if (process.env.GDA_POSTAL_R5_DISPOSABLE_CONFIRM !== CONFIRM) fail('explicit disposable confirmation is missing');
if (!apiUrl || !dbUrl || !anonKey || !serviceKey) fail('R5_API_URL, R5_DB_URL, R5_ANON_KEY and R5_SERVICE_ROLE_KEY are required');
if (!psqlBin) fail('GDA_POSTAL_R5_PSQL_BIN is required');
try {
  accessSync(psqlBin, fsConstants.X_OK);
} catch {
  fail('GDA_POSTAL_R5_PSQL_BIN must be an executable path');
}
const parsedApi = new URL(apiUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedApi.hostname)) fail('API URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(apiUrl)) fail('API URL must never resolve to a hosted Supabase host');
const parsedDb = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedDb.hostname)) fail('database URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(dbUrl)) fail('database URL must never resolve to a hosted Supabase host');

const runId = process.env.GDA_POSTAL_R5_SUFFIX ?? randomUUID().slice(0, 8);
const password = `R5-${randomUUID()}-aA1!`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${JSON.stringify({ type: 'assertion', name, ok, detail })}\n`);
  if (!ok) process.exitCode = 1;
}

const REQUEST_TIMEOUT_MS = 15000;

async function request(path, { method = 'GET', key = anonKey, token = key, body, prefer } = {}) {
  if (!path.startsWith('/')) fail('request path must be relative to the loopback API URL');
  const headers = { apikey: key, Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      // A bounded timeout is a disqualifying UNKNOWN result, never a guessed
      // pass or fail.
      return { status: 'UNKNOWN_TIMEOUT', payload: null };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { unparsed: true }; }
  return { status: response.status, payload };
}

function safeApiError(payload) {
  if (!payload || typeof payload !== 'object') return 'no_error_code';
  const code = typeof payload.code === 'string' ? payload.code.slice(0, 80) : 'no_error_code';
  return `code=${code}`;
}

// Force PostgREST to reload only its local schema cache before any real HTTP
// assertion. Credentials stay in the child environment, never command args
// or evidence output.
try {
  execFileSync(psqlBin, ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c', "notify pgrst, 'reload schema';"], {
    env: {
      ...process.env,
      PGHOST: parsedDb.hostname,
      PGPORT: parsedDb.port,
      PGUSER: decodeURIComponent(parsedDb.username),
      PGPASSWORD: decodeURIComponent(parsedDb.password),
      PGDATABASE: decodeURIComponent(parsedDb.pathname.replace(/^\//, '')),
    },
    stdio: 'ignore',
    timeout: REQUEST_TIMEOUT_MS,
  });
} catch {
  fail('local PostgREST schema reload notification failed');
}

let schemaCacheReady = false;
let lastSchemaStatus = 'not_requested';
let lastSchemaCode = 'no_error_code';
for (let attempt = 0; attempt < 40; attempt += 1) {
  const probe = await request('/rest/v1/dealers?select=id&limit=0', { key: serviceKey, token: serviceKey });
  lastSchemaStatus = probe.status;
  lastSchemaCode = safeApiError(probe.payload);
  if (probe.status === 200) { schemaCacheReady = true; break; }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!schemaCacheReady) fail(`local PostgREST schema cache did not become ready: HTTP ${lastSchemaStatus} ${lastSchemaCode}`);

async function createUser(label) {
  const email = `r5-${label}-${runId}@example.invalid`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email, password, email_confirm: true, app_metadata: { gda_postal_r5: true } },
  });
  if (created.status !== 200 && created.status !== 201) fail(`admin user creation failed for ${label}: HTTP ${created.status}`);
  const user = created.payload?.user ?? created.payload;
  if (!user?.id) fail(`admin user response had no id for ${label}`);
  const signed = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', key: anonKey, token: anonKey, body: { email, password },
  });
  if (signed.status !== 200 || !signed.payload?.access_token) fail(`real sign-in failed for ${label}: HTTP ${signed.status}`);
  return { id: user.id, token: signed.payload.access_token };
}

async function serviceInsert(table, rows) {
  const response = await request(`/rest/v1/${table}`, {
    method: 'POST', key: serviceKey, token: serviceKey, body: rows, prefer: 'return=minimal',
  });
  if (response.status !== 201) fail(`service fixture insert failed for ${table}: HTTP ${response.status} ${safeApiError(response.payload)}`);
}

async function serviceRpc(name, body) {
  const response = await request(`/rest/v1/rpc/${name}`, {
    method: 'POST', key: serviceKey, token: serviceKey, body,
  });
  if (response.status !== 200) fail(`service-role RPC ${name} failed: HTTP ${response.status} ${safeApiError(response.payload)}`);
  if (response.payload?.result_code !== 'OK') fail(`service-role RPC ${name} returned non-OK result_code: ${response.payload?.result_code}`);
  return response.payload;
}

async function lookupRpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', key: anonKey, token, body });
}

// ---------------------------------------------------------------------------
// Fixtures: dealer A (active member + suspended member), dealer B (active
// member of a DIFFERENT dealer -- these RPCs are intentionally dealer-
// agnostic via the existing public.wiz_is_any_active_member() guard, so a
// second dealer's active member is a POSITIVE proof, not a denial case), and
// one user with no dealer_members row at all.
// ---------------------------------------------------------------------------

const users = {
  activeA: await createUser('active-a'),
  suspendedA: await createUser('suspended-a'),
  activeB: await createUser('active-b'),
  noMembership: await createUser('no-membership'),
};

const ids = { dealerA: randomUUID(), dealerB: randomUUID() };

await serviceInsert('dealers', [
  { id: ids.dealerA, name: 'R5 Real Auth Dealer A 〔GDA-R5-SYNTHETIC〕', dealer_type: 'GYEON_DETAILER', status: 'active' },
  { id: ids.dealerB, name: 'R5 Real Auth Dealer B 〔GDA-R5-SYNTHETIC〕', dealer_type: 'GYEON_DETAILER', status: 'active' },
]);
await serviceInsert('dealer_members', [
  { dealer_id: ids.dealerA, user_id: users.activeA.id, role: 'owner', status: 'active' },
  { dealer_id: ids.dealerA, user_id: users.suspendedA.id, role: 'staff', status: 'suspended' },
  { dealer_id: ids.dealerB, user_id: users.activeB.id, role: 'owner', status: 'active' },
]);
// users.noMembership deliberately has NO dealer_members row.

// One small, real, promoted synthetic postal batch so the real HTTP FOUND
// assertions below exercise genuine lookup data, not merely an
// unauthorized/invalid-input short-circuit. Rows are entirely fictional.
const sourceDate = '2026-09-12';
const sha256 = createHash('sha256').update(`gda-postal-r5-real-auth-${runId}`, 'utf8').digest('hex');
const begin = await serviceRpc('jp_postal_import_begin', {
  p_source_date: sourceDate, p_sha256: sha256, p_expected_row_count: 1,
});
const fixturePrefectureKanji = '実験県〔GDA-R5-SYNTHETIC〕';
const fixtureCityKanji = '合成市〔GDA-R5-SYNTHETIC〕';
const fixtureTownKanji = '合成町認証区画〔GDA-R5-SYNTHETIC〕';
const fixturePostalCode = '0000001';
const fixtureHyphenatedPostalCode = '000-0001';
const fixtureAddress = `${fixturePrefectureKanji}${fixtureCityKanji}${fixtureTownKanji}`;
await serviceRpc('jp_postal_import_append', {
  p_batch_id: begin.batch_id, p_sequence: 0,
  p_rows: [{
    jisCode: '99999', oldPostalCode: '', postalCode: fixturePostalCode,
    prefectureKana: 'ｼﾞｯｹﾝｹﾝ', cityKana: 'ｺﾞｳｾｲｼ', townKana: 'ﾆﾝｼｮｳｸｶｸ',
    prefectureKanji: fixturePrefectureKanji, cityKanji: fixtureCityKanji, townKanji: fixtureTownKanji,
    flagMultiPostalPerTown: '0', flagKoazaBanchi: '0', flagHasChome: '0', flagMultiTownPerPostal: '0',
    updateFlag: '0', changeReasonCode: '0',
  }],
});
await serviceRpc('jp_postal_import_finalize', { p_batch_id: begin.batch_id });

// ---------------------------------------------------------------------------
// Baseline denial: anon cannot call either lookup RPC at all.
// ---------------------------------------------------------------------------

const anonForward = await lookupRpc('jp_postal_master_lookup_forward', anonKey, { p_postal_code: fixtureHyphenatedPostalCode });
record('anon cannot call the forward lookup RPC', [401, 403].includes(anonForward.status), `HTTP ${anonForward.status}`);

const anonReverse = await lookupRpc('jp_postal_master_lookup_reverse', anonKey, { p_address: fixtureAddress });
record('anon cannot call the reverse lookup RPC', [401, 403].includes(anonReverse.status), `HTTP ${anonReverse.status}`);

// ---------------------------------------------------------------------------
// Denial matrix for a real authenticated session.
// ---------------------------------------------------------------------------

const noMembershipForward = await lookupRpc('jp_postal_master_lookup_forward', users.noMembership.token, { p_postal_code: fixtureHyphenatedPostalCode });
record('a real authenticated user with no dealer membership is denied', [401, 403].includes(noMembershipForward.status), `HTTP ${noMembershipForward.status}`);

const suspendedForward = await lookupRpc('jp_postal_master_lookup_forward', users.suspendedA.token, { p_postal_code: fixtureHyphenatedPostalCode });
record('a real authenticated but suspended member is denied', [401, 403].includes(suspendedForward.status), `HTTP ${suspendedForward.status}`);

// ---------------------------------------------------------------------------
// Positive path: a real active-member session succeeds end to end for both
// directions, and a real active member of a DIFFERENT dealer also succeeds
// (proving the dealer-agnostic wiz_is_any_active_member() contract is
// correctly NOT dealer-scoped, rather than asserting an inapplicable
// cross-dealer denial these RPCs were never designed to enforce).
// ---------------------------------------------------------------------------

const activeForward = await lookupRpc('jp_postal_master_lookup_forward', users.activeA.token, { p_postal_code: fixtureHyphenatedPostalCode });
record('a real active-member session resolves the forward lookup to FOUND', activeForward.status === 200 && activeForward.payload?.result_code === 'FOUND', `HTTP ${activeForward.status} ${activeForward.payload?.result_code}`);

const activeReverse = await lookupRpc('jp_postal_master_lookup_reverse', users.activeA.token, { p_address: `${fixtureAddress}1-1-1` });
record('a real active-member session resolves the reverse lookup to FOUND', activeReverse.status === 200 && activeReverse.payload?.result_code === 'FOUND' && activeReverse.payload?.postal_code === fixturePostalCode, `HTTP ${activeReverse.status} ${activeReverse.payload?.result_code}`);

const activeBForward = await lookupRpc('jp_postal_master_lookup_forward', users.activeB.token, { p_postal_code: fixtureHyphenatedPostalCode });
record('a real active member of a SECOND, unrelated dealer also succeeds (dealer-agnostic membership contract, not a cross-dealer bypass)', activeBForward.status === 200 && activeBForward.payload?.result_code === 'FOUND', `HTTP ${activeBForward.status} ${activeBForward.payload?.result_code}`);

// ---------------------------------------------------------------------------
// Fail-safe input handling over a real request, matching the accepted
// contract: malformed/empty input never fabricates a result.
// ---------------------------------------------------------------------------

const malformedForward = await lookupRpc('jp_postal_master_lookup_forward', users.activeA.token, { p_postal_code: 'not-a-code' });
record('a malformed postal code returns INVALID_INPUT over a real request, never a fabricated address', malformedForward.status === 200 && malformedForward.payload?.result_code === 'INVALID_INPUT', `HTTP ${malformedForward.status} ${malformedForward.payload?.result_code}`);

const whitespaceReverse = await lookupRpc('jp_postal_master_lookup_reverse', users.activeA.token, { p_address: '   ' });
record('a whitespace-only address returns INVALID_INPUT over a real request, never a fabricated postal code', whitespaceReverse.status === 200 && whitespaceReverse.payload?.result_code === 'INVALID_INPUT', `HTTP ${whitespaceReverse.status} ${whitespaceReverse.payload?.result_code}`);

const passed = results.filter((entry) => entry.ok).length;
process.stdout.write(`${JSON.stringify({ type: 'summary', passed, total: results.length, secrets_logged: false })}\n`);
if (passed !== results.length) process.exitCode = 1;
