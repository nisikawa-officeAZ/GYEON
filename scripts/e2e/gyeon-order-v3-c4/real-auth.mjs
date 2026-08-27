#!/usr/bin/env node
// GYEON_ORDER_V3_C4_R1_REAL_AUTH
// Real local GoTrue tokens + PostgREST requests. No token or secret is logged.

import { randomUUID } from 'node:crypto';

const CONFIRM = 'I_UNDERSTAND_GYEON_ORDER_V3_C4_IS_DISPOSABLE';
const apiUrl = process.env.C4_API_URL;
const anonKey = process.env.C4_ANON_KEY;
const serviceKey = process.env.C4_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(`C4_REAL_AUTH_ERROR: ${message}`);
}

if (process.env.GYEON_ORDER_V3_C4_DISPOSABLE_CONFIRM !== CONFIRM) fail('explicit disposable confirmation is missing');
if (!apiUrl || !anonKey || !serviceKey) fail('C4_API_URL, C4_ANON_KEY and C4_SERVICE_ROLE_KEY are required');
const parsed = new URL(apiUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) fail('API URL must be loopback-only');

const runId = process.env.GYEON_ORDER_V3_C4_SUFFIX ?? randomUUID().slice(0, 8);
const password = `C4-${randomUUID()}-aA1!`;
const ids = {
  dealerA: randomUUID(), dealerB: randomUUID(), product: randomUUID(), offer: randomUUID(),
  owner: null, staff: null, readonly: null, foreign: null,
};
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${JSON.stringify({ type: 'assertion', name, ok, detail })}\n`);
  if (!ok) process.exitCode = 1;
}

async function request(path, { method = 'GET', key = anonKey, token = key, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${apiUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { unparsed: true }; }
  return { status: response.status, payload };
}

async function createUser(label) {
  const email = `c4-${label}-${runId}@example.invalid`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email, password, email_confirm: true, app_metadata: { c4: true } },
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
  if (response.status !== 201) fail(`service fixture insert failed for ${table}: HTTP ${response.status}`);
}

async function rpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', key: anonKey, token, body });
}

const users = {
  owner: await createUser('owner'),
  staff: await createUser('staff'),
  readonly: await createUser('readonly'),
  foreign: await createUser('foreign'),
};
ids.owner = users.owner.id;
ids.staff = users.staff.id;
ids.readonly = users.readonly.id;
ids.foreign = users.foreign.id;

await serviceInsert('dealers', [
  { id: ids.dealerA, name: 'C4 Real Auth Dealer A', dealer_type: 'GYEON_DETAILER', status: 'active' },
  { id: ids.dealerB, name: 'C4 Real Auth Dealer B', dealer_type: 'GYEON_DETAILER', status: 'active' },
]);
await serviceInsert('dealer_members', [
  { dealer_id: ids.dealerA, user_id: ids.owner, role: 'owner', status: 'active' },
  { dealer_id: ids.dealerA, user_id: ids.staff, role: 'staff', status: 'active' },
  { dealer_id: ids.dealerA, user_id: ids.readonly, role: 'readonly', status: 'active' },
  { dealer_id: ids.dealerB, user_id: ids.foreign, role: 'owner', status: 'active' },
]);
await serviceInsert('gyeon_ordering_memberships', [
  { dealer_id: ids.dealerA, membership_status: 'active', buyer_rank: 'detailer', effective_from: new Date(Date.now() - 3600000).toISOString() },
  { dealer_id: ids.dealerB, membership_status: 'active', buyer_rank: 'detailer', effective_from: new Date(Date.now() - 3600000).toISOString() },
]);
await serviceInsert('gyeon_products', [{ id: ids.product, sku: `C4-HTTP-${runId}`, product_name: 'C4 HTTP Product', category: 'coating', is_active: true }]);
await serviceInsert('gyeon_product_order_offers_v3', [{
  id: ids.offer, product_id: ids.product, buyer_rank: 'detailer', tax_rate_bps: 1000,
  list_price_ex_tax_yen: 20000, list_price_inc_tax_yen: 22000,
  purchase_price_ex_tax_yen: 15000, purchase_price_inc_tax_yen: 16500,
  backorder_permitted: true, publication_state: 'published', is_sellable: true,
  offer_version: 1, effective_from: new Date(Date.now() - 3600000).toISOString(), authority_updated_at: new Date().toISOString(),
}]);
await serviceInsert('gyeon_order_supply_projection', [{
  product_id: ids.product, authority_state: 'CONFIGURED', formal_inventory_qty: 1,
  reserved_qty: 0, inbound_confirmed_pending_stocktake_qty: 0, orderable_qty: 1,
  backorder_allowed: true, source_version: `c4-http-${runId}`, observed_at: new Date().toISOString(),
}]);

const anonRead = await request('/rest/v1/product_orders?select=id');
record('anon cannot read orders', [401, 403].includes(anonRead.status), `HTTP ${anonRead.status}`);

const directInsert = await request('/rest/v1/product_orders', {
  method: 'POST', token: users.staff.token, body: { dealer_id: ids.dealerA, status: 'draft' }, prefer: 'return=minimal',
});
record('authenticated cannot insert directly', [401, 403].includes(directInsert.status), `HTTP ${directInsert.status}`);

const catalog = await rpc('list_gyeon_order_catalog_v3_rpc', users.staff.token, { p_dealer_id: ids.dealerA, p_actor_id: ids.staff });
record('staff real token reads catalog', catalog.status === 200 && Array.isArray(catalog.payload) && catalog.payload.length === 1, `HTTP ${catalog.status}; rows=${Array.isArray(catalog.payload) ? catalog.payload.length : 'n/a'}`);

const foreignCatalog = await rpc('list_gyeon_order_catalog_v3_rpc', users.foreign.token, { p_dealer_id: ids.dealerA, p_actor_id: ids.foreign });
record('foreign real token is denied Dealer A catalog', [401, 403].includes(foreignCatalog.status), `HTTP ${foreignCatalog.status}`);

const readonlySave = await rpc('save_gyeon_order_v3_draft_rpc', users.readonly.token, {
  p_dealer_id: ids.dealerA, p_actor_id: ids.readonly, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 1 }], p_draft_fields: {},
});
record('readonly real token cannot save draft', [401, 403].includes(readonlySave.status), `HTTP ${readonlySave.status}`);

const draft = await rpc('save_gyeon_order_v3_draft_rpc', users.staff.token, {
  p_dealer_id: ids.dealerA, p_actor_id: ids.staff, p_idempotency_key: randomUUID(),
  p_order_id: null, p_expected_version: 0,
  p_lines: [{ product_id: ids.product, quantity: 2 }],
  p_draft_fields: { destination_kind: 'own_store', delivery_snapshot: { label: 'C4 Dealer A' } },
});
const orderId = draft.payload?.order_id;
record('staff real token creates server-priced draft', draft.status === 200 && Boolean(orderId) && draft.payload?.contains_backorder === true, `HTTP ${draft.status}; order=${Boolean(orderId)}; backorder=${draft.payload?.contains_backorder}`);

const foreignRows = await request(`/rest/v1/product_orders?select=id&dealer_id=eq.${ids.dealerA}`, { token: users.foreign.token });
record('foreign real token cannot read Dealer A order', foreignRows.status === 200 && Array.isArray(foreignRows.payload) && foreignRows.payload.length === 0, `HTTP ${foreignRows.status}; rows=${Array.isArray(foreignRows.payload) ? foreignRows.payload.length : 'n/a'}`);

if (orderId) {
  const review = await rpc('request_gyeon_order_v3_owner_review_rpc', users.staff.token, {
    p_dealer_id: ids.dealerA, p_actor_id: ids.staff, p_order_id: orderId,
    p_expected_version: 1, p_idempotency_key: randomUUID(), p_note: 'C4 real Auth review',
  });
  record('staff real token requests owner review', review.status === 200 && review.payload?.owner_review_state === 'pending', `HTTP ${review.status}; state=${review.payload?.owner_review_state}`);

  const submit = await rpc('owner_submit_gyeon_order_v3_rpc', users.owner.token, {
    p_dealer_id: ids.dealerA, p_actor_id: ids.owner, p_order_id: orderId,
    p_expected_version: 2, p_idempotency_key: randomUUID(),
    p_payment_method: 'bank_transfer_prepaid', p_backorder_policy: 'ship_available_first', p_payment_evidence_id: null,
  });
  record('owner submit fails closed without qualification authority', submit.status === 400 && submit.payload?.code === '0A000' && submit.payload?.message === 'QUALIFICATION_AUTHORITY_NOT_CONFIGURED', `HTTP ${submit.status}; code=${submit.payload?.code ?? 'n/a'}; message=${submit.payload?.message ?? 'n/a'}`);
}

const passed = results.filter((entry) => entry.ok).length;
process.stdout.write(`${JSON.stringify({ type: 'summary', passed, total: results.length, secrets_logged: false })}\n`);
if (passed !== results.length) process.exitCode = 1;
