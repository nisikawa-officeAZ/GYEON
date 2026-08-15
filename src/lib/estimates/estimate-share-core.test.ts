// R92B Phase 2 — the estimate-share decision core, executed.
//
// Run: node --import tsx --test src/lib/estimates/estimate-share-core.test.ts
//
// The core is pure (only `node:crypto` and injected data), so every rule — URL
// validity, token shape/hash, cross-table authority, public resolution, the
// active-share projection, the immutable path, and compensation ordering — is
// proved by calling the SHIPPING functions. The server-only wrappers over it
// hold no branching (asserted from source in estimate-share-boundary.test.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  resolveAppOrigin, buildShareUrl,
  generateShareToken, isValidShareTokenShape, shareTokenHash,
  checkShareCreateAuthority, resolveShareDecision,
  isShareActive, toShareListItem,
  buildSnapshotFileName, buildSnapshotStoragePath, compensationFor,
} from "./estimate-share-core";

const DEALER = "d1111111-1111-4111-8111-111111111111";
const ESTIMATE = "e2222222-2222-4222-8222-222222222222";
const DOCFILE = "f3333333-3333-4333-8333-333333333333";
const NOW = Date.parse("2026-07-24T00:00:00Z");

// ── 1-4. Canonical app URL ─────────────────────────────────────────────────

test("1. production requires an https origin; a valid one resolves", () => {
  assert.deepEqual(resolveAppOrigin("https://app.example.com", true), { kind: "ok", origin: "https://app.example.com" });
  assert.deepEqual(resolveAppOrigin("https://app.example.com/", true), { kind: "ok", origin: "https://app.example.com" });
  // A path/query is discarded — only the origin survives.
  assert.deepEqual(resolveAppOrigin("https://app.example.com/x?y=1", true), { kind: "ok", origin: "https://app.example.com" });
});

test("2. production REJECTS http, missing, blank and unparseable values (fail closed)", () => {
  for (const bad of [undefined, null, "", "   ", "not a url", "app.example.com", "ftp://app.example.com", "http://app.example.com"]) {
    assert.deepEqual(resolveAppOrigin(bad as string | null | undefined, true), { kind: "invalid-app-url" }, String(bad));
  }
});

test("3. development allows http ONLY for localhost/127.0.0.1", () => {
  assert.deepEqual(resolveAppOrigin("http://localhost:3000", false), { kind: "ok", origin: "http://localhost:3000" });
  assert.deepEqual(resolveAppOrigin("http://127.0.0.1:3000", false), { kind: "ok", origin: "http://127.0.0.1:3000" });
  // http to a real host is refused even in dev.
  assert.deepEqual(resolveAppOrigin("http://app.example.com", false), { kind: "invalid-app-url" });
  // https is always fine.
  assert.deepEqual(resolveAppOrigin("https://staging.example.com", false), { kind: "ok", origin: "https://staging.example.com" });
});

test("4. the share URL places the raw token as a path segment under /s/e/", () => {
  assert.equal(buildShareUrl("https://app.example.com", "TOKEN"), "https://app.example.com/s/e/TOKEN");
});

// ── 5-7. Token: shape, generation, hashing ─────────────────────────────────

test("5. a generated token is exactly 43 base64url chars and passes the shape check", () => {
  for (let i = 0; i < 50; i += 1) {
    const t = generateShareToken();
    assert.equal(t.length, 43, `token length ${t.length}`);
    assert.match(t, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(isValidShareTokenShape(t), true);
  }
});

test("6. the shape check rejects everything that is not exactly 43 base64url chars", () => {
  for (const bad of [
    null, undefined, 123, {}, "", "short", "A".repeat(42), "A".repeat(44),
    "A".repeat(42) + "+", "A".repeat(42) + "/", "A".repeat(42) + "=", "A".repeat(42) + " ",
    "日".repeat(43),
  ]) {
    assert.equal(isValidShareTokenShape(bad), false, JSON.stringify(bad));
  }
});

test("7. the hash is SHA-256 hex, deterministic, and only ever the hash is exposed", () => {
  const raw = generateShareToken();
  const h = shareTokenHash(raw);
  assert.equal(h, createHash("sha256").update(raw).digest("hex"));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(shareTokenHash(raw), h, "deterministic");
  assert.notEqual(shareTokenHash(raw + "x"), h, "collision-free for a different input");
  // The raw token is NOT recoverable from the hash (they simply differ).
  assert.notEqual(h, raw);
});

// ── 8-10. Create authority (cross-table proof) ─────────────────────────────

function authorityInput(over?: Partial<{
  estimate: { id: string; dealerId: string } | null;
  documentFile: { id: string; dealerId: string; documentType: string; documentId: string; status: string } | null;
}>) {
  return {
    dealerId: DEALER,
    estimateId: ESTIMATE,
    documentFileId: DOCFILE,
    estimate: over && "estimate" in over ? over.estimate! : { id: ESTIMATE, dealerId: DEALER },
    documentFile: over && "documentFile" in over
      ? over.documentFile!
      : { id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE, status: "active" },
  };
}

test("8. a fully-consistent set passes authority", () => {
  assert.deepEqual(checkShareCreateAuthority(authorityInput()), { kind: "ok" });
});

test("9. every single broken relationship fails authority as reference-integrity-failed", () => {
  const cases = [
    authorityInput({ estimate: null }),
    authorityInput({ estimate: { id: "other", dealerId: DEALER } }),
    authorityInput({ estimate: { id: ESTIMATE, dealerId: "other-dealer" } }),
    authorityInput({ documentFile: null }),
    authorityInput({ documentFile: { id: "other", dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE, status: "active" } }),
    authorityInput({ documentFile: { id: DOCFILE, dealerId: "other-dealer", documentType: "estimate", documentId: ESTIMATE, status: "active" } }),
    authorityInput({ documentFile: { id: DOCFILE, dealerId: DEALER, documentType: "invoice", documentId: ESTIMATE, status: "active" } }),
    authorityInput({ documentFile: { id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: "other", status: "active" } }),
    authorityInput({ documentFile: { id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE, status: "archived" } }),
  ];
  for (const [i, c] of cases.entries()) {
    assert.deepEqual(checkShareCreateAuthority(c), { kind: "reference-integrity-failed" }, `case ${i}`);
  }
});

// ── 10-13. Public resolution (single indistinguishable failure) ────────────

function resolutionInput(over?: Partial<{
  nowMs: number;
  share: {
    id: string; dealerId: string; estimateId: string; documentFileId: string;
    revokedAt: string | null; expiresAt: string;
  } | null;
  documentFile: {
    id: string; dealerId: string; documentType: string; documentId: string;
    status: string; filePath: string; fileName: string;
  } | null;
}>) {
  return {
    nowMs: over && "nowMs" in over ? over.nowMs! : NOW,
    share: over && "share" in over ? over.share! : {
      id: "share-1", dealerId: DEALER, estimateId: ESTIMATE, documentFileId: DOCFILE,
      revokedAt: null, expiresAt: "2026-08-01T00:00:00Z",
    },
    documentFile: over && "documentFile" in over ? over.documentFile! : {
      id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE,
      status: "active", filePath: `${DEALER}/estimate/shares/${ESTIMATE}/${DOCFILE}.pdf`, fileName: "EST-2026-0001.pdf",
    },
  };
}

test("10. a valid, unexpired, unrevoked share resolves to available with the file", () => {
  const r = resolveShareDecision(resolutionInput());
  assert.deepEqual(r, {
    kind: "available",
    filePath: `${DEALER}/estimate/shares/${ESTIMATE}/${DOCFILE}.pdf`,
    fileName: "EST-2026-0001.pdf",
  });
});

test("11. an archived document still resolves — a regeneration must not break a live share", () => {
  const r = resolveShareDecision(resolutionInput({
    documentFile: {
      id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE,
      status: "archived", filePath: "p", fileName: "n.pdf",
    },
  }));
  assert.equal(r.kind, "available");
});

test("12. EVERY failure mode collapses to the SAME `unavailable` (indistinguishable)", () => {
  const cases: Array<Parameters<typeof resolveShareDecision>[0]> = [
    resolutionInput({ share: null }),
    resolutionInput({ share: { id: "s", dealerId: DEALER, estimateId: ESTIMATE, documentFileId: DOCFILE, revokedAt: "2026-07-23T00:00:00Z", expiresAt: "2026-08-01T00:00:00Z" } }),
    resolutionInput({ share: { id: "s", dealerId: DEALER, estimateId: ESTIMATE, documentFileId: DOCFILE, revokedAt: null, expiresAt: "2026-07-23T00:00:00Z" } }), // expired
    resolutionInput({ share: { id: "s", dealerId: DEALER, estimateId: ESTIMATE, documentFileId: DOCFILE, revokedAt: null, expiresAt: "not-a-date" } }),
    resolutionInput({ documentFile: null }),
    resolutionInput({ documentFile: { id: "mismatch", dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE, status: "active", filePath: "p", fileName: "n" } }),
    resolutionInput({ documentFile: { id: DOCFILE, dealerId: "other", documentType: "estimate", documentId: ESTIMATE, status: "active", filePath: "p", fileName: "n" } }),
    resolutionInput({ documentFile: { id: DOCFILE, dealerId: DEALER, documentType: "invoice", documentId: ESTIMATE, status: "active", filePath: "p", fileName: "n" } }),
    resolutionInput({ documentFile: { id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: "other", status: "active", filePath: "p", fileName: "n" } }),
    resolutionInput({ documentFile: { id: DOCFILE, dealerId: DEALER, documentType: "estimate", documentId: ESTIMATE, status: "deleted", filePath: "p", fileName: "n" } }),
  ];
  for (const [i, c] of cases.entries()) {
    assert.deepEqual(resolveShareDecision(c), { kind: "unavailable" }, `case ${i} must be indistinguishable`);
  }
});

test("13. expiry is boundary-exact: expiry == now is unavailable, now+1ms is available", () => {
  const at = "2026-07-24T00:00:00.000Z";
  const eq = resolveShareDecision(resolutionInput({
    nowMs: Date.parse(at),
    share: { id: "s", dealerId: DEALER, estimateId: ESTIMATE, documentFileId: DOCFILE, revokedAt: null, expiresAt: at },
  }));
  assert.deepEqual(eq, { kind: "unavailable" }, "expires_at == now is already expired");
  const after = resolveShareDecision(resolutionInput({
    nowMs: Date.parse(at) - 1,
    share: { id: "s", dealerId: DEALER, estimateId: ESTIMATE, documentFileId: DOCFILE, revokedAt: null, expiresAt: at },
  }));
  assert.equal(after.kind, "available");
});

// ── 14-15. Active-share projection ─────────────────────────────────────────

test("14. isShareActive is true only for a non-revoked, unexpired row", () => {
  assert.equal(isShareActive({ revokedAt: null, expiresAt: "2026-08-01T00:00:00Z" }, NOW), true);
  assert.equal(isShareActive({ revokedAt: "2026-07-23T00:00:00Z", expiresAt: "2026-08-01T00:00:00Z" }, NOW), false);
  assert.equal(isShareActive({ revokedAt: null, expiresAt: "2026-07-23T00:00:00Z" }, NOW), false);
  assert.equal(isShareActive({ revokedAt: null, expiresAt: "bad" }, NOW), false);
});

test("15. the list projection exposes ONLY id/createdAt/expiresAt — no secret leaks", () => {
  const item = toShareListItem({ id: "share-1", createdAt: "2026-07-24T00:00:00Z", expiresAt: "2026-07-31T00:00:00Z" });
  assert.deepEqual(Object.keys(item).sort(), ["createdAt", "expiresAt", "id"]);
  // Even if extra fields were passed, the projection cannot carry them.
  const item2 = toShareListItem({
    id: "share-2", createdAt: "c", expiresAt: "e",
    // @ts-expect-error — a token_hash must have nowhere to go.
    token_hash: "SECRET", document_file_id: "SECRET", file_path: "SECRET",
  });
  assert.equal(JSON.stringify(item2).includes("SECRET"), false, "no secret field survives the projection");
});

// ── 16-17. Immutable path and compensation ─────────────────────────────────

test("16. the snapshot path is server-derived, unique per documentFileId, and distinct from the mutable path", () => {
  assert.equal(buildSnapshotFileName(DOCFILE), `${DOCFILE}.pdf`);
  assert.equal(buildSnapshotStoragePath(DEALER, ESTIMATE, DOCFILE), `${DEALER}/estimate/shares/${ESTIMATE}/${DOCFILE}.pdf`);
  // Two different document ids never collide.
  assert.notEqual(
    buildSnapshotStoragePath(DEALER, ESTIMATE, "aaaa"),
    buildSnapshotStoragePath(DEALER, ESTIMATE, "bbbb"),
  );
  // It is NOT the mutable `{dealer}/{type}/{number}.pdf` download path.
  assert.equal(buildSnapshotStoragePath(DEALER, ESTIMATE, DOCFILE).includes("/shares/"), true);
});

test("17. compensation maps each failed stage to the right undo + reason", () => {
  assert.deepEqual(compensationFor("upload"), { deleteObject: false, archiveDocumentRow: false, reason: "pdf-generation-failed" });
  assert.deepEqual(compensationFor("document-persist"), { deleteObject: true, archiveDocumentRow: false, reason: "document-persist-failed" });
  assert.deepEqual(compensationFor("share-create"), { deleteObject: false, archiveDocumentRow: true, reason: "share-create-failed" });
});
