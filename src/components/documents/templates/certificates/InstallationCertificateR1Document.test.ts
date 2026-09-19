import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "src/components/documents/templates/certificates/InstallationCertificateR1Document.tsx",
  "utf8",
);

describe("installation certificate package v3.0.3 UI lock", () => {
  it("routes issuance through the three approved package templates on one A4 front", () => {
    for (const required of [
      "CertificateDocument",
      "approvedCoatingCertificateContent",
      "approvedPpfCertificateContent",
      "approvedCancoatCertificateContent",
      'mode="front"',
      "data.certificateKind ?? resolveInstallationCertificateKind",
      "const serial = data.certificateNumber",
    ]) assert.equal(source.includes(required), true, required);

    assert.equal(source.includes("MaintenanceHistoryPage"), false);
    assert.equal(source.includes("GYEON DETAILER AGENT"), false);
    assert.equal(source.includes("INSTALLATION RECORD"), false);
    assert.equal(source.includes("replace(/^CRT\\/IN/"), false);
  });

  it("selects PPF first, CanCoat only without a base coating, and coating otherwise", () => {
    assert.match(source, /includesAny\(joined, \["ppf"/);
    assert.match(source, /hasBaseCoating/);
    assert.match(source, /!hasBaseCoating && includesAny\(joined, \["cancoat"/);
    assert.match(source, /return "coating"/);
  });

  it("uses the package rank rule and never duplicates a fallback GYEON badge as a shop logo", () => {
    assert.match(source, /kind === "ppf" \? "ppf-installer" : configuredRank/);
    assert.match(source, /rankLogoUrl: gyeonRankLogo\(rank\)/);
    assert.match(source, /gyeonWordmarkUrl: gyeonWordmark\(\)/);
    assert.match(source, /logoUrl: logoDataUri \|\| undefined/);
  });
});
