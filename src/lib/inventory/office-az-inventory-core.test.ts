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
  OFFICE_AZ_LOCATION_CODES,
  deriveProductTotal,
  applyInventoryTransfer,
  applyInventoryAdjustment,
  acquireStocktakeLocationLock,
  finalizeStocktake as finalizeOfficeAzStocktake,
  type OfficeAzLocationBalances,
} from "./office-az-inventory-core.js";

const zeroBalances = (): OfficeAzLocationBalances => ({
  gyeon_logistics_center: 0,
  gyeon_studio: 0,
  office_az_store: 0,
});

describe("office az inventory: locations and derived total", () => {
  it("has exactly three fixed locations", () => {
    expect(OFFICE_AZ_LOCATION_CODES).toEqual([
      "gyeon_logistics_center",
      "gyeon_studio",
      "office_az_store",
    ]);
  });

  it("derives total only as the sum of the three locations", () => {
    const balances: OfficeAzLocationBalances = {
      gyeon_logistics_center: 3,
      gyeon_studio: 5,
      office_az_store: 2,
    };
    expect(deriveProductTotal(balances)).toBe(10);
  });

  it("rejects a balances object with an extra unapproved key", () => {
    const withExtra = {
      gyeon_logistics_center: 1,
      gyeon_studio: 1,
      office_az_store: 1,
      warehouse_x: 1,
    } as unknown as OfficeAzLocationBalances;
    expect(() => deriveProductTotal(withExtra)).toThrow("invalid_balances_shape");
  });

  it("rejects a balances object missing an approved location key", () => {
    const missingOne = {
      gyeon_logistics_center: 1,
      gyeon_studio: 1,
    } as unknown as OfficeAzLocationBalances;
    expect(() => deriveProductTotal(missingOne)).toThrow("invalid_balances_shape");
  });
});

describe("inventory transfer", () => {
  const base: OfficeAzLocationBalances = {
    gyeon_logistics_center: 10,
    gyeon_studio: 0,
    office_az_store: 0,
  };

  it("preserves total on a valid transfer", () => {
    const before = deriveProductTotal(base);
    const result = applyInventoryTransfer(base, {
      idempotencyKey: "key-1",
      productId: "p1",
      fromLocation: "gyeon_logistics_center",
      toLocation: "gyeon_studio",
      qty: 4,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(deriveProductTotal(result.balances)).toBe(before);
      expect(result.balances.gyeon_logistics_center).toBe(6);
      expect(result.balances.gyeon_studio).toBe(4);
      expect(result.replay).toBe(false);
    }
  });

  it("rejects a same-location transfer", () => {
    const result = applyInventoryTransfer(base, {
      idempotencyKey: "key-2",
      productId: "p1",
      fromLocation: "gyeon_studio",
      toLocation: "gyeon_studio",
      qty: 1,
    });
    expect(result).toMatchObject({ ok: false, code: "same_location" });
  });

  it("rejects non-positive and non-integer qty", () => {
    const zero = applyInventoryTransfer(base, {
      idempotencyKey: "key-3",
      productId: "p1",
      fromLocation: "gyeon_logistics_center",
      toLocation: "gyeon_studio",
      qty: 0,
    });
    expect(zero).toMatchObject({ ok: false, code: "invalid_qty" });

    const fractional = applyInventoryTransfer(base, {
      idempotencyKey: "key-4",
      productId: "p1",
      fromLocation: "gyeon_logistics_center",
      toLocation: "gyeon_studio",
      qty: 1.5,
    });
    expect(fractional).toMatchObject({ ok: false, code: "invalid_qty" });
  });

  it("rejects insufficient stock", () => {
    const result = applyInventoryTransfer(base, {
      idempotencyKey: "key-5",
      productId: "p1",
      fromLocation: "gyeon_studio",
      toLocation: "office_az_store",
      qty: 1,
    });
    expect(result).toMatchObject({ ok: false, code: "insufficient_stock" });
  });

  it("rejects an unknown location", () => {
    const result = applyInventoryTransfer(base, {
      idempotencyKey: "key-6",
      productId: "p1",
      fromLocation: "gyeon_logistics_center",
      toLocation: "warehouse_x",
      qty: 1,
    });
    expect(result).toMatchObject({ ok: false, code: "unknown_location" });
  });

  it("is idempotent on identical replay and fails closed on a conflicting duplicate", () => {
    const request = {
      idempotencyKey: "key-7",
      productId: "p1",
      fromLocation: "gyeon_logistics_center" as const,
      toLocation: "gyeon_studio" as const,
      qty: 2,
    };
    const first = applyInventoryTransfer(base, request);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = applyInventoryTransfer(base, request, first.record);
    expect(replay).toMatchObject({ ok: true, replay: true });
    if (replay.ok) {
      expect(replay.balances).toEqual(first.balances);
    }

    const conflicting = applyInventoryTransfer(
      base,
      { ...request, qty: 3 },
      first.record,
    );
    expect(conflicting).toMatchObject({ ok: false, code: "idempotency_conflict" });
  });
});

describe("inventory adjustment", () => {
  const stocked: OfficeAzLocationBalances = { ...zeroBalances(), office_az_store: 5 };

  it("requires a nonblank reason", () => {
    const result = applyInventoryAdjustment(stocked, {
      idempotencyKey: "adj-1",
      productId: "p1",
      locationCode: "office_az_store",
      kind: "loss",
      deltaQty: -1,
      reason: "   ",
    });
    expect(result).toMatchObject({ ok: false, code: "reason_required" });
  });

  it("never lets loss/damage/shrinkage/disposal masquerade as a transfer", () => {
    const result = applyInventoryAdjustment(stocked, {
      idempotencyKey: "adj-2",
      productId: "p1",
      locationCode: "office_az_store",
      kind: "damage",
      deltaQty: -2,
      reason: "破損",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.movement.movementType).toBe("inventory_adjustment");
      expect(result.record.movement).not.toHaveProperty("direction");
      expect(result.record.movement).not.toHaveProperty("counterpartyLocation");
    }
  });

  it("rejects a positive delta for decrease-only kinds", () => {
    const result = applyInventoryAdjustment(stocked, {
      idempotencyKey: "adj-3",
      productId: "p1",
      locationCode: "office_az_store",
      kind: "shrinkage",
      deltaQty: 2,
      reason: "in error",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "decrease_only_kind_requires_negative_delta",
    });
  });
});

describe("stocktake finalize", () => {
  it("is a single-location absolute overwrite and leaves other locations unchanged", () => {
    const balancesByProduct: Record<string, OfficeAzLocationBalances> = {
      p1: { gyeon_logistics_center: 3, gyeon_studio: 7, office_az_store: 2 },
      p2: { gyeon_logistics_center: 1, gyeon_studio: 0, office_az_store: 9 },
    };
    const result = finalizeOfficeAzStocktake(
      "session-1",
      "gyeon_studio",
      ["p1", "p2"],
      [
        { productId: "p1", countedQty: 6 },
        { productId: "p2", countedQty: 0 },
      ],
      balancesByProduct,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.balancesByProduct.p1).toEqual({
        gyeon_logistics_center: 3,
        gyeon_studio: 6,
        office_az_store: 2,
      });
      expect(result.balancesByProduct.p2!.gyeon_logistics_center).toBe(1);
      expect(result.balancesByProduct.p2!.office_az_store).toBe(9);
      const variance = result.movements.find((m) => m.productId === "p1")!;
      expect(variance.varianceQty).toBe(-1);
      expect(result.sessionStatus).toBe("finalized");
      expect(result.locationLockReleased).toBe(true);
    }
  });

  it("denies finalize when count lines are incomplete (missing lines are not zero)", () => {
    const balancesByProduct: Record<string, OfficeAzLocationBalances> = {
      p1: zeroBalances(),
      p2: zeroBalances(),
    };
    const result = finalizeOfficeAzStocktake(
      "session-2",
      "office_az_store",
      ["p1", "p2"],
      [{ productId: "p1", countedQty: 0 }],
      balancesByProduct,
    );
    expect(result).toMatchObject({ ok: false, code: "incomplete_count" });
  });

  it("acquires a fail-closed one-location-per-session lock", () => {
    const first = acquireStocktakeLocationLock([], "s1", "gyeon_studio");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = acquireStocktakeLocationLock([first.lock], "s2", "gyeon_studio");
    expect(second).toMatchObject({ ok: false, code: "location_already_locked" });
  });
});
