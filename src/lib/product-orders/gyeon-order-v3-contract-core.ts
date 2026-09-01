/**
 * GYEON dealer ordering V3 pure business contract.
 *
 * This module is deliberately side-effect free. It performs no DB, Supabase,
 * payment-provider, bank, email, inventory, or clock access. Callers must supply
 * server-owned facts. Unknown or unresolved facts fail closed.
 */

export const GYEON_ORDER_V3_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "fulfilling",
  "fulfilled",
  "cancelled",
] as const;

export type GyeonOrderV3Status = (typeof GYEON_ORDER_V3_STATUSES)[number];
export type DealerOrderRole = "owner" | "manager" | "staff" | "readonly";
export type DealerOrderAction =
  | "view"
  | "create_draft"
  | "edit_before_warehouse_acceptance"
  | "request_owner_review"
  | "final_submit"
  | "cancel_before_warehouse_acceptance"
  | "reorder";

const DEALER_ROLE_ACTIONS: Readonly<Record<DealerOrderRole, readonly DealerOrderAction[]>> = {
  owner: [
    "view",
    "create_draft",
    "edit_before_warehouse_acceptance",
    "final_submit",
    "cancel_before_warehouse_acceptance",
    "reorder",
  ],
  manager: [
    "view",
    "create_draft",
    "edit_before_warehouse_acceptance",
    "request_owner_review",
    "reorder",
  ],
  staff: [
    "view",
    "create_draft",
    "edit_before_warehouse_acceptance",
    "request_owner_review",
    "reorder",
  ],
  readonly: ["view"],
};

export function canDealerPerformV3Action(
  role: DealerOrderRole,
  action: DealerOrderAction,
): boolean {
  return DEALER_ROLE_ACTIONS[role].includes(action);
}

export type OwnerReviewState =
  | "not_requested"
  | "pending"
  | "changes_requested"
  | "owner_confirmed";

export type OwnerReviewEvent = "request" | "request_changes" | "confirm" | "commercial_edit";

export type OwnerReviewDecision =
  | { ok: true; next: OwnerReviewState }
  | {
      ok: false;
      code: "review_role_denied" | "review_transition_denied" | "order_not_draft";
    };

export function transitionOwnerReview(input: {
  current: OwnerReviewState;
  event: OwnerReviewEvent;
  actorRole: DealerOrderRole;
  orderStatus: GyeonOrderV3Status;
}): OwnerReviewDecision {
  if (input.orderStatus !== "draft") return { ok: false, code: "order_not_draft" };

  if (input.event === "commercial_edit") {
    if (!canDealerPerformV3Action(input.actorRole, "edit_before_warehouse_acceptance")) {
      return { ok: false, code: "review_role_denied" };
    }
    return { ok: true, next: "not_requested" };
  }

  if (input.event === "request") {
    if (!canDealerPerformV3Action(input.actorRole, "request_owner_review")) {
      return { ok: false, code: "review_role_denied" };
    }
    if (input.current !== "not_requested" && input.current !== "changes_requested") {
      return { ok: false, code: "review_transition_denied" };
    }
    return { ok: true, next: "pending" };
  }

  if (input.actorRole !== "owner") return { ok: false, code: "review_role_denied" };
  if (input.current !== "pending") return { ok: false, code: "review_transition_denied" };

  return input.event === "confirm"
    ? { ok: true, next: "owner_confirmed" }
    : { ok: true, next: "changes_requested" };
}

export type OrderTransitionActor =
  | { kind: "dealer"; role: DealerOrderRole }
  | { kind: "warehouse" }
  | { kind: "system" };

export type OrderTransitionDecision =
  | { ok: true }
  | {
      ok: false;
      code:
        | "role_denied"
        | "transition_denied"
        | "owner_confirmation_required"
        | "required_order_data_missing"
        | "qualification_not_met"
        | "warehouse_release_not_ready"
        | "fulfillment_obligations_incomplete";
    };

/** The six-state aggregate excludes review, payment, BO, shipment, and PDF states. */
export function canTransitionGyeonOrderV3(input: {
  from: GyeonOrderV3Status;
  to: GyeonOrderV3Status;
  actor: OrderTransitionActor;
  ownerConfirmed?: boolean;
  requiredOrderDataComplete?: boolean;
  qualificationMet?: boolean;
  warehouseReleaseReady?: boolean;
  fulfillmentObligationsComplete?: boolean;
}): OrderTransitionDecision {
  if (input.actor.kind === "dealer") {
    if (input.from === "draft" && input.to === "submitted") {
      if (!canDealerPerformV3Action(input.actor.role, "final_submit")) {
        return { ok: false, code: "role_denied" };
      }
      if (!input.ownerConfirmed) return { ok: false, code: "owner_confirmation_required" };
      if (!input.requiredOrderDataComplete) {
        return { ok: false, code: "required_order_data_missing" };
      }
      if (!input.qualificationMet) return { ok: false, code: "qualification_not_met" };
      return { ok: true };
    }

    if (
      (input.from === "draft" || input.from === "submitted") &&
      input.to === "cancelled"
    ) {
      return canDealerPerformV3Action(
        input.actor.role,
        "cancel_before_warehouse_acceptance",
      )
        ? { ok: true }
        : { ok: false, code: "role_denied" };
    }

    return { ok: false, code: "transition_denied" };
  }

  if (input.actor.kind === "warehouse") {
    if (input.from === "submitted" && input.to === "approved") {
      return input.warehouseReleaseReady
        ? { ok: true }
        : { ok: false, code: "warehouse_release_not_ready" };
    }
    if (input.from === "approved" && input.to === "fulfilling") return { ok: true };
    if (input.from === "fulfilling" && input.to === "fulfilled") {
      return input.fulfillmentObligationsComplete
        ? { ok: true }
        : { ok: false, code: "fulfillment_obligations_incomplete" };
    }
    return { ok: false, code: "transition_denied" };
  }

  return { ok: false, code: "transition_denied" };
}

export function isCommercialOrderEditable(status: GyeonOrderV3Status): boolean {
  return status === "draft" || status === "submitted";
}

export const GYEON_FREE_SHIPPING_THRESHOLD_EX_TAX_YEN = 30_000;

export interface ShippingQuoteLine {
  quantity: number;
  listPriceExTaxYen: number | null;
  isPromotionalGood: boolean;
}

export type ShippingQuote =
  | {
      ok: true;
      basis: "list_price_ex_tax_before_discount_excluding_promotional_goods";
      thresholdYen: number;
      shippingBasisExTaxYen: number;
      freeShipping: boolean;
      shippingFeeYen: number;
    }
  | {
      ok: false;
      code:
        | "invalid_quantity"
        | "price_unset"
        | "invalid_price"
        | "amount_overflow"
        | "shipping_fee_unresolved"
        | "invalid_shipping_fee";
    };

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function quoteGyeonOrderV3Shipping(input: {
  lines: readonly ShippingQuoteLine[];
  underThresholdShippingFeeYen: number | null;
  thresholdYen?: number;
}): ShippingQuote {
  const threshold = input.thresholdYen ?? GYEON_FREE_SHIPPING_THRESHOLD_EX_TAX_YEN;
  if (!isSafeNonNegativeInteger(threshold) || threshold === 0) {
    return { ok: false, code: "invalid_price" };
  }

  let basis = 0;
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      return { ok: false, code: "invalid_quantity" };
    }
    if (line.listPriceExTaxYen == null) return { ok: false, code: "price_unset" };
    if (!isSafeNonNegativeInteger(line.listPriceExTaxYen)) {
      return { ok: false, code: "invalid_price" };
    }
    if (line.isPromotionalGood) continue;
    const lineAmount = line.listPriceExTaxYen * line.quantity;
    if (!Number.isSafeInteger(lineAmount) || !Number.isSafeInteger(basis + lineAmount)) {
      return { ok: false, code: "amount_overflow" };
    }
    basis += lineAmount;
  }

  const freeShipping = basis >= threshold;
  if (freeShipping) {
    return {
      ok: true,
      basis: "list_price_ex_tax_before_discount_excluding_promotional_goods",
      thresholdYen: threshold,
      shippingBasisExTaxYen: basis,
      freeShipping: true,
      shippingFeeYen: 0,
    };
  }

  if (input.underThresholdShippingFeeYen == null) {
    return { ok: false, code: "shipping_fee_unresolved" };
  }
  if (!isSafeNonNegativeInteger(input.underThresholdShippingFeeYen)) {
    return { ok: false, code: "invalid_shipping_fee" };
  }
  return {
    ok: true,
    basis: "list_price_ex_tax_before_discount_excluding_promotional_goods",
    thresholdYen: threshold,
    shippingBasisExTaxYen: basis,
    freeShipping: false,
    shippingFeeYen: input.underThresholdShippingFeeYen,
  };
}

export type GyeonOrderPaymentMethod =
  | "card"
  | "bank_transfer_prepaid"
  | "cash_on_delivery"
  | "credit_account";
export type BackorderShippingPolicy = "ship_available_first" | "ship_when_complete";

/**
 * Structured, server-owned evidence of an external-authority (PSP, bank)
 * fact. A caller-owned boolean cannot prove purpose, order binding, amount,
 * currency, or freshness, so warehouse release and refund decisions consume
 * and validate this shape instead of trusting an asserted flag.
 */
export type ExternalEvidencePurpose =
  | "full_payment_charge"
  | "bank_payment_match"
  | "inventory_reservation"
  | "refund";

export type ExternalEvidenceState = "pending" | "succeeded" | "failed" | "voided";

export interface ExternalAuthorityEvidence {
  id: string;
  authority: "server_verified" | "unverified";
  provider: string;
  providerEventId: string;
  purpose: ExternalEvidencePurpose;
  state: ExternalEvidenceState;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  amountIncTaxYen: number;
  currency: string;
  serverVerifiedAtIso: string;
  expiresAtIso: string;
  consumedAtIso: string | null;
}

export interface ExternalEvidenceExpectation {
  purpose: ExternalEvidencePurpose;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  amountIncTaxYen: number;
  currency: "JPY";
  nowIso: string;
}

export type ExternalEvidenceValidation =
  | { ok: true; evidenceId: string }
  | {
      ok: false;
      code:
        | "evidence_missing"
        | "evidence_invalid"
        | "evidence_not_server_verified"
        | "evidence_not_succeeded"
        | "evidence_expired"
        | "evidence_consumed"
        | "evidence_purpose_mismatch"
        | "evidence_order_binding_mismatch"
        | "evidence_version_mismatch"
        | "evidence_fingerprint_mismatch"
        | "evidence_amount_mismatch"
        | "evidence_currency_mismatch";
    };

export type ExternalEvidenceFailureCode = Extract<
  ExternalEvidenceValidation,
  { ok: false }
>["code"];

export function isNonBlank(value: string): boolean {
  return value.trim().length > 0;
}

export function parseIsoInstant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidVersion(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function isValidYen(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Rejects missing, unsigned/unverified, authorization-only or pending,
 * duplicate/consumed, expired, mismatched, and out-of-order evidence. Only
 * an evidence record that is server-verified, succeeded, unconsumed,
 * unexpired, and bound to the exact purpose/order/version/fingerprint/
 * amount/currency is accepted.
 */
export function validateExternalAuthorityEvidence(
  evidence: ExternalAuthorityEvidence | null,
  expected: ExternalEvidenceExpectation,
): ExternalEvidenceValidation {
  if (evidence == null) return { ok: false, code: "evidence_missing" };

  const verifiedAt = parseIsoInstant(evidence.serverVerifiedAtIso);
  const expiresAt = parseIsoInstant(evidence.expiresAtIso);
  const now = parseIsoInstant(expected.nowIso);
  if (
    !isNonBlank(evidence.id) ||
    !isNonBlank(evidence.provider) ||
    !isNonBlank(evidence.providerEventId) ||
    !isNonBlank(evidence.dealerId) ||
    !isNonBlank(evidence.orderId) ||
    !isNonBlank(evidence.requestFingerprint) ||
    !isValidVersion(evidence.orderVersion) ||
    !isValidYen(evidence.amountIncTaxYen) ||
    verifiedAt == null ||
    expiresAt == null ||
    now == null ||
    verifiedAt > now ||
    expiresAt <= verifiedAt
  ) {
    return { ok: false, code: "evidence_invalid" };
  }
  if (evidence.authority !== "server_verified") {
    return { ok: false, code: "evidence_not_server_verified" };
  }
  if (evidence.state !== "succeeded") {
    return { ok: false, code: "evidence_not_succeeded" };
  }
  if (evidence.consumedAtIso != null) {
    return { ok: false, code: "evidence_consumed" };
  }
  if (now >= expiresAt) return { ok: false, code: "evidence_expired" };
  if (evidence.purpose !== expected.purpose) {
    return { ok: false, code: "evidence_purpose_mismatch" };
  }
  if (evidence.dealerId !== expected.dealerId || evidence.orderId !== expected.orderId) {
    return { ok: false, code: "evidence_order_binding_mismatch" };
  }
  if (evidence.orderVersion !== expected.orderVersion) {
    return { ok: false, code: "evidence_version_mismatch" };
  }
  if (evidence.requestFingerprint !== expected.requestFingerprint) {
    return { ok: false, code: "evidence_fingerprint_mismatch" };
  }
  if (evidence.amountIncTaxYen !== expected.amountIncTaxYen) {
    return { ok: false, code: "evidence_amount_mismatch" };
  }
  if (evidence.currency !== expected.currency) {
    return { ok: false, code: "evidence_currency_mismatch" };
  }
  return { ok: true, evidenceId: evidence.id };
}

/**
 * A durable succeeded-payment snapshot used only to authorize refunds. It is
 * distinct from the one-time consumable `ExternalAuthorityEvidence` used for
 * warehouse release/finalization: refunds must be able to reference a
 * succeeded payment long after that evidence record has been consumed. The
 * refund cap is always derived from a validated record, never from a
 * caller-supplied number.
 */
export interface SucceededPaymentRecord {
  id: string;
  authority: "server_verified" | "unverified";
  provider: string;
  providerPaymentId: string;
  purpose: "full_payment_charge";
  state: ExternalEvidenceState;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  amountIncTaxYen: number;
  currency: string;
}

export interface SucceededPaymentExpectation {
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  currency: "JPY";
}

export type SucceededPaymentValidation =
  | { ok: true; succeededAmountIncTaxYen: number }
  | {
      ok: false;
      code:
        | "succeeded_payment_missing"
        | "succeeded_payment_invalid"
        | "succeeded_payment_not_server_verified"
        | "succeeded_payment_not_succeeded"
        | "succeeded_payment_purpose_mismatch"
        | "succeeded_payment_order_binding_mismatch"
        | "succeeded_payment_version_mismatch"
        | "succeeded_payment_fingerprint_mismatch"
        | "succeeded_payment_currency_mismatch";
    };

export type SucceededPaymentFailureCode = Extract<
  SucceededPaymentValidation,
  { ok: false }
>["code"];

/**
 * Rejects a missing record, blank provider/payment identifiers, an
 * unverified authority, a non-succeeded state, a non-payment purpose, and
 * any order/version/fingerprint/currency mismatch. Only a fully validated
 * record's own amount is ever used as the refund cap.
 */
export function validateSucceededPaymentRecord(
  record: SucceededPaymentRecord | null,
  expected: SucceededPaymentExpectation,
): SucceededPaymentValidation {
  if (record == null) return { ok: false, code: "succeeded_payment_missing" };
  if (
    !isNonBlank(record.provider) ||
    !isNonBlank(record.providerPaymentId) ||
    !isNonBlank(record.dealerId) ||
    !isNonBlank(record.orderId) ||
    !isNonBlank(record.requestFingerprint) ||
    !isValidVersion(record.orderVersion) ||
    !isValidYen(record.amountIncTaxYen) ||
    record.amountIncTaxYen <= 0
  ) {
    return { ok: false, code: "succeeded_payment_invalid" };
  }
  if (record.authority !== "server_verified") {
    return { ok: false, code: "succeeded_payment_not_server_verified" };
  }
  if (record.state !== "succeeded") {
    return { ok: false, code: "succeeded_payment_not_succeeded" };
  }
  if (record.purpose !== "full_payment_charge") {
    return { ok: false, code: "succeeded_payment_purpose_mismatch" };
  }
  if (record.dealerId !== expected.dealerId || record.orderId !== expected.orderId) {
    return { ok: false, code: "succeeded_payment_order_binding_mismatch" };
  }
  if (record.orderVersion !== expected.orderVersion) {
    return { ok: false, code: "succeeded_payment_version_mismatch" };
  }
  if (record.requestFingerprint !== expected.requestFingerprint) {
    return { ok: false, code: "succeeded_payment_fingerprint_mismatch" };
  }
  if (record.currency !== expected.currency) {
    return { ok: false, code: "succeeded_payment_currency_mismatch" };
  }
  return { ok: true, succeededAmountIncTaxYen: record.amountIncTaxYen };
}

export interface CardPaymentEvidenceCheck {
  evidence: ExternalAuthorityEvidence | null;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  payableAmountIncTaxYen: number;
  nowIso: string;
}

export type WarehouseReleaseDecision =
  | { ok: true; trigger: "card_payment_succeeded"; consumeEvidenceId: string }
  | { ok: true; trigger: "bank_matched" | "owner_submitted" }
  | {
      ok: false;
      code:
        | "payment_method_unset"
        | "credit_account_selection_forbidden"
        | "credit_account_required"
        | "credit_account_inactive"
        | "cash_on_delivery_direct_ship_forbidden"
        | "bank_payment_match_required"
        | "owner_submission_required"
        | "backorder_policy_required"
        | ExternalEvidenceFailureCode;
    };

/**
 * Card release requires exact structured server-verified succeeded-payment
 * evidence, validated against the exact purpose/order/version/fingerprint/
 * amount/currency, not a caller-owned authorization boolean. The entire
 * tax-inclusive payable total (including back-ordered items) is charged and
 * captured exactly once at owner final submit; ship_available_first and
 * ship_when_complete are logistics choices only and never change the
 * capture count or amount. On success the exact validated `consumeEvidenceId`
 * is returned so the persistence layer can atomically consume the one-time
 * release evidence.
 */
export function decideWarehouseRelease(input: {
  paymentMethod: GyeonOrderPaymentMethod | null;
  creditAccountConfigured: boolean;
  creditAccountActive: boolean;
  customerDirect: boolean;
  ownerSubmitted: boolean;
  cardPaymentEvidenceCheck: CardPaymentEvidenceCheck | null;
  bankPaymentMatched: boolean;
  hasBackorder: boolean;
  backorderShippingPolicy: BackorderShippingPolicy | null;
}): WarehouseReleaseDecision {
  const method = input.paymentMethod;
  if (method == null) return { ok: false, code: "payment_method_unset" };
  if (input.creditAccountConfigured && method !== "credit_account") {
    return { ok: false, code: "credit_account_required" };
  }
  if (!input.creditAccountConfigured && method === "credit_account") {
    return { ok: false, code: "credit_account_selection_forbidden" };
  }
  if (method === "credit_account" && !input.creditAccountActive) {
    return { ok: false, code: "credit_account_inactive" };
  }
  if (method === "cash_on_delivery" && input.customerDirect) {
    return { ok: false, code: "cash_on_delivery_direct_ship_forbidden" };
  }
  if (input.hasBackorder && input.backorderShippingPolicy == null) {
    return { ok: false, code: "backorder_policy_required" };
  }
  if (method === "card") {
    const check = input.cardPaymentEvidenceCheck;
    if (check == null) return { ok: false, code: "evidence_missing" };
    const validation = validateExternalAuthorityEvidence(check.evidence, {
      purpose: "full_payment_charge",
      dealerId: check.dealerId,
      orderId: check.orderId,
      orderVersion: check.orderVersion,
      requestFingerprint: check.requestFingerprint,
      amountIncTaxYen: check.payableAmountIncTaxYen,
      currency: "JPY",
      nowIso: check.nowIso,
    });
    return validation.ok
      ? { ok: true, trigger: "card_payment_succeeded", consumeEvidenceId: validation.evidenceId }
      : { ok: false, code: validation.code };
  }
  if (method === "bank_transfer_prepaid") {
    return input.bankPaymentMatched
      ? { ok: true, trigger: "bank_matched" }
      : { ok: false, code: "bank_payment_match_required" };
  }
  return input.ownerSubmitted
    ? { ok: true, trigger: "owner_submitted" }
    : { ok: false, code: "owner_submission_required" };
}

export type CardBrand = "visa" | "mastercard" | "jcb" | "amex";

export type OwnerFinalSubmitChargeDecision =
  | { ok: true; chargeAmountIncTaxYen: number; captureCount: 1 }
  | { ok: false; code: "invalid_amount" | "backorder_shipping_policy_required" };

/**
 * Owner final submit charges and captures the entire immutable tax-inclusive
 * payable total exactly once. Backorder amount is an explicit separate input
 * (summed here) rather than folded into one opaque total, and card brand is
 * an explicit input, so identical results across shipping policies and card
 * brands are proven by varying real inputs rather than by their absence. A
 * positive backorder amount with no shipping policy fails closed instead of
 * silently charging without a resolved logistics choice; when present, the
 * policy never changes the charged amount or capture count, and JCB follows
 * the identical flow.
 */
export function decideOwnerFinalSubmitCharge(input: {
  nonBackorderPayableAmountIncTaxYen: number;
  backorderPayableAmountIncTaxYen: number;
  backorderShippingPolicy: BackorderShippingPolicy | null;
  cardBrand: CardBrand;
}): OwnerFinalSubmitChargeDecision {
  if (
    !isSafeNonNegativeInteger(input.nonBackorderPayableAmountIncTaxYen) ||
    !isSafeNonNegativeInteger(input.backorderPayableAmountIncTaxYen)
  ) {
    return { ok: false, code: "invalid_amount" };
  }
  if (input.backorderPayableAmountIncTaxYen > 0 && input.backorderShippingPolicy == null) {
    return { ok: false, code: "backorder_shipping_policy_required" };
  }
  const total = input.nonBackorderPayableAmountIncTaxYen + input.backorderPayableAmountIncTaxYen;
  if (!Number.isSafeInteger(total) || total <= 0) {
    return { ok: false, code: "invalid_amount" };
  }
  return { ok: true, chargeAmountIncTaxYen: total, captureCount: 1 };
}

export type CommercialEditDecision =
  | { ok: true; payableAmountYen: number; preserveOriginal: false }
  | {
      ok: false;
      code: "warehouse_already_accepted" | "post_payment_amount_edit_forbidden";
      payableAmountYen: number;
      preserveOriginal: true;
    };

/**
 * Card charges the full payable total once at owner final submit, so a
 * submitted card order has already been paid. Every item, quantity, or
 * payable-total edit on a submitted card order is therefore denied;
 * additional items require a separate order. Historical card
 * reauthorization on edit is unreachable. Non-card methods are unchanged.
 */
export function assessCommercialEdit(input: {
  status: GyeonOrderV3Status;
  paymentMethod: GyeonOrderPaymentMethod;
  currentPayableAmountYen: number;
  proposedPayableAmountYen: number;
}): CommercialEditDecision {
  if (!isCommercialOrderEditable(input.status)) {
    return {
      ok: false,
      code: "warehouse_already_accepted",
      payableAmountYen: input.currentPayableAmountYen,
      preserveOriginal: true,
    };
  }
  if (input.status === "submitted" && input.paymentMethod === "card") {
    return {
      ok: false,
      code: "post_payment_amount_edit_forbidden",
      payableAmountYen: input.currentPayableAmountYen,
      preserveOriginal: true,
    };
  }
  return {
    ok: true,
    payableAmountYen: input.proposedPayableAmountYen,
    preserveOriginal: false,
  };
}

export type WarehouseCalendarMode = "normal" | "closed" | "exceptional" | "shortened";

export interface WarehouseCalendarDay {
  date: string;
  mode: WarehouseCalendarMode;
  cutoffMinute?: number | null;
}

export type EarliestShipDateDecision =
  | { ok: true; date: string }
  | {
      ok: false;
      code:
        | "invalid_date"
        | "invalid_minute"
        | "calendar_unconfigured"
        | "invalid_cutoff"
        | "calendar_search_exhausted";
    };

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function addIsoDays(value: string, amount: number): string | null {
  const date = parseIsoDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/**
 * Inputs are already converted to Asia/Tokyo local date/minute by the server.
 * There is intentionally no hard-coded weekend or holiday behavior.
 */
export function calculateEarliestShipDate(input: {
  eligibleDate: string;
  eligibleMinute: number;
  inventoryReadyDate: string;
  defaultCutoffMinute: number;
  calendar: readonly WarehouseCalendarDay[];
}): EarliestShipDateDecision {
  if (!parseIsoDate(input.eligibleDate) || !parseIsoDate(input.inventoryReadyDate)) {
    return { ok: false, code: "invalid_date" };
  }
  if (!Number.isInteger(input.eligibleMinute) || input.eligibleMinute < 0 || input.eligibleMinute > 1439) {
    return { ok: false, code: "invalid_minute" };
  }
  if (
    !Number.isInteger(input.defaultCutoffMinute) ||
    input.defaultCutoffMinute < 0 ||
    input.defaultCutoffMinute > 1439
  ) {
    return { ok: false, code: "invalid_cutoff" };
  }

  const calendar = new Map(input.calendar.map((day) => [day.date, day]));
  let candidate =
    input.inventoryReadyDate > input.eligibleDate
      ? input.inventoryReadyDate
      : input.eligibleDate;

  for (let offset = 0; offset <= 366; offset += 1) {
    const day = calendar.get(candidate);
    if (!day) return { ok: false, code: "calendar_unconfigured" };
    if (!parseIsoDate(day.date)) return { ok: false, code: "invalid_date" };
    if (day.mode !== "closed") {
      const cutoff = day.cutoffMinute ?? input.defaultCutoffMinute;
      if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 1439) {
        return { ok: false, code: "invalid_cutoff" };
      }
      const sameEligibilityDay = candidate === input.eligibleDate;
      const inventoryReady = candidate >= input.inventoryReadyDate;
      if (inventoryReady && (!sameEligibilityDay || input.eligibleMinute <= cutoff)) {
        return { ok: true, date: candidate };
      }
    }
    const next = addIsoDays(candidate, 1);
    if (!next) return { ok: false, code: "invalid_date" };
    candidate = next;
  }
  return { ok: false, code: "calendar_search_exhausted" };
}

export function shipmentDateChangeNotification(input: {
  previousDate: string | null;
  nextDate: string | null;
}): { notify: boolean; channels: readonly ("bell" | "email")[] } {
  return input.previousDate != null &&
    input.nextDate != null &&
    input.previousDate !== input.nextDate
    ? { notify: true, channels: ["bell", "email"] }
    : { notify: false, channels: [] };
}

export const REQUIRED_DETAILER_PRODUCT_CODES = [
  "ONE_EVO",
  "PURE_EVO",
  "MOHS_EVO",
  "SYNCRO_EVO",
  "PRIMER",
  "PREP",
] as const;

export type QualificationMode = "none" | "shop_initial" | "detailer_initial" | "shop_to_detailer";
export type QualificationLineClass =
  | "eligible_chemical"
  | "required_detailer_product"
  | "optional_matt"
  | "other";

export interface QualificationLine {
  productCode: string;
  quantity: number;
  listPriceExTaxYen: number;
  classification: QualificationLineClass;
}

export interface QualificationDecision {
  provisionalMet: boolean;
  officiallyAchieved: boolean;
  qualifyingAmountExTaxYen: number;
  amountRemainingExTaxYen: number;
  missingRequiredProductCodes: string[];
}

export function evaluateInitialQualification(input: {
  mode: QualificationMode;
  lines: readonly QualificationLine[];
  previouslyShippedUnreturnedProductCodes?: readonly string[];
  shipmentFulfilled: boolean;
}): QualificationDecision {
  if (input.mode === "none") {
    return {
      provisionalMet: true,
      officiallyAchieved: true,
      qualifyingAmountExTaxYen: 0,
      amountRemainingExTaxYen: 0,
      missingRequiredProductCodes: [],
    };
  }

  const qualifyingAmount = input.lines
    .filter((line) => line.classification === "eligible_chemical")
    .reduce((sum, line) => sum + line.listPriceExTaxYen * line.quantity, 0);
  const threshold = input.mode === "shop_to_detailer" ? 0 : 100_000;
  const amountRemaining = Math.max(0, threshold - qualifyingAmount);

  const availableCodes = new Set<string>(
    input.previouslyShippedUnreturnedProductCodes ?? [],
  );
  for (const line of input.lines) {
    if (line.quantity > 0) availableCodes.add(line.productCode);
  }
  const required = input.mode === "shop_initial" ? [] : REQUIRED_DETAILER_PRODUCT_CODES;
  const missing = required.filter((code) => !availableCodes.has(code));
  const provisionalMet = amountRemaining === 0 && missing.length === 0;

  return {
    provisionalMet,
    officiallyAchieved: provisionalMet && input.shipmentFulfilled,
    qualifyingAmountExTaxYen: qualifyingAmount,
    amountRemainingExTaxYen: amountRemaining,
    missingRequiredProductCodes: [...missing],
  };
}

export type PromotionalCartDecision =
  | { ok: true }
  | { ok: false; code: "promotional_goods_only" | "banner_quantity_exceeded" };

export function validatePromotionalCart(
  lines: readonly { quantity: number; isPromotionalGood: boolean; bannerKind?: string | null }[],
): PromotionalCartDecision {
  if (lines.length > 0 && lines.every((line) => line.isPromotionalGood)) {
    return { ok: false, code: "promotional_goods_only" };
  }
  const bannerQuantity = new Map<string, number>();
  for (const line of lines) {
    if (!line.bannerKind) continue;
    const next = (bannerQuantity.get(line.bannerKind) ?? 0) + line.quantity;
    if (next > 1) return { ok: false, code: "banner_quantity_exceeded" };
    bannerQuantity.set(line.bannerKind, next);
  }
  return { ok: true };
}

export const GYEON_ORDER_V3_STATE_AXES = {
  order: GYEON_ORDER_V3_STATUSES,
  ownerReview: ["not_requested", "pending", "changes_requested", "owner_confirmed"],
  payment: [
    "unselected",
    "authorization_pending",
    "authorized",
    "payment_pending",
    "matched",
    "on_hold",
    "failed",
    "credit_account",
  ],
  backorder: ["not_applicable", "policy_unset", "ship_available_first", "ship_when_complete"],
  warehouseTask: ["not_created", "unaccepted", "accepted", "working", "exception", "completed"],
  inventorySupply: [
    "in_stock",
    "out_of_stock",
    "checking",
    "stale",
    "backorder_available",
    "backorder_unavailable",
    "arrival_scheduled",
  ],
  shipment: ["not_ready", "preparing", "shipped", "in_transit", "delivered"],
  pdf: ["not_issued", "generating", "issued", "failed", "forbidden"],
  qualification: [
    "not_applicable",
    "unmet",
    "provisionally_met_in_cart",
    "officially_achieved_after_fulfillment",
    "recheck_required",
  ],
} as const;
