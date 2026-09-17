import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../hub/estimates/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(
  new URL("../../components/completion-reports/InstallationCertificateR1Actions.tsx", import.meta.url),
  "utf8",
);

test("estimate hub exposes one dedicated installation-certificate manager", () => {
  assert.equal((hub.match(/href: "\/installation-certificates"/g) ?? []).length, 1);
  assert.match(hub, /label: "施工証明書管理"/);
  assert.match(hub, /icon: "certificate"/);
});

test("manager has separate customer and vehicle search controls", () => {
  assert.match(page, /name="customer"/);
  assert.match(page, /name="vehicle"/);
  assert.match(page, /顧客名で検索/);
  assert.match(page, /車両名で検索/);
});

test("manager confirms and reissues only the immutable stored PDF", () => {
  assert.match(page, /certificateUrl\(item\.issuanceId\)/);
  assert.match(page, /certificateUrl\(item\.issuanceId, true\)/);
  assert.match(page, /再発行（PDF）/);
  assert.doesNotMatch(page, /issueInstallationCertificateR1Document/);
});

test("completion report keeps an explicit issuance action", () => {
  assert.match(actions, /"施工証明書を発行"/);
});
