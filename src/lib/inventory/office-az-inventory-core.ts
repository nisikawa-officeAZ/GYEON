/**
 * Office AZ internal inventory pool (ADR 0012) — pure, no DB.
 *
 * Sole inventory owner: Office AZ. `dealer_stock_levels` must never be a source
 * for this pool. Exactly three fixed locations exist; the global product total
 * is derived (sum of those three) and is never independently writable.
 */

export const OFFICE_AZ_LOCATION_CODES = [
  "gyeon_logistics_center",
  "gyeon_studio",
  "office_az_store",
] as const;

export type OfficeAzLocationCode = (typeof OFFICE_AZ_LOCATION_CODES)[number];

export const OFFICE_AZ_LOCATION_LABELS: Record<OfficeAzLocationCode, string> = {
  gyeon_logistics_center: "GYEON ロジスティックセンター",
  gyeon_studio: "GYEON スタジオ",
  office_az_store: "オフィスアズ店舗",
};

export function isOfficeAzLocationCode(
  value: string,
): value is OfficeAzLocationCode {
  return (OFFICE_AZ_LOCATION_CODES as readonly string[]).includes(value);
}

export function assertOfficeAzLocationCode(
  value: string,
): asserts value is OfficeAzLocationCode {
  if (!isOfficeAzLocationCode(value)) {
    throw new Error(`unknown_location:${value}`);
  }
}

export type OfficeAzLocationBalances = Record<OfficeAzLocationCode, number>;

export function isNonNegativeIntegerBalance(qty: number): boolean {
  return Number.isInteger(qty) && qty >= 0;
}

export function assertNonNegativeIntegerBalance(qty: number): void {
  if (!isNonNegativeIntegerBalance(qty)) {
    throw new Error("invalid_balance_qty");
  }
}

/**
 * Runtime shape guard: exactly the three fixed location keys, no more, no fewer.
 * A balances object read from an untrusted or drifted source must never be treated
 * as valid just because it happens to have the right keys present among extras.
 */
export function isExactOfficeAzLocationBalances(
  value: Record<string, unknown>,
): value is OfficeAzLocationBalances {
  const keys = Object.keys(value);
  if (keys.length !== OFFICE_AZ_LOCATION_CODES.length) return false;
  return OFFICE_AZ_LOCATION_CODES.every((code) =>
    Object.prototype.hasOwnProperty.call(value, code),
  );
}

export function assertExactOfficeAzLocationBalances(
  value: Record<string, unknown>,
): asserts value is OfficeAzLocationBalances {
  if (!isExactOfficeAzLocationBalances(value)) {
    throw new Error("invalid_balances_shape");
  }
}

/** Derived product total: sum of exactly the three fixed locations. Never independently writable. */
export function deriveProductTotal(balances: OfficeAzLocationBalances): number {
  assertExactOfficeAzLocationBalances(balances);
  let total = 0;
  for (const code of OFFICE_AZ_LOCATION_CODES) {
    const qty = balances[code];
    assertNonNegativeIntegerBalance(qty);
    total += qty;
  }
  return total;
}

/** Deterministic pairwise lock order (lexicographic) so opposing transfers never deadlock. */
export function transferLockOrder(
  a: OfficeAzLocationCode,
  b: OfficeAzLocationCode,
): [OfficeAzLocationCode, OfficeAzLocationCode] {
  return a < b ? [a, b] : [b, a];
}

export interface InventoryTransferRequest {
  idempotencyKey: string;
  productId: string;
  fromLocation: string;
  toLocation: string;
  qty: number;
}

export interface InventoryTransferMovement {
  movementType: "inventory_transfer";
  movementId: string;
  idempotencyKey: string;
  productId: string;
  locationCode: OfficeAzLocationCode;
  direction: "out" | "in";
  counterpartyLocation: OfficeAzLocationCode;
  qty: number;
}

export interface AppliedInventoryTransfer {
  idempotencyKey: string;
  requestFingerprint: string;
  productId: string;
  fromLocation: OfficeAzLocationCode;
  toLocation: OfficeAzLocationCode;
  qty: number;
  balancesAfter: OfficeAzLocationBalances;
  movements: [InventoryTransferMovement, InventoryTransferMovement];
}

export type InventoryTransferDenialCode =
  | "invalid_idempotency_key"
  | "idempotency_conflict"
  | "unknown_location"
  | "same_location"
  | "invalid_qty"
  | "insufficient_stock";

export type InventoryTransferResult =
  | {
      ok: true;
      replay: boolean;
      balances: OfficeAzLocationBalances;
      record: AppliedInventoryTransfer;
    }
  | { ok: false; code: InventoryTransferDenialCode; message: string };

export function inventoryTransferFingerprint(request: {
  productId: string;
  fromLocation: string;
  toLocation: string;
  qty: number;
}): string {
  return [
    request.productId,
    request.fromLocation,
    request.toLocation,
    request.qty,
  ].join("|");
}

function buildTransferMovements(
  idempotencyKey: string,
  productId: string,
  fromLocation: OfficeAzLocationCode,
  toLocation: OfficeAzLocationCode,
  qty: number,
): [InventoryTransferMovement, InventoryTransferMovement] {
  return [
    {
      movementType: "inventory_transfer",
      movementId: `${idempotencyKey}:out`,
      idempotencyKey,
      productId,
      locationCode: fromLocation,
      direction: "out",
      counterpartyLocation: toLocation,
      qty,
    },
    {
      movementType: "inventory_transfer",
      movementId: `${idempotencyKey}:in`,
      idempotencyKey,
      productId,
      locationCode: toLocation,
      direction: "in",
      counterpartyLocation: fromLocation,
      qty,
    },
  ];
}

/**
 * Apply, or idempotently replay, a transfer between two of the three fixed locations.
 * `previousApplication`, when supplied, is the prior committed row for this idempotency
 * key (server responsibility: unique index on idempotencyKey, one server transaction).
 * An identical replay is a no-op; the same key with a conflicting payload fails closed.
 */
export function applyInventoryTransfer(
  balances: OfficeAzLocationBalances,
  request: InventoryTransferRequest,
  previousApplication?: AppliedInventoryTransfer | null,
): InventoryTransferResult {
  const idempotencyKey = request.idempotencyKey.trim();
  if (!idempotencyKey) {
    return {
      ok: false,
      code: "invalid_idempotency_key",
      message: "idempotency key must be nonblank",
    };
  }

  const fingerprint = inventoryTransferFingerprint(request);

  if (previousApplication) {
    if (previousApplication.idempotencyKey !== idempotencyKey) {
      throw new Error("previousApplication_key_mismatch");
    }
    if (previousApplication.requestFingerprint !== fingerprint) {
      return {
        ok: false,
        code: "idempotency_conflict",
        message: "idempotency key reused with a different payload",
      };
    }
    return {
      ok: true,
      replay: true,
      balances: previousApplication.balancesAfter,
      record: previousApplication,
    };
  }

  if (
    !isOfficeAzLocationCode(request.fromLocation) ||
    !isOfficeAzLocationCode(request.toLocation)
  ) {
    return {
      ok: false,
      code: "unknown_location",
      message: "location must be one of the three fixed Office AZ locations",
    };
  }
  const fromLocation = request.fromLocation;
  const toLocation = request.toLocation;
  if (fromLocation === toLocation) {
    return {
      ok: false,
      code: "same_location",
      message: "source and destination must be different approved locations",
    };
  }
  if (!Number.isInteger(request.qty) || request.qty <= 0) {
    return {
      ok: false,
      code: "invalid_qty",
      message: "qty must be a positive integer",
    };
  }
  assertNonNegativeIntegerBalance(balances[fromLocation]);
  assertNonNegativeIntegerBalance(balances[toLocation]);
  if (balances[fromLocation] < request.qty) {
    return {
      ok: false,
      code: "insufficient_stock",
      message: "source balance cannot go negative",
    };
  }

  const totalBefore = deriveProductTotal(balances);
  const balancesAfter: OfficeAzLocationBalances = {
    ...balances,
    [fromLocation]: balances[fromLocation] - request.qty,
    [toLocation]: balances[toLocation] + request.qty,
  };
  const totalAfter = deriveProductTotal(balancesAfter);
  if (totalAfter !== totalBefore) {
    throw new Error("transfer_total_invariant_violated");
  }

  const movements = buildTransferMovements(
    idempotencyKey,
    request.productId,
    fromLocation,
    toLocation,
    request.qty,
  );
  const record: AppliedInventoryTransfer = {
    idempotencyKey,
    requestFingerprint: fingerprint,
    productId: request.productId,
    fromLocation,
    toLocation,
    qty: request.qty,
    balancesAfter,
    movements,
  };
  return { ok: true, replay: false, balances: balancesAfter, record };
}

export const INVENTORY_ADJUSTMENT_KINDS = [
  "loss",
  "damage",
  "shrinkage",
  "disposal",
  "correction",
] as const;

export type InventoryAdjustmentKind = (typeof INVENTORY_ADJUSTMENT_KINDS)[number];

/** loss / damage / shrinkage / disposal may only ever decrease stock; correction may go either way. */
function isDecreaseOnlyAdjustmentKind(kind: InventoryAdjustmentKind): boolean {
  return kind !== "correction";
}

export interface InventoryAdjustmentRequest {
  idempotencyKey: string;
  productId: string;
  locationCode: string;
  kind: InventoryAdjustmentKind;
  deltaQty: number;
  reason: string;
}

export interface InventoryAdjustmentMovement {
  movementType: "inventory_adjustment";
  movementId: string;
  idempotencyKey: string;
  productId: string;
  locationCode: OfficeAzLocationCode;
  kind: InventoryAdjustmentKind;
  deltaQty: number;
  reason: string;
  qtyBefore: number;
  qtyAfter: number;
}

export interface AppliedInventoryAdjustment {
  idempotencyKey: string;
  requestFingerprint: string;
  productId: string;
  locationCode: OfficeAzLocationCode;
  balancesAfter: OfficeAzLocationBalances;
  movement: InventoryAdjustmentMovement;
}

export type InventoryAdjustmentDenialCode =
  | "invalid_idempotency_key"
  | "idempotency_conflict"
  | "unknown_location"
  | "reason_required"
  | "invalid_delta_qty"
  | "decrease_only_kind_requires_negative_delta"
  | "insufficient_stock";

export type InventoryAdjustmentResult =
  | {
      ok: true;
      replay: boolean;
      balances: OfficeAzLocationBalances;
      record: AppliedInventoryAdjustment;
    }
  | { ok: false; code: InventoryAdjustmentDenialCode; message: string };

export function inventoryAdjustmentFingerprint(request: {
  productId: string;
  locationCode: string;
  kind: string;
  deltaQty: number;
  reason: string;
}): string {
  return [
    request.productId,
    request.locationCode,
    request.kind,
    request.deltaQty,
    request.reason.trim(),
  ].join("|");
}

/**
 * Explicit adjustment (loss / damage / shrinkage / disposal / correction). This is a
 * structurally distinct movement type from a transfer and can never masquerade as one:
 * it has no counterpart location and always requires a nonblank reason.
 */
export function applyInventoryAdjustment(
  balances: OfficeAzLocationBalances,
  request: InventoryAdjustmentRequest,
  previousApplication?: AppliedInventoryAdjustment | null,
): InventoryAdjustmentResult {
  const idempotencyKey = request.idempotencyKey.trim();
  if (!idempotencyKey) {
    return {
      ok: false,
      code: "invalid_idempotency_key",
      message: "idempotency key must be nonblank",
    };
  }
  const reason = request.reason.trim();
  const fingerprint = inventoryAdjustmentFingerprint({ ...request, reason });

  if (previousApplication) {
    if (previousApplication.idempotencyKey !== idempotencyKey) {
      throw new Error("previousApplication_key_mismatch");
    }
    if (previousApplication.requestFingerprint !== fingerprint) {
      return {
        ok: false,
        code: "idempotency_conflict",
        message: "idempotency key reused with a different payload",
      };
    }
    return {
      ok: true,
      replay: true,
      balances: previousApplication.balancesAfter,
      record: previousApplication,
    };
  }

  if (!reason) {
    return {
      ok: false,
      code: "reason_required",
      message: "adjustment reason must be nonblank",
    };
  }
  if (!isOfficeAzLocationCode(request.locationCode)) {
    return {
      ok: false,
      code: "unknown_location",
      message: "location must be one of the three fixed Office AZ locations",
    };
  }
  const locationCode = request.locationCode;
  if (!Number.isInteger(request.deltaQty) || request.deltaQty === 0) {
    return {
      ok: false,
      code: "invalid_delta_qty",
      message: "deltaQty must be a nonzero integer",
    };
  }
  if (isDecreaseOnlyAdjustmentKind(request.kind) && request.deltaQty > 0) {
    return {
      ok: false,
      code: "decrease_only_kind_requires_negative_delta",
      message: `${request.kind} adjustments must never increase stock`,
    };
  }
  assertNonNegativeIntegerBalance(balances[locationCode]);
  const qtyBefore = balances[locationCode];
  const qtyAfter = qtyBefore + request.deltaQty;
  if (qtyAfter < 0) {
    return {
      ok: false,
      code: "insufficient_stock",
      message: "adjustment cannot drive balance negative",
    };
  }

  const balancesAfter: OfficeAzLocationBalances = {
    ...balances,
    [locationCode]: qtyAfter,
  };
  const movement: InventoryAdjustmentMovement = {
    movementType: "inventory_adjustment",
    movementId: `${idempotencyKey}:adjustment`,
    idempotencyKey,
    productId: request.productId,
    locationCode,
    kind: request.kind,
    deltaQty: request.deltaQty,
    reason,
    qtyBefore,
    qtyAfter,
  };
  const record: AppliedInventoryAdjustment = {
    idempotencyKey,
    requestFingerprint: fingerprint,
    productId: request.productId,
    locationCode,
    balancesAfter,
    movement,
  };
  return { ok: true, replay: false, balances: balancesAfter, record };
}

export interface StocktakeSessionLock {
  sessionId: string;
  locationCode: OfficeAzLocationCode;
}

export type StocktakeLockDenialCode =
  | "unknown_location"
  | "location_already_locked"
  | "session_already_active";

export type StocktakeLockResult =
  | { ok: true; lock: StocktakeSessionLock }
  | { ok: false; code: StocktakeLockDenialCode; message: string };

/**
 * Fail-closed lock: an active session may hold exactly one location, and a location may
 * be held by exactly one active session.
 */
export function acquireStocktakeLocationLock(
  activeLocks: StocktakeSessionLock[],
  sessionId: string,
  locationCode: string,
): StocktakeLockResult {
  if (!isOfficeAzLocationCode(locationCode)) {
    return {
      ok: false,
      code: "unknown_location",
      message: "stocktake must scope to one of the three fixed locations",
    };
  }
  if (activeLocks.some((lock) => lock.sessionId === sessionId)) {
    return {
      ok: false,
      code: "session_already_active",
      message: "session already holds an active location lock",
    };
  }
  if (activeLocks.some((lock) => lock.locationCode === locationCode)) {
    return {
      ok: false,
      code: "location_already_locked",
      message: "location already has an active stocktake session",
    };
  }
  return { ok: true, lock: { sessionId, locationCode } };
}

export interface StocktakeCountLine {
  productId: string;
  countedQty: number;
}

export interface StocktakeAdjustmentMovement {
  movementType: "stocktake_adjustment";
  movementId: string;
  sessionId: string;
  productId: string;
  locationCode: OfficeAzLocationCode;
  qtyBefore: number;
  countedQty: number;
  varianceQty: number;
}

export type StocktakeFinalizeDenialCode =
  | "unknown_location"
  | "incomplete_count"
  | "unexpected_product_in_count"
  | "duplicate_product_line"
  | "invalid_counted_qty";

export type StocktakeFinalizeResult =
  | {
      ok: true;
      balancesByProduct: Record<string, OfficeAzLocationBalances>;
      movements: StocktakeAdjustmentMovement[];
      /** Explicit pure-layer confirmation that the session is closed and its location lock is released. */
      sessionStatus: "finalized";
      locationLockReleased: true;
    }
  | { ok: false; code: StocktakeFinalizeDenialCode; message: string };

/**
 * Absolute overwrite of the scoped location only, from a complete count. Missing lines
 * for any expected product deny finalize rather than silently becoming zero. Products'
 * balances at every other location are returned unchanged.
 */
export function finalizeStocktake(
  sessionId: string,
  locationCode: string,
  expectedProductIds: string[],
  countLines: StocktakeCountLine[],
  balancesByProduct: Record<string, OfficeAzLocationBalances>,
): StocktakeFinalizeResult {
  if (!isOfficeAzLocationCode(locationCode)) {
    return {
      ok: false,
      code: "unknown_location",
      message: "stocktake must scope to one of the three fixed locations",
    };
  }

  const expected = new Set(expectedProductIds);
  const seen = new Set<string>();
  for (const line of countLines) {
    if (seen.has(line.productId)) {
      return {
        ok: false,
        code: "duplicate_product_line",
        message: `duplicate counted line for ${line.productId}`,
      };
    }
    seen.add(line.productId);
    if (!expected.has(line.productId)) {
      return {
        ok: false,
        code: "unexpected_product_in_count",
        message: `${line.productId} is not in the stocktake scope`,
      };
    }
    if (!isNonNegativeIntegerBalance(line.countedQty)) {
      return {
        ok: false,
        code: "invalid_counted_qty",
        message: `invalid counted qty for ${line.productId}`,
      };
    }
  }
  for (const productId of expected) {
    if (!seen.has(productId)) {
      return {
        ok: false,
        code: "incomplete_count",
        message: `missing counted line for ${productId}`,
      };
    }
  }

  const nextBalancesByProduct: Record<string, OfficeAzLocationBalances> = {
    ...balancesByProduct,
  };
  const movements: StocktakeAdjustmentMovement[] = [];
  for (const line of countLines) {
    const currentBalances = balancesByProduct[line.productId];
    if (!currentBalances) {
      throw new Error(`missing_balance_row:${line.productId}`);
    }
    const qtyBefore = currentBalances[locationCode];
    assertNonNegativeIntegerBalance(qtyBefore);
    const varianceQty = line.countedQty - qtyBefore;
    nextBalancesByProduct[line.productId] = {
      ...currentBalances,
      [locationCode]: line.countedQty,
    };
    movements.push({
      movementType: "stocktake_adjustment",
      movementId: `${sessionId}:${line.productId}`,
      sessionId,
      productId: line.productId,
      locationCode,
      qtyBefore,
      countedQty: line.countedQty,
      varianceQty,
    });
  }

  return {
    ok: true,
    balancesByProduct: nextBalancesByProduct,
    movements,
    sessionStatus: "finalized",
    locationLockReleased: true,
  };
}
