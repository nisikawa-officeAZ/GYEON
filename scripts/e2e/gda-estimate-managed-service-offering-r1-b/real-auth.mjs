#!/usr/bin/env node
// GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_REAL_AUTH
// Real local GoTrue tokens + PostgREST requests over public.save_estimate_from_wizard.
// No token, password, anon key, service key, or raw customer data is logged.
// SQL-only claim simulation is never accepted as a substitute for this proof.
//
// Structurally reuses the accepted scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs
// request/record/fail idioms. It copies no GYEON-order fixture, table, RPC
// name, or evidence vocabulary; every fixture and assertion below belongs to
// the Estimate Wizard managed-service offering guard only.

import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const CONFIRM = 'I_UNDERSTAND_GDA_ESTIMATE_OFFERING_R1B_IS_DISPOSABLE';
const apiUrl = process.env.R1B_API_URL;
const dbUrl = process.env.R1B_DB_URL;
const anonKey = process.env.R1B_ANON_KEY;
const serviceKey = process.env.R1B_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(`R1B_REAL_AUTH_ERROR: ${message}`);
}

if (process.env.GDA_ESTIMATE_OFFERING_R1B_DISPOSABLE_CONFIRM !== CONFIRM) fail('explicit disposable confirmation is missing');
if (!apiUrl || !dbUrl || !anonKey || !serviceKey) fail('R1B_API_URL, R1B_DB_URL, R1B_ANON_KEY and R1B_SERVICE_ROLE_KEY are required');
const parsedApi = new URL(apiUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedApi.hostname)) fail('API URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(apiUrl)) fail('API URL must never resolve to a hosted Supabase host');
const parsedDb = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedDb.hostname)) fail('database URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(dbUrl)) fail('database URL must never resolve to a hosted Supabase host');

const runId = process.env.GDA_ESTIMATE_OFFERING_R1B_SUFFIX ?? randomUUID().slice(0, 8);
const password = `R1B-${randomUUID()}-aA1!`;

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
      // pass or fail. The caller must not interpret this as a clean denial.
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
  const message = typeof payload.message === 'string' ? payload.message.slice(0, 120) : '';
  return `code=${code} message=${message}`;
}

// The guard migration is applied after the local Supabase stack starts.
// Force PostgREST to reload only its local schema cache before any real HTTP
// assertion. Credentials stay in the child environment, never command args
// or evidence output.
try {
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c', "notify pgrst, 'reload schema';"], {
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
  const probe = await request('/rest/v1/dealer_service_offerings?select=dealer_id&limit=0', {
    key: serviceKey,
    token: serviceKey,
  });
  lastSchemaStatus = probe.status;
  lastSchemaCode = safeApiError(probe.payload);
  if (probe.status === 200) {
    schemaCacheReady = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!schemaCacheReady) fail(`local PostgREST schema cache did not become ready: HTTP ${lastSchemaStatus} ${lastSchemaCode}`);

async function createUser(label) {
  const email = `r1b-${label}-${runId}@example.invalid`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email, password, email_confirm: true, app_metadata: { r1b: true } },
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

async function serviceInsert(table, rows, { onConflict } = {}) {
  const path = onConflict ? `/rest/v1/${table}?on_conflict=${onConflict}` : `/rest/v1/${table}`;
  const prefer = onConflict ? 'return=minimal,resolution=merge-duplicates' : 'return=minimal';
  const response = await request(path, {
    method: 'POST', key: serviceKey, token: serviceKey, body: rows, prefer,
  });
  if (response.status !== 201) fail(`service fixture insert failed for ${table}: HTTP ${response.status} ${safeApiError(response.payload)}`);
}

async function rpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', key: anonKey, token, body });
}

// ---------------------------------------------------------------------------
// Fixtures: two dealers with one real GoTrue owner each, and offering rows
// used to prove disabled-family rejection and enabled-family success through
// the real Auth/PostgREST/RPC path (not raw SQL).
// ---------------------------------------------------------------------------

const users = {
  ownerA: await createUser('owner-a'),
  ownerB: await createUser('owner-b'),
};

const ids = {
  dealerA: randomUUID(),
  dealerB: randomUUID(),
};

await serviceInsert('dealers', [
  { id: ids.dealerA, name: `R1B Real Auth Dealer A ${runId}` },
  { id: ids.dealerB, name: `R1B Real Auth Dealer B ${runId}` },
]);

await serviceInsert('dealer_members', [
  { dealer_id: ids.dealerA, user_id: users.ownerA.id, role: 'owner', status: 'active' },
  { dealer_id: ids.dealerB, user_id: users.ownerB.id, role: 'owner', status: 'active' },
]);

// dealer A: maintenance disabled by explicit row (proves enabled=false OFF).
// dealer B: maintenance enabled (proves a genuinely new save through PostgREST).
await serviceInsert('dealer_service_offerings', [
  { dealer_id: ids.dealerA, family: 'maintenance', enabled: false },
  { dealer_id: ids.dealerB, family: 'maintenance', enabled: true },
]);

function estimatePayload(idempotencyKey, category) {
  return {
    idempotencyKey,
    customer: {
      mode: 'new', name: 'R1B Real Auth Customer', phone: '090-0000-0000', email: 'r1b-real-auth@example.test',
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
      lineId: `manual:${category}:real-auth-a`, category, wizardCategory: category, pricingSource: 'manual',
      pricingReferenceId: null, manualPricingIdentity: `${category}:real-auth-a`,
      pricingPolicy: 'manual_only', manualPricePolicy: 'required',
      label: 'R1B Real Auth Line', description: null,
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
    },
  };
}

// ---------------------------------------------------------------------------
// Baseline denial: no non-service-role caller may ever invoke the RPC.
// ---------------------------------------------------------------------------

const anonRpc = await rpc('save_estimate_from_wizard', anonKey, {
  p_dealer_id: ids.dealerA, p_actor_user_id: users.ownerA.id, p_payload: estimatePayload(randomUUID(), 'maintenance'),
});
record('anon cannot invoke the RPC directly', [401, 403, 404].includes(anonRpc.status), `HTTP ${anonRpc.status} ${safeApiError(anonRpc.payload)}`);

const authenticatedRpc = await rpc('save_estimate_from_wizard', users.ownerA.token, {
  p_dealer_id: ids.dealerA, p_actor_user_id: users.ownerA.id, p_payload: estimatePayload(randomUUID(), 'maintenance'),
});
record('a real authenticated owner token cannot invoke the RPC directly (service-role-only EXECUTE)',
  [401, 403, 404].includes(authenticatedRpc.status), `HTTP ${authenticatedRpc.status} ${safeApiError(authenticatedRpc.payload)}`);

// ---------------------------------------------------------------------------
// Service-role RPC calls, using the REAL created user ids as p_actor_user_id.
// ---------------------------------------------------------------------------

const disabledFamilySave = await rpc('save_estimate_from_wizard', serviceKey, {
  p_dealer_id: ids.dealerA, p_actor_user_id: users.ownerA.id, p_payload: estimatePayload(`r1brealauthoff${runId}`.slice(0, 60), 'maintenance'),
});
record('service-role RPC denies a disabled managed family for a real actor/dealer pair',
  disabledFamilySave.status >= 400 && /service-not-offered/.test(disabledFamilySave.payload?.message ?? ''),
  `HTTP ${disabledFamilySave.status} ${safeApiError(disabledFamilySave.payload)}`);

const wrongDealerSave = await rpc('save_estimate_from_wizard', serviceKey, {
  p_dealer_id: ids.dealerB, p_actor_user_id: users.ownerA.id, p_payload: estimatePayload(`r1brealauthxd${runId}`.slice(0, 60), 'maintenance'),
});
record('service-role RPC denies an actor whose real membership does not match the claimed dealer',
  wrongDealerSave.status >= 400 && /PERMISSION_DENIED/.test(wrongDealerSave.payload?.message ?? ''),
  `HTTP ${wrongDealerSave.status} ${safeApiError(wrongDealerSave.payload)}`);

const enabledFamilySave = await rpc('save_estimate_from_wizard', serviceKey, {
  p_dealer_id: ids.dealerB, p_actor_user_id: users.ownerB.id, p_payload: estimatePayload(`r1brealauthon${runId}`.slice(0, 60), 'maintenance'),
});
record('service-role RPC permits a genuinely new save for a real actor/dealer pair with the family enabled',
  enabledFamilySave.status === 200 && enabledFamilySave.payload?.ok === true && enabledFamilySave.payload?.idempotent_replay === false,
  `HTTP ${enabledFamilySave.status} ${safeApiError(enabledFamilySave.payload)}`);

const unmanagedCategorySave = await rpc('save_estimate_from_wizard', serviceKey, {
  p_dealer_id: ids.dealerA, p_actor_user_id: users.ownerA.id, p_payload: estimatePayload(`r1brealauthcoat${runId}`.slice(0, 60), 'coating'),
});
record('service-role RPC permits an unmanaged (coating) category regardless of managed-family state',
  unmanagedCategorySave.status === 200 && unmanagedCategorySave.payload?.ok === true,
  `HTTP ${unmanagedCategorySave.status} ${safeApiError(unmanagedCategorySave.payload)}`);

const passed = results.filter((entry) => entry.ok).length;
process.stdout.write(`${JSON.stringify({ type: 'summary', passed, total: results.length, secrets_logged: false })}\n`);
if (passed !== results.length) process.exitCode = 1;
