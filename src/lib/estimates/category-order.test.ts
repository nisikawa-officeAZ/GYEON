// GDA-PR143-R2 — shared document category order: `wheel` ranks with `glass`, before `other`.
// Run: node --import tsx --test src/lib/estimates/category-order.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { CATEGORY_ORDER, categoryRank, sortByCategoryOrder, sortByDisplayOrder } from "./category-order";

test("wheel is a known category ranked at the options slot, adjacent to glass and before other", () => {
  assert.equal("wheel" in CATEGORY_ORDER, true, "wheel is no longer an unknown (rank 99) category");
  assert.equal(categoryRank("wheel"), categoryRank("glass"), "wheel and glass share the options slot");
  assert.ok(categoryRank("wheel") < categoryRank("other"), "wheel ranks before other");
  assert.ok(categoryRank("wheel") > categoryRank("roomclean"), "wheel ranks after every body-work category");
  assert.notEqual(categoryRank("wheel"), 99);
});

test("unrelated categories keep their exact existing ranks (no reordering)", () => {
  assert.deepEqual(CATEGORY_ORDER, {
    coating: 1, ppf: 2, window: 3, maintenance: 4, carwash: 5, roomclean: 6,
    interior: 7, glass: 7, other_coating: 7,
    wheel: 7,
    other: 8,
  });
  assert.equal(categoryRank("unknown-category"), 99, "unknown categories still sort last");
});

test("sortByCategoryOrder places a wheel line after body work, with glass, before other; sort_order breaks ties", () => {
  const items = [
    { id: "o",  category: "other",   sort_order: 0 },
    { id: "w2", category: "wheel",   sort_order: 2 },
    { id: "g",  category: "glass",   sort_order: 1 },
    { id: "c",  category: "coating", sort_order: 9 },
    { id: "w1", category: "wheel",   sort_order: 0 },
    { id: "m",  category: "maintenance", sort_order: 0 },
    { id: "x",  category: "not-a-category", sort_order: 0 },
  ];
  assert.deepEqual(sortByCategoryOrder(items).map((i) => i.id), ["c", "m", "w1", "g", "w2", "o", "x"]);
  assert.deepEqual(items.map((i) => i.id), ["o", "w2", "g", "c", "w1", "m", "x"], "input is not mutated");
  // Operator display order is untouched by the category table.
  assert.deepEqual(sortByDisplayOrder(items).map((i) => i.sort_order), [0, 0, 0, 0, 1, 2, 9]);
});
