// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1B-D1 — source-scan boundary test.
//
// Static assertions over the D1 draft-creation migration. It proves the CONTRACT is present in
// source; executable PostgreSQL behavior and concurrency are reserved for D1-V1. Comments are
// stripped first so every assertion anchors on real SQL, never on comment prose.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-statement-draft-boundary.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIG_DIR = "supabase/migrations";
const MIG_FILE = readdirSync(MIG_DIR).find((f) => f.endsWith("_create_monthly_statement_draft_rpc.sql"));
assert.ok(MIG_FILE, "the D1 draft-RPC migration file must exist");

function stripSql(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "").replace(/--[^\n]*$/gm, "");
}
const RAW = readFileSync(`${MIG_DIR}/${MIG_FILE}`, "utf8");
const SQL = stripSql(RAW).toLowerCase();

// ─── function identity ───────────────────────────────────────────────────────────────────────────

test("1. exact RPC signature: 4 params in order, returns public.monthly_statements", () => {
  assert.match(
    SQL,
    /create or replace function public\.create_monthly_statement_draft_rpc\(\s*p_dealer_id\s+uuid,\s*p_actor\s+uuid,\s*p_customer_id\s+uuid,\s*p_reference_date\s+date\s*\)\s*returns public\.monthly_statements/,
  );
  assert.match(SQL, /language plpgsql/);
});

test("2. SECURITY INVOKER only, with an empty search_path", () => {
  assert.doesNotMatch(SQL, /security\s+definer/, "the draft RPC must never be SECURITY DEFINER");
  assert.match(SQL, /set search_path = ''/);
});

test("3. EXECUTE: PUBLIC/anon/service_role revoked; authenticated is the only grantee", () => {
  assert.match(SQL, /revoke all\s+on function public\.create_monthly_statement_draft_rpc\(uuid, uuid, uuid, date\) from public/);
  assert.match(SQL, /revoke execute on function public\.create_monthly_statement_draft_rpc\(uuid, uuid, uuid, date\) from anon/);
  assert.match(SQL, /revoke execute on function public\.create_monthly_statement_draft_rpc\(uuid, uuid, uuid, date\) from service_role/);
  assert.match(SQL, /grant\s+execute on function public\.create_monthly_statement_draft_rpc\(uuid, uuid, uuid, date\) to authenticated/);
  const grants = SQL.match(/grant\s+execute on function public\.create_monthly_statement_draft_rpc[^;]*;/g) ?? [];
  assert.equal(grants.length, 1, "exactly one EXECUTE grant statement");
  const grantee = grants[0].replace(/^[\s\S]*\)\s+to\s+/, "").replace(";", "").trim();
  assert.equal(grantee, "authenticated", "the single grant names authenticated only");
});

// ─── active-scope uniqueness ─────────────────────────────────────────────────────────────────────

test("4. active-scope unique index: exact columns, exact predicate, no IF NOT EXISTS", () => {
  assert.match(
    SQL,
    /create unique index monthly_statements_active_scope_uidx\s+on public\.monthly_statements \(dealer_id, customer_id, period_start, period_end\)\s+where status <> 'voided'/,
  );
  assert.doesNotMatch(SQL, /create unique index if not exists monthly_statements_active_scope_uidx/);
  assert.doesNotMatch(SQL, /delete from public\.monthly_statements/, "no duplicate repair/rewrite");
  assert.doesNotMatch(SQL, /update public\.monthly_statements\s+set/, "no duplicate repair/rewrite");
});

// ─── ordering: fail-closed zero-eligible before numbering and before the header insert ───────────

test("5. statement_draft_no_eligible_invoices occurs before numbering and before the header INSERT", () => {
  const noEligible = SQL.indexOf("statement_draft_no_eligible_invoices");
  const numbering = SQL.indexOf("get_next_document_number");
  const headerInsert = SQL.indexOf("insert into public.monthly_statements");
  assert.ok(noEligible > 0, "zero-eligible error present");
  assert.ok(numbering > 0, "nested numbering call present");
  assert.ok(headerInsert > 0, "header insert present");
  assert.ok(noEligible < numbering, "zero-eligible guard precedes sequence allocation");
  assert.ok(noEligible < headerInsert, "zero-eligible guard precedes the header insert");
});

// ─── fixed-contract numbering ────────────────────────────────────────────────────────────────────

test("6. nested numbering call uses the exact fixed literals and a period_end-derived YYYYMM fiscal", () => {
  assert.match(
    SQL,
    /public\.get_next_document_number\(p_dealer_id, 'monthly_invoice', v_fiscal, 'miv', 5, 'monthly'\)/,
  );
  assert.match(SQL, /extract\(year from v_period_end\)/);
  assert.match(SQL, /extract\(month from v_period_end\)/);
  assert.match(SQL, /'miv-' \|\| to_char\(v_period_end, 'yyyy'\) \|\| '-' \|\| to_char\(v_period_end, 'mm'\)/);
  assert.match(SQL, /lpad\(v_seq_text, 5, '0'\)/);
  assert.match(SQL, /statement_draft_number_unavailable/);
});

test("7. the migration neither redefines get_next_document_number nor reads document_sequences", () => {
  assert.doesNotMatch(SQL, /create or replace function public\.get_next_document_number/);
  assert.doesNotMatch(SQL, /replace function get_next_document_number/);
  assert.ok(!SQL.includes("document_sequences"), "stored numbering configuration is never consulted");
});

// ─── authorization and actor contract ────────────────────────────────────────────────────────────

test("8. actor comes exclusively from auth.uid(); mismatch and null are fail-closed", () => {
  assert.match(SQL, /v_actor := \(select auth\.uid\(\)\)/);
  assert.match(SQL, /statement_draft_actor_mismatch/);
  assert.match(SQL, /statement_draft_not_finance_authorized/);
  assert.doesNotMatch(SQL, /current_user in \('service_role'/, "no trusted service-role actor passthrough");
});

test("9. finance authorization uses dealer_staff precedence with dealer_members fallback", () => {
  const authz = SQL.slice(SQL.indexOf("statement_draft_actor_mismatch"), SQL.indexOf("statement_draft_customer_not_found"));
  assert.match(authz, /public\.dealer_staff ds[\s\S]*?ds\.status = 'active' and ds\.role in \('owner','manager'\)/);
  assert.match(authz, /not exists \(select 1 from public\.dealer_staff ds where ds\.dealer_id = p_dealer_id and ds\.user_id = v_actor\)/);
  assert.match(authz, /public\.dealer_members dm[\s\S]*?dm\.status = 'active' and dm\.role in \('owner','manager'\)/);
});

// ─── eligibility, locking, and period derivation ─────────────────────────────────────────────────

test("10. eligibility is delivery_date-only; issue_date never appears in the migration", () => {
  assert.match(SQL, /i\.delivery_date is not null/);
  assert.match(SQL, /i\.delivery_date >= v_period_start/);
  assert.match(SQL, /i\.delivery_date <= v_period_end/);
  assert.ok(!SQL.includes("issue_date"), "issue_date must never appear");
  assert.match(SQL, /i\.status in \('issued', 'paid', 'partially_paid', 'overdue'\)/);
  assert.match(SQL, /i\.deleted_at is null/);
  assert.match(SQL, /s2\.status <> 'voided'/, "active-statement membership exclusion");
});

test("11. explicit ordered invoice lock loop in ascending id order", () => {
  assert.match(SQL, /array_agg\(i\.id order by i\.id\)/);
  assert.match(SQL, /foreach v_inv_id in array v_inv_ids loop\s+perform 1 from public\.invoices where id = v_inv_id for update;\s+end loop/);
});

test("12. customer lock + tenant proof, dealer_settings closing-mode gate, advisory scope lock", () => {
  assert.match(SQL, /from public\.customers where id = p_customer_id for update/);
  assert.match(SQL, /statement_draft_customer_not_found/);
  assert.match(SQL, /statement_draft_dealer_not_closing_mode/);
  assert.match(SQL, /statement_draft_period_already_issued/);
  assert.match(SQL, /pg_catalog\.pg_advisory_xact_lock\(/);
  assert.match(SQL, /hashtextextended\(p_dealer_id::text \|\| '\|' \|\| p_customer_id::text \|\| '\|' \|\| v_period_end::text, 0\)/);
});

// ─── snapshot allowlists ─────────────────────────────────────────────────────────────────────────

test("13. snapshots use jsonb_build_object allowlists only — no whole-row serialization", () => {
  assert.match(SQL, /jsonb_build_object\(\s*'id',\s*c\.id/);
  assert.match(SQL, /jsonb_build_object\(\s*'id',\s*d\.id/);
  assert.match(SQL, /jsonb_build_object\(\s*'maker',\s*v\.maker/);
  assert.doesNotMatch(SQL, /to_jsonb\s*\(/, "to_jsonb whole-row serialization is forbidden");
  assert.doesNotMatch(SQL, /row_to_json\s*\(/, "row_to_json whole-row serialization is forbidden");
});

test("14. customer snapshot excludes memo, notes, match keys, and all LINE fields", () => {
  for (const forbidden of [
    "c.memo", "c.notes", "c.birthday", "c.gender", "c.occupation",
    "match_phone_digits", "match_name_norm", "match_kana_norm",
    "line_id", "line_user_id", "line_display_name", "line_picture_url", "line_connected",
    "line_customers", "liff", "channel_access_token", "channel_secret",
  ]) {
    assert.ok(!SQL.includes(forbidden), `forbidden identifier must not appear: ${forbidden}`);
  }
});

test("15. dealer snapshot never serializes dealer_settings; only closing/payment day are read from it", () => {
  const settingsReads = SQL.match(/from public\.dealer_settings/g) ?? [];
  assert.equal(settingsReads.length, 1, "exactly one dealer_settings read");
  assert.match(SQL, /select ds\.dealer_closing_day, ds\.dealer_payment_day/);
  assert.doesNotMatch(SQL, /jsonb_build_object\([^)]*dealer_settings/, "dealer_settings is never snapshotted");
  assert.match(SQL, /'closing_day',\s*v_closing_day/);
  assert.match(SQL, /'payment_day',\s*v_payment_day/);
  assert.match(SQL, /'reference_date',\s*p_reference_date/);
  assert.match(SQL, /'payment_due_date',\s*v_due_date/);
  assert.match(SQL, /tax_summary_snapshot[\s\S]*?'\{\}'::jsonb/, "tax summary stays an empty object in D1");
});

// ─── line snapshots and ordering ─────────────────────────────────────────────────────────────────

test("16. line snapshots are byte-copies of stored invoice columns", () => {
  assert.match(SQL, /i\.subtotal, i\.discount_amount, i\.tax_rate, i\.tax_amount, i\.total/);
  assert.match(SQL, /i\.delivery_date, i\.invoice_number/);
});

test("17. work description: trimmed title first, else first item name with ほかN件, else empty", () => {
  assert.match(SQL, /btrim\(coalesce\(i\.title, ''\)\) <> '' then btrim\(i\.title\)/);
  assert.match(SQL, /array_agg\(btrim\(ii\.item_name\) order by ii\.sort_order, ii\.id\)/);
  assert.match(SQL, /\|\| ' ほか' \|\| \(n\.name_count - 1\)::text \|\| '件'/);
  assert.match(SQL, /btrim\(coalesce\(ii\.item_name, ''\)\) <> ''/);
});

test("18. deterministic sort_order: delivery_date, invoice_number with nulls-deterministic, then id", () => {
  assert.match(
    SQL,
    /row_number\(\) over \(order by i\.delivery_date asc,\s*\(i\.invoice_number is null\) asc,\s*i\.invoice_number asc,\s*i\.id asc\)/,
  );
});

// ─── forbidden surfaces ──────────────────────────────────────────────────────────────────────────

test("19. no RLS/table-grant changes, no admin path, no out-of-scope surface", () => {
  assert.doesNotMatch(SQL, /create policy|alter policy|drop policy/);
  assert.doesNotMatch(SQL, /grant\s+(select|insert|update|delete|all)\s/, "no table grant broadening");
  assert.doesNotMatch(SQL, /alter table[\s\S]*?enable row level security/);
  for (const forbidden of ["storage.", "document_files", "pdf_", "warranty", "certificate", "service_role_key", "supabase_admin_client"]) {
    assert.ok(!SQL.includes(forbidden), `forbidden surface must not appear: ${forbidden}`);
  }
});

test("20. the only INSERTs are the draft header and its lines; payments and receipts are untouched", () => {
  const inserts = SQL.match(/insert into public\.[a-z_]+/g) ?? [];
  assert.deepEqual(
    [...new Set(inserts)].sort(),
    ["insert into public.monthly_statement_lines", "insert into public.monthly_statements"],
  );
  assert.ok(!SQL.includes("monthly_statement_receipts"), "receipts remain issuance-owned");
  assert.ok(!SQL.includes("public.payments"), "payments are untouched by draft creation");
});
