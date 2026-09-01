import assert from "node:assert/strict";
import test from "node:test";

import {
  GYEON_FREE_SHIPPING_THRESHOLD_EX_TAX_YEN,
  GYEON_ORDER_V3_STATE_AXES,
  GYEON_ORDER_V3_STATUSES,
  assessCommercialEdit,
  calculateEarliestShipDate,
  canDealerPerformV3Action,
  canTransitionGyeonOrderV3,
  decideOwnerFinalSubmitCharge,
  decideWarehouseRelease,
  evaluateInitialQualification,
  quoteGyeonOrderV3Shipping,
  shipmentDateChangeNotification,
  transitionOwnerReview,
  validatePromotionalCart,
  type CardBrand,
  type CardPaymentEvidenceCheck,
  type ExternalAuthorityEvidence,
} from "./gyeon-order-v3-contract-core";

const NOW = "2026-08-27T06:00:00.000Z";

const validCardEvidence: ExternalAuthorityEvidence = {
  id: "evidence-1",
  authority: "server_verified",
  provider: "psp-test",
  providerEventId: "provider-event-1",
  purpose: "full_payment_charge",
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

const validCardPaymentEvidenceCheck: CardPaymentEvidenceCheck = {
  evidence: validCardEvidence,
  dealerId: "dealer-1",
  orderId: "order-1",
  orderVersion: 3,
  requestFingerprint: "fingerprint-1",
  payableAmountIncTaxYen: 33_000,
  nowIso: NOW,
};

const baseReleaseInput = {
  paymentMethod: "card" as const,
  creditAccountConfigured: false,
  creditAccountActive: false,
  customerDirect: false,
  ownerSubmitted: true,
  cardPaymentEvidenceCheck: validCardPaymentEvidenceCheck,
  bankPaymentMatched: false,
  hasBackorder: false,
  backorderShippingPolicy: null,
};

test("only the owner can perform final submission and pre-warehouse cancellation", () => {
  assert.equal(canDealerPerformV3Action("owner", "final_submit"), true);
  assert.equal(canDealerPerformV3Action("manager", "final_submit"), false);
  assert.equal(canDealerPerformV3Action("staff", "final_submit"), false);
  assert.equal(canDealerPerformV3Action("readonly", "final_submit"), false);
  assert.equal(canDealerPerformV3Action("owner", "cancel_before_warehouse_acceptance"), true);
  assert.equal(canDealerPerformV3Action("staff", "cancel_before_warehouse_acceptance"), false);
});

test("staff and manager can create drafts and request owner review", () => {
  for (const role of ["staff", "manager"] as const) {
    assert.equal(canDealerPerformV3Action(role, "create_draft"), true);
    assert.equal(canDealerPerformV3Action(role, "request_owner_review"), true);
    assert.deepEqual(
      transitionOwnerReview({
        current: "not_requested",
        event: "request",
        actorRole: role,
        orderStatus: "draft",
      }),
      { ok: true, next: "pending" },
    );
  }
});

test("owner review is a separate state axis with fail-closed transitions", () => {
  assert.deepEqual(
    transitionOwnerReview({
      current: "pending",
      event: "confirm",
      actorRole: "owner",
      orderStatus: "draft",
    }),
    { ok: true, next: "owner_confirmed" },
  );
  assert.deepEqual(
    transitionOwnerReview({
      current: "pending",
      event: "request_changes",
      actorRole: "owner",
      orderStatus: "draft",
    }),
    { ok: true, next: "changes_requested" },
  );
  assert.deepEqual(
    transitionOwnerReview({
      current: "owner_confirmed",
      event: "commercial_edit",
      actorRole: "staff",
      orderStatus: "draft",
    }),
    { ok: true, next: "not_requested" },
  );
  assert.deepEqual(
    transitionOwnerReview({
      current: "not_requested",
      event: "request",
      actorRole: "owner",
      orderStatus: "draft",
    }),
    { ok: false, code: "review_role_denied" },
  );
  assert.deepEqual(
    transitionOwnerReview({
      current: "not_requested",
      event: "request",
      actorRole: "staff",
      orderStatus: "submitted",
    }),
    { ok: false, code: "order_not_draft" },
  );
});

test("final submit is owner-only and requires confirmation, complete data, and qualification", () => {
  const ready = {
    from: "draft" as const,
    to: "submitted" as const,
    actor: { kind: "dealer" as const, role: "owner" as const },
    ownerConfirmed: true,
    requiredOrderDataComplete: true,
    qualificationMet: true,
  };
  assert.deepEqual(canTransitionGyeonOrderV3(ready), { ok: true });
  assert.deepEqual(
    canTransitionGyeonOrderV3({
      ...ready,
      actor: { kind: "dealer", role: "staff" },
    }),
    { ok: false, code: "role_denied" },
  );
  assert.deepEqual(canTransitionGyeonOrderV3({ ...ready, ownerConfirmed: false }), {
    ok: false,
    code: "owner_confirmation_required",
  });
  assert.deepEqual(canTransitionGyeonOrderV3({ ...ready, requiredOrderDataComplete: false }), {
    ok: false,
    code: "required_order_data_missing",
  });
  assert.deepEqual(canTransitionGyeonOrderV3({ ...ready, qualificationMet: false }), {
    ok: false,
    code: "qualification_not_met",
  });
});

test("warehouse transitions follow the six-state aggregate contract", () => {
  assert.deepEqual(
    canTransitionGyeonOrderV3({
      from: "submitted",
      to: "approved",
      actor: { kind: "warehouse" },
      warehouseReleaseReady: false,
    }),
    { ok: false, code: "warehouse_release_not_ready" },
  );
  assert.deepEqual(
    canTransitionGyeonOrderV3({
      from: "submitted",
      to: "approved",
      actor: { kind: "warehouse" },
      warehouseReleaseReady: true,
    }),
    { ok: true },
  );
  assert.deepEqual(
    canTransitionGyeonOrderV3({
      from: "approved",
      to: "fulfilling",
      actor: { kind: "warehouse" },
    }),
    { ok: true },
  );
  assert.deepEqual(
    canTransitionGyeonOrderV3({
      from: "fulfilling",
      to: "fulfilled",
      actor: { kind: "warehouse" },
      fulfillmentObligationsComplete: true,
    }),
    { ok: true },
  );
});

test("order aggregate status excludes review, payment, backorder, shipment, and PDF states", () => {
  assert.deepEqual(GYEON_ORDER_V3_STATUSES, [
    "draft",
    "submitted",
    "approved",
    "fulfilling",
    "fulfilled",
    "cancelled",
  ]);
  const forbidden = ["backorder", "authorized", "owner_confirmed", "shipped", "issued"];
  for (const state of forbidden) assert.equal(GYEON_ORDER_V3_STATUSES.includes(state as never), false);
  assert.deepEqual(GYEON_ORDER_V3_STATE_AXES.order, GYEON_ORDER_V3_STATUSES);
  assert.equal(GYEON_ORDER_V3_STATE_AXES.backorder.includes("ship_available_first"), true);
  assert.equal(GYEON_ORDER_V3_STATE_AXES.shipment.includes("shipped"), true);
  assert.equal(GYEON_ORDER_V3_STATE_AXES.pdf.includes("issued"), true);
  assert.equal(
    GYEON_ORDER_V3_STATE_AXES.qualification.includes("officially_achieved_after_fulfillment"),
    true,
  );
});

test("free shipping uses pre-discount list price ex-tax, excludes promotional goods, and starts at 30,000 yen", () => {
  assert.equal(GYEON_FREE_SHIPPING_THRESHOLD_EX_TAX_YEN, 30_000);
  assert.deepEqual(
    quoteGyeonOrderV3Shipping({
      lines: [
        { quantity: 3, listPriceExTaxYen: 10_000, isPromotionalGood: false },
        { quantity: 1, listPriceExTaxYen: 99_999, isPromotionalGood: true },
      ],
      underThresholdShippingFeeYen: 900,
    }),
    {
      ok: true,
      basis: "list_price_ex_tax_before_discount_excluding_promotional_goods",
      thresholdYen: 30_000,
      shippingBasisExTaxYen: 30_000,
      freeShipping: true,
      shippingFeeYen: 0,
    },
  );
});

test("shipping quote accepts one-unit quantities and never applies case-multiple correction", () => {
  const result = quoteGyeonOrderV3Shipping({
    lines: [{ quantity: 1, listPriceExTaxYen: 12_345, isPromotionalGood: false }],
    underThresholdShippingFeeYen: 880,
  });
  assert.deepEqual(result, {
    ok: true,
    basis: "list_price_ex_tax_before_discount_excluding_promotional_goods",
    thresholdYen: 30_000,
    shippingBasisExTaxYen: 12_345,
    freeShipping: false,
    shippingFeeYen: 880,
  });
  assert.deepEqual(
    quoteGyeonOrderV3Shipping({
      lines: [{ quantity: 0, listPriceExTaxYen: 12_345, isPromotionalGood: false }],
      underThresholdShippingFeeYen: 880,
    }),
    { ok: false, code: "invalid_quantity" },
  );
});

test("unknown price and shipping fee fail closed instead of becoming zero", () => {
  assert.deepEqual(
    quoteGyeonOrderV3Shipping({
      lines: [{ quantity: 1, listPriceExTaxYen: null, isPromotionalGood: false }],
      underThresholdShippingFeeYen: 880,
    }),
    { ok: false, code: "price_unset" },
  );
  assert.deepEqual(
    quoteGyeonOrderV3Shipping({
      lines: [{ quantity: 1, listPriceExTaxYen: 1_000, isPromotionalGood: false }],
      underThresholdShippingFeeYen: null,
    }),
    { ok: false, code: "shipping_fee_unresolved" },
  );
});

test("four payment methods have their specified warehouse release triggers", () => {
  assert.deepEqual(decideWarehouseRelease(baseReleaseInput), {
    ok: true,
    trigger: "card_payment_succeeded",
    consumeEvidenceId: "evidence-1",
  });
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "bank_transfer_prepaid",
      cardPaymentEvidenceCheck: null,
      bankPaymentMatched: true,
    }),
    { ok: true, trigger: "bank_matched" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "cash_on_delivery",
      cardPaymentEvidenceCheck: null,
    }),
    { ok: true, trigger: "owner_submitted" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "credit_account",
      creditAccountConfigured: true,
      creditAccountActive: true,
      cardPaymentEvidenceCheck: null,
    }),
    { ok: true, trigger: "owner_submitted" },
  );
});

test("card warehouse release requires exact structured server-verified succeeded evidence and rejects every historical/invalid evidence shape", () => {
  assert.deepEqual(decideWarehouseRelease(baseReleaseInput), {
    ok: true,
    trigger: "card_payment_succeeded",
    consumeEvidenceId: "evidence-1",
  });
  assert.deepEqual(decideWarehouseRelease({ ...baseReleaseInput, cardPaymentEvidenceCheck: null }), {
    ok: false,
    code: "evidence_missing",
  });
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: {
        ...validCardPaymentEvidenceCheck,
        evidence: { ...validCardEvidence, authority: "unverified" },
      },
    }),
    { ok: false, code: "evidence_not_server_verified" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: {
        ...validCardPaymentEvidenceCheck,
        evidence: { ...validCardEvidence, state: "pending" },
      },
    }),
    { ok: false, code: "evidence_not_succeeded" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: {
        ...validCardPaymentEvidenceCheck,
        evidence: { ...validCardEvidence, consumedAtIso: "2026-08-27T05:59:00.000Z" },
      },
    }),
    { ok: false, code: "evidence_consumed" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: { ...validCardPaymentEvidenceCheck, nowIso: "2026-08-27T06:11:00.000Z" },
    }),
    { ok: false, code: "evidence_expired" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: {
        ...validCardPaymentEvidenceCheck,
        evidence: { ...validCardEvidence, orderId: "order-2" },
      },
    }),
    { ok: false, code: "evidence_order_binding_mismatch" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: { ...validCardPaymentEvidenceCheck, payableAmountIncTaxYen: 33_001 },
    }),
    { ok: false, code: "evidence_amount_mismatch" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: {
        ...validCardPaymentEvidenceCheck,
        evidence: { ...validCardEvidence, serverVerifiedAtIso: "2026-08-27T06:01:00.000Z" },
      },
    }),
    { ok: false, code: "evidence_invalid" },
  );
});

test("credit-account selection fails closed", () => {
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "bank_transfer_prepaid",
      cardPaymentEvidenceCheck: null,
    }),
    { ok: false, code: "bank_payment_match_required" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "card",
      creditAccountConfigured: true,
      creditAccountActive: true,
    }),
    { ok: false, code: "credit_account_required" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "credit_account",
      cardPaymentEvidenceCheck: null,
    }),
    { ok: false, code: "credit_account_selection_forbidden" },
  );
});

test("cash on delivery is forbidden for customer-direct delivery", () => {
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      paymentMethod: "cash_on_delivery",
      customerDirect: true,
      cardPaymentEvidenceCheck: null,
    }),
    { ok: false, code: "cash_on_delivery_direct_ship_forbidden" },
  );
});

test("backorder shipping policy is required only when backorder exists, and never blocks card capture", () => {
  assert.deepEqual(decideWarehouseRelease(baseReleaseInput), {
    ok: true,
    trigger: "card_payment_succeeded",
    consumeEvidenceId: "evidence-1",
  });
  assert.deepEqual(
    decideWarehouseRelease({ ...baseReleaseInput, hasBackorder: true }),
    { ok: false, code: "backorder_policy_required" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      hasBackorder: true,
      backorderShippingPolicy: "ship_available_first",
    }),
    { ok: true, trigger: "card_payment_succeeded", consumeEvidenceId: "evidence-1" },
  );
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      hasBackorder: true,
      backorderShippingPolicy: "ship_when_complete",
    }),
    { ok: true, trigger: "card_payment_succeeded", consumeEvidenceId: "evidence-1" },
  );
});

test("card warehouse release propagates the exact validated evidence ID rather than a fixed value", () => {
  assert.deepEqual(
    decideWarehouseRelease({
      ...baseReleaseInput,
      cardPaymentEvidenceCheck: {
        ...validCardPaymentEvidenceCheck,
        evidence: { ...validCardEvidence, id: "evidence-distinct-42" },
      },
    }),
    { ok: true, trigger: "card_payment_succeeded", consumeEvidenceId: "evidence-distinct-42" },
  );
});

test("JCB follows the same single full-payment flow because no card-brand branch exists", () => {
  assert.deepEqual(
    decideWarehouseRelease({ ...baseReleaseInput, hasBackorder: true, backorderShippingPolicy: "ship_available_first" }),
    decideWarehouseRelease({ ...baseReleaseInput, hasBackorder: true, backorderShippingPolicy: "ship_when_complete" }),
  );
});

test("owner final submit charges the full immutable payable total, including backorder, exactly once, regardless of shipping policy or card brand", () => {
  const policies: readonly ("ship_available_first" | "ship_when_complete")[] = [
    "ship_available_first",
    "ship_when_complete",
  ];
  const cardBrands: readonly CardBrand[] = ["visa", "mastercard", "jcb", "amex"];
  const results = policies.flatMap((backorderShippingPolicy) =>
    cardBrands.map((cardBrand) =>
      decideOwnerFinalSubmitCharge({
        nonBackorderPayableAmountIncTaxYen: 25_000,
        backorderPayableAmountIncTaxYen: 8_000,
        backorderShippingPolicy,
        cardBrand,
      }),
    ),
  );
  for (const result of results) {
    assert.deepEqual(result, {
      ok: true,
      chargeAmountIncTaxYen: 33_000,
      captureCount: 1,
    });
  }

  const jcbResult = decideOwnerFinalSubmitCharge({
    nonBackorderPayableAmountIncTaxYen: 25_000,
    backorderPayableAmountIncTaxYen: 8_000,
    backorderShippingPolicy: "ship_when_complete",
    cardBrand: "jcb",
  });
  const visaResult = decideOwnerFinalSubmitCharge({
    nonBackorderPayableAmountIncTaxYen: 25_000,
    backorderPayableAmountIncTaxYen: 8_000,
    backorderShippingPolicy: "ship_available_first",
    cardBrand: "visa",
  });
  assert.deepEqual(jcbResult, visaResult);
});

test("owner final submit charge fails closed on invalid backorder or non-backorder amounts", () => {
  assert.deepEqual(
    decideOwnerFinalSubmitCharge({
      nonBackorderPayableAmountIncTaxYen: -1,
      backorderPayableAmountIncTaxYen: 0,
      backorderShippingPolicy: null,
      cardBrand: "visa",
    }),
    { ok: false, code: "invalid_amount" },
  );
  assert.deepEqual(
    decideOwnerFinalSubmitCharge({
      nonBackorderPayableAmountIncTaxYen: 0,
      backorderPayableAmountIncTaxYen: 0,
      backorderShippingPolicy: null,
      cardBrand: "jcb",
    }),
    { ok: false, code: "invalid_amount" },
  );
});

test("owner final submit charge fails closed when backorder amount is positive and shipping policy is missing", () => {
  assert.deepEqual(
    decideOwnerFinalSubmitCharge({
      nonBackorderPayableAmountIncTaxYen: 25_000,
      backorderPayableAmountIncTaxYen: 8_000,
      backorderShippingPolicy: null,
      cardBrand: "visa",
    }),
    { ok: false, code: "backorder_shipping_policy_required" },
  );
  assert.deepEqual(
    decideOwnerFinalSubmitCharge({
      nonBackorderPayableAmountIncTaxYen: 25_000,
      backorderPayableAmountIncTaxYen: 0,
      backorderShippingPolicy: null,
      cardBrand: "visa",
    }),
    { ok: true, chargeAmountIncTaxYen: 25_000, captureCount: 1 },
  );
});

test("commercial edits are locked after warehouse acceptance, and every submitted card edit is forbidden as post-payment", () => {
  assert.deepEqual(
    assessCommercialEdit({
      status: "approved",
      paymentMethod: "card",
      currentPayableAmountYen: 10_000,
      proposedPayableAmountYen: 12_000,
    }),
    {
      ok: false,
      code: "warehouse_already_accepted",
      payableAmountYen: 10_000,
      preserveOriginal: true,
    },
  );
  assert.deepEqual(
    assessCommercialEdit({
      status: "submitted",
      paymentMethod: "card",
      currentPayableAmountYen: 10_000,
      proposedPayableAmountYen: 12_000,
    }),
    {
      ok: false,
      code: "post_payment_amount_edit_forbidden",
      payableAmountYen: 10_000,
      preserveOriginal: true,
    },
  );
  assert.deepEqual(
    assessCommercialEdit({
      status: "submitted",
      paymentMethod: "card",
      currentPayableAmountYen: 10_000,
      proposedPayableAmountYen: 10_000,
    }),
    {
      ok: false,
      code: "post_payment_amount_edit_forbidden",
      payableAmountYen: 10_000,
      preserveOriginal: true,
    },
  );
  assert.deepEqual(
    assessCommercialEdit({
      status: "submitted",
      paymentMethod: "bank_transfer_prepaid",
      currentPayableAmountYen: 10_000,
      proposedPayableAmountYen: 12_000,
    }),
    { ok: true, payableAmountYen: 12_000, preserveOriginal: false },
  );
});

test("calendar uses explicit daily availability and cutoff without hard-coded weekends", () => {
  const calendar = [
    { date: "2026-08-28", mode: "normal" as const, cutoffMinute: 900 },
    { date: "2026-08-29", mode: "exceptional" as const, cutoffMinute: 720 },
    { date: "2026-08-30", mode: "closed" as const },
    { date: "2026-08-31", mode: "normal" as const },
  ];
  assert.deepEqual(
    calculateEarliestShipDate({
      eligibleDate: "2026-08-28",
      eligibleMinute: 899,
      inventoryReadyDate: "2026-08-28",
      defaultCutoffMinute: 900,
      calendar,
    }),
    { ok: true, date: "2026-08-28" },
  );
  assert.deepEqual(
    calculateEarliestShipDate({
      eligibleDate: "2026-08-28",
      eligibleMinute: 901,
      inventoryReadyDate: "2026-08-28",
      defaultCutoffMinute: 900,
      calendar,
    }),
    { ok: true, date: "2026-08-29" },
  );
  assert.deepEqual(
    calculateEarliestShipDate({
      eligibleDate: "2026-08-30",
      eligibleMinute: 500,
      inventoryReadyDate: "2026-08-30",
      defaultCutoffMinute: 900,
      calendar,
    }),
    { ok: true, date: "2026-08-31" },
  );
});

test("calendar waits for inventory and fails closed when a required day is unconfigured", () => {
  assert.deepEqual(
    calculateEarliestShipDate({
      eligibleDate: "2026-08-27",
      eligibleMinute: 600,
      inventoryReadyDate: "2026-08-29",
      defaultCutoffMinute: 900,
      calendar: [{ date: "2026-08-29", mode: "normal" }],
    }),
    { ok: true, date: "2026-08-29" },
  );
  assert.deepEqual(
    calculateEarliestShipDate({
      eligibleDate: "2026-08-27",
      eligibleMinute: 901,
      inventoryReadyDate: "2026-08-27",
      defaultCutoffMinute: 900,
      calendar: [{ date: "2026-08-27", mode: "normal" }],
    }),
    { ok: false, code: "calendar_unconfigured" },
  );
});

test("a changed existing ship date requires both bell and email notification", () => {
  assert.deepEqual(
    shipmentDateChangeNotification({ previousDate: "2026-08-28", nextDate: "2026-08-29" }),
    { notify: true, channels: ["bell", "email"] },
  );
  assert.deepEqual(
    shipmentDateChangeNotification({ previousDate: "2026-08-28", nextDate: "2026-08-28" }),
    { notify: false, channels: [] },
  );
});

test("Shop qualification uses eligible ex-tax list price and becomes official only after fulfillment", () => {
  const lines = [
    {
      productCode: "CHEMICAL_A",
      quantity: 2,
      listPriceExTaxYen: 50_000,
      classification: "eligible_chemical" as const,
    },
    {
      productCode: "MATT",
      quantity: 1,
      listPriceExTaxYen: 99_999,
      classification: "optional_matt" as const,
    },
  ];
  assert.deepEqual(
    evaluateInitialQualification({ mode: "shop_initial", lines, shipmentFulfilled: false }),
    {
      provisionalMet: true,
      officiallyAchieved: false,
      qualifyingAmountExTaxYen: 100_000,
      amountRemainingExTaxYen: 0,
      missingRequiredProductCodes: [],
    },
  );
  assert.equal(
    evaluateInitialQualification({ mode: "shop_initial", lines, shipmentFulfilled: true })
      .officiallyAchieved,
    true,
  );
});

test("Detailer qualification requires six products while MATT remains optional and excluded", () => {
  const required = ["ONE_EVO", "PURE_EVO", "MOHS_EVO", "SYNCRO_EVO", "PRIMER", "PREP"];
  const lines = [
    {
      productCode: "CHEMICAL_A",
      quantity: 1,
      listPriceExTaxYen: 100_000,
      classification: "eligible_chemical" as const,
    },
    ...required.map((productCode) => ({
      productCode,
      quantity: 1,
      listPriceExTaxYen: 20_000,
      classification: "required_detailer_product" as const,
    })),
  ];
  const decision = evaluateInitialQualification({
    mode: "detailer_initial",
    lines,
    shipmentFulfilled: false,
  });
  assert.equal(decision.provisionalMet, true);
  assert.equal(decision.qualifyingAmountExTaxYen, 100_000);
  assert.deepEqual(decision.missingRequiredProductCodes, []);
});

test("Shop-to-Detailer upgrade reuses shipped unreturned history and does not re-require 100,000 yen", () => {
  const decision = evaluateInitialQualification({
    mode: "shop_to_detailer",
    lines: [],
    previouslyShippedUnreturnedProductCodes: [
      "ONE_EVO",
      "PURE_EVO",
      "MOHS_EVO",
      "SYNCRO_EVO",
      "PRIMER",
      "PREP",
    ],
    shipmentFulfilled: false,
  });
  assert.equal(decision.provisionalMet, true);
  assert.equal(decision.amountRemainingExTaxYen, 0);
  assert.deepEqual(decision.missingRequiredProductCodes, []);
});

test("promotional goods cannot be ordered alone and each banner kind is limited to one", () => {
  assert.deepEqual(
    validatePromotionalCart([{ quantity: 1, isPromotionalGood: true }]),
    { ok: false, code: "promotional_goods_only" },
  );
  assert.deepEqual(
    validatePromotionalCart([
      { quantity: 1, isPromotionalGood: false },
      { quantity: 2, isPromotionalGood: true, bannerKind: "banner-a" },
    ]),
    { ok: false, code: "banner_quantity_exceeded" },
  );
  assert.deepEqual(
    validatePromotionalCart([
      { quantity: 1, isPromotionalGood: false },
      { quantity: 1, isPromotionalGood: true, bannerKind: "banner-a" },
      { quantity: 1, isPromotionalGood: true, bannerKind: "banner-b" },
      { quantity: 1, isPromotionalGood: true, bannerKind: "banner-c" },
    ]),
    { ok: true },
  );
});
