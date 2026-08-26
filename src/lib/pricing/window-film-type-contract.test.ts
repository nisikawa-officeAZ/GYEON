import assert from "node:assert/strict";
import test from "node:test";

import { parseWindowFilmTypes, type WindowFilmTypeSetting } from "./window-film-type-contract";

function film(name: string, displayOrder: number, isActive = true): WindowFilmTypeSetting {
  return {
    itemId: null,
    code: null,
    name,
    installationCoefficientBp: 10_000,
    irCutPercent: null,
    uvCutPercent: null,
    isActive,
    displayOrder,
    expectedUpdatedAt: null,
  };
}

test("rejects normalized duplicate active film names", () => {
  assert.throws(
    () => parseWindowFilmTypes([film("Premium Film", 0), film("premium film", 1)]),
    /duplicate active name after normalization/,
  );
  assert.doesNotThrow(
    () => parseWindowFilmTypes([film("Premium Film", 0), film("premium film", 1, false)]),
  );
});
