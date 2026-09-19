import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { EditorItem } from "./estimate-editor-helpers";
import { moveEditorItem } from "./estimate-editor-helpers";

const item = (key: string): EditorItem => ({
  key,
  category: "other",
  item_name: key,
  description: "",
  quantity: 1,
  unit_price: 100,
  discount_rate: 0,
});

test("detail rows move up and down without changing their contents", () => {
  const original = [item("a"), item("b"), item("c")];
  assert.deepEqual(moveEditorItem(original, 1, -1).map((row) => row.key), ["b", "a", "c"]);
  assert.deepEqual(moveEditorItem(original, 1, 1).map((row) => row.key), ["a", "c", "b"]);
  assert.deepEqual(original.map((row) => row.key), ["a", "b", "c"]);
});

test("first and last rows cannot move beyond the list", () => {
  const original = [item("a"), item("b")];
  assert.deepEqual(moveEditorItem(original, 0, -1).map((row) => row.key), ["a", "b"]);
  assert.deepEqual(moveEditorItem(original, 1, 1).map((row) => row.key), ["a", "b"]);
});

test("editor keeps compact order controls in one fixed action column and persists sort_order", () => {
  const source = readFileSync(new URL("./EstimateEditor.tsx", import.meta.url), "utf8");
  assert.match(source, /min-w-\[640px\] table-fixed/);
  assert.match(source, /<col className="w-20" \/>/);
  assert.match(source, />操作<\/th>/);
  assert.doesNotMatch(source, />表示順<\/th>/);
  assert.match(source, /grid grid-cols-3 items-center gap-1/);
  assert.match(source, /aria-label=\{`\$\{it\.item_name \|\| "明細"\}を上へ`\}/);
  assert.match(source, /aria-label=\{`\$\{it\.item_name \|\| "明細"\}を下へ`\}/);
  assert.match(source, /aria-label=\{`\$\{it\.item_name \|\| "明細"\}を削除`\}/);
  assert.match(source, /sort_order: idx/);
  assert.match(
    source,
    /sortByDisplayOrder\(estimate\?\.estimate_items \?\? \[\]\)\.map/,
    "reopening edit must restore the persisted operator-selected order",
  );
});

test("estimate detail and estimate PDF both render the saved display order", () => {
  const detail = readFileSync(new URL("./EstimateDetail.tsx", import.meta.url), "utf8");
  const documentData = readFileSync(new URL("../../lib/pdf/estimate-document-data.ts", import.meta.url), "utf8");
  assert.match(detail, /sortByDisplayOrder\(items\)/);
  assert.match(documentData, /sortByDisplayOrder\(estimate\.estimate_items \?\? \[\]\)/);
});
