// R92B Phase 2 — source guards for the estimate-share server-only boundary.
//
// Run: node --import tsx --test src/lib/estimates/estimate-share-boundary.test.ts
//
// `create-estimate-share.ts`, `resolve-estimate-share.ts` and
// `generate-estimate-snapshot-pdf.ts` all begin with `import "server-only"`, so
// they are NEVER imported here — `server-only` is a Next devDependency and is not
// resolvable by Node. Their guarantees (immutable path, upsert:false, token
// hashing, ordering, compensation, safe projection) are asserted by inspecting
// SOURCE TEXT, the same technique the LINE transport boundary test uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Comment-stripped source, so documentation may name a hazard the code must not use. */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const TYPES = "src/lib/estimates/estimate-share-types.ts";
const CORE = "src/lib/estimates/estimate-share-core.ts";
const CREATE = "src/lib/estimates/create-estimate-share.ts";
const RESOLVE = "src/lib/estimates/resolve-estimate-share.ts";
const SNAPSHOT = "src/lib/pdf/generate-estimate-snapshot-pdf.ts";
const ACTIONS = "src/lib/estimates/estimate-share-actions.ts";

// ── 1-2. Purity of the shared, importable modules ──────────────────────────

test("1. the types module is directive-free and side-effect-free", () => {
  const raw = readFileSync(TYPES, "utf8");
  assert.equal(raw.includes('"use server"'), false);
  assert.equal(raw.includes('import "server-only"'), false);
  // No runtime import at all — it is pure type declarations.
  assert.equal(/^import\s/m.test(codeOf(TYPES)), false, "the types module imports nothing");
});

test("2. the decision core is importable — no directive, no runtime import, no clock", () => {
  const code = codeOf(CORE);
  assert.equal(code.includes('"use server"'), false);
  assert.equal(code.includes('import "server-only"'), false);
  for (const forbidden of [
    "createClient", "createAdminClient", "next/", "react", "process.env",
    "fetch(", "Date.now", "new Date", "Math.random",
  ]) {
    assert.equal(code.includes(forbidden), false, `the core references ${forbidden}`);
  }
  // The ONLY runtime import is node:crypto (a builtin, resolvable under tsx); the
  // types import is type-only and erased.
  const imports = code.match(/^import .*$/gm) ?? [];
  assert.ok(imports.every((l) => /node:crypto/.test(l) || /^import type /.test(l)),
    "only node:crypto (value) and a type-only import are permitted");
});

// ── 3-5. The snapshot generator — immutable, upsert:false, self-compensating ─

test("3. the snapshot generator is server-only and renders via the production renderer", () => {
  const raw = readFileSync(SNAPSHOT, "utf8");
  assert.match(raw, /^import "server-only";/, "must OPEN with the server-only import");
  const code = codeOf(SNAPSHOT);
  assert.match(code, /renderEstimateDocumentPdf\(/, "reuses the one production renderer");
  assert.match(code, /getEstimatePdfData\(/, "reloads the estimate dealer-scoped");
});

test("4. the snapshot is written to the IMMUTABLE path with upsert:false, never the mutable path", () => {
  const code = codeOf(SNAPSHOT);
  // The immutable, server-derived path from the core.
  assert.match(code, /buildSnapshotStoragePath\(/);
  // upsert:false — the object is never overwritten.
  assert.match(code, /upsert:\s*false/);
  assert.equal(/upsert:\s*true/.test(code), false, "a share snapshot must never upsert");
  // It does NOT reuse the mutable download uploader.
  for (const forbidden of ["generate-pdf-and-upload", "generateAndUploadPdf", "buildDocumentStoragePath"]) {
    assert.equal(code.includes(forbidden), false, `the snapshot path must not use ${forbidden}`);
  }
});

test("5. a failed document-persist deletes the orphaned object (upload→persist compensation)", () => {
  const code = codeOf(SNAPSHOT);
  const insertAt = code.indexOf('.from("document_files")');
  const removeAt = code.indexOf(".remove([");
  assert.ok(insertAt >= 0 && removeAt > insertAt, "the object is removed only after a failed row insert");
  assert.match(code, /reason: "document-persist-failed"/);
  assert.match(code, /reason: "pdf-generation-failed"/);
  // The document row is inserted `active` with the server-generated id.
  assert.match(code, /status:\s*"active"/);
});

// ── 6-9. The orchestrator — URL-first, hash-only, compensating ─────────────

test("6. create-estimate-share is server-only and resolves the app URL BEFORE any side effect", () => {
  const raw = readFileSync(CREATE, "utf8");
  assert.match(raw, /^import "server-only";/);
  const code = codeOf(CREATE);
  const urlAt = code.indexOf("resolveAppOrigin(");
  const snapshotAt = code.indexOf("generateEstimateSnapshotPdf(");
  const insertAt = code.indexOf('.from("estimate_shares")');
  assert.ok(urlAt >= 0, "the app URL is resolved");
  assert.ok(urlAt < snapshotAt, "an invalid URL fails before the snapshot side effect");
  assert.ok(urlAt < insertAt, "…and before the share insert");
  assert.match(code, /reason: "invalid-app-url"/);
});

test("7. ONLY the token hash is persisted; the raw token appears solely inside the URL", () => {
  const code = codeOf(CREATE);
  assert.match(code, /generateShareToken\(\)/);
  assert.match(code, /shareTokenHash\(rawToken\)/);
  // The insert persists token_hash — never a raw token column.
  assert.match(code, /token_hash: tokenHash/);
  assert.equal(/\btoken:\s/.test(code), false, "no raw token column is inserted");
  // The raw token appears in exactly three places: its declaration, the hash
  // input, and the URL — never a column, log or error.
  const rawUses = code.match(/rawToken/g) ?? [];
  assert.equal(rawUses.length, 3, "rawToken: declaration + hash input + URL only");
  assert.match(code, /buildShareUrl\(origin\.origin, rawToken\)/);
});

test("8. authority is proven before the insert, and a failed share-create archives the orphan row", () => {
  const code = codeOf(CREATE);
  const authAt = code.indexOf("checkShareCreateAuthority(");
  const insertAt = code.indexOf('.from("estimate_shares")');
  assert.ok(authAt >= 0 && authAt < insertAt, "authority is checked before the share row is written");
  // On a failed share insert the document row is archived (object kept).
  assert.match(code, /reason: "share-create-failed"/);
  assert.match(code, /status: "archived"/);
});

test("9. every create query is dealer-scoped; the estimate load carries the tenant predicate", () => {
  const code = codeOf(CREATE);
  assert.match(code, /await getCurrentDealer\(\)/);
  assert.match(code, /\.eq\("dealer_id", dealer\.dealer_id\)/);
  assert.match(code, /\.is\("deleted_at", null\)/);
});

// ── 10-12. Public resolution — shape-first, hash-keyed, indistinguishable ───

test("10. resolve-estimate-share is server-only and validates SHAPE before any DB access", () => {
  const raw = readFileSync(RESOLVE, "utf8");
  assert.match(raw, /^import "server-only";/);
  const code = codeOf(RESOLVE);
  const shapeAt = code.indexOf("isValidShareTokenShape(");
  const queryAt = code.indexOf('.from("estimate_shares")');
  assert.ok(shapeAt >= 0 && shapeAt < queryAt, "a malformed token never reaches the query");
});

test("11. the lookup is keyed by the HASH, and the decision is delegated to the pure core", () => {
  const code = codeOf(RESOLVE);
  assert.match(code, /\.eq\("token_hash", shareTokenHash\(rawToken\)\)/);
  assert.match(code, /resolveShareDecision\(/);
  // Nothing distinguishes the failure modes — both page and route see one shape.
  assert.equal(code.includes("expired"), false, "no reason is leaked to the caller");
});

test("12. the download helper streams the immutable object via the admin client", () => {
  const code = codeOf(RESOLVE);
  assert.match(code, /downloadSharedPdfBytes/);
  assert.match(code, /\.storage\s*\n?\s*\.from\("documents"\)\s*\n?\s*\.download\(/);
});

// ── 13-14. The revoke actions — safe projection, dealer-scoped, idempotent ──

test("13. the actions module is a Server Action file and exposes only the safe projection", () => {
  const raw = readFileSync(ACTIONS, "utf8");
  assert.match(raw, /^"use server";/);
  assert.equal(codeOf(ACTIONS).includes('import "server-only"'), false);
  const code = codeOf(ACTIONS);
  // The list goes through the pure projection — never a raw row.
  assert.match(code, /toShareListItem\(/);
  assert.match(code, /isShareActive\(/);
  // The SELECT reads only safe columns — no token_hash, no file_path.
  assert.match(code, /\.select\("id, created_at, expires_at, revoked_at"\)/);
  for (const forbidden of ["token_hash", "file_path", "document_file_id"]) {
    assert.equal(code.includes(forbidden), false, `the list select exposes ${forbidden}`);
  }
});

test("14. revoke is dealer-scoped, estimate-scoped and idempotent (only unrevoked rows)", () => {
  const code = codeOf(ACTIONS);
  assert.match(code, /\.eq\("dealer_id", dealer\.dealer_id\)/);
  assert.match(code, /\.eq\("estimate_id", estimateId\)/);
  assert.match(code, /\.eq\("id", shareId\)/);
  assert.match(code, /\.is\("revoked_at", null\)/, "an already-revoked row is left untouched");
  assert.match(code, /revoked_at:/);
  assert.match(code, /revoked_by:/);
});
