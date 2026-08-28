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

test("qualification helper requires one identical non-null classification version across every line and fails closed on a mixed version", () => {
  const helper = functionBlock("private.gyeon_order_v3_evaluate_qualification");
  const idxMissingGuard = helper.indexOf("if v_line.classification_version is null then");
  const idxFirstAssign = helper.indexOf("if v_classification_version is null then");
  const idxMixedGuard = helper.indexOf(
    "elsif v_line.classification_version <> v_classification_version then",
  );
  const idxMixedCode = helper.indexOf("qualification_authority_mixed_classification_version");
  const idxAccumulate = helper.indexOf("v_qualifying_amount := v_qualifying_amount");
  assert.ok(idxMissingGuard >= 0, "must still deny a missing per-line classification version");
  assert.ok(idxFirstAssign > idxMissingGuard, "first valid version must become the candidate version");
  assert.ok(idxMixedGuard > idxFirstAssign, "a later differing version must be rejected");
  assert.ok(idxMixedCode > idxMixedGuard, "mixed versions must return a distinct stable code");
  assert.ok(idxAccumulate > idxMixedCode, "the version check must run before qualifying-amount accumulation");
  assert.doesNotMatch(
    helper,
    /v_classification_version := v_line\.classification_version;\s*if v_line\.classification = 'eligible_chemical'/,
    "the last iterated line must never silently overwrite the snapshot version",
  );
});

test("qualification snapshot insert is immutable: no conflict path updates decision, lifecycle_state, or evaluated_at", () => {
  const helper = functionBlock("private.gyeon_order_v3_evaluate_qualification");
  assert.doesNotMatch(helper, /on conflict \(order_id, order_version\) do update/);
  const doNothingMatches = [...helper.matchAll(/on conflict \(order_id, order_version\) do nothing/g)];
  assert.equal(doNothingMatches.length, 2, "both the none-mode and evaluated snapshots must be insert-only");
  assert.doesNotMatch(helper, /evaluated_at = now\(\)/);
});

test("qualification snapshot replay returns the existing immutable snapshot unchanged on exact match and a stable conflict code on any canonical-field mismatch", () => {
  const helper = functionBlock("private.gyeon_order_v3_evaluate_qualification");
  assert.match(helper, /qualification_snapshot_conflict/);
  assert.match(helper, /v_existing_snapshot\.dealer_id <> p_dealer_id/);
  assert.match(helper, /v_existing_snapshot\.evaluation_mode <> p_mode/);
  assert.match(helper, /v_existing_snapshot\.input_fingerprint <> p_input_fingerprint/);
  assert.match(helper, /v_existing_snapshot\.decision <> v_decision/);
  assert.match(helper, /v_existing_snapshot\.lifecycle_state <> v_lifecycle_state/);
  assert.match(helper, /v_decision := v_existing_snapshot\.decision;/);
  const idxSelectExisting = helper.indexOf("select * into v_existing_snapshot");
  const idxConflictCheck = helper.indexOf("v_existing_snapshot.dealer_id <> p_dealer_id");
  const idxReplayAssign = helper.lastIndexOf("v_decision := v_existing_snapshot.decision;");
  assert.ok(idxSelectExisting >= 0 && idxConflictCheck > idxSelectExisting && idxReplayAssign > idxConflictCheck);
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

  test(`${kind.label} finalize records durable idempotent compensation only on an accepted void path, never raising`, () => {
    const block = functionBlock(kind.finalizeName);
    assert.match(block, /'compensation'.*'void_new_card_authorization'.*'none'/);
    assert.match(block, /insert into public\.gyeon_order_external_compensation_outbox/);
    assert.match(block, /on conflict \(idempotency_identity\) do nothing/);
    const idxCompensationGuard = block.indexOf("if v_result is not null and (v_result ->> 'compensation') = 'void_new_card_authorization' then");
    const idxConflictInsert = block.indexOf(
      "insert into public.gyeon_order_external_compensation_outbox",
      idxCompensationGuard,
    );
    assert.ok(idxCompensationGuard >= 0 && idxConflictInsert > idxCompensationGuard);
    if (kind.label === "owner-submit") {
      const idxCreditGuard = block.indexOf("if v_should_compensate then");
      const idxCreditInsert = block.indexOf(
        "insert into public.gyeon_order_external_compensation_outbox",
        idxCreditGuard,
      );
      const idxCreditReturn = block.indexOf("return v_result;", idxCreditGuard);
      assert.ok(
        idxCreditGuard >= 0 && idxCreditInsert > idxCreditGuard && idxCreditReturn > idxCreditInsert,
        "the credit-term race must durably queue its void before returning",
      );
    }
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

// -----------------------------------------------------------------------------
// C5-B-R1-A2: hostile payment-authority regression coverage.
// -----------------------------------------------------------------------------

test("product_orders gains a server-owned card authority link bound by foreign key to accepted external evidence", () => {
  const normalizedSql = sql.toLowerCase().replace(/\s+/g, " ");
  assert.match(normalizedSql, /add column if not exists card_authority_evidence_id uuid/);
  assert.match(normalizedSql, /add column if not exists card_authority_request_fingerprint text/);
  assert.match(
    normalizedSql,
    /add constraint product_orders_card_authority_evidence_fk foreign key \(card_authority_evidence_id\) references public\.gyeon_order_external_evidence_v1\(id\)/,
  );
  assert.match(
    normalizedSql,
    /add constraint product_orders_card_authority_binding_check check \( \(card_authority_evidence_id is null\) = \(card_authority_request_fingerprint is null\)/,
  );
  assert.match(
    normalizedSql,
    /payment_status <> 'authorized' or \(card_authority_evidence_id is not null and card_authority_request_fingerprint is not null\)/,
  );
});

test("card finalize fails closed on a null prepared operation or evidence id, before locking anything", () => {
  const block = functionBlock("public.finalize_gyeon_order_v3_owner_submit_rpc");
  assert.match(block, /card_authority_required/);
  assert.match(
    block,
    /p_payment_method = 'card' and \(p_prepared_operation_id is null or p_evidence_id is null\)/,
  );
  const idxGuard = block.indexOf("card_authority_required");
  const idxPreparedLock = block.indexOf("from public.gyeon_order_prepared_operations_v1");
  assert.ok(
    idxGuard >= 0 && idxPreparedLock > idxGuard,
    "the card-authority guard must run before the prepared operation is locked",
  );
});

test("owner-submit finalize persists the card authority link only for card, only after evidence is consumed", () => {
  const block = functionBlock("public.finalize_gyeon_order_v3_owner_submit_rpc");
  assert.match(
    block,
    /card_authority_evidence_id = case when p_payment_method = 'card' then p_evidence_id else card_authority_evidence_id end/,
  );
  assert.match(
    block,
    /when p_payment_method = 'card' then v_prepared\.request_fingerprint else card_authority_request_fingerprint/,
  );
  const idxConsume = block.indexOf(
    "set consumed_at = now(), consumed_by_operation = 'owner_submit_finalize'",
  );
  const idxLink = block.indexOf("card_authority_evidence_id = case when p_payment_method = 'card'");
  assert.ok(
    idxConsume >= 0 && idxLink > idxConsume,
    "the link is written only after the prepared operation and evidence were consumed",
  );
});

test("edit finalize atomically replaces the card authority link on a successful reauthorization, and preserves it on an amount-preserving edit", () => {
  const block = functionBlock("public.finalize_gyeon_order_v3_edit_rpc");
  assert.match(
    block,
    /card_authority_evidence_id = case when p_prepared_operation_id is not null then p_evidence_id else card_authority_evidence_id end/,
  );
  assert.match(
    block,
    /when p_prepared_operation_id is not null then v_prepared\.request_fingerprint else card_authority_request_fingerprint/,
  );
});

test("card release never trusts payment_status = 'authorized' alone; it revalidates the persistently bound card authority", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /card_authority_missing/);
  assert.match(release, /card_authority_invalid/);
  assert.match(release, /v_order\.card_authority_evidence_id is null/);
  assert.match(release, /v_order\.card_authority_request_fingerprint is null/);
  assert.match(release, /v_card_evidence\.dealer_id <> v_order\.dealer_id/);
  assert.match(release, /v_card_evidence\.order_id <> p_order_id/);
  assert.match(release, /v_card_evidence\.purpose not in \('initial_authorization', 'edit_reauthorization'\)/);
  assert.match(release, /v_card_evidence\.authority <> 'server_verified'/);
  assert.match(release, /v_card_evidence\.state <> 'succeeded'/);
  assert.match(release, /v_card_evidence\.expires_at is null/);
  assert.match(release, /now\(\) >= v_card_evidence\.expires_at/);
  assert.match(release, /v_card_evidence\.consumed_at is null/);
  assert.match(
    release,
    /v_card_evidence\.purpose = 'initial_authorization' and v_card_evidence\.consumed_by_operation <> 'owner_submit_finalize'/,
  );
  assert.match(
    release,
    /v_card_evidence\.purpose = 'edit_reauthorization' and v_card_evidence\.consumed_by_operation <> 'edit_finalize'/,
  );
  assert.match(
    release,
    /v_card_evidence\.request_fingerprint <> v_order\.card_authority_request_fingerprint/,
  );
  assert.match(release, /v_card_evidence\.amount_inc_tax_yen <> v_order\.grand_total_inc_tax_yen/);
  assert.match(release, /v_card_evidence\.currency <> 'jpy'/);
  const idxAuthorizedCheck = release.indexOf("v_order.payment_status <> 'authorized'");
  const idxAuthorityMissing = release.indexOf("card_authority_missing");
  const idxAuthorityInvalid = release.indexOf("card_authority_invalid");
  const idxSplitCapture = release.indexOf("card_split_capture_unresolved");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(
    idxAuthorizedCheck >= 0 && idxAuthorityMissing > idxAuthorizedCheck,
    "the authorized status text alone must not be sufficient",
  );
  assert.ok(idxAuthorityInvalid > idxAuthorityMissing);
  assert.ok(
    idxSplitCapture > idxAuthorityInvalid,
    "the bound card authority must be revalidated before the split-capture check",
  );
  assert.ok(idxTaskInsert > idxSplitCapture, "no warehouse task may be created before card authority is revalidated");
});

test("a newly succeeded card authorization is queued for void when credit terms become active before finalize", () => {
  const finalize = functionBlock("public.finalize_gyeon_order_v3_owner_submit_rpc");
  const idxEvidenceCandidate = finalize.indexOf("a3-03:");
  const idxCreditForce = finalize.indexOf("credit_account_terms_force_method");
  const idxCompensationInsert = finalize.indexOf(
    "insert into public.gyeon_order_external_compensation_outbox",
    idxCreditForce,
  );
  const idxCreditReturn = finalize.indexOf("return v_result;", idxCreditForce);
  assert.ok(
    idxEvidenceCandidate >= 0 && idxEvidenceCandidate < idxCreditForce,
    "successful evidence must be identified before the credit-method denial",
  );
  assert.match(
    finalize.slice(idxEvidenceCandidate, idxCreditForce),
    /e\.request_fingerprint = v_prepared\.request_fingerprint/,
  );
  assert.match(
    finalize.slice(idxCreditForce, idxCreditReturn),
    /case when v_should_compensate then 'void_new_card_authorization' else 'none' end/,
  );
  assert.ok(
    idxCompensationInsert > idxCreditForce && idxCompensationInsert < idxCreditReturn,
    "the durable void intent must be inserted before the credit-method denial returns",
  );
});

test("active credit-account terms independently force the payment method at prepare and finalize, while release revalidates the frozen payment-contract snapshot instead of the mutable current row", () => {
  const prepare = functionBlock("public.prepare_gyeon_order_v3_owner_submit_rpc");
  const finalize = functionBlock("public.finalize_gyeon_order_v3_owner_submit_rpc");
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  for (const block of [prepare, finalize]) {
    assert.match(block, /credit_account_terms_force_method/);
    assert.match(block, /v_credit_active and p_payment_method <> 'credit_account'/);
  }
  assert.match(release, /credit_account_terms_force_method/);
  assert.match(
    release,
    /v_order\.payment_contract_kind = 'credit_account' and v_order\.payment_method <> 'credit_account'/,
  );
  assert.match(
    release,
    /v_order\.payment_contract_kind = 'standard_payment' and v_order\.payment_method = 'credit_account'/,
  );
  assert.doesNotMatch(
    release,
    /v_credit_active/,
    "release must never force the payment method from the mutable current credit-terms row",
  );

  const idxPrepareForce = prepare.indexOf("credit_account_terms_force_method");
  const idxPrepareInsert = prepare.indexOf("insert into public.gyeon_order_prepared_operations_v1");
  assert.ok(
    idxPrepareForce >= 0 && idxPrepareInsert > idxPrepareForce,
    "prepare must deny the forced method before any prepared operation is created",
  );

  const idxReleaseForce = release.indexOf("credit_account_terms_force_method");
  const idxReleaseTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(
    idxReleaseForce >= 0 && idxReleaseTaskInsert > idxReleaseForce,
    "release must deny the forced method before any warehouse task is created",
  );
});

test("a standard-payment order finalized before credit terms activate keeps releasing under its original method, and a frozen credit_account order can never release under another method", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  const idxSnapshotMissing = release.indexOf("payment_contract_snapshot_missing");
  const idxCreditForce = release.indexOf(
    "v_order.payment_contract_kind = 'credit_account' and v_order.payment_method <> 'credit_account'",
  );
  const idxMismatch = release.indexOf(
    "v_order.payment_contract_kind = 'standard_payment' and v_order.payment_method = 'credit_account'",
  );
  const idxCardBranch = release.indexOf("if v_order.payment_method = 'card' then");
  assert.match(release, /payment_contract_snapshot_mismatch/);
  assert.ok(
    idxSnapshotMissing >= 0 && idxSnapshotMissing < idxCreditForce && idxCreditForce < idxMismatch,
    "the missing-snapshot guard must run before either payment-contract-kind mismatch guard",
  );
  assert.ok(idxMismatch < idxCardBranch, "the payment-contract snapshot is revalidated before any method branch runs");
});

test("bank and credit release require the exact pre-release payment status, and stopped/expired credit terms are denied", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /v_order\.payment_status <> 'payment_pending'/);
  const bankBranchStart = release.indexOf("elsif v_order.payment_method = 'bank_transfer_prepaid' then");
  const bankStatusCheck = release.indexOf("v_order.payment_status <> 'payment_pending'");
  assert.ok(bankBranchStart >= 0 && bankStatusCheck > bankBranchStart);

  const creditBranchStart = release.indexOf("elsif v_order.payment_method = 'credit_account' then");
  const creditStatusCheck = release.lastIndexOf("v_order.payment_status <> 'not_required'");
  assert.ok(
    creditBranchStart >= 0 && creditStatusCheck > creditBranchStart,
    "credit-account release must require the exact not_required status",
  );
  assert.match(release, /credit_account_not_enabled/);
  assert.match(release, /c\.credit_state = 'active'/);
  assert.match(release, /c\.effective_from <= now\(\)/);
  assert.match(release, /c\.effective_to is null or c\.effective_to > now\(\)/);
});

test("bank evidence consumption atomically advances payment_status to paid before the warehouse task is created", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /update public\.product_orders set payment_status = 'paid' where id = p_order_id/);
  const idxConsume = release.indexOf("update public.gyeon_order_external_evidence_v1 set consumed_at = now()");
  const idxPaid = release.indexOf("update public.product_orders set payment_status = 'paid'");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(idxConsume >= 0 && idxPaid > idxConsume, "the order advances to paid only after bank evidence is consumed");
  assert.ok(idxTaskInsert > idxPaid, "no warehouse task may be created before the order is marked paid");
});

test("no warehouse task can be inserted before every A2-01/A2-02/A2-03 authority and status guard", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  for (const marker of [
    "credit_account_terms_force_method",
    "card_authority_missing",
    "card_authority_invalid",
    "card_split_capture_unresolved",
    "bank_payment_match_evidence_required",
    "bank_payment_match_evidence_ambiguous",
    "cod_customer_direct_forbidden",
    "credit_account_not_enabled",
  ]) {
    const idx = release.indexOf(marker);
    assert.ok(idx >= 0 && idx < idxTaskInsert, `${marker} must be checked before the warehouse task insert`);
  }
});

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
  assert.match(release, /inventory_reservation_evidence_required/);
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
  assert.doesNotMatch(
    release,
    /payment_status in \('selection_required', 'authorization_pending', 'payment_pending', 'failed'\)/,
    "the payment gate must be method-specific, not a status blocklist",
  );
});

test("card release requires the accepted authorization state and denies unresolved split-capture with a ship-available-first backorder", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /if v_order\.payment_method = 'card' then/);
  assert.match(release, /v_order\.payment_status <> 'authorized'/);
  assert.match(release, /card_split_capture_unresolved/);
  assert.match(
    release,
    /v_order\.contains_backorder and v_order\.backorder_policy = 'ship_available_first'/,
  );
});

test("bank-transfer release requires one exact server-verified unexpired unconsumed bank_payment_match evidence row scoped to dealer/order/current version/fingerprint/amount/currency, and consumes it exactly once", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /elsif v_order\.payment_method = 'bank_transfer_prepaid' then/);
  assert.match(release, /e\.purpose = 'bank_payment_match'/);
  assert.match(release, /e\.dealer_id = v_order\.dealer_id/);
  assert.match(release, /e\.order_id = p_order_id/);
  assert.match(release, /e\.order_version = v_order\.aggregate_version/);
  assert.match(release, /e\.request_fingerprint = v_bank_fingerprint/);
  assert.match(release, /e\.amount_inc_tax_yen = v_order\.grand_total_inc_tax_yen/);
  assert.match(release, /e\.currency = 'jpy'/);
  assert.match(release, /e\.authority = 'server_verified'/);
  assert.match(release, /e\.state = 'succeeded'/);
  assert.match(release, /e\.consumed_at is null/);
  assert.match(release, /e\.expires_at is not null and e\.expires_at > now\(\)/);
  assert.match(release, /bank_payment_match_evidence_required/);
  assert.match(release, /bank_payment_match_evidence_ambiguous/);
  assert.match(
    release,
    /update public\.gyeon_order_external_evidence_v1 set consumed_at = now\(\), consumed_by_operation = 'warehouse_release'/,
  );
  const idxLock = release.indexOf("for update");
  const idxCount = release.indexOf("select count(*), (array_agg(id))[1] into v_bank_evidence_count, v_bank_evidence_id from candidate;");
  const idxAmbiguous = release.indexOf("bank_payment_match_evidence_ambiguous");
  const idxConsume = release.indexOf("update public.gyeon_order_external_evidence_v1 set consumed_at = now()");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(idxLock >= 0 && idxCount > idxLock, "candidate evidence must be locked before it is counted");
  assert.ok(idxAmbiguous > idxCount, "ambiguity must be checked before consumption");
  assert.ok(idxConsume > idxAmbiguous, "evidence is consumed only after the exactly-one check passes");
  assert.ok(idxTaskInsert > idxConsume, "the warehouse task is created only after bank evidence is consumed");
});

test("cash-on-delivery release denies customer-direct destination and requires the already owner-confirmed not-required payment state", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /elsif v_order\.payment_method = 'cash_on_delivery' then/);
  assert.match(release, /cod_customer_direct_forbidden/);
  assert.match(release, /v_order\.destination_kind = 'customer_direct'/);
  assert.match(
    release,
    /v_order\.payment_status <> 'not_required' or v_order\.owner_review_state <> 'owner_confirmed'/,
  );
});

test("credit-account release revalidates active, currently effective dealer credit terms and denies otherwise", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /elsif v_order\.payment_method = 'credit_account' then/);
  assert.match(release, /credit_account_not_enabled/);
  assert.match(release, /c\.credit_state = 'active'/);
  assert.match(release, /c\.effective_from <= now\(\)/);
  assert.match(release, /c\.effective_to is null or c\.effective_to > now\(\)/);
});

test("an unknown or unhandled payment method always denies release before any warehouse task is created", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  const idxElse = release.indexOf("else raise exception using errcode = '55000', message = 'payment_not_released_to_warehouse';");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(idxElse >= 0, "an else branch must deny any payment method outside the four explicit allow rules");
  assert.ok(idxTaskInsert > idxElse);
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

// -----------------------------------------------------------------------------
// C5-B-R2: inventory-evidence and payment-contract snapshot hostile coverage.
// -----------------------------------------------------------------------------

test("non-backorder warehouse release requires one exact server-verified unexpired unconsumed inventory_reservation evidence row scoped to dealer/order/current version/server-owned fingerprint/amount/currency, locks it, and consumes it exactly once before the warehouse task", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /e\.purpose = 'inventory_reservation'/);
  assert.match(release, /e\.dealer_id = v_order\.dealer_id/);
  assert.match(release, /e\.order_id = p_order_id/);
  assert.match(release, /e\.order_version = v_order\.aggregate_version/);
  assert.match(release, /e\.request_fingerprint = v_reservation_fingerprint/);
  assert.match(release, /e\.amount_inc_tax_yen = v_order\.grand_total_inc_tax_yen/);
  assert.match(release, /e\.currency = 'jpy'/);
  assert.match(release, /e\.authority = 'server_verified'/);
  assert.match(release, /e\.state = 'succeeded'/);
  assert.match(release, /e\.consumed_at is null/);
  assert.match(release, /e\.expires_at is not null and e\.expires_at > now\(\)/);
  assert.match(release, /inventory_reservation_evidence_required/);
  assert.match(release, /inventory_reservation_evidence_ambiguous/);
  assert.doesNotMatch(
    release,
    /select exists \( select 1 from public\.gyeon_order_external_evidence_v1 e where e\.order_id = p_order_id and e\.dealer_id = v_order\.dealer_id and e\.purpose = 'inventory_reservation'/,
    "release must not accept an existence-only inventory-reservation check",
  );
  const idxLock = release.lastIndexOf("for update");
  const idxCandidateCount = release.indexOf(
    "select count(*), (array_agg(id))[1] into v_reservation_evidence_count, v_reservation_evidence_id from candidate",
  );
  const idxAmbiguous = release.indexOf("inventory_reservation_evidence_ambiguous");
  const idxConsume = release.indexOf(
    "update public.gyeon_order_external_evidence_v1 set consumed_at = now(), consumed_by_operation = 'warehouse_release'",
    idxAmbiguous,
  );
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(idxLock > 0 && idxCandidateCount > idxLock, "the reservation candidate is counted from the same locked CTE");
  assert.ok(idxAmbiguous > idxCandidateCount, "ambiguity must be checked before consumption");
  assert.ok(idxConsume > idxAmbiguous, "the reservation row is consumed only after the exactly-one check passes");
  assert.ok(idxTaskInsert > idxConsume, "the warehouse task is created only after inventory-reservation evidence is consumed");
});

test("a backorder release never searches for or consumes unrelated inventory_reservation evidence", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  const idxGuard = release.indexOf("if not v_order.contains_backorder then");
  const idxFingerprint = release.indexOf("v_reservation_fingerprint := private.gyeon_order_v3_fingerprint(");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  assert.ok(
    idxGuard >= 0 && idxFingerprint > idxGuard && idxFingerprint < idxTaskInsert,
    "the entire reservation lookup must be inside the not-contains_backorder guard",
  );
});

test("product_orders gains an explicit immutable payment-contract snapshot distinguishing standard payment from a versioned credit account", () => {
  const normalizedSql = sql.toLowerCase().replace(/\s+/g, " ");
  assert.match(normalizedSql, /add column if not exists payment_contract_kind text/);
  assert.match(normalizedSql, /add column if not exists payment_contract_credit_terms_version bigint/);
  assert.match(
    normalizedSql,
    /add constraint product_orders_payment_contract_check check \( \(payment_contract_kind is null and payment_contract_credit_terms_version is null\) or \(payment_contract_kind = 'standard_payment' and payment_contract_credit_terms_version is null\) or \(payment_contract_kind = 'credit_account' and payment_contract_credit_terms_version is not null\) \)/,
  );
});

test("only the first owner-submit finalize writes the payment-contract snapshot, binding the exact credit-terms version for credit_account and nothing for every other method", () => {
  const finalize = functionBlock("public.finalize_gyeon_order_v3_owner_submit_rpc");
  assert.match(
    finalize,
    /payment_contract_kind = case when p_payment_method = 'credit_account' then 'credit_account' else 'standard_payment' end/,
  );
  assert.match(
    finalize,
    /payment_contract_credit_terms_version = case when p_payment_method = 'credit_account' then v_credit\.terms_version else null end/,
  );
  const idxSnapshotWrite = finalize.indexOf("payment_contract_kind = case");
  const idxStatusUpdate = finalize.indexOf("update public.product_orders set status = 'submitted'");
  assert.ok(
    idxSnapshotWrite > idxStatusUpdate,
    "the snapshot must be written in the same update that transitions draft to submitted",
  );
  // The function only reaches this update after its own draft-only guard,
  // so the snapshot can only ever be written once per order.
  assert.match(finalize, /v_order\.status <> 'draft'/);
});

test("pre-warehouse edit finalize never writes, clears, or infers the payment-contract snapshot on either an amount-changing or amount-preserving edit", () => {
  const editFinalize = functionBlock("public.finalize_gyeon_order_v3_edit_rpc");
  assert.doesNotMatch(editFinalize, /payment_contract_kind\s*=/);
  assert.doesNotMatch(editFinalize, /payment_contract_credit_terms_version\s*=/);
});

test("edit prepare and edit finalize fail closed on a submitted order with no explicit payment-contract snapshot, without inferring or backfilling one", () => {
  const editPrepare = functionBlock("public.prepare_gyeon_order_v3_edit_rpc");
  const editFinalize = functionBlock("public.finalize_gyeon_order_v3_edit_rpc");
  for (const block of [editPrepare, editFinalize]) {
    assert.match(block, /payment_contract_snapshot_missing/);
    assert.match(block, /v_order\.payment_contract_kind is null/);
  }
  const idxPrepareGuard = editPrepare.indexOf("payment_contract_snapshot_missing");
  const idxPrepareLinesCheck = editPrepare.indexOf("order_lines_required");
  assert.ok(
    idxPrepareGuard >= 0 && idxPrepareLinesCheck > idxPrepareGuard,
    "the missing-snapshot guard must run before line replacement is even validated",
  );
});

test("credit-account warehouse release revalidates the exact bound credit-terms version and rejects a stopped, expired, missing, or mismatched current version", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  assert.match(release, /elsif v_order\.payment_method = 'credit_account' then/);
  assert.match(release, /c\.terms_version = v_order\.payment_contract_credit_terms_version/);
  assert.match(release, /c\.credit_state = 'active'/);
  assert.match(release, /c\.effective_from <= now\(\)/);
  assert.match(release, /c\.effective_to is null or c\.effective_to > now\(\)/);
  assert.match(release, /credit_account_not_enabled/);
  const creditBranchStart = release.indexOf("elsif v_order.payment_method = 'credit_account' then");
  const idxVersionCheck = release.indexOf("c.terms_version = v_order.payment_contract_credit_terms_version");
  assert.ok(creditBranchStart >= 0 && idxVersionCheck > creditBranchStart);
});

test("no warehouse task can be inserted before the R2 payment-contract-snapshot and inventory-reservation guards", () => {
  const release = functionBlock("public.release_gyeon_order_v3_warehouse_rpc");
  const idxTaskInsert = release.indexOf("insert into public.gyeon_order_warehouse_tasks");
  for (const marker of [
    "payment_contract_snapshot_missing",
    "payment_contract_snapshot_mismatch",
    "inventory_reservation_evidence_required",
    "inventory_reservation_evidence_ambiguous",
  ]) {
    const idx = release.indexOf(marker);
    assert.ok(idx >= 0 && idx < idxTaskInsert, `${marker} must be checked before the warehouse task insert`);
  }
});

test("no external, provider, or network call is present in any function body", () => {
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");
  assert.doesNotMatch(normalized, /pg_net|http_post|http_get|dblink/);
});
