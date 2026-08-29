#!/usr/bin/env node
// GYEON_ORDER_V3_C5C_R4_REAL_AUTH
// Real local GoTrue tokens + PostgREST requests. No token, password, anon
// key, service key, or raw provider payload is logged. SQL-only claim
// simulation is never accepted as a substitute for this proof.

import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const CONFIRM = 'I_UNDERSTAND_GYEON_ORDER_V3_C5C_IS_DISPOSABLE';
const apiUrl = process.env.C5C_API_URL;
const dbUrl = process.env.C5C_DB_URL;
const anonKey = process.env.C5C_ANON_KEY;
const serviceKey = process.env.C5C_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(`C5C_REAL_AUTH_ERROR: ${message}`);
}

if (process.env.GYEON_ORDER_V3_C5C_DISPOSABLE_CONFIRM !== CONFIRM) fail('explicit disposable confirmation is missing');
if (!apiUrl || !dbUrl || !anonKey || !serviceKey) fail('C5C_API_URL, C5C_DB_URL, C5C_ANON_KEY and C5C_SERVICE_ROLE_KEY are required');
const parsedApi = new URL(apiUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedApi.hostname)) fail('API URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(apiUrl)) fail('API URL must never resolve to a hosted Supabase host');
const parsedDb = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedDb.hostname)) fail('database URL must be loopback-only');
if (/supabase\.(co|in)|pooler\.supabase/.test(dbUrl)) fail('database URL must never resolve to a hosted Supabase host');

const runId = process.env.GYEON_ORDER_V3_C5C_SUFFIX ?? randomUUID().slice(0, 8);
const password = `C5C-${randomUUID()}-aA1!`;

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
  return `code=${code}`;
}

// The C5-B runtime SQL is applied after the local Supabase stack starts.
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
  const probe = await request('/rest/v1/gyeon_ordering_memberships?select=dealer_id&limit=0', {
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
  const email = `c5c-${label}-${runId}@example.invalid`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email, password, email_confirm: true, app_metadata: { c5c: true } },
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
// Fixtures: the exact eight-principal matrix required by the C5-C plan.
// ---------------------------------------------------------------------------

const users = {
  owner: await createUser('owner'),
  manager: await createUser('manager'),
  staff: await createUser('staff'),
  readonly: await createUser('readonly'),
  suspended: await createUser('suspended'),
  dealerBOwner: await createUser('dealer-b-owner'),
  noMembership: await createUser('no-membership'),
  expiredOrdering: await createUser('expired-ordering'),
};

const ids = {
  dealerA: randomUUID(),
  dealerB: randomUUID(),
  dealerC: randomUUID(),
  product: randomUUID(),
  offer: randomUUID(),
};

await serviceInsert('dealers', [
  { id: ids.dealerA, name: 'C5C Real Auth Dealer A', dealer_type: 'GYEON_DETAILER', status: 'active' },
  { id: ids.dealerB, name: 'C5C Real Auth Dealer B', dealer_type: 'GYEON_DETAILER', status: 'active' },
  { id: ids.dealerC, name: 'C5C Real Auth Dealer C (expired ordering)', dealer_type: 'GYEON_DETAILER', status: 'active' },
]);

await serviceInsert('dealer_members', [
  { dealer_id: ids.dealerA, user_id: users.owner.id, role: 'owner', status: 'active' },
  { dealer_id: ids.dealerA, user_id: users.manager.id, role: 'manager', status: 'active' },
  { dealer_id: ids.dealerA, user_id: users.staff.id, role: 'staff', status: 'active' },
  { dealer_id: ids.dealerA, user_id: users.readonly.id, role: 'readonly', status: 'active' },
  { dealer_id: ids.dealerA, user_id: users.suspended.id, role: 'staff', status: 'suspended' },
  { dealer_id: ids.dealerB, user_id: users.dealerBOwner.id, role: 'owner', status: 'active' },
  { dealer_id: ids.dealerC, user_id: users.expiredOrdering.id, role: 'owner', status: 'active' },
]);

const yesterday = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

await serviceInsert('gyeon_ordering_memberships', [
  { dealer_id: ids.dealerA, membership_status: 'active', buyer_rank: 'detailer', effective_from: yesterday },
  { dealer_id: ids.dealerB, membership_status: 'active', buyer_rank: 'detailer', effective_from: yesterday },
  { dealer_id: ids.dealerC, membership_status: 'active', buyer_rank: 'detailer', effective_from: twoDaysAgo, effective_to: yesterday },
]);

await serviceInsert('gyeon_dealer_qualification_mode_projection', [
  { dealer_id: ids.dealerA, qualification_mode: 'none', projection_version: 1, authority_state: 'CONFIGURED', effective_from: yesterday },
]);

await serviceInsert('gyeon_products', [{ id: ids.product, sku: `C5C-HTTP-${runId}`, product_name: 'C5C HTTP Product', category: 'coating', is_active: true }]);
await serviceInsert('gyeon_product_order_offers_v3', [{
  id: ids.offer, product_id: ids.product, buyer_rank: 'detailer', tax_rate_bps: 1000,
  list_price_ex_tax_yen: 20000, list_price_inc_tax_yen: 22000,
  purchase_price_ex_tax_yen: 15000, purchase_price_inc_tax_yen: 16500,
  backorder_permitted: true, publication_state: 'published', is_sellable: true,
  offer_version: 1, effective_from: yesterday, authority_updated_at: new Date().toISOString(),
}]);
await serviceInsert('gyeon_order_supply_projection', [{
  product_id: ids.product, authority_state: 'CONFIGURED', formal_inventory_qty: 5,
  reserved_qty: 0, inbound_confirmed_pending_stocktake_qty: 0, orderable_qty: 5,
  backorder_allowed: true, source_version: `c5c-http-${runId}`, observed_at: new Date().toISOString(),
}]);
// gyeon_warehouse_calendar_days has a single global warehouse_date primary
// key (it is not dealer-scoped). concurrency.mjs commits rows for the same
// dates in the same disposable database, so this insert must upsert rather
// than assume no prior row exists for today.
await serviceInsert('gyeon_warehouse_calendar_days', [{
  warehouse_date: new Date().toISOString().slice(0, 10), operating_mode: 'normal', cutoff_minute_jst: 1439, calendar_version: 1,
}], { onConflict: 'warehouse_date' });

// ---------------------------------------------------------------------------
// Baseline denial: anon and direct table access.
// ---------------------------------------------------------------------------

const anonRead = await request('/rest/v1/product_orders?select=id');
record('anon cannot read orders', [401, 403].includes(anonRead.status), `HTTP ${anonRead.status}`);

const directInsert = await request('/rest/v1/product_orders', {
  method: 'POST', token: users.staff.token, body: { dealer_id: ids.dealerA, status: 'draft' }, prefer: 'return=minimal',
});
record('authenticated cannot insert product_orders directly', [401, 403].includes(directInsert.status), `HTTP ${directInsert.status}`);

for (const table of [
  'gyeon_order_external_evidence_v1', 'gyeon_order_prepared_operations_v1',
  'gyeon_order_qualification_snapshots', 'gyeon_order_external_compensation_outbox',
  'gyeon_order_warehouse_tasks',
]) {
  const readAttempt = await request(`/rest/v1/${table}?select=id`, { token: users.owner.token });
  record(`authenticated cannot read ${table} directly`, [401, 403].includes(readAttempt.status), `HTTP ${readAttempt.status}`);
  const writeAttempt = await request(`/rest/v1/${table}`, { method: 'POST', token: users.owner.token, body: {}, prefer: 'return=minimal' });
  record(`authenticated cannot write ${table} directly`, [401, 403, 400].includes(writeAttempt.status), `HTTP ${writeAttempt.status}`);
}

// ---------------------------------------------------------------------------
// Catalog and draft-save role matrix.
// ---------------------------------------------------------------------------

const catalog = await rpc('list_gyeon_order_catalog_v3_rpc', users.staff.token, { p_dealer_id: ids.dealerA, p_actor_id: users.staff.id });
record('staff real token reads catalog', catalog.status === 200 && Array.isArray(catalog.payload) && catalog.payload.length === 1, `HTTP ${catalog.status}`);

const foreignCatalog = await rpc('list_gyeon_order_catalog_v3_rpc', users.dealerBOwner.token, { p_dealer_id: ids.dealerA, p_actor_id: users.dealerBOwner.id });
record('foreign real token is denied Dealer A catalog', [401, 403].includes(foreignCatalog.status), `HTTP ${foreignCatalog.status}`);

const readonlySave = await rpc('save_gyeon_order_v3_draft_rpc', users.readonly.token, {
  p_dealer_id: ids.dealerA, p_actor_id: users.readonly.id, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1 }], p_draft_fields: {},
});
record('readonly real token cannot save a draft', [401, 403].includes(readonlySave.status), `HTTP ${readonlySave.status}`);

const suspendedSave = await rpc('save_gyeon_order_v3_draft_rpc', users.suspended.token, {
  p_dealer_id: ids.dealerA, p_actor_id: users.suspended.id, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1 }], p_draft_fields: {},
});
record('suspended member real token cannot save a draft', [401, 403].includes(suspendedSave.status), `HTTP ${suspendedSave.status}`);

const noMembershipSave = await rpc('save_gyeon_order_v3_draft_rpc', users.noMembership.token, {
  p_dealer_id: ids.dealerA, p_actor_id: users.noMembership.id, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1 }], p_draft_fields: {},
});
record('a user with no dealer membership cannot save a draft', [401, 403].includes(noMembershipSave.status), `HTTP ${noMembershipSave.status}`);

const expiredOrderingSave = await rpc('save_gyeon_order_v3_draft_rpc', users.expiredOrdering.token, {
  p_dealer_id: ids.dealerC, p_actor_id: users.expiredOrdering.id, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1 }], p_draft_fields: {},
});
record('an owner with an expired ordering membership cannot save a draft', [401, 403].includes(expiredOrderingSave.status), `HTTP ${expiredOrderingSave.status}`);

const forgedFieldsSave = await rpc('save_gyeon_order_v3_draft_rpc', users.staff.token, {
  p_dealer_id: ids.dealerA, p_actor_id: users.staff.id, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1, price: 1 }], p_draft_fields: {},
});
record('client-forged commercial fields in a line are rejected', forgedFieldsSave.status === 400, `HTTP ${forgedFieldsSave.status}`);

const draft = await rpc('save_gyeon_order_v3_draft_rpc', users.staff.token, {
  p_dealer_id: ids.dealerA, p_actor_id: users.staff.id, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1 }],
  p_draft_fields: { destination_kind: 'own_store', delivery_snapshot: { label: 'C5C Dealer A' } },
});
const orderId = draft.payload?.order_id;
record('staff real token creates a server-priced draft', draft.status === 200 && Boolean(orderId), `HTTP ${draft.status}`);

const foreignRows = await request(`/rest/v1/product_orders?select=id&dealer_id=eq.${ids.dealerA}`, { token: users.dealerBOwner.token });
record('foreign real token cannot read Dealer A order rows', foreignRows.status === 200 && Array.isArray(foreignRows.payload) && foreignRows.payload.length === 0, `HTTP ${foreignRows.status}`);

if (orderId) {
  const managerReview = await rpc('request_gyeon_order_v3_owner_review_rpc', users.manager.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.manager.id, p_order_id: orderId,
    p_expected_version: 1, p_idempotency_key: randomUUID(), p_note: 'C5C real Auth review',
  });
  record('manager real token requests owner review', managerReview.status === 200 && managerReview.payload?.owner_review_state === 'pending', `HTTP ${managerReview.status}`);

  const staffPrepareDenied = await rpc('prepare_gyeon_order_v3_owner_submit_rpc', users.staff.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.staff.id, p_order_id: orderId,
    p_expected_version: 2, p_payment_method: 'bank_transfer_prepaid', p_backorder_policy: null,
  });
  record('staff real token cannot prepare an owner-submit', [401, 403].includes(staffPrepareDenied.status), `HTTP ${staffPrepareDenied.status}`);

  const managerCancelDenied = await rpc('cancel_gyeon_order_v3_before_warehouse_rpc', users.manager.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.manager.id, p_order_id: orderId,
    p_expected_version: 2, p_idempotency_key: randomUUID(),
  });
  record('manager real token cannot cancel an order', [401, 403].includes(managerCancelDenied.status), `HTTP ${managerCancelDenied.status}`);

  const ownerPrepare = await rpc('prepare_gyeon_order_v3_owner_submit_rpc', users.owner.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
    p_expected_version: 2, p_payment_method: 'card', p_backorder_policy: null,
  });
  record('owner real token prepares an owner-submit', ownerPrepare.status === 200 && ownerPrepare.payload?.requires_external_authorization === true, `HTTP ${ownerPrepare.status}`);

  const forgedQualificationMode = await rpc('prepare_gyeon_order_v3_owner_submit_rpc', users.owner.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
    p_expected_version: 2, p_payment_method: 'card', p_backorder_policy: null,
    p_qualification_mode: 'shop_initial',
  });
  record('an unknown p_qualification_mode parameter is never accepted by the public prepare RPC', ![200, 201].includes(forgedQualificationMode.status), `HTTP ${forgedQualificationMode.status}`);

  const forgedRole = await rpc('prepare_gyeon_order_v3_owner_submit_rpc', users.owner.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
    p_expected_version: 2, p_payment_method: 'card', p_backorder_policy: null,
    p_role: 'owner',
  });
  record('a forged p_role parameter is never accepted by the public prepare RPC', ![200, 201].includes(forgedRole.status), `HTTP ${forgedRole.status}`);

  const forgedPrice = await rpc('prepare_gyeon_order_v3_owner_submit_rpc', users.owner.token, {
    p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
    p_expected_version: 2, p_payment_method: 'card', p_backorder_policy: null,
    p_price: 1,
  });
  record('a forged p_price parameter is never accepted by the public prepare RPC', ![200, 201].includes(forgedPrice.status), `HTTP ${forgedPrice.status}`);

  if (ownerPrepare.payload?.prepared_operation_id) {
    const evidenceId = randomUUID();
    await serviceInsert('gyeon_order_external_evidence_v1', [{
      id: evidenceId, purpose: 'initial_authorization', provider: 'stub_card_psp', provider_event_id: `evt-${runId}`,
      dealer_id: ids.dealerA, order_id: orderId, order_version: 2,
      request_fingerprint: ownerPrepare.payload.request_fingerprint,
      amount_inc_tax_yen: ownerPrepare.payload.amount_inc_tax_yen, currency: 'JPY',
      authority: 'server_verified', state: 'succeeded', server_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 600000).toISOString(), payload_hash: `hash-${runId}`,
    }]);

    const forgedEvidenceSuccess = await rpc('finalize_gyeon_order_v3_owner_submit_rpc', users.owner.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
      p_expected_version: 2, p_idempotency_key: randomUUID(), p_payment_method: 'card', p_backorder_policy: null,
      p_prepared_operation_id: ownerPrepare.payload.prepared_operation_id, p_evidence_id: evidenceId,
      p_evidence_success: true,
    });
    record('a forged p_evidence_success parameter is never accepted by the public finalize RPC', ![200, 201].includes(forgedEvidenceSuccess.status), `HTTP ${forgedEvidenceSuccess.status}`);

    const ownerFinalize = await rpc('finalize_gyeon_order_v3_owner_submit_rpc', users.owner.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
      p_expected_version: 2, p_idempotency_key: randomUUID(), p_payment_method: 'card', p_backorder_policy: null,
      p_prepared_operation_id: ownerPrepare.payload.prepared_operation_id, p_evidence_id: evidenceId,
    });
    record('owner real token finalizes the owner-submit with the accepted evidence', ownerFinalize.status === 200 && ownerFinalize.payload?.ok === true, `HTTP ${ownerFinalize.status}`);

    const staffEditDenied = await rpc('prepare_gyeon_order_v3_edit_rpc', users.staff.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.staff.id, p_order_id: orderId,
      p_expected_version: 3, p_replacement_lines: [{ product_id: ids.product, quantity: 2 }],
    });
    record('staff real token cannot prepare a pre-warehouse edit', [401, 403].includes(staffEditDenied.status), `HTTP ${staffEditDenied.status}`);

    // Positive owner path: an amount-preserving edit (identical single line)
    // never requires external reauthorization and must succeed end-to-end.
    const ownerEditPrepare = await rpc('prepare_gyeon_order_v3_edit_rpc', users.owner.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
      p_expected_version: 3, p_replacement_lines: [{ product_id: ids.product, quantity: 1 }],
    });
    record('owner real token prepares an amount-preserving edit without external reauthorization', ownerEditPrepare.status === 200 && ownerEditPrepare.payload?.action === 'finalize_without_external_authorization', `HTTP ${ownerEditPrepare.status}`);

    const ownerEditFinalize = await rpc('finalize_gyeon_order_v3_edit_rpc', users.owner.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
      p_expected_version: 3, p_idempotency_key: randomUUID(),
      p_replacement_lines: [{ product_id: ids.product, quantity: 1 }],
    });
    record('owner real token finalizes the amount-preserving edit', ownerEditFinalize.status === 200 && ownerEditFinalize.payload?.ok === true, `HTTP ${ownerEditFinalize.status}`);

    const ownerCancelDenied = await rpc('cancel_gyeon_order_v3_before_warehouse_rpc', users.owner.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
      p_expected_version: 99, p_idempotency_key: randomUUID(),
    });
    record('owner real token cancel with a stale expected version fails closed', ![200, 201].includes(ownerCancelDenied.status), `HTTP ${ownerCancelDenied.status}`);

    // Positive owner path: a real cancel with the correct current expected
    // version must succeed, not merely be denied in every tested scenario.
    const ownerCancelSuccess = await rpc('cancel_gyeon_order_v3_before_warehouse_rpc', users.owner.token, {
      p_dealer_id: ids.dealerA, p_actor_id: users.owner.id, p_order_id: orderId,
      p_expected_version: 4, p_idempotency_key: randomUUID(),
    });
    record('owner real token successfully cancels the order with the correct expected version', ownerCancelSuccess.status === 200 && ownerCancelSuccess.payload?.status === 'cancelled', `HTTP ${ownerCancelSuccess.status}`);
  }
}

const passed = results.filter((entry) => entry.ok).length;
process.stdout.write(`${JSON.stringify({ type: 'summary', passed, total: results.length, secrets_logged: false })}\n`);
if (passed !== results.length) process.exitCode = 1;
