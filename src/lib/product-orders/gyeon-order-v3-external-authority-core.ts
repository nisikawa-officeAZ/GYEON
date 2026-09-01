/**
 * GYEON ordering V3 external-authority boundary contracts.
 *
 * PURE: no DB, Supabase, PSP, bank, inventory, email, or clock access. Callers
 * must supply server-owned facts and an explicit current time. Unknown,
 * unverified, stale, mismatched, expired, or already-consumed facts fail closed.
 */

import {
  decideWarehouseRelease,
  evaluateInitialQualification,
  isNonBlank,
  isValidVersion,
  isValidYen,
  parseIsoInstant,
  validateExternalAuthorityEvidence,
  validateSucceededPaymentRecord,
  type BackorderShippingPolicy,
  type ExternalAuthorityEvidence,
  type ExternalEvidenceExpectation,
  type ExternalEvidenceFailureCode,
  type ExternalEvidencePurpose,
  type ExternalEvidenceState,
  type ExternalEvidenceValidation,
  type GyeonOrderPaymentMethod,
  type GyeonOrderV3Status,
  type QualificationDecision,
  type QualificationLine,
  type QualificationMode,
  type SucceededPaymentFailureCode,
  type SucceededPaymentRecord,
  type WarehouseReleaseDecision,
} from "./gyeon-order-v3-contract-core";

export {
  validateExternalAuthorityEvidence,
  validateSucceededPaymentRecord,
  type ExternalAuthorityEvidence,
  type ExternalEvidenceExpectation,
  type ExternalEvidenceValidation,
  type ExternalEvidencePurpose,
  type ExternalEvidenceState,
  type SucceededPaymentRecord,
};

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type ExternalOperationKind = "owner_submit" | "refund";

export interface PreparedExternalOperation {
  id: string;
  kind: ExternalOperationKind;
  dealerId: string;
  orderId: string;
  expectedOrderVersion: number;
  requestFingerprint: string;
  amountIncTaxYen: number;
  currency: "JPY";
  evidencePurpose: "full_payment_charge" | "refund";
  preparedAtIso: string;
  expiresAtIso: string;
}

export type PreparedOperationCompensation =
  | { required: false }
  | { required: true; refundAmountIncTaxYen: number };

export type PreparedOperationFinalization =
  | {
      ok: true;
      consumeEvidenceId: string;
      preserveOriginal: false;
      compensation: { required: false };
    }
  | {
      ok: false;
      code:
        | "prepared_operation_invalid"
        | "prepared_operation_expired"
        | "order_version_conflict"
        | "request_fingerprint_conflict"
        | ExternalEvidenceFailureCode;
      preserveOriginal: true;
      compensation: PreparedOperationCompensation;
    };

function isPreparedOperationValid(prepared: PreparedExternalOperation): boolean {
  const preparedAt = parseIsoInstant(prepared.preparedAtIso);
  const expiresAt = parseIsoInstant(prepared.expiresAtIso);
  return (
    isNonBlank(prepared.id) &&
    isNonBlank(prepared.dealerId) &&
    isNonBlank(prepared.orderId) &&
    isNonBlank(prepared.requestFingerprint) &&
    isValidVersion(prepared.expectedOrderVersion) &&
    isValidYen(prepared.amountIncTaxYen) &&
    preparedAt != null &&
    expiresAt != null &&
    expiresAt > preparedAt &&
    ((prepared.kind === "owner_submit" && prepared.evidencePurpose === "full_payment_charge") ||
      (prepared.kind === "refund" && prepared.evidencePurpose === "refund"))
  );
}

/**
 * A succeeded full-payment charge whose finalize step cannot complete
 * (version race, fingerprint race, or expiry) has already moved money.
 * Compensation must carry the exact refund amount and be an exact full
 * refund, never an authorization void, because this contract never creates
 * an authorization-only evidence state. Whether compensation is required is
 * decided by running the complete external-evidence validator against the
 * prepared binding and the current `nowIso`; a structurally invalid,
 * expired, consumed, blank-provider, or otherwise unverified record must not
 * trigger compensation, and the accepted amount is always the validated
 * evidence's own amount, not an assumed equality.
 */
function resolveFullRefundCompensation(
  evidence: ExternalAuthorityEvidence | null,
  prepared: PreparedExternalOperation,
  nowIso: string,
): PreparedOperationCompensation {
  if (prepared.kind !== "owner_submit") return { required: false };
  const validation = validateExternalAuthorityEvidence(evidence, {
    purpose: prepared.evidencePurpose,
    dealerId: prepared.dealerId,
    orderId: prepared.orderId,
    orderVersion: prepared.expectedOrderVersion,
    requestFingerprint: prepared.requestFingerprint,
    amountIncTaxYen: prepared.amountIncTaxYen,
    currency: prepared.currency,
    nowIso,
  });
  if (!validation.ok || evidence == null) return { required: false };
  return { required: true, refundAmountIncTaxYen: evidence.amountIncTaxYen };
}

export function assessPreparedOperationFinalization(input: {
  prepared: PreparedExternalOperation;
  currentOrderVersion: number;
  currentRequestFingerprint: string;
  evidence: ExternalAuthorityEvidence | null;
  nowIso: string;
}): PreparedOperationFinalization {
  const { prepared, evidence } = input;
  if (!isPreparedOperationValid(prepared) || parseIsoInstant(input.nowIso) == null) {
    return {
      ok: false,
      code: "prepared_operation_invalid",
      preserveOriginal: true,
      compensation: { required: false },
    };
  }
  if (Date.parse(input.nowIso) >= Date.parse(prepared.expiresAtIso)) {
    return {
      ok: false,
      code: "prepared_operation_expired",
      preserveOriginal: true,
      compensation: resolveFullRefundCompensation(evidence, prepared, input.nowIso),
    };
  }
  if (input.currentOrderVersion !== prepared.expectedOrderVersion) {
    return {
      ok: false,
      code: "order_version_conflict",
      preserveOriginal: true,
      compensation: resolveFullRefundCompensation(evidence, prepared, input.nowIso),
    };
  }
  if (input.currentRequestFingerprint !== prepared.requestFingerprint) {
    return {
      ok: false,
      code: "request_fingerprint_conflict",
      preserveOriginal: true,
      compensation: resolveFullRefundCompensation(evidence, prepared, input.nowIso),
    };
  }

  const validation = validateExternalAuthorityEvidence(evidence, {
    purpose: prepared.evidencePurpose,
    dealerId: prepared.dealerId,
    orderId: prepared.orderId,
    orderVersion: prepared.expectedOrderVersion,
    requestFingerprint: prepared.requestFingerprint,
    amountIncTaxYen: prepared.amountIncTaxYen,
    currency: prepared.currency,
    nowIso: input.nowIso,
  });
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      preserveOriginal: true,
      compensation: { required: false },
    };
  }
  return {
    ok: true,
    consumeEvidenceId: validation.evidenceId,
    preserveOriginal: false,
    compensation: { required: false },
  };
}

export type PreWarehouseEditPlan =
  | { ok: true; action: "finalize_without_external_authorization" }
  | {
      ok: false;
      code:
        | "order_not_submitted"
        | "warehouse_already_accepted"
        | "invalid_amount"
        | "post_payment_amount_edit_forbidden";
      preserveOriginal: true;
    };

/**
 * Card charges the full payable total once at owner final submit, so a
 * submitted card order has already been paid. Every pre-warehouse edit on a
 * submitted card order is denied; historical card-reauthorization-on-edit
 * is unreachable. Non-card methods are unchanged.
 */
export function planPreWarehouseCommercialEdit(input: {
  orderStatus: GyeonOrderV3Status;
  warehouseAccepted: boolean;
  paymentMethod: GyeonOrderPaymentMethod;
  currentAmountIncTaxYen: number;
  proposedAmountIncTaxYen: number;
}): PreWarehouseEditPlan {
  if (input.orderStatus !== "submitted") {
    return { ok: false, code: "order_not_submitted", preserveOriginal: true };
  }
  if (input.warehouseAccepted) {
    return { ok: false, code: "warehouse_already_accepted", preserveOriginal: true };
  }
  if (!isValidYen(input.currentAmountIncTaxYen) || !isValidYen(input.proposedAmountIncTaxYen)) {
    return { ok: false, code: "invalid_amount", preserveOriginal: true };
  }
  if (input.paymentMethod === "card") {
    return {
      ok: false,
      code: "post_payment_amount_edit_forbidden",
      preserveOriginal: true,
    };
  }
  return { ok: true, action: "finalize_without_external_authorization" };
}

export interface RefundLedgerEntry {
  operationKey: string;
  amountIncTaxYen: number;
}

export type RefundKind = "partial" | "full";

export type RefundReason =
  | "confirmed_cancellation"
  | "confirmed_non_fulfillable_item"
  | "final_shortage";

export type RefundDecision =
  | { ok: true; kind: RefundKind; refundAmountIncTaxYen: number }
  | {
      ok: false;
      code:
        | "refund_reason_not_confirmed"
        | "refund_amount_invalid"
        | "refund_ledger_corrupted"
        | "refund_operation_already_recorded"
        | "refund_exceeds_succeeded_payment"
        | SucceededPaymentFailureCode;
    };

/**
 * A confirmed cancellation, confirmed non-fulfillable item, or final
 * shortage authorizes only an exact server-calculated partial or full
 * refund; a caller-named requested amount is never trusted as authority, and
 * the refund cap is derived only from a validated, immutable
 * server-verified succeeded-payment record bound to the exact
 * dealer/order/version/fingerprint. A missing, unverified, wrong-state,
 * wrong-purpose, blank-identifier, or mismatched record fails closed before
 * any ledger arithmetic runs. Every prior ledger entry is then validated as
 * positive, non-blank, non-duplicate, safe-integer JPY data before summing
 * with safe-integer overflow checks at every step, so corrupted, duplicate,
 * or overflowing history fails closed instead of silently under- or
 * over-refunding. Cumulative refunds must never exceed the succeeded payment
 * amount, and a duplicate current-operation key fails closed instead of
 * being applied twice.
 */
export function decideOrderRefund(input: {
  reason: RefundReason | null;
  succeededPayment: SucceededPaymentRecord | null;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  priorRefunds: readonly RefundLedgerEntry[];
  serverCalculatedRefundAmountIncTaxYen: number;
  operationKey: string;
}): RefundDecision {
  if (input.reason == null) {
    return { ok: false, code: "refund_reason_not_confirmed" };
  }

  const paymentValidation = validateSucceededPaymentRecord(input.succeededPayment, {
    dealerId: input.dealerId,
    orderId: input.orderId,
    orderVersion: input.orderVersion,
    requestFingerprint: input.requestFingerprint,
    currency: "JPY",
  });
  if (!paymentValidation.ok) {
    return { ok: false, code: paymentValidation.code };
  }
  const succeededPaymentAmountIncTaxYen = paymentValidation.succeededAmountIncTaxYen;

  if (
    !isValidYen(input.serverCalculatedRefundAmountIncTaxYen) ||
    input.serverCalculatedRefundAmountIncTaxYen <= 0
  ) {
    return { ok: false, code: "refund_amount_invalid" };
  }
  if (!isNonBlank(input.operationKey)) {
    return { ok: false, code: "refund_amount_invalid" };
  }

  const seenOperationKeys = new Set<string>();
  let priorTotal = 0;
  for (const entry of input.priorRefunds) {
    if (
      !isNonBlank(entry.operationKey) ||
      !isValidYen(entry.amountIncTaxYen) ||
      entry.amountIncTaxYen <= 0 ||
      seenOperationKeys.has(entry.operationKey)
    ) {
      return { ok: false, code: "refund_ledger_corrupted" };
    }
    seenOperationKeys.add(entry.operationKey);
    const nextPriorTotal = priorTotal + entry.amountIncTaxYen;
    if (!Number.isSafeInteger(nextPriorTotal)) {
      return { ok: false, code: "refund_ledger_corrupted" };
    }
    priorTotal = nextPriorTotal;
  }
  if (seenOperationKeys.has(input.operationKey)) {
    return { ok: false, code: "refund_operation_already_recorded" };
  }

  const cumulative = priorTotal + input.serverCalculatedRefundAmountIncTaxYen;
  if (!Number.isSafeInteger(cumulative)) {
    return { ok: false, code: "refund_ledger_corrupted" };
  }
  if (cumulative > succeededPaymentAmountIncTaxYen) {
    return { ok: false, code: "refund_exceeds_succeeded_payment" };
  }
  return {
    ok: true,
    kind: cumulative === succeededPaymentAmountIncTaxYen ? "full" : "partial",
    refundAmountIncTaxYen: input.serverCalculatedRefundAmountIncTaxYen,
  };
}

export type QualificationAuthorityState = "CONFIGURED" | "NOT_CONFIGURED" | "STALE" | "ERROR";

export interface QualificationAuthoritySnapshot {
  dealerId: string;
  orderId: string;
  orderVersion: number;
  mode: QualificationMode;
  ruleVersion: number;
  classificationAuthorityVersion: string;
  inputFingerprint: string;
  decision: QualificationDecision;
}

export type QualificationAuthorityResult =
  | { ok: true; snapshot: QualificationAuthoritySnapshot }
  | {
      ok: false;
      code:
        | "qualification_authority_not_configured"
        | "qualification_authority_stale"
        | "qualification_authority_error"
        | "qualification_authority_invalid"
        | "qualification_not_met";
      decision?: QualificationDecision;
    };

export function evaluateQualificationAuthorityForSubmit(input: {
  authorityState: QualificationAuthorityState;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  mode: QualificationMode;
  ruleVersion: number;
  classificationAuthorityVersion: string;
  inputFingerprint: string;
  lines: readonly QualificationLine[];
  previouslyShippedUnreturnedProductCodes?: readonly string[];
}): QualificationAuthorityResult {
  if (input.authorityState === "NOT_CONFIGURED") {
    return { ok: false, code: "qualification_authority_not_configured" };
  }
  if (input.authorityState === "STALE") {
    return { ok: false, code: "qualification_authority_stale" };
  }
  if (input.authorityState === "ERROR") {
    return { ok: false, code: "qualification_authority_error" };
  }
  if (
    !isNonBlank(input.dealerId) ||
    !isNonBlank(input.orderId) ||
    !isValidVersion(input.orderVersion) ||
    !isValidVersion(input.ruleVersion) ||
    !isNonBlank(input.classificationAuthorityVersion) ||
    !isNonBlank(input.inputFingerprint) ||
    input.lines.some(
      (line) =>
        !isNonBlank(line.productCode) ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        !isValidYen(line.listPriceExTaxYen),
    )
  ) {
    return { ok: false, code: "qualification_authority_invalid" };
  }

  const decision = evaluateInitialQualification({
    mode: input.mode,
    lines: input.lines,
    previouslyShippedUnreturnedProductCodes:
      input.previouslyShippedUnreturnedProductCodes,
    shipmentFulfilled: false,
  });
  if (!decision.provisionalMet) {
    return { ok: false, code: "qualification_not_met", decision };
  }
  return {
    ok: true,
    snapshot: {
      dealerId: input.dealerId,
      orderId: input.orderId,
      orderVersion: input.orderVersion,
      mode: input.mode,
      ruleVersion: input.ruleVersion,
      classificationAuthorityVersion: input.classificationAuthorityVersion,
      inputFingerprint: input.inputFingerprint,
      decision,
    },
  };
}

export type QualificationLifecycleState =
  | "not_applicable"
  | "provisional_met"
  | "officially_achieved"
  | "recheck_required";

export function transitionQualificationLifecycle(input: {
  current: QualificationLifecycleState;
  event: "shipment_fulfilled" | "post_fulfillment_return";
  provisionalMet: boolean;
}): QualificationLifecycleState {
  if (input.current === "not_applicable") return "not_applicable";
  if (input.event === "post_fulfillment_return") return "recheck_required";
  return input.provisionalMet ? "officially_achieved" : input.current;
}

export type BankPaymentMatchDecision =
  | { ok: true; state: "matched"; transactionId: string }
  | {
      ok: false;
      state: "on_hold";
      code:
        | "bank_event_not_server_verified"
        | "bank_event_invalid"
        | "bank_transaction_already_assigned"
        | "bank_order_reference_mismatch"
        | "bank_destination_account_mismatch"
        | "bank_underpayment"
        | "bank_overpayment"
        | "bank_payer_name_mismatch";
    };

export function decideBankPaymentMatch(input: {
  authority: "server_verified" | "unverified";
  providerEventId: string;
  transactionId: string;
  transactionAlreadyAssigned: boolean;
  orderReferenceMatches: boolean;
  destinationAccountMatches: boolean;
  payerNameMatches: boolean;
  receivedAmountYen: number;
  expectedAmountYen: number;
}): BankPaymentMatchDecision {
  if (input.authority !== "server_verified") {
    return { ok: false, state: "on_hold", code: "bank_event_not_server_verified" };
  }
  if (
    !isNonBlank(input.providerEventId) ||
    !isNonBlank(input.transactionId) ||
    !isValidYen(input.receivedAmountYen) ||
    !isValidYen(input.expectedAmountYen)
  ) {
    return { ok: false, state: "on_hold", code: "bank_event_invalid" };
  }
  if (input.transactionAlreadyAssigned) {
    return {
      ok: false,
      state: "on_hold",
      code: "bank_transaction_already_assigned",
    };
  }
  if (!input.orderReferenceMatches) {
    return { ok: false, state: "on_hold", code: "bank_order_reference_mismatch" };
  }
  if (!input.destinationAccountMatches) {
    return {
      ok: false,
      state: "on_hold",
      code: "bank_destination_account_mismatch",
    };
  }
  if (input.receivedAmountYen < input.expectedAmountYen) {
    return { ok: false, state: "on_hold", code: "bank_underpayment" };
  }
  if (input.receivedAmountYen > input.expectedAmountYen) {
    return { ok: false, state: "on_hold", code: "bank_overpayment" };
  }
  if (!input.payerNameMatches) {
    return { ok: false, state: "on_hold", code: "bank_payer_name_mismatch" };
  }
  return { ok: true, state: "matched", transactionId: input.transactionId };
}

export type WarehouseTaskCreationDecision =
  | {
      ok: true;
      action: "create_unaccepted";
      trigger: "card_payment_succeeded";
      consumeEvidenceId: string;
    }
  | {
      ok: true;
      action: "create_unaccepted";
      trigger: "bank_matched" | "owner_submitted";
    }
  | { ok: true; action: "noop_existing" }
  | {
      ok: false;
      code:
        | "order_not_submitted"
        | "supply_authority_not_verified"
        | "inventory_reservation_or_backorder_evidence_required"
        | "earliest_ship_date_authority_required"
        | "payment_release_blocked";
      paymentCode?: Extract<WarehouseReleaseDecision, { ok: false }>["code"];
    };

/**
 * Card release evidence is consumed here as the exact structured record
 * (purpose, dealer/order/version/fingerprint, full amount, JPY currency,
 * final state, consumption state, time/order validity), never as a
 * caller-owned succeeded boolean, and rejects the same missing,
 * unsigned/unverified, authorization-only or pending, duplicate/consumed,
 * mismatched, and out-of-order shapes as `decideWarehouseRelease`. On
 * success from a card release it propagates the exact validated
 * `consumeEvidenceId` so the persistence layer can atomically consume the
 * one-time release evidence.
 */
export function decideWarehouseTaskCreation(input: {
  orderStatus: GyeonOrderV3Status;
  taskAlreadyExists: boolean;
  supplyAuthorityVerified: boolean;
  inventoryReservationOrBackorderEvidenceVerified: boolean;
  earliestShipDate: string | null;
  calendarVersion: number | null;
  paymentMethod: GyeonOrderPaymentMethod | null;
  creditAccountConfigured: boolean;
  creditAccountActive: boolean;
  customerDirect: boolean;
  ownerSubmitted: boolean;
  cardPaymentEvidence: ExternalAuthorityEvidence | null;
  dealerId: string;
  orderId: string;
  orderVersion: number;
  requestFingerprint: string;
  payableAmountIncTaxYen: number;
  nowIso: string;
  bankPaymentMatched: boolean;
  hasBackorder: boolean;
  backorderShippingPolicy: BackorderShippingPolicy | null;
}): WarehouseTaskCreationDecision {
  if (input.orderStatus !== "submitted") {
    return { ok: false, code: "order_not_submitted" };
  }
  if (input.taskAlreadyExists) return { ok: true, action: "noop_existing" };
  if (!input.supplyAuthorityVerified) {
    return { ok: false, code: "supply_authority_not_verified" };
  }
  if (!input.inventoryReservationOrBackorderEvidenceVerified) {
    return {
      ok: false,
      code: "inventory_reservation_or_backorder_evidence_required",
    };
  }
  if (
    input.earliestShipDate == null ||
    !isValidIsoDate(input.earliestShipDate) ||
    input.calendarVersion == null ||
    !isValidVersion(input.calendarVersion)
  ) {
    return { ok: false, code: "earliest_ship_date_authority_required" };
  }

  const release = decideWarehouseRelease({
    paymentMethod: input.paymentMethod,
    creditAccountConfigured: input.creditAccountConfigured,
    creditAccountActive: input.creditAccountActive,
    customerDirect: input.customerDirect,
    ownerSubmitted: input.ownerSubmitted,
    cardPaymentEvidenceCheck: {
      evidence: input.cardPaymentEvidence,
      dealerId: input.dealerId,
      orderId: input.orderId,
      orderVersion: input.orderVersion,
      requestFingerprint: input.requestFingerprint,
      payableAmountIncTaxYen: input.payableAmountIncTaxYen,
      nowIso: input.nowIso,
    },
    bankPaymentMatched: input.bankPaymentMatched,
    hasBackorder: input.hasBackorder,
    backorderShippingPolicy: input.backorderShippingPolicy,
  });
  if (!release.ok) {
    return {
      ok: false,
      code: "payment_release_blocked",
      paymentCode: release.code,
    };
  }
  return release.trigger === "card_payment_succeeded"
    ? {
        ok: true,
        action: "create_unaccepted",
        trigger: release.trigger,
        consumeEvidenceId: release.consumeEvidenceId,
      }
    : { ok: true, action: "create_unaccepted", trigger: release.trigger };
}

export type WarehouseAcceptanceDecision =
  | {
      ok: true;
      nextOrderStatus: "approved";
      nextTaskState: "accepted";
      nextOrderVersion: number;
      nextTaskVersion: number;
    }
  | {
      ok: false;
      code:
        | "warehouse_accept_not_allowed"
        | "warehouse_task_not_unaccepted"
        | "order_version_conflict"
        | "task_version_conflict";
    };

export function decideWarehouseAcceptance(input: {
  orderStatus: GyeonOrderV3Status;
  taskState: "unaccepted" | "accepted" | "working" | "exception" | "completed" | "cancelled";
  orderVersion: number;
  expectedOrderVersion: number;
  taskVersion: number;
  expectedTaskVersion: number;
}): WarehouseAcceptanceDecision {
  if (input.orderStatus !== "submitted") {
    return { ok: false, code: "warehouse_accept_not_allowed" };
  }
  if (input.taskState !== "unaccepted") {
    return { ok: false, code: "warehouse_task_not_unaccepted" };
  }
  if (input.orderVersion !== input.expectedOrderVersion) {
    return { ok: false, code: "order_version_conflict" };
  }
  if (input.taskVersion !== input.expectedTaskVersion) {
    return { ok: false, code: "task_version_conflict" };
  }
  return {
    ok: true,
    nextOrderStatus: "approved",
    nextTaskState: "accepted",
    nextOrderVersion: input.orderVersion + 1,
    nextTaskVersion: input.taskVersion + 1,
  };
}
