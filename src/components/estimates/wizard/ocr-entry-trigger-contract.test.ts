import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the 車検証OCR registration card opens the unified OCR reader directly", () => {
  const step = readFileSync(
    "src/components/estimates/wizard/steps/Step1Customer.tsx",
    "utf8",
  );
  const entry = readFileSync(
    "src/components/estimates/wizard/OcrEntry.tsx",
    "utf8",
  );

  assert.match(step, /if \(nextMethod === "ocr"\)/);
  assert.match(step, /setOcrOpenRequestKey\(\(current\) => current \+ 1\)/);
  assert.match(step, /openRequestKey=\{ocrOpenRequestKey\}/);
  assert.match(entry, /if \(openRequestKey > 0\)/);
  assert.match(entry, /setStage\("upload"\)/);
  assert.match(entry, /車検証を再読み取り/);
});
