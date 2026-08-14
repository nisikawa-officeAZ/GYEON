import assert from "node:assert/strict";
import { describe, it } from "node:test";

function hasOwn(value: unknown, property: PropertyKey): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, property)
  );
}

function assertMatchObject(actual: unknown, expected: unknown): void {
  if (Array.isArray(expected)) {
    assert.deepStrictEqual(actual, expected);
    return;
  }

  if (typeof expected === "object" && expected !== null) {
    assert.ok(typeof actual === "object" && actual !== null);
    for (const [key, value] of Object.entries(expected)) {
      assertMatchObject((actual as Record<string, unknown>)[key], value);
    }
    return;
  }

  assert.deepStrictEqual(actual, expected);
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown): void {
      assert.strictEqual(actual, expected);
    },
    toBeNull(): void {
      assert.strictEqual(actual, null);
    },
    toEqual(expected: unknown): void {
      assert.deepStrictEqual(actual, expected);
    },
    toMatchObject(expected: unknown): void {
      assertMatchObject(actual, expected);
    },
    toThrow(expectedMessage?: string): void {
      assert.strictEqual(typeof actual, "function");
      assert.throws(actual as () => unknown, (error: unknown) => {
        if (!(error instanceof Error)) return false;
        return expectedMessage === undefined || error.message.includes(expectedMessage);
      });
    },
    toHaveProperty(property: PropertyKey): void {
      assert.ok(hasOwn(actual, property));
    },
    not: {
      toBe(expected: unknown): void {
        assert.notStrictEqual(actual, expected);
      },
      toHaveProperty(property: PropertyKey): void {
        assert.ok(!hasOwn(actual, property));
      },
    },
  };
}

import {
  evaluateGyeonMembership,
  authorizeDetailerAgPurchase,
  deriveEcSyncIdentity,
  buildEcIdempotencyKey,
  applyEcAcknowledgement,
  computeEcRetrySchedule,
  reconcileEcDrift,
  applyEcUnpublish,
  resolveEcSellableQuantity,
  type MembershipReadResult,
  type ChannelProductRecord,
  type ProductChannelOffer,
  type EcSyncState,
} from "./office-az-channel-contracts-core.js";

describe("gyeon dealer membership", () => {
  const nowIso = "2026-08-09T00:00:00.000Z";

  function membership(over: Record<string, unknown> = {}) {
    return {
      id: "m1",
      dealerId: "d1",
      programCode: "gyeon_ordering",
      status: "active" as const,
      effectiveFromIso: "2026-01-01T00:00:00.000Z",
      effectiveToIso: null,
      ...over,
    };
  }

  it("denies when missing", () => {
    const result = evaluateGyeonMembership([], "d1", nowIso);
    expect(result).toMatchObject({ ok: false, code: "missing" });
  });

  it("denies when duplicate active memberships exist", () => {
    const read: MembershipReadResult = [membership({ id: "a" }), membership({ id: "b" })];
    const result = evaluateGyeonMembership(read, "d1", nowIso);
    expect(result).toMatchObject({ ok: false, code: "duplicate_active" });
  });

  it("denies a mixed active/revoked duplicate as ambiguous, not as the winning active row", () => {
    const read: MembershipReadResult = [
      membership({ id: "a", status: "active" }),
      membership({ id: "b", status: "revoked" }),
    ];
    const result = evaluateGyeonMembership(read, "d1", nowIso);
    expect(result).toMatchObject({ ok: false, code: "duplicate_active" });
  });

  it("denies a mixed active/suspended duplicate as ambiguous, not as the winning active row", () => {
    const read: MembershipReadResult = [
      membership({ id: "a", status: "active" }),
      membership({ id: "b", status: "suspended" }),
    ];
    const result = evaluateGyeonMembership(read, "d1", nowIso);
    expect(result).toMatchObject({ ok: false, code: "duplicate_active" });
  });

  it("denies when suspended", () => {
    const read: MembershipReadResult = [membership({ status: "suspended" })];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "suspended",
    });
  });

  it("denies when revoked", () => {
    const read: MembershipReadResult = [membership({ status: "revoked" })];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "revoked",
    });
  });

  it("denies when expired", () => {
    const read: MembershipReadResult = [
      membership({ effectiveFromIso: "2020-01-01T00:00:00.000Z", effectiveToIso: "2021-01-01T00:00:00.000Z" }),
    ];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "expired",
    });
  });

  it("denies when not yet effective", () => {
    const read: MembershipReadResult = [
      membership({ effectiveFromIso: "2099-01-01T00:00:00.000Z", effectiveToIso: null }),
    ];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "not_yet_effective",
    });
  });

  it("denies a pending membership even with a currently effective date window", () => {
    const read: MembershipReadResult = [membership({ status: "pending" })];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "pending",
    });
  });

  it("denies an explicit expired-status membership even with a currently effective date window", () => {
    const read: MembershipReadResult = [membership({ status: "expired" })];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "expired",
    });
  });

  it("denies when unreadable", () => {
    expect(evaluateGyeonMembership("read_error", "d1", nowIso)).toMatchObject({
      ok: false,
      code: "unreadable",
    });
  });

  it("allows exactly one active, in-window membership", () => {
    const read: MembershipReadResult = [membership()];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({ ok: true });
  });

  it("denies as missing when the only membership belongs to a different dealer", () => {
    const read: MembershipReadResult = [membership({ dealerId: "some-other-dealer" })];
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "missing",
    });
  });

  it("never lets another dealer's active membership authorize the target dealer", () => {
    const read: MembershipReadResult = [
      membership({ id: "a", dealerId: "d1", status: "active" }),
      membership({ id: "b", dealerId: "d2", status: "active" }),
    ];
    // Each dealer sees exactly its own single active membership — no
    // cross-dealer duplicate ambiguity, and no cross-dealer authorization.
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({ ok: true });
    expect(evaluateGyeonMembership(read, "d2", nowIso)).toMatchObject({ ok: true });
    expect(evaluateGyeonMembership(read, "d3", nowIso)).toMatchObject({
      ok: false,
      code: "missing",
    });
  });

  it("applies duplicate-cardinality only among rows matching the target dealer and program", () => {
    const read: MembershipReadResult = [
      membership({ id: "a", dealerId: "d1", status: "active" }),
      membership({ id: "b", dealerId: "d1", status: "revoked" }),
      membership({ id: "c", dealerId: "d2", status: "active" }),
    ];
    // d1 has two rows (active + revoked) -> ambiguous duplicate for d1.
    expect(evaluateGyeonMembership(read, "d1", nowIso)).toMatchObject({
      ok: false,
      code: "duplicate_active",
    });
    // d2 has exactly one matching row -> authorized, unaffected by d1's rows.
    expect(evaluateGyeonMembership(read, "d2", nowIso)).toMatchObject({ ok: true });
  });
});

describe("detailer ag channel authorization", () => {
  const nowIso = "2026-08-09T00:00:00.000Z";
  const product: ChannelProductRecord = { id: "p1", active: true };
  const baseOffer: ProductChannelOffer = {
    productId: "p1",
    channelCode: "detailer_ag",
    publicationState: "published",
    sellable: true,
    priceExTax: 1000,
    priceIncTax: 1100,
    currency: "JPY",
    taxRatePercent: 10,
    orderUnitQty: 1,
    minimumOrderQty: 1,
    allowedRanks: ["detailer"],
    effectiveFromIso: "2026-01-01T00:00:00.000Z",
    effectiveToIso: null,
    availabilityPolicy: "always",
    version: 1,
  };
  const authorizedMembership = evaluateGyeonMembership(
    [
      {
        id: "m1",
        dealerId: "d1",
        programCode: "gyeon_ordering",
        status: "active",
        effectiveFromIso: "2026-01-01T00:00:00.000Z",
        effectiveToIso: null,
      },
    ],
    "d1",
    nowIso,
  );

  it("denies when only publication is true but membership is missing", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: baseOffer,
      membershipEvaluation: evaluateGyeonMembership([], "d1", nowIso),
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "membership_denied" });
  });

  it("denies when the sellable checkbox is on but the offer is not published", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, publicationState: "draft" },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "offer_not_published" });
  });

  it("denies every non-published state in the exact I2 four-value publication contract", () => {
    for (const publicationState of ["draft", "unpublished", "tombstoned"] as const) {
      const result = authorizeDetailerAgPurchase({
        product,
        offer: { ...baseOffer, publicationState },
        membershipEvaluation: authorizedMembership,
        buyerRank: "detailer",
        requestedQty: 1,
        nowIso,
      });
      expect(result).toMatchObject({ ok: false, code: "offer_not_published" });
    }
  });

  it("denies a disallowed rank", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: baseOffer,
      membershipEvaluation: authorizedMembership,
      buyerRank: "retail",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "rank_not_allowed" });
  });

  it("denies an invalid order unit/minimum", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, orderUnitQty: 5, minimumOrderQty: 5 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 3,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_unit_or_minimum" });
  });

  it("denies outside the effective time window", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, effectiveFromIso: "2099-01-01T00:00:00.000Z" },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "not_effective" });
  });

  it("denies an unconfigured availability policy", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, availabilityPolicy: "not_configured" },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "availability_not_configured" });
  });

  it("authorizes and returns a server-derived snapshot when every gate passes", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: baseOffer,
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.priceExTax).toBe(1000);
      expect(result.snapshot.priceIncTax).toBe(1100);
      expect(result.snapshot.currency).toBe("JPY");
      expect(result.snapshot.taxRatePercent).toBe(10);
      expect(result.snapshot.orderUnitQty).toBe(1);
      expect(result.snapshot.minimumOrderQty).toBe(1);
      expect(result.snapshot.productId).toBe("p1");
      expect(result.snapshot.channelCode).toBe("detailer_ag");
      expect(result.snapshot.offerVersion).toBe(1);
    }
  });

  it("denies when offer.productId does not match the reloaded product id", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, productId: "some-other-product" },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "offer_product_mismatch" });
  });

  it("fails closed on a non-finite or negative ex-tax offer price", () => {
    const nonFinite = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, priceExTax: Number.NaN },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(nonFinite).toMatchObject({ ok: false, code: "invalid_offer_price_ex_tax" });

    const negative = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, priceExTax: -1 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(negative).toMatchObject({ ok: false, code: "invalid_offer_price_ex_tax" });
  });

  it("fails closed on a non-finite or negative inc-tax offer price", () => {
    const nonFinite = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, priceIncTax: Number.NaN },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(nonFinite).toMatchObject({ ok: false, code: "invalid_offer_price_inc_tax" });

    const negative = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, priceIncTax: -1 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(negative).toMatchObject({ ok: false, code: "invalid_offer_price_inc_tax" });
  });

  it("fails closed when inc-tax price is below ex-tax price", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, priceExTax: 1000, priceIncTax: 900 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_offer_price_inc_below_ex_tax" });
  });

  it("fails closed on a blank offer currency", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, currency: "   " },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_offer_currency" });
  });

  it("fails closed on a non-finite or out-of-range offer tax rate", () => {
    const nonFinite = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, taxRatePercent: Number.POSITIVE_INFINITY },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(nonFinite).toMatchObject({ ok: false, code: "invalid_offer_tax_rate" });

    const outOfRange = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, taxRatePercent: -5 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(outOfRange).toMatchObject({ ok: false, code: "invalid_offer_tax_rate" });
  });

  it("fails closed on a nonpositive or noninteger offer version", () => {
    const zero = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, version: 0 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(zero).toMatchObject({ ok: false, code: "invalid_offer_version" });

    const fractional = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, version: 1.5 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(fractional).toMatchObject({ ok: false, code: "invalid_offer_version" });
  });

  it("fails closed on an empty allowed ranks list", () => {
    const result = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, allowedRanks: [] },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(result).toMatchObject({ ok: false, code: "no_allowed_ranks" });
  });

  it("fails closed on an invalid offer-level unit/minimum configuration", () => {
    const nonPositiveUnit = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, orderUnitQty: 0 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(nonPositiveUnit).toMatchObject({ ok: false, code: "invalid_offer_unit_or_minimum" });

    const fractionalMinimum = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, minimumOrderQty: 1.5 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 1,
      nowIso,
    });
    expect(fractionalMinimum).toMatchObject({ ok: false, code: "invalid_offer_unit_or_minimum" });

    const minimumNotDivisible = authorizeDetailerAgPurchase({
      product,
      offer: { ...baseOffer, orderUnitQty: 3, minimumOrderQty: 4 },
      membershipEvaluation: authorizedMembership,
      buyerRank: "detailer",
      requestedQty: 3,
      nowIso,
    });
    expect(minimumNotDivisible).toMatchObject({ ok: false, code: "invalid_offer_unit_or_minimum" });
  });
});

describe("ec sync identity, keys, acks, retry, drift, tombstone", () => {
  it("gives every product an ec sync identity even when unpublished", () => {
    const identity = deriveEcSyncIdentity("p-unpublished");
    expect(identity.ecSyncId).toBe("ec-sync:p-unpublished");
  });

  it("builds a stable idempotency key per aggregate version", () => {
    const key1 = buildEcIdempotencyKey({
      productId: "p1",
      channelCode: "detailer_ag",
      aggregateVersion: 3,
      operation: "upsert",
    });
    const key2 = buildEcIdempotencyKey({
      productId: "p1",
      channelCode: "detailer_ag",
      aggregateVersion: 3,
      operation: "upsert",
    });
    expect(key1).toBe(key2);
    const key3 = buildEcIdempotencyKey({
      productId: "p1",
      channelCode: "detailer_ag",
      aggregateVersion: 4,
      operation: "upsert",
    });
    expect(key3).not.toBe(key1);
  });

  it("rejects a zero or negative aggregate version, matching the SQL version > 0 constraint", () => {
    expect(() =>
      buildEcIdempotencyKey({
        productId: "p1",
        channelCode: "detailer_ag",
        aggregateVersion: 0,
        operation: "upsert",
      }),
    ).toThrow("invalid_aggregate_version");
    expect(() =>
      buildEcIdempotencyKey({
        productId: "p1",
        channelCode: "detailer_ag",
        aggregateVersion: -1,
        operation: "upsert",
      }),
    ).toThrow("invalid_aggregate_version");
  });

  it("rejects a stale acknowledgement", () => {
    const state: EcSyncState = {
      productId: "p1",
      channelCode: "detailer_ag",
      desiredVersion: 5,
      desiredHash: "h5",
      lastAcknowledgedVersion: 4,
      lastAcknowledgedHash: "h4",
    };
    const result = applyEcAcknowledgement(state, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 4,
      acknowledgedHash: "h4",
    });
    expect(result).toMatchObject({ ok: false, code: "stale_ack" });
  });

  it("accepts a newer acknowledgement that matches the current desired version/hash", () => {
    const state: EcSyncState = {
      productId: "p1",
      channelCode: "detailer_ag",
      desiredVersion: 5,
      desiredHash: "h5",
      lastAcknowledgedVersion: 4,
      lastAcknowledgedHash: "h4",
    };
    const result = applyEcAcknowledgement(state, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 5,
      acknowledgedHash: "h5",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.lastAcknowledgedVersion).toBe(5);
    }
  });

  it("bounds retry attempts and marks exhaustion", () => {
    const scheduled = computeEcRetrySchedule(2, { baseDelayMs: 100, maxAttempts: 3 });
    expect(scheduled.exhausted).toBe(false);
    expect(scheduled.delayMs).toBe(200);
    const dead = computeEcRetrySchedule(4, { baseDelayMs: 100, maxAttempts: 3 });
    expect(dead.exhausted).toBe(true);
  });

  it("rejects nonpositive or noninteger baseDelayMs/maxDelayMs/maxAttempts", () => {
    expect(() => computeEcRetrySchedule(1, { baseDelayMs: 0 })).toThrow("invalid_base_delay_ms");
    expect(() => computeEcRetrySchedule(1, { baseDelayMs: 1.5 })).toThrow("invalid_base_delay_ms");
    expect(() => computeEcRetrySchedule(1, { maxDelayMs: 0 })).toThrow("invalid_max_delay_ms");
    expect(() => computeEcRetrySchedule(1, { maxDelayMs: -1 })).toThrow("invalid_max_delay_ms");
    expect(() => computeEcRetrySchedule(1, { maxAttempts: 0 })).toThrow("invalid_max_attempts");
    expect(() => computeEcRetrySchedule(1, { maxAttempts: 2.5 })).toThrow("invalid_max_attempts");
  });

  it("rejects a maxDelayMs below baseDelayMs", () => {
    expect(() =>
      computeEcRetrySchedule(1, { baseDelayMs: 1000, maxDelayMs: 500 }),
    ).toThrow("max_delay_ms_below_base_delay_ms");
  });

  it("reconciles drift on version-behind, version-ahead, and hash mismatch", () => {
    const behind = reconcileEcDrift({
      productId: "p1",
      channelCode: "detailer_ag",
      desiredVersion: 3,
      desiredHash: "h3",
      lastAcknowledgedVersion: 2,
      lastAcknowledgedHash: "h2",
    });
    expect(behind).toMatchObject({ drifted: true, reason: "version_behind" });

    const ahead = reconcileEcDrift({
      productId: "p1",
      channelCode: "detailer_ag",
      desiredVersion: 3,
      desiredHash: "h3",
      lastAcknowledgedVersion: 4,
      lastAcknowledgedHash: "h4",
    });
    expect(ahead).toMatchObject({ drifted: true, reason: "version_ahead" });

    const mismatched = reconcileEcDrift({
      productId: "p1",
      channelCode: "detailer_ag",
      desiredVersion: 3,
      desiredHash: "h3",
      lastAcknowledgedVersion: 3,
      lastAcknowledgedHash: "wrong",
    });
    expect(mismatched).toMatchObject({ drifted: true, reason: "hash_mismatch" });

    const clean = reconcileEcDrift({
      productId: "p1",
      channelCode: "detailer_ag",
      desiredVersion: 3,
      desiredHash: "h3",
      lastAcknowledgedVersion: 3,
      lastAcknowledgedHash: "h3",
    });
    expect(clean).toEqual({ drifted: false });
  });

  it("is idempotent on repeated unpublish/tombstone", () => {
    const first = applyEcUnpublish(
      { productId: "p1", channelCode: "detailer_ag", tombstoned: false, tombstonedAtIso: null },
      "2026-08-09T00:00:00.000Z",
    );
    const second = applyEcUnpublish(first, "2026-08-10T00:00:00.000Z");
    expect(second).toEqual(first);
  });

  it("returns NOT_CONFIGURED with no quantity for the unresolved ec location policy", () => {
    const result = resolveEcSellableQuantity("not_configured");
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.quantity).toBeNull();
  });
});

describe("ec ack version/hash lock semantics", () => {
  const desiredState: EcSyncState = {
    productId: "p1",
    channelCode: "detailer_ag",
    desiredVersion: 5,
    desiredHash: "h5",
    lastAcknowledgedVersion: null,
    lastAcknowledgedHash: null,
  };

  it("rejects a nonpositive, noninteger, or nonfinite desired version before comparison", () => {
    const zero = applyEcAcknowledgement(
      { ...desiredState, desiredVersion: 0 },
      { productId: "p1", channelCode: "detailer_ag", acknowledgedVersion: 5, acknowledgedHash: "h5" },
    );
    expect(zero).toMatchObject({ ok: false, code: "invalid_version" });

    const fractional = applyEcAcknowledgement(
      { ...desiredState, desiredVersion: 1.5 },
      { productId: "p1", channelCode: "detailer_ag", acknowledgedVersion: 5, acknowledgedHash: "h5" },
    );
    expect(fractional).toMatchObject({ ok: false, code: "invalid_version" });

    const nonFinite = applyEcAcknowledgement(
      { ...desiredState, desiredVersion: Number.POSITIVE_INFINITY },
      { productId: "p1", channelCode: "detailer_ag", acknowledgedVersion: 5, acknowledgedHash: "h5" },
    );
    expect(nonFinite).toMatchObject({ ok: false, code: "invalid_version" });
  });

  it("rejects a nonpositive, noninteger, or nonfinite acknowledged version before comparison", () => {
    const zero = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 0,
      acknowledgedHash: "h5",
    });
    expect(zero).toMatchObject({ ok: false, code: "invalid_version" });

    const fractional = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 1.5,
      acknowledgedHash: "h5",
    });
    expect(fractional).toMatchObject({ ok: false, code: "invalid_version" });

    const nonFinite = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: Number.NaN,
      acknowledgedHash: "h5",
    });
    expect(nonFinite).toMatchObject({ ok: false, code: "invalid_version" });
  });

  it("rejects a stale desired version even with no prior acknowledgement", () => {
    const result = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 4,
      acknowledgedHash: "h4",
    });
    expect(result).toMatchObject({ ok: false, code: "stale_ack" });
  });

  it("rejects an acknowledgement ahead of the current desired version", () => {
    const result = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 6,
      acknowledgedHash: "h6",
    });
    expect(result).toMatchObject({ ok: false, code: "ahead_ack" });
  });

  it("rejects an acknowledgement at the current version with the wrong hash", () => {
    const result = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 5,
      acknowledgedHash: "wrong-hash",
    });
    expect(result).toMatchObject({ ok: false, code: "hash_mismatch" });
  });

  it("accepts a correct acknowledgement at the current desired version/hash, idempotently", () => {
    const first = applyEcAcknowledgement(desiredState, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 5,
      acknowledgedHash: "h5",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.lastAcknowledgedVersion).toBe(5);
    expect(first.state.lastAcknowledgedHash).toBe("h5");

    const replay = applyEcAcknowledgement(first.state, {
      productId: "p1",
      channelCode: "detailer_ag",
      acknowledgedVersion: 5,
      acknowledgedHash: "h5",
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.state.lastAcknowledgedVersion).toBe(5);
      expect(replay.state.lastAcknowledgedHash).toBe("h5");
    }
  });
});
