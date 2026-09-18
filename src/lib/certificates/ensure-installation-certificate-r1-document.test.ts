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
  assert.match(code, /profile\.finalizeRpc/);
  assert.match(code, /p_template_version: profile\.templateVersion/);
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

test("dealer branding is canonical private bytes and default mode does not duplicate a shop logo", () => {
  const code = stripComments(read(ACTION));
  assert.match(code, /brandingStoragePath\(dealerId, "logo"\)/);
  assert.match(code, /storage\.from\(BRANDING_BUCKET\)\.download\(logoPath\)/);
  assert.match(code, /if \(snapshot\.issuer\.logoMode === "da-default"\) \{[\s\S]*return null;[\s\S]*\}/);
  assert.equal(code.includes('"public", "brand", "obsidian", "logos", "combination.svg"'), false);
  assert.equal(code.includes("fetch("), false);
});

test("renderer is byte-only, local-font and routes to the approved package v3.0.3 templates", () => {
  const renderer = stripComments(read(RENDERER));
  const template = stripComments(read(TEMPLATE));
  assert.match(renderer, /registerPdfFonts\(\)/);
  assert.match(renderer, /toInstallationCertificateR1Presentation\(snapshot\)/);
  assert.equal(renderer.includes("storage"), false);
  for (const forbidden of ["price", "tax", "discount", "total", "qrCode", "publicUrl", "fetch("]) {
    assert.equal(template.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
  assert.match(template, /CertificateDocument/);
  assert.match(template, /mode="front"/);
  assert.match(template, /resolveInstallationCertificateKind/);
  assert.match(template, /approvedCoatingCertificateContent/);
  assert.match(template, /approvedPpfCertificateContent/);
  assert.match(template, /approvedCancoatCertificateContent/);
  assert.equal(template.includes("__fixtures__"), false);
  assert.match(template, /gyeonRankLogo\(rank\)/);
  assert.match(template, /gyeonWordmark\(\)/);
  assert.match(template, /kind === "ppf" \? "ppf-installer"/);
  assert.equal(template.includes("MaintenanceHistoryPage"), false);
  assert.equal(template.includes("GYEON DETAILER AGENT"), false);
});
