// GDA-1W-C3 — Pure contract tests for work-order-completion-contract-core.ts.
//
// Plain `node:test` + `node:assert/strict`, mirroring the repository's pure-core test convention
// (run with `node --import tsx --test <file>`). No React, no Supabase, no DB, no network, no clock
// reads — every instant is constructed explicitly.
//
// ── SHARED FINGERPRINT VECTORS ──────────────────────────────────────────────────
// The vectors in the "canonical fingerprint" section are the TS↔PostgreSQL contract evidence
// required by GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md §5.4 / §10.1. The CANONICAL JSON TEXT is the
// shared artifact: the PostgreSQL test (supabase/tests/work_order_completion_authority.test.sql)
// must build byte-identical text with its `to_json(text)::text` concatenation for the same inputs,
// and `encode(sha256(convert_to(text, 'UTF8')), 'hex')` of that text must equal the TS-side
// `createHash("sha256")` digest asserted here. The text literals below are therefore copied
// verbatim into the SQL test; changing either side without the other is a contract break.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

import {
  ACTUAL_END_AT_MAX_FUTURE_MS,
  COMPLETION_CONTRACT_VERSION,
  IDEMPOTENCY_KEY_MAX,
  IDEMPOTENCY_KEY_MIN,
  PERFORMED_ITEM_CATEGORY_MAX,
  PERFORMED_ITEM_DESCRIPTION_MAX,
  PERFORMED_ITEM_NAME_MAX,
  PERFORMED_ITEMS_MAX,
  PERFORMED_ITEMS_MIN,
  buildCompletionFingerprintCanonicalJson,
  canTransitionToCompleted,
  canonicalUtcInstant,
  isCanonicalFingerprint,
  validateActualEndAt,
  validateIdempotencyKey,
  validatePerformedWorkItems,
  type NormalizedPerformedWorkItem,
} from "./work-order-completion-contract-core";

const sha256Hex = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

const validItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  category: "コーティング",
  itemName: "GYEON施工",
  description: null,
  ...overrides,
});

// ─── Contract constants ─────────────────────────────────────────────────────────

describe("contract constants", () => {
  it("pin the accepted §3.2 / §3.4 / §4.3 limits", () => {
    assert.equal(COMPLETION_CONTRACT_VERSION, 1);
    assert.equal(PERFORMED_ITEM_CATEGORY_MAX, 100);
    assert.equal(PERFORMED_ITEM_NAME_MAX, 200);
    assert.equal(PERFORMED_ITEM_DESCRIPTION_MAX, 2000);
    assert.equal(PERFORMED_ITEMS_MIN, 1);
    assert.equal(PERFORMED_ITEMS_MAX, 100);
    assert.equal(IDEMPOTENCY_KEY_MIN, 16);
    assert.equal(IDEMPOTENCY_KEY_MAX, 128);
    assert.equal(ACTUAL_END_AT_MAX_FUTURE_MS, 5 * 60 * 1000);
  });
});

// ─── Completion state transition (§3.4) ─────────────────────────────────────────

describe("canTransitionToCompleted", () => {
  it("permits exactly scheduled, in_progress, and on_hold", () => {
    assert.equal(canTransitionToCompleted("scheduled"), true);
    assert.equal(canTransitionToCompleted("in_progress"), true);
    assert.equal(canTransitionToCompleted("on_hold"), true);
  });

  it("forbids cancelled and treats completed as terminal", () => {
    assert.equal(canTransitionToCompleted("cancelled"), false);
    assert.equal(canTransitionToCompleted("completed"), false);
  });

  it("rejects unknown text and non-strings without coercion", () => {
    assert.equal(canTransitionToCompleted("SCHEDULED"), false);
    assert.equal(canTransitionToCompleted(" scheduled"), false);
    assert.equal(canTransitionToCompleted(""), false);
    assert.equal(canTransitionToCompleted(null), false);
    assert.equal(canTransitionToCompleted(undefined), false);
    assert.equal(canTransitionToCompleted(0), false);
    assert.equal(canTransitionToCompleted({}), false);
  });
});

// ─── Performed-work snapshot validation (§3.2) ──────────────────────────────────

describe("validatePerformedWorkItems — container shape", () => {
  it("rejects non-arrays", () => {
    for (const bad of [null, undefined, "x", 1, {}, { length: 1 }]) {
      const result = validatePerformedWorkItems(bad);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "VALIDATION_ERROR");
    }
  });

  it("rejects an empty array (minimum 1 item)", () => {
    assert.equal(validatePerformedWorkItems([]).ok, false);
  });

  it("accepts exactly 100 items and rejects 101", () => {
    const hundred = Array.from({ length: 100 }, () => validItem());
    assert.equal(validatePerformedWorkItems(hundred).ok, true);
    const hundredOne = Array.from({ length: 101 }, () => validItem());
    assert.equal(validatePerformedWorkItems(hundredOne).ok, false);
  });

  it("rejects non-object elements, including arrays and null", () => {
    for (const bad of [null, "x", 1, [], [validItem()]]) {
      assert.equal(validatePerformedWorkItems([bad]).ok, false);
    }
  });
});

describe("validatePerformedWorkItems — exact key set", () => {
  it("rejects monetary keys by name rather than ignoring them", () => {
    const monetaryKeys = [
      "quantity",
      "unitPrice",
      "lineTotal",
      "tax",
      "discount",
      "cost",
      "margin",
    ];
    for (const key of monetaryKeys) {
      const result = validatePerformedWorkItems([validItem({ [key]: 1000 })]);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.detail, new RegExp(`forbidden key "${key}"`));
      }
    }
  });

  it("rejects any other extra key, even a harmless-looking one", () => {
    const result = validatePerformedWorkItems([validItem({ sortOrder: 0 })]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.detail, /forbidden key "sortOrder"/);
  });

  it("requires every one of the three keys — description absence is not implicit null", () => {
    for (const missing of ["category", "itemName", "description"]) {
      const item = validItem();
      delete item[missing];
      const result = validatePerformedWorkItems([item]);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.detail, new RegExp(`missing required key "${missing}"`));
    }
  });
});

describe("validatePerformedWorkItems — field rules", () => {
  it("trims category and itemName and enforces post-trim length 1-100 / 1-200", () => {
    const ok = validatePerformedWorkItems([
      validItem({ category: "  coating  ", itemName: "  full body  " }),
    ]);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.items[0]?.category, "coating");
      assert.equal(ok.items[0]?.itemName, "full body");
    }

    assert.equal(validatePerformedWorkItems([validItem({ category: "   " })]).ok, false);
    assert.equal(validatePerformedWorkItems([validItem({ itemName: "" })]).ok, false);
    assert.equal(validatePerformedWorkItems([validItem({ category: "a".repeat(100) })]).ok, true);
    assert.equal(validatePerformedWorkItems([validItem({ category: "a".repeat(101) })]).ok, false);
    assert.equal(validatePerformedWorkItems([validItem({ itemName: "a".repeat(200) })]).ok, true);
    assert.equal(validatePerformedWorkItems([validItem({ itemName: "a".repeat(201) })]).ok, false);
    // Whitespace padding beyond the limit is fine when the TRIMMED text is within it.
    assert.equal(
      validatePerformedWorkItems([validItem({ category: ` ${"a".repeat(100)} ` })]).ok,
      true,
    );
  });

  it("rejects non-string category/itemName without coercion", () => {
    for (const bad of [null, undefined, 1, true, {}, []]) {
      assert.equal(validatePerformedWorkItems([validItem({ category: bad })]).ok, false);
      assert.equal(validatePerformedWorkItems([validItem({ itemName: bad })]).ok, false);
    }
  });

  it("description: null passes, trimmed-empty becomes null, 2000 passes, 2001 fails", () => {
    const nulled = validatePerformedWorkItems([validItem({ description: null })]);
    assert.equal(nulled.ok, true);
    if (nulled.ok) assert.equal(nulled.items[0]?.description, null);

    const blank = validatePerformedWorkItems([validItem({ description: "   " })]);
    assert.equal(blank.ok, true);
    if (blank.ok) assert.equal(blank.items[0]?.description, null);

    const trimmed = validatePerformedWorkItems([validItem({ description: "  memo  " })]);
    assert.equal(trimmed.ok, true);
    if (trimmed.ok) assert.equal(trimmed.items[0]?.description, "memo");

    assert.equal(
      validatePerformedWorkItems([validItem({ description: "a".repeat(2000) })]).ok,
      true,
    );
    assert.equal(
      validatePerformedWorkItems([validItem({ description: "a".repeat(2001) })]).ok,
      false,
    );
  });

  it("rejects non-string non-null description", () => {
    for (const bad of [undefined, 1, true, {}, []]) {
      assert.equal(validatePerformedWorkItems([validItem({ description: bad })]).ok, false);
    }
  });

  it("derives sortOrder from array position beginning at 0", () => {
    const result = validatePerformedWorkItems([
      validItem({ itemName: "first" }),
      validItem({ itemName: "second" }),
      validItem({ itemName: "third" }),
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.items.map((item) => item.sortOrder),
        [0, 1, 2],
      );
      assert.deepEqual(
        result.items.map((item) => item.itemName),
        ["first", "second", "third"],
      );
    }
  });
});

// ─── Idempotency key (§4.3) ─────────────────────────────────────────────────────

describe("validateIdempotencyKey", () => {
  it("rejects non-strings", () => {
    for (const bad of [null, undefined, 16, {}, []]) {
      assert.equal(validateIdempotencyKey(bad).ok, false);
    }
  });

  it("trims, then enforces length 16-128", () => {
    assert.equal(validateIdempotencyKey("a".repeat(15)).ok, false);
    assert.equal(validateIdempotencyKey("a".repeat(16)).ok, true);
    assert.equal(validateIdempotencyKey("a".repeat(128)).ok, true);
    assert.equal(validateIdempotencyKey("a".repeat(129)).ok, false);

    const padded = validateIdempotencyKey(`  ${"k".repeat(20)}  `);
    assert.equal(padded.ok, true);
    if (padded.ok) assert.equal(padded.key, "k".repeat(20));

    // 16 characters INCLUDING padding is only 12 after trimming — length is post-trim.
    assert.equal(validateIdempotencyKey(`  ${"k".repeat(12)}  `).ok, false);
  });
});

// ─── actual_end_at window (§3.4) ────────────────────────────────────────────────

describe("validateActualEndAt", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  it("rejects invalid instants for end, start, and now", () => {
    assert.equal(validateActualEndAt(new Date(NaN), null, now).ok, false);
    assert.equal(validateActualEndAt(now, new Date(NaN), now).ok, false);
    assert.equal(validateActualEndAt(now, null, new Date(NaN)).ok, false);
  });

  it("requires end >= start only when a start exists", () => {
    const start = new Date("2026-08-10T09:00:00.000Z");
    assert.equal(validateActualEndAt(new Date("2026-08-10T08:59:59.999Z"), start, now).ok, false);
    assert.equal(validateActualEndAt(start, start, now).ok, true); // equal is permitted
    assert.equal(validateActualEndAt(new Date("2026-08-10T10:00:00.000Z"), start, now).ok, true);
    // No start on record: an early end is not comparable to anything and passes the start rule.
    assert.equal(validateActualEndAt(new Date("2026-08-10T00:00:00.000Z"), null, now).ok, true);
  });

  it("permits up to now + 5 minutes exactly and rejects one millisecond beyond", () => {
    const atLimit = new Date(now.getTime() + ACTUAL_END_AT_MAX_FUTURE_MS);
    const pastLimit = new Date(now.getTime() + ACTUAL_END_AT_MAX_FUTURE_MS + 1);
    assert.equal(validateActualEndAt(atLimit, null, now).ok, true);
    assert.equal(validateActualEndAt(pastLimit, null, now).ok, false);
  });
});

// ─── Canonical fingerprint serialization (§5.4) — SHARED TS↔PG VECTORS ─────────

describe("canonicalUtcInstant", () => {
  it("is millisecond ISO-8601 UTC with a literal Z", () => {
    assert.equal(
      canonicalUtcInstant(new Date("2026-08-10T03:04:05.678Z")),
      "2026-08-10T03:04:05.678Z",
    );
    // Milliseconds are ALWAYS present, even when zero — PG's ".MS" pattern matches this.
    assert.equal(
      canonicalUtcInstant(new Date("2026-08-10T03:04:05Z")),
      "2026-08-10T03:04:05.000Z",
    );
    // A non-UTC offset input normalizes to the same instant in UTC.
    assert.equal(
      canonicalUtcInstant(new Date("2026-08-10T12:04:05.678+09:00")),
      "2026-08-10T03:04:05.678Z",
    );
  });
});

describe("buildCompletionFingerprintCanonicalJson — shared vectors", () => {
  // VECTOR 1 — minimal single-item intent with Japanese text and a null description.
  // The PostgreSQL test must build this exact text for the same inputs and assert
  // encode(sha256(convert_to(<text>, 'UTF8')), 'hex') equals its own recomputation.
  const vector1Items: readonly NormalizedPerformedWorkItem[] = [
    { category: "コーティング", itemName: "GYEON施工", description: null, sortOrder: 0 },
  ];
  const vector1Text =
    '{"contractVersion":1,"workOrderId":"3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b",' +
    '"actualEndAt":"2026-08-10T03:04:05.678Z","performedItems":[{"category":"コーティング",' +
    '"itemName":"GYEON施工","description":null,"sortOrder":0}]}';

  // VECTOR 2 — two items exercising JSON string escaping (double quote, backslash, newline, tab)
  // and a zero-millisecond instant. to_json(text)::text in PostgreSQL escapes ", \, and control
  // characters exactly as JSON.stringify does, and keeps non-ASCII literal — this vector proves it.
  const vector2Items: readonly NormalizedPerformedWorkItem[] = [
    {
      category: "coating",
      itemName: 'say "hi" \\ slash',
      description: "line1\nline2\ttabbed",
      sortOrder: 0,
    },
    { category: "洗車", itemName: "wash", description: null, sortOrder: 1 },
  ];
  const vector2Text =
    '{"contractVersion":1,"workOrderId":"00000000-0000-4000-8000-000000000001",' +
    '"actualEndAt":"2026-01-01T00:00:00.000Z","performedItems":[{"category":"coating",' +
    '"itemName":"say \\"hi\\" \\\\ slash","description":"line1\\nline2\\ttabbed","sortOrder":0},' +
    '{"category":"洗車","itemName":"wash","description":null,"sortOrder":1}]}';

  it("vector 1: exact canonical text", () => {
    assert.equal(
      buildCompletionFingerprintCanonicalJson(
        "3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b",
        new Date("2026-08-10T03:04:05.678Z"),
        vector1Items,
      ),
      vector1Text,
    );
  });

  it("vector 2: exact canonical text with escaping", () => {
    assert.equal(
      buildCompletionFingerprintCanonicalJson(
        "00000000-0000-4000-8000-000000000001",
        new Date("2026-01-01T00:00:00.000Z"),
        vector2Items,
      ),
      vector2Text,
    );
  });

  it("both vectors hash to a canonical lowercase 64-hex SHA-256 fingerprint", () => {
    for (const text of [vector1Text, vector2Text]) {
      const fingerprint = sha256Hex(text);
      assert.equal(isCanonicalFingerprint(fingerprint), true);
      // Deterministic: the same text always yields the same fingerprint.
      assert.equal(fingerprint, sha256Hex(text));
    }
    // Different canonical texts yield different fingerprints.
    assert.notEqual(sha256Hex(vector1Text), sha256Hex(vector2Text));
  });

  it("serialization is normalization-faithful: validated input reproduces vector 1 exactly", () => {
    // End-to-end: raw client input → validatePerformedWorkItems → canonical text. Padding trims
    // away, blank description becomes explicit null, sortOrder is array-derived.
    const validated = validatePerformedWorkItems([
      { category: "  コーティング ", itemName: " GYEON施工 ", description: "  " },
    ]);
    assert.equal(validated.ok, true);
    if (validated.ok) {
      assert.equal(
        buildCompletionFingerprintCanonicalJson(
          "3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b",
          new Date("2026-08-10T03:04:05.678Z"),
          validated.items,
        ),
        vector1Text,
      );
    }
  });

  it("materially different intents never serialize identically", () => {
    const base = () =>
      buildCompletionFingerprintCanonicalJson(
        "3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b",
        new Date("2026-08-10T03:04:05.678Z"),
        vector1Items,
      );
    const otherWorkOrder = buildCompletionFingerprintCanonicalJson(
      "3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3c",
      new Date("2026-08-10T03:04:05.678Z"),
      vector1Items,
    );
    const otherInstant = buildCompletionFingerprintCanonicalJson(
      "3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b",
      new Date("2026-08-10T03:04:05.679Z"),
      vector1Items,
    );
    const otherItems = buildCompletionFingerprintCanonicalJson(
      "3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b",
      new Date("2026-08-10T03:04:05.678Z"),
      [{ category: "コーティング", itemName: "GYEON施工", description: "memo", sortOrder: 0 }],
    );
    assert.notEqual(base(), otherWorkOrder);
    assert.notEqual(base(), otherInstant);
    assert.notEqual(base(), otherItems);
  });
});

describe("isCanonicalFingerprint", () => {
  it("accepts exactly lowercase 64-hex", () => {
    assert.equal(isCanonicalFingerprint("a".repeat(64)), true);
    assert.equal(isCanonicalFingerprint("0123456789abcdef".repeat(4)), true);
  });

  it("rejects uppercase, wrong length, non-hex, and non-strings", () => {
    assert.equal(isCanonicalFingerprint("A".repeat(64)), false);
    assert.equal(isCanonicalFingerprint("a".repeat(63)), false);
    assert.equal(isCanonicalFingerprint("a".repeat(65)), false);
    assert.equal(isCanonicalFingerprint("g".repeat(64)), false);
    assert.equal(isCanonicalFingerprint(""), false);
    assert.equal(isCanonicalFingerprint(null), false);
    assert.equal(isCanonicalFingerprint(64), false);
  });
});
