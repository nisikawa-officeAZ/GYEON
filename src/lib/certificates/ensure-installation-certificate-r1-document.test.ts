import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ACTION = "src/lib/certificates/ensure-installation-certificate-r1-document.ts";
const RENDERER = "src/lib/pdf/render-installation-certificate-r1-document.tsx";
const TEMPLATE = "src/components/documents/templates/certificates/InstallationCertificateR1Document.tsx";
const read = (file: string) => readFileSync(file, "utf8");
const stripComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("request auth and getUser precede creation of admin authority", () => {
  const code = stripComments(read(ACTION));
  const capability = code.indexOf('requireStaffCapability("edit")');
  const getUser = code.indexOf("supabase.auth.getUser()");
  const admin = code.indexOf("createAdminClient()", code.indexOf("export async function ensure"));
  assert.ok(capability >= 0 && getUser > capability && admin > getUser);
});

test("existing pointer is downloaded and byte-verified before every render/upload/finalize path", () => {
  const code = stripComments(read(ACTION));
  const existing = code.indexOf("if (existing)");
  const verify = code.indexOf("downloadAndVerify(admin", existing);
  const ready = code.indexOf('return { kind: "ready"', verify);
  const render = code.indexOf("renderInstallationCertificateR1DocumentPdf(");
  assert.ok(existing >= 0 && verify > existing && ready > verify && render > ready);
});

test("missing artifact renders and uploads once, immutable, then finalizes once", () => {
  const code = stripComments(read(ACTION));
  assert.equal((code.match(/renderInstallationCertificateR1DocumentPdf\(/g) ?? []).length, 1);
  assert.equal((code.match(/\.upload\(storagePath, pdfBytes/g) ?? []).length, 1);
  assert.match(code, /contentType: INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE,[\s\S]*upsert: false/);
  assert.equal((code.match(/"finalize_installation_certificate_r1_document_v1"/g) ?? []).length, 1);
});

test("race resolution is bounded and deletes only this attempt object", () => {
  const code = stripComments(read(ACTION));
  assert.equal((code.match(/export async function ensureInstallationCertificateR1Document\(/g) ?? []).length, 1);
  assert.equal(/for\s*\(|while\s*\(/.test(code), false);
  assert.match(code, /remove\(\[storagePath\]\)/);
  assert.equal(code.includes("remove([row.storage_path])"), false);
  assert.match(code, /mapped\.kind === "artifact_conflict"[\s\S]*resolveWinnerOnce/);
  assert.match(code, /return \{ kind: "cleanup_failed" \}/);
});

test("ambiguous finalization failure reconciles once before cleanup and never deletes possibly committed bytes", () => {
  const code = stripComments(read(ACTION));
  const finalizationError = code.indexOf("if (finalizeError)");
  const ambiguous = code.indexOf('mapped.kind === "unavailable"', finalizationError);
  const reconcile = code.indexOf("resolveWinnerOnce(", ambiguous);
  const cleanup = code.indexOf("cleanupOwnObject(admin, storagePath)", finalizationError);
  assert.ok(
    finalizationError >= 0 && ambiguous > finalizationError && reconcile > ambiguous && cleanup > reconcile,
  );
  assert.match(
    code.slice(ambiguous, cleanup),
    /return recovered\.kind === "ready" \? recovered : \{ kind: "persistence_error" \}/,
  );
  assert.equal(code.slice(ambiguous, cleanup).includes("cleanupOwnObject"), false);
});

test("dealer branding is canonical private bytes and default branding is vendored", () => {
  const code = stripComments(read(ACTION));
  assert.match(code, /brandingStoragePath\(dealerId, "logo"\)/);
  assert.match(code, /storage\.from\(BRANDING_BUCKET\)\.download\(logoPath\)/);
  assert.match(code, /public", "brand", "obsidian", "logos", "combination\.svg"/);
  assert.equal(code.includes("fetch("), false);
});

test("renderer is byte-only, local-font and uses the approved service-specific certificate UI", () => {
  const renderer = stripComments(read(RENDERER));
  const template = stripComments(read(TEMPLATE));
  assert.match(renderer, /registerPdfFonts\(\)/);
  assert.match(renderer, /toInstallationCertificateR1Presentation\(snapshot\)/);
  assert.equal(renderer.includes("storage"), false);
  for (const forbidden of ["price", "tax", "discount", "total", "warranty", "qrCode", "publicUrl", "fetch("]) {
    assert.equal(template.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
  assert.match(template, /施工証明書/);
  assert.match(template, /Certificate of Installation/);
  assert.match(template, /MaintenanceHistoryPage/);
  assert.match(template, /CertificateHeader/);
  assert.match(template, /CertificateCustomerVehicle/);
  assert.match(template, /CertificateProductSection/);
  assert.match(template, /CertificateFooter/);
  assert.match(template, /resolveInstallationCertificateR1Kind/);
  assert.match(template, /SerialFooter/);
  assert.match(template, /GYEON PPF 施工証明書/);
  assert.match(template, /CanCoat · Certified Detailer/);
});
