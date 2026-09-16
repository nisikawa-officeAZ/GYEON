import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCE = readFileSync(
  "src/lib/certificates/issue-installation-certificate-r1.ts",
  "utf8",
);

describe("issueInstallationCertificateR1 boundary", () => {
  it("performs pure validation and the edit-capability gate before the one RPC", () => {
    const validation = SOURCE.indexOf("validateIssueInstallationCertificateR1Command(input)");
    const capability = SOURCE.indexOf('requireStaffCapability("edit")');
    const rpc = SOURCE.indexOf('.rpc("issue_installation_certificate_r1_v1"');
    assert.ok(validation >= 0);
    assert.ok(capability > validation);
    assert.ok(rpc > capability);
    assert.equal(SOURCE.indexOf('.rpc("issue_installation_certificate_r1_v1"', rpc + 1), -1);
  });

  it("sends only completionReportId and idempotencyKey", () => {
    const rpcPayload = SOURCE.slice(
      SOURCE.indexOf('.rpc("issue_installation_certificate_r1_v1"'),
      SOURCE.indexOf("if (error)"),
    );
    assert.match(rpcPayload, /p_completion_report_id:\s*valid\.command\.completionReportId/);
    assert.match(rpcPayload, /p_idempotency_key:\s*valid\.command\.idempotencyKey/);
    for (const forbidden of [
      "dealer_id", "dealerId", "snapshot", "serial", "issueDate", "issued_at",
      "logo", "warranty", "grant", "credit", "qr", "storage", "pdf",
    ]) assert.equal(rpcPayload.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  });

  it("contains no table mutation, Storage, privileged client, retry, or unrelated side effect", () => {
    for (const forbidden of [
      ".from(", ".insert(", ".update(", ".upsert(", ".delete(", ".storage",
      ".upload(", "createAdminClient", "service_role", "revalidatePath", "sendEmail",
      "sendLine", "setTimeout", "while (", "for (",
    ]) assert.equal(SOURCE.includes(forbidden), false, forbidden);
  });

  it("returns only typed sanitized outcomes and never error text", () => {
    assert.match(SOURCE, /mapInstallationCertificateR1RpcError\(error\.message\)/);
    assert.equal(SOURCE.includes("error.message }"), false);
    assert.equal(SOURCE.includes("throw error"), false);
    assert.match(SOURCE, /catch \{/);
    assert.match(SOURCE, /return \{ kind: "unavailable" \}/);
  });
});
