import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveInstallationCertificateR1Kind } from "./InstallationCertificateR1Document";

describe("resolveInstallationCertificateR1Kind", () => {
  it("selects the PPF visual from confirmed category, product, or description text", () => {
    assert.equal(resolveInstallationCertificateR1Kind([
      { category: "PPF", name: "フロント施工" },
    ]), "ppf");
    assert.equal(resolveInstallationCertificateR1Kind([
      { category: "施工", name: "Paint Protection Film", description: "ボンネット" },
    ]), "ppf");
  });

  it("selects the unified CanCoat visual for EVO and EVO PRO", () => {
    assert.equal(resolveInstallationCertificateR1Kind([
      { category: "coating", name: "Q² CanCoat EVO" },
    ]), "cancoat");
    assert.equal(resolveInstallationCertificateR1Kind([
      { category: "coating", name: "Q² CANCOAT PRO EVO" },
    ]), "cancoat");
  });

  it("uses the coating visual by default and gives PPF priority for mixed work", () => {
    assert.equal(resolveInstallationCertificateR1Kind([
      { category: "coating", name: "Q² PURE EVO" },
    ]), "coating");
    assert.equal(resolveInstallationCertificateR1Kind([
      { category: "coating", name: "Q² CanCoat EVO" },
      { category: "PPF", name: "ヘッドライト" },
    ]), "ppf");
  });
});
