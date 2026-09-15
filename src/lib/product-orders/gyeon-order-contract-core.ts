/**
 * GYEON product-order V1 contract — pure, deterministic, no DB or network.
 *
 * This module defines the authority boundary that the later RPC/UI adapters
 * must obey. Client input may name an offer and quantity, but it never supplies
 * price, product identity, buyer rank, sellability, shipping, or payment amount.
 */

export const GYEON_ORDER_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "fulfilling",
  "fulfilled",
  "cancelled",
] as const;

export type GyeonOrderStatus = (typeof GYEON_ORDER_STATUSES)[number];
export type GyeonOrderDealerRole = "owner" | "manager" | "staff" | "readonly";
export type GyeonBuyerRank = "shop" | "detailer" | "ppf_installer" | "certified";

export type GyeonDealerOrderAction =
  | "view"
  | "create"
  | "edit"
  | "submit"
  | "cancel"
  | "reorder";

const DEALER_ROLE_ACTIONS: Record<
  GyeonOrderDealerRole,
  readonly GyeonDealerOrderAction[]
> = {
  owner: ["view", "create", "edit", "submit", "cancel", "reorder"],
  manager: ["view", "create", "edit", "submit", "cancel", "reorder"],
  staff: ["view", "create", "edit", "submit", "reorder"],
  readonly: ["view"],
};

export function canDealerPerformOrderAction(
  role: GyeonOrderDealerRole,
  action: GyeonDealerOrderAction,
): boolean {
  return DEALER_ROLE_ACTIONS[role].includes(action);
}

export type GyeonOrderTransitionDenial =
  | "same_status"
  | "dealer_role_denied"
  | "operator_inactive"
  | "transition_denied"
  | "shipment_evidence_required"
  | "capture_evidence_required"
  | "cannot_cancel_after_shipment_or_capture";

export type GyeonOrderTransitionResult =
  | { ok: true }
  | { ok: false; code: GyeonOrderTransitionDenial };

export type GyeonOrderTransitionActor =
  | { kind: "dealer"; role: GyeonOrderDealerRole }
  | { kind: "operator"; active: boolean };

export interface EvaluateGyeonOrderTransitionInput {
  from: GyeonOrderStatus;
  to: GyeonOrderStatus;
  actor: GyeonOrderTransitionActor;
  shipmentConfirmed?: boolean;
  paymentCaptured?: boolean;
}

/**
 * Canonical six-state transition policy.
 *
 * Dealer staff may submit; only owner/manager may cancel. GYEON operator
 * authority is separate from dealer authority. Fulfillment completion requires
 * both shipping and capture evidence. V1 does not permit partial fulfillment.
 */
export function evaluateGyeonOrderTransition(
  input: EvaluateGyeonOrderTransitionInput,
): GyeonOrderTransitionResult {
  if (input.from === input.to) return { ok: false, code: "same_status" };

  if (input.actor.kind === "dealer") {
    if (input.from === "draft" && input.to === "submitted") {
      return canDealerPerformOrderAction(input.actor.role, "submit")
        ? { ok: true }
        : { ok: false, code: "dealer_role_denied" };
    }

    if (
      (input.from === "draft" || input.from === "submitted") &&
      input.to === "cancelled"
    ) {
      return canDealerPerformOrderAction(input.actor.role, "cancel")
        ? { ok: true }
        : { ok: false, code: "dealer_role_denied" };
    }

    return { ok: false, code: "transition_denied" };
  }

  if (!input.actor.active) return { ok: false, code: "operator_inactive" };

  if (input.from === "submitted" && input.to === "approved") return { ok: true };
  if (input.from === "approved" && input.to === "fulfilling") return { ok: true };

  if (input.from === "approved" && input.to === "cancelled") return { ok: true };
  if (input.from === "fulfilling" && input.to === "cancelled") {
    if (input.shipmentConfirmed || input.paymentCaptured) {
      return { ok: false, code: "cannot_cancel_after_shipment_or_capture" };
    }
    return { ok: true };
  }

  if (input.from === "fulfilling" && input.to === "fulfilled") {
    if (!input.shipmentConfirmed) {
      return { ok: false, code: "shipment_evidence_required" };
    }
    if (!input.paymentCaptured) {
      return { ok: false, code: "capture_evidence_required" };
    }
    return { ok: true };
  }

  return { ok: false, code: "transition_denied" };
}

const RANK_ALIASES: Readonly<Record<string, GyeonBuyerRank>> = {
  shop: "shop",
  detailer: "detailer",
  ppf_installer: "ppf_installer",
  certified: "certified",
  certified_detailer: "certified",
  gyeon_ppf_installer: "ppf_installer",
  gyeon_certified_detailer: "certified",
};

/** Unknown, blank, or wrong-case rank values deny rather than falling back. */
export function normalizeGyeonBuyerRank(value: unknown): GyeonBuyerRank | null {
  return typeof value === "string" ? (RANK_ALIASES[value] ?? null) : null;
}

export type GyeonSupplyAvailability =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "unknown";

export interface GyeonOrderOfferAuthority {
  offerId: string;
  productId: string;
  sku: string;
  productName: string;
  isActive: boolean;
  isDiscontinued: boolean;
  allowedRanks: readonly GyeonBuyerRank[];
  orderUnitQty: number;
  minOrderQty: number;
  listPriceExTaxYen: number;
  listPriceIncTaxYen: number;
  unitDiscountExTaxYen: number;
  unitDiscountIncTaxYen: number;
  taxRateBps: number;
  supplyAvailability: GyeonSupplyAvailability;
  backorderAllowed: boolean;
  offerVersion: number;
}

export interface GyeonOrderLineRequest {
  offerId: string;
  qty: number;
}

export interface GyeonOrderLineSnapshot {
  offerId: string;
  offerVersion: number;
  productId: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  buyerRankSnapshot: GyeonBuyerRank;
  qty: number;
  orderUnitQtySnapshot: number;
  listPriceExTaxYenSnapshot: number;
  listPriceIncTaxYenSnapshot: number;
  unitDiscountExTaxYenSnapshot: number;
  unitDiscountIncTaxYenSnapshot: number;
  taxRateBpsSnapshot: number;
  lineListSubtotalIncTaxYen: number;
  linePayableSubtotalIncTaxYen: number;
  supplyAvailabilitySnapshot: GyeonSupplyAvailability;
  backorderAllowedSnapshot: boolean;
}

export const GYEON_FREE_SHIPPING_THRESHOLD_YEN = 30_000;
export const GYEON_FREE_SHIPPING_BASIS =
  "list_price_inc_tax_before_discount" as const;
export const GYEON_PAYMENT_METHOD = "card" as const;

export interface BuildGyeonOrderSnapshotInput {
  dealerId: string;
  buyerRank: unknown;
  paymentMethod: unknown;
  lines: readonly GyeonOrderLineRequest[];
  offersById: Readonly<Record<string, GyeonOrderOfferAuthority>>;
  shippingZoneCode: string;
  /** Server-resolved fee. Null means no matching valid shipping rule. */
  underThresholdShippingFeeYen: number | null;
  notes?: string | null;
  freeShippingThresholdYen?: number;
}

export type GyeonOrderSnapshotIssueCode =
  | "dealer_context_required"
  | "buyer_rank_denied"
  | "card_payment_required"
  | "line_required"
  | "offer_id_required"
  | "duplicate_offer"
  | "offer_unavailable"
  | "malformed_offer_authority"
  | "product_not_sellable"
  | "rank_denied"
  | "invalid_qty"
  | "below_minimum_qty"
  | "invalid_order_unit"
  | "backorder_denied"
  | "shipping_zone_required"
  | "shipping_fee_unresolved"
  | "invalid_shipping_fee"
  | "invalid_free_shipping_threshold"
  | "amount_overflow"
  | "notes_too_long";

export interface GyeonOrderSnapshotIssue {
  code: GyeonOrderSnapshotIssueCode;
  offerId?: string;
}

export interface GyeonOrderSnapshot {
  dealerId: string;
  buyerRankSnapshot: GyeonBuyerRank;
  paymentMethod: typeof GYEON_PAYMENT_METHOD;
  lines: readonly GyeonOrderLineSnapshot[];
  freeShippingBasis: typeof GYEON_FREE_SHIPPING_BASIS;
  freeShippingThresholdYen: number;
  shippingBasisYen: number;
  shippingZoneCode: string;
  shippingFeeYen: number;
  freeShipping: boolean;
  productSubtotalIncTaxYen: number;
  payableAmountYen: number;
  notes: string | null;
}

export type BuildGyeonOrderSnapshotResult =
  | { ok: true; snapshot: GyeonOrderSnapshot; fingerprintPayload: string }
  | { ok: false; issues: readonly GyeonOrderSnapshotIssue[] };

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function safeYenProduct(unitYen: number, qty: number): number | null {
  const total = unitYen * qty;
  return isNonNegativeInteger(total) ? total : null;
}

function safeYenSum(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!isNonNegativeInteger(total)) return null;
  }
  return total;
}

function isValidOfferAuthority(offer: GyeonOrderOfferAuthority): boolean {
  if (!offer.offerId.trim() || !offer.productId.trim()) return false;
  if (!offer.sku.trim() || !offer.productName.trim()) return false;
  if (!isPositiveInteger(offer.orderUnitQty)) return false;
  if (!isPositiveInteger(offer.minOrderQty)) return false;
  if (offer.minOrderQty % offer.orderUnitQty !== 0) return false;
  if (!isPositiveInteger(offer.offerVersion)) return false;
  if (!isNonNegativeInteger(offer.listPriceExTaxYen)) return false;
  if (!isNonNegativeInteger(offer.listPriceIncTaxYen)) return false;
  if (offer.listPriceIncTaxYen < offer.listPriceExTaxYen) return false;
  if (!isNonNegativeInteger(offer.unitDiscountExTaxYen)) return false;
  if (!isNonNegativeInteger(offer.unitDiscountIncTaxYen)) return false;
  if (offer.unitDiscountExTaxYen > offer.listPriceExTaxYen) return false;
  if (offer.unitDiscountIncTaxYen > offer.listPriceIncTaxYen) return false;
  if (!isNonNegativeInteger(offer.taxRateBps) || offer.taxRateBps > 10_000) {
    return false;
  }
  if (offer.allowedRanks.length === 0) return false;
  if (new Set(offer.allowedRanks).size !== offer.allowedRanks.length) return false;
  return offer.allowedRanks.every((rank) => normalizeGyeonBuyerRank(rank) === rank);
}

function normalizedNotes(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** Stable canonical payload; the DB layer may hash this exact UTF-8 string. */
export function gyeonOrderFingerprintPayload(snapshot: GyeonOrderSnapshot): string {
  return JSON.stringify({
    dealerId: snapshot.dealerId,
    buyerRank: snapshot.buyerRankSnapshot,
    paymentMethod: snapshot.paymentMethod,
    lines: [...snapshot.lines]
      .sort((a, b) => a.offerId.localeCompare(b.offerId))
      .map((line) => ({
        offerId: line.offerId,
        offerVersion: line.offerVersion,
        productId: line.productId,
        sku: line.skuSnapshot,
        productName: line.productNameSnapshot,
        qty: line.qty,
        orderUnitQty: line.orderUnitQtySnapshot,
        listPriceExTaxYen: line.listPriceExTaxYenSnapshot,
        listPriceIncTaxYen: line.listPriceIncTaxYenSnapshot,
        unitDiscountExTaxYen: line.unitDiscountExTaxYenSnapshot,
        unitDiscountIncTaxYen: line.unitDiscountIncTaxYenSnapshot,
        taxRateBps: line.taxRateBpsSnapshot,
        supplyAvailability: line.supplyAvailabilitySnapshot,
        backorderAllowed: line.backorderAllowedSnapshot,
      })),
    shipping: {
      basis: snapshot.freeShippingBasis,
      thresholdYen: snapshot.freeShippingThresholdYen,
      basisYen: snapshot.shippingBasisYen,
      zoneCode: snapshot.shippingZoneCode,
      feeYen: snapshot.shippingFeeYen,
    },
    payableAmountYen: snapshot.payableAmountYen,
    notes: snapshot.notes,
  });
}

/**
 * Reloads all authority from `offersById`, validates it, and creates an immutable
 * server snapshot. Client-submitted price/name/SKU fields do not exist here.
 */
export function buildGyeonOrderSnapshot(
  input: BuildGyeonOrderSnapshotInput,
): BuildGyeonOrderSnapshotResult {
  const issues: GyeonOrderSnapshotIssue[] = [];
  const dealerId = input.dealerId.trim();
  const rank = normalizeGyeonBuyerRank(input.buyerRank);
  const zoneCode = input.shippingZoneCode.trim();
  const notes = normalizedNotes(input.notes);
  const threshold =
    input.freeShippingThresholdYen ?? GYEON_FREE_SHIPPING_THRESHOLD_YEN;

  if (!dealerId) issues.push({ code: "dealer_context_required" });
  if (!rank) issues.push({ code: "buyer_rank_denied" });
  if (input.paymentMethod !== GYEON_PAYMENT_METHOD) {
    issues.push({ code: "card_payment_required" });
  }
  if (input.lines.length === 0) issues.push({ code: "line_required" });
  if (!zoneCode) issues.push({ code: "shipping_zone_required" });
  if (!isPositiveInteger(threshold)) {
    issues.push({ code: "invalid_free_shipping_threshold" });
  }
  if (notes != null && notes.length > 1_000) issues.push({ code: "notes_too_long" });

  const seenOffers = new Set<string>();
  const snapshots: GyeonOrderLineSnapshot[] = [];

  for (const request of input.lines) {
    const offerId = request.offerId.trim();
    if (!offerId) {
      issues.push({ code: "offer_id_required" });
      continue;
    }
    if (seenOffers.has(offerId)) {
      issues.push({ code: "duplicate_offer", offerId });
      continue;
    }
    seenOffers.add(offerId);

    const offer = input.offersById[offerId];
    if (!offer || offer.offerId !== offerId) {
      issues.push({ code: "offer_unavailable", offerId });
      continue;
    }
    if (!isValidOfferAuthority(offer)) {
      issues.push({ code: "malformed_offer_authority", offerId });
      continue;
    }
    if (!offer.isActive || offer.isDiscontinued) {
      issues.push({ code: "product_not_sellable", offerId });
      continue;
    }
    if (!rank || !offer.allowedRanks.includes(rank)) {
      issues.push({ code: "rank_denied", offerId });
      continue;
    }
    if (!isPositiveInteger(request.qty)) {
      issues.push({ code: "invalid_qty", offerId });
      continue;
    }
    if (request.qty < offer.minOrderQty) {
      issues.push({ code: "below_minimum_qty", offerId });
      continue;
    }
    if (request.qty % offer.orderUnitQty !== 0) {
      issues.push({ code: "invalid_order_unit", offerId });
      continue;
    }
    if (
      (offer.supplyAvailability === "out_of_stock" ||
        offer.supplyAvailability === "unknown") &&
      !offer.backorderAllowed
    ) {
      issues.push({ code: "backorder_denied", offerId });
      continue;
    }

    const lineListSubtotalIncTaxYen = safeYenProduct(
      offer.listPriceIncTaxYen,
      request.qty,
    );
    const linePayableSubtotalIncTaxYen = safeYenProduct(
      offer.listPriceIncTaxYen - offer.unitDiscountIncTaxYen,
      request.qty,
    );
    if (
      lineListSubtotalIncTaxYen == null ||
      linePayableSubtotalIncTaxYen == null
    ) {
      issues.push({ code: "amount_overflow", offerId });
      continue;
    }

    snapshots.push({
      offerId,
      offerVersion: offer.offerVersion,
      productId: offer.productId,
      skuSnapshot: offer.sku,
      productNameSnapshot: offer.productName,
      buyerRankSnapshot: rank,
      qty: request.qty,
      orderUnitQtySnapshot: offer.orderUnitQty,
      listPriceExTaxYenSnapshot: offer.listPriceExTaxYen,
      listPriceIncTaxYenSnapshot: offer.listPriceIncTaxYen,
      unitDiscountExTaxYenSnapshot: offer.unitDiscountExTaxYen,
      unitDiscountIncTaxYenSnapshot: offer.unitDiscountIncTaxYen,
      taxRateBpsSnapshot: offer.taxRateBps,
      lineListSubtotalIncTaxYen,
      linePayableSubtotalIncTaxYen,
      supplyAvailabilitySnapshot: offer.supplyAvailability,
      backorderAllowedSnapshot: offer.backorderAllowed,
    });
  }

  if (issues.length > 0 || !rank || !isPositiveInteger(threshold)) {
    return { ok: false, issues };
  }

  const lines = snapshots.sort((a, b) => a.offerId.localeCompare(b.offerId));
  const shippingBasisYen = safeYenSum(
    lines.map((line) => line.lineListSubtotalIncTaxYen),
  );
  const productSubtotalIncTaxYen = safeYenSum(
    lines.map((line) => line.linePayableSubtotalIncTaxYen),
  );
  if (shippingBasisYen == null || productSubtotalIncTaxYen == null) {
    return { ok: false, issues: [{ code: "amount_overflow" }] };
  }
  const freeShipping = shippingBasisYen >= threshold;

  let shippingFeeYen: number;
  if (freeShipping) {
    shippingFeeYen = 0;
  } else if (input.underThresholdShippingFeeYen == null) {
    return { ok: false, issues: [{ code: "shipping_fee_unresolved" }] };
  } else if (!isNonNegativeInteger(input.underThresholdShippingFeeYen)) {
    return { ok: false, issues: [{ code: "invalid_shipping_fee" }] };
  } else {
    shippingFeeYen = input.underThresholdShippingFeeYen;
  }

  const payableAmountYen = safeYenSum([productSubtotalIncTaxYen, shippingFeeYen]);
  if (payableAmountYen == null) {
    return { ok: false, issues: [{ code: "amount_overflow" }] };
  }

  const snapshot: GyeonOrderSnapshot = {
    dealerId,
    buyerRankSnapshot: rank,
    paymentMethod: GYEON_PAYMENT_METHOD,
    lines,
    freeShippingBasis: GYEON_FREE_SHIPPING_BASIS,
    freeShippingThresholdYen: threshold,
    shippingBasisYen,
    shippingZoneCode: zoneCode,
    shippingFeeYen,
    freeShipping,
    productSubtotalIncTaxYen,
    payableAmountYen,
    notes,
  };

  return {
    ok: true,
    snapshot,
    fingerprintPayload: gyeonOrderFingerprintPayload(snapshot),
  };
}

export interface PreviousGyeonOrderSubmission {
  idempotencyKey: string;
  fingerprintPayload: string;
  orderId: string;
}

export type ResolveGyeonSubmissionResult =
  | { ok: true; replay: false }
  | { ok: true; replay: true; orderId: string }
  | {
      ok: false;
      code:
        | "idempotency_key_required"
        | "fingerprint_required"
        | "idempotency_conflict";
    };

export function resolveGyeonOrderSubmission(
  idempotencyKeyInput: string,
  fingerprintPayload: string,
  previous?: PreviousGyeonOrderSubmission | null,
): ResolveGyeonSubmissionResult {
  const idempotencyKey = idempotencyKeyInput.trim();
  if (!idempotencyKey) return { ok: false, code: "idempotency_key_required" };
  if (!fingerprintPayload) return { ok: false, code: "fingerprint_required" };
  if (!previous) return { ok: true, replay: false };
  if (previous.idempotencyKey !== idempotencyKey) {
    throw new Error("previous_submission_key_mismatch");
  }
  if (previous.fingerprintPayload !== fingerprintPayload) {
    return { ok: false, code: "idempotency_conflict" };
  }
  return { ok: true, replay: true, orderId: previous.orderId };
}

export interface GyeonPaymentAuthorization {
  authorizationId: string;
  amountYen: number;
  authorizedAt: string;
  expiresAt: string;
}

export type GyeonCaptureGateDenial =
  | "fulfillment_status_required"
  | "inspection_required"
  | "active_label_required"
  | "label_barcode_mismatch"
  | "capture_amount_invalid"
  | "authorization_missing"
  | "authorization_id_required"
  | "authorization_amount_mismatch"
  | "authorization_timestamp_invalid"
  | "authorization_expired";

export type GyeonCaptureGateResult =
  | { ok: true; captureAmountYen: number; authorizationId: string }
  | { ok: false; code: GyeonCaptureGateDenial };

export interface EvaluateGyeonCaptureGateInput {
  status: GyeonOrderStatus;
  inspectionComplete: boolean;
  activeLabelBarcode: string | null;
  scannedLabelBarcode: string | null;
  frozenCaptureAmountYen: number;
  authorization: GyeonPaymentAuthorization | null;
  nowIso: string;
  expiryBufferMs?: number;
}

/** Capture may begin only after the active shipping-label barcode is confirmed. */
export function evaluateGyeonCaptureGate(
  input: EvaluateGyeonCaptureGateInput,
): GyeonCaptureGateResult {
  if (input.status !== "fulfilling") {
    return { ok: false, code: "fulfillment_status_required" };
  }
  if (!input.inspectionComplete) return { ok: false, code: "inspection_required" };

  const active = input.activeLabelBarcode?.trim() ?? "";
  const scanned = input.scannedLabelBarcode?.trim() ?? "";
  if (!active) return { ok: false, code: "active_label_required" };
  if (!scanned || scanned !== active) {
    return { ok: false, code: "label_barcode_mismatch" };
  }
  if (!isNonNegativeInteger(input.frozenCaptureAmountYen)) {
    return { ok: false, code: "capture_amount_invalid" };
  }
  if (!input.authorization) return { ok: false, code: "authorization_missing" };

  const authorizationId = input.authorization.authorizationId.trim();
  if (!authorizationId) {
    return { ok: false, code: "authorization_id_required" };
  }
  if (input.authorization.amountYen !== input.frozenCaptureAmountYen) {
    return { ok: false, code: "authorization_amount_mismatch" };
  }

  const now = Date.parse(input.nowIso);
  const authorizedAt = Date.parse(input.authorization.authorizedAt);
  const expires = Date.parse(input.authorization.expiresAt);
  const buffer = input.expiryBufferMs ?? 60 * 60 * 1_000;
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(authorizedAt) ||
    !Number.isFinite(expires) ||
    authorizedAt > now ||
    expires <= authorizedAt ||
    !isNonNegativeInteger(buffer)
  ) {
    return { ok: false, code: "authorization_timestamp_invalid" };
  }
  if (
    expires - buffer <= now
  ) {
    return { ok: false, code: "authorization_expired" };
  }

  return {
    ok: true,
    captureAmountYen: input.frozenCaptureAmountYen,
    authorizationId,
  };
}
