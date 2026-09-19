import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { before, test } from "node:test";
import { pathToFileURL } from "node:url";

import {
  parseFoundationProductId,
} from "@nisikawa-officeaz/detaileros-inventory-foundation";
import type {
  FoundationBookProductRecord,
  FoundationProductMappingEvent,
  FoundationProductMappingRecord,
  FoundationProductMappingStore,
} from "./foundation-product-mapping.ts";

const MODULE = "src/lib/inventory/foundation/foundation-product-mapping.ts";
const MIGRATION =
  "supabase/migrations/20260919103125_foundation_product_mapping.sql";
const SCRIPT = "scripts/e2e/inv001-foundation-product-mapping-disposable.mjs";

const serverOnlyEmptyModule = pathToFileURL(
  path.resolve("node_modules/next/dist/compiled/server-only/empty.js"),
).href;

type ResolveResult = { readonly shortCircuit?: boolean; readonly url: string };
type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => ResolveResult,
) => ResolveResult;

const registerHooks = (
  nodeModule as unknown as {
    registerHooks(hooks: { readonly resolve: ResolveHook }): void;
  }
).registerHooks;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: serverOnlyEmptyModule };
    }
    return nextResolve(specifier, context);
  },
});

const mappingPromise = import("./foundation-product-mapping.js");
let mapping: Awaited<typeof mappingPromise>;

before(async () => {
  mapping = await mappingPromise;
});

const FOUNDATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOUNDATION_ID_OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOOK_ID_OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc";
const DIGEST = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

const rawModule = readFileSync(MODULE, "utf8");
const migration = readFileSync(MIGRATION, "utf8");
const script = readFileSync(SCRIPT, "utf8");

function store(
  overrides: Partial<FoundationProductMappingStore> & {
    readonly current?: readonly FoundationProductMappingRecord[];
    readonly events?: readonly FoundationProductMappingEvent[];
    readonly bookProducts?: readonly FoundationBookProductRecord[];
    readonly available?: boolean;
  } = {},
) {
  return {
    available: overrides.available ?? true,
    current: overrides.current ?? [],
    events: overrides.events ?? [],
    bookProducts: overrides.bookProducts ?? [
      { bookProductId: BOOK_ID, isActive: true },
    ],
  };
}

function accepted(
  extras: Partial<FoundationProductMappingRecord> = {},
) {
  return {
    foundationProductId: FOUNDATION_ID,
    bookProductId: BOOK_ID,
    legalOwner: "OFFICE_AZ" as const,
    foundationLifecycle: "active" as const,
    foundationIdentityRevision: 1,
    mappingRevision: 1,
    evidenceReference: DIGEST,
    successorFoundationProductId: null,
    ...extras,
  };
}

function trusted() {
  return {
    confirmerUserId: "user-1",
    dealerTenantContext: "dealer-1",
    authoritySource: "server_resolved",
    capabilitySnapshot: "OFFICE_AZ_ADMIN",
    requestId: "req-1",
  };
}

test("uses Foundation parseFoundationProductId as the sole product-ID authority", () => {
  const parsed = parseFoundationProductId("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA");
  assert.equal(parsed.ok, true);
  if (parsed.ok !== true) return;
  assert.equal(parsed.value.productId, FOUNDATION_ID);
  assert.match(rawModule, /parseFoundationProductId/);
  assert.doesNotMatch(rawModule, /normalizeCanonicalUuid/);
  assert.doesNotMatch(rawModule, /toLowerCase\(\)/);
  const resolved = mapping.resolveBookProduct(store(), {
    foundationOwner: "OFFICE_AZ",
    foundationProductId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    expectedMappingRevision: 1,
  });
  assert.equal(resolved.ok, false);
  if (resolved.ok) return;
  assert.equal(resolved.code, "NOT_CONFIGURED");
});

test("success returns the exact pair and revisions", () => {
  const result = mapping.resolveFoundationProduct(store({ current: [accepted()] }), {
    bookProductId: BOOK_ID,
    expectedMappingRevision: 1,
  });
  assert.equal(result.ok, true);
  if (result.ok !== true) return;
  assert.equal(result.foundationProductId, FOUNDATION_ID);
  assert.equal(result.bookProductId, BOOK_ID);
  assert.equal(result.legalOwner, "OFFICE_AZ");
  assert.equal(result.mappingRevision, 1);
  assert.equal(result.foundationIdentityRevision, 1);
  assert.equal(result.foundationLifecycle, "active");
  assert.equal(result.evidenceReference, DIGEST);

  const reverse = mapping.resolveBookProduct(store({ current: [accepted()] }), {
    foundationOwner: "OFFICE_AZ",
    foundationProductId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    expectedMappingRevision: 1,
  });
  assert.equal(reverse.ok, true);
  if (reverse.ok !== true) return;
  assert.equal(reverse.foundationProductId, FOUNDATION_ID);
  assert.equal(reverse.bookProductId, BOOK_ID);
  assert.equal(reverse.legalOwner, "OFFICE_AZ");
  assert.equal(reverse.mappingRevision, 1);
  assert.equal(reverse.foundationIdentityRevision, 1);
  assert.equal(reverse.successorFoundationProductId, null);
});

test("closed resolver matrix", () => {
  const cases: Array<{
    readonly code: string;
    readonly store: ReturnType<typeof store>;
    readonly book?: unknown;
    readonly foundation?: unknown;
    readonly owner?: unknown;
    readonly revision?: unknown;
  }> = [
    {
      code: "NOT_CONFIGURED",
      store: store(),
    },
    {
      code: "MAPPING_UNCONFIRMED",
      store: store({
        events: [
          {
            kind: "candidate",
            foundationProductId: FOUNDATION_ID,
            bookProductId: BOOK_ID,
            legalOwner: "OFFICE_AZ",
            foundationLifecycle: "active",
            foundationIdentityRevision: 1,
            mappingRevision: 0,
            evidenceDigest: DIGEST,
            reviewSnapshot: { jan: "4901234567890", sku: "SKU-1", name: "Coat" },
            successorFoundationProductId: null,
          },
        ],
      }),
    },
    {
      code: "AMBIGUOUS_MAPPING",
      store: store({
        events: [
          {
            kind: "candidate",
            foundationProductId: FOUNDATION_ID,
            bookProductId: BOOK_ID,
            legalOwner: "OFFICE_AZ",
            foundationLifecycle: "active",
            foundationIdentityRevision: 1,
            mappingRevision: 0,
            evidenceDigest: DIGEST,
            reviewSnapshot: {},
            successorFoundationProductId: null,
          },
          {
            kind: "candidate",
            foundationProductId: FOUNDATION_ID_OTHER,
            bookProductId: BOOK_ID,
            legalOwner: "OFFICE_AZ",
            foundationLifecycle: "active",
            foundationIdentityRevision: 1,
            mappingRevision: 0,
            evidenceDigest: DIGEST_B,
            reviewSnapshot: {},
            successorFoundationProductId: null,
          },
        ],
      }),
    },
    {
      code: "STALE_MAPPING",
      store: store({ current: [accepted()] }),
      revision: 2,
    },
    {
      code: "FOUNDATION_PRODUCT_SUSPENDED",
      store: store({ current: [accepted({ foundationLifecycle: "suspended" })] }),
    },
    {
      code: "FOUNDATION_PRODUCT_RETIRED",
      store: store({ current: [accepted({ foundationLifecycle: "retired" })] }),
    },
    {
      code: "MAPPING_SUPERSEDED",
      store: store({
        current: [
          accepted({
            foundationLifecycle: "superseded",
            successorFoundationProductId: FOUNDATION_ID_OTHER,
          }),
        ],
      }),
    },
    {
      code: "DUPLICATE_MAPPING",
      store: store({
        current: [accepted(), accepted({ bookProductId: BOOK_ID_OTHER })],
        bookProducts: [
          { bookProductId: BOOK_ID, isActive: true },
          { bookProductId: BOOK_ID_OTHER, isActive: true },
        ],
      }),
      foundation: FOUNDATION_ID,
    },
    {
      code: "OWNER_MISMATCH",
      store: store({ current: [accepted()] }),
      owner: "ATTRACTION",
      foundation: FOUNDATION_ID,
    },
    {
      code: "BOOK_PRODUCT_INACTIVE",
      store: store({
        current: [accepted()],
        bookProducts: [{ bookProductId: BOOK_ID, isActive: false }],
      }),
    },
    {
      code: "MALFORMED_MAPPING",
      store: store(),
      book: "not-a-uuid",
    },
    {
      code: "MAPPING_UNAVAILABLE",
      store: store({ available: false }),
    },
  ];

  for (const item of cases) {
    const result =
      item.foundation != null || item.owner != null
        ? mapping.resolveBookProduct(item.store, {
            foundationOwner: item.owner ?? "OFFICE_AZ",
            foundationProductId: item.foundation ?? FOUNDATION_ID,
            expectedMappingRevision: item.revision ?? 1,
          })
        : mapping.resolveFoundationProduct(item.store, {
            bookProductId: item.book ?? BOOK_ID,
            expectedMappingRevision: item.revision ?? 1,
          });
    assert.equal(result.ok, false, item.code);
    if (result.ok) continue;
    assert.equal(result.code, item.code);
  }
});

test("JAN/SKU/name evidence never converts denial into success", () => {
  const denied = mapping.reviewSnapshotNeverAuthorizesMapping(store({
    events: [
      {
        kind: "candidate",
        foundationProductId: FOUNDATION_ID,
        bookProductId: BOOK_ID,
        legalOwner: "OFFICE_AZ",
        foundationLifecycle: "active",
        foundationIdentityRevision: 1,
        mappingRevision: 0,
        evidenceDigest: DIGEST,
        reviewSnapshot: { jan: "4901234567890", sku: "SKU-1", name: "Coat" },
        successorFoundationProductId: null,
      },
    ],
  }), { jan: "4901234567890", sku: "SKU-1", name: "Coat" });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "NOT_CONFIGURED");

  const stillDenied = mapping.resolveFoundationProduct(store({
    events: [
      {
        kind: "candidate",
        foundationProductId: FOUNDATION_ID,
        bookProductId: BOOK_ID,
        legalOwner: "OFFICE_AZ",
        foundationLifecycle: "active",
        foundationIdentityRevision: 1,
        mappingRevision: 0,
        evidenceDigest: DIGEST,
        reviewSnapshot: { jan: "4901234567890", sku: "SKU-1", name: "Coat" },
        successorFoundationProductId: null,
      },
    ],
  }), { bookProductId: BOOK_ID, expectedMappingRevision: 1 });
  assert.equal(stillDenied.ok, false);
  if (stillDenied.ok) return;
  assert.equal(stillDenied.code, "MAPPING_UNCONFIRMED");
});

test("confirm requires trusted server context and is atomic", () => {
  const unauthorized = mapping.confirmFoundationProductMapping(store(), {
    trustedContext: null,
    foundationOwner: "OFFICE_AZ",
    foundationProductId: FOUNDATION_ID,
    bookProductId: BOOK_ID,
    foundationLifecycle: "active",
    foundationIdentityRevision: 1,
    expectedMappingRevision: 0,
    evidenceDigest: DIGEST,
    reviewSnapshot: { jan: "4901234567890" },
  });
  assert.equal(unauthorized.ok, false);
  if (unauthorized.ok) return;
  assert.equal(unauthorized.code, "UNAUTHORIZED");

  const confirmed = mapping.confirmFoundationProductMapping(store(), {
    trustedContext: trusted(),
    foundationOwner: "OFFICE_AZ",
    foundationProductId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    bookProductId: BOOK_ID,
    foundationLifecycle: "active",
    foundationIdentityRevision: 1,
    expectedMappingRevision: 0,
    evidenceDigest: DIGEST,
    reviewSnapshot: { jan: "4901234567890" },
  });
  assert.equal(confirmed.ok, true);
  if (confirmed.ok !== true || confirmed.store == null) return;
  assert.equal(confirmed.foundationProductId, FOUNDATION_ID);
  assert.equal(confirmed.store.current.length, 1);
  assert.equal(confirmed.store.events.length, 1);
  assert.equal(confirmed.store.events[0]?.kind, "confirm");

  const duplicate = mapping.confirmFoundationProductMapping(confirmed.store, {
    trustedContext: trusted(),
    foundationOwner: "OFFICE_AZ",
    foundationProductId: FOUNDATION_ID_OTHER,
    bookProductId: BOOK_ID,
    foundationLifecycle: "active",
    foundationIdentityRevision: 1,
    expectedMappingRevision: 0,
    evidenceDigest: DIGEST_B,
    reviewSnapshot: {},
  });
  assert.equal(duplicate.ok, false);
  if (duplicate.ok) return;
  assert.equal(duplicate.code, "DUPLICATE_MAPPING");

  const staleIdentity = mapping.confirmFoundationProductMapping(
    store({ current: [accepted({ foundationIdentityRevision: 2 })] }),
    {
      trustedContext: trusted(),
      foundationOwner: "OFFICE_AZ",
      foundationProductId: FOUNDATION_ID,
      bookProductId: BOOK_ID,
      foundationLifecycle: "active",
      foundationIdentityRevision: 1,
      expectedMappingRevision: 1,
      evidenceDigest: DIGEST_B,
      reviewSnapshot: {},
    },
  );
  assert.equal(staleIdentity.ok, false);
  if (staleIdentity.ok) return;
  assert.equal(staleIdentity.code, "stale_product_identity");
});

test("confirm keeps the accepted legal owner immutable", () => {
  const original = store({ current: [accepted()] });
  const result = mapping.confirmFoundationProductMapping(original, {
    trustedContext: trusted(),
    foundationOwner: "ATTRACTION",
    foundationProductId: FOUNDATION_ID,
    bookProductId: BOOK_ID,
    foundationLifecycle: "active",
    foundationIdentityRevision: 1,
    expectedMappingRevision: 1,
    evidenceDigest: DIGEST_B,
    reviewSnapshot: {},
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "OWNER_MISMATCH");
  assert.equal(original.current[0]?.legalOwner, "OFFICE_AZ");
  assert.equal(original.events.length, 0);
});

test("confirm rejects invalid lifecycle and successor combinations atomically", () => {
  const cases = [
    {
      lifecycle: "superseded" as const,
      successor: undefined,
      label: "superseded without successor",
    },
    {
      lifecycle: "active" as const,
      successor: FOUNDATION_ID_OTHER,
      label: "successor on active",
    },
    {
      lifecycle: "suspended" as const,
      successor: FOUNDATION_ID_OTHER,
      label: "successor on suspended",
    },
    {
      lifecycle: "retired" as const,
      successor: FOUNDATION_ID_OTHER,
      label: "successor on retired",
    },
    {
      lifecycle: "superseded" as const,
      successor: FOUNDATION_ID,
      label: "self successor",
    },
  ];

  for (const item of cases) {
    const original = store({ current: [accepted()] });
    const result = mapping.confirmFoundationProductMapping(original, {
      trustedContext: trusted(),
      foundationOwner: "OFFICE_AZ",
      foundationProductId: FOUNDATION_ID,
      bookProductId: BOOK_ID,
      foundationLifecycle: item.lifecycle,
      foundationIdentityRevision: 1,
      expectedMappingRevision: 1,
      evidenceDigest: DIGEST_B,
      reviewSnapshot: {},
      successorFoundationProductId: item.successor,
    });
    assert.equal(result.ok, false, item.label);
    if (result.ok) continue;
    assert.equal(result.code, "MALFORMED_MAPPING", item.label);
    assert.equal(original.current[0]?.foundationLifecycle, "active", item.label);
    assert.equal(original.events.length, 0, item.label);
  }

  const valid = mapping.confirmFoundationProductMapping(
    store({ current: [accepted()] }),
    {
      trustedContext: trusted(),
      foundationOwner: "OFFICE_AZ",
      foundationProductId: FOUNDATION_ID,
      bookProductId: BOOK_ID,
      foundationLifecycle: "superseded",
      foundationIdentityRevision: 1,
      expectedMappingRevision: 1,
      evidenceDigest: DIGEST_B,
      reviewSnapshot: {},
      successorFoundationProductId: FOUNDATION_ID_OTHER,
    },
  );
  assert.equal(valid.ok, true);
  if (valid.ok !== true) return;
  assert.equal(valid.successorFoundationProductId, FOUNDATION_ID_OTHER);
});

test("trusted context accepts 512 characters and denies 513", () => {
  const exactBoundary = "x".repeat(512);
  const acceptedBoundary = mapping.confirmFoundationProductMapping(store(), {
    trustedContext: {
      ...trusted(),
      authoritySource: exactBoundary,
    },
    foundationOwner: "OFFICE_AZ",
    foundationProductId: FOUNDATION_ID,
    bookProductId: BOOK_ID,
    foundationLifecycle: "active",
    foundationIdentityRevision: 1,
    expectedMappingRevision: 0,
    evidenceDigest: DIGEST,
    reviewSnapshot: {},
  });
  assert.equal(acceptedBoundary.ok, true);

  const deniedBoundary = mapping.confirmFoundationProductMapping(store(), {
    trustedContext: {
      ...trusted(),
      authoritySource: "x".repeat(513),
    },
    foundationOwner: "OFFICE_AZ",
    foundationProductId: FOUNDATION_ID,
    bookProductId: BOOK_ID,
    foundationLifecycle: "active",
    foundationIdentityRevision: 1,
    expectedMappingRevision: 0,
    evidenceDigest: DIGEST,
    reviewSnapshot: {},
  });
  assert.equal(deniedBoundary.ok, false);
  if (deniedBoundary.ok) return;
  assert.equal(deniedBoundary.code, "UNAUTHORIZED");
});

test("superseded mappings never auto-remap", () => {
  const result = mapping.resolveBookProduct(
    store({
      current: [
        accepted({
          foundationLifecycle: "superseded",
          successorFoundationProductId: FOUNDATION_ID_OTHER,
        }),
      ],
    }),
    {
      foundationOwner: "OFFICE_AZ",
      foundationProductId: FOUNDATION_ID,
      expectedMappingRevision: 1,
    },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "MAPPING_SUPERSEDED");
});

test("module stays isolated from routes, UI, D3A, and dual-write", () => {
  assert.match(rawModule, /^import "server-only";/);
  assert.doesNotMatch(rawModule, /getGyeonProducts/);
  assert.doesNotMatch(rawModule, /foundation-persistence-adaptor/);
  assert.doesNotMatch(rawModule, /createInventoryCommandDispatch/);
  assert.doesNotMatch(rawModule, /from "next\//);
  assert.doesNotMatch(rawModule, /supabase/);
});

test("migration statically enforces RLS, grants, uniqueness, FK, and append-only history", () => {
  assert.match(migration, /create schema if not exists foundation_product_mapping_private/);
  for (const table of ["current_mappings", "mapping_events"]) {
    assert.match(
      migration,
      new RegExp(`alter table foundation_product_mapping_private\\.${table} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(`alter table foundation_product_mapping_private\\.${table} force row level security`),
    );
  }
  assert.doesNotMatch(migration, /create policy/i);
  assert.match(
    migration,
    /revoke all on all tables in schema foundation_product_mapping_private[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on all sequences in schema foundation_product_mapping_private[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 3);
  assert.match(migration, /revoke all on function foundation_product_mapping_private.apply_confirmed_mapping/);
  assert.match(migration, /grant execute on function foundation_product_mapping_private.apply_confirmed_mapping/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to public/);
  assert.match(migration, /create unique index current_mappings_book_product_uidx/);
  assert.match(migration, /primary key \(foundation_product_id\)/);
  assert.match(migration, /foreign key \(book_product_id\) references public\.gyeon_products \(id\)/);
  assert.doesNotMatch(migration, /alter table public\.gyeon_products/);
  assert.match(migration, /mapping_events_are_append_only/);
  assert.match(migration, /insert into foundation_product_mapping_private.current_mappings/);
  assert.match(migration, /insert into foundation_product_mapping_private.mapping_events/);
  assert.match(migration, /exception when unique_violation/);
  assert.match(migration, /exception when others/);
});

test("migration fails closed on owner, revision, lifecycle, and successor drift", () => {
  assert.match(
    migration,
    /v_current\.legal_owner is distinct from p_legal_owner[\s\S]*OWNER_MISMATCH/,
  );
  assert.equal(
    (migration.match(/v_current\.foundation_identity_revision > p_foundation_identity_revision/g) ?? [])
      .length,
    2,
  );
  assert.match(
    migration,
    /foundation_lifecycle = 'superseded'[\s\S]*successor_foundation_product_id <> foundation_product_id/,
  );
  assert.match(
    migration,
    /event_kind = 'suspend' and foundation_lifecycle = 'suspended'/,
  );
  assert.match(
    migration,
    /event_kind = 'retire' and foundation_lifecycle = 'retired'/,
  );
  assert.match(
    migration,
    /event_kind = 'supersede' and foundation_lifecycle = 'superseded'/,
  );
  assert.match(
    migration,
    /if p_event_kind in \('suspend', 'retire', 'supersede'\) then[\s\S]*for update/,
  );
  assert.match(
    migration,
    /p_event_kind not in \('candidate', 'rejection', 'suspend', 'retire', 'supersede'\)/,
  );
});

test("disposable script is authored as Gate C only and never auto-runs a database", () => {
  assert.match(script, /I_ACKNOWLEDGE_FRESH_DISPOSABLE_LOCAL_DATABASE_ONLY/);
  assert.match(script, /NON_LOOPBACK_DATABASE_FORBIDDEN/);
  assert.match(script, /20260919103125_foundation_product_mapping.sql/);
  assert.match(script, /fresh-runtime/);
  assert.match(script, /genuine-claim/);
  assert.match(script, /concurrency/);
  assert.match(script, /rollback/);
  assert.match(script, /RLS/);
  assert.match(script, /cleanup/);
  assert.doesNotMatch(script, /docker|colima/i);
});
