import { test } from "node:test";
import assert from "node:assert/strict";

import { lookupJapanPostPostalCode } from "./japan-post-postal-resolver";

test("resolves the UAT address from the official Japan Post map", () => {
  assert.equal(
    lookupJapanPostPostalCode("滋賀県愛知郡愛荘町愛知川７７４−４"),
    "529-1331",
  );
});

test("accepts a partial OCR postal prefix without using it as evidence", () => {
  assert.equal(
    lookupJapanPostPostalCode("〒523- 滋賀県愛知郡愛荘町愛知川７７４−４"),
    "529-1331",
  );
});

test("fails closed for unknown and ambiguous address prefixes", () => {
  assert.equal(lookupJapanPostPostalCode("存在しない県存在しない市1-2-3"), null);
  assert.equal(lookupJapanPostPostalCode("愛知県安城市榎前町1-2-3"), null);
});
