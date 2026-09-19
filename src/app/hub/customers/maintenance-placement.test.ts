import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const customersHub = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const estimatesHub = readFileSync(new URL("../estimates/page.tsx", import.meta.url), "utf8");
const maintenancePage = readFileSync(new URL("../../maintenance/MaintenanceClient.tsx", import.meta.url), "utf8");

test("maintenance manager moves out of the estimates/work hub", () => {
  assert.doesNotMatch(estimatesHub, /href: "\/maintenance"/);
  assert.equal((customersHub.match(/href: "\/maintenance"/g) ?? []).length, 1);
  assert.match(customersHub, /label: "メンテナンス管理"/);
});

test("customer hub second row starts with maintenance manager then customer app", () => {
  const legacy = customersHub.indexOf('href: "/customers/legacy-registration"');
  const maintenance = customersHub.indexOf('href: "/maintenance"');
  const customerApp = customersHub.indexOf('href: "/customer-app"');
  assert.ok(legacy >= 0 && maintenance > legacy && customerApp > maintenance);
});

test("maintenance route uses the requested Japanese page name", () => {
  assert.match(maintenancePage, />メンテナンス管理<\/h1>/);
  assert.doesNotMatch(maintenancePage, />メンテナンス通知管理<\/h1>/);
});
