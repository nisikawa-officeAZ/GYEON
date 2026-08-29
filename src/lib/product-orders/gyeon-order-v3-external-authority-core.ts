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
  type BackorderShippingPolicy,
  type GyeonOrderPaymentMethod,
  type GyeonOrderV3Status,
  type QualificationDecision,
  type QualificationLine,
  type QualificationMode,
  type WarehouseReleaseDecision,
} from "./gyeon-order-v3-contract-core";

export type ExternalEvidencePurpose =
  | "initial_authorization"
  | "edit_reauthorization"
  | "bank_payment_match"
  | "inventory_reservation";

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

type ExternalEvidenceFailureCode = Extract<
  ExternalEvidenceValidation,
  { ok: false }
>["code"];

function isNonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function parseIsoInstant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidVersion(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isValidYen(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

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

export type ExternalOperationKind = "owner_submit" | "edit_before_warehouse";

export interface PreparedExternalOperation {
  id: string;
  kind: ExternalOperationKind;
  dealerId: string;
  orderId: string;
  expectedOrderVersion: number;
  requestFingerprint: string;
  amountIncTaxYen: number;
  currency: "JPY";
  evidencePurpose: "initial_authorization" | "edit_reauthorization";
  preparedAtIso: string;
  expiresAtIso: string;
}

export type PreparedOperationFinalization =
  | {
      ok: true;
      consumeEvidenceId: string;
      preserveOriginal: false;
      compensation: "none";
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
      compensation: "none" | "void_new_card_authorization";
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
    ((prepared.kind === "owner_submit" &&
      prepared.evidencePurpose === "initial_authorization") ||
      (prepared.kind === "edit_before_warehouse" &&
        prepared.evidencePurpose === "edit_reauthorization"))
  );
}

function shouldVoidSucceededCardEvidence(
  evidence: ExternalAuthorityEvidence | null,
  prepared: PreparedExternalOperation,
): boolean {
  return (
    evidence?.authority === "server_verified" &&
    evidence.state === "succeeded" &&
    evidence.consumedAtIso == null &&
    evidence.purpose === prepared.evidencePurpose &&
    evidence.dealerId === prepared.dealerId &&
    evidence.orderId === prepared.orderId &&
    evidence.orderVersion === prepared.expectedOrderVersion &&
    evidence.requestFingerprint === prepared.requestFingerprint &&
    evidence.amountIncTaxYen === prepared.amountIncTaxYen &&
    evidence.currency === prepared.currency
  );
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
      compensation: "none",
    };
  }
  if (Date.parse(input.nowIso) >= Date.parse(prepared.expiresAtIso)) {
    return {
      ok: false,
      code: "prepared_operation_expired",
      preserveOriginal: true,
      compensation: shouldVoidSucceededCardEvidence(evidence, prepared)
        ? "void_new_card_authorization"
        : "none",
    };
  }
  if (input.currentOrderVersion !== prepared.expectedOrderVersion) {
    return {
      ok: false,
      code: "order_version_conflict",
      preserveOriginal: true,
      compensation: shouldVoidSucceededCardEvidence(evidence, prepared)
        ? "void_new_card_authorization"
        : "none",
    };
  }
  if (input.currentRequestFingerprint !== prepared.requestFingerprint) {
    return {
      ok: false,
      code: "request_fingerprint_conflict",
      preserveOriginal: true,
      compensation: shouldVoidSucceededCardEvidence(evidence, prepared)
        ? "void_new_card_authorization"
        : "none",
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
      compensation: "none",
    };
  }
  return {
    ok: true,
    consumeEvidenceId: validation.evidenceId,
    preserveOriginal: false,
    compensation: "none",
  };
}

export type PreWarehouseEditPlan =
  | {
      ok: true;
      action: "finalize_without_external_authorization" | "prepare_card_reauthorization";
      evidencePurpose: "edit_reauthorization" | null;
    }
  | {
      ok: false;
      code: "order_not_submitted" | "warehouse_already_accepted" | "invalid_amount";
      preserveOriginal: true;
    };

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
  if (
    input.paymentMethod === "card" &&
    input.currentAmountIncTaxYen !== input.proposedAmountIncTaxYen
  ) {
    return {
      ok: true,
      action: "prepare_card_reauthorization",
      evidencePurpose: "edit_reauthorization",
    };
  }
  return {
    ok: true,
    action: "finalize_without_external_authorization",
    evidencePurpose: null,
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
      trigger: "card_authorized" | "bank_matched" | "owner_submitted";
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
  cardAuthorized: boolean;
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
    cardAuthorized: input.cardAuthorized,
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
  return { ok: true, action: "create_unaccepted", trigger: release.trigger };
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
