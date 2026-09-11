import { test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldTriggerPostalToAddress,
  shouldTriggerAddressToPostal,
  planPostalToAddressApply,
  planAddressToPostalApply,
  formatJpPostalCodeForDisplay,
} from "./postal-master-apply";

// ── Trigger conditions ────────────────────────────────────────────────────

test("postal→address triggers on a complete code with a blank address target", () => {
  assert.equal(shouldTriggerPostalToAddress("100-0001", ""), true);
});

test("postal→address does not trigger on an incomplete code", () => {
  assert.equal(shouldTriggerPostalToAddress("100-000", ""), false);
});

test("postal→address does not trigger once the address target is nonblank", () => {
  assert.equal(shouldTriggerPostalToAddress("100-0001", "既存の住所"), false);
});

test("address→postal triggers on nonblank address text with a blank postal target", () => {
  assert.equal(shouldTriggerAddressToPostal("東京都千代田区千代田1-1", ""), true);
});

test("address→postal does not trigger on whitespace-only address text", () => {
  assert.equal(shouldTriggerAddressToPostal("   ", ""), false);
});

test("address→postal does not trigger once the postal target is nonblank", () => {
  assert.equal(shouldTriggerAddressToPostal("東京都千代田区千代田1-1", "100-0001"), false);
});

// ── Postal → address ──────────────────────────────────────────────────────

const FOUND_ADDRESS_RESULT = {
  code: "FOUND" as const,
  address: {
    postalCode: "1000001",
    prefectureKanji: "東京都",
    cityKanji: "千代田区",
    townKanji: "千代田",
    prefectureKana: "ﾄｳｷﾖｳﾄ",
    cityKana: "ﾁﾖﾀﾞｸ",
    townKana: "ﾁﾖﾀﾞ",
  },
};

test("planPostalToAddressApply applies a unique FOUND result onto a blank target", () => {
  const plan = planPostalToAddressApply({
    requestSnapshot: { sourcePostalCode: "1000001" },
    currentPostalInput: "100-0001",
    currentAddressTarget: "",
    result: FOUND_ADDRESS_RESULT,
  });
  assert.deepEqual(plan, { apply: true, address: "東京都千代田区千代田" });
});

test("planPostalToAddressApply never overwrites an operator-entered target", () => {
  const plan = planPostalToAddressApply({
    requestSnapshot: { sourcePostalCode: "1000001" },
    currentPostalInput: "100-0001",
    currentAddressTarget: "操作者が入力した住所",
    result: FOUND_ADDRESS_RESULT,
  });
  assert.deepEqual(plan, { apply: false });
});

test("planPostalToAddressApply rejects a stale response (postal input changed since the request)", () => {
  const plan = planPostalToAddressApply({
    requestSnapshot: { sourcePostalCode: "1000001" },
    currentPostalInput: "100-0002",
    currentAddressTarget: "",
    result: FOUND_ADDRESS_RESULT,
  });
  assert.deepEqual(plan, { apply: false });
});

for (const code of ["NOT_FOUND", "AMBIGUOUS", "INVALID_INPUT", "MASTER_UNAVAILABLE"] as const) {
  test(`planPostalToAddressApply never writes for ${code}`, () => {
    const plan = planPostalToAddressApply({
      requestSnapshot: { sourcePostalCode: "1000001" },
      currentPostalInput: "100-0001",
      currentAddressTarget: "",
      result: { code },
    });
    assert.deepEqual(plan, { apply: false });
  });
}

// ── Address → postal ──────────────────────────────────────────────────────

const FOUND_POSTAL_RESULT = { code: "FOUND" as const, postalCode: "1000001" };

test("planAddressToPostalApply applies a unique FOUND result onto a blank target", () => {
  const plan = planAddressToPostalApply({
    requestSnapshot: { sourceAddress: "東京都千代田区千代田1-1" },
    currentAddressInput: "東京都千代田区千代田1-1",
    currentPostalTarget: "",
    result: FOUND_POSTAL_RESULT,
  });
  assert.deepEqual(plan, { apply: true, postalCode: "100-0001" });
});

test("planAddressToPostalApply never overwrites an operator-entered postal target", () => {
  const plan = planAddressToPostalApply({
    requestSnapshot: { sourceAddress: "東京都千代田区千代田1-1" },
    currentAddressInput: "東京都千代田区千代田1-1",
    currentPostalTarget: "999-9999",
    result: FOUND_POSTAL_RESULT,
  });
  assert.deepEqual(plan, { apply: false });
});

test("planAddressToPostalApply rejects a stale response (address input changed since the request)", () => {
  const plan = planAddressToPostalApply({
    requestSnapshot: { sourceAddress: "東京都千代田区千代田1-1" },
    currentAddressInput: "東京都千代田区丸の内1-1",
    currentPostalTarget: "",
    result: FOUND_POSTAL_RESULT,
  });
  assert.deepEqual(plan, { apply: false });
});

for (const code of ["NOT_FOUND", "AMBIGUOUS", "INVALID_INPUT", "MASTER_UNAVAILABLE"] as const) {
  test(`planAddressToPostalApply never writes for ${code}`, () => {
    const plan = planAddressToPostalApply({
      requestSnapshot: { sourceAddress: "東京都千代田区千代田1-1" },
      currentAddressInput: "東京都千代田区千代田1-1",
      currentPostalTarget: "",
      result: { code },
    });
    assert.deepEqual(plan, { apply: false });
  });
}

test("formatJpPostalCodeForDisplay inserts the hyphen at position 3", () => {
  assert.equal(formatJpPostalCodeForDisplay("1000001"), "100-0001");
});
