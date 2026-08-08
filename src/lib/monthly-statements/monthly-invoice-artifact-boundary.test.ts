// B3-B1B E2-M1 — static source-scan boundary test for the monthly-invoice artifact migration.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
//
// Comments are stripped first so every assertion anchors on real SQL, never on prose.
// Executable behavior (RLS, triggers, CAS, Storage API) is reserved for the disposable phase.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIG_DIR = "supabase/migrations";
const MIG_FILE = readdirSync(MIG_DIR).find((f) => f.endsWith("_monthly_invoice_pdf_artifact.sql"));
assert.ok(MIG_FILE, "the E2-M1 artifact migration must exist");

function stripSql(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "").replace(/--[^\n]*$/gm, "");
}
const SQL = stripSql(readFileSync(`${MIG_DIR}/${MIG_FILE}`, "utf8")).toLowerCase();

// ─── storage policies: exactly two command-specific RESTRICTIVE policies ─────

const INSERT_POLICY = SQL.slice(
  SQL.indexOf(`create policy "documents_protected_artifacts_insert"`),
  SQL.indexOf(`drop policy if exists "documents_protected_artifacts_update"`),
);
const UPDATE_POLICY = SQL.slice(
  SQL.indexOf(`create policy "documents_protected_artifacts_update"`),
  SQL.indexOf("create or replace function public.attach_monthly_statement_pdf_rpc"),
);

test("1. exactly two AS RESTRICTIVE policies are created, both on storage.objects for authenticated", () => {
  assert.equal((SQL.match(/as restrictive/g) ?? []).length, 2);
  assert.equal((SQL.match(/create policy/g) ?? []).length, 2);
  assert.equal((SQL.match(/on storage\.objects\s+as restrictive/g) ?? []).length, 2);
  assert.equal((SQL.match(/to authenticated/g) ?? []).length, 2);
});

test("2. the INSERT policy has WITH CHECK only (no USING)", () => {
  assert.match(INSERT_POLICY, /for insert/);
  assert.match(INSERT_POLICY, /with check/);
  assert.doesNotMatch(INSERT_POLICY, /using\s*\(/, "INSERT policies cannot carry USING");
});

test("3. the UPDATE policy has BOTH USING and WITH CHECK", () => {
  assert.match(UPDATE_POLICY, /for update/);
  assert.match(UPDATE_POLICY, /using\s*\(/);
  assert.match(UPDATE_POLICY, /with check/);
});

test("4. both policies protect BOTH issued namespaces and pass everything outside them", () => {
  for (const block of [INSERT_POLICY, UPDATE_POLICY]) {
    assert.match(block, /bucket_id <> 'documents'/);
    assert.ok(block.includes(String.raw`name !~ '^[^/]+/(invoice|monthly_invoice)/issued/'`),
      "the protected-namespace regex must cover invoice AND monthly_invoice issued prefixes");
  }
});

test("5. SELECT policies on storage are untouched (no select policy created or dropped)", () => {
  assert.doesNotMatch(SQL, /for select/);
  assert.ok(!SQL.includes("documents_member_read"), "the live read policy is never referenced");
  assert.ok(!SQL.includes("documents_member_insert"), "the live permissive insert policy is never touched");
  assert.ok(!SQL.includes("documents_member_update"), "the live permissive update policy is never touched");
});

// ─── pointer pair + dedicated trigger ────────────────────────────────────────

test("6. pointer columns exist with an ON DELETE RESTRICT FK and no persisted URL", () => {
  assert.match(SQL, /add column if not exists pdf_document_file_id uuid\s+references public\.document_files\(id\) on delete restrict/);
  assert.match(SQL, /add column if not exists pdf_generated_at timestamptz/);
  assert.ok(!SQL.includes("pdf_file_url"), "no URL column");
  assert.ok(!SQL.includes("signed"), "no signed-URL persistence");
});

test("7. the pair constraint and INSERT rejection are present", () => {
  assert.match(SQL, /check \(\(pdf_document_file_id is null\) = \(pdf_generated_at is null\)\)/);
  assert.match(SQL, /monthly_pdf_pointer_forbidden_on_insert/);
  assert.match(SQL, /before insert or update on public\.monthly_statements/,
    "the pointer trigger covers INSERT as well as UPDATE (not UPDATE OF)");
  assert.doesNotMatch(SQL, /update of/, "UPDATE OF column lists are forbidden");
});

test("8. the dedicated pointer trigger exists and the accepted financial trigger is untouched", () => {
  assert.match(SQL, /create trigger trg_monthly_statement_pdf_pointer/);
  assert.match(SQL, /enforce_monthly_statement_pdf_pointer/);
  assert.ok(!SQL.includes("enforce_monthly_statement_rules"), "the accepted financial function is never redefined");
  assert.ok(!SQL.includes("trg_monthly_statement_rules"), "the accepted financial trigger is never dropped or recreated");
  assert.match(SQL, /monthly_pdf_pointer_requires_privileged_path/);
  assert.match(SQL, /monthly_pdf_pointer_requires_issued/);
  assert.match(SQL, /monthly_pdf_pointer_immutable/);
});

test("9. pdf_generated_at is derived in-database and never an RPC argument", () => {
  assert.match(SQL, /new\.pdf_generated_at := now\(\)/);
  assert.doesNotMatch(SQL, /p_generated/, "no caller-supplied generation timestamp");
});

// ─── document_files protection + uniqueness ──────────────────────────────────

test("10. the partial unique active-artifact index is exact", () => {
  assert.match(SQL, /create unique index if not exists document_files_monthly_invoice_active_uidx\s+on public\.document_files \(dealer_id, document_id\)\s+where document_type = 'monthly_invoice' and status = 'active'/);
});

test("11. the guard trigger protects invoice AND monthly_invoice issued rows, SECURITY INVOKER", () => {
  assert.match(SQL, /create trigger trg_protected_artifact_rows\s+before insert or update or delete on public\.document_files/);
  assert.match(SQL, /document_type in \('invoice', 'monthly_invoice'\)/);
  assert.match(SQL, /protected_artifact_row_requires_privileged_path/);
  assert.match(SQL, /protected_artifact_row_referenced/);
  assert.match(SQL, /protected_artifact_row_immutable_while_referenced/);
  assert.doesNotMatch(SQL, /security\s+definer/, "every function here is SECURITY INVOKER");
});

test("12. referenced-check covers both pointer kinds and compensation deletes need unreferenced rows", () => {
  assert.match(SQL, /ms\.pdf_document_file_id = v_row_id/);
  assert.match(SQL, /i\.pdf_file_path = v_row_path/);
});

// ─── attach RPC ──────────────────────────────────────────────────────────────

test("13. attach RPC signature, invoker security, empty search_path, service-role-only EXECUTE", () => {
  assert.match(SQL, /create or replace function public\.attach_monthly_statement_pdf_rpc\(\s*p_dealer_id\s+uuid,\s*p_statement_id\s+uuid,\s*p_document_file_id\s+uuid\s*\)\s*returns public\.monthly_statements/);
  assert.equal((SQL.match(/set search_path = ''/g) ?? []).length, 3, "all three functions pin an empty search_path");
  assert.match(SQL, /revoke all\s+on function public\.attach_monthly_statement_pdf_rpc\(uuid, uuid, uuid\) from public/);
  assert.match(SQL, /revoke execute on function public\.attach_monthly_statement_pdf_rpc\(uuid, uuid, uuid\) from anon/);
  assert.match(SQL, /revoke execute on function public\.attach_monthly_statement_pdf_rpc\(uuid, uuid, uuid\) from authenticated/);
  const grants = SQL.match(/grant\s+execute on function public\.attach_monthly_statement_pdf_rpc[^;]*;/g) ?? [];
  assert.equal(grants.length, 1);
  assert.match(grants[0], /to service_role;/);
});

test("14. positional control flow: lock+issued -> conflict -> doc lock -> canonical -> idempotent -> update", () => {
  const rpc = SQL.slice(SQL.indexOf("create or replace function public.attach_monthly_statement_pdf_rpc"));
  const iStmtLock   = rpc.indexOf("from public.monthly_statements");
  const iNotIssued  = rpc.indexOf("monthly_pdf_statement_not_issued");
  const iConflict   = rpc.indexOf("monthly_pdf_pointer_conflict");
  const iDfLock     = rpc.indexOf("from public.document_files");
  const iCanonical  = rpc.indexOf("monthly_pdf_document_not_canonical");
  const iIdempotent = rpc.indexOf("if v_stmt.pdf_document_file_id = p_document_file_id then");
  const iUpdate     = rpc.indexOf("update public.monthly_statements");
  assert.ok(iStmtLock > 0 && iNotIssued > iStmtLock, "statement lock precedes issued validation");
  assert.ok(iConflict > iNotIssued, "different-pointer conflict follows issued validation");
  assert.ok(iDfLock > iConflict, "the document row locks second, after the conflict gate");
  assert.ok(iCanonical > iDfLock, "canonical validation follows the document lock");
  assert.ok(iIdempotent > iCanonical, "the matching-pointer idempotent return comes ONLY after full validation");
  assert.ok(iUpdate > iIdempotent, "only the null-pointer path reaches the pointer UPDATE");
  assert.equal((rpc.match(/for update/g) ?? []).length, 2, "exactly the two SELECT ... FOR UPDATE row locks");
  assert.match(rpc, /is not null\s+and v_stmt\.pdf_document_file_id is distinct from p_document_file_id/,
    "an existing pointer is rejected only when it DIFFERS");
});

test("15. the canonical key is exactly <dealer>/monthly_invoice/issued/<statement>/<document-file>.pdf", () => {
  assert.ok(SQL.includes(`'/monthly_invoice/issued/' || p_statement_id::text || '/' || v_df.id::text || '.pdf'`));
  assert.ok(SQL.includes(`'/monthly_invoice/issued/' || new.id::text || '/' || v_df.id::text || '.pdf'`));
});

// ─── forbidden surfaces ──────────────────────────────────────────────────────

test("16. no advisory lock, upsert, storage DML, LINE, or ScreensPreview reference", () => {
  for (const forbidden of [
    "pg_advisory", "upsert",
    "insert into storage.", "update storage.", "delete from storage.", "truncate storage.",
    "storage.buckets",
    "line_link", "liff", "line_user_id",
    "screenspreview",
  ]) {
    assert.ok(!SQL.includes(forbidden), `must not contain ${forbidden}`);
  }
  assert.doesNotMatch(SQL, /auth\.role/, "auth.role() is forbidden; explicit role names are used");
});
