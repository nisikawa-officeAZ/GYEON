import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInstallationCertificateR1RequestCanonicalJson,
  buildInstallationCertificateR1SourceCanonicalJson,
  canonicalJson,
  isIssueInstallationCertificateR1RpcRow,
  mapInstallationCertificateR1RpcError,
  sha256Hex,
  validateIssueInstallationCertificateR1Command,
} from "./installation-certificate-r1-issuance-contract";

const REPORT_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("R1 issuance command", () => {
  it("accepts exactly a UUID and a trimmed printable 16-128 character key", () => {
    assert.deepEqual(
      validateIssueInstallationCertificateR1Command({
        completionReportId: ` ${REPORT_ID} `,
        idempotencyKey: " installation-r1-0001 ",
      }),
      {
        ok: true,
        command: {
          completionReportId: REPORT_ID,
          idempotencyKey: "installation-r1-0001",
        },
      },
    );
  });

  it("rejects malformed IDs, short keys, whitespace, Unicode, and control characters", () => {
    for (const command of [
      { completionReportId: "not-a-uuid", idempotencyKey: "installation-r1-0001" },
      { completionReportId: REPORT_ID, idempotencyKey: "short" },
      { completionReportId: REPORT_ID, idempotencyKey: "installation key 0001" },
      { completionReportId: REPORT_ID, idempotencyKey: "installation-r1-日本語" },
      { completionReportId: REPORT_ID, idempotencyKey: "installation-r1-\n0001" },
    ]) assert.deepEqual(validateIssueInstallationCertificateR1Command(command), { ok: false });
  });
});

describe("R1 issuance fingerprints", () => {
  it("matches the exact PostgreSQL request vector", () => {
    const canonical = buildInstallationCertificateR1RequestCanonicalJson(REPORT_ID);
    assert.equal(
      canonical,
      '{"completionReportId":"123e4567-e89b-42d3-a456-426614174000","contractVersion":1,"documentClass":"installation-certificate-r1"}',
    );
    assert.equal(
      sha256Hex(canonical),
      "8a249bf336a918f896dc6f1112bb055f289b6d8ffef53cc074ed474ec058743a",
    );
  });

  it("sorts object keys recursively while preserving array order and JSON escaping", () => {
    assert.equal(
      canonicalJson({ z: "改行\n", a: [{ y: 'say "hi"', x: null }] }),
      '{"a":[{"x":null,"y":"say \\"hi\\""}],"z":"改行\\n"}',
    );
  });

  it("omits undefined object fields and rejects unsafe JSON values", () => {
    assert.equal(canonicalJson({ b: undefined, a: "ok" }), '{"a":"ok"}');
    assert.throws(() => canonicalJson([undefined]), /undefined array value/);
    assert.throws(() => canonicalJson(Number.NaN), /non-finite/);
    assert.throws(() => canonicalJson(new Date()), /non-plain/);
  });

  it("canonicalizes only the source projection and issuer, not serial or issue date", () => {
    const canonical = buildInstallationCertificateR1SourceCanonicalJson(
      {
        documentClass: "installation-certificate-r1",
        customer: { name: "石井 紗也華", honorific: "様" },
        vehicle: { name: "Ferrari 458 Italia", maker: "Ferrari", model: "458 Italia" },
        installation: { appliedDate: "2026-09-15", technician: "西川 敦司" },
        items: [{ category: "coating", name: "Q² CanCoat EVO" }],
      },
      { displayName: "カーディテーリング西川", logoMode: "da-default" },
    );
    assert.equal(canonical.includes("certificateNumber"), false);
    assert.equal(canonical.includes("issueDate"), false);
    assert.equal(canonical.includes("warranty"), false);
    assert.equal(canonical.includes("CanCoat"), true);
    assert.equal(
      canonical,
      '{"issuer":{"displayName":"カーディテーリング西川","logoMode":"da-default"},"projection":{"customer":{"honorific":"様","name":"石井 紗也華"},"documentClass":"installation-certificate-r1","installation":{"appliedDate":"2026-09-15","technician":"西川 敦司"},"items":[{"category":"coating","name":"Q² CanCoat EVO"}],"vehicle":{"maker":"Ferrari","model":"458 Italia","name":"Ferrari 458 Italia"}}}',
    );
    assert.equal(
      sha256Hex(canonical),
      "f4a5f422458e6763358dbfd38ec9bd0de0fe3986b7d0d9cf7413384191e3d69c",
    );
  });
});

describe("R1 issuance RPC boundary", () => {
  const row = {
    issuance_id: "123e4567-e89b-42d3-a456-426614174111",
    certificate_number: "CRT/IN/2026/00001",
    issued_on: "2026-09-16",
    source_fingerprint: "a".repeat(64),
    outcome: "created",
    created: true,
    replayed: false,
  } as const;

  it("accepts only the exact sanitized result shape", () => {
    assert.equal(isIssueInstallationCertificateR1RpcRow(row), true);
    assert.equal(isIssueInstallationCertificateR1RpcRow({ ...row, certificate_number: "CERT-1" }), false);
    assert.equal(isIssueInstallationCertificateR1RpcRow({ ...row, source_fingerprint: "secret" }), false);
  });

  it("maps only allowlisted database codes and not-eligible reasons", () => {
    assert.deepEqual(mapInstallationCertificateR1RpcError("UNAUTHENTICATED: x"), {
      kind: "unauthenticated",
    });
    assert.deepEqual(mapInstallationCertificateR1RpcError("NOT_ELIGIBLE: missing-technician"), {
      kind: "not_eligible",
      reasons: ["missing-technician"],
    });
    assert.deepEqual(mapInstallationCertificateR1RpcError("NOT_ELIGIBLE: private-row-data"), {
      kind: "unavailable",
    });
    assert.deepEqual(mapInstallationCertificateR1RpcError("42P01: secret SQL"), {
      kind: "unavailable",
    });
  });
});
