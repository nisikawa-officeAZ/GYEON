import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isCanonicalInstallationCertificateR1Pdf,
  parseInstallationCertificateR1Snapshot,
  sha256InstallationCertificateR1Pdf,
  snapshotMatchesIssuance,
  toInstallationCertificateR1Presentation,
  validateStoredInstallationCertificateR1Artifact,
  validateStoredInstallationCertificateR1Metadata,
} from "./installation-certificate-r1-artifact-core";

const dealerId = "11111111-1111-4111-8111-111111111111";
const issuanceId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";

const snapshot = {
  schemaVersion: 1,
  documentClass: "installation-certificate-r1",
  certificateNumber: "CRT/IN/2026/00001",
  issueDate: "2026-09-16",
  customer: { name: "石井 紗也華", honorific: "様" },
  vehicle: { name: "Ferrari 458 Italia", maker: "Ferrari", model: "458 Italia" },
  installation: { appliedDate: "2026-09-15", technician: "西川 敦司" },
  items: [
    { category: "coating", name: "Q² CanCoat EVO" },
    { category: "maintenance", name: "定期メンテナンス", description: "被膜状態を確認" },
  ],
  issuer: {
    displayName: "カーディテーリング西川",
    email: "shop@example.test",
    website: "https://example.test",
    logoMode: "da-default",
  },
} as const;

test("strict schema v1 parses and preserves item order including ordinary CanCoat", () => {
  const parsed = parseInstallationCertificateR1Snapshot(snapshot);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.snapshot.items.map((item) => item.name), [
    "Q² CanCoat EVO", "定期メンテナンス",
  ]);
});

test("unknown, monetary, memo, warranty, grant, QR, public-link and persistence keys fail closed", () => {
  for (const forbidden of [
    "price", "quantity", "tax", "discount", "total", "memo", "warranty",
    "grant", "qrCode", "publicUrl", "storagePath", "sha256",
  ]) {
    assert.equal(parseInstallationCertificateR1Snapshot({ ...snapshot, [forbidden]: "x" }).ok, false, forbidden);
  }
  assert.equal(parseInstallationCertificateR1Snapshot({ ...snapshot, items: [] }).ok, false);
  assert.equal(parseInstallationCertificateR1Snapshot({ ...snapshot, issueDate: "2026-02-30" }).ok, false);
});

test("narrow presentation drops URL and logo mode and cannot carry prohibited domains", () => {
  const parsed = parseInstallationCertificateR1Snapshot(snapshot);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const presentation = toInstallationCertificateR1Presentation(parsed.snapshot);
  assert.equal("website" in presentation.issuer, false);
  assert.equal("logoMode" in presentation.issuer, false);
  for (const key of ["price", "memo", "warranty", "grant", "qr", "publicUrl", "storagePath"]) {
    assert.equal(key in (presentation as unknown as Record<string, unknown>), false);
  }
});

test("snapshot must exactly match immutable issuance identity", () => {
  const parsed = parseInstallationCertificateR1Snapshot(snapshot);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(snapshotMatchesIssuance(parsed.snapshot, {
    document_class: "installation-certificate-r1",
    source_contract_version: 1,
    certificate_number: snapshot.certificateNumber,
    issued_on: snapshot.issueDate,
  }), true);
  assert.equal(snapshotMatchesIssuance(parsed.snapshot, {
    document_class: "installation-certificate-r1",
    source_contract_version: 1,
    certificate_number: "CRT/IN/2026/99999",
    issued_on: snapshot.issueDate,
  }), false);
});

test("canonical PDF metadata, signature, size and SHA-256 are byte exact", () => {
  const bytes = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "ascii");
  assert.equal(isCanonicalInstallationCertificateR1Pdf(bytes), true);
  const row = {
    id: documentId,
    dealer_id: dealerId,
    issuance_id: issuanceId,
    revision: 1,
    storage_bucket: "documents",
    storage_path: `${dealerId}/certificates/installation-r1/${issuanceId}/${documentId}.pdf`,
    mime_type: "application/pdf",
    byte_size: bytes.byteLength,
    sha256: sha256InstallationCertificateR1Pdf(bytes),
    template_version: "installation-certificate-r1-v1",
  };
  assert.equal(validateStoredInstallationCertificateR1Metadata(row, dealerId, issuanceId), true);
  assert.equal(validateStoredInstallationCertificateR1Artifact(row, bytes, dealerId, issuanceId), true);
  assert.equal(validateStoredInstallationCertificateR1Artifact(
    { ...row, sha256: "0".repeat(64) }, bytes, dealerId, issuanceId,
  ), false);
  assert.equal(validateStoredInstallationCertificateR1Artifact(
    { ...row, storage_path: `${dealerId}/wrong.pdf` }, bytes, dealerId, issuanceId,
  ), false);
});
