import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "components", "trial", "TrialBanner.tsx"),
  "utf8",
);

test("the shared banner renders only for an active trial", () => {
  assert.ok(
    SOURCE.includes("if (!status.hasActiveTrial) return null"),
    "inactive and completed trials must not leave a persistent banner",
  );
  assert.equal(
    SOURCE.includes("プランへ移行済み"),
    false,
    "paid-plan migration status belongs to the home plan badge, not the trial banner",
  );
});
