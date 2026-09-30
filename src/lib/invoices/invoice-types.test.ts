import assert from "node:assert/strict";
import test from "node:test";
import { INVOICE_CATEGORIES, invoiceCategoryLabel } from "./invoice-types";

test("invoice category labels preserve distinct estimate coating categories", () => {
  assert.equal(invoiceCategoryLabel("wheel"), "ホイール");
  assert.equal(invoiceCategoryLabel("other_coating"), "その他コーティング");
  assert.equal(invoiceCategoryLabel("coating"), "コーティング");
  const values = INVOICE_CATEGORIES.map(({ value }) => value);
  assert.equal(values.filter((value) => value === "other_coating").length, 1);
  assert.equal(values.filter((value) => value === "wheel").length, 1);
});
