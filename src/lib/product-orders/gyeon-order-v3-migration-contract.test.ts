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

const NEW_C5_B_TABLES = [
  "gyeon_order_external_evidence_v1",
  "gyeon_order_prepared_operations_v1",
  "gyeon_qualification_rule_versions",
  "gyeon_product_qualification_classification",
  "gyeon_dealer_qualification_mode_projection",
  "gyeon_order_qualification_snapshots",
  "gyeon_order_external_compensation_outbox",
];

test("draft is visibly source-only and self-rolls back if executed accidentally", () => {
  assert.match(sql, /GYEON_ORDER_V3_C3_R1_SOURCE_ONLY/);
  assert.match(sql, /GYEON_ORDER_V3_C5_B_EXTERNAL_AUTHORITY_DB_SOURCE_ONLY/);
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

test("every public table -- C4 and C5-B -- enables RLS", () => {
  const tables = [
    "gyeon_ordering_memberships",
    "gyeon_product_order_offers_v3",
    "gyeon_order_supply_projection",
    "gyeon_order_shipping_rule_versions",
    "gyeon_warehouse_calendar_days",
    "gyeon_dealer_credit_terms",
    "gyeon_order_idempotency_v3",
    "gyeon_order_owner_review_events",
    "gyeon_order_warehouse_tasks",
    "gyeon_order_notification_outbox",
    ...NEW_C5_B_TABLES,
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
  assert.ok(count >= 17, `expected at least 17 security-definer functions, found ${count}`);
  assert.doesNotMatch(normalized, /auth\.role\(\)|user_metadata|raw_user_meta_data/);
});

test("function execution is revoked before exact caller grants", () => {
  const authenticatedRpcNames = [
    "list_gyeon_order_catalog_v3_rpc",
    "save_gyeon_order_v3_draft_rpc",
    "request_gyeon_order_v3_owner_review_rpc",
    "prepare_gyeon_order_v3_owner_submit_rpc",
    "finalize_gyeon_order_v3_owner_submit_rpc",
    "prepare_gyeon_order_v3_edit_rpc",
    "finalize_gyeon_order_v3_edit_rpc",
    "cancel_gyeon_order_v3_before_warehouse_rpc",
  ];
  const serviceOnlyRpcNames = [
    "release_gyeon_order_v3_warehouse_rpc",
    "accept_gyeon_order_v3_warehouse_rpc",
  ];
  for (const name of [...authenticatedRpcNames, ...serviceOnlyRpcNames]) {
    assert.match(
      normalized,
      new RegExp(`revoke all on function public\\.${name}\\(`),
      `${name} must revoke default execute`,
    );
  }
  for (const name of authenticatedRpcNames) {
    assert.match(
      normalized,
      new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to authenticated`),
    );
  }
  for (const name of serviceOnlyRpcNames) {
    assert.match(
      normalized,
      new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to service_role`),
    );
    assert.doesNotMatch(
      normalized,
      new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to authenticated`),
    );
  }
});

test("external evidence is generic, purpose-bound, one-time consumable, and stores no secret", () => {
  assert.match(normalized, /create table if not exists public\.gyeon_order_external_evidence_v1/);
  assert.match(
    normalized,
    /purpose text not null check \(purpose in \(\s*'initial_authorization', 'edit_reauthorization', 'bank_payment_match', 'inventory_reservation'/,
  );
  assert.match(normalized, /unique \(provider, provider_event_id\)/);
  assert.match(
    normalized,
    /check \(expires_at is null or server_verified_at is null or expires_at > server_verified_at\)/,
  );
  assert.match(normalized, /payload_hash text not null/);
  assert.match(normalized, /consumed_at timestamptz,\s*consumed_by_operation text,\s*payload_hash/);
  for (const forbidden of [
    "card_number",
    "cvv",
    "bank_account_number",
    "raw_payload",
    "provider_secret",
    "client_secret",
  ]) {
    assert.doesNotMatch(normalized, new RegExp(forbidden));
  }
  assert.doesNotMatch(normalized, /create table if not exists public\.gyeon_order_payment_evidence/);
});

test("prepared operations bind owner_submit and edit_before_warehouse kinds to their evidence purpose", () => {
  assert.match(normalized, /create table if not exists public\.gyeon_order_prepared_operations_v1/);
  assert.match(normalized, /kind text not null check \(kind in \('owner_submit', 'edit_before_warehouse'\)\)/);
  assert.match(
    normalized,
    /check \(\s*\(kind = 'owner_submit' and evidence_purpose = 'initial_authorization'\)\s*or \(kind = 'edit_before_warehouse' and evidence_purpose = 'edit_reauthorization'\)\s*\)/,
  );
});

test("qualification authority is versioned, service-owned, and has no client writer or seed", () => {
  assert.match(normalized, /create table if not exists public\.gyeon_qualification_rule_versions/);
  assert.match(normalized, /create table if not exists public\.gyeon_product_qualification_classification/);
  assert.match(
    normalized,
    /classification text not null check \(classification in \(\s*'eligible_chemical', 'required_detailer_product', 'optional_matt', 'other'/,
  );
  assert.match(normalized, /authority_source text not null default 'office_az' check \(authority_source = 'office_az'\)/);
  assert.doesNotMatch(normalized, /insert into public\.gyeon_product_qualification_classification/);
  assert.doesNotMatch(normalized, /insert into public\.gyeon_qualification_rule_versions/);
  assert.match(normalized, /create table if not exists public\.gyeon_order_qualification_snapshots/);
  assert.match(normalized, /unique \(order_id, order_version\)/);
});

test("dealer qualification-mode is a versioned, Office AZ-owned projection with an explicit authority state", () => {
  assert.match(normalized, /create table if not exists public\.gyeon_dealer_qualification_mode_projection/);
  assert.match(
    normalized,
    /qualification_mode text not null check \(qualification_mode in \(\s*'none', 'shop_initial', 'detailer_initial', 'shop_to_detailer'/,
  );
  assert.match(normalized, /projection_version bigint not null check \(projection_version > 0\)/);
  assert.match(
    normalized,
    /authority_source text not null default 'office_az' check \(authority_source = 'office_az'\)/,
  );
  assert.match(
    normalized,
    /authority_state text not null check \(authority_state in \(\s*'configured', 'not_configured', 'stale', 'error'/,
  );
  assert.match(normalized, /effective_from timestamptz not null/);
  assert.match(normalized, /unique \(dealer_id, projection_version\)/);
  assert.match(
    normalized,
    /gyeon_dealer_qualification_mode_one_current_idx on public\.gyeon_dealer_qualification_mode_projection \(dealer_id\) where effective_to is null/,
  );
});

test("qualification-mode projection has no seed, no default mode, and no client/RPC writer", () => {
  assert.doesNotMatch(normalized, /insert into public\.gyeon_dealer_qualification_mode_projection/);
  assert.doesNotMatch(normalized, /update public\.gyeon_dealer_qualification_mode_projection/);
  assert.doesNotMatch(normalized, /delete from public\.gyeon_dealer_qualification_mode_projection/);
  assert.doesNotMatch(normalized, /qualification_mode text not null default/);
  assert.doesNotMatch(
    normalized,
    /grant execute on function[^;]*qualification_mode[^;]*to authenticated/,
  );
});

test("legacy qualification_verified client text is absent from executable SQL", () => {
  assert.doesNotMatch(executable, /qualification_verified/);
});

test("compensation outbox is append-only with a unique idempotency identity", () => {
  assert.match(normalized, /create table if not exists public\.gyeon_order_external_compensation_outbox/);
  assert.match(normalized, /compensation_kind text not null default 'void_new_card_authorization'/);
  assert.match(normalized, /idempotency_identity text not null unique/);
});

test("no C5-B authority/evidence/preparation/snapshot/outbox/task table grants authenticated a write", () => {
  const writeGrantLines = sql
    .split("\n")
    .filter((line) => /grant\s+(insert|update|delete|select,\s*insert)/i.test(line) && /to authenticated/i.test(line));
  assert.equal(writeGrantLines.length, 0);
  for (const table of NEW_C5_B_TABLES) {
    assert.doesNotMatch(
      normalized,
      new RegExp(`grant[^;]*${table}[^;]*to authenticated`),
    );
  }
});

test("no external, provider, or network call is present in the draft", () => {
  assert.doesNotMatch(executable, /pg_net|http_post|dblink|http_get/);
});
