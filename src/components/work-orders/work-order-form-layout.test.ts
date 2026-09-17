import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCE = readFileSync(
  "src/components/work-orders/WorkOrderForm.tsx",
  "utf8",
);

describe("work-order completion item layout", () => {
  it("allows every input and grid track to shrink inside the edit modal", () => {
    assert.match(SOURCE, /const inputClass =\s*\n\s*"w-full min-w-0 /);
    assert.match(
      SOURCE,
      /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.5fr\)_minmax\(0,1\.5fr\)_auto\]/,
    );
    assert.doesNotMatch(SOURCE, /sm:grid-cols-\[1fr_1\.5fr_1\.5fr_auto\]/);
  });

  it("keeps the destructive row action readable without growing its track", () => {
    assert.match(SOURCE, /self-stretch whitespace-nowrap px-3 py-2 text-xs/);
  });
});
