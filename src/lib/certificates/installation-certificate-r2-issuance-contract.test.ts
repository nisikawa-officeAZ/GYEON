import assert from "node:assert/strict";
import test from "node:test";

import {
  isIssueInstallationCertificateR2RpcRow,
  mapInstallationCertificateR2RpcError,
  validateIssueInstallationCertificateR2Command,
} from "./installation-certificate-r2-issuance-contract";

const completionReportId = "123e4567-e89b-42d3-a456-426614174000";
const idempotencyKey = "123e4567-e89b-42d3-a456-426614174001";

test("R2 issue command accepts only exact certificate kinds and bounded identifiers", () => {
  assert.equal(validateIssueInstallationCertificateR2Command({
    completionReportId,
    certificateKind: "coating",
    idempotencyKey,
  }).ok, true);
  assert.equal(validateIssueInstallationCertificateR2Command({
    completionReportId,
    certificateKind: "wrong" as "coating",
    idempotencyKey,
  }).ok, false);
});

test("R2 RPC result binds each kind to its canonical number prefix", () => {
  const base = {
    issuance_id: completionReportId,
    issued_on: "2026-09-18",
    source_fingerprint: "a".repeat(64),
    outcome: "created",
    created: true,
    replayed: false,
  } as const;
  assert.equal(isIssueInstallationCertificateR2RpcRow({
    ...base,
    certificate_number: "CRT/PPF/2026/00001",
  }, "ppf"), true);
  assert.equal(isIssueInstallationCertificateR2RpcRow({
    ...base,
    certificate_number: "CRT/CO/2026/00001",
  }, "ppf"), false);
});

test("R2 mapper exposes standalone kind inapplicability without leaking SQL", () => {
  assert.deepEqual(
    mapInstallationCertificateR2RpcError("NOT_ELIGIBLE: certificate-kind-not-applicable"),
    { kind: "not_eligible", reasons: ["certificate-kind-not-applicable"] },
  );
  assert.deepEqual(mapInstallationCertificateR2RpcError("internal SQL detail"), {
    kind: "unavailable",
  });
});
