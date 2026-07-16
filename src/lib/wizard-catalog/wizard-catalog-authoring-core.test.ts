// C2C3 — DI unit tests for the pure authoring/review core (no database, no mocks).
// Run: node --import tsx --test src/lib/wizard-catalog/wizard-catalog-authoring-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runSaveCatalogItem,
  runArchiveCatalogItem,
  runConfirmCatalogReview,
  buildUpsertPayload,
  type UpsertDeps,
  type ArchiveDeps,
  type ReviewDeps,
} from "./wizard-catalog-authoring-core";
import type { WizardCatalogItemInput } from "./wizard-catalog-authoring-types";
import type { DealerStaffRole } from "@/lib/staff/staff-types";
import type { RankResolution } from "@/lib/dealer-settings/authoritative-shop-rank-core";

const DEALER = "d0000000-0000-0000-0000-000000000001";

// A recorder captures whether (and with what dealer id) the RPC was invoked.
function recorder() {
  const calls: { dealerId: string; arg: unknown }[] = [];
  return {
    calls,
    record(dealerId: string, arg: unknown) {
      calls.push({ dealerId, arg });
    },
  };
}

function upsertDeps(
  over: Partial<UpsertDeps> & { rec?: ReturnType<typeof recorder> } = {},
): UpsertDeps {
  const rec = over.rec ?? recorder();
  return {
    getDealer: over.getDealer ?? (async () => ({ dealer_id: DEALER })),
    getStaffRole: over.getStaffRole ?? (async (): Promise<DealerStaffRole> => "owner"),
    upsert:
      over.upsert ??
      (async (dealerId, input) => {
        rec.record(dealerId, input);
        return { ok: true, itemId: "item-1", code: "maint-uuid", kind: input.kind, action: "created" };
      }),
  };
}

const VALID: WizardCatalogItemInput = { kind: "maintenance_menu", labelJa: "オイル交換" };

// ── payload / input shape ─────────────────────────────────────────────────────

test("buildUpsertPayload never emits a dealer_id / tenancy key", () => {
  const p = buildUpsertPayload({
    kind: "store_global_option",
    labelJa: "出張費",
    priceable: true,
    quantityRequired: true,
    minQuantity: 1,
    maxQuantity: 3,
  });
  assert.deepEqual(Object.keys(p).sort(), [
    "label_ja",
    "max_quantity",
    "min_quantity",
    "priceable",
    "quantity_required",
  ]);
  assert.ok(!("dealer_id" in p) && !("dealerId" in p) && !("owner_scope" in p));
});

test("buildUpsertPayload includes only defined fields (undefined omitted)", () => {
  const p = buildUpsertPayload({ kind: "film_type", labelJa: "UV90", defaultUnitPrice: 12000 });
  assert.deepEqual(p, { label_ja: "UV90", default_unit_price: 12000 });
});

// ── save: gate ────────────────────────────────────────────────────────────────

test("save: missing dealer fails and never calls the RPC", async () => {
  const rec = recorder();
  const res = await runSaveCatalogItem(upsertDeps({ rec, getDealer: async () => null }), VALID);
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.code, "DEALER_CONTEXT_REQUIRED");
  assert.equal(rec.calls.length, 0);
});

test("save: insufficient capability (staff) fails and never calls the RPC", async () => {
  const rec = recorder();
  const res = await runSaveCatalogItem(
    upsertDeps({ rec, getStaffRole: async () => "staff" }),
    VALID,
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.code, "PERMISSION_DENIED");
  assert.equal(rec.calls.length, 0);
});

test("save: readonly role fails", async () => {
  const res = await runSaveCatalogItem(upsertDeps({ getStaffRole: async () => "readonly" }), VALID);
  assert.equal(res.ok === false && res.code, "PERMISSION_DENIED");
});

test("save: manager IS permitted (matches wiz_can_configure)", async () => {
  const rec = recorder();
  const res = await runSaveCatalogItem(upsertDeps({ rec, getStaffRole: async () => "manager" }), VALID);
  assert.equal(res.ok, true);
  assert.equal(rec.calls.length, 1);
});

// ── save: validation short-circuits before the RPC ────────────────────────────

test("save: unsupported kind fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runSaveCatalogItem(
    upsertDeps({ rec }),
    { kind: "coupon" as unknown as WizardCatalogItemInput["kind"], labelJa: "x" },
  );
  assert.equal(res.ok === false && res.code, "UNSUPPORTED_KIND");
  assert.equal(rec.calls.length, 0);
});

test("save: empty label fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runSaveCatalogItem(upsertDeps({ rec }), { kind: "wash_menu", labelJa: "   " });
  assert.equal(res.ok === false && res.code, "VALIDATION_ERROR");
  assert.equal(rec.calls.length, 0);
});

// ── save: dealer injection + success + RPC failure mapping ────────────────────

test("save: injects the server-resolved dealer id into the RPC", async () => {
  const rec = recorder();
  await runSaveCatalogItem(upsertDeps({ rec }), VALID);
  assert.equal(rec.calls.length, 1);
  assert.equal(rec.calls[0].dealerId, DEALER);
});

test("save: success returns a stable item result", async () => {
  const res = await runSaveCatalogItem(upsertDeps(), VALID);
  assert.deepEqual(res, {
    ok: true,
    itemId: "item-1",
    code: "maint-uuid",
    kind: "maintenance_menu",
    action: "created",
  });
});

test("save: RPC failure maps to a safe typed RPC_ERROR (no raw text)", async () => {
  const res = await runSaveCatalogItem(
    upsertDeps({ upsert: async () => ({ ok: false }) }),
    VALID,
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.code, "RPC_ERROR");
  assert.equal(res.ok === false && res.message, "保存に失敗しました");
});

// ── archive ───────────────────────────────────────────────────────────────────

function archiveDeps(over: Partial<ArchiveDeps> & { rec?: ReturnType<typeof recorder> } = {}): ArchiveDeps {
  const rec = over.rec ?? recorder();
  return {
    getDealer: over.getDealer ?? (async () => ({ dealer_id: DEALER })),
    getStaffRole: over.getStaffRole ?? (async (): Promise<DealerStaffRole> => "owner"),
    archive:
      over.archive ??
      (async (dealerId, id) => {
        rec.record(dealerId, id);
        return { ok: true, itemId: id, action: "archived" };
      }),
  };
}

test("archive: missing dealer fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runArchiveCatalogItem(archiveDeps({ rec, getDealer: async () => null }), "item-1");
  assert.equal(res.ok === false && res.code, "DEALER_CONTEXT_REQUIRED");
  assert.equal(rec.calls.length, 0);
});

test("archive: empty item id fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runArchiveCatalogItem(archiveDeps({ rec }), "   ");
  assert.equal(res.ok === false && res.code, "VALIDATION_ERROR");
  assert.equal(rec.calls.length, 0);
});

test("archive: injects dealer id and returns stable result", async () => {
  const rec = recorder();
  const res = await runArchiveCatalogItem(archiveDeps({ rec }), "item-9");
  assert.deepEqual(res, { ok: true, itemId: "item-9", action: "archived" });
  assert.equal(rec.calls[0].dealerId, DEALER);
});

test("archive: already-archived is surfaced idempotently", async () => {
  const res = await runArchiveCatalogItem(
    archiveDeps({ archive: async (_d, id) => ({ ok: true, itemId: id, action: "already_archived" }) }),
    "item-9",
  );
  assert.deepEqual(res, { ok: true, itemId: "item-9", action: "already_archived" });
});

test("archive: RPC failure maps to RPC_ERROR", async () => {
  const res = await runArchiveCatalogItem(archiveDeps({ archive: async () => ({ ok: false }) }), "item-9");
  assert.equal(res.ok === false && res.code, "RPC_ERROR");
});

// ── review ────────────────────────────────────────────────────────────────────

function reviewDeps(over: Partial<ReviewDeps> & { rec?: ReturnType<typeof recorder> } = {}): ReviewDeps {
  const rec = over.rec ?? recorder();
  return {
    getDealer: over.getDealer ?? (async () => ({ dealer_id: DEALER })),
    getStaffRole: over.getStaffRole ?? (async (): Promise<DealerStaffRole> => "owner"),
    getRank: over.getRank ?? (async (): Promise<RankResolution> => ({ ok: true, rank: "certified" })),
    confirm:
      over.confirm ??
      (async (dealerId) => {
        rec.record(dealerId, undefined);
        return { ok: true, reviewedRevision: 3 };
      }),
  };
}

test("review: missing dealer fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runConfirmCatalogReview(reviewDeps({ rec, getDealer: async () => null }));
  assert.equal(res.ok === false && res.code, "DEALER_CONTEXT_REQUIRED");
  assert.equal(rec.calls.length, 0);
});

test("review: insufficient capability fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runConfirmCatalogReview(reviewDeps({ rec, getStaffRole: async () => "staff" }));
  assert.equal(res.ok === false && res.code, "PERMISSION_DENIED");
  assert.equal(rec.calls.length, 0);
});

test("review: unresolved rank fails without calling the RPC", async () => {
  const rec = recorder();
  const res = await runConfirmCatalogReview(
    reviewDeps({ rec, getRank: async () => ({ ok: false, reason: "missing" }) }),
  );
  assert.equal(res.ok === false && res.code, "RANK_UNAVAILABLE");
  assert.equal(rec.calls.length, 0);
});

test("review: injects ONLY the dealer id (no rank reaches the RPC)", async () => {
  const rec = recorder();
  const res = await runConfirmCatalogReview(reviewDeps({ rec }));
  assert.deepEqual(res, { ok: true, state: "CATALOG_REVIEWED", reviewedRevision: 3 });
  assert.equal(rec.calls[0].dealerId, DEALER);
  assert.equal(rec.calls[0].arg, undefined); // rank is resolved DB-side, never passed
});

test("review: RPC failure maps to RPC_ERROR", async () => {
  const res = await runConfirmCatalogReview(reviewDeps({ confirm: async () => ({ ok: false }) }));
  assert.equal(res.ok === false && res.code, "RPC_ERROR");
});
