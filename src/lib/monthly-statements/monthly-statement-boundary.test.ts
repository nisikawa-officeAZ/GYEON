// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B2 — migration + contract boundary tests.
//
// These assert properties of the SOURCE that a unit test cannot: the enum extensions are additive,
// RLS + explicit grants exist, write policies are tenant-scoped fail-closed finance rules with USING
// and WITH CHECK, issued/voided immutability is enforced, the active-membership guard locks the
// invoice before checking, and no forbidden table/renderer/issuance is introduced.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-statement-boundary.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIG_DIR = "supabase/migrations";
const MIG_FILE = readdirSync(join(ROOT, MIG_DIR)).find((f) => f.endsWith("_monthly_statement_foundation.sql"));
const RAW = MIG_FILE ? readFileSync(join(ROOT, MIG_DIR, MIG_FILE), "utf8") : "";
// comment-stripped for logic scans (line comments only; SQL has no block comments here).
const SQL = RAW.replace(/^\s*--.*$/gm, "");

const LINE_FN = SQL.slice(
  SQL.indexOf("create or replace function public.enforce_monthly_statement_line_rules"),
  SQL.indexOf("drop trigger if exists trg_monthly_statement_line_rules"),
);
const STMT_FN = SQL.slice(
  SQL.indexOf("create or replace function public.enforce_monthly_statement_rules"),
  SQL.indexOf("drop trigger if exists trg_monthly_statement_rules"),
);

test("0. the migration exists and is non-trivial", () => {
  assert.ok(MIG_FILE, "a *_monthly_statement_foundation.sql migration must exist");
  assert.ok(SQL.length > 2000, "the migration must be substantial");
});

test("1. the two closed enums are EXTENDED additively (EVERY effective prior value retained + monthly_invoice)", () => {
  // B2-R1-1: the EFFECTIVE pre-B2 document_sequences enum is the 8 values reached after 046 + 048
  // (product_order) + 052 (reservation). All 8 must survive; a 7-value replacement that drops
  // product_order / reservation must FAIL this test. The assertion slices the actual CHECK body so it
  // cannot be satisfied by those values appearing in the (separate) document_files enum.
  const seqStart = SQL.indexOf("add constraint document_sequences_sequence_type_check");
  const seqBody = SQL.slice(seqStart, SQL.indexOf("));", seqStart));
  for (const v of ["estimate", "work_order", "completion_report", "invoice", "payment",
    "maintenance_reminder", "product_order", "reservation", "monthly_invoice"]) {
    assert.ok(seqBody.includes(`'${v}'`), `document_sequences enum must contain ${v}`);
  }
  const fileStart = SQL.indexOf("add constraint document_files_document_type_check");
  const fileBody = SQL.slice(fileStart, SQL.indexOf("));", fileStart));
  for (const v of ["estimate", "completion_report", "invoice", "product_order", "monthly_invoice"]) {
    assert.ok(fileBody.includes(`'${v}'`), `document_files enum must contain ${v}`);
  }
});

test("2. no destructive drop: only the two enum CHECKs are dropped-and-replaced; no drop table/column", () => {
  assert.ok(!/drop\s+table/i.test(SQL), "no table may be dropped");
  assert.ok(!/drop\s+column/i.test(SQL), "no column may be dropped");
  const dropped = [...SQL.matchAll(/drop constraint if exists ([a-z_]+)/gi)].map((m) => m[1]);
  assert.deepEqual(
    [...dropped].sort(),
    ["document_files_document_type_check", "document_sequences_sequence_type_check"],
    "constraint replacement is allowed ONLY for the two existing enums",
  );
});

test("3. both tables are created with RLS enabled and explicit grants (anon gets nothing)", () => {
  assert.match(SQL, /create table if not exists public\.monthly_statements \(/);
  assert.match(SQL, /create table if not exists public\.monthly_statement_lines \(/);
  assert.match(SQL, /alter table public\.monthly_statements\s+enable row level security/);
  assert.match(SQL, /alter table public\.monthly_statement_lines\s+enable row level security/);
  for (const t of ["monthly_statements", "monthly_statement_lines"]) {
    assert.match(SQL, new RegExp(`grant select, insert, update, delete on public\\.${t}\\s+to authenticated`));
    assert.match(SQL, new RegExp(`grant select, insert, update, delete on public\\.${t}\\s+to service_role`));
    assert.match(SQL, new RegExp(`revoke all on public\\.${t}\\s+from anon`));
  }
  assert.ok(!/to anon/.test(SQL.replace(/from anon/g, "")), "anon must receive no grant");
});

test("4. every write policy is tenant-scoped fail-closed finance; UPDATE has USING and WITH CHECK", () => {
  for (const t of ["monthly_statements", "monthly_statement_lines"]) {
    for (const cmd of ["select", "insert", "update", "delete"]) {
      assert.match(SQL, new RegExp(`create policy ${t}_${cmd} on public\\.${t}`), `${t}_${cmd} policy must exist`);
    }
    // finance predicate references dealer_staff owner/manager AND the tenant predicate on this table.
    const upd = SQL.slice(SQL.indexOf(`create policy ${t}_update on public.${t}`), SQL.indexOf(`create policy ${t}_delete on public.${t}`));
    assert.match(upd, /using \(/, `${t}_update needs USING`);
    assert.match(upd, /with check \(/, `${t}_update needs WITH CHECK`);
    assert.match(upd, new RegExp(`ds\\.dealer_id = ${t}\\.dealer_id`), `${t}_update must be tenant-scoped`);
    assert.match(upd, /ds\.role\s+in \('owner', 'manager'\)/, `${t}_update must be owner/manager finance`);
  }
  // No bare `to authenticated` without a tenant predicate: every policy body references dealer_id.
  assert.ok(!/user_metadata/.test(SQL), "authorization must not use user_metadata");
});

test("5. SELECT allows dealer members plus a read-only active super_admin ONLY (not gyeon/logistics admin)", () => {
  // B2-R1-2: the admin read branch of BOTH SELECT policies must require role = 'super_admin'.
  for (const t of ["monthly_statements", "monthly_statement_lines"]) {
    const sel = SQL.slice(SQL.indexOf(`create policy ${t}_select on public.${t}`),
      SQL.indexOf(`create policy ${t}_insert on public.${t}`));
    assert.match(sel, /admin_users au[\s\S]{0,160}au\.status\s+= 'active'[\s\S]{0,80}au\.role\s+= 'super_admin'/,
      `${t}_select admin branch must require active super_admin`);
    assert.ok(!/gyeon_admin|logistics_admin/.test(sel), `${t}_select must not grant gyeon_admin/logistics_admin`);
  }
  // admin appears only in SELECT policies, never as a write path.
  const writeSlices = ["insert", "update", "delete"].map((c) =>
    SQL.slice(SQL.indexOf(`create policy monthly_statements_${c}`), SQL.indexOf(`create policy monthly_statements_${c}`) + 800));
  for (const w of writeSlices) assert.ok(!/admin_users/.test(w), "super-admin must have NO write path");
});

test("6. statement immutability: no return to draft, issued/voided frozen, no hard delete", () => {
  assert.match(STMT_FN, /monthly_statement_cannot_return_to_draft/);
  assert.match(STMT_FN, /monthly_statement_issued_fields_immutable/);
  assert.match(STMT_FN, /monthly_statement_voided_is_terminal/);
  // the frozen set includes identity, dates, numbering, totals, snapshots and the previous link.
  for (const col of ["statement_number", "period_start", "period_end", "closing_date", "previous_statement_id",
    "closing_balance", "customer_snapshot", "tax_summary_snapshot", "issued_at", "issued_by"]) {
    assert.match(STMT_FN, new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`), `${col} must be frozen`);
  }
  assert.match(SQL, /monthly_statement_no_hard_delete/);
  assert.match(SQL, /before delete on public\.monthly_statements/);
});

test("7. line rules: parent must be draft; tenant matches statement AND invoice; eligibility; delivery source", () => {
  assert.match(LINE_FN, /monthly_statement_line_parent_not_draft/);
  assert.match(LINE_FN, /monthly_statement_line_statement_tenant_mismatch/);
  assert.match(LINE_FN, /monthly_statement_line_invoice_tenant_mismatch/);
  assert.match(LINE_FN, /not in \('issued', 'paid', 'partially_paid', 'overdue'\)/);
  assert.match(LINE_FN, /monthly_statement_line_invoice_not_eligible/);
  // delivery_date sourced from the invoice; mismatch rejected; no issue_date fallback anywhere.
  assert.match(LINE_FN, /monthly_statement_line_delivery_date_mismatch/);
  assert.ok(!/issue_date/.test(SQL), "the migration must never reference issue_date");
});

test("8. active-membership guard LOCKS the source invoice BEFORE the membership check", () => {
  const lockAt = LINE_FN.indexOf("from public.invoices where id = new.invoice_id for update");
  const membershipAt = LINE_FN.indexOf("monthly_statement_lines l");
  assert.ok(lockAt > 0, "the source invoice must be locked FOR UPDATE");
  assert.ok(membershipAt > lockAt, "membership must be checked only AFTER the invoice lock");
  // membership counts only NON-VOIDED parents, so a voided parent releases the invoice.
  assert.match(LINE_FN, /join public\.monthly_statements s on s\.id = l\.statement_id[\s\S]{0,160}s\.status\s+<>\s+'voided'/);
  assert.match(LINE_FN, /monthly_statement_line_invoice_already_active/);
  // the parent statement is also locked FOR UPDATE.
  assert.match(LINE_FN, /from public\.monthly_statements where id = v_statement_id for update/);
});

test("9. no SECURITY DEFINER shortcut; all three trigger functions pin search_path", () => {
  assert.ok(!/security definer/i.test(SQL), "no authorization shortcut may be introduced");
  const pins = SQL.match(/set search_path = ''/g) ?? [];
  assert.ok(pins.length >= 3, "each trigger function must pin search_path");
});

test("10. no forbidden table/renderer/issuance/Storage is created in this phase", () => {
  for (const forbidden of [
    "payment_allocations", "monthly_statement_adjustments",
    ".upload(", "createSignedUrl", "storage.objects", "storage.buckets",
  ]) {
    assert.ok(!SQL.includes(forbidden), `this phase must not touch ${forbidden}`);
  }
  // no document_files INSERT (no PDF persistence in B2).
  assert.ok(!/insert into public\.document_files/i.test(SQL), "no document_files row may be created in B2");
});

test("11. a monthly statement is never a synthetic single invoice — no insert into invoices", () => {
  assert.ok(!/insert into public\.invoices/i.test(SQL), "the aggregate must not manufacture an invoice row");
});

// ─── B2-R1-4 + transition/source integrity ───────────────────────────────────

test("12. draft→issued is PRIVILEGED, complete, and internally consistent", () => {
  // Direct authenticated issuance fails closed (privileged database role required).
  assert.match(STMT_FN, /current_user not in \('service_role', 'postgres', 'supabase_admin'\)/);
  assert.match(STMT_FN, /monthly_statement_issue_requires_privileged_path/);
  // Issuance requires a non-blank number, issued metadata, and at least one line.
  assert.match(STMT_FN, /monthly_statement_issue_requires_number/);
  assert.match(STMT_FN, /monthly_statement_issue_requires_issued_metadata/);
  assert.match(STMT_FN, /monthly_statement_issue_requires_lines/);
  assert.match(STMT_FN, /from public\.monthly_statement_lines where statement_id = new\.id/);
  // Totals must equal the line snapshot sums; closing balance must equal the formula.
  assert.match(STMT_FN, /monthly_statement_totals_line_mismatch/);
  assert.match(STMT_FN, /new\.closing_balance <>\s*new\.opening_balance \+ new\.current_total - new\.allocated_payments_total \+ new\.adjustments_total/);
  assert.match(STMT_FN, /monthly_statement_closing_balance_mismatch/);
  // A draft (insert or staying draft) carries no lifecycle metadata.
  assert.match(STMT_FN, /monthly_statement_draft_has_lifecycle_metadata/);
});

test("13. issued→voided is PRIVILEGED and controlled; issued/voided metadata is locked down", () => {
  // R2: voiding an issued statement requires a privileged database role — an authenticated
  // owner/manager cannot void directly. There are now TWO privileged gates (issue + void).
  assert.match(STMT_FN, /monthly_statement_void_requires_privileged_path/);
  const privGates = STMT_FN.match(/current_user not in \('service_role', 'postgres', 'supabase_admin'\)/g) ?? [];
  assert.ok(privGates.length >= 2, "both draft→issued and issued→voided must be privileged");
  assert.match(STMT_FN, /monthly_statement_void_requires_metadata/);
  assert.match(STMT_FN, /previous_statement_id = old\.id and s\.status <> 'voided'/);
  assert.match(STMT_FN, /monthly_statement_void_blocked_by_active_successor/);
  assert.match(STMT_FN, /monthly_statement_voided_is_terminal/);
  // An issued row staying issued cannot acquire void metadata; a voided row's metadata is frozen.
  assert.match(STMT_FN, /monthly_statement_issued_cannot_have_void_metadata/);
  assert.match(STMT_FN, /monthly_statement_voided_metadata_immutable/);
});

test("14. previous-statement chain integrity: not self, issued, earlier, opening balance matched", () => {
  assert.match(STMT_FN, /monthly_statement_previous_is_self/);
  assert.match(STMT_FN, /monthly_statement_previous_not_issued/);
  assert.match(STMT_FN, /v_prev_end >= new\.period_start/);
  assert.match(STMT_FN, /monthly_statement_previous_not_earlier/);
  assert.match(STMT_FN, /monthly_statement_opening_balance_mismatch/);
  assert.match(STMT_FN, /monthly_statement_opening_balance_must_be_zero/);
});

test("15. line source integrity: invoice_number and every monetary snapshot equal the source invoice", () => {
  // The locked invoice read now also returns invoice_number and the money columns.
  assert.match(LINE_FN, /select status, dealer_id, customer_id, delivery_date,[\s\S]{0,120}invoice_number, subtotal, discount_amount, tax_rate, tax_amount, total/);
  assert.match(LINE_FN, /monthly_statement_line_invoice_number_mismatch/);
  assert.match(LINE_FN, /new\.subtotal_snapshot\s+is distinct from v_inv_subtotal/);
  assert.match(LINE_FN, /new\.total_snapshot\s+is distinct from v_inv_total/);
  assert.match(LINE_FN, /monthly_statement_line_snapshot_mismatch/);
});

// ─── B2-R2: period bounds, authoritative predecessor, overlap/branch, serialization ──

test("16. a line's delivery_date must fall within the parent statement's inclusive period", () => {
  // The parent period is loaded from the LOCKED parent statement (not from the line payload).
  assert.match(LINE_FN, /select status, dealer_id, customer_id, period_start, period_end[\s\S]{0,220}for update/);
  assert.match(LINE_FN, /new\.delivery_date < v_stmt_pstart or new\.delivery_date > v_stmt_pend/);
  assert.match(LINE_FN, /monthly_statement_line_delivery_outside_period/);
});

test("17. issuance requires the EXACT latest issued predecessor (no chain reset, no older predecessor)", () => {
  // Selects the latest issued statement (period_end < new.period_start) ordered period_end desc.
  assert.match(STMT_FN, /status = 'issued' and period_end < new\.period_start[\s\S]{0,80}order by period_end desc/);
  assert.match(STMT_FN, /monthly_statement_previous_not_latest/);
  // A missing previous_statement_id cannot reset a live chain to zero: with a latest present, null
  // previous is rejected; with none present, opening must be zero.
  assert.match(STMT_FN, /new\.opening_balance <> 0[\s\S]{0,120}monthly_statement_opening_balance_must_be_zero/);
});

test("18. issuance rejects overlapping issued statements and predecessor branching", () => {
  assert.match(STMT_FN, /s\.period_start <= new\.period_end and s\.period_end >= new\.period_start/);
  assert.match(STMT_FN, /monthly_statement_period_overlap/);
  assert.match(STMT_FN, /previous_statement_id = new\.previous_statement_id[\s\S]{0,120}status = 'issued'/);
  assert.match(STMT_FN, /monthly_statement_predecessor_already_succeeded/);
});

test("19. issuance and voiding serialize on the same authoritative customer row (concurrency is proven in B2-V1, not here)", () => {
  // Source-level: BOTH the draft→issued and issued→voided branches take the SAME customer-scoped
  // row lock, so concurrent transactions for one customer serialise. This test asserts the lock
  // EXISTS in source; it deliberately does NOT claim to prove runtime concurrency — that proof is
  // reserved for the disposable-database phase (B2-V1).
  const locks = STMT_FN.match(/from public\.customers c where c\.id = (new|old)\.customer_id for update/g) ?? [];
  assert.ok(locks.length >= 2, "issuance and voiding must both lock the authoritative customer row");
});

// ─── B2-R3: parent-mutation bypass closure ───────────────────────────────────

test("20. the statement customer must belong to the statement's dealer (independently of RLS)", () => {
  assert.match(STMT_FN, /select dealer_id into v_cust_dealer from public\.customers where id = new\.customer_id/);
  assert.match(STMT_FN, /v_cust_dealer is distinct from new\.dealer_id/);
  assert.match(STMT_FN, /monthly_statement_customer_dealer_mismatch/);
});

test("21. draft→issued RE-VALIDATES every persisted line against the FINAL scope and period", () => {
  // The scan reads all lines by statement_id (not relying on the insertion-time line trigger) and
  // checks dealer_id, customer_id and inclusive period bounds. It runs after the customer lock.
  // Anchor on CODE markers (comments are stripped): the draft→issued branch spans from its privileged
  // gate to its closing-balance check.
  const issueStart = STMT_FN.indexOf("monthly_statement_issue_requires_privileged_path");
  const issueSlice = STMT_FN.slice(issueStart, STMT_FN.indexOf("monthly_statement_closing_balance_mismatch", issueStart));
  assert.match(issueSlice, /from public\.monthly_statement_lines l\s*\n\s*where l\.statement_id = new\.id/);
  assert.match(issueSlice, /l\.dealer_id\s+is distinct from new\.dealer_id/);
  assert.match(issueSlice, /l\.customer_id\s+is distinct from new\.customer_id/);
  assert.match(issueSlice, /l\.delivery_date < new\.period_start\s*\n\s*or l\.delivery_date > new\.period_end/);
  assert.match(issueSlice, /monthly_statement_issue_line_scope_or_period_violation/);
  // The lock is acquired BEFORE the predecessor-chain decision.
  const lockAt = issueSlice.indexOf("from public.customers c where c.id = new.customer_id for update");
  const predAt = issueSlice.indexOf("status = 'issued' and period_end < new.period_start");
  assert.ok(lockAt > 0 && predAt > lockAt, "the customer lock must precede the predecessor decision");
});

test("22. a draft scope/period edit that would invalidate existing lines is rejected", () => {
  assert.match(STMT_FN, /monthly_statement_draft_edit_invalidates_lines/);
  // inclusive period bounds: the revalidation uses strict < / > so a boundary-date line stays valid.
  assert.ok(!/l\.delivery_date <= new\.period_start/.test(STMT_FN), "period bounds must be inclusive");
});

// ─── B2-R4: source-invoice lifecycle at issuance + post-issuance cancellation guard ──

const CANCEL_FN = SQL.slice(
  SQL.indexOf("create or replace function public.enforce_invoice_cancel_not_in_issued_statement"),
  SQL.indexOf("drop trigger if exists trg_invoice_cancel_not_in_issued_statement"),
);

test("23. issuance re-locks source invoices in deterministic id order and revalidates status + snapshots", () => {
  const issueStart = STMT_FN.indexOf("monthly_statement_issue_requires_privileged_path");
  const issueSlice = STMT_FN.slice(issueStart, STMT_FN.indexOf("monthly_statement_closing_balance_mismatch", issueStart));
  // Deterministic invoice-id-ordered lock (a loop, not a bare ORDER BY ... FOR UPDATE).
  assert.match(issueSlice, /for v_inv_id in\s*\n\s*select distinct l\.invoice_id[\s\S]{0,120}order by l\.invoice_id[\s\S]{0,80}from public\.invoices where id = v_inv_id for update/);
  // Current source status must be eligible (cancelled/draft rejected) and every snapshot exact.
  assert.match(issueSlice, /i\.status\s+not in \('issued', 'paid', 'partially_paid', 'overdue'\)/);
  assert.match(issueSlice, /i\.invoice_number is distinct from l\.invoice_number/);
  assert.match(issueSlice, /i\.total\s+is distinct from l\.total_snapshot/);
  assert.match(issueSlice, /monthly_statement_issue_source_invoice_invalid/);
  // The source lock is acquired AFTER the customer lock and BEFORE the predecessor decision.
  const custLock = issueSlice.indexOf("from public.customers c where c.id = new.customer_id for update");
  const srcLock = issueSlice.indexOf("from public.invoices where id = v_inv_id for update");
  const predAt = issueSlice.indexOf("status = 'issued' and period_end < new.period_start");
  assert.ok(custLock >= 0 && srcLock > custLock && predAt > srcLock, "customer lock → source lock → predecessor decision");
});

test("24. an invoice inside an ISSUED statement cannot be cancelled; voided releases; draft does not permanently block", () => {
  assert.ok(CANCEL_FN.length > 200, "the cancellation-guard function must exist");
  assert.match(CANCEL_FN, /new\.status = 'cancelled' and old\.status is distinct from 'cancelled'/);
  // Only an ISSUED parent blocks — a voided or draft parent does not match s.status = 'issued'.
  assert.match(CANCEL_FN, /join public\.monthly_statements s on s\.id = l\.statement_id[\s\S]{0,80}s\.status = 'issued'/);
  assert.match(CANCEL_FN, /invoice_cancel_blocked_by_issued_statement/);
  // It is a SEPARATE before-update trigger on invoices, and it does not touch the immutability trigger.
  assert.match(SQL, /create trigger trg_invoice_cancel_not_in_issued_statement\s*\n\s*before update on public\.invoices/);
  assert.ok(!/enforce_invoice_issued_immutability/.test(CANCEL_FN), "must not modify the immutability trigger");
  // SECURITY INVOKER + pinned search_path, no shortcut.
  assert.ok(!/security definer/i.test(CANCEL_FN));
  assert.match(CANCEL_FN, /set search_path = ''/);
});

test("25. deterministic locks + guard exist in source; runtime race proof is reserved for B2-V1", () => {
  // Source-level only: the invoice loop-lock and the cancellation guard are present. This does NOT
  // claim runtime concurrency safety — cancel-vs-issue proof with separate connections is B2-V1.
  assert.match(STMT_FN, /for v_inv_id in/);
  assert.match(CANCEL_FN, /invoice_cancel_blocked_by_issued_statement/);
});
