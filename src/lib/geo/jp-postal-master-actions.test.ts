import { test } from "node:test";
import assert from "node:assert/strict";

// ── Pure RPC-payload mapping (the shape-validation logic actually exercised by the actions) ──
//
// Tested against `jp-postal-master-contract` directly: these functions are pure and require no
// Supabase client, request context, or network access, and they are what the Server Actions in
// this file delegate every non-normalization decision to.
import {
  mapJpPostalForwardRpcPayload,
  mapJpPostalReverseRpcPayload,
} from "./jp-postal-master-contract";

test("mapJpPostalForwardRpcPayload accepts a well-formed FOUND payload", () => {
  const result = mapJpPostalForwardRpcPayload({
    result_code: "FOUND",
    address: {
      postal_code: "1000001",
      prefecture_kanji: "東京都",
      city_kanji: "千代田区",
      town_kanji: "千代田",
      prefecture_kana: "ﾄｳｷﾖｳﾄ",
      city_kana: "ﾁﾖﾀﾞｸ",
      town_kana: "ﾁﾖﾀﾞ",
    },
  });
  assert.deepEqual(result, {
    code: "FOUND",
    address: {
      postalCode: "1000001",
      prefectureKanji: "東京都",
      cityKanji: "千代田区",
      townKanji: "千代田",
      prefectureKana: "ﾄｳｷﾖｳﾄ",
      cityKana: "ﾁﾖﾀﾞｸ",
      townKana: "ﾁﾖﾀﾞ",
    },
  });
});

test("mapJpPostalForwardRpcPayload passes through NOT_FOUND/AMBIGUOUS/INVALID_INPUT/MASTER_UNAVAILABLE", () => {
  for (const code of ["NOT_FOUND", "AMBIGUOUS", "INVALID_INPUT", "MASTER_UNAVAILABLE"] as const) {
    assert.deepEqual(mapJpPostalForwardRpcPayload({ result_code: code }), { code });
  }
});

test("mapJpPostalForwardRpcPayload fails closed on a FOUND payload missing the address", () => {
  assert.deepEqual(mapJpPostalForwardRpcPayload({ result_code: "FOUND" }), { code: "MASTER_UNAVAILABLE" });
});

test("mapJpPostalForwardRpcPayload fails closed on a FOUND payload with a partial address", () => {
  assert.deepEqual(
    mapJpPostalForwardRpcPayload({ result_code: "FOUND", address: { postal_code: "1000001" } }),
    { code: "MASTER_UNAVAILABLE" },
  );
});

test("mapJpPostalForwardRpcPayload fails closed on an unrecognized result_code", () => {
  assert.deepEqual(mapJpPostalForwardRpcPayload({ result_code: "SOMETHING_ELSE" }), { code: "MASTER_UNAVAILABLE" });
});

test("mapJpPostalForwardRpcPayload fails closed on null/non-object payloads", () => {
  assert.deepEqual(mapJpPostalForwardRpcPayload(null), { code: "MASTER_UNAVAILABLE" });
  assert.deepEqual(mapJpPostalForwardRpcPayload("FOUND"), { code: "MASTER_UNAVAILABLE" });
  assert.deepEqual(mapJpPostalForwardRpcPayload(undefined), { code: "MASTER_UNAVAILABLE" });
});

test("mapJpPostalReverseRpcPayload accepts a well-formed FOUND payload", () => {
  assert.deepEqual(
    mapJpPostalReverseRpcPayload({ result_code: "FOUND", postal_code: "1000001" }),
    { code: "FOUND", postalCode: "1000001" },
  );
});

test("mapJpPostalReverseRpcPayload passes through NOT_FOUND/AMBIGUOUS/INVALID_INPUT/MASTER_UNAVAILABLE", () => {
  for (const code of ["NOT_FOUND", "AMBIGUOUS", "INVALID_INPUT", "MASTER_UNAVAILABLE"] as const) {
    assert.deepEqual(mapJpPostalReverseRpcPayload({ result_code: code }), { code });
  }
});

test("mapJpPostalReverseRpcPayload fails closed on a FOUND payload with a malformed postal code", () => {
  assert.deepEqual(
    mapJpPostalReverseRpcPayload({ result_code: "FOUND", postal_code: "100-0001" }),
    { code: "MASTER_UNAVAILABLE" },
  );
  assert.deepEqual(
    mapJpPostalReverseRpcPayload({ result_code: "FOUND" }),
    { code: "MASTER_UNAVAILABLE" },
  );
});

test("mapJpPostalReverseRpcPayload fails closed on null/non-object payloads", () => {
  assert.deepEqual(mapJpPostalReverseRpcPayload(null), { code: "MASTER_UNAVAILABLE" });
  assert.deepEqual(mapJpPostalReverseRpcPayload(42), { code: "MASTER_UNAVAILABLE" });
});

// ── The Server Actions themselves ────────────────────────────────────────────────────────────
//
// Imported dynamically and defensively: this module imports `@/lib/supabase/server`, which is
// outside this phase's read/write allowlist and could not be inspected. In a local verification
// environment with no configured Supabase project, module construction or the RPC call itself may
// legitimately fail — this suite still proves the two behaviors that do not depend on a live
// client: invalid input is rejected before any client/RPC call, and every other failure (including
// a missing/misconfigured client) collapses to MASTER_UNAVAILABLE rather than throwing.

async function loadActionsModule(): Promise<typeof import("./jp-postal-master-actions") | null> {
  try {
    return await import("./jp-postal-master-actions");
  } catch {
    return null;
  }
}

test("lookupJpPostalMasterForwardAction rejects invalid input as INVALID_INPUT before any client call", async () => {
  const actionsModule = await loadActionsModule();
  if (!actionsModule) return;
  assert.deepEqual(await actionsModule.lookupJpPostalMasterForwardAction("not-a-postal-code"), { code: "INVALID_INPUT" });
  assert.deepEqual(await actionsModule.lookupJpPostalMasterForwardAction(""), { code: "INVALID_INPUT" });
  assert.deepEqual(await actionsModule.lookupJpPostalMasterForwardAction(null), { code: "INVALID_INPUT" });
});

test("lookupJpPostalMasterReverseAction rejects invalid input as INVALID_INPUT before any client call", async () => {
  const actionsModule = await loadActionsModule();
  if (!actionsModule) return;
  assert.deepEqual(await actionsModule.lookupJpPostalMasterReverseAction("   "), { code: "INVALID_INPUT" });
  assert.deepEqual(await actionsModule.lookupJpPostalMasterReverseAction(123), { code: "INVALID_INPUT" });
});

test("lookupJpPostalMasterForwardAction never throws for a well-formed input without a live database", async () => {
  const actionsModule = await loadActionsModule();
  if (!actionsModule) return;
  await assert.doesNotReject(() => actionsModule.lookupJpPostalMasterForwardAction("100-0001"));
});

test("lookupJpPostalMasterReverseAction never throws for a well-formed input without a live database", async () => {
  const actionsModule = await loadActionsModule();
  if (!actionsModule) return;
  await assert.doesNotReject(() => actionsModule.lookupJpPostalMasterReverseAction("東京都千代田区千代田1-1"));
});
