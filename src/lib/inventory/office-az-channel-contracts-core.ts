/**
 * GYEON dealer authorization, Detailer AG channel offer, and EC sync contracts
 * (ADR 0012) — pure, no DB, no network, no wall-clock reads inside functions.
 */

export const GYEON_ORDERING_PROGRAM_CODE = "gyeon_ordering" as const;
export const DETAILER_AG_CHANNEL_CODE = "detailer_ag" as const;

export type DealerMembershipStatus =
  | "active"
  | "suspended"
  | "revoked"
  | "expired"
  | "pending";

export interface DealerProgramMembership {
  id: string;
  dealerId: string;
  programCode: string;
  status: DealerMembershipStatus;
  effectiveFromIso: string;
  effectiveToIso: string | null;
}

/**
 * `"read_error"` represents a failed/unreadable server read (e.g. RLS denial or a
 * query error) for the whole membership set — distinct from a legitimate empty result.
 */
export type MembershipReadResult = readonly DealerProgramMembership[] | "read_error";

export type MembershipDenialCode =
  | "missing"
  | "duplicate_active"
  | "suspended"
  | "revoked"
  | "expired"
  | "pending"
  | "not_yet_effective"
  | "unreadable";

export type MembershipEvaluation =
  | { ok: true; membership: DealerProgramMembership }
  | { ok: false; code: MembershipDenialCode; message: string };

function isWithinTimeWindow(
  effectiveFromIso: string,
  effectiveToIso: string | null,
  nowIso: string,
): boolean {
  const now = Date.parse(nowIso);
  const from = Date.parse(effectiveFromIso);
  if (!Number.isFinite(now) || !Number.isFinite(from)) return false;
  if (now < from) return false;
  if (effectiveToIso != null) {
    const to = Date.parse(effectiveToIso);
    if (!Number.isFinite(to)) return false;
    if (now >= to) return false;
  }
  return true;
}

/**
 * Fail-closed: missing, duplicate, suspended, revoked, status-expired, pending,
 * window-expired/not-yet-effective, or an unreadable membership all deny. Only a single
 * readable membership whose `dealerId` matches the required `dealerId`, whose
 * `programCode` is `gyeon_ordering`, whose status is explicitly "active", and whose
 * window covers now authorizes commercial operations; any status other than "active"
 * (including unknown future statuses) denies before the time window is ever consulted.
 * A membership belonging to a different dealer is filtered out before cardinality is
 * even considered, so it can never authorize the target dealer — it behaves exactly as
 * if no membership existed for that dealer.
 */
export function evaluateGyeonMembership(
  read: MembershipReadResult,
  dealerId: string,
  nowIso: string,
): MembershipEvaluation {
  if (read === "read_error") {
    return {
      ok: false,
      code: "unreadable",
      message: "membership read failed; treating as denied",
    };
  }

  const candidates = read.filter(
    (m) => m.dealerId === dealerId && m.programCode === GYEON_ORDERING_PROGRAM_CODE,
  );
  if (candidates.length === 0) {
    return { ok: false, code: "missing", message: "no gyeon_ordering membership found" };
  }
  // Duplicate cardinality (among rows already scoped to this dealerId and program) is
  // checked before status/time filtering so a mixed active/revoked or active/suspended
  // pair can never be narrowed down to a single "winning" row by status or window
  // filters.
  if (candidates.length > 1) {
    return {
      ok: false,
      code: "duplicate_active",
      message: "more than one gyeon_ordering membership row is ambiguous; denying",
    };
  }

  const membership = candidates[0]!;
  // Fail closed on every non-"active" status before ever consulting the time window,
  // so a pending or explicitly expired row can never be authorized by an
  // in-window effectiveFrom/effectiveToIso pair.
  if (membership.status !== "active") {
    if (membership.status === "revoked") {
      return { ok: false, code: "revoked", message: "membership is revoked" };
    }
    if (membership.status === "suspended") {
      return { ok: false, code: "suspended", message: "membership is suspended" };
    }
    if (membership.status === "expired") {
      return { ok: false, code: "expired", message: "membership status is expired" };
    }
    if (membership.status === "pending") {
      return {
        ok: false,
        code: "pending",
        message: "membership is pending and not yet authorized",
      };
    }
    return {
      ok: false,
      code: "unreadable",
      message: "membership status is not a recognized active status; denying",
    };
  }

  if (!isWithinTimeWindow(membership.effectiveFromIso, membership.effectiveToIso, nowIso)) {
    const nowMs = Date.parse(nowIso);
    const expired =
      membership.effectiveToIso != null && Date.parse(membership.effectiveToIso) <= nowMs;
    return expired
      ? { ok: false, code: "expired", message: "membership window has ended" }
      : { ok: false, code: "not_yet_effective", message: "membership window has not started" };
  }

  return { ok: true, membership };
}

export function isGyeonOrderingAuthorized(
  evaluation: MembershipEvaluation,
): evaluation is { ok: true; membership: DealerProgramMembership } {
  return evaluation.ok;
}

/** Exact I2 publication-state contract; only "published" may pass sale authorization. */
export type ChannelPublicationState = "draft" | "published" | "unpublished" | "tombstoned";

/** Deliberately unresolved: EC sellable/reservable quantity location scope is not decided yet. */
export type AvailabilityPolicy =
  | "always"
  | "supplier_availability"
  | "office_az_inventory"
  | "not_configured";

export interface ChannelProductRecord {
  id: string;
  active: boolean;
}

export interface ProductChannelOffer {
  productId: string;
  channelCode: string;
  publicationState: ChannelPublicationState;
  /** Operator-facing sellability checkbox. Alone it can never authorize a buyer. */
  sellable: boolean;
  /** Minimum offer field per I2 §detailer_ag_publication_contract: price excluding tax. */
  priceExTax: number;
  /** Minimum offer field per I2 §detailer_ag_publication_contract: price including tax. */
  priceIncTax: number;
  /** ISO 4217-style currency code; must be nonblank. */
  currency: string;
  taxRatePercent: number;
  orderUnitQty: number;
  minimumOrderQty: number;
  allowedRanks: readonly string[];
  effectiveFromIso: string;
  effectiveToIso: string | null;
  availabilityPolicy: AvailabilityPolicy;
  /** Monotonic version bumped on every server-owned change to this offer. */
  version: number;
}

export interface ChannelOfferSnapshot {
  productId: string;
  channelCode: typeof DETAILER_AG_CHANNEL_CODE;
  priceExTax: number;
  priceIncTax: number;
  currency: string;
  taxRatePercent: number;
  orderUnitQty: number;
  minimumOrderQty: number;
  offerVersion: number;
  snapshotTakenAtIso: string;
}

export type DetailerAgDenialCode =
  | "wrong_channel"
  | "offer_product_mismatch"
  | "product_inactive"
  | "offer_not_published"
  | "offer_not_sellable"
  | "invalid_offer_price_ex_tax"
  | "invalid_offer_price_inc_tax"
  | "invalid_offer_price_inc_below_ex_tax"
  | "invalid_offer_currency"
  | "invalid_offer_tax_rate"
  | "invalid_offer_version"
  | "no_allowed_ranks"
  | "invalid_offer_unit_or_minimum"
  | "membership_denied"
  | "rank_not_allowed"
  | "invalid_unit_or_minimum"
  | "not_effective"
  | "availability_not_configured";

export type DetailerAgAuthorizationResult =
  | { ok: true; snapshot: ChannelOfferSnapshot }
  | { ok: false; code: DetailerAgDenialCode; message: string };

/**
 * Authorization is the conjunction of every server-owned gate: active product,
 * published offer, sellable offer, exactly one active GYEON membership, allowed rank,
 * valid unit/minimum, effective time, and a configured availability policy. Publication
 * or the operator sellable checkbox alone can never authorize a buyer. On success the
 * server reloads canonical product/offer rows and atomically writes an identity/price/
 * tax/unit snapshot; any client-supplied price/identity input is untrusted and ignored.
 */
export function authorizeDetailerAgPurchase(input: {
  product: ChannelProductRecord;
  offer: ProductChannelOffer;
  membershipEvaluation: MembershipEvaluation;
  buyerRank: string;
  requestedQty: number;
  nowIso: string;
}): DetailerAgAuthorizationResult {
  const { product, offer, membershipEvaluation, buyerRank, requestedQty, nowIso } = input;

  if (offer.channelCode !== DETAILER_AG_CHANNEL_CODE) {
    return { ok: false, code: "wrong_channel", message: "offer is not a detailer_ag offer" };
  }
  if (offer.productId !== product.id) {
    return {
      ok: false,
      code: "offer_product_mismatch",
      message: "offer productId does not match the reloaded canonical product id",
    };
  }
  if (!product.active) {
    return { ok: false, code: "product_inactive", message: "product is not active" };
  }
  if (offer.publicationState !== "published") {
    return { ok: false, code: "offer_not_published", message: "offer is not published" };
  }
  if (!offer.sellable) {
    return { ok: false, code: "offer_not_sellable", message: "offer sellable flag is off" };
  }
  if (!Number.isFinite(offer.priceExTax) || offer.priceExTax < 0) {
    return {
      ok: false,
      code: "invalid_offer_price_ex_tax",
      message: "offer ex-tax price must be a finite, non-negative number",
    };
  }
  if (!Number.isFinite(offer.priceIncTax) || offer.priceIncTax < 0) {
    return {
      ok: false,
      code: "invalid_offer_price_inc_tax",
      message: "offer inc-tax price must be a finite, non-negative number",
    };
  }
  if (offer.priceIncTax < offer.priceExTax) {
    return {
      ok: false,
      code: "invalid_offer_price_inc_below_ex_tax",
      message: "offer inc-tax price must not be below the ex-tax price",
    };
  }
  if (typeof offer.currency !== "string" || offer.currency.trim() === "") {
    return {
      ok: false,
      code: "invalid_offer_currency",
      message: "offer currency must be a nonblank string",
    };
  }
  if (
    !Number.isFinite(offer.taxRatePercent) ||
    offer.taxRatePercent < 0 ||
    offer.taxRatePercent > 100
  ) {
    return {
      ok: false,
      code: "invalid_offer_tax_rate",
      message: "offer tax rate must be a finite percentage between 0 and 100",
    };
  }
  if (!Number.isInteger(offer.version) || offer.version <= 0) {
    return {
      ok: false,
      code: "invalid_offer_version",
      message: "offer version must be a positive integer",
    };
  }
  if (offer.allowedRanks.length === 0) {
    return {
      ok: false,
      code: "no_allowed_ranks",
      message: "offer has no allowed ranks configured; failing closed",
    };
  }
  if (
    !Number.isInteger(offer.orderUnitQty) ||
    offer.orderUnitQty <= 0 ||
    !Number.isInteger(offer.minimumOrderQty) ||
    offer.minimumOrderQty <= 0 ||
    offer.minimumOrderQty % offer.orderUnitQty !== 0
  ) {
    return {
      ok: false,
      code: "invalid_offer_unit_or_minimum",
      message:
        "offer orderUnitQty and minimumOrderQty must be positive integers, and minimumOrderQty must be a multiple of orderUnitQty",
    };
  }
  if (!isGyeonOrderingAuthorized(membershipEvaluation)) {
    return {
      ok: false,
      code: "membership_denied",
      message: `gyeon membership denied: ${membershipEvaluation.ok ? "" : membershipEvaluation.code}`,
    };
  }
  if (!offer.allowedRanks.includes(buyerRank)) {
    return { ok: false, code: "rank_not_allowed", message: "buyer rank is not allowed on this offer" };
  }
  if (
    !Number.isInteger(requestedQty) ||
    requestedQty <= 0 ||
    requestedQty < offer.minimumOrderQty ||
    offer.orderUnitQty <= 0 ||
    requestedQty % offer.orderUnitQty !== 0
  ) {
    return {
      ok: false,
      code: "invalid_unit_or_minimum",
      message: "requested qty must be a positive multiple of orderUnitQty and >= minimumOrderQty",
    };
  }
  if (!isWithinTimeWindow(offer.effectiveFromIso, offer.effectiveToIso, nowIso)) {
    return { ok: false, code: "not_effective", message: "offer is outside its effective window" };
  }
  if (offer.availabilityPolicy === "not_configured") {
    return {
      ok: false,
      code: "availability_not_configured",
      message: "availability policy is unresolved; failing closed",
    };
  }

  return {
    ok: true,
    snapshot: {
      productId: product.id,
      channelCode: DETAILER_AG_CHANNEL_CODE,
      priceExTax: offer.priceExTax,
      priceIncTax: offer.priceIncTax,
      currency: offer.currency,
      taxRatePercent: offer.taxRatePercent,
      orderUnitQty: offer.orderUnitQty,
      minimumOrderQty: offer.minimumOrderQty,
      offerVersion: offer.version,
      snapshotTakenAtIso: nowIso,
    },
  };
}

export interface EcSyncIdentity {
  productId: string;
  ecSyncId: string;
}

/** Every Office AZ product gets one stable EC sync identity, even while unpublished. */
export function deriveEcSyncIdentity(productId: string): EcSyncIdentity {
  const trimmed = productId.trim();
  if (!trimmed) {
    throw new Error("product_id_required");
  }
  return { productId: trimmed, ecSyncId: `ec-sync:${trimmed}` };
}

export type EcSyncOperation = "upsert" | "unpublish";

/**
 * Deterministically includes product ID, channel, monotonic aggregate version, and
 * operation. `aggregateVersion` must be a positive integer (matching the SQL
 * `version > 0` constraint), so version 0 is rejected the same way in both layers.
 */
export function buildEcIdempotencyKey(input: {
  productId: string;
  channelCode: string;
  aggregateVersion: number;
  operation: EcSyncOperation;
}): string {
  if (!Number.isInteger(input.aggregateVersion) || input.aggregateVersion <= 0) {
    throw new Error("invalid_aggregate_version");
  }
  return [
    input.productId,
    input.channelCode,
    input.aggregateVersion,
    input.operation,
  ].join(":");
}

export interface EcSyncState {
  productId: string;
  channelCode: string;
  desiredVersion: number;
  desiredHash: string;
  lastAcknowledgedVersion: number | null;
  lastAcknowledgedHash: string | null;
}

export interface EcAcknowledgement {
  productId: string;
  channelCode: string;
  acknowledgedVersion: number;
  acknowledgedHash: string;
}

export type EcAckDenialCode =
  | "identity_mismatch"
  | "invalid_version"
  | "stale_ack"
  | "ahead_ack"
  | "hash_mismatch";

export type EcAckApplyResult =
  | { ok: true; state: EcSyncState }
  | { ok: false; code: EcAckDenialCode; message: string };

function isPositiveFiniteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

/**
 * DealerOS desired state (`desiredVersion`/`desiredHash`) is authoritative. An
 * acknowledgement is accepted only when its version equals the current desired
 * version and its hash equals the current desired hash — never merely "newer than
 * last acknowledged", since `lastAcknowledgedVersion` being null must not be
 * mistaken for "anything goes". A repeat of the already-applied current
 * version/hash is an idempotent success and never mutates state to a conflicting
 * value. Both `state.desiredVersion` and `ack.acknowledgedVersion` must be positive,
 * finite integers — a nonpositive, noninteger, or nonfinite version on either side is
 * rejected with `invalid_version` before any stale/ahead/hash comparison is made.
 */
export function applyEcAcknowledgement(
  state: EcSyncState,
  ack: EcAcknowledgement,
): EcAckApplyResult {
  if (ack.productId !== state.productId || ack.channelCode !== state.channelCode) {
    return {
      ok: false,
      code: "identity_mismatch",
      message: "acknowledgement product/channel does not match sync state",
    };
  }
  if (
    !isPositiveFiniteInteger(state.desiredVersion) ||
    !isPositiveFiniteInteger(ack.acknowledgedVersion)
  ) {
    return {
      ok: false,
      code: "invalid_version",
      message: "desired and acknowledged versions must both be positive, finite integers",
    };
  }
  if (ack.acknowledgedVersion < state.desiredVersion) {
    return {
      ok: false,
      code: "stale_ack",
      message: "acknowledged version is behind the current desired version",
    };
  }
  if (ack.acknowledgedVersion > state.desiredVersion) {
    return {
      ok: false,
      code: "ahead_ack",
      message: "acknowledged version is ahead of the current desired version",
    };
  }
  if (ack.acknowledgedHash !== state.desiredHash) {
    return {
      ok: false,
      code: "hash_mismatch",
      message: "acknowledged hash does not match the current desired hash",
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      lastAcknowledgedVersion: ack.acknowledgedVersion,
      lastAcknowledgedHash: ack.acknowledgedHash,
    },
  };
}

export interface EcRetrySchedule {
  attempt: number;
  delayMs: number;
  /** Visible dead-letter state once attempts are exhausted. */
  exhausted: boolean;
}

/** Bounded exponential backoff; attempts beyond maxAttempts are reported exhausted (dead-letter). */
export function computeEcRetrySchedule(
  attempt: number,
  options?: { baseDelayMs?: number; maxDelayMs?: number; maxAttempts?: number },
): EcRetrySchedule {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("invalid_attempt");
  }
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 5 * 60 * 1000;
  const maxAttempts = options?.maxAttempts ?? 8;
  if (!Number.isInteger(baseDelayMs) || baseDelayMs <= 0) {
    throw new Error("invalid_base_delay_ms");
  }
  if (!Number.isInteger(maxDelayMs) || maxDelayMs <= 0) {
    throw new Error("invalid_max_delay_ms");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("invalid_max_attempts");
  }
  if (maxDelayMs < baseDelayMs) {
    throw new Error("max_delay_ms_below_base_delay_ms");
  }
  if (attempt > maxAttempts) {
    return { attempt, delayMs: 0, exhausted: true };
  }
  const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  return { attempt, delayMs, exhausted: false };
}

export type EcDriftReason = "version_behind" | "version_ahead" | "hash_mismatch";

export type EcDriftResult =
  | { drifted: false }
  | { drifted: true; action: "resync"; reason: EcDriftReason };

/**
 * Reconciles acknowledged state against desired state; any drift requires a resync.
 * Detects both a stale acknowledgement (behind the current desired version) and an
 * acknowledgement claiming a version the desired state never reached (ahead), as well
 * as a same-version hash mismatch.
 */
export function reconcileEcDrift(state: EcSyncState): EcDriftResult {
  if (
    state.lastAcknowledgedVersion == null ||
    state.lastAcknowledgedVersion < state.desiredVersion
  ) {
    return { drifted: true, action: "resync", reason: "version_behind" };
  }
  if (state.lastAcknowledgedVersion > state.desiredVersion) {
    return { drifted: true, action: "resync", reason: "version_ahead" };
  }
  if (state.lastAcknowledgedHash !== state.desiredHash) {
    return { drifted: true, action: "resync", reason: "hash_mismatch" };
  }
  return { drifted: false };
}

export interface EcTombstoneState {
  productId: string;
  channelCode: string;
  tombstoned: boolean;
  tombstonedAtIso: string | null;
}

/** Idempotent unpublish: applying it again preserves the original tombstone timestamp. */
export function applyEcUnpublish(
  state: EcTombstoneState,
  nowIso: string,
): EcTombstoneState {
  if (state.tombstoned) {
    return state;
  }
  return { ...state, tombstoned: true, tombstonedAtIso: nowIso };
}

export type EcQuantityStatus = "NOT_CONFIGURED";

export interface EcQuantityResult {
  status: EcQuantityStatus;
  quantity: null;
}

/**
 * EC sellable/reservable quantity location scope is deliberately unresolved. The only
 * defined policy input today returns status NOT_CONFIGURED and emits no quantity
 * (never 0, which would falsely claim zero stock).
 */
export function resolveEcSellableQuantity(policy: "not_configured"): EcQuantityResult {
  if (policy !== "not_configured") {
    throw new Error("unknown_ec_quantity_policy");
  }
  return { status: "NOT_CONFIGURED", quantity: null };
}
