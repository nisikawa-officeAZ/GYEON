import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES,
  buildInstallationCertificateR1DocumentPath,
  isFinalizeInstallationCertificateR1DocumentRpcRow,
  mapFinalizeInstallationCertificateR1DocumentRpcError,
  validateFinalizeInstallationCertificateR1DocumentCommand,
} from "./installation-certificate-r1-document-contract";

const DEALER_ID = "11111111-1111-4111-8111-111111111111";
const ISSUANCE_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const PATH = `${DEALER_ID}/certificates/installation-r1/${ISSUANCE_ID}/${DOCUMENT_ID}.pdf`;

const validCommand = {
  dealerId: DEALER_ID,
  issuanceId: ISSUANCE_ID,
  documentId: DOCUMENT_ID,
  storageBucket: "documents",
  storagePath: PATH,
  mimeType: "application/pdf",
  byteSize: 4096,
  sha256: "a".repeat(64),
  templateVersion: "installation-certificate-r1-v1",
  actorUserId: ACTOR_ID,
} as const;

describe("R1 document identity", () => {
  it("builds the one canonical private Storage path", () => {
    assert.equal(
      buildInstallationCertificateR1DocumentPath(DEALER_ID, ISSUANCE_ID, DOCUMENT_ID),
      PATH,
    );
    assert.throws(
      () => buildInstallationCertificateR1DocumentPath(DEALER_ID.toUpperCase(), ISSUANCE_ID, DOCUMENT_ID),
      /canonical UUIDs/,
    );
  });

  it("accepts only exact server-owned metadata", () => {
    assert.deepEqual(validateFinalizeInstallationCertificateR1DocumentCommand(validCommand), {
      ok: true,
      command: validCommand,
    });
    for (const command of [
      { ...validCommand, dealerId: DEALER_ID.toUpperCase() },
      { ...validCommand, storageBucket: "public" },
      { ...validCommand, storagePath: `${PATH}.tmp` },
      { ...validCommand, mimeType: "text/html" },
      { ...validCommand, byteSize: 0 },
      { ...validCommand, byteSize: INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES + 1 },
      { ...validCommand, byteSize: 1.5 },
      { ...validCommand, sha256: "A".repeat(64) },
      { ...validCommand, templateVersion: "latest" },
    ]) assert.deepEqual(validateFinalizeInstallationCertificateR1DocumentCommand(command), { ok: false });
  });
});

describe("R1 document RPC boundary", () => {
  const row = {
    document_id: DOCUMENT_ID,
    issuance_id: ISSUANCE_ID,
    storage_bucket: "documents",
    storage_path: PATH,
    mime_type: "application/pdf",
    byte_size: 4096,
    sha256: "b".repeat(64),
    template_version: "installation-certificate-r1-v1",
    generated_at: "2026-09-16T12:00:00.000Z",
    outcome: "created",
    created: true,
    replayed: false,
  } as const;

  it("accepts only coherent created/replayed result rows", () => {
    assert.equal(isFinalizeInstallationCertificateR1DocumentRpcRow(row), true);
    assert.equal(isFinalizeInstallationCertificateR1DocumentRpcRow({
      ...row, outcome: "replayed", created: false, replayed: true,
    }), true);
    assert.equal(isFinalizeInstallationCertificateR1DocumentRpcRow({
      ...row, outcome: "created", created: false,
    }), false);
    assert.equal(isFinalizeInstallationCertificateR1DocumentRpcRow({
      ...row, storage_path: `${PATH}.other`,
    }), false);
    assert.equal(isFinalizeInstallationCertificateR1DocumentRpcRow({
      ...row, sha256: "secret",
    }), false);
  });

  it("maps only stable allowlisted database errors", () => {
    assert.deepEqual(mapFinalizeInstallationCertificateR1DocumentRpcError(
      "VALIDATION_ERROR: document metadata is invalid",
    ), { kind: "invalid_request" });
    assert.deepEqual(mapFinalizeInstallationCertificateR1DocumentRpcError(
      "ARTIFACT_MISSING: uploaded object not found",
    ), { kind: "artifact_missing" });
    assert.deepEqual(mapFinalizeInstallationCertificateR1DocumentRpcError(
      "ARTIFACT_INTEGRITY_ERROR: uploaded object metadata mismatch",
    ), { kind: "artifact_integrity_error" });
    assert.deepEqual(mapFinalizeInstallationCertificateR1DocumentRpcError(
      "ARTIFACT_CONFLICT: canonical document already finalized",
    ), { kind: "artifact_conflict" });
    assert.deepEqual(mapFinalizeInstallationCertificateR1DocumentRpcError(
      "42P01: private SQL detail",
    ), { kind: "unavailable" });
  });
});
