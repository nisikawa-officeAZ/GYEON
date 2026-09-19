import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./EstimatesClient.tsx", import.meta.url),
  "utf8",
);

test("the estimates list exposes one create entry point that opens /estimates/new", () => {
  assert.equal(source.match(/\+ 新規見積/g)?.length, 1);
  assert.match(
    source,
    /<GdaOperationalListActionButton onClick=\{\(\) => router\.push\("\/estimates\/new"\)\}>\s*\+ 新規見積\s*<\/GdaOperationalListActionButton>/,
  );
});

test("legacy onboarding and GYEON estimate entry branches are absent", () => {
  for (const removedText of [
    "顧客・車両登録",
    "GYEON見積作成",
    'mode: "onboarding"',
    'mode: "gyeon"',
    "CustomerVehicleOnboardingWizard",
    "GyeonServiceForm",
  ]) {
    assert.equal(source.includes(removedText), false, `${removedText} must be absent`);
  }
});

test("customer redirect and both work-order handoff paths remain intact", () => {
  assert.match(
    source,
    /router\.replace\(`\/estimates\/new\?customer_id=\$\{defaultCustomerId\}`\)/,
  );
  assert.match(source, /searchParams\.get\("workorder"\)/);
  assert.match(source, /setModal\(\{ mode: "work-order", estimate: est \}\)/);
  assert.match(
    source,
    /onCreateWorkOrder=\{\(e\) => setModal\(\{ mode: "work-order", estimate: e \}\)\}/,
  );
  assert.match(source, /modal\.mode === "work-order"/);
  assert.match(source, /<WorkOrderForm/);
  assert.match(source, /initialEstimateId=\{modal\.estimate\.id\}/);
});
