import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./EstimateTable.tsx", import.meta.url), "utf8");

test("the desktop status column and badge stay on one horizontal line", () => {
  assert.match(
    source,
    /<th className="min-w-\[6\.5rem\] whitespace-nowrap[^\"]*">ステータス<\/th>/,
  );
  assert.match(
    source,
    /<td className="min-w-\[6\.5rem\] whitespace-nowrap[^\"]*">\s*<span className=\{`inline-flex whitespace-nowrap/,
  );
});
