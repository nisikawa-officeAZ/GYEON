import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/pdf/installation-certificate/route.ts";
const code = readFileSync(ROUTE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("route accepts only issuanceId and optional exact download=1", () => {
  assert.match(code, /key === "issuanceId" \|\| key === "download"/);
  assert.match(code, /download !== null && download !== "1"/);
  assert.match(code, /!isCanonicalUuid\(issuanceId\)/);
});

test("genuine auth and RLS-visible issuance/document reads precede admin client", () => {
  const getUser = code.indexOf("supabase.auth.getUser()");
  const issuanceRead = code.indexOf('.from("certificate_issuances")');
  const documentRead = code.indexOf('.from("certificate_documents")');
  const admin = code.indexOf("createAdminClient()");
  assert.ok(getUser >= 0 && issuanceRead > getUser && documentRead > issuanceRead && admin > documentRead);
  assert.ok(code.indexOf("status: 401") > getUser && code.indexOf("status: 401") < issuanceRead);
});

test("route has coarse missing/not-stored/read/integrity status classes", () => {
  for (const status of [401, 400, 404, 409, 500, 503]) assert.match(code, new RegExp(`status: ${status}`));
});

test("route downloads one metadata-bound object and returns exact verified bytes privately", () => {
  assert.equal((code.match(/\.download\(row\.storage_path\)/g) ?? []).length, 1);
  assert.match(code, /validateStoredInstallationCertificateR1Artifact\(row, bytes, issuance\.dealer_id, issuanceId\)/);
  assert.match(code, /new Response\(new Uint8Array\(bytes\)/);
  assert.match(code, /"Content-Type": "application\/pdf"/);
  assert.match(code, /"Cache-Control": "private, no-store"/);
});

test("route is read-only and cannot render, issue, finalize, upload, remove, sign or expose a URL", () => {
  for (const forbidden of [
    "render-installation", "ensure-installation", "issue-installation", "finalize_installation",
    ".upload(", ".remove(", "createSignedUrl", "getPublicUrl", "signedUrl",
  ]) assert.equal(code.includes(forbidden), false, forbidden);
});
