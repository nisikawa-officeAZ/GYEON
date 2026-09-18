import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeCertificateLikePattern,
  normalizeCertificatePage,
  normalizeCertificateSearch,
  projectInstallationCertificateListItem,
} from "./installation-certificate-list-contract";

const snapshot = {
  schemaVersion: 1,
  documentClass: "installation-certificate-r1",
  certificateNumber: "CRT/IN/2026/00001",
  issueDate: "2026-09-17",
  customer: { name: "有限会社 オフィスアズ", honorific: "御中" },
  vehicle: { name: "ホンダ B-BOX", plate: "滋賀 480 て 4938" },
  installation: { appliedDate: "2026-09-16", technician: "施工 太郎" },
  items: [{ category: "コーティング", name: "ボディコーティング" }],
  issuer: { displayName: "カーディテーリング西川", logoMode: "da-default" },
} as const;

test("search input is trimmed, bounded, and LIKE metacharacters stay literal", () => {
  assert.equal(normalizeCertificateSearch("  オフィスアズ  "), "オフィスアズ");
  assert.equal(normalizeCertificateSearch("a".repeat(101)).length, 100);
  assert.equal(escapeCertificateLikePattern("100%_\\"), "100\\%\\_\\\\");
});

test("pagination accepts only positive decimal pages", () => {
  assert.equal(normalizeCertificatePage("2"), 2);
  for (const invalid of [undefined, "", "0", "-1", "1.5", "abc"]) {
    assert.equal(normalizeCertificatePage(invalid), 1);
  }
});

test("valid immutable snapshot projects searchable customer and vehicle facts", () => {
  assert.deepEqual(
    projectInstallationCertificateListItem({
      id: "c7777777-7777-4777-8777-777777777777",
      certificate_number: snapshot.certificateNumber,
      issued_on: snapshot.issueDate,
      issued_at: "2026-09-17T00:00:00.000Z",
      snapshot,
    }, true),
    {
      issuanceId: "c7777777-7777-4777-8777-777777777777",
      certificateNumber: snapshot.certificateNumber,
      issueDate: snapshot.issueDate,
      issuedAt: "2026-09-17T00:00:00.000Z",
      customerName: "有限会社 オフィスアズ",
      vehicleName: "ホンダ B-BOX",
      plate: "滋賀 480 て 4938",
      appliedDate: "2026-09-16",
      technician: "施工 太郎",
      hasDocument: true,
      snapshotValid: true,
      certificateKind: null,
    },
  );
});

test("R2 kind-specific snapshot projects its canonical kind and serial", () => {
  const r2 = {
    ...snapshot,
    schemaVersion: 2,
    documentClass: "installation-certificate-ppf-r2",
    certificateKind: "ppf",
    certificateNumber: "CRT/PPF/2026/00001",
  } as const;
  const item = projectInstallationCertificateListItem({
    id: "c7777777-7777-4777-8777-777777777777",
    certificate_number: r2.certificateNumber,
    issued_on: r2.issueDate,
    issued_at: "2026-09-17T00:00:00.000Z",
    snapshot: r2,
  }, true);
  assert.equal(item.snapshotValid, true);
  assert.equal(item.certificateKind, "ppf");
  assert.equal(item.certificateNumber, "CRT/PPF/2026/00001");
});

test("identity mismatch fails closed and suppresses PDF availability", () => {
  const item = projectInstallationCertificateListItem({
    id: "c7777777-7777-4777-8777-777777777777",
    certificate_number: "CRT/IN/2026/99999",
    issued_on: snapshot.issueDate,
    issued_at: "2026-09-17T00:00:00.000Z",
    snapshot,
  }, true);
  assert.equal(item.snapshotValid, false);
  assert.equal(item.hasDocument, false);
});
