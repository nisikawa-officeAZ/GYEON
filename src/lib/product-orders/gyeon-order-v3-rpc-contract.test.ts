import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const SQL_PATH = join(
  process.cwd(),
  "supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql",
);
const sql = readFileSync(SQL_PATH, "utf8");

function functionBlock(name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(`create or replace function\\s+${escaped}\\([\\s\\S]*?\\$\\$;`, "i"),
  );
  assert.ok(match, `missing function ${name}`);
  return match[0].toLowerCase().replace(/\s+/g, " ");
}

function signature(block: string): string {
  const end = block.indexOf(") returns");
  assert.notEqual(end, -1);
  return block.slice(0, end + 1);
}

test("catalog read RPC resolves rank server-side and keeps unknown supply explicit", () => {
  const block = functionBlock("public.list_gyeon_order_catalog_v3_rpc");
  assert.match(block, /array\['owner', 'manager', 'staff', 'readonly'\]::text\[\]/);
  assert.match(block, /gom\.buyer_rank/);
  assert.match(block, /public\.gyeon_product_order_offers_v3/);
  assert.match(block, /left join public\.gyeon_order_supply_projection/);
  assert.match(block, /coalesce\(s\.authority_state, 'not_configured'\)/);
  assert.match(
    block,
    /case when s\.authority_state = 'configured' then s\.orderable_qty else null end/,
  );
  assert.doesNotMatch(signature(block), /p_buyer_rank|p_price|p_orderable_qty/);
});

test("draft RPC accepts identifiers and quantities but no client commercial authority", () => {
  const block = functionBlock("public.save_gyeon_order_v3_draft_rpc");
  const args = signature(block);
  assert.match(args, /p_lines jsonb/);
  assert.match(args, /p_expected_version bigint/);
  assert.match(block, /v_line - array\['product_id', 'quantity'\]/);
  for (const forbiddenArg of [
    "p_sku",
    "p_product_name",
    "p_price",
    "p_tax",
    "p_discount",
    "p_total",
    "p_status",
    "p_actor_role",
    "p_orderable_qty",
  ]) {
    assert.doesNotMatch(args, new RegExp(forbiddenArg));
  }
  assert.match(block, /client_commercial_fields_forbidden/);
  assert.match(block, /quantity_must_be_positive_integer/);
  assert.doesNotMatch(block, /ceil\(|floor\(|round\(/);
});

test("draft commercial snapshots come from product, offer and supply server tables", () => {
  const block = functionBlock("public.save_gyeon_order_v3_draft_rpc");
  assert.match(block, /from public\.gyeon_products/);
  assert.match(block, /from public\.gyeon_product_order_offers_v3/);
  assert.match(block, /from public\.gyeon_order_supply_projection/);
  assert.match(block, /gom\.buyer_rank/);
  assert.match(block, /supply_not_configured/);
  assert.match(block, /backorder_not_permitted/);
  assert.match(block, /not i\.is_promotional_goods_snapshot/);
});

test("actor authorization binds auth.uid to one active dealer and commercial membership", () => {
  const block = functionBlock("private.gyeon_order_v3_assert_actor");
  assert.match(block, /auth\.uid\(\) is null or auth\.uid\(\) <> p_actor_id/);
  assert.match(block, /v_count <> 1/);
  assert.match(block, /public\.dealer_members/);
  assert.match(block, /public\.dealers/);
  assert.match(block, /public\.gyeon_ordering_memberships/);
  assert.match(block, /gom\.membership_status = 'active'/);
  assert.match(block, /v_role = any\(p_allowed_roles\)/);
});

test("staff and manager may request review, but only owner may submit", () => {
  const review = functionBlock("public.request_gyeon_order_v3_owner_review_rpc");
  const submit = functionBlock("public.owner_submit_gyeon_order_v3_rpc");
  assert.match(review, /array\['manager', 'staff'\]::text\[\]/);
  assert.doesNotMatch(review, /array\['owner'\]::text\[\]/);
  assert.match(submit, /array\['owner'\]::text\[\]/);
  assert.doesNotMatch(submit, /array\['manager'|array\['staff'/);
  assert.match(review, /owner_review_state = 'pending'/);
  assert.match(submit, /owner_review_state = 'owner_confirmed'/);
});

test("only owner may edit or cancel before warehouse acceptance", () => {
  const edit = functionBlock("public.edit_gyeon_order_v3_before_warehouse_rpc");
  const cancel = functionBlock("public.cancel_gyeon_order_v3_before_warehouse_rpc");
  for (const block of [edit, cancel]) {
    assert.match(block, /array\['owner'\]::text\[\]/);
    assert.match(block, /warehouse_accepted_at is not null/);
    assert.match(block, /order_version_conflict/);
  }
  assert.match(cancel, /status not in \('draft', 'submitted'\)/);
});

test("card repricing fails before mutation and preserves the original order", () => {
  const edit = functionBlock("public.edit_gyeon_order_v3_before_warehouse_rpc");
  const mutationIndex = edit.indexOf("update public.product_orders");
  const reauthIndex = edit.indexOf("card_reauth_failed_or_missing");
  assert.ok(reauthIndex > 0);
  assert.equal(mutationIndex, -1, "draft adapter must not mutate until reauthorization is wired");
  assert.match(edit, /original order and original authorization stay untouched on failure/);
  assert.match(edit, /server_reprice_edit_adapter_not_configured/);
});

test("backorder policy is order-wide and required only when backorder exists", () => {
  const submit = functionBlock("public.owner_submit_gyeon_order_v3_rpc");
  assert.match(submit, /v_order\.contains_backorder and p_backorder_policy not in/);
  assert.match(submit, /'ship_available_first', 'ship_when_complete'/);
  assert.match(submit, /backorder_policy_required/);
  assert.match(submit, /not v_order\.contains_backorder and p_backorder_policy is not null/);
  assert.match(submit, /backorder_policy_not_applicable/);
});

test("payment methods implement COD direct-shipping denial and credit fail-closed", () => {
  const submit = functionBlock("public.owner_submit_gyeon_order_v3_rpc");
  assert.match(
    submit,
    /p_payment_method = 'cash_on_delivery' and v_order\.destination_kind = 'customer_direct'/,
  );
  assert.match(submit, /cod_customer_direct_forbidden/);
  assert.match(submit, /p_payment_method = 'credit_account'/);
  assert.match(submit, /public\.gyeon_dealer_credit_terms/);
  assert.match(submit, /credit_account_not_enabled/);
  assert.match(submit, /card_authorization_evidence_required/);
  assert.match(submit, /bank_transfer_prepaid' then 'payment_pending'/);
});

test("submission fails closed until qualification authority is connected", () => {
  const submit = functionBlock("public.owner_submit_gyeon_order_v3_rpc");
  assert.match(submit, /qualification_verified/);
  assert.match(submit, /qualification_authority_not_configured/);
  assert.match(submit, /private\.gyeon_order_v3_earliest_ship_date\(now\(\)\)/);
});

test("earliest ship date requires explicit calendar rows instead of weekend assumptions", () => {
  const calendar = functionBlock("private.gyeon_order_v3_earliest_ship_date");
  assert.match(calendar, /public\.gyeon_warehouse_calendar_days/);
  assert.match(calendar, /warehouse_calendar_not_configured/);
  assert.match(calendar, /cutoff_minute_jst/);
  assert.match(calendar, /operating_mode <> 'closed'/);
  assert.doesNotMatch(calendar, /dow|isodow|saturday|sunday/);
});

test("idempotency locks the key and rejects a different fingerprint", () => {
  const helper = functionBlock("private.gyeon_order_v3_claim_idempotency");
  const save = functionBlock("public.save_gyeon_order_v3_draft_rpc");
  assert.match(helper, /for update/);
  assert.match(helper, /idempotency_key_reused/);
  assert.match(helper, /request_fingerprint <> p_request_fingerprint/);
  assert.match(save, /gyeon_order_v3_claim_idempotency/);
  assert.ok(
    save.indexOf("gyeon_order_v3_claim_idempotency") <
      save.indexOf("insert into public.product_orders"),
  );
  for (const name of [
    "public.request_gyeon_order_v3_owner_review_rpc",
    "public.owner_submit_gyeon_order_v3_rpc",
    "public.cancel_gyeon_order_v3_before_warehouse_rpc",
    "public.accept_gyeon_order_v3_warehouse_rpc",
  ]) {
    const block = functionBlock(name);
    assert.match(block, /gyeon_order_v3_fingerprint/);
    assert.match(block, /gyeon_order_v3_claim_idempotency/);
    assert.match(block, /if v_prior is not null then return v_prior/);
    assert.match(block, /response_payload = v_result, completed_at = now\(\)/);
  }
});

test("warehouse acceptance is a service-only RPC with payment and version guards", () => {
  const accept = functionBlock("public.accept_gyeon_order_v3_warehouse_rpc");
  assert.doesNotMatch(signature(accept), /p_dealer_role|p_actor_role/);
  assert.match(accept, /for update/);
  assert.match(accept, /order_version_conflict/);
  assert.match(accept, /payment_not_released_to_warehouse/);
  assert.match(accept, /warehouse_accepted_at = now\(\)/);
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  assert.match(
    normalized,
    /grant execute on function public\.accept_gyeon_order_v3_warehouse_rpc\([^;]+\) to service_role/,
  );
  assert.doesNotMatch(
    normalized,
    /grant execute on function public\.accept_gyeon_order_v3_warehouse_rpc\([^;]+\) to authenticated/,
  );
});
