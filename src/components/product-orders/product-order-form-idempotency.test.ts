// Source-contract proof for ProductOrderForm's idempotency-key lifecycle and
// the removal of the unsupported submit-checkbox / order-date controls.
//
// No render harness exists for this component and none may be added (no new
// dependencies), so the contract is proven by static analysis of the module
// source rather than by mounting the component.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const MODULE_SRC = "src/components/product-orders/ProductOrderForm.tsx";

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function source(): string {
  return readFileSync(MODULE_SRC, "utf8");
}

test("a stable idempotency key is created once via lazy useState initializer", () => {
  const code = source();
  assert.match(
    code,
    /useState<string>\(\(\)\s*=>\s*createIdempotencyKey\(\)\)/,
    "the key must come from a lazy initializer, not computed on every render",
  );
});

test("the key source is a cryptographically random UUID, not a counter or timestamp", () => {
  const code = stripComments(source());
  assert.match(code, /function createIdempotencyKey\(\)[\s\S]*?crypto\.randomUUID\(\)/);
  for (const forbidden of ["Math.random", "Date.now", "nextKey()"]) {
    const generator = code.slice(
      code.indexOf("function createIdempotencyKey"),
      code.indexOf("function createIdempotencyKey") + 200,
    );
    assert.equal(generator.includes(forbidden), false, `key generator must not use ${forbidden}`);
  }
});

test("the key is rotated exactly once, only inside the success branch after save", () => {
  const code = source();
  const submitFn = code.slice(code.indexOf("function handleSubmit"), code.indexOf("const inputClass"));

  const rotations = submitFn.match(/setIdempotencyKey\(/g) ?? [];
  assert.equal(rotations.length, 1, "exactly one rotation call in the submit path");

  const successBranch = submitFn.slice(submitFn.indexOf("} else {"));
  assert.match(successBranch, /setIdempotencyKey\(createIdempotencyKey\(\)\)/);
  assert.ok(
    successBranch.indexOf("setIdempotencyKey(") < successBranch.indexOf("onSaved(result.data)"),
    "the key must rotate before the new intent (onSaved) begins",
  );

  const errorBranch = submitFn.slice(submitFn.indexOf('"error" in result'), submitFn.indexOf("} else {"));
  assert.equal(errorBranch.includes("setIdempotencyKey"), false, "a failed save must not rotate the key");
});

test("the same key is sent as idempotency_key and status is always draft", () => {
  const code = source();
  const payload = code.slice(code.indexOf("createProductOrder({"), code.indexOf("});", code.indexOf("createProductOrder({")));

  assert.match(payload, /idempotency_key:\s*idempotencyKey/);
  assert.match(payload, /status:\s*"draft"/);
  assert.equal(/status:\s*\w+\s*\?/.test(payload), false, "status must not be conditional");
});

test("the unsupported submit-as-submitted control is fully removed", () => {
  const code = source();
  for (const forbidden of [
    "submitAsSubmitted", "setSubmitAsSubmitted",
    "type=\"checkbox\"", "注文を確定する", "保存と同時に注文確定する", "submitted",
  ]) {
    assert.equal(code.includes(forbidden), false, `must not reference ${forbidden}`);
  }
});

test("the order-date state, input, and payload field are fully removed", () => {
  const code = source();
  for (const forbidden of ["orderDate", "setOrderDate", "order_date", "type=\"date\"", "注文日"]) {
    assert.equal(code.includes(forbidden), false, `must not reference ${forbidden}`);
  }
});

test("clear Japanese draft-only messaging is shown until card authorization is connected", () => {
  const code = source();
  assert.match(code, /カード与信の接続前は下書き保存のみご利用いただけます/);
});

test("unrelated form behavior is preserved: product rows, notes, cancel, and empty-cart guard", () => {
  const code = source();
  for (const preserved of [
    "addProduct", "updateQty", "removeRow",
    "notes || null", "onCancel", "商品を1つ以上追加してください",
  ]) {
    assert.ok(code.includes(preserved), `must preserve ${preserved}`);
  }
});
