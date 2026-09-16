import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/estimates/EstimatesClient.tsx", "utf8");

test("estimates list keeps only the canonical new-estimate action", () => {
  assert.match(source, />\s*\+ 新規見積\s*</);
  assert.match(source, /router\.push\("\/estimates\/new"\)/);
  assert.doesNotMatch(source, />\s*顧客・車両登録\s*</);
  assert.doesNotMatch(source, />\s*GYEON見積作成\s*</);
  assert.doesNotMatch(source, /CustomerVehicleOnboardingWizard|GyeonServiceForm/);
});

test("cleanup does not touch the canonical new-estimate wizard", () => {
  assert.doesNotMatch(source, /EstimateWizard|ScreensPreview|screenConfig|shopRank/);
});
