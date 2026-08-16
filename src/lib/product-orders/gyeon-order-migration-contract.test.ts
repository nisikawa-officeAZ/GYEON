import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const migrationName = readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_gyeon_product_order_v1_contract.sql"),
);
assert.ok(migrationName, "GYEON order V1 migration must exist");
const sql = readFileSync(`supabase/migrations/${migrationName}`, "utf8");

test("migration is transactional, bounded, and source-only", () => {
  assert.match(sql, /^-- GYEON product-order V1 runtime contract/m);
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.match(sql, /set local lock_timeout = '5s'/i);
  assert.match(sql, /set local statement_timeout = '30s'/i);
  assert.match(sql, /SOURCE ONLY: creating this file does not authorize applying it/i);
});

test("GYEON offer and shipping authority stay separate from Office AZ inventory", () => {
  assert.match(sql, /create table if not exists public\.gyeon_product_order_offers/i);
  assert.match(sql, /primary key \(product_id, buyer_rank\)/i);
  assert.match(sql, /create table if not exists public\.gyeon_order_shipping_rates/i);
  assert.match(sql, /supply_availability in \('in_stock','low_stock','out_of_stock','unknown'\)/i);
  assert.equal(/office_az|inventory_ledger|stock_balance/i.test(sql), false);
});

test("six states and immutable amount snapshots are represented", () => {
  assert.match(sql, /status in \('draft','submitted','approved','fulfilling','fulfilled','cancelled'\)/i);
  for (const column of [
    "buyer_rank_snapshot", "payment_method", "free_shipping_basis",
    "free_shipping_threshold_yen", "shipping_basis_yen", "shipping_zone_code",
    "shipping_rate_version_snapshot", "shipping_fee_yen",
    "product_subtotal_inc_tax_yen", "payable_amount_yen",
    "offer_version_snapshot", "line_list_subtotal_inc_tax_yen",
    "line_payable_subtotal_inc_tax_yen", "backorder_allowed_snapshot",
  ]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}\\b`, "i"), column);
  }
});

test("authenticated table writes are removed and only tenant-scoped SELECT remains", () => {
  assert.match(sql, /revoke all privileges on table public\.product_orders\s+from public, anon, authenticated/i);
  assert.match(sql, /revoke all privileges on table public\.product_order_items\s+from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.product_orders to authenticated/i);
  assert.match(sql, /grant select on table public\.product_order_items to authenticated/i);
  assert.match(sql, /create policy product_orders_v1_select[\s\S]*for select to authenticated/i);
  assert.match(sql, /not exists \([\s\S]*from public\.dealer_staff/i);
  assert.match(sql, /dm\.status = 'active'/i);
});

test("idempotency is dealer-scoped, payload-bound, and locked before mutations", () => {
  assert.match(sql, /primary key \(dealer_id, idempotency_key\)/i);
  const lockAt = sql.indexOf("for update;", sql.indexOf("gyeon_order_idempotency gi"));
  const offerAt = sql.indexOf("from public.gyeon_product_order_offers o");
  const sequenceAt = sql.indexOf("get_next_document_number(");
  const orderInsertAt = sql.indexOf("insert into public.product_orders (");
  assert.ok(lockAt > 0 && lockAt < offerAt, "idempotency row is locked before offers");
  assert.ok(offerAt < sequenceAt, "offers are validated before number allocation");
  assert.ok(sequenceAt < orderInsertAt, "number is allocated before atomic order insert");
  assert.match(sql, /v_existing_payload is distinct from v_request_payload/i);
  assert.match(sql, /'actorId', p_actor::text/i);
});

test("create RPC accepts no client price, SKU, rank, shipping fee, status, or total", () => {
  const signature = sql.match(
    /create or replace function public\.create_gyeon_product_order_v1_rpc\(([\s\S]*?)\)\s*returns jsonb/i,
  )?.[1] ?? "";
  assert.match(signature, /p_dealer_id uuid/i);
  assert.match(signature, /p_actor uuid/i);
  assert.match(signature, /p_idempotency_key text/i);
  assert.match(signature, /p_lines jsonb/i);
  for (const forbidden of ["price", "sku", "rank", "shipping", "status", "total", "payable"]) {
    assert.equal(signature.toLowerCase().includes(forbidden), false, forbidden);
  }
  assert.match(sql, /select d\.status, d\.detailer_rank, d\.prefecture/i);
  assert.match(sql, /join public\.gyeon_products p on p\.id = o\.product_id/i);
  assert.match(sql, /v_free_shipping := v_shipping_basis >= 30000/i);
});

test("all SECURITY DEFINER functions pin search_path and default EXECUTE is removed", () => {
  const definers = sql.match(/security definer/gim) ?? [];
  const pinned = sql.match(/set search_path = pg_catalog, public/gim) ?? [];
  assert.equal(definers.length, 5);
  assert.equal(pinned.length, definers.length);

  for (const fn of [
    "gyeon_order_v1_actor_role",
    "gyeon_order_v1_result",
    "create_gyeon_product_order_v1_rpc",
    "cancel_gyeon_product_order_v1_rpc",
    "update_gyeon_product_order_notes_v1_rpc",
  ]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}`, "i"), fn);
  }
  assert.match(sql, /grant execute on function public\.create_gyeon_product_order_v1_rpc[\s\S]*to authenticated/i);
  assert.equal(/grant execute[\s\S]*to (public|anon)/i.test(sql), false);
});

test("foreign keys added by V1 have supporting indexes", () => {
  for (const index of [
    "product_orders_created_by_idx",
    "product_order_items_product_id_idx",
    "gyeon_order_idempotency_actor_idx",
    "gyeon_order_idempotency_order_idx",
  ]) {
    assert.match(sql, new RegExp(`create (?:unique )?index if not exists ${index}`, "i"), index);
  }
});
