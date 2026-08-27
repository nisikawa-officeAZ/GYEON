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

const FORBIDDEN_CLIENT_AUTHORITY_ARGS = [
  "p_role",
  "p_actor_role",
  "p_dealer_role",
  "p_price",
  "p_client_price",
  "p_qualification_mode",
  "p_qualification_result",
  "p_qualification_verified",
  "p_evidence_success",
  "p_evidence_state",
  "p_authorized",
];

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

test("staff and manager may request review, but only owner may prepare or finalize submit", () => {
  const review = functionBlock("public.request_gyeon_order_v3_owner_review_rpc");
  const prepare = functionBlock("public.prepare_gyeon_order_v3_owner_submit_rpc");
  const finalize = functionBlock("public.finalize_gyeon_order_v3_owner_submit_rpc");
  assert.match(review, /array\['manager', 'staff'\]::text\[\]/);
  assert.doesNotMatch(review, /array\['owner'\]::text\[\]/);
  assert.match(prepare, /array\['owner'\]::text\[\]/);
  assert.match(finalize, /array\['owner'\]::text\[\]/);
  assert.doesNotMatch(prepare, /array\['manager'|array\['staff'/);
  assert.doesNotMatch(finalize, /array\['manager'|array\['staff'/);
  assert.match(review, /owner_review_state = 'pending'/);
  assert.match(finalize, /owner_review_state = 'owner_confirmed'/);
});

test("only owner may prepare or finalize an edit, or cancel, before warehouse acceptance", () => {
  const prepareEdit = functionBlock("public.prepare_gyeon_order_v3_edit_rpc");
  const finalizeEdit = functionBlock("public.finalize_gyeon_order_v3_edit_rpc");
  const cancel = functionBlock("public.cancel_gyeon_order_v3_before_warehouse_rpc");
  for (const block of [prepareEdit, finalizeEdit, cancel]) {
    assert.match(block, /array\['owner'\]::text\[\]/);
  }
  assert.match(prepareEdit, /warehouse_accepted_at is not null/);
  assert.match(finalizeEdit, /warehouse_accepted_at is not null/);
  assert.match(cancel, /status not in \('draft', 'submitted'\)/);
});

test("edit prepare recomputes server pricing and only requires reauthorization when a card amount changes", () => {
  const block = functionBlock("public.prepare_gyeon_order_v3_edit_rpc");
  assert.match(block, /from public\.gyeon_product_order_offers_v3/);
  assert.match(block, /finalize_without_external_authorization/);
  assert.match(block, /prepare_card_reauthorization/);
  assert.match(block, /insert into public\.gyeon_order_prepared_operations_v1/);
  assert.match(block, /evidence_purpose.*'edit_reauthorization'/);
  assert.doesNotMatch(signature(block), /p_payment_evidence_id|p_evidence_success/);
});

test("backorder policy is order-wide and required only when backorder exists", () => {
  const prepare = functionBlock("public.prepare_gyeon_order_v3_owner_submit_rpc");
  assert.match(prepare, /v_order\.contains_backorder and p_backorder_policy not in/);
  assert.match(prepare, /'ship_available_first', 'ship_when_complete'/);
  assert.match(prepare, /backorder_policy_required/);
  assert.match(prepare, /not v_order\.contains_backorder and p_backorder_policy is not null/);
  assert.match(prepare, /backorder_policy_not_applicable/);
});

test("payment methods implement COD direct-shipping denial and credit fail-closed at prepare time", () => {
  const prepare = functionBlock("public.prepare_gyeon_order_v3_owner_submit_rpc");
  assert.match(
    prepare,
    /p_payment_method = 'cash_on_delivery' and v_order\.destination_kind = 'customer_direct'/,
  );
  assert.match(prepare, /cod_customer_direct_forbidden/);
  assert.match(prepare, /p_payment_method = 'credit_account'/);
  assert.match(prepare, /public\.gyeon_dealer_credit_terms/);
  assert.match(prepare, /credit_account_not_enabled/);
});

test("owner-submit prepare loads qualification mode from the server-owned Office AZ projection, not a client parameter", () => {
  const prepare = functionBlock("public.prepare_gyeon_order_v3_owner_submit_rpc");
  assert.match(prepare, /private\.gyeon_order_v3_evaluate_qualification\(/);
  assert.doesNotMatch(prepare, /qualification_verified/);
  assert.doesNotMatch(
    signature(prepare),
    /p_qualification_mode|p_qualification_result|p_qualification_met|p_provisional_met/,
  );
  assert.match(prepare, /from public\.gyeon_dealer_qualification_mode_projection q/);
  assert.match(prepare, /q\.dealer_id = p_dealer_id/);
  assert.match(prepare, /q\.effective_from <= now\(\)/);
  assert.match(prepare, /q\.effective_to is null or q\.effective_to > now\(\)/);
  assert.match(prepare, /order by q\.projection_version desc/);
  assert.match(prepare, /'mode', v_qualification_authority\.qualification_mode/);
  assert.match(prepare, /'projection_version', v_qualification_authority\.projection_version/);
});

test("owner-submit prepare distinguishes a never-configured dealer, a stale projection, and an explicit error state, before any prepared operation is created", () => {
  const prepare = functionBlock("public.prepare_gyeon_order_v3_owner_submit_rpc");
  assert.match(prepare, /qualification_authority_not_configured/);
  assert.match(prepare, /qualification_authority_stale/);
  assert.match(prepare, /qualification_authority_error/);
  assert.match(prepare, /authority_state = 'not_configured'/);
  assert.match(prepare, /authority_state = 'stale'/);
  assert.match(prepare, /authority_state <> 'configured'/);
  assert.match(
    prepare,
    /public\.gyeon_dealer_qualification_mode_projection q where q\.dealer_id = p_dealer_id/,
  );
  const idxAuthorityCheck = prepare.indexOf("qualification_authority_not_configured");
  const idxPrepareInsert = prepare.indexOf("insert into public.gyeon_order_prepared_operations_v1");
  assert.ok(idxAuthorityCheck >= 0 && idxPrepareInsert > idxAuthorityCheck);
});

test("qualification helper is server-owned, fails closed without an active rule, and reads current classifications via a left join", () => {
  const helper = functionBlock("private.gyeon_order_v3_evaluate_qualification");
  assert.match(helper, /from public\.gyeon_qualification_rule_versions/);
  assert.match(
    helper,
    /left join public\.gyeon_product_qualification_classification c on c\.product_id = i\.product_id and c\.effective_to is null/,
  );
  assert.match(helper, /qualification_authority_not_configured/);
  assert.match(helper, /qualification_authority_stale/);
  assert.match(helper, /qualification_authority_invalid/);
  assert.doesNotMatch(helper, /qualification_verified/);
});

test("earliest ship date requires explicit calendar rows instead of weekend assumptions", () => {
  const calendar = functionBlock("private.gyeon_order_v3_earliest_ship_date");
  assert.match(calendar, /public\.gyeon_warehouse_calendar_days/);
  assert.match(calendar, /warehouse_calendar_not_configured/);
  assert.match(calendar, /cutoff_minute_jst/);
  assert.match(calendar, /operating_mode <> 'closed'/);
  assert.doesNotMatch(calendar, /dow|isodow|saturday|sunday/);
});

test("evidence validation and consumption returns distinct mismatch, expiry and consumed codes", () => {
  const helper = functionBlock("private.gyeon_order_v3_validate_and_consume_evidence");
  for (const code of [
    "evidence_missing",
    "evidence_not_server_verified",
    "evidence_not_succeeded",
    "evidence_consumed",
    "evidence_expired",
    "evidence_purpose_mismatch",
    "evidence_order_binding_mismatch",
    "evidence_version_mismatch",
    "evidence_fingerprint_mismatch",
    "evidence_amount_mismatch",
    "evidence_currency_mismatch",
  ]) {
    assert.match(helper, new RegExp(code));
  }
  assert.match(helper, /for update/);
  assert.match(
    helper,
    /update public\.gyeon_order_external_evidence_v1 set consumed_at = now\(\), consumed_by_operation = p_consumed_by_operation/,
  );
  assert.ok(
    helper.indexOf("for update") < helper.indexOf("update public.gyeon_order_external_evidence_v1 set consumed_at"),
    "evidence must be locked before it is consumed",
  );
});

for (const kind of [
  { label: "owner-submit", finalizeName: "public.finalize_gyeon_order_v3_owner_submit_rpc" },
  { label: "edit", finalizeName: "public.finalize_gyeon_order_v3_edit_rpc" },
]) {
  test(`${kind.label} finalize locks prepared operation, then order, then evidence, and recomputes the fingerprint`, () => {
    const block = functionBlock(kind.finalizeName);
    const idxPreparedLock = block.indexOf("from public.gyeon_order_prepared_operations_v1");
    const idxOrderLock = block.indexOf("from public.product_orders o where o.id = p_order_id and o.dealer_id = p_dealer_id for update");
    const idxEvidenceUse = block.indexOf("validate_and_consume_evidence(");
    assert.ok(idxPreparedLock >= 0 && idxOrderLock > idxPreparedLock, "prepared operation must lock before the order");
    assert.ok(idxEvidenceUse > idxOrderLock, "evidence must be checked after the order is locked");
    assert.match(block, /v_fingerprint := private\.gyeon_order_v3_fingerprint\(/);
    assert.match(block, /v_fingerprint <> v_prepared\.request_fingerprint/);
  });

  test(`${kind.label} finalize returns distinct expiry, version and fingerprint conflict codes without raising`, () => {
    const block = functionBlock(kind.finalizeName);
    for (const code of ["prepared_operation_expired", "order_version_conflict", "request_fingerprint_conflict"]) {
      assert.match(block, new RegExp(code));
    }
    const idxConflictStart = block.indexOf("if now() >= v_prepared.expires_at then");
    assert.ok(idxConflictStart >= 0);
    const conflictSection = block.slice(idxConflictStart);
    assert.doesNotMatch(conflictSection, /raise exception/);
  });

  test(`${kind.label} finalize inserts exactly one compensation-outbox row only on the void_new_card_authorization path, never raising`, () => {
    const block = functionBlock(kind.finalizeName);
    assert.match(block, /'compensation'.*'void_new_card_authorization'.*'none'/);
    assert.match(block, /insert into public\.gyeon_order_external_compensation_outbox/);
    assert.match(block, /on conflict \(idempotency_identity\) do nothing/);
    const idxCompensationGuard = block.indexOf("if v_result is not null and (v_result ->> 'compensation') = 'void_new_card_authorization' then");
    const idxInsert = block.indexOf("insert into public.gyeon_order_external_compensation_outbox");
    assert.ok(idxCompensationGuard >= 0 && idxInsert > idxCompensationGuard);
  });

  test(`${kind.label} finalize consumes evidence and the prepared operation before any commercial mutation`, () => {
    const block = functionBlock(kind.finalizeName);
    const idxConsume = block.indexOf("set consumed_at = now(), consumed_by_operation");
    const idxMutation =
      kind.label === "owner-submit"
        ? block.indexOf("update public.product_orders set status = 'submitted'")
        : block.indexOf("delete from public.product_order_items where order_id = p_order_id");
    assert.ok(idxConsume >= 0 && idxMutation > idxConsume, "consumption must precede the commercial mutation");
  });

  test(`${kind.label} finalize accepts no client role, price, or evidence-success flag`, () => {
    const block = functionBlock(kind.finalizeName);
    const args = signature(block);
    for (const forbiddenArg of FORBIDDEN_CLIENT_AUTHORITY_ARGS) {
      assert.doesNotMatch(args, new RegExp(forbiddenArg));
    }
    assert.match(args, /p_prepared_operation_id uuid default null/);
    assert.match(args, /p_evidence_id uuid default null/);
  });
}

test("idempotency claims atomically, locks a conflict, and rejects a different fingerprint", () => {
  const helper = functionBlock("private.gyeon_order_v3_claim_idempotency");
  const save = functionBlock("public.save_gyeon_order_v3_draft_rpc");
  assert.match(
    helper,
    /on conflict \(dealer_id, idempotency_key\) do nothing returning \* into v_existing/,
  );
  assert.match(helper, /for update/);
  assert.match(helper, /idempotency_key_reused/);
  assert.match(helper, /request_fingerprint <> p_request_fingerprint/);
  assert.ok(
    helper.indexOf("insert into public.gyeon_order_idempotency_v3") <
      helper.indexOf("select * into v_existing"),
  );
  assert.match(save, /gyeon_order_v3_claim_idempotency/);
  assert.ok(
    save.indexOf("gyeon_order_v3_claim_idempotency") <
      save.indexOf("insert into public.product_orders"),
  );
  for (const name of [
    "public.request_gyeon_order_v3_owner_review_rpc",
    "public.finalize_gyeon_order_v3_owner_submit_rpc",
    "public.finalize_gyeon_order_v3_edit_rpc",
    "public.cancel_gyeon_order_v3_before_warehouse_rpc",
    "public.release_gyeon_order_v3_warehouse_rpc",
    "public.accept_gyeon_order_v3_warehouse_rpc",
  ]) {
    const block = functionBlock(name);
    assert.match(block, /gyeon_order_v3_fingerprint/);
    assert.match(block, /gyeon_order_v3_claim_idempotency/);
    assert.match(block, /if v_prior is not null then return v_prior/);
  }
});

test("warehouse release is service-only, creates exactly one unaccepted task, and requires supply/reservation/calendar authority", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.doesNotMatch(signature(release), /p_dealer_role|p_actor_role/);
  assert.match(release, /payment_not_released_to_warehouse/);
  assert.match(release, /supply_authority_not_verified/);
  assert.match(release, /inventory_reservation_or_backorder_evidence_required/);
  assert.match(release, /earliest_ship_date_authority_required/);
  assert.match(
    release,
    /insert into public\.gyeon_order_warehouse_tasks \(order_id, dealer_id, task_state, task_version\) values \(p_order_id, v_order\.dealer_id, 'unaccepted', 1\) on conflict \(order_id\) do nothing/,
  );
  assert.match(release, /noop_existing/);
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  assert.match(
    normalized,
    /grant execute on function public\.release_gyeon_order_v3_warehouse_rpc\([^;]+\) to service_role/,
  );
  assert.doesNotMatch(
    normalized,
    /grant execute on function public\.release_gyeon_order_v3_warehouse_rpc\([^;]+\) to authenticated/,
  );
});

test("warehouse acceptance requires both expected versions, locks and consumes an existing task, and never inserts one", () => {
  const accept = functionBlock("public.accept_gyeon_order_v3_warehouse_rpc");
  const args = signature(accept);
  assert.match(args, /p_expected_order_version bigint/);
  assert.match(args, /p_expected_task_version bigint/);
  assert.doesNotMatch(args, /p_dealer_role|p_actor_role/);
  assert.match(accept, /from public\.gyeon_order_warehouse_tasks t where t\.order_id = p_order_id for update/);
  assert.match(accept, /warehouse_task_not_found/);
  assert.match(accept, /warehouse_task_not_unaccepted/);
  assert.match(accept, /v_task\.task_version <> p_expected_task_version/);
  assert.match(accept, /task_version_conflict/);
  assert.match(accept, /order_version_conflict/);
  assert.match(accept, /warehouse_accepted_at = now\(\)/);
  assert.doesNotMatch(accept, /insert into public\.gyeon_order_warehouse_tasks/);
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

test("no function signature accepts a client role, client price, or client evidence-success flag", () => {
  const publicRpcNames = [
    "public.list_gyeon_order_catalog_v3_rpc",
    "public.save_gyeon_order_v3_draft_rpc",
    "public.request_gyeon_order_v3_owner_review_rpc",
    "public.prepare_gyeon_order_v3_owner_submit_rpc",
    "public.finalize_gyeon_order_v3_owner_submit_rpc",
    "public.prepare_gyeon_order_v3_edit_rpc",
    "public.finalize_gyeon_order_v3_edit_rpc",
    "public.cancel_gyeon_order_v3_before_warehouse_rpc",
    "public.release_gyeon_order_v3_warehouse_rpc",
    "public.accept_gyeon_order_v3_warehouse_rpc",
  ];
  for (const name of publicRpcNames) {
    const args = signature(functionBlock(name));
    for (const forbiddenArg of FORBIDDEN_CLIENT_AUTHORITY_ARGS) {
      assert.doesNotMatch(args, new RegExp(forbiddenArg));
    }
  }
});

test("no external, provider, or network call is present in any function body", () => {
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  assert.doesNotMatch(normalized, /pg_net|http_post|http_get|dblink/);
});
