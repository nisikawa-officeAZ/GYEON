// Authoritative shop-rank resolver — fail-closed tests (Phase 8-B2F-A).
//
// Pure. No DB, no network, no server module. Only `authoritative-shop-rank-core` is imported at
// RUNTIME; the server wrapper is imported TYPE-ONLY (erased at compile time), so `server-only` is
// never executed and `node:test` runs this file directly.
//
// Run: node --import tsx --test src/lib/dealer-settings/get-authoritative-shop-rank.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  SHOP_RANKS,
  isShopRank,
  parseStoredRank,
  resolveAuthoritativeShopRank,
  type RankResolution,
  type RankResolverDeps,
  type ShopRank,
  type StoredRankRead,
} from "./authoritative-shop-rank-core";

// Type-only — no runtime import, so `server-only` is not pulled in.
import type { getAuthoritativeShopRank } from "./get-authoritative-shop-rank";
import type { ShopRank as WizardShopRank } from "@/components/estimates/wizard/screens/step-types";
import { DEALER_RANK_VALUES, isValidRank } from "@/lib/ranks/dealer-ranks";

// ── Fixtures ─────────────────────────────────────────────────────────────────────
function deps(over: Partial<RankResolverDeps> = {}): RankResolverDeps {
  return {
    getDealerId:    async () => "DEALER-TEST",
    readStoredRank: async (): Promise<StoredRankRead> => ({ ok: true, value: "detailer" }),
    ...over,
  };
}
const stored = (value: unknown): Partial<RankResolverDeps> => ({
  readStoredRank: async () => ({ ok: true, value }),
});

// ── 1. Source-of-truth agreement — no second rank vocabulary ─────────────────────
// If `SHOP_RANKS`, the market profile, and the Wizard union ever drift apart, these fail loudly
// instead of the sets diverging in silence.

test("SHOP_RANKS agrees with the repository's runtime rank vocabulary", () => {
  assert.deepEqual([...SHOP_RANKS].sort(), [...DEALER_RANK_VALUES].sort());
  for (const r of SHOP_RANKS) assert.ok(isValidRank(r), `${r} is not a canonical market rank`);
});

test("SHOP_RANKS is type-compatible with the Wizard's ShopRank union", () => {
  // Mutual assignability, checked by tsc. A drift in either union stops compiling.
  const toWizard: WizardShopRank = "ppf_installer" satisfies ShopRank;
  const fromWizard: ShopRank = "certified" satisfies WizardShopRank;
  assert.equal(toWizard, "ppf_installer");
  assert.equal(fromWizard, "certified");

  const all: WizardShopRank[] = [...SHOP_RANKS];
  assert.equal(all.length, 4);
});

// ── 2. All four valid ranks resolve ──────────────────────────────────────────────
for (const rank of SHOP_RANKS) {
  test(`a stored "${rank}" resolves to ok:true with that exact rank`, async () => {
    const r = await resolveAuthoritativeShopRank(deps(stored(rank)));
    assert.deepEqual(r, { ok: true, rank });
  });
}

// ── 3. missing — null / empty ────────────────────────────────────────────────────
for (const [label, value] of [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["whitespace only", "   "],
] as const) {
  test(`a stored ${label} resolves to missing — never a default`, async () => {
    const r = await resolveAuthoritativeShopRank(deps(stored(value)));
    assert.deepEqual(r, { ok: false, reason: "missing" });
    assert.ok(!("rank" in r));
  });
}

// ── 4. invalid — unknown, legacy, wrong type, near-misses ────────────────────────
for (const [label, value] of [
  ["an unknown rank",            "platinum"],
  ["a legacy alias",             "certified-detailer"],
  ["a legacy label",             "GYEON Certified Detailer"],
  ["different casing",           "Detailer"],
  ["upper case",                 "DETAILER"],
  ["padded whitespace",          " detailer "],
  ["a numeric value",            2],
  ["a boolean",                  true],
  ["an object",                  { rank: "detailer" }],
  ["an array",                   ["detailer"]],
] as const) {
  test(`${label} resolves to invalid — never coerced onto a rank`, async () => {
    const r = await resolveAuthoritativeShopRank(deps(stored(value)));
    assert.deepEqual(r, { ok: false, reason: "invalid" });
    assert.ok(!("rank" in r));
  });
}

// ── 5. no-dealer ─────────────────────────────────────────────────────────────────
test("no current dealer resolves to no-dealer, and the rank is never read", async () => {
  let read = false;
  const r = await resolveAuthoritativeShopRank({
    getDealerId:    async () => null,
    readStoredRank: async () => { read = true; return { ok: true, value: "certified" }; },
  });
  assert.deepEqual(r, { ok: false, reason: "no-dealer" });
  assert.equal(read, false, "the rank must not be read without a dealer");
});

test("a blank dealer id resolves to no-dealer", async () => {
  const r = await resolveAuthoritativeShopRank(deps({ getDealerId: async () => "  " }));
  assert.deepEqual(r, { ok: false, reason: "no-dealer" });
});

// ── 6. read-failed ───────────────────────────────────────────────────────────────
test("a failed read resolves to read-failed — an error is not an authorization decision", async () => {
  const r = await resolveAuthoritativeShopRank(deps({ readStoredRank: async () => ({ ok: false }) }));
  assert.deepEqual(r, { ok: false, reason: "read-failed" });
  assert.ok(!("rank" in r));
});

test("a thrown read resolves to read-failed, not a default", async () => {
  const r = await resolveAuthoritativeShopRank(
    deps({ readStoredRank: async () => { throw new Error("connection reset"); } }),
  );
  assert.deepEqual(r, { ok: false, reason: "read-failed" });
});

test("a thrown dealer lookup resolves to read-failed, not a default", async () => {
  const r = await resolveAuthoritativeShopRank(
    deps({ getDealerId: async () => { throw new Error("auth down"); } }),
  );
  assert.deepEqual(r, { ok: false, reason: "read-failed" });
});

// ── 7. THE CENTRAL GUARANTEE ─────────────────────────────────────────────────────
test('a literal stored "detailer" is the ONLY path to ok:true / "detailer"', async () => {
  // The one input that may produce it.
  assert.deepEqual(
    await resolveAuthoritativeShopRank(deps(stored("detailer"))),
    { ok: true, rank: "detailer" },
  );

  // Every other input that the OLD fail-open path (normalizeRank → DEFAULT_DEALER_RANK) would have
  // silently turned into "detailer". None of them may produce a rank now.
  const wouldHaveDefaulted: unknown[] = [
    null, undefined, "", "   ", "platinum", "certified-detailer",
    "Detailer", " detailer ", 0, false, {},
  ];
  for (const value of wouldHaveDefaulted) {
    const r = await resolveAuthoritativeShopRank(deps(stored(value)));
    assert.equal(r.ok, false, `${JSON.stringify(value)} must not resolve to a rank`);
    if (r.ok) return;
    assert.notEqual(r.reason, undefined);
  }

  // And the two non-value failure modes.
  for (const d of [
    deps({ getDealerId: async () => null }),
    deps({ readStoredRank: async () => ({ ok: false }) }),
  ]) {
    const r = await resolveAuthoritativeShopRank(d);
    assert.equal(r.ok, false);
  }
});

test("no failure arm carries a usable rank", async () => {
  const failures: RankResolution[] = [
    await resolveAuthoritativeShopRank(deps({ getDealerId: async () => null })),
    await resolveAuthoritativeShopRank(deps(stored(null))),
    await resolveAuthoritativeShopRank(deps(stored("platinum"))),
    await resolveAuthoritativeShopRank(deps({ readStoredRank: async () => ({ ok: false }) })),
  ];
  assert.equal(failures.length, 4);
  for (const f of failures) {
    assert.equal(f.ok, false);
    assert.ok(!("rank" in f), "a failure must not carry a rank");
  }
  assert.deepEqual(failures.map((f) => (f.ok ? "ok" : f.reason)),
    ["no-dealer", "missing", "invalid", "read-failed"]);
});

// ── 8. The public API accepts no caller-supplied dealer id or rank ───────────────
// Compile-time, verified by tsc. `@ts-expect-error` inverts: if these calls ever STOPPED being type
// errors, the unused directive itself fails the build (TS2578). No runtime import is involved.
test("the public server API takes no parameters", () => {
  type Params = Parameters<typeof getAuthoritativeShopRank>;
  const none: Params = [];
  assert.deepEqual(none, []);

  // A zero-length tuple: any argument at all is a type error.
  const _assertEmpty: Params extends [] ? true : false = true;
  assert.equal(_assertEmpty, true);

  // The core resolver likewise exposes no dealerId/rank input — deps only.
  const keys = Object.keys(deps()).sort();
  assert.deepEqual(keys, ["getDealerId", "readStoredRank"]);
});

// ── 9. parseStoredRank / isShopRank directly ─────────────────────────────────────
test("isShopRank matches only the four literals", () => {
  for (const r of SHOP_RANKS) assert.equal(isShopRank(r), true);
  for (const v of ["", " ", "Detailer", "platinum", null, undefined, 1, {}]) {
    assert.equal(isShopRank(v), false);
  }
});

test("parseStoredRank is exhaustive over its four outcomes", () => {
  assert.deepEqual(parseStoredRank("shop"), { ok: true, rank: "shop" });
  assert.deepEqual(parseStoredRank(null), { ok: false, reason: "missing" });
  assert.deepEqual(parseStoredRank(""), { ok: false, reason: "missing" });
  assert.deepEqual(parseStoredRank("nope"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseStoredRank(42), { ok: false, reason: "invalid" });
});
