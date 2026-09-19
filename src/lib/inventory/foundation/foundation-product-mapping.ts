import "server-only";

import {
  parseFoundationLegalOwner,
  parseFoundationProductId,
  parseFoundationProductIdentityRevision,
  type FoundationProductIdentityLifecycle,
  type InventoryLegalOwnerCode,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";

export const FOUNDATION_PRODUCT_MAPPING_CONTRACT =
  "INV001-P24-BOOK-D3B-PRODUCT-IDENTITY-MAPPING-V1" as const;

export const FOUNDATION_PRODUCT_MAPPING_CLOSED_CODES = Object.freeze([
  "NOT_CONFIGURED",
  "MAPPING_UNCONFIRMED",
  "STALE_MAPPING",
  "stale_product_identity",
  "FOUNDATION_PRODUCT_SUSPENDED",
  "FOUNDATION_PRODUCT_RETIRED",
  "MAPPING_SUPERSEDED",
  "DUPLICATE_MAPPING",
  "AMBIGUOUS_MAPPING",
  "OWNER_MISMATCH",
  "BOOK_PRODUCT_INACTIVE",
  "MALFORMED_MAPPING",
  "UNAUTHORIZED",
  "MAPPING_UNAVAILABLE",
] as const);

export type FoundationProductMappingClosedCode =
  (typeof FOUNDATION_PRODUCT_MAPPING_CLOSED_CODES)[number];

export type FoundationProductMappingEventKind =
  | "candidate"
  | "confirm"
  | "change"
  | "suspend"
  | "retire"
  | "supersede"
  | "rejection";

export type FoundationProductMappingReviewSnapshot = {
  readonly jan?: string;
  readonly sku?: string;
  readonly name?: string;
  readonly category?: string;
  readonly capacity?: string;
};

export type FoundationProductMappingTrustedContext = {
  readonly confirmerUserId: string;
  readonly dealerTenantContext: string;
  readonly authoritySource: string;
  readonly capabilitySnapshot: string;
  readonly requestId: string;
};

export type FoundationProductMappingRecord = {
  readonly foundationProductId: string;
  readonly bookProductId: string;
  readonly legalOwner: InventoryLegalOwnerCode;
  readonly foundationLifecycle: FoundationProductIdentityLifecycle;
  readonly foundationIdentityRevision: number;
  readonly mappingRevision: number;
  readonly evidenceReference: string;
  readonly successorFoundationProductId: string | null;
};

export type FoundationProductMappingEvent = {
  readonly kind: FoundationProductMappingEventKind;
  readonly foundationProductId: string;
  readonly bookProductId: string;
  readonly legalOwner: InventoryLegalOwnerCode;
  readonly foundationLifecycle: FoundationProductIdentityLifecycle;
  readonly foundationIdentityRevision: number;
  readonly mappingRevision: number;
  readonly evidenceDigest: string;
  readonly reviewSnapshot: FoundationProductMappingReviewSnapshot;
  readonly successorFoundationProductId: string | null;
};

export type FoundationBookProductRecord = {
  readonly bookProductId: string;
  readonly isActive: boolean;
};

export type FoundationProductMappingStore = {
  readonly available: boolean;
  readonly current: readonly FoundationProductMappingRecord[];
  readonly events: readonly FoundationProductMappingEvent[];
  readonly bookProducts: readonly FoundationBookProductRecord[];
};

export type FoundationProductMappingSuccess = {
  readonly ok: true;
  readonly foundationProductId: string;
  readonly bookProductId: string;
  readonly legalOwner: InventoryLegalOwnerCode;
  readonly mappingRevision: number;
  readonly foundationIdentityRevision: number;
  readonly foundationLifecycle: FoundationProductIdentityLifecycle;
  readonly evidenceReference: string;
  readonly successorFoundationProductId: string | null;
};

export type FoundationProductMappingDenial = {
  readonly ok: false;
  readonly code: FoundationProductMappingClosedCode;
};

export type FoundationProductMappingResult =
  | FoundationProductMappingSuccess
  | FoundationProductMappingDenial;

const BOOK_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EVIDENCE_DIGEST = /^[a-f0-9]{64}$/;

function deny(code: FoundationProductMappingClosedCode): FoundationProductMappingDenial {
  return { ok: false, code };
}

function isNonEmptyTrimmed(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 512
  );
}

function parseBookProductId(value: unknown): string | null {
  return typeof value === "string" && BOOK_UUID.test(value) ? value : null;
}

function trustedContextOk(context: FoundationProductMappingTrustedContext | null): boolean {
  if (context == null) return false;
  return (
    isNonEmptyTrimmed(context.confirmerUserId) &&
    isNonEmptyTrimmed(context.dealerTenantContext) &&
    isNonEmptyTrimmed(context.authoritySource) &&
    isNonEmptyTrimmed(context.capabilitySnapshot) &&
    isNonEmptyTrimmed(context.requestId)
  );
}

function lifecycleSuccessorOk(
  lifecycle: FoundationProductIdentityLifecycle,
  foundationProductId: string,
  successorFoundationProductId: string | null,
): boolean {
  if (lifecycle === "superseded") {
    return (
      successorFoundationProductId !== null &&
      successorFoundationProductId !== foundationProductId
    );
  }
  return successorFoundationProductId === null;
}

function success(record: FoundationProductMappingRecord): FoundationProductMappingSuccess {
  return {
    ok: true,
    foundationProductId: record.foundationProductId,
    bookProductId: record.bookProductId,
    legalOwner: record.legalOwner,
    mappingRevision: record.mappingRevision,
    foundationIdentityRevision: record.foundationIdentityRevision,
    foundationLifecycle: record.foundationLifecycle,
    evidenceReference: record.evidenceReference,
    successorFoundationProductId: record.successorFoundationProductId,
  };
}

function evaluateAccepted(
  record: FoundationProductMappingRecord,
  expectedMappingRevision: number,
  expectedOwner?: InventoryLegalOwnerCode,
): FoundationProductMappingResult {
  if (expectedOwner !== undefined && record.legalOwner !== expectedOwner) {
    return deny("OWNER_MISMATCH");
  }
  if (record.mappingRevision !== expectedMappingRevision) {
    return deny("STALE_MAPPING");
  }
  if (record.foundationLifecycle === "suspended") {
    return deny("FOUNDATION_PRODUCT_SUSPENDED");
  }
  if (record.foundationLifecycle === "retired") {
    return deny("FOUNDATION_PRODUCT_RETIRED");
  }
  if (record.foundationLifecycle === "superseded") {
    return deny("MAPPING_SUPERSEDED");
  }
  return success(record);
}

function unresolvedFromEvents(
  store: FoundationProductMappingStore,
  match: (event: FoundationProductMappingEvent) => boolean,
): FoundationProductMappingResult {
  const candidates = store.events.filter(
    (event) => event.kind === "candidate" && match(event),
  );
  const pairs = new Set(
    candidates.map((event) => `${event.foundationProductId}:${event.bookProductId}`),
  );
  if (pairs.size === 0) return deny("NOT_CONFIGURED");
  if (pairs.size > 1) return deny("AMBIGUOUS_MAPPING");
  return deny("MAPPING_UNCONFIRMED");
}

export function resolveFoundationProduct(
  store: FoundationProductMappingStore,
  input: {
    readonly bookProductId: unknown;
    readonly expectedMappingRevision: unknown;
  },
): FoundationProductMappingResult {
  if (!store.available) return deny("MAPPING_UNAVAILABLE");
  const bookProductId = parseBookProductId(input.bookProductId);
  const revision = parseFoundationProductIdentityRevision(input.expectedMappingRevision);
  if (bookProductId == null || revision.ok !== true) return deny("MALFORMED_MAPPING");

  const book = store.bookProducts.find((row) => row.bookProductId === bookProductId);
  if (book == null || book.isActive !== true) return deny("BOOK_PRODUCT_INACTIVE");

  const accepted = store.current.filter((row) => row.bookProductId === bookProductId);
  if (accepted.length > 1) return deny("DUPLICATE_MAPPING");
  if (accepted.length === 1) {
    return evaluateAccepted(accepted[0]!, revision.value);
  }
  return unresolvedFromEvents(store, (event) => event.bookProductId === bookProductId);
}

export function resolveBookProduct(
  store: FoundationProductMappingStore,
  input: {
    readonly foundationOwner: unknown;
    readonly foundationProductId: unknown;
    readonly expectedMappingRevision: unknown;
  },
): FoundationProductMappingResult {
  if (!store.available) return deny("MAPPING_UNAVAILABLE");
  const owner = parseFoundationLegalOwner(input.foundationOwner);
  const productId = parseFoundationProductId(input.foundationProductId);
  const revision = parseFoundationProductIdentityRevision(input.expectedMappingRevision);
  if (owner.ok !== true || productId.ok !== true || revision.ok !== true) {
    return deny("MALFORMED_MAPPING");
  }

  const canonicalId = productId.value.productId;
  const accepted = store.current.filter((row) => row.foundationProductId === canonicalId);
  if (accepted.length > 1) return deny("DUPLICATE_MAPPING");
  if (accepted.length === 1) {
    const record = accepted[0]!;
    const book = store.bookProducts.find((row) => row.bookProductId === record.bookProductId);
    if (book == null || book.isActive !== true) return deny("BOOK_PRODUCT_INACTIVE");
    return evaluateAccepted(record, revision.value, owner.value);
  }
  return unresolvedFromEvents(
    store,
    (event) => event.foundationProductId === canonicalId,
  );
}

export function confirmFoundationProductMapping(
  store: FoundationProductMappingStore,
  input: {
    readonly trustedContext: FoundationProductMappingTrustedContext | null;
    readonly foundationOwner: unknown;
    readonly foundationProductId: unknown;
    readonly bookProductId: unknown;
    readonly foundationLifecycle: FoundationProductIdentityLifecycle;
    readonly foundationIdentityRevision: unknown;
    readonly expectedMappingRevision: unknown;
    readonly evidenceDigest: unknown;
    readonly reviewSnapshot: FoundationProductMappingReviewSnapshot;
    readonly successorFoundationProductId?: unknown;
    readonly catalogueExactMatch?: {
      readonly jan?: string;
      readonly sku?: string;
      readonly name?: string;
    };
  },
): FoundationProductMappingResult & { readonly store?: FoundationProductMappingStore } {
  if (!store.available) return deny("MAPPING_UNAVAILABLE");
  if (!trustedContextOk(input.trustedContext)) return deny("UNAUTHORIZED");

  const owner = parseFoundationLegalOwner(input.foundationOwner);
  const productId = parseFoundationProductId(input.foundationProductId);
  const identityRevision = parseFoundationProductIdentityRevision(
    input.foundationIdentityRevision,
  );
  const expected = parseFoundationProductIdentityRevision(
    input.expectedMappingRevision === 0 ? 1 : input.expectedMappingRevision,
  );
  const bookProductId = parseBookProductId(input.bookProductId);
  if (
    owner.ok !== true ||
    productId.ok !== true ||
    identityRevision.ok !== true ||
    bookProductId == null ||
    typeof input.evidenceDigest !== "string" ||
    !EVIDENCE_DIGEST.test(input.evidenceDigest)
  ) {
    return deny("MALFORMED_MAPPING");
  }

  if (input.expectedMappingRevision === 0) {
    // first confirm uses mapping revision 0 -> 1
  } else if (expected.ok !== true) {
    return deny("MALFORMED_MAPPING");
  }

  let successor: string | null = null;
  if (input.successorFoundationProductId != null) {
    const parsedSuccessor = parseFoundationProductId(input.successorFoundationProductId);
    if (parsedSuccessor.ok !== true) return deny("MALFORMED_MAPPING");
    successor = parsedSuccessor.value.productId;
  }

  const canonicalId = productId.value.productId;
  if (!lifecycleSuccessorOk(input.foundationLifecycle, canonicalId, successor)) {
    return deny("MALFORMED_MAPPING");
  }
  const book = store.bookProducts.find((row) => row.bookProductId === bookProductId);
  if (book == null || book.isActive !== true) return deny("BOOK_PRODUCT_INACTIVE");

  const byFoundation = store.current.filter((row) => row.foundationProductId === canonicalId);
  const byBook = store.current.filter((row) => row.bookProductId === bookProductId);
  if (byFoundation.length > 1 || byBook.length > 1) return deny("DUPLICATE_MAPPING");

  const existing = byFoundation[0] ?? byBook[0];
  if (
    existing &&
    (existing.foundationProductId !== canonicalId || existing.bookProductId !== bookProductId)
  ) {
    return deny("DUPLICATE_MAPPING");
  }

  const expectedRevision =
    input.expectedMappingRevision === 0 ? 0 : (expected as { ok: true; value: number }).value;
  if (existing) {
    if (existing.legalOwner !== owner.value) return deny("OWNER_MISMATCH");
    if (existing.mappingRevision !== expectedRevision) return deny("STALE_MAPPING");
    if (existing.foundationIdentityRevision > identityRevision.value) {
      return deny("stale_product_identity");
    }
  } else if (expectedRevision !== 0) {
    return deny("STALE_MAPPING");
  }

  const nextRecord: FoundationProductMappingRecord = {
    foundationProductId: canonicalId,
    bookProductId,
    legalOwner: owner.value,
    foundationLifecycle: input.foundationLifecycle,
    foundationIdentityRevision: identityRevision.value,
    mappingRevision: existing ? existing.mappingRevision + 1 : 1,
    evidenceReference: input.evidenceDigest,
    successorFoundationProductId: successor,
  };

  const event: FoundationProductMappingEvent = {
    kind: existing ? "change" : "confirm",
    foundationProductId: canonicalId,
    bookProductId,
    legalOwner: owner.value,
    foundationLifecycle: input.foundationLifecycle,
    foundationIdentityRevision: identityRevision.value,
    mappingRevision: nextRecord.mappingRevision,
    evidenceDigest: input.evidenceDigest,
    reviewSnapshot: input.reviewSnapshot,
    successorFoundationProductId: successor,
  };

  const nextStore: FoundationProductMappingStore = {
    available: true,
    current: existing
      ? store.current.map((row) =>
          row.foundationProductId === canonicalId ? nextRecord : row,
        )
      : [...store.current, nextRecord],
    events: [...store.events, event],
    bookProducts: store.bookProducts,
  };

  return { ...success(nextRecord), store: nextStore };
}

export function reviewSnapshotNeverAuthorizesMapping(
  store: FoundationProductMappingStore,
  catalogueExactMatch: FoundationProductMappingReviewSnapshot,
): FoundationProductMappingDenial {
  const matchedEvidence = store.events.some((event) => {
    const snap = event.reviewSnapshot;
    return (
      (catalogueExactMatch.jan != null && snap.jan === catalogueExactMatch.jan) ||
      (catalogueExactMatch.sku != null && snap.sku === catalogueExactMatch.sku) ||
      (catalogueExactMatch.name != null && snap.name === catalogueExactMatch.name)
    );
  });
  void matchedEvidence;
  if (!store.available) return deny("MAPPING_UNAVAILABLE");
  return deny("NOT_CONFIGURED");
}
