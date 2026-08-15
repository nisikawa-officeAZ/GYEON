import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  GYEON_FREE_SHIPPING_BASIS,
  GYEON_ORDER_STATUSES,
  buildGyeonOrderSnapshot,
  canDealerPerformOrderAction,
  evaluateGyeonCaptureGate,
  evaluateGyeonOrderTransition,
  normalizeGyeonBuyerRank,
  resolveGyeonOrderSubmission,
  type BuildGyeonOrderSnapshotInput,
  type GyeonOrderOfferAuthority,
} from "./gyeon-order-contract-core.js";

const offer = (
  over: Partial<GyeonOrderOfferAuthority> = {},
): GyeonOrderOfferAuthority => ({
  offerId: "offer-a",
  productId: "product-a",
  sku: "Q2M-PRESOLUTION-500",
  productName: "Q²M PReSolution 500ml",
  isActive: true,
  isDiscontinued: false,
  allowedRanks: ["detailer", "ppf_installer", "certified"],
  orderUnitQty: 2,
  minOrderQty: 2,
  listPriceExTaxYen: 10_000,
  listPriceIncTaxYen: 11_000,
  unitDiscountExTaxYen: 1_000,
  unitDiscountIncTaxYen: 1_100,
  taxRateBps: 1_000,
  supplyAvailability: "in_stock",
  backorderAllowed: true,
  offerVersion: 3,
  ...over,
});

const input = (
  over: Partial<BuildGyeonOrderSnapshotInput> = {},
): BuildGyeonOrderSnapshotInput => ({
  dealerId: "dealer-a",
  buyerRank: "certified",
  paymentMethod: "card",
  lines: [{ offerId: "offer-a", qty: 2 }],
  offersById: { "offer-a": offer() },
  shippingZoneCode: "kansai",
  underThresholdShippingFeeYen: 880,
  notes: "  至急  ",
  ...over,
});

const issueCodes = (result: ReturnType<typeof buildGyeonOrderSnapshot>) => {
  assert.equal(result.ok, false);
  if (result.ok) return [];
  return result.issues.map((issue) => issue.code);
};

describe("GYEON order role and state contract", () => {
  test("uses exactly the canonical six statuses", () => {
    assert.deepEqual(GYEON_ORDER_STATUSES, [
      "draft",
      "submitted",
      "approved",
      "fulfilling",
      "fulfilled",
      "cancelled",
    ]);
  });

  test("owner and manager may cancel, staff may submit but not cancel", () => {
    assert.equal(canDealerPerformOrderAction("owner", "cancel"), true);
    assert.equal(canDealerPerformOrderAction("manager", "cancel"), true);
    assert.equal(canDealerPerformOrderAction("staff", "submit"), true);
    assert.equal(canDealerPerformOrderAction("staff", "cancel"), false);
  });

  test("readonly may view and cannot mutate", () => {
    assert.equal(canDealerPerformOrderAction("readonly", "view"), true);
    for (const action of ["create", "edit", "submit", "cancel", "reorder"] as const) {
      assert.equal(canDealerPerformOrderAction("readonly", action), false);
    }
  });

  test("dealer staff may submit a draft but cannot self-approve", () => {
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "draft",
        to: "submitted",
        actor: { kind: "dealer", role: "staff" },
      }),
      { ok: true },
    );
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "submitted",
        to: "approved",
        actor: { kind: "dealer", role: "owner" },
      }),
      { ok: false, code: "transition_denied" },
    );
  });

  test("inactive operator fails closed", () => {
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "submitted",
        to: "approved",
        actor: { kind: "operator", active: false },
      }),
      { ok: false, code: "operator_inactive" },
    );
  });

  test("active operator owns approval and fulfillment start", () => {
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "submitted",
        to: "approved",
        actor: { kind: "operator", active: true },
      }),
      { ok: true },
    );
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "approved",
        to: "fulfilling",
        actor: { kind: "operator", active: true },
      }),
      { ok: true },
    );
  });

  test("fulfilled requires both shipment and capture evidence", () => {
    const actor = { kind: "operator", active: true } as const;
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "fulfilling",
        to: "fulfilled",
        actor,
        shipmentConfirmed: false,
        paymentCaptured: true,
      }),
      { ok: false, code: "shipment_evidence_required" },
    );
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "fulfilling",
        to: "fulfilled",
        actor,
        shipmentConfirmed: true,
        paymentCaptured: false,
      }),
      { ok: false, code: "capture_evidence_required" },
    );
    assert.deepEqual(
      evaluateGyeonOrderTransition({
        from: "fulfilling",
        to: "fulfilled",
        actor,
        shipmentConfirmed: true,
        paymentCaptured: true,
      }),
      { ok: true },
    );
  });

  test("cannot cancel after shipment or capture", () => {
    const result = evaluateGyeonOrderTransition({
      from: "fulfilling",
      to: "cancelled",
      actor: { kind: "operator", active: true },
      paymentCaptured: true,
    });
    assert.deepEqual(result, {
      ok: false,
      code: "cannot_cancel_after_shipment_or_capture",
    });
  });
});

describe("GYEON rank authority", () => {
  test("maps the foundation certified_detailer boundary to canonical certified", () => {
    assert.equal(normalizeGyeonBuyerRank("certified_detailer"), "certified");
    assert.equal(normalizeGyeonBuyerRank("gyeon_ppf_installer"), "ppf_installer");
  });

  test("unknown, blank, and wrong-case ranks deny", () => {
    for (const value of [null, "", "CERTIFIED", "unknown"]) {
      assert.equal(normalizeGyeonBuyerRank(value), null);
    }
  });
});

describe("server-owned GYEON order snapshot", () => {
  test("builds immutable values only from the authority offer", () => {
    const result = buildGyeonOrderSnapshot(input());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const line = result.snapshot.lines[0]!;
    assert.equal(line.productId, "product-a");
    assert.equal(line.skuSnapshot, "Q2M-PRESOLUTION-500");
    assert.equal(line.productNameSnapshot, "Q²M PReSolution 500ml");
    assert.equal(line.buyerRankSnapshot, "certified");
    assert.equal(line.offerVersion, 3);
    assert.equal(result.snapshot.notes, "至急");
    assert.equal(result.snapshot.paymentMethod, "card");
  });

  test("uses tax-included list price before discount as the fixed shipping basis", () => {
    const result = buildGyeonOrderSnapshot(input());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.snapshot.freeShippingBasis, GYEON_FREE_SHIPPING_BASIS);
    assert.equal(result.snapshot.shippingBasisYen, 22_000);
    assert.equal(result.snapshot.productSubtotalIncTaxYen, 19_800);
    assert.equal(result.snapshot.shippingFeeYen, 880);
    assert.equal(result.snapshot.payableAmountYen, 20_680);
  });

  test("grants free shipping at 30000 yen on the fixed basis", () => {
    const result = buildGyeonOrderSnapshot(
      input({
        lines: [{ offerId: "offer-a", qty: 3 }],
        offersById: {
          "offer-a": offer({ orderUnitQty: 1, minOrderQty: 1, listPriceIncTaxYen: 10_000 }),
        },
        underThresholdShippingFeeYen: null,
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.snapshot.shippingBasisYen, 30_000);
    assert.equal(result.snapshot.shippingFeeYen, 0);
    assert.equal(result.snapshot.freeShipping, true);
  });

  test("fails closed when an under-threshold shipping rule cannot resolve a fee", () => {
    assert.deepEqual(
      issueCodes(buildGyeonOrderSnapshot(input({ underThresholdShippingFeeYen: null }))),
      ["shipping_fee_unresolved"],
    );
  });

  test("rejects non-card payment", () => {
    assert.ok(
      issueCodes(buildGyeonOrderSnapshot(input({ paymentMethod: "invoice" }))).includes(
        "card_payment_required",
      ),
    );
  });

  test("requires one coherent dealer and buyer-rank context", () => {
    const result = buildGyeonOrderSnapshot(input({ dealerId: " ", buyerRank: "bad" }));
    const codes = issueCodes(result);
    assert.ok(codes.includes("dealer_context_required"));
    assert.ok(codes.includes("buyer_rank_denied"));
  });

  test("rejects empty lines, blank offer ids, and duplicate offers", () => {
    assert.ok(issueCodes(buildGyeonOrderSnapshot(input({ lines: [] }))).includes("line_required"));
    assert.ok(
      issueCodes(buildGyeonOrderSnapshot(input({ lines: [{ offerId: " ", qty: 2 }] }))).includes(
        "offer_id_required",
      ),
    );
    assert.ok(
      issueCodes(
        buildGyeonOrderSnapshot(
          input({ lines: [{ offerId: "offer-a", qty: 2 }, { offerId: "offer-a", qty: 2 }] }),
        ),
      ).includes("duplicate_offer"),
    );
  });

  test("rejects an absent or identity-mismatched offer", () => {
    assert.ok(
      issueCodes(buildGyeonOrderSnapshot(input({ offersById: {} }))).includes("offer_unavailable"),
    );
    assert.ok(
      issueCodes(
        buildGyeonOrderSnapshot(
          input({ offersById: { "offer-a": offer({ offerId: "offer-b" }) } }),
        ),
      ).includes("offer_unavailable"),
    );
  });

  test("rejects inactive and discontinued products", () => {
    for (const changed of [{ isActive: false }, { isDiscontinued: true }]) {
      const result = buildGyeonOrderSnapshot(
        input({ offersById: { "offer-a": offer(changed) } }),
      );
      assert.ok(issueCodes(result).includes("product_not_sellable"));
    }
  });

  test("rejects rank-ineligible offers", () => {
    const result = buildGyeonOrderSnapshot(
      input({ buyerRank: "shop", offersById: { "offer-a": offer() } }),
    );
    assert.ok(issueCodes(result).includes("rank_denied"));
  });

  test("rejects invalid, below-minimum, and off-unit quantities", () => {
    assert.ok(
      issueCodes(buildGyeonOrderSnapshot(input({ lines: [{ offerId: "offer-a", qty: 0 }] }))).includes(
        "invalid_qty",
      ),
    );
    assert.ok(
      issueCodes(
        buildGyeonOrderSnapshot(
          input({
            lines: [{ offerId: "offer-a", qty: 2 }],
            offersById: { "offer-a": offer({ minOrderQty: 4 }) },
          }),
        ),
      ).includes("below_minimum_qty"),
    );
    assert.ok(
      issueCodes(
        buildGyeonOrderSnapshot(
          input({
            lines: [{ offerId: "offer-a", qty: 3 }],
            offersById: { "offer-a": offer({ orderUnitQty: 2, minOrderQty: 2 }) },
          }),
        ),
      ).includes("invalid_order_unit"),
    );
  });

  test("allows supplier shortage only when backorder is server-authorized", () => {
    const denied = buildGyeonOrderSnapshot(
      input({
        offersById: {
          "offer-a": offer({ supplyAvailability: "out_of_stock", backorderAllowed: false }),
        },
      }),
    );
    assert.ok(issueCodes(denied).includes("backorder_denied"));

    const allowed = buildGyeonOrderSnapshot(
      input({
        offersById: {
          "offer-a": offer({ supplyAvailability: "out_of_stock", backorderAllowed: true }),
        },
      }),
    );
    assert.equal(allowed.ok, true);
  });

  test("malformed authority rows fail instead of being coerced", () => {
    const malformed = [
      offer({ orderUnitQty: 0 }),
      offer({ minOrderQty: 3 }),
      offer({ listPriceIncTaxYen: 9_999 }),
      offer({ unitDiscountIncTaxYen: 99_999 }),
      offer({ taxRateBps: 10_001 }),
      offer({ allowedRanks: [] }),
      offer({ allowedRanks: ["certified", "certified"] }),
      offer({ offerVersion: 0 }),
    ];
    for (const row of malformed) {
      const result = buildGyeonOrderSnapshot(input({ offersById: { "offer-a": row } }));
      assert.ok(issueCodes(result).includes("malformed_offer_authority"));
    }
  });

  test("rejects unsafe yen multiplication instead of losing precision", () => {
    const result = buildGyeonOrderSnapshot(
      input({
        lines: [{ offerId: "offer-a", qty: Number.MAX_SAFE_INTEGER }],
        offersById: {
          "offer-a": offer({ orderUnitQty: 1, minOrderQty: 1 }),
        },
      }),
    );
    assert.ok(issueCodes(result).includes("amount_overflow"));
  });

  test("fingerprint is independent of client line ordering", () => {
    const offers = {
      "offer-a": offer(),
      "offer-b": offer({ offerId: "offer-b", productId: "product-b", sku: "B" }),
    };
    const one = buildGyeonOrderSnapshot(
      input({ lines: [{ offerId: "offer-a", qty: 2 }, { offerId: "offer-b", qty: 2 }], offersById: offers }),
    );
    const two = buildGyeonOrderSnapshot(
      input({ lines: [{ offerId: "offer-b", qty: 2 }, { offerId: "offer-a", qty: 2 }], offersById: offers }),
    );
    assert.equal(one.ok, true);
    assert.equal(two.ok, true);
    if (!one.ok || !two.ok) return;
    assert.equal(one.fingerprintPayload, two.fingerprintPayload);
  });

  test("fingerprint changes when an authority version or payable amount changes", () => {
    const one = buildGyeonOrderSnapshot(input());
    const two = buildGyeonOrderSnapshot(
      input({ offersById: { "offer-a": offer({ offerVersion: 4 }) } }),
    );
    assert.equal(one.ok, true);
    assert.equal(two.ok, true);
    if (!one.ok || !two.ok) return;
    assert.notEqual(one.fingerprintPayload, two.fingerprintPayload);
  });
});

describe("submission idempotency", () => {
  test("requires a nonblank key", () => {
    assert.deepEqual(resolveGyeonOrderSubmission("  ", "fp"), {
      ok: false,
      code: "idempotency_key_required",
    });
    assert.deepEqual(resolveGyeonOrderSubmission("key-1", ""), {
      ok: false,
      code: "fingerprint_required",
    });
  });

  test("new key proceeds and identical replay returns the existing order", () => {
    assert.deepEqual(resolveGyeonOrderSubmission("key-1", "fp"), {
      ok: true,
      replay: false,
    });
    assert.deepEqual(
      resolveGyeonOrderSubmission("key-1", "fp", {
        idempotencyKey: "key-1",
        fingerprintPayload: "fp",
        orderId: "order-1",
      }),
      { ok: true, replay: true, orderId: "order-1" },
    );
  });

  test("same key with another payload fails closed", () => {
    assert.deepEqual(
      resolveGyeonOrderSubmission("key-1", "changed", {
        idempotencyKey: "key-1",
        fingerprintPayload: "fp",
        orderId: "order-1",
      }),
      { ok: false, code: "idempotency_conflict" },
    );
  });
});

describe("shipping-label capture gate", () => {
  const gate = (over: Partial<Parameters<typeof evaluateGyeonCaptureGate>[0]> = {}) =>
    evaluateGyeonCaptureGate({
      status: "fulfilling",
      inspectionComplete: true,
      activeLabelBarcode: "TRACK-001",
      scannedLabelBarcode: "TRACK-001",
      frozenCaptureAmountYen: 20_680,
      authorization: {
        authorizationId: "auth-1",
        amountYen: 20_680,
        authorizedAt: "2026-08-10T00:00:00.000Z",
        expiresAt: "2026-08-12T00:00:00.000Z",
      },
      nowIso: "2026-08-10T01:00:00.000Z",
      ...over,
    });

  test("passes only with fulfillment, inspection, label, amount, and live authorization", () => {
    assert.deepEqual(gate(), {
      ok: true,
      captureAmountYen: 20_680,
      authorizationId: "auth-1",
    });
  });

  test("rejects capture before fulfillment or inspection", () => {
    assert.deepEqual(gate({ status: "approved" }), {
      ok: false,
      code: "fulfillment_status_required",
    });
    assert.deepEqual(gate({ inspectionComplete: false }), {
      ok: false,
      code: "inspection_required",
    });
  });

  test("rejects missing, wrong, or stale label scans", () => {
    assert.deepEqual(gate({ activeLabelBarcode: " " }), {
      ok: false,
      code: "active_label_required",
    });
    assert.deepEqual(gate({ scannedLabelBarcode: "TRACK-OTHER" }), {
      ok: false,
      code: "label_barcode_mismatch",
    });
  });

  test("rejects missing, mismatched, or expired authorization", () => {
    assert.deepEqual(gate({ authorization: null }), {
      ok: false,
      code: "authorization_missing",
    });
    assert.deepEqual(
      gate({ authorization: { authorizationId: "auth-1", amountYen: 1, authorizedAt: "2026-08-10T00:00:00Z", expiresAt: "2026-08-12T00:00:00Z" } }),
      { ok: false, code: "authorization_amount_mismatch" },
    );
    assert.deepEqual(
      gate({ nowIso: "2026-08-11T23:30:00.000Z" }),
      { ok: false, code: "authorization_expired" },
    );
  });

  test("rejects malformed or future authorization timestamps", () => {
    assert.deepEqual(
      gate({
        authorization: {
          authorizationId: "auth-1",
          amountYen: 20_680,
          authorizedAt: "2026-08-11T00:00:00.000Z",
          expiresAt: "2026-08-12T00:00:00.000Z",
        },
      }),
      { ok: false, code: "authorization_timestamp_invalid" },
    );
    assert.deepEqual(gate({ nowIso: "not-a-date" }), {
      ok: false,
      code: "authorization_timestamp_invalid",
    });
  });
});
