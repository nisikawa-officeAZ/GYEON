import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./WorkOrderTable.tsx", import.meta.url), "utf8");

test("work-order status header and badges stay on one line", () => {
  assert.match(
    SOURCE,
    /min-w-\[88px\] whitespace-nowrap[^>]*>ステータス<\/th>/,
  );
  assert.equal(
    (SOURCE.match(/inline-flex min-w-\[48px\][^`]*whitespace-nowrap/g) ?? []).length,
    2,
  );
});
