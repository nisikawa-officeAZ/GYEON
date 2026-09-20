import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./EstimateTable.tsx", import.meta.url), "utf8");

test("fixed utility columns leave the remaining desktop width to customer and vehicle", () => {
  assert.match(
    source,
    /<colgroup>\s*<col className="w-28" \/>\s*<col \/>\s*<col \/>\s*<col className="w-24" \/>\s*<col className="w-24" \/>\s*<col className="w-64" \/>\s*<\/colgroup>/,
  );
});

test("the desktop status column has a fixed width and the badge stays on one line", () => {
  assert.match(
    source,
    /<th className="w-24 whitespace-nowrap text-center[^\"]*">ステータス<\/th>/,
  );
  assert.match(
    source,
    /<td className="w-24 whitespace-nowrap[^\"]*text-center[^\"]*">\s*<span className=\{`inline-flex whitespace-nowrap/,
  );
  assert.doesNotMatch(source, /min-w-\[6\.5rem\]/);
});
