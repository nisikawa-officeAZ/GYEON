import assert from "node:assert/strict";
import test from "node:test";

import { safeInvoicePdfUrl } from "./invoice-pdf-url";

test("invoice PDF navigation accepts only credential-free HTTPS URLs", () => {
  assert.equal(
    safeInvoicePdfUrl("https://storage.example/invoice.pdf?token=abc"),
    "https://storage.example/invoice.pdf?token=abc",
  );
  for (const value of [
    "http://storage.example/invoice.pdf",
    "https://user:secret@storage.example/invoice.pdf",
    "javascript:alert(1)",
    "not-a-url",
    null,
    42,
  ]) {
    assert.equal(safeInvoicePdfUrl(value), undefined);
  }
});
