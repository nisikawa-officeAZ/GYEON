// DEALEROS-ESTIMATE-INVOICE-PDF-B1 — boundary contracts across the invoice paths.
//
// Run: node --import tsx --test src/lib/invoices/invoice-issuance-boundary.test.ts
//
// These assert properties of the SOURCE that no unit test of a single function
// can: that the mutable overwrite helper is gone from the invoice flow, that the
// upload is non-overwriting, that the UI no longer promises a document it cannot
// produce, and that the database trigger and the pure core agree on which columns
// are frozen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { INVOICE_COMMERCIAL_FIELDS } from "./invoice-issuance-core";

const ROOT = process.cwd();

/**
 * These contracts are about CODE, not prose. A comment that names the retired
 * helper (to explain why it is gone) must not read as a violation, so line and
 * block comments are removed before scanning.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*--.*$/gm, "");
}

const readRaw = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const read = (rel: string) => stripComments(readRaw(rel));

const CORE = read("src/lib/invoices/invoice-issuance-core.ts");
const ISSUE = read("src/lib/invoices/issue-invoice.ts");
const GENERATE = read("src/lib/pdf/generate-invoice-pdf.ts");
const CREATE = read("src/lib/invoices/create-invoice.ts");
const UPDATE = read("src/lib/invoices/update-invoice.ts");
const DETAIL = read("src/components/invoices/InvoiceDetail.tsx");
const ACTIONS = read("src/components/invoices/InvoicePdfIssueActions.tsx");
const MIGRATION = read("supabase/migrations/20260801132658_invoice_issued_immutability.sql");

// ── The mutable overwrite helper is out of the invoice flow ──────────────────

test("1. no invoice issuance path imports or calls generateAndUploadPdf", () => {
  for (const [name, src] of [["issue-invoice", ISSUE], ["generate-invoice-pdf", GENERATE]] as const) {
    assert.ok(!/generateAndUploadPdf/.test(src), `${name} must not use the upserting helper`);
    assert.ok(!/generate-pdf-and-upload/.test(src), `${name} must not import it either`);
  }
});

test("2. no invoice path builds the old stable document path", () => {
  for (const src of [ISSUE, GENERATE]) {
    assert.ok(!/buildDocumentStoragePath/.test(src));
    assert.ok(!/buildDocumentFileName/.test(src));
  }
});

test("3. the invoice upload is non-overwriting", () => {
  assert.match(ISSUE, /upsert:\s*false/);
  assert.ok(!/upsert:\s*true/.test(ISSUE), "an invoice upload must never overwrite");
  assert.ok(!/upsert:\s*true/.test(GENERATE));
});

test("4. the old generator delegates instead of generating", () => {
  assert.match(GENERATE, /issueInvoice/);
  assert.ok(!/renderInvoicePdf/.test(GENERATE), "it must no longer render");
  assert.ok(!/\.storage\b/.test(GENERATE), "it must no longer touch Storage directly");
});

// ── The issuance action's own guarantees ─────────────────────────────────────

test("5. issuance requires the finance capability and a session dealer", () => {
  assert.match(ISSUE, /requireStaffCapability\("finance"\)/);
  assert.match(ISSUE, /await getCurrentDealer\(\)/);
  // dealer_id is never taken from an argument.
  assert.ok(!/dealerId\s*[:=]\s*(fd|params|body|input)\./.test(ISSUE));
});

test("6. every admin-client TABLE statement is dealer-scoped, since RLS is bypassed", () => {
  // Only database tables are checked here. `.storage.from("documents")` names a
  // BUCKET, not a table: its tenant boundary is the dealer-prefixed object key
  // produced by buildIssuedInvoiceObjectKey (tests 7 and core test 11).
  const tableChains = ISSUE.split(/\.from\(/)
    .slice(1)
    .filter((chain) => !/^"documents"\)/.test(chain));

  assert.ok(tableChains.length >= 3, "expected the invoices and document_files statements");

  for (const chain of tableChains) {
    const window = chain.slice(0, 400);
    // Both helpers resolve the dealer from the session; issueInvoice keeps it in
    // `dealerId`, getIssuedInvoicePdfUrl reads `dealer.dealer_id` directly.
    assert.ok(
      /\.eq\("dealer_id", (dealerId|dealer\.dealer_id)\)/.test(window) ||
        /dealer_id: dealerId/.test(window),
      `a table statement lacks an explicit dealer predicate: ${window.slice(0, 60)}`
    );
  }
});

test("6a. storage object keys carry the dealer prefix instead of an eq predicate", () => {
  // Every storage call operates on `filePath`, which the core builder guarantees
  // begins with the session dealer id.
  const storageCalls = ISSUE.match(/\.storage\s*\n?\s*\.from\("documents"\)[\s\S]{0,160}/g) ?? [];
  assert.ok(storageCalls.length >= 3, "upload, remove and signed-url calls expected");
  for (const call of storageCalls) {
    assert.ok(
      /filePath/.test(call),
      `a storage call does not use the dealer-prefixed key: ${call.slice(0, 60)}`
    );
  }
});

test("7. the object key comes from the pure core, not from string concatenation", () => {
  assert.match(ISSUE, /buildIssuedInvoiceObjectKey\(dealerId, invoiceId, documentFileId\)/);
  assert.match(ISSUE, /randomUUID\(\)/);
  // The key must never be assembled by hand from a template literal.
  assert.ok(!/const filePath = `/.test(ISSUE), "the key must come from the core builder");
});

test("8. the transition is race-safe and only flips a draft", () => {
  assert.match(ISSUE, /\.eq\("status", "draft"\)/);
  assert.match(ISSUE, /resolveConcurrentIssue\(/);
  // The artifact path is persisted in the same conditional update.
  assert.match(ISSUE, /pdf_file_path: filePath/);
});

test("9. failures after the upload compensate, and signing failures never regenerate", () => {
  assert.match(ISSUE, /planCompensation\(/);
  assert.match(ISSUE, /await compensate\(\)/);
  // The signer only signs; it must not upload or render. B1-R2-7: slice the
  // function that actually exists, and prove the slice is real so the assertion
  // cannot pass vacuously on indexOf === -1.
  const signStart = ISSUE.indexOf("async function signResolvedArtifact");
  const signEnd = ISSUE.indexOf("export async function issueInvoice");
  assert.ok(signStart > 0 && signEnd > signStart, "signResolvedArtifact must be present");
  const signFn = ISSUE.slice(signStart, signEnd);
  assert.ok(signFn.length > 200, "the sliced signer body must be non-trivial");
  assert.ok(!/upload\(/.test(signFn));
  assert.ok(!/renderInvoicePdf/.test(signFn));
});

test("10. all seven typed outcomes exist", () => {
  for (const kind of [
    "issued",
    "already_issued",
    "validation_error",
    "conflict",
    "artifact_missing",
    "storage_error",
    "persistence_error",
  ]) {
    assert.ok(CORE.includes(`"${kind}"`), `${kind} missing from the core outcome union`);
  }
});

// ── Create and update cannot manufacture an issued invoice ───────────────────

test("11. creation always produces a draft", () => {
  assert.ok(!/status:\s*\(fd\.get\("status"\)/.test(CREATE), "status must not come from the client");
  assert.match(CREATE, /status:\s*"draft"/);
});

test("12. updates cannot accept a client-selected status", () => {
  assert.ok(!/status:\s*\(fd\.get\("status"\)/.test(UPDATE));
  // Post-R4 the draft save never sends a status at all: save_invoice_draft only
  // ever touches a row that is already draft and never writes the column, which
  // is stronger than pinning the literal "draft" in the payload.
  assert.ok(!/\bstatus:/.test(UPDATE), "the draft save must not send a status field");
  // Anchor AFTER the UPDATE keyword: the earlier SELECT also has a where clause.
  const updateAt = SAVE_FN.indexOf("update public.invoices i");
  const setClause = SAVE_FN.slice(updateAt, SAVE_FN.indexOf("where i.id = p_invoice_id", updateAt));
  assert.ok(setClause.length > 100, "the SET clause must be present");
  assert.ok(!/\bstatus\s*=/.test(setClause), "the function must never assign status");
});

test("13. updates reject commercial edits once the invoice has left draft", () => {
  assert.match(UPDATE, /evaluateCommercialEdit\(/);
  assert.match(UPDATE, /\.select\("id, status"\)/);
  assert.match(UPDATE, /発行済みの請求書は編集できません/);
});

test("14. soft deletion of a non-draft invoice is refused", () => {
  assert.match(UPDATE, /evaluateSoftDelete\(/);
  assert.match(UPDATE, /発行済みの請求書は削除できません/);
  // Defence in depth: the delete statement itself is pinned to draft.
  assert.match(UPDATE, /\.eq\("status", "draft"\)/);
});

// ── UI ───────────────────────────────────────────────────────────────────────

test("15. the misleading placeholder and print flow are gone", () => {
  assert.ok(!/window\.print\(\)/.test(DETAIL));
  assert.ok(!/PDFプレビューはこちらに表示されます/.test(DETAIL));
  assert.ok(!/DocumentPdfActions/.test(DETAIL));
  // The legacy HTML preview is still NOT mounted as a substitute.
  assert.ok(!/InvoicePdfPreview\b/.test(DETAIL.replace(/InvoicePdfIssueActions/g, "")));
});

test("16. the UI exposes draft-issue and issued-download states", () => {
  assert.match(ACTIONS, /請求書を発行/);
  assert.match(ACTIONS, /発行済みPDFをダウンロード/);
  assert.match(ACTIONS, /status === "draft"/);
  assert.match(ACTIONS, /issueInvoice\(invoiceId\)/);
  assert.match(ACTIONS, /getIssuedInvoicePdfUrl\(invoiceId\)/);
  assert.match(DETAIL, /<InvoicePdfIssueActions/);
});

test("17. edit controls appear only for drafts", () => {
  assert.match(DETAIL, /const isDraft = invoiceData\.status === "draft"/);
  assert.match(DETAIL, /\{isDraft && \(/);
});

test("18. the UI never surfaces storage internals", () => {
  for (const leak of ["documents", "bucket", "service_role", "SUPABASE"]) {
    assert.ok(!ACTIONS.includes(leak), `the UI must not mention ${leak}`);
  }
});

// ── Migration source contract ────────────────────────────────────────────────

test("19. the trigger freezes exactly the commercial fields the core declares", () => {
  for (const field of INVOICE_COMMERCIAL_FIELDS) {
    assert.ok(
      new RegExp(`new\\.${field}\\s+is distinct from old\\.${field}`).test(MIGRATION),
      `${field} is declared frozen in the core but not guarded in SQL`
    );
  }
});

test("20. payment aggregates and lifecycle status stay mutable in SQL", () => {
  // Post-B1-R3 these fields ARE versioned while draft (they render into the PDF),
  // so the claim is scoped to the POST-ISSUE frozen block only.
  const frozenBlock = MIGRATION.slice(
    MIGRATION.indexOf("invoice_cannot_return_to_draft"),
    MIGRATION.indexOf("invoice_issued_fields_immutable")
  );
  assert.ok(frozenBlock.length > 200, "the frozen block must be present");
  for (const field of ["paid_amount", "balance_due", "internal_memo"]) {
    assert.ok(
      !new RegExp(`new\\.${field}\\s+is distinct from old\\.${field}`).test(frozenBlock),
      `${field} must remain mutable after issuance`
    );
  }
  assert.match(MIGRATION, /new\.status not in \('issued', 'partially_paid', 'paid', 'overdue', 'cancelled'\)/);
});

test("21. SQL blocks the return to draft and requires an artifact to issue", () => {
  assert.match(MIGRATION, /invoice_cannot_return_to_draft/);
  assert.match(MIGRATION, /invoice_issue_requires_pdf_artifact/);
  assert.match(MIGRATION, /new\.pdf_file_path is null or btrim\(new\.pdf_file_path\) = ''/);
});

test("22. invoice_items are frozen for insert, update and delete once out of draft", () => {
  assert.match(MIGRATION, /before insert or update or delete on public\.invoice_items/);
  assert.match(MIGRATION, /invoice_items_immutable_after_issue/);
  // A cascade delete must not trip the guard. Post-B1-R2 the parent-gone case is
  // handled inside the DELETE branch of the per-operation guard — see test 38.
  assert.match(MIGRATION, /if v_old_status is null then\s*\n\s*return old;/);
});

test("23. the guards are INVOKER, search_path-pinned and not directly executable", () => {
  assert.ok(!/security definer/i.test(MIGRATION));
  const pins = MIGRATION.match(/set search_path = ''/g) ?? [];
  // (MIGRATION is comment-stripped, so these are the real function bodies.)
  // Six pinned functions after B1-R4: five triggers plus save_invoice_draft.
  assert.equal(pins.length, 6, "every function must pin an empty search_path");
  for (const role of ["public", "anon", "authenticated"]) {
    assert.ok(
      new RegExp(`revoke all on function public\\.enforce_invoice_issued_immutability\\(\\) from ${role}`).test(MIGRATION)
    );
    assert.ok(
      new RegExp(`revoke all on function public\\.enforce_invoice_items_issued_immutability\\(\\) from ${role}`).test(MIGRATION)
    );
  }
});

test("24. the migration never touches storage.buckets", () => {
  assert.ok(!/storage\.buckets/.test(MIGRATION));
  assert.ok(!/create bucket/i.test(MIGRATION));
});

// ── The pure core stays pure ─────────────────────────────────────────────────

test("25. the core imports nothing at all", () => {
  assert.ok(!/^import\s/m.test(CORE), "the pure core must have zero imports");
  for (const forbidden of ["react", "server-only", "@supabase", "process.env", "fetch("]) {
    assert.ok(!CORE.includes(forbidden), `the core must not reference ${forbidden}`);
  }
});

// ── B1-R1 repairs ────────────────────────────────────────────────────────────

test("26. no raw invoice path is ever signed", () => {
  // The old direct signer is gone; every signature goes through the resolver.
  assert.ok(!/signExisting/.test(ISSUE));
  assert.match(ISSUE, /async function signResolvedArtifact\(/);
  assert.match(ISSUE, /resolveSignableArtifact\(/);

  // createSignedUrl may only ever receive the RESOLVED path.
  const signCalls = ISSUE.match(/createSignedUrl\([^)]*\)/g) ?? [];
  assert.equal(signCalls.length, 1, "exactly one signing call expected");
  assert.match(signCalls[0], /resolution\.filePath/);
});

test("27. the artifact lookup is dealer-, invoice-, type- and status-scoped", () => {
  const lookup = ISSUE.slice(ISSUE.indexOf('.from("document_files")'), ISSUE.indexOf("resolveSignableArtifact("));
  assert.match(lookup, /\.eq\("dealer_id", dealerId\)/);
  assert.match(lookup, /\.eq\("document_type", "invoice"\)/);
  assert.match(lookup, /\.eq\("document_id", invoiceId\)/);
  assert.match(lookup, /\.eq\("status", "active"\)/);
});

test("28. downloads reject drafts and reuse the same validated resolver", () => {
  const dl = ISSUE.slice(ISSUE.indexOf("export async function getIssuedInvoicePdfUrl"));
  assert.match(dl, /canDownloadIssuedArtifact\(/);
  assert.match(dl, /signResolvedArtifact\(/);
  // It must not sign a path straight off the invoice row.
  assert.ok(!/createSignedUrl/.test(dl));
});

test("29. INSERT is database-enforced as a pointer-free draft", () => {
  assert.match(MIGRATION, /before insert on public\.invoices/);
  assert.match(MIGRATION, /invoice_insert_must_be_draft/);
  assert.match(MIGRATION, /invoice_insert_cannot_set_pdf_pointer/);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.ok(
      new RegExp(`revoke all on function public\\.enforce_invoice_insert_is_draft\\(\\) from ${role}`).test(MIGRATION)
    );
  }
});

test("30. draft-to-issued is restricted to the privileged issuance path", () => {
  assert.match(MIGRATION, /current_user not in \('service_role', 'postgres', 'supabase_admin'\)/);
  assert.match(MIGRATION, /invoice_issue_requires_privileged_path/);
});

test("31. draft-to-issued requires a matching canonical active PDF document row", () => {
  assert.match(MIGRATION, /invoice_issue_requires_canonical_artifact/);
  const guard = MIGRATION.slice(
    MIGRATION.indexOf("if not exists ("),
    MIGRATION.indexOf("invoice_issue_requires_canonical_artifact")
  );
  assert.match(guard, /df\.dealer_id\s+= new\.dealer_id/);
  assert.match(guard, /df\.document_type = 'invoice'/);
  assert.match(guard, /df\.document_id\s+= new\.id/);
  assert.match(guard, /df\.status\s+= 'active'/);
  assert.match(guard, /df\.mime_type\s+= 'application\/pdf'/);
  assert.match(guard, /df\.file_path\s+= new\.pdf_file_path/);
  // ...and the row's own path must be the canonical key.
  assert.match(guard, /'\/invoice\/issued\/'/);
  assert.match(guard, /df\.id::text/);
});

test("32. a draft cannot acquire PDF pointers without being issued", () => {
  assert.match(MIGRATION, /invoice_draft_cannot_set_pdf_pointer/);
});

test("33. the invoice_items trigger branches on TG_OP and returns OLD on DELETE", () => {
  const fn = MIGRATION.slice(
    MIGRATION.indexOf("create or replace function public.enforce_invoice_items_issued_immutability"),
    MIGRATION.indexOf("drop trigger if exists invoice_items_issued_immutability")
  );
  // Post-B1-R2 the guard reads each operation's own parent(s) rather than a
  // single coalesced id, and DELETE returns OLD on both of its exits.
  assert.match(fn, /if tg_op = 'DELETE' then/);
  assert.ok(!/coalesce\(new, old\)/.test(fn), "NEW must not be referenced during DELETE");
  // Anchor on CODE: comments are stripped before scanning.
  const branchStart = fn.indexOf("if tg_op = 'DELETE' then");
  const branchEnd = fn.indexOf("if v_new_status is null then");
  assert.ok(branchStart > 0 && branchEnd > branchStart, "the DELETE branch must be present");
  const deleteBranch = fn.slice(branchStart, branchEnd);
  const deleteReturns = deleteBranch.match(/return old;/g) ?? [];
  assert.ok(deleteReturns.length >= 2, "both the cascade path and the normal path return OLD");
});

test("34. compensation results are inspected, and failure cannot report success", () => {
  assert.match(ISSUE, /async function compensate\(\): Promise<"clean" \| "incomplete">/);
  assert.match(ISSUE, /evaluateCompensation\(results\)/);
  // Every call site branches on the result.
  assert.ok(!/^\s*await compensate\(\);\s*$/m.test(ISSUE), "a bare, unchecked compensate() call remains");
  assert.match(ISSUE, /cleanup === "clean" \? "persistence_error" : "cleanup_failed"/);
  assert.match(ISSUE, /\(await compensate\(\)\) === "incomplete"\) return fail\("cleanup_failed"\)/);
});

test("35. cleanup diagnostics stay server-side and omit storage internals", () => {
  const logs = ISSUE.match(/console\.error\([\s\S]{0,220}?\);/g) ?? [];
  assert.ok(logs.length >= 2, "cleanup failures must be logged for operators");
  for (const log of logs) {
    assert.ok(!/filePath/.test(log), "a log must not emit the object key");
    assert.ok(!/signedUrl/.test(log));
  }
  // The browser only ever sees the typed message.
  assert.match(CORE, /case "cleanup_failed":/);
});

test("36. the module no longer claims atomic cross-system cleanup", () => {
  const header = readRaw("src/lib/invoices/issue-invoice.ts").slice(0, 1600);
  assert.match(header, /Cleanup is NOT atomic/);
  assert.ok(
    !/so no orphan object or dangling row is\s*\n\/\/ left behind/.test(header),
    "the unconditional no-orphan claim must be gone"
  );
});

// ── B1-R2 repairs ────────────────────────────────────────────────────────────

test("37. a hard DELETE of a non-draft invoice is blocked in the database", () => {
  assert.match(MIGRATION, /before delete on public\.invoices/);
  assert.match(MIGRATION, /invoice_issued_cannot_be_hard_deleted/);
  // Draft deletion must remain available: createInvoice rolls back that way.
  const fn = MIGRATION.slice(
    MIGRATION.indexOf("create or replace function public.enforce_invoice_delete_is_draft"),
    MIGRATION.indexOf("drop trigger if exists invoices_delete_is_draft")
  );
  assert.match(fn, /if old\.status is distinct from 'draft' then/);
  assert.match(fn, /return old;/);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.ok(
      new RegExp(`revoke all on function public\\.enforce_invoice_delete_is_draft\\(\\) from ${role}`).test(MIGRATION)
    );
  }
});

test("38. invoice_items enforcement branches per operation and checks BOTH parents", () => {
  const fn = MIGRATION.slice(
    MIGRATION.indexOf("create or replace function public.enforce_invoice_items_issued_immutability"),
    MIGRATION.indexOf("drop trigger if exists invoice_items_issued_immutability")
  );
  assert.ok(fn.length > 400, "the items guard body must be non-trivial");
  // OLD parent is used for UPDATE and DELETE; NEW parent for INSERT and UPDATE.
  assert.match(fn, /if tg_op in \('UPDATE', 'DELETE'\) then v_old_id := old\.invoice_id; end if;/);
  assert.match(fn, /if tg_op in \('INSERT', 'UPDATE'\) then v_new_id := new\.invoice_id; end if;/);
  // ...and each is then read from its LOCKED row (see test 52).
  assert.match(fn, /where i\.id = v_old_id/);
  assert.match(fn, /where i\.id = v_new_id/);
});

test("39. an item cannot be moved out of an issued invoice into a draft", () => {
  const fn = MIGRATION.slice(
    MIGRATION.indexOf("create or replace function public.enforce_invoice_items_issued_immutability"),
    MIGRATION.indexOf("drop trigger if exists invoice_items_issued_immutability")
  );
  // On UPDATE the OLD parent must also be a draft.
  assert.match(
    fn,
    /if tg_op = 'UPDATE' then[\s\S]{0,400}if v_old_status <> 'draft' then[\s\S]{0,120}invoice_items_immutable_after_issue/
  );
});

test("40. item dealer must match its parent invoice dealer", () => {
  const fn = MIGRATION.slice(
    MIGRATION.indexOf("create or replace function public.enforce_invoice_items_issued_immutability"),
    MIGRATION.indexOf("drop trigger if exists invoice_items_issued_immutability")
  );
  assert.match(fn, /new\.dealer_id is distinct from v_new_dealer/);
  assert.match(fn, /old\.dealer_id is distinct from v_old_dealer/);
  assert.match(fn, /invoice_items_dealer_mismatch/);
});

test("41. the artifact lookup targets the exact pointed-at row, not the newest", () => {
  assert.ok(!/order\("created_at"/.test(ISSUE), "newest-row selection must be gone");
  assert.match(ISSUE, /parseIssuedInvoiceObjectKey\(invoicePdfFilePath\)/);
  const lookup = ISSUE.slice(ISSUE.indexOf('.from("document_files")'), ISSUE.indexOf("resolveSignableArtifact("));
  assert.match(lookup, /\.eq\("id", pointer\.documentFileId\)/);
  assert.match(lookup, /\.eq\("file_path", invoicePdfFilePath\)/);
  assert.match(lookup, /\.eq\("mime_type", ISSUED_INVOICE_CONTENT_TYPE\)/);
});

test("42. object removal is skipped when the document row survived", () => {
  assert.match(ISSUE, /shouldRemoveObjectAfterRowDeletion\(/);
  const comp = ISSUE.slice(ISSUE.indexOf("async function compensate"), ISSUE.indexOf("// ── Record the artifact"));
  assert.ok(comp.length > 400, "the compensation body must be non-trivial");
  assert.match(comp, /documentRowDeleted = !error/);
  assert.match(comp, /object removal skipped: row still present/);
  // The skip is recorded as a failed step, so cleanup reports incomplete.
  assert.match(comp, /results\.push\(\{ step, ok: false \}\)/);
});

test("43. issuance carries a content-snapshot marker into the transition", () => {
  assert.match(MIGRATION, /add column if not exists content_version bigint not null default 1/);
  assert.match(MIGRATION, /new\.content_version := old\.content_version \+ 1/);
  assert.match(MIGRATION, /create or replace function public\.bump_invoice_content_version/);
  assert.match(MIGRATION, /after insert or update or delete on public\.invoice_items/);
  // Post-B1-R3 the marker is not merely compared: every non-draft update
  // force-assigns it from OLD, so it cannot drift at all (see test 48).
  assert.match(MIGRATION, /new\.content_version := old\.content_version;/);
  // The action captures it with the rendered data and pins the transition to it.
  assert.match(ISSUE, /const renderedContentVersion = /);
  assert.match(ISSUE, /\.eq\("content_version", renderedContentVersion\)/);
});

test("44. a content change during render loses and never reports success", () => {
  const loser = ISSUE.slice(ISSUE.indexOf('resolveConcurrentIssue(updatedRows'), ISSUE.indexOf("const signed = await signResolvedArtifact(dealerId, invoiceId, filePath)"));
  assert.ok(loser.length > 300, "the loser branch must be non-trivial");
  // Still draft ⇒ nobody issued ⇒ the content moved on ⇒ conflict.
  assert.match(loser, /winner\?\.status === "draft"\) return fail\("conflict"\)/);
  assert.match(loser, /\(await compensate\(\)\) === "incomplete"\) return fail\("cleanup_failed"\)/);
});

test("45. download status validation is an explicit allowlist", () => {
  assert.match(CORE, /POST_ISSUE_STATUSES\.includes\(status as InvoiceStatus\)/);
  const fn = CORE.slice(CORE.indexOf("export function canDownloadIssuedArtifact"));
  assert.ok(!/!isDraft\(/.test(fn.slice(0, 200)), "must not be a negated draft check");
});

test("46. every trigger function still pins search_path and is not directly executable", () => {
  const pins = MIGRATION.match(/set search_path = ''/g) ?? [];
  assert.equal(pins.length, 6, "five trigger guards plus save_invoice_draft");
  for (const fn of [
    "enforce_invoice_issued_immutability",
    "enforce_invoice_insert_is_draft",
    "enforce_invoice_delete_is_draft",
    "enforce_invoice_items_issued_immutability",
    "bump_invoice_content_version",
  ]) {
    for (const role of ["public", "anon", "authenticated"]) {
      assert.ok(
        new RegExp(`revoke all on function public\\.${fn}\\(\\) from ${role}`).test(MIGRATION),
        `${fn} must be revoked from ${role}`
      );
    }
  }
  assert.ok(!/security definer/i.test(MIGRATION));
});

// ── B1-R3 repairs ────────────────────────────────────────────────────────────

const INVOICE_UPDATE_FN = MIGRATION.slice(
  MIGRATION.indexOf("create or replace function public.enforce_invoice_issued_immutability"),
  MIGRATION.indexOf("drop trigger if exists invoices_issued_immutability")
);
const ITEMS_GUARD_FN = MIGRATION.slice(
  MIGRATION.indexOf("create or replace function public.enforce_invoice_items_issued_immutability"),
  MIGRATION.indexOf("drop trigger if exists invoice_items_issued_immutability")
);
const BUMP_FN = MIGRATION.slice(
  MIGRATION.indexOf("create or replace function public.bump_invoice_content_version"),
  MIGRATION.indexOf("drop trigger if exists invoice_items_bump_content_version")
);

test("47. the slices used by the B1-R3 tests are real", () => {
  for (const [name, fn] of [
    ["invoices update guard", INVOICE_UPDATE_FN],
    ["items guard", ITEMS_GUARD_FN],
    ["bump function", BUMP_FN],
  ] as const) {
    assert.ok(fn.length > 300, `${name} slice must be non-trivial`);
  }
});

test("48. content_version is database-owned: a submitted value is always overwritten", () => {
  // Every branch assigns the marker from OLD; there is no path that keeps NEW.
  assert.match(INVOICE_UPDATE_FN, /new\.content_version := old\.content_version \+ 1;/);
  assert.match(INVOICE_UPDATE_FN, /new\.content_version := old\.content_version;/);
  // The only branch that keeps the incoming value is the item-driven bump, and
  // it requires the transaction-local marker AND an exact +1 AND no field change.
  assert.match(
    INVOICE_UPDATE_FN,
    /v_bump_for = old\.id::text\s*\n\s*and not v_versioned\s*\n\s*and new\.content_version = old\.content_version \+ 1 then\s*\n\s*null;/
  );
  // An INSERT always starts at 1, so it cannot be seeded high.
  assert.match(MIGRATION, /new\.content_version := 1;/);
});

test("49. draft-to-issued preserves the marker exactly", () => {
  // The else branch (which covers draft→issued and every non-draft update)
  // carries OLD forward untouched.
  const derivation = INVOICE_UPDATE_FN.slice(
    INVOICE_UPDATE_FN.indexOf("if old.status = 'draft'\n     and v_bump_for"),
    INVOICE_UPDATE_FN.indexOf("if old.status = 'draft' then")
  );
  assert.ok(derivation.length > 100, "the derivation block must be present");
  assert.match(derivation, /else\s*\n[\s\S]{0,200}new\.content_version := old\.content_version;/);
});

test("50. the versioned field set covers every PDF-rendered and identifying field", () => {
  const versioned = INVOICE_UPDATE_FN.slice(
    INVOICE_UPDATE_FN.indexOf("v_versioned :="),
    INVOICE_UPDATE_FN.indexOf("if old.status = 'draft'\n     and v_bump_for")
  );
  assert.ok(versioned.length > 300, "the versioned-field expression must be present");
  for (const field of [
    "dealer_id",
    "customer_id",
    "vehicle_id",
    "estimate_id",
    "work_order_id",
    "completion_report_id",
    "invoice_number",
    "title",
    "issue_date",
    "due_date",
    "subtotal",
    "discount_amount",
    "tax_rate",
    "tax_amount",
    "total",
    "paid_amount",
    "balance_due",
    "notes",
  ]) {
    assert.ok(
      new RegExp(`new\\.${field}\\s+is distinct from old\\.${field}`).test(versioned),
      `${field} must advance the marker while draft`
    );
  }
});

test("51. paid_amount and balance_due stay mutable after issuance without moving the marker", () => {
  // They are versioned (test 50) but NOT in the post-issue frozen list...
  const frozen = INVOICE_UPDATE_FN.slice(INVOICE_UPDATE_FN.indexOf("invoice_cannot_return_to_draft"));
  for (const field of ["paid_amount", "balance_due", "internal_memo"]) {
    assert.ok(
      !new RegExp(`new\\.${field}\\s+is distinct from old\\.${field}`).test(frozen),
      `${field} must remain mutable after issuance`
    );
  }
  // ...and after issuance the marker is force-carried, so a payment cannot move it.
  assert.match(INVOICE_UPDATE_FN, /new\.content_version := old\.content_version;/);
});

test("52. item mutation locks every affected parent before changing the row", () => {
  assert.match(ITEMS_GUARD_FN, /perform 1 from public\.invoices i where i\.id = v_first for update;/);
  assert.match(ITEMS_GUARD_FN, /if v_second is not null then\s*\n\s*perform 1 from public\.invoices i where i\.id = v_second for update;/);
  // Status and dealer are re-read AFTER the locks are taken.
  const lockAt = ITEMS_GUARD_FN.indexOf("for update;");
  const readAt = ITEMS_GUARD_FN.indexOf("select i.status, i.dealer_id into v_old_status");
  assert.ok(lockAt > 0 && readAt > lockAt, "state must be re-read after locking");
});

test("53. two distinct parents are locked in deterministic UUID order", () => {
  assert.match(
    ITEMS_GUARD_FN,
    /if v_old_id < v_new_id then\s*\n\s*v_first := v_old_id; v_second := v_new_id;\s*\n\s*else\s*\n\s*v_first := v_new_id; v_second := v_old_id;/
  );
  // A single parent locks once.
  assert.match(ITEMS_GUARD_FN, /v_first := coalesce\(v_old_id, v_new_id\);\s*\n\s*v_second := null;/);
});

test("54. reparenting advances BOTH parents; an unchanged parent advances once", () => {
  assert.match(BUMP_FN, /if v_new_id is not null then[\s\S]{0,300}where i\.id = v_new_id/);
  assert.match(
    BUMP_FN,
    /if v_old_id is not null and v_old_id is distinct from v_new_id then[\s\S]{0,300}where i\.id = v_old_id/
  );
  // Both updates advance by exactly one and only touch draft parents.
  const bumps = BUMP_FN.match(/set content_version = i\.content_version \+ 1/g) ?? [];
  assert.equal(bumps.length, 2, "one bump per affected parent");
  const draftOnly = BUMP_FN.match(/and i\.status = 'draft'/g) ?? [];
  assert.equal(draftOnly.length, 2);
});

test("55. the bump announces itself through a setting a client cannot supply", () => {
  assert.match(BUMP_FN, /set_config\('dealeros\.invoice_item_bump'/);
  assert.match(INVOICE_UPDATE_FN, /current_setting\('dealeros\.invoice_item_bump', true\)/);
  // The namespace is ours, not PostgREST's request.* claim namespace.
  assert.ok(!/request\./.test(BUMP_FN));
  assert.ok(!/request\.jwt/.test(INVOICE_UPDATE_FN));
  // It is cleared before the trigger returns, so it cannot leak to a later
  // statement in the same transaction.
  assert.match(BUMP_FN, /set_config\('dealeros\.invoice_item_bump', '', true\)/);
});

test("56. issuance cannot slip between the item guard and the item bump", () => {
  // The guard takes a FOR UPDATE lock on the parent, and the bump runs in the
  // same transaction, so an issuance UPDATE of that row must wait for both.
  assert.match(ITEMS_GUARD_FN, /for update;/);
  assert.match(MIGRATION, /after insert or update or delete on public\.invoice_items/);
  assert.match(MIGRATION, /before insert or update or delete on public\.invoice_items/);
  // And issuance itself is pinned to the captured marker.
  assert.match(ISSUE, /\.eq\("content_version", renderedContentVersion\)/);
});

test("57. InvoiceDB carries content_version and no ad hoc cast remains", () => {
  const TYPES = read("src/lib/invoices/invoice-types.ts");
  assert.match(TYPES, /content_version:\s+number;/);
  assert.ok(!/\(full as \{ content_version\?: number \}\)/.test(ISSUE));
  assert.match(ISSUE, /const renderedInvoice = full as InvoiceDB;/);
  assert.match(ISSUE, /renderInvoicePdf\(renderedInvoice, stamp, branding\)/);
});

// ── B1-R4: atomic draft save and snapshot gate ───────────────────────────────

const SAVE_FN = MIGRATION.slice(
  MIGRATION.indexOf("create or replace function public.save_invoice_draft"),
  MIGRATION.indexOf("revoke all on function public.save_invoice_draft")
);

test("58. the save_invoice_draft slice is real", () => {
  assert.ok(SAVE_FN.length > 500, "the draft-save function must be present and non-trivial");
});

test("59. updateInvoice performs ONE atomic RPC instead of separate writes", () => {
  assert.match(UPDATE, /supabase\.rpc\("save_invoice_draft", \{/);
  // The torn three-request sequence must be gone.
  assert.ok(!/from\("invoice_items"\)/.test(UPDATE), "no direct invoice_items write may remain");
  assert.ok(!/\.delete\(\)/.test(UPDATE.slice(0, UPDATE.indexOf("export async function softDeleteInvoice"))));
  assert.ok(!/\.insert\(/.test(UPDATE));
  // Every RPC outcome is handled explicitly.
  for (const outcome of ["not-found", "not-draft", "invalid-input", "saved"]) {
    assert.ok(UPDATE.includes(`"${outcome}"`), `${outcome} must be handled`);
  }
});

test("60. line totals are recomputed with the shared rule before being sent", () => {
  assert.match(
    UPDATE,
    /line_total:\s+lineTotal\(\s*raw\.quantity as number,\s*raw\.unit_price as number,\s*raw\.discount_rate as number\s*\)/
  );
  // B1-V1-R2: the application NEVER sends p_items = null — items_json is
  // required, so the null-items (text-only) mode belongs to the DB RPC contract.
  assert.ok(!/p_items:\s*null/.test(UPDATE), "p_items must never be null from the app");
  assert.match(UPDATE, /p_items:\s+itemRows/);
});

test("61. the draft-save function locks the parent and re-checks under the lock", () => {
  assert.match(SAVE_FN, /for update;/);
  const lockAt = SAVE_FN.indexOf("for update;");
  const draftCheckAt = SAVE_FN.indexOf("if v_status <> 'draft' then");
  assert.ok(lockAt > 0 && draftCheckAt > lockAt, "the draft check must follow the lock");
  assert.match(SAVE_FN, /return jsonb_build_object\('outcome', 'not-draft'\)/);
  assert.match(SAVE_FN, /return jsonb_build_object\('outcome', 'not-found'\)/);
});

test("62. the draft-save function refuses foreign-dealer rows at every step", () => {
  const dealerPredicates = SAVE_FN.match(/dealer_id\s*=\s*p_dealer_id/g) ?? [];
  assert.ok(dealerPredicates.length >= 3, "select, update and item statements must be dealer-scoped");
  assert.match(SAVE_FN, /delete from public\.invoice_items ii[\s\S]{0,160}ii\.dealer_id\s+= p_dealer_id/);
});

test("63. the parent update and the item replacement are one transaction", () => {
  // Both statements live inside the single function body, so a failure in either
  // rolls the whole call back.
  const updateAt = SAVE_FN.indexOf("update public.invoices i");
  const deleteAt = SAVE_FN.indexOf("delete from public.invoice_items");
  const insertAt = SAVE_FN.indexOf("insert into public.invoice_items");
  assert.ok(updateAt > 0 && deleteAt > updateAt && insertAt > deleteAt);
  // The item replacement is skipped entirely when no set was supplied.
  assert.match(SAVE_FN, /if p_items is not null and jsonb_typeof\(p_items\) = 'array' then/);
});

test("64. the draft-save function is INVOKER, pinned and privilege-scoped", () => {
  assert.match(SAVE_FN, /security invoker/);
  assert.match(SAVE_FN, /set search_path = ''/);
  // Fully schema-qualified relations only.
  assert.ok(!/\bfrom invoices\b/.test(SAVE_FN));
  assert.ok(!/\binto invoice_items\b/.test(SAVE_FN));
  assert.match(MIGRATION, /revoke all on function public\.save_invoice_draft\(uuid, uuid, jsonb, jsonb\) from public/);
  assert.match(MIGRATION, /revoke all on function public\.save_invoice_draft\(uuid, uuid, jsonb, jsonb\) from anon/);
  assert.match(MIGRATION, /grant execute on function public\.save_invoice_draft\(uuid, uuid, jsonb, jsonb\) to authenticated/);
  // Ordinary editing must not become privileged.
  assert.ok(!/security definer/i.test(SAVE_FN));
  assert.ok(!/createAdminClient/.test(UPDATE), "draft editing must not use the service role");
});

test("65. the snapshot is validated before render, upload, insert and transition", () => {
  assert.match(ISSUE, /validateIssuanceSnapshot\(/);
  const validateAt = ISSUE.indexOf("validateIssuanceSnapshot(");
  const renderAt = ISSUE.indexOf("renderInvoicePdf(renderedInvoice");
  const uploadAt = ISSUE.indexOf(".upload(filePath");
  const insertAt = ISSUE.indexOf('.from("document_files").insert(') > 0
    ? ISSUE.indexOf('.from("document_files").insert(')
    : ISSUE.indexOf("admin.from(\"document_files\").insert(");
  const transitionAt = ISSUE.indexOf('.eq("content_version", renderedContentVersion)');

  assert.ok(validateAt > 0, "the snapshot gate must exist");
  assert.ok(renderAt > validateAt, "validation must precede rendering");
  assert.ok(uploadAt > validateAt, "validation must precede upload");
  assert.ok(transitionAt > validateAt, "validation must precede the transition");
  if (insertAt > 0) assert.ok(insertAt > validateAt, "validation must precede the document row");
});

test("66. an invalid snapshot fails closed with zero writes", () => {
  const gate = ISSUE.slice(ISSUE.indexOf("const snapshot = validateIssuanceSnapshot"), ISSUE.indexOf("let buffer: Buffer;"));
  assert.ok(gate.length > 100, "the snapshot gate block must be present");
  assert.match(gate, /snapshot\.kind === "invalid"/);
  assert.match(gate, /return fail\("validation_error"\)/);
  // Nothing is written in the gate itself.
  assert.ok(!/upload\(|insert\(|update\(/.test(gate));
});

test("67. the content_version winner predicate survives the R4 changes", () => {
  assert.match(ISSUE, /\.eq\("status", "draft"\)/);
  assert.match(ISSUE, /\.eq\("content_version", renderedContentVersion\)/);
  assert.match(ISSUE, /resolveConcurrentIssue\(/);
});

test("68. the validator reuses the shared money rules, adding no second policy", () => {
  const SNAP = read("src/lib/invoices/invoice-issuance-snapshot.ts");
  assert.match(SNAP, /import \{ calculateInvoiceTotals, lineTotal \} from "\.\/invoice-types"/);
  // No independent rounding or tax arithmetic.
  assert.ok(!/Math\.round\(/.test(SNAP), "rounding belongs to invoice-types");
  assert.ok(!/Math\.floor\(/.test(SNAP), "tax flooring belongs to invoice-types");
  assert.ok(!/tax_rate\s*\/\s*100/.test(SNAP));
  // And it stays import-safe otherwise.
  for (const forbidden of ["react", "server-only", "@supabase", "process.env", "fetch("]) {
    assert.ok(!SNAP.includes(forbidden), `the validator must not reference ${forbidden}`);
  }
});

// ── B1-R5: command-specific invoice RLS and fail-closed finance authorization ─

const POLICY_SECTION = MIGRATION.slice(
  MIGRATION.indexOf('drop policy if exists "Dealer members can manage their invoices"')
);

const POLICY_NAMES = [
  "invoices_select_active_staff",
  "invoices_insert_finance",
  "invoices_update_finance",
  "invoices_delete_finance",
  "invoice_items_select_active_staff",
  "invoice_items_insert_finance",
  "invoice_items_update_finance",
  "invoice_items_delete_finance",
] as const;

function policyBlock(name: string): string {
  const start = POLICY_SECTION.indexOf(`create policy ${name} `);
  if (start < 0) return "";
  const rest = POLICY_SECTION.slice(start + 1);
  const next = rest.indexOf("create policy ");
  return POLICY_SECTION.slice(start, next < 0 ? undefined : start + 1 + next);
}

test("69. the legacy FOR ALL invoice policies are dropped and never recreated", () => {
  assert.ok(POLICY_SECTION.length > 500, "the R5 policy section must be present");
  assert.match(
    POLICY_SECTION,
    /drop policy if exists "Dealer members can manage their invoices" on public\.invoices;/
  );
  assert.match(
    POLICY_SECTION,
    /drop policy if exists "Dealer members can manage their invoice items" on public\.invoice_items;/
  );
  assert.ok(
    !/create policy[\s\S]{0,200}?for all/i.test(MIGRATION),
    "no FOR ALL policy may exist anywhere in the migration"
  );
});

test("70. exactly eight command-specific policies exist, each targeting authenticated", () => {
  const creations = MIGRATION.match(/create policy /g) ?? [];
  assert.equal(creations.length, POLICY_NAMES.length, "one policy per table per command");
  for (const name of POLICY_NAMES) {
    const block = policyBlock(name);
    assert.ok(block.length > 200, `${name} must exist and be non-trivial`);
    const command = name.includes("select")
      ? "select"
      : name.includes("insert")
        ? "insert"
        : name.includes("update")
          ? "update"
          : "delete";
    assert.match(block, new RegExp(`for ${command} to authenticated`), `${name} command/role`);
  }
});

test("71. SELECT requires an ACTIVE recognized identity of the SAME dealer", () => {
  for (const [name, table] of [
    ["invoices_select_active_staff", "invoices"],
    ["invoice_items_select_active_staff", "invoice_items"],
  ] as const) {
    const block = policyBlock(name);
    assert.match(block, new RegExp(`ds\\.dealer_id = ${table}\\.dealer_id`), `${name} tenant scope`);
    assert.match(block, new RegExp(`dm\\.dealer_id = ${table}\\.dealer_id`), `${name} fallback scope`);
    const activeChecks = block.match(/status\s+= 'active'/g) ?? [];
    assert.equal(activeChecks.length, 2, `${name}: canonical AND fallback must require active`);
    const roleLists = block.match(/in \('owner', 'manager', 'staff', 'readonly'\)/g) ?? [];
    assert.equal(roleLists.length, 2, `${name}: both branches use the full recognized set`);
  }
});

test("72. every write policy confines both branches to the ACTIVE finance roles", () => {
  const writePolicies = POLICY_NAMES.filter((n) => !n.includes("select"));
  assert.equal(writePolicies.length, 6);
  for (const name of writePolicies) {
    const block = policyBlock(name);
    const financeLists = block.match(/in \('owner', 'manager'\)/g) ?? [];
    const expected = name.includes("update") ? 4 : 2; // USING + WITH CHECK each carry both branches
    assert.equal(financeLists.length, expected, `${name}: finance role list count`);
    assert.ok(!/'staff'/.test(block), `${name} must not grant staff`);
    assert.ok(!/'readonly'/.test(block), `${name} must not grant readonly`);
    const activeChecks = block.match(/status\s+= 'active'/g) ?? [];
    assert.equal(activeChecks.length, expected, `${name}: every branch requires active`);
  }
});

test("73. INSERT carries WITH CHECK, UPDATE carries BOTH, DELETE carries USING", () => {
  for (const name of POLICY_NAMES) {
    const block = policyBlock(name);
    const hasUsing = /\busing \(/.test(block);
    const hasWithCheck = /\bwith check \(/.test(block);
    if (name.includes("insert")) {
      assert.ok(hasWithCheck && !hasUsing, `${name}: WITH CHECK only`);
    } else if (name.includes("update")) {
      assert.ok(hasUsing && hasWithCheck, `${name}: USING and WITH CHECK`);
    } else {
      assert.ok(hasUsing && !hasWithCheck, `${name}: USING only`);
    }
  }
});

test("74. a dealer_staff row in ANY state blocks the dealer_members fallback", () => {
  for (const name of POLICY_NAMES) {
    const block = policyBlock(name);
    const gateAt = block.indexOf("not exists (");
    assert.ok(gateAt > 0, `${name} must gate the fallback on row absence`);
    const gate = block.slice(gateAt, block.indexOf("and exists (", gateAt));
    assert.ok(gate.length > 50, `${name}: the absence gate must be present`);
    assert.match(gate, /from public\.dealer_staff ds/, `${name}: the gate reads dealer_staff`);
    assert.ok(
      !/status/.test(gate),
      `${name}: the absence gate must NOT filter by status — any existing row blocks fallback`
    );
    // ...and the fallback branch that follows is conjoined, not an alternative.
    assert.match(
      block.slice(gateAt),
      /and exists \(\s*select 1\s*from public\.dealer_members dm/,
      `${name}: the membership check is ANDed behind the absence gate`
    );
  }
});

test("75. policies use the scalar auth.uid() form and never auth.role()", () => {
  assert.ok(!/auth\.role\(\)/.test(MIGRATION), "auth.role() is forbidden");
  const bare = MIGRATION.match(/auth\.uid\(\)/g) ?? [];
  const scalar = MIGRATION.match(/\(select auth\.uid\(\)\)/g) ?? [];
  assert.ok(bare.length > 0, "the policies must reference auth.uid()");
  assert.equal(scalar.length, bare.length, "every auth.uid() must be wrapped in a scalar subselect");
});

test("76. save_invoice_draft enforces the finance rule before taking the lock", () => {
  assert.match(SAVE_FN, /v_finance_authorized boolean/);
  const gateAt = SAVE_FN.indexOf("into v_finance_authorized");
  const denyAt = SAVE_FN.indexOf("if not coalesce(v_finance_authorized, false) then");
  const lockAt = SAVE_FN.indexOf("for update;");
  assert.ok(gateAt > 0 && denyAt > gateAt, "the gate and its denial must be present");
  assert.ok(lockAt > denyAt, "authorization must complete BEFORE the FOR UPDATE lock");

  // Denial is coarse: indistinguishable from a missing invoice.
  const denial = SAVE_FN.slice(denyAt, SAVE_FN.indexOf("end if;", denyAt));
  assert.match(denial, /jsonb_build_object\('outcome', 'not-found'\)/);

  // The gate mirrors the policies: canonical active owner/manager, fallback only
  // when no dealer_staff row exists, fallback also active owner/manager.
  const gate = SAVE_FN.slice(SAVE_FN.indexOf("select\n       exists ("), gateAt);
  assert.ok(gate.length > 200, "the gate expression must be present");
  const financeLists = gate.match(/in \('owner', 'manager'\)/g) ?? [];
  assert.equal(financeLists.length, 2, "canonical and fallback both confine to finance roles");
  const absenceGate = gate.slice(gate.indexOf("not exists ("), gate.indexOf("and exists ("));
  assert.match(absenceGate, /from public\.dealer_staff ds/);
  assert.ok(!/status/.test(absenceGate), "any existing dealer_staff row blocks the fallback");
  assert.ok(!/'staff'/.test(gate) && !/'readonly'/.test(gate));
});

// ── B1-V1-R2: fail-closed draft-save input schema ────────────────────────────

test("77. the SQL schema block sits between the finance gate and the lock, before every write", () => {
  const denyAt = SAVE_FN.indexOf("if not coalesce(v_finance_authorized, false) then");
  const validationAt = SAVE_FN.indexOf("jsonb_typeof(p_fields) <> 'object'");
  const lockAt = SAVE_FN.indexOf("for update;");
  const parentWriteAt = SAVE_FN.indexOf("update public.invoices i");
  const deleteAt = SAVE_FN.indexOf("delete from public.invoice_items");
  const insertAt = SAVE_FN.indexOf("insert into public.invoice_items");
  assert.ok(denyAt > 0 && validationAt > denyAt, "validation must follow the finance gate");
  assert.ok(lockAt > validationAt, "validation must complete before the FOR UPDATE lock");
  const lastInvalid = SAVE_FN.lastIndexOf("'invalid-input'");
  assert.ok(lastInvalid > 0 && lastInvalid < lockAt, "every rejection precedes the lock");
  for (const [name, at] of [["parent update", parentWriteAt], ["item delete", deleteAt], ["item insert", insertAt]] as const) {
    assert.ok(at > lastInvalid, `${name} must come after all schema validation`);
  }
});

test("78. the SQL enforces the EXACT sorted key sets of the shared contract", () => {
  // text-only (p_items IS NULL): six keys, money keys forbidden by exactness.
  assert.match(
    SAVE_FN,
    /if p_items is null then[\s\S]{0,400}?array\['due_date', 'internal_memo', 'invoice_number', 'issue_date', 'notes', 'title'\]/
  );
  // with-items: all thirteen keys required.
  assert.match(
    SAVE_FN,
    /array\['balance_due', 'discount_amount', 'due_date', 'internal_memo', 'invoice_number',\s*'issue_date', 'notes', 'paid_amount', 'subtotal', 'tax_amount', 'tax_rate',\s*'title', 'total'\]/
  );
  // element: exactly the eight line keys.
  assert.match(
    SAVE_FN,
    /array\['category', 'description', 'discount_rate', 'item_name', 'line_total',\s*'quantity', 'sort_order', 'unit_price'\]/
  );
  // exactness is a full sorted-array comparison, not a subset test.
  const exactComparisons = SAVE_FN.match(/coalesce\(array_agg\(k order by k\), '\{\}'::text\[\]\)/g) ?? [];
  assert.equal(exactComparisons.length, 3, "fields (both modes) and elements use exact key comparison");
});

test("79. the SQL enforces per-key JSON types, closing the string-numeric and NaN casts", () => {
  assert.match(SAVE_FN, /foreach v_key in array array\['invoice_number', 'title', 'issue_date', 'due_date', 'notes', 'internal_memo'\]/);
  assert.match(SAVE_FN, /jsonb_typeof\(p_fields->v_key\) not in \('string', 'null'\)/);
  assert.match(SAVE_FN, /foreach v_key in array array\['discount_amount', 'tax_rate', 'paid_amount', 'subtotal', 'tax_amount', 'total', 'balance_due'\]/);
  assert.match(SAVE_FN, /jsonb_typeof\(p_fields->v_key\) <> 'number'/);
  for (const key of ["quantity", "unit_price", "discount_rate", "line_total", "sort_order"]) {
    assert.match(SAVE_FN, new RegExp(`jsonb_typeof\\(v_item->'${key}'\\) <> 'number'`), key);
  }
  assert.match(SAVE_FN, /jsonb_typeof\(v_item->'category'\) <> 'string'/);
  assert.match(SAVE_FN, /jsonb_typeof\(v_item->'item_name'\) <> 'string'/);
  assert.match(SAVE_FN, /jsonb_typeof\(v_item->'description'\) not in \('string', 'null'\)/);
});

test("80. non-array p_items and non-object elements are rejected outright", () => {
  assert.match(SAVE_FN, /if p_items is not null and jsonb_typeof\(p_items\) <> 'array' then/);
  assert.match(SAVE_FN, /if jsonb_typeof\(v_item\) <> 'object' then/);
  // A JSON null literal has jsonb_typeof 'null', so the array check rejects it.
  const rejections = SAVE_FN.match(/jsonb_build_object\('outcome', 'invalid-input'\)/g) ?? [];
  assert.ok(rejections.length >= 8, "every schema branch rejects with the same coarse outcome");
});

test("81. the SQL key sets mirror the pure TypeScript contract exactly", () => {
  const CORE_RAW = read("src/lib/invoices/invoice-issuance-core.ts");
  const grab = (name: string) => {
    const at = CORE_RAW.indexOf(`export const ${name}`);
    const slice = CORE_RAW.slice(at, CORE_RAW.indexOf("] as const", at));
    return (slice.match(/"([a-z_]+)"/g) ?? []).map((s) => s.replace(/"/g, ""));
  };
  const text = grab("DRAFT_SAVE_TEXT_KEYS");
  const money = grab("DRAFT_SAVE_MONEY_KEYS");
  const item = grab("DRAFT_SAVE_ITEM_KEYS");
  assert.equal(text.length, 6); assert.equal(money.length, 7); assert.equal(item.length, 8);
  const sorted = (a: string[]) => [...a].sort();
  const sqlList = (re: RegExp) => {
    const m = SAVE_FN.match(re);
    assert.ok(m, `SQL literal for ${re} must exist`);
    return (m![0].match(/'([a-z_]+)'/g) ?? []).map((s) => s.replace(/'/g, ""));
  };
  assert.deepEqual(
    sqlList(/array\['due_date', 'internal_memo', 'invoice_number', 'issue_date', 'notes', 'title'\]/),
    sorted(text)
  );
  assert.deepEqual(
    sqlList(/array\['balance_due',[\s\S]{0,220}?'title', 'total'\]/),
    sorted([...text, ...money])
  );
  assert.deepEqual(
    sqlList(/array\['category',[\s\S]{0,160}?'unit_price'\]/),
    sorted(item)
  );
});

test("82. updateInvoice validates fail-closed before math and before the RPC", () => {
  assert.match(UPDATE, /const itemsRaw = fd\.get\("items_json"\);/);
  assert.match(UPDATE, /typeof itemsRaw !== "string" \|\| itemsRaw\.trim\(\) === ""/);
  const tryAt = UPDATE.indexOf("try {");
  const parseAt = UPDATE.indexOf("JSON.parse(itemsRaw)");
  const catchAt = UPDATE.indexOf("} catch {");
  assert.ok(tryAt > 0 && parseAt > tryAt && catchAt > parseAt, "JSON.parse must be wrapped in try/catch");
  assert.match(UPDATE, /if \(!Array\.isArray\(parsedItems\)\)/);
  assert.match(UPDATE, /if \(!isPlainPayloadObject\(raw\)\)/);
  const itemsValidateAt = UPDATE.indexOf("validateDraftSaveItems(itemRows)");
  const totalsAt = UPDATE.indexOf("calculateInvoiceTotals(");
  const fieldsValidateAt = UPDATE.indexOf('validateDraftSaveFields(fields, "with-items")');
  const rpcAt = UPDATE.indexOf('supabase.rpc("save_invoice_draft"');
  assert.ok(
    itemsValidateAt > 0 && totalsAt > itemsValidateAt,
    "items are validated before aggregate calculation and the RPC (lineTotal is intentionally computed during exact-row mapping)"
  );
  assert.ok(fieldsValidateAt > totalsAt, "the full 13-key payload is validated after totals are computed");
  assert.ok(rpcAt > fieldsValidateAt, "the RPC runs only on a fully validated payload");
});

test("82a. description reaches the validator RAW — no fail-open falsy normalization", () => {
  // `raw.description || null` would turn false, 0 and undefined into a VALID
  // null before validateDraftSaveItems ever saw them. The raw value must be
  // preserved; the RPC's own nullif normalizes a legal empty string to NULL.
  assert.ok(!/raw\.description \|\| null/.test(UPDATE), "the fail-open coercion must be gone");
  assert.match(UPDATE, /description:\s+raw\.description,/);
});

test("83. malformed input maps to the existing generic error — no new user-facing string", () => {
  const invalidBranch = UPDATE.slice(UPDATE.indexOf('result === "invalid-input"'));
  assert.ok(invalidBranch.length > 10, "the invalid-input branch must exist");
  assert.match(invalidBranch.slice(0, 120), /請求書の保存に失敗しました/);
  // Every schema-failure return in the action reuses that same existing string.
  const failReturns = UPDATE.match(/return \{ error: "請求書の保存に失敗しました" \}/g) ?? [];
  assert.ok(failReturns.length >= 7, "parse, shape and RPC failures all reuse the generic error");
});

// ── B1-V2-R1: fail-closed documents Storage authorization ────────────────────

const STORAGE_SUCCESSOR_PATH =
  "supabase/migrations/20260802030025_documents_storage_fail_closed_authorization.sql";
const STORAGE_SUCCESSOR = read(STORAGE_SUCCESSOR_PATH);

test("84. the successor replaces exactly the three documents policies with the right commands", () => {
  assert.ok(STORAGE_SUCCESSOR.length > 500, "the successor migration must exist and be non-trivial");
  for (const name of ["documents_member_read", "documents_member_insert", "documents_member_update"]) {
    assert.match(STORAGE_SUCCESSOR, new RegExp(`drop policy if exists "${name}" on storage\\.objects;`), name);
    assert.match(STORAGE_SUCCESSOR, new RegExp(`create policy "${name}"`), name);
  }
  const creations = STORAGE_SUCCESSOR.match(/create policy /g) ?? [];
  assert.equal(creations.length, 3, "exactly the three policies, nothing else");
  assert.match(STORAGE_SUCCESSOR, /"documents_member_read"\s*\n\s*on storage\.objects\s*\n\s*for select\s*\n\s*to authenticated\s*\n\s*using \(/);
  assert.match(STORAGE_SUCCESSOR, /"documents_member_insert"\s*\n\s*on storage\.objects\s*\n\s*for insert\s*\n\s*to authenticated\s*\n\s*with check \(/);
  assert.match(STORAGE_SUCCESSOR, /"documents_member_update"\s*\n\s*on storage\.objects\s*\n\s*for update\s*\n\s*to authenticated\s*\n\s*using \(/);
  // UPDATE carries BOTH clauses; no authenticated DELETE policy is introduced.
  const updateBlock = STORAGE_SUCCESSOR.slice(STORAGE_SUCCESSOR.indexOf('"documents_member_update"'));
  assert.ok(/using \(/.test(updateBlock) && /with check \(/.test(updateBlock), "UPDATE needs USING and WITH CHECK");
  assert.ok(!/for delete/i.test(STORAGE_SUCCESSOR), "deletes stay service-role-only");
});

test("85. all four predicates carry bucket, folder isolation and the active canonical branch", () => {
  const buckets = STORAGE_SUCCESSOR.match(/bucket_id = 'documents'/g) ?? [];
  assert.equal(buckets.length, 4, "SELECT USING, INSERT WITH CHECK, UPDATE USING, UPDATE WITH CHECK");
  const primaries = STORAGE_SUCCESSOR.match(/ds\.status = 'active'/g) ?? [];
  assert.equal(primaries.length, 4, "one active canonical branch per predicate");
  const fallbacks = STORAGE_SUCCESSOR.match(/dm\.status = 'active'/g) ?? [];
  assert.equal(fallbacks.length, 4, "one active fallback branch per predicate");
  const roleLists = STORAGE_SUCCESSOR.match(/in \('owner', 'manager', 'staff', 'readonly'\)/g) ?? [];
  assert.equal(roleLists.length, 8, "both branches of every predicate use the recognized role set");
  const folders = STORAGE_SUCCESSOR.match(/dealer_id::text = \(storage\.foldername\(objects\.name\)\)\[1\]/g) ?? [];
  assert.equal(folders.length, 12, "primary, absence gate and fallback are all folder-scoped in each predicate");
});

test("86. every fallback is gated on the ABSENCE of any dealer_staff row", () => {
  const gates = STORAGE_SUCCESSOR.match(/not exists \(\s*select 1\s*from public\.dealer_staff ds\s*where ds\.user_id = \(select auth\.uid\(\)\)\s*and ds\.dealer_id::text = \(storage\.foldername\(objects\.name\)\)\[1\]\s*\)/g) ?? [];
  assert.equal(gates.length, 4, "one status-and-role-free absence gate per predicate");
  for (const gate of gates) {
    assert.ok(!/status|role/.test(gate.replace(/auth\.uid/g, "")), "a row in ANY state blocks the fallback");
  }
  const conjoined = STORAGE_SUCCESSOR.match(/\)\s*\n\s*and exists \(\s*\n\s*select 1\s*\n\s*from public\.dealer_members dm/g) ?? [];
  assert.equal(conjoined.length, 4, "dealer_members is consulted only BEHIND the absence gate");
});

test("86a. the outer object path is ALWAYS table-qualified — unqualified capture is forbidden", () => {
  // dealer_staff has its own `name` column, so an unqualified `name` inside its
  // EXISTS subqueries is captured by ds.name: the predicate compiles to
  // storage.foldername(ds.name), the canonical branch can never match, the
  // absence gate is always true, and the policy silently degenerates to the
  // dealer_members-only rule (observed live in B1-V2-R2, environment d76c0a0c).
  const qualified = STORAGE_SUCCESSOR.match(/storage\.foldername\(objects\.name\)/g) ?? [];
  assert.equal(qualified.length, 12, "3 folder-scoped subqueries in each of the 4 predicates");
  const unqualified = STORAGE_SUCCESSOR.match(/storage\.foldername\((?!objects\.)[^)]*\)/g) ?? [];
  assert.deepEqual(unqualified, [], "no foldername argument may be anything but objects.name");
});

test("87. the successor introduces no privileged or foreign construct", () => {
  assert.ok(!/auth\.role\(\)/.test(STORAGE_SUCCESSOR));
  const bare = STORAGE_SUCCESSOR.match(/auth\.uid\(\)/g) ?? [];
  const scalar = STORAGE_SUCCESSOR.match(/\(select auth\.uid\(\)\)/g) ?? [];
  assert.ok(bare.length > 0 && scalar.length === bare.length, "every auth.uid() is a scalar subselect");
  assert.ok(!/security definer/i.test(STORAGE_SUCCESSOR));
  assert.ok(!/create function|create or replace function/i.test(STORAGE_SUCCESSOR), "no authorization helper function");
  assert.ok(!/insert into storage\.|update storage\.\w+\s+set|delete from storage\./i.test(STORAGE_SUCCESSOR), "no storage DML");
  assert.ok(!/storage\.buckets/.test(STORAGE_SUCCESSOR), "no bucket mutation");
  assert.ok(!/service_role/.test(STORAGE_SUCCESSOR), "no service-role-specific policy");
});

test("88. the historical documents Storage migration remains byte-identical", () => {
  const raw = readFileSync(join(ROOT, "supabase/migrations/20260725101130_documents_storage_setup.sql"));
  assert.equal(raw.byteLength, 3207, "byte count must match the frozen artifact");
  assert.equal(
    createHash("sha256").update(raw).digest("hex"),
    "370fdfe54822c022b691949b6b5396dc1e6b4fa9c67ba8e3626a2cfa849661ee",
    "the historical migration must never be edited"
  );
});

test("89. ordered history leaves the successor as the final documents-policy definition", () => {
  assert.ok("20260802030025" > "20260725101130", "the successor sorts after the historical migration");
  const defining = readdirSync(join(ROOT, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => /create policy "documents_member_/i.test(readFileSync(join(ROOT, "supabase/migrations", f), "utf8")))
    .sort();
  assert.deepEqual(
    defining,
    ["20260725101130_documents_storage_setup.sql", "20260802030025_documents_storage_fail_closed_authorization.sql"],
    "exactly two migrations define the policies, and the fail-closed one is last"
  );
});
