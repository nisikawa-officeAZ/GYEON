// Dealer public profile projection — fail-closed redaction tests (GHP-2 seed).
//
// Pure. No DB, no network, no server module.
//
// Run: node --import tsx --test src/lib/dealer-public-profile/dealer-public-profile-projection.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEALER_PUBLIC_CAPABILITY_IDS,
  buildDealerPublicProfileProjection as buildProjection,
  isCapabilityCurrentlyValid,
  isDealerPublicCapabilityId,
  isDealerPublicStoreId,
  parseDealerPublicStoreId,
  type DealerPublicCapabilityInput,
  type DealerPublicProfilePublicationAuthority,
  type DealerPublicProfileSourceFacts,
} from "./dealer-public-profile-projection";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FACTS: DealerPublicProfileSourceFacts = {
  public_display_name: "GYEON Detailing Shibuya",
  public_short_description: "Certified GYEON coating specialist",
  public_full_description: "Full-service coating, PPF, and maintenance.",
  postal_code: "150-0002",
  business_address: "Tokyo, Shibuya-ku, ...",
  public_phone: "03-1234-5678",
  public_email: "contact@example.com",
  inquiry_url: "https://example.com/contact",
};

const NOW = new Date("2026-08-16T00:00:00.000Z");

const PUBLISHED_AUTHORITY: DealerPublicProfilePublicationAuthority = {
  lifecycle_state: "published",
  owner_publication_consent: true,
  operator_approved: true,
};

const PUBLIC_ID = parseDealerPublicStoreId("PUB-TEST-1");

function buildDealerPublicProfileProjection(
  facts: DealerPublicProfileSourceFacts,
  capabilities: readonly DealerPublicCapabilityInput[] | null | undefined,
  opaquePublicId: string,
  options: { now?: Date } = {},
) {
  return buildProjection(facts, capabilities, parseDealerPublicStoreId(opaquePublicId), {
    now: options.now ?? NOW,
    publication: PUBLISHED_AUTHORITY,
  });
}

function approvedCapability(
  capability_id: DealerPublicCapabilityInput["capability_id"],
  over: Partial<DealerPublicCapabilityInput> = {},
): DealerPublicCapabilityInput {
  return { capability_id, status: "approved", ...over };
}

// ── 1. THE CENTRAL GUARANTEE — private facts and internal identity never appear ──

test("private/internal fields never appear in the output, even if the caller widens the facts object", () => {
  // Simulate a caller accidentally passing a superset row (e.g. straight from
  // CanonicalDealerSettings) instead of the narrow public source-facts type.
  const wideningRow = {
    ...FACTS,
    dealer_id: "11111111-1111-1111-1111-111111111111",
    bank_account: "1234567 SHIBUYA BRANCH",
    invoice_note: "internal note",
    terms_and_conditions: "internal terms",
    line_channel_id: "line-secret-channel",
    line_channel_secret: "super-secret",
    line_access_token: "super-secret-token",
  } as unknown as DealerPublicProfileSourceFacts;

  const result = buildDealerPublicProfileProjection(wideningRow, [], "PUB-OPAQUE-1", { now: NOW });

  const json = JSON.stringify(result);
  for (const forbidden of [
    "dealer_id",
    "bank_account",
    "invoice_note",
    "terms_and_conditions",
    "line_channel_id",
    "line_channel_secret",
    "line_access_token",
    "super-secret",
    "11111111-1111-1111-1111-111111111111",
  ]) {
    assert.ok(!json.includes(forbidden), `output must not contain "${forbidden}"`);
  }

  assert.deepEqual(Object.keys(result).sort(), [
    "address",
    "capabilities",
    "display_name",
    "email",
    "full_description",
    "inquiry_url",
    "phone",
    "postal_code",
    "public_store_id",
    "short_description",
  ]);
});

test("public_store_id is always the validated caller-supplied public id", () => {
  const result = buildDealerPublicProfileProjection(FACTS, [], "PUB-OPAQUE-42", { now: NOW });
  assert.equal(result.public_store_id, "PUB-OPAQUE-42");
});

test("a missing, blank, arbitrary, or internal-looking id throws instead of returning a projection", () => {
  for (const bad of [
    "",
    "   ",
    "OPAQUE-STORE-42",
    "11111111-1111-1111-1111-111111111111",
    "PUB-lowercase",
  ]) {
    assert.throws(() => buildDealerPublicProfileProjection(FACTS, [], bad, { now: NOW }));
  }
  // @ts-expect-error — intentionally omitting the required argument
  assert.throws(() => buildDealerPublicProfileProjection(FACTS, [], undefined, { now: NOW }));

  assert.throws(() =>
    buildProjection(
      FACTS,
      [],
      "11111111-1111-1111-1111-111111111111" as unknown as typeof PUBLIC_ID,
      { now: NOW, publication: PUBLISHED_AUTHORITY },
    ),
  );
});

// ── 2. Profile publication authority is fail-closed ──────────────────────────

test("only a published profile with owner consent and operator approval can be projected", () => {
  for (const lifecycle_state of ["draft", "submitted", "approved", "suspended", "withdrawn"] as const) {
    assert.throws(() =>
      buildProjection(FACTS, [], PUBLIC_ID, {
        now: NOW,
        publication: { ...PUBLISHED_AUTHORITY, lifecycle_state },
      }),
    );
  }

  for (const publication of [
    { ...PUBLISHED_AUTHORITY, owner_publication_consent: false },
    { ...PUBLISHED_AUTHORITY, operator_approved: false },
  ]) {
    assert.throws(() => buildProjection(FACTS, [], PUBLIC_ID, { now: NOW, publication }));
  }
});

test("missing or mistyped publication authority fails closed", () => {
  for (const publication of [undefined, null, {}, "published", true]) {
    assert.throws(() =>
      buildProjection(FACTS, [], PUBLIC_ID, {
        now: NOW,
        publication: publication as unknown as DealerPublicProfilePublicationAuthority,
      }),
    );
  }
});

// ── 3. Capability publication is fail-closed ──────────────────────────────────

test("only status \"approved\" publishes a capability — every other status is excluded", () => {
  const statuses: DealerPublicCapabilityInput["status"][] = [
    "requested",
    "rejected",
    "suspended",
    "expired",
  ];
  for (const status of statuses) {
    const result = buildDealerPublicProfileProjection(
      FACTS,
      [approvedCapability("gyeon_certified_detailer", { status })],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(result.capabilities, [], `status "${status}" must not publish`);
  }
});

test("an approved capability with no validity window publishes", () => {
  const result = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_authorized_dealer")],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(result.capabilities, [{ capability_id: "gyeon_authorized_dealer" }]);
});

test("an approved capability not yet valid (valid_from in the future) is excluded", () => {
  const result = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_installation_store", { valid_from: "2027-01-01T00:00:00.000Z" })],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(result.capabilities, []);
});

test("an approved capability past its valid_through is excluded (upper bound is exclusive)", () => {
  const atBoundary = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_maintenance_store", { valid_through: NOW.toISOString() })],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(atBoundary.capabilities, [], "now === valid_through must already be expired");

  const past = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_maintenance_store", { valid_through: "2020-01-01T00:00:00.000Z" })],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(past.capabilities, []);
});

test("now === valid_from is already valid (lower bound is inclusive)", () => {
  const result = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_product_retailer", { valid_from: NOW.toISOString() })],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(result.capabilities, [{ capability_id: "gyeon_product_retailer" }]);
});

test("a malformed valid_from/valid_through timestamp fails closed, not open", () => {
  const badFrom = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_certified_detailer", { valid_from: "not-a-date" })],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(badFrom.capabilities, []);

  const badThrough = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_certified_detailer", { valid_through: "not-a-date" })],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(badThrough.capabilities, []);
});

test("a parseable but non-RFC3339 timestamp or impossible calendar instant fails closed", () => {
  for (const invalid of [
    "08/15/2026",
    "2026-08-15",
    "2026-08-15T00:00:00",
    "2026-08-15 00:00:00Z",
    "2026-02-30T00:00:00Z",
    "2026-08-15T24:00:00Z",
    "2026-08-15T00:00:00+24:00",
  ]) {
    const result = buildDealerPublicProfileProjection(
      FACTS,
      [approvedCapability("gyeon_certified_detailer", { valid_from: invalid })],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(result.capabilities, [], `${invalid} must fail strict instant validation`);
  }
});

test("an invalid injected now rejects every capability, even one that is approved and unbounded", () => {
  const invalidNow = new Date("not-a-date");
  assert.ok(Number.isNaN(invalidNow.getTime()), "fixture precondition: invalidNow must actually be invalid");

  const unbounded = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_authorized_dealer")],
    "PUB-1",
    { now: invalidNow },
  );
  assert.deepEqual(unbounded.capabilities, [], "an invalid now must reject even a boundary-free approved capability");

  const withinNominalWindow = buildDealerPublicProfileProjection(
    FACTS,
    [
      approvedCapability("gyeon_certified_detailer", {
        valid_from: "2020-01-01T00:00:00.000Z",
        valid_through: "2099-01-01T00:00:00.000Z",
      }),
    ],
    "PUB-1",
    { now: invalidNow },
  );
  assert.deepEqual(withinNominalWindow.capabilities, []);

  assert.equal(isCapabilityCurrentlyValid({ status: "approved" }, invalidNow), false);
});

test("a present-but-blank valid_from/valid_through fails closed, not treated as unbounded", () => {
  for (const blank of ["", "   "]) {
    const badFrom = buildDealerPublicProfileProjection(
      FACTS,
      [approvedCapability("gyeon_certified_detailer", { valid_from: blank })],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(badFrom.capabilities, [], `blank valid_from ${JSON.stringify(blank)} must fail closed`);

    const badThrough = buildDealerPublicProfileProjection(
      FACTS,
      [approvedCapability("gyeon_certified_detailer", { valid_through: blank })],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(badThrough.capabilities, [], `blank valid_through ${JSON.stringify(blank)} must fail closed`);
  }
});

test("a runtime wrong-type valid_from/valid_through fails closed, not treated as unbounded", () => {
  // A truthy non-string (e.g. a number) previously slipped past the old truthiness check and could
  // even construct a "valid" Date (Date accepts epoch-millisecond numbers), silently bypassing the
  // window check entirely.
  for (const wrongType of [0, 12345, false, true, {}, []]) {
    const badFrom = buildDealerPublicProfileProjection(
      FACTS,
      [
        {
          capability_id: "gyeon_certified_detailer",
          status: "approved",
          valid_from: wrongType,
        } as unknown as DealerPublicCapabilityInput,
      ],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(badFrom.capabilities, [], `wrong-type valid_from ${JSON.stringify(wrongType)} must fail closed`);

    const badThrough = buildDealerPublicProfileProjection(
      FACTS,
      [
        {
          capability_id: "gyeon_certified_detailer",
          status: "approved",
          valid_through: wrongType,
        } as unknown as DealerPublicCapabilityInput,
      ],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(
      badThrough.capabilities, [],
      `wrong-type valid_through ${JSON.stringify(wrongType)} must fail closed`,
    );
  }
});

test("null and undefined valid_from/valid_through still mean unbounded, not a failure", () => {
  for (const unbounded of [
    { valid_from: null, valid_through: null },
    { valid_from: undefined, valid_through: undefined },
    {},
  ]) {
    const result = buildDealerPublicProfileProjection(
      FACTS,
      [approvedCapability("gyeon_authorized_dealer", unbounded)],
      "PUB-1",
      { now: NOW },
    );
    assert.deepEqual(
      result.capabilities, [{ capability_id: "gyeon_authorized_dealer" }],
      `${JSON.stringify(unbounded)} must remain unbounded, not excluded`,
    );
  }
});

test("an unknown capability_id is excluded, never coerced onto a known capability", () => {
  const result = buildDealerPublicProfileProjection(
    FACTS,
    [{ capability_id: "gyeon_platinum_partner", status: "approved" } as unknown as DealerPublicCapabilityInput],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(result.capabilities, []);
});

test("a malformed capability entry (wrong type, null) is excluded without throwing", () => {
  const malformed = [null, undefined, "gyeon_certified_detailer", 42, []] as unknown as DealerPublicCapabilityInput[];
  const result = buildDealerPublicProfileProjection(FACTS, malformed, "PUB-1", { now: NOW });
  assert.deepEqual(result.capabilities, []);
});

test("duplicate approved entries for the same capability fail closed", () => {
  const result = buildDealerPublicProfileProjection(
    FACTS,
    [approvedCapability("gyeon_certified_detailer"), approvedCapability("gyeon_certified_detailer")],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(result.capabilities, []);
});

test("approved plus revoked authority rows fail closed in either order", () => {
  for (const status of ["rejected", "suspended", "expired"] as const) {
    const approved = approvedCapability("gyeon_certified_detailer");
    const revoked = approvedCapability("gyeon_certified_detailer", { status });
    for (const capabilities of [
      [approved, revoked],
      [revoked, approved],
    ]) {
      const result = buildDealerPublicProfileProjection(FACTS, capabilities, "PUB-1", { now: NOW });
      assert.deepEqual(result.capabilities, [], `${status} conflict must not publish in either order`);
    }
  }
});

// ── 4. Missing/empty capability list is fail-closed, never a default fallback ──

for (const [label, value] of [
  ["undefined", undefined],
  ["null", null],
  ["empty array", []],
] as const) {
  test(`a ${label} capabilities list yields zero published capabilities`, () => {
    const result = buildDealerPublicProfileProjection(FACTS, value, "PUB-1", { now: NOW });
    assert.deepEqual(result.capabilities, []);
  });
}

test("a non-array capabilities value (defensive, mistyped input) yields zero published capabilities", () => {
  const result = buildDealerPublicProfileProjection(
    FACTS,
    "gyeon_certified_detailer" as unknown as DealerPublicCapabilityInput[],
    "PUB-1",
    { now: NOW },
  );
  assert.deepEqual(result.capabilities, []);
});

// ── 5. Canonical capabilities are complete and deterministically ordered ──────

test("every canonical capability id publishes in canonical order regardless of input order", () => {
  const reversed = [...DEALER_PUBLIC_CAPABILITY_IDS].reverse().map((id) => approvedCapability(id));
  const result = buildDealerPublicProfileProjection(FACTS, reversed, "PUB-1", { now: NOW });
  assert.deepEqual(
    result.capabilities.map((c) => c.capability_id),
    DEALER_PUBLIC_CAPABILITY_IDS,
  );
});

test("equivalent capability permutations produce byte-identical projections", () => {
  const forward = DEALER_PUBLIC_CAPABILITY_IDS.map((id) => approvedCapability(id));
  const reverse = [...forward].reverse();
  const a = buildDealerPublicProfileProjection(FACTS, forward, "PUB-1", { now: NOW });
  const b = buildDealerPublicProfileProjection(FACTS, reverse, "PUB-1", { now: NOW });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ── 6. Facts are null-safe, never coerced into "" or a fabricated placeholder ──

test("absent/blank/whitespace-only facts become null, never an empty string", () => {
  const blank: DealerPublicProfileSourceFacts = {
    public_display_name: null,
    public_short_description: "",
    public_full_description: "   ",
    postal_code: null,
    business_address: null,
    public_phone: null,
    public_email: null,
    inquiry_url: null,
  };
  const result = buildDealerPublicProfileProjection(blank, [], "PUB-1", { now: NOW });
  assert.equal(result.display_name, null);
  assert.equal(result.short_description, null);
  assert.equal(result.full_description, null);
});

test("a wrong-type fact value (defensive, mistyped input) becomes null, not a thrown error", () => {
  const wrongTypes = { ...FACTS, public_display_name: 12345 } as unknown as DealerPublicProfileSourceFacts;
  const result = buildDealerPublicProfileProjection(wrongTypes, [], "PUB-1", { now: NOW });
  assert.equal(result.display_name, null);
});

test("valid non-blank facts pass through unchanged", () => {
  const result = buildDealerPublicProfileProjection(FACTS, [], "PUB-1", { now: NOW });
  assert.equal(result.display_name, FACTS.public_display_name);
  assert.equal(result.short_description, FACTS.public_short_description);
  assert.equal(result.full_description, FACTS.public_full_description);
  assert.equal(result.postal_code, FACTS.postal_code);
  assert.equal(result.address, FACTS.business_address);
  assert.equal(result.phone, FACTS.public_phone);
  assert.equal(result.email, FACTS.public_email);
  assert.equal(result.inquiry_url, FACTS.inquiry_url);
});

// ── 7. Exported helpers, tested directly ──────────────────────────────────────

test("isDealerPublicCapabilityId matches only the five canonical literals", () => {
  for (const id of DEALER_PUBLIC_CAPABILITY_IDS) assert.equal(isDealerPublicCapabilityId(id), true);
  for (const v of ["", "gyeon_platinum_partner", "GYEON_CERTIFIED_DETAILER", null, undefined, 1, {}, []]) {
    assert.equal(isDealerPublicCapabilityId(v), false);
  }
});

test("public-store ID parser accepts only the dedicated opaque namespace", () => {
  for (const value of ["PUB-1", "PUB-OPAQUE-STORE-42", "PUB-A1B2C3"]) {
    assert.equal(isDealerPublicStoreId(value), true);
    assert.equal(parseDealerPublicStoreId(value), value);
  }
  for (const value of ["", "PUB-", "PUB-lower", "internal-uuid", "11111111-1111-1111-1111-111111111111"]) {
    assert.equal(isDealerPublicStoreId(value), false);
    assert.throws(() => parseDealerPublicStoreId(value));
  }
});

test("isCapabilityCurrentlyValid is exhaustive over status/window combinations", () => {
  assert.equal(isCapabilityCurrentlyValid({ status: "approved" }, NOW), true);
  assert.equal(isCapabilityCurrentlyValid({ status: "requested" }, NOW), false);
  assert.equal(isCapabilityCurrentlyValid({ status: "rejected" }, NOW), false);
  assert.equal(isCapabilityCurrentlyValid({ status: "suspended" }, NOW), false);
  assert.equal(isCapabilityCurrentlyValid({ status: "expired" }, NOW), false);
  assert.equal(
    isCapabilityCurrentlyValid(
      { status: "approved", valid_from: "2020-01-01T00:00:00.000Z", valid_through: "2099-01-01T00:00:00.000Z" },
      NOW,
    ),
    true,
  );

  // Invalid `now` fails closed even for an otherwise-unbounded approved capability.
  assert.equal(isCapabilityCurrentlyValid({ status: "approved" }, new Date("not-a-date")), false);

  // Present-but-blank or wrong-type boundaries fail closed; null/undefined stay unbounded.
  assert.equal(isCapabilityCurrentlyValid({ status: "approved", valid_from: "" }, NOW), false);
  assert.equal(isCapabilityCurrentlyValid({ status: "approved", valid_through: "   " }, NOW), false);
  assert.equal(
    isCapabilityCurrentlyValid(
      { status: "approved", valid_from: 0 as unknown as string },
      NOW,
    ),
    false,
  );
  assert.equal(isCapabilityCurrentlyValid({ status: "approved", valid_from: null, valid_through: undefined }, NOW), true);
});
