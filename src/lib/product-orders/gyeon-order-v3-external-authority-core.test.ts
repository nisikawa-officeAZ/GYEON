import assert from "node:assert/strict";
import test from "node:test";

import {
  assessPreparedOperationFinalization,
  decideBankPaymentMatch,
  decideWarehouseAcceptance,
  decideWarehouseTaskCreation,
  evaluateQualificationAuthorityForSubmit,
  planPreWarehouseCommercialEdit,
  transitionQualificationLifecycle,
  validateExternalAuthorityEvidence,
  type ExternalAuthorityEvidence,
  type ExternalEvidenceExpectation,
  type PreparedExternalOperation,
} from "./gyeon-order-v3-external-authority-core";

const NOW = "2026-08-27T06:00:00.000Z";

const baseEvidence: ExternalAuthorityEvidence = {
  id: "evidence-1",
  authority: "server_verified",
  provider: "psp-test",
  providerEventId: "provider-event-1",
  purpose: "initial_authorization",
  state: "succeeded",
  dealerId: "dealer-1",
  orderId: "order-1",
  orderVersion: 3,
  requestFingerprint: "fingerprint-1",
  amountIncTaxYen: 33_000,
  currency: "JPY",
  serverVerifiedAtIso: "2026-08-27T05:58:00.000Z",
  expiresAtIso: "2026-08-27T06:10:00.000Z",
  consumedAtIso: null,
};

const evidenceExpectation = {
  purpose: "initial_authorization" as const,
  dealerId: "dealer-1",
  orderId: "order-1",
  orderVersion: 3,
  requestFingerprint: "fingerprint-1",
  amountIncTaxYen: 33_000,
  currency: "JPY" as const,
  nowIso: NOW,
};

const prepared: PreparedExternalOperation = {
  id: "prepared-1",
  kind: "owner_submit",
  dealerId: "dealer-1",
  orderId: "order-1",
  expectedOrderVersion: 3,
  requestFingerprint: "fingerprint-1",
  amountIncTaxYen: 33_000,
  currency: "JPY",
  evidencePurpose: "initial_authorization",
  preparedAtIso: "2026-08-27T05:57:00.000Z",
  expiresAtIso: "2026-08-27T06:05:00.000Z",
};

const baseWarehouseInput = {
  orderStatus: "submitted" as const,
  taskAlreadyExists: false,
  supplyAuthorityVerified: true,
  inventoryReservationOrBackorderEvidenceVerified: true,
  earliestShipDate: "2026-08-28",
  calendarVersion: 7,
  paymentMethod: "card" as const,
  creditAccountConfigured: false,
  creditAccountActive: false,
  customerDirect: false,
  ownerSubmitted: true,
  cardAuthorized: true,
  bankPaymentMatched: false,
  hasBackorder: false,
  backorderShippingPolicy: null,
};

test("exact server-owned evidence is accepted", () => {
  assert.deepEqual(validateExternalAuthorityEvidence(baseEvidence, evidenceExpectation), {
    ok: true,
    evidenceId: "evidence-1",
  });
});

test("unverified, pending, consumed, and expired evidence fail closed", () => {
  assert.deepEqual(
    validateExternalAuthorityEvidence(
      { ...baseEvidence, authority: "unverified" },
      evidenceExpectation,
    ),
    { ok: false, code: "evidence_not_server_verified" },
  );
  assert.deepEqual(
    validateExternalAuthorityEvidence({ ...baseEvidence, state: "pending" }, evidenceExpectation),
    { ok: false, code: "evidence_not_succeeded" },
  );
  assert.deepEqual(
    validateExternalAuthorityEvidence(
      { ...baseEvidence, consumedAtIso: "2026-08-27T05:59:00.000Z" },
      evidenceExpectation,
    ),
    { ok: false, code: "evidence_consumed" },
  );
  assert.deepEqual(
    validateExternalAuthorityEvidence(
      { ...baseEvidence, expiresAtIso: NOW },
      evidenceExpectation,
    ),
    { ok: false, code: "evidence_expired" },
  );
  assert.deepEqual(
    validateExternalAuthorityEvidence(
      { ...baseEvidence, serverVerifiedAtIso: "2026-08-27T06:01:00.000Z" },
      evidenceExpectation,
    ),
    { ok: false, code: "evidence_invalid" },
  );
});

test("evidence cannot be moved across purpose, order, version, fingerprint, amount, or currency", () => {
  const cases: Array<[Partial<ExternalEvidenceExpectation>, string]> = [
    [{ purpose: "edit_reauthorization" as const }, "evidence_purpose_mismatch"],
    [{ orderId: "order-2" }, "evidence_order_binding_mismatch"],
    [{ orderVersion: 4 }, "evidence_version_mismatch"],
    [{ requestFingerprint: "different" }, "evidence_fingerprint_mismatch"],
    [{ amountIncTaxYen: 33_001 }, "evidence_amount_mismatch"],
  ];
  for (const [override, code] of cases) {
    assert.deepEqual(
      validateExternalAuthorityEvidence(baseEvidence, {
        ...evidenceExpectation,
        ...override,
      }),
      { ok: false, code },
    );
  }
  assert.deepEqual(
    validateExternalAuthorityEvidence({ ...baseEvidence, currency: "USD" }, evidenceExpectation),
    { ok: false, code: "evidence_currency_mismatch" },
  );
});

test("finalize consumes one exact evidence only after version and fingerprint recheck", () => {
  assert.deepEqual(
    assessPreparedOperationFinalization({
      prepared,
      currentOrderVersion: 3,
      currentRequestFingerprint: "fingerprint-1",
      evidence: baseEvidence,
      nowIso: NOW,
    }),
    {
      ok: true,
      consumeEvidenceId: "evidence-1",
      preserveOriginal: false,
      compensation: "none",
    },
  );
});

test("a version race preserves the order and requests new-card-authorization void", () => {
  assert.deepEqual(
    assessPreparedOperationFinalization({
      prepared,
      currentOrderVersion: 4,
      currentRequestFingerprint: "fingerprint-1",
      evidence: baseEvidence,
      nowIso: NOW,
    }),
    {
      ok: false,
      code: "order_version_conflict",
      preserveOriginal: true,
      compensation: "void_new_card_authorization",
    },
  );
  assert.deepEqual(
    assessPreparedOperationFinalization({
      prepared,
      currentOrderVersion: 4,
      currentRequestFingerprint: "fingerprint-1",
      evidence: { ...baseEvidence, orderId: "unrelated-order" },
      nowIso: NOW,
    }),
    {
      ok: false,
      code: "order_version_conflict",
      preserveOriginal: true,
      compensation: "none",
    },
  );
});

test("expired preparation preserves the original and never treats PSP success as committed", () => {
  assert.deepEqual(
    assessPreparedOperationFinalization({
      prepared,
      currentOrderVersion: 3,
      currentRequestFingerprint: "fingerprint-1",
      evidence: baseEvidence,
      nowIso: "2026-08-27T06:06:00.000Z",
    }),
    {
      ok: false,
      code: "prepared_operation_expired",
      preserveOriginal: true,
      compensation: "void_new_card_authorization",
    },
  );
});

test("failed external evidence never mutates the original order", () => {
  assert.deepEqual(
    assessPreparedOperationFinalization({
      prepared,
      currentOrderVersion: 3,
      currentRequestFingerprint: "fingerprint-1",
      evidence: { ...baseEvidence, state: "failed" },
      nowIso: NOW,
    }),
    {
      ok: false,
      code: "evidence_not_succeeded",
      preserveOriginal: true,
      compensation: "none",
    },
  );
});

test("only a submitted card order with a changed amount needs reauthorization", () => {
  assert.deepEqual(
    planPreWarehouseCommercialEdit({
      orderStatus: "submitted",
      warehouseAccepted: false,
      paymentMethod: "card",
      currentAmountIncTaxYen: 30_000,
      proposedAmountIncTaxYen: 31_000,
    }),
    {
      ok: true,
      action: "prepare_card_reauthorization",
      evidencePurpose: "edit_reauthorization",
    },
  );
  assert.deepEqual(
    planPreWarehouseCommercialEdit({
      orderStatus: "submitted",
      warehouseAccepted: false,
      paymentMethod: "card",
      currentAmountIncTaxYen: 30_000,
      proposedAmountIncTaxYen: 30_000,
    }),
    {
      ok: true,
      action: "finalize_without_external_authorization",
      evidencePurpose: null,
    },
  );
  assert.deepEqual(
    planPreWarehouseCommercialEdit({
      orderStatus: "submitted",
      warehouseAccepted: true,
      paymentMethod: "bank_transfer_prepaid",
      currentAmountIncTaxYen: 30_000,
      proposedAmountIncTaxYen: 31_000,
    }),
    { ok: false, code: "warehouse_already_accepted", preserveOriginal: true },
  );
});

test("qualification authority NOT_CONFIGURED, STALE, and ERROR never default to allowed", () => {
  const input = {
    dealerId: "dealer-1",
    orderId: "order-1",
    orderVersion: 2,
    mode: "shop_initial" as const,
    ruleVersion: 1,
    classificationAuthorityVersion: "products-v1",
    inputFingerprint: "qualification-fp",
    lines: [],
  };
  assert.deepEqual(evaluateQualificationAuthorityForSubmit({ ...input, authorityState: "NOT_CONFIGURED" }), {
    ok: false,
    code: "qualification_authority_not_configured",
  });
  assert.deepEqual(evaluateQualificationAuthorityForSubmit({ ...input, authorityState: "STALE" }), {
    ok: false,
    code: "qualification_authority_stale",
  });
  assert.deepEqual(evaluateQualificationAuthorityForSubmit({ ...input, authorityState: "ERROR" }), {
    ok: false,
    code: "qualification_authority_error",
  });
  assert.deepEqual(
    evaluateQualificationAuthorityForSubmit({
      ...input,
      authorityState: "CONFIGURED",
      lines: [
        {
          productCode: "BROKEN",
          quantity: -1,
          listPriceExTaxYen: 100_000,
          classification: "eligible_chemical",
        },
      ],
    }),
    { ok: false, code: "qualification_authority_invalid" },
  );
});

test("Shop qualification uses server-classified ex-tax list price and remains provisional at submit", () => {
  const result = evaluateQualificationAuthorityForSubmit({
    authorityState: "CONFIGURED",
    dealerId: "dealer-1",
    orderId: "order-1",
    orderVersion: 2,
    mode: "shop_initial",
    ruleVersion: 4,
    classificationAuthorityVersion: "products-v9",
    inputFingerprint: "qualification-fp",
    lines: [
      {
        productCode: "CHEMICAL_A",
        quantity: 2,
        listPriceExTaxYen: 50_000,
        classification: "eligible_chemical",
      },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.snapshot.decision.provisionalMet, true);
  assert.equal(result.snapshot.decision.officiallyAchieved, false);
  assert.equal(result.snapshot.decision.qualifyingAmountExTaxYen, 100_000);
  assert.equal(result.snapshot.ruleVersion, 4);
});

test("Detailer qualification reports missing required products and excludes them from 100,000 yen", () => {
  const result = evaluateQualificationAuthorityForSubmit({
    authorityState: "CONFIGURED",
    dealerId: "dealer-1",
    orderId: "order-1",
    orderVersion: 2,
    mode: "detailer_initial",
    ruleVersion: 4,
    classificationAuthorityVersion: "products-v9",
    inputFingerprint: "qualification-fp",
    lines: [
      {
        productCode: "CHEMICAL_A",
        quantity: 1,
        listPriceExTaxYen: 100_000,
        classification: "eligible_chemical",
      },
      {
        productCode: "ONE_EVO",
        quantity: 1,
        listPriceExTaxYen: 99_999,
        classification: "required_detailer_product",
      },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "qualification_not_met");
  assert.equal(result.decision?.qualifyingAmountExTaxYen, 100_000);
  assert.deepEqual(result.decision?.missingRequiredProductCodes, [
    "PURE_EVO",
    "MOHS_EVO",
    "SYNCRO_EVO",
    "PRIMER",
    "PREP",
  ]);
});

test("Shop-to-Detailer upgrade accepts shipped-unreturned history without another 100,000 yen", () => {
  const result = evaluateQualificationAuthorityForSubmit({
    authorityState: "CONFIGURED",
    dealerId: "dealer-1",
    orderId: "order-1",
    orderVersion: 2,
    mode: "shop_to_detailer",
    ruleVersion: 4,
    classificationAuthorityVersion: "products-v9",
    inputFingerprint: "qualification-fp",
    lines: [],
    previouslyShippedUnreturnedProductCodes: [
      "ONE_EVO",
      "PURE_EVO",
      "MOHS_EVO",
      "SYNCRO_EVO",
      "PRIMER",
      "PREP",
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.snapshot.decision.qualifyingAmountExTaxYen, 0);
  assert.equal(result.snapshot.decision.provisionalMet, true);
});

test("qualification becomes official only on fulfillment and returns require recheck", () => {
  assert.equal(
    transitionQualificationLifecycle({
      current: "provisional_met",
      event: "shipment_fulfilled",
      provisionalMet: true,
    }),
    "officially_achieved",
  );
  assert.equal(
    transitionQualificationLifecycle({
      current: "officially_achieved",
      event: "post_fulfillment_return",
      provisionalMet: true,
    }),
    "recheck_required",
  );
});

test("bank payment is matched only after exact server-side reconciliation", () => {
  const exact = {
    authority: "server_verified" as const,
    providerEventId: "bank-event-1",
    transactionId: "bank-tx-1",
    transactionAlreadyAssigned: false,
    orderReferenceMatches: true,
    destinationAccountMatches: true,
    payerNameMatches: true,
    receivedAmountYen: 33_000,
    expectedAmountYen: 33_000,
  };
  assert.deepEqual(decideBankPaymentMatch(exact), {
    ok: true,
    state: "matched",
    transactionId: "bank-tx-1",
  });
  assert.deepEqual(decideBankPaymentMatch({ ...exact, transactionAlreadyAssigned: true }), {
    ok: false,
    state: "on_hold",
    code: "bank_transaction_already_assigned",
  });
  assert.deepEqual(decideBankPaymentMatch({ ...exact, receivedAmountYen: 32_999 }), {
    ok: false,
    state: "on_hold",
    code: "bank_underpayment",
  });
  assert.deepEqual(decideBankPaymentMatch({ ...exact, payerNameMatches: false }), {
    ok: false,
    state: "on_hold",
    code: "bank_payer_name_mismatch",
  });
});

test("warehouse task is created as unaccepted when card release and authorities are ready", () => {
  assert.deepEqual(decideWarehouseTaskCreation(baseWarehouseInput), {
    ok: true,
    action: "create_unaccepted",
    trigger: "card_authorized",
  });
});

test("bank orders do not create a warehouse task before exact payment match", () => {
  const bank = {
    ...baseWarehouseInput,
    paymentMethod: "bank_transfer_prepaid" as const,
    cardAuthorized: false,
    bankPaymentMatched: false,
  };
  assert.deepEqual(decideWarehouseTaskCreation(bank), {
    ok: false,
    code: "payment_release_blocked",
    paymentCode: "bank_payment_match_required",
  });
  assert.deepEqual(decideWarehouseTaskCreation({ ...bank, bankPaymentMatched: true }), {
    ok: true,
    action: "create_unaccepted",
    trigger: "bank_matched",
  });
});

test("warehouse release requires supply, reservation or BO evidence, and calendar authority", () => {
  assert.deepEqual(
    decideWarehouseTaskCreation({ ...baseWarehouseInput, supplyAuthorityVerified: false }),
    { ok: false, code: "supply_authority_not_verified" },
  );
  assert.deepEqual(
    decideWarehouseTaskCreation({
      ...baseWarehouseInput,
      inventoryReservationOrBackorderEvidenceVerified: false,
    }),
    { ok: false, code: "inventory_reservation_or_backorder_evidence_required" },
  );
  assert.deepEqual(
    decideWarehouseTaskCreation({ ...baseWarehouseInput, calendarVersion: null }),
    { ok: false, code: "earliest_ship_date_authority_required" },
  );
  assert.deepEqual(
    decideWarehouseTaskCreation({ ...baseWarehouseInput, earliestShipDate: "2026-99-99" }),
    { ok: false, code: "earliest_ship_date_authority_required" },
  );
});

test("an existing warehouse task is an idempotent no-op, never a duplicate insert", () => {
  assert.deepEqual(
    decideWarehouseTaskCreation({ ...baseWarehouseInput, taskAlreadyExists: true }),
    { ok: true, action: "noop_existing" },
  );
});

test("warehouse acceptance advances exact order and task versions once", () => {
  assert.deepEqual(
    decideWarehouseAcceptance({
      orderStatus: "submitted",
      taskState: "unaccepted",
      orderVersion: 8,
      expectedOrderVersion: 8,
      taskVersion: 2,
      expectedTaskVersion: 2,
    }),
    {
      ok: true,
      nextOrderStatus: "approved",
      nextTaskState: "accepted",
      nextOrderVersion: 9,
      nextTaskVersion: 3,
    },
  );
  assert.deepEqual(
    decideWarehouseAcceptance({
      orderStatus: "approved",
      taskState: "accepted",
      orderVersion: 9,
      expectedOrderVersion: 8,
      taskVersion: 3,
      expectedTaskVersion: 2,
    }),
    { ok: false, code: "warehouse_accept_not_allowed" },
  );
});
