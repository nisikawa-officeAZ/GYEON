import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/pricing-catalog";
import {
  editorFirstLayerOptions,
  editorTopcoatKeys,
  isEditorCoatingSelectionAllowed,
} from "./estimate-editor-coating-eligibility";

test("detailer edit hides every certified-only base product", () => {
  const ids = editorFirstLayerOptions(DEFAULT_PRICING_CATALOG.coatings, "detailer").map((p) => p.id);
  assert.ok(!ids.includes("infinit1"));
  assert.ok(!ids.includes("infinit2"));
  assert.ok(!ids.includes("cancoat-evo-pro"));
  assert.ok(ids.includes("pure-evo"));
});

test("detailer edit hides certified-only upper coats", () => {
  const layer2 = editorTopcoatKeys(DEFAULT_PRICING_CATALOG, "one-evo", 2, "detailer");
  assert.ok(!layer2.includes("cancoat-evo-pro"));

  const layer3 = editorTopcoatKeys(DEFAULT_PRICING_CATALOG, "infinit1", 3, "detailer");
  assert.deepEqual(layer3, []);
});

test("certified edit keeps the approved certified products and matrix", () => {
  const base = editorFirstLayerOptions(DEFAULT_PRICING_CATALOG.coatings, "certified").map((p) => p.id);
  assert.ok(base.includes("infinit1"));
  assert.ok(base.includes("infinit2"));
  assert.ok(base.includes("cancoat-evo-pro"));
  assert.ok(editorTopcoatKeys(DEFAULT_PRICING_CATALOG, "one-evo", 2, "certified").includes("cancoat-evo-pro"));
});

test("save-time guard rejects an injected certified selection for detailer", () => {
  assert.equal(
    isEditorCoatingSelectionAllowed(DEFAULT_PRICING_CATALOG, "detailer", "one-evo", "cancoat-evo-pro"),
    false,
  );
  assert.equal(
    isEditorCoatingSelectionAllowed(DEFAULT_PRICING_CATALOG, "detailer", "infinit1"),
    false,
  );
});

test("ppf installer cannot add coating, including options-only work", () => {
  assert.equal(isEditorCoatingSelectionAllowed(DEFAULT_PRICING_CATALOG, "ppf_installer", ""), false);
  assert.deepEqual(editorFirstLayerOptions(DEFAULT_PRICING_CATALOG.coatings, "ppf_installer"), []);
});

test("production edit route resolves and threads the authoritative shop rank", () => {
  const source = readFileSync(new URL("../../app/estimates/[id]/edit/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getAuthoritativeShopRank\(\)/);
  assert.match(source, /shopRank=\{rank\.rank\}/);
  assert.match(source, /if \(!rank\.ok\)/);
});

test("editor renders only rank-filtered base and upper-layer collections", () => {
  const source = readFileSync(new URL("./EstimateEditor.tsx", import.meta.url), "utf8");
  assert.match(source, /availableCoatings\.map/);
  assert.match(source, /availableTopcoat2\.map/);
  assert.match(source, /availableTopcoat3\.map/);
  assert.doesNotMatch(source, /catalog\.coatings\.map\(\(c\)/);
  assert.doesNotMatch(source, /Object\.keys\(catalog\.topcoatBase\)\.map/);
});
