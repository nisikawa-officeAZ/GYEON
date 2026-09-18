import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ACTION = readFileSync(
  "src/lib/certificates/issue-installation-certificate-r2-documents.ts",
  "utf8",
);
const UI = readFileSync(
  "src/components/completion-reports/InstallationCertificateR1Actions.tsx",
  "utf8",
);
const PAGE = readFileSync("src/app/completion-reports/page.tsx", "utf8");
const SECTION = readFileSync(
  "src/components/completion-reports/CompletionReportSection.tsx",
  "utf8",
);

describe("installation certificate R2 UI issuance boundary", () => {
  it("accepts only a completion report id and sequences each kind before document creation", () => {
    assert.match(ACTION, /issueInstallationCertificateR2Documents\(\s*completionReportId: string/);
    const issue = ACTION.indexOf("await issueInstallationCertificateR2(");
    const ensure = ACTION.indexOf("await ensureInstallationCertificateR1Document(");
    assert.ok(issue >= 0 && ensure > issue);
    assert.equal((ACTION.match(/await issueInstallationCertificateR2\(/g) ?? []).length, 1);
    assert.equal((ACTION.match(/await ensureInstallationCertificateR1Document\(/g) ?? []).length, 1);
    assert.match(ACTION, /idempotencyKey: randomUUID\(\)/);
    assert.match(ACTION, /"coating",[\s\S]*"ppf",[\s\S]*"cancoat"/);
    const issuePayload = ACTION.slice(issue, ACTION.indexOf("if (issuance.kind", issue));
    for (const forbidden of ["dealerId:", "snapshot:", "certificateNumber:", "storagePath:"]) {
      assert.equal(issuePayload.includes(forbidden), false, forbidden);
    }
  });

  it("opens only the authenticated PDF route after immutable issuance confirmation", () => {
    assert.match(UI, /window\.confirm\(/);
    assert.match(UI, /発行後は内容を変更できません/);
    assert.match(UI, /\/pdf\/installation-certificate\?\$\{query\.toString\(\)\}/);
    assert.match(UI, /issueInstallationCertificateR2Documents\(completionReportId\)/);
    assert.match(UI, /result\.certificates\.map|ready\.map/);
    assert.match(UI, /text-white/);
    assert.match(UI, /施工証明書を発行/);
    assert.match(UI, /ダウンロード/);
  });

  it("is shown only inside the existing ready work-report branches", () => {
    assert.match(PAGE, /source\.ready && \([\s\S]*InstallationCertificateR1Actions/);
    assert.match(SECTION, /view\.workReport\?\.ready \? \([\s\S]*InstallationCertificateR1Actions/);
  });
});
