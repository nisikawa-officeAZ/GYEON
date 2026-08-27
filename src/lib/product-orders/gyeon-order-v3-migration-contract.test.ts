import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SQL_PATH = join(
  process.cwd(),
  "supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql",
);
const README_PATH = join(
  process.cwd(),
  "supabase/migrations/DRAFT_DO_NOT_APPLY/README.md",
);
const sql = readFileSync(SQL_PATH, "utf8");
const normalized = sql.toLowerCase().replace(/\s+/g, " ");
const executable = sql
  .replace(/--.*$/gm, "")
  .toLowerCase()
  .replace(/\s+/g, " ");
const readme = readFileSync(README_PATH, "utf8");

test("draft is visibly source-only and self-rolls back if executed accidentally", () => {
  assert.match(sql, /GYEON_ORDER_V3_C3_R1_SOURCE_ONLY/);
  assert.match(sql, /DRAFT_DO_NOT_APPLY/);
  assert.match(normalized, /begin;/);
  assert.match(normalized, /set local lock_timeout = '5s'/);
  assert.match(normalized, /set local statement_timeout = '30s'/);
  assert.match(normalized, /rollback;\s*$/);
  assert.match(readme, /DB接続を伴う検証はC4まで禁止です/);
});

test("commercial status is exactly the six-state V3 aggregate", () => {
  assert.match(
    normalized,
    /check \(status in \('draft', 'submitted', 'approved', 'fulfilling', 'fulfilled', 'cancelled'\)\)/,
  );
  const statusConstraint = normalized.match(
    /add constraint product_orders_status_check check \(status in \(([^)]+)\)\)/,
  );
  assert.ok(statusConstraint);
  for (const forbidden of ["backorder", "authorized", "owner_confirmed", "shipped", "issued"]) {
    assert.doesNotMatch(statusConstraint[1], new RegExp(`'${forbidden}'`));
  }
});

test("review, payment, backorder and warehouse work are separate state axes", () => {
  assert.match(normalized, /owner_review_state text not null default 'not_requested'/);
  assert.match(normalized, /payment_status text not null default 'selection_required'/);
  assert.match(normalized, /backorder_policy text/);
  assert.match(normalized, /create table if not exists public\.gyeon_order_warehouse_tasks/);
  assert.match(normalized, /create table if not exists public\.gyeon_order_owner_review_events/);
  assert.match(normalized, /create table if not exists public\.gyeon_order_payment_evidence/);
});

test("offers enforce one-item ordering and all four payment methods", () => {
  assert.match(normalized, /order_unit_qty integer not null default 1 check \(order_unit_qty = 1\)/);
  assert.match(
    normalized,
    /minimum_order_qty integer not null default 1 check \(minimum_order_qty = 1\)/,
  );
  for (const method of [
    "card",
    "bank_transfer_prepaid",
    "cash_on_delivery",
    "credit_account",
  ]) {
    assert.match(normalized, new RegExp(`'${method}'`));
  }
  assert.doesNotMatch(normalized, /case_multiple|case_quantity|minimum_case/);
});

test("shipping basis is ex-tax, starts at 30,000 yen and excludes promotional goods", () => {
  assert.match(normalized, /free_shipping_threshold_ex_tax_yen integer not null default 30000/);
  assert.match(normalized, /free_shipping_basis_ex_tax_yen/);
  assert.match(normalized, /not i\.is_promotional_goods_snapshot/);
  assert.doesNotMatch(normalized, /free_shipping_threshold_inc_tax/);
});

test("unknown supply remains explicit and separate from Office AZ inventory ownership", () => {
  assert.match(normalized, /authority_state in \('configured', 'not_configured', 'stale', 'error'\)/);
  assert.match(normalized, /formal_inventory_qty integer/);
  assert.match(normalized, /reserved_qty integer/);
  assert.match(normalized, /inbound_confirmed_pending_stocktake_qty integer/);
  assert.match(normalized, /orderable_qty integer/);
  assert.match(normalized, /authority_state <> 'configured'/);
  assert.doesNotMatch(normalized, /dealer_stock_levels/);
});

test("warehouse calendar is explicit and contains no weekday shortcut", () => {
  assert.match(normalized, /create table if not exists public\.gyeon_warehouse_calendar_days/);
  assert.match(normalized, /operating_mode in \('normal', 'closed', 'exceptional', 'shortened'\)/);
  assert.match(normalized, /warehouse_calendar_not_configured/);
  assert.doesNotMatch(executable, /extract\s*\(\s*dow|extract\s*\(\s*isodow/);
  assert.doesNotMatch(executable, /saturday|sunday|土曜|日曜/);
});

test("direct table writes are cut and authenticated receives SELECT only", () => {
  assert.match(
    normalized,
    /drop policy if exists "dealer members can manage their product_orders" on public\.product_orders/,
  );
  assert.match(
    normalized,
    /drop policy if exists "dealer members can manage their product_order_items" on public\.product_order_items/,
  );
  assert.match(
    normalized,
    /revoke all privileges on table[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.match(
    normalized,
    /grant select on table public\.product_orders, public\.product_order_items to authenticated/,
  );
  assert.doesNotMatch(normalized, /grant (insert|update|delete)[^;]* to authenticated/);
  assert.doesNotMatch(normalized, /for (insert|update|delete|all) to authenticated/);
});

test("tenant SELECT requires both active dealer membership and GYEON ordering membership", () => {
  assert.match(normalized, /dm\.user_id = auth\.uid\(\)/);
  assert.match(normalized, /dm\.status = 'active'/);
  assert.match(normalized, /d\.status = 'active'/);
  assert.match(normalized, /gom\.membership_status = 'active'/);
  assert.match(normalized, /gom\.effective_from <= now\(\)/);
  assert.match(normalized, /gom\.effective_to is null or gom\.effective_to > now\(\)/);
});

test("every new public table enables RLS", () => {
  const tables = [
    "gyeon_ordering_memberships",
    "gyeon_product_order_offers_v3",
    "gyeon_order_supply_projection",
    "gyeon_order_shipping_rule_versions",
    "gyeon_warehouse_calendar_days",
    "gyeon_dealer_credit_terms",
    "gyeon_order_idempotency_v3",
    "gyeon_order_owner_review_events",
    "gyeon_order_payment_evidence",
    "gyeon_order_warehouse_tasks",
    "gyeon_order_notification_outbox",
  ];
  for (const table of tables) {
    assert.match(normalized, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("security-definer functions use an empty search path and exact-schema references", () => {
  const definitions = sql.matchAll(
    /create or replace function\s+([\w.]+)[\s\S]*?\$\$;/gi,
  );
  let count = 0;
  for (const match of definitions) {
    count += 1;
    const body = match[0].toLowerCase();
    assert.match(body, /set search_path = ''/, `${match[1]} must set an empty search_path`);
  }
  assert.ok(count >= 10);
  assert.doesNotMatch(normalized, /auth\.role\(\)|user_metadata|raw_user_meta_data/);
});

test("function execution is revoked before exact caller grants", () => {
  const rpcNames = [
    "list_gyeon_order_catalog_v3_rpc",
    "save_gyeon_order_v3_draft_rpc",
    "request_gyeon_order_v3_owner_review_rpc",
    "owner_submit_gyeon_order_v3_rpc",
    "edit_gyeon_order_v3_before_warehouse_rpc",
    "cancel_gyeon_order_v3_before_warehouse_rpc",
    "accept_gyeon_order_v3_warehouse_rpc",
  ];
  for (const name of rpcNames) {
    assert.match(
      normalized,
      new RegExp(`revoke all on function public\\.${name}\\(`),
      `${name} must revoke default execute`,
    );
  }
  assert.match(
    normalized,
    /grant execute on function public\.accept_gyeon_order_v3_warehouse_rpc\([^;]+\) to service_role/,
  );
  assert.match(
    normalized,
    /grant execute on function public\.list_gyeon_order_catalog_v3_rpc\([^;]+\) to authenticated/,
  );
  assert.doesNotMatch(
    normalized,
    /grant execute on function public\.accept_gyeon_order_v3_warehouse_rpc\([^;]+\) to authenticated/,
  );
});
