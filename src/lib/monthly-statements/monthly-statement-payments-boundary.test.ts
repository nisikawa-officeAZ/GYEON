// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — source-scan boundary test.
//
// Static assertions over the B3 migration and the issuance server action. It proves the CONTRACT is
// present in source; executable PostgreSQL behavior and concurrency are reserved for B3-V1. Comments are
// stripped first so every assertion anchors on real SQL/TypeScript, never on comment prose.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-statement-payments-boundary.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIG_DIR = "supabase/migrations";
const MIG_FILE = readdirSync(MIG_DIR).find((f) => f.endsWith("_payment_allocations_receipts_adjustments.sql"));
assert.ok(MIG_FILE, "the B3 migration file must exist");

function stripSql(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");
}
const RAW = readFileSync(`${MIG_DIR}/${MIG_FILE}`, "utf8");
const SQL = stripSql(RAW).toLowerCase();

const ACTION = readFileSync("src/lib/monthly-statements/issue-monthly-statement.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// The (comment-stripped, lowercased) body of one `create or replace function ... $$;` definition.
function fnBody(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}`);
  if (start < 0) return "";
  const end = SQL.indexOf("$$;", start);
  return end < 0 ? SQL.slice(start) : SQL.slice(start, end);
}

test("1. payments invoice_id becomes nullable and its FK is RESTRICT (never CASCADE)", () => {
  assert.match(SQL, /alter column invoice_id drop not null/);
  assert.match(SQL, /payments_invoice_id_fkey[\s\S]*?on delete restrict/);
  assert.match(SQL, /foreign key \(invoice_id\) references public\.invoices\(id\) on delete restrict/);
});

test("2. completed-payment payment_date constraint exists and is NOT VALID", () => {
  assert.match(SQL, /payments_completed_requires_payment_date/);
  assert.match(SQL, /check \(status <> 'completed' or payment_date is not null\) not valid/);
});

test("3. null-invoice payments require a customer (mode integrity)", () => {
  assert.match(SQL, /payments_null_invoice_requires_customer/);
  assert.match(SQL, /check \(invoice_id is not null or customer_id is not null\)/);
});

test("4. the old public-role FOR ALL payments policy is dropped and 4 finance policies replace it", () => {
  assert.match(SQL, /drop policy if exists "dealer members can manage their payments" on public\.payments/);
  for (const p of ["payments_select", "payments_insert", "payments_update", "payments_delete"]) {
    assert.match(SQL, new RegExp(`create policy ${p} on public\\.payments`), p);
  }
  // UPDATE policy carries both USING and WITH CHECK (the update block contains a with check clause).
  assert.match(SQL, /create policy payments_update on public\.payments[\s\S]*?using \([\s\S]*?with check \(/);
});

test("5. monthly_statement_receipts is system-owned: authenticated SELECT-only, no write policy/grant", () => {
  assert.match(SQL, /grant select on public\.monthly_statement_receipts to authenticated/);
  assert.doesNotMatch(SQL, /grant[^;]*\b(insert|update|delete)\b[^;]*on public\.monthly_statement_receipts to authenticated/);
  assert.match(SQL, /create policy monthly_statement_receipts_select on public\.monthly_statement_receipts/);
  for (const cmd of ["insert", "update", "delete"]) {
    assert.doesNotMatch(SQL, new RegExp(`create policy monthly_statement_receipts_${cmd}`), `no ${cmd} policy`);
  }
  // Service role is the only writer.
  assert.match(SQL, /grant select, insert, update, delete on public\.monthly_statement_receipts to service_role/);
});

test("6. UNIQUE(statement_id, payment_id) and the active-membership guard both exist", () => {
  assert.match(SQL, /unique \(statement_id, payment_id\)/);
  assert.match(SQL, /monthly_statement_receipt_payment_already_active/);
});

test("7. receipt snapshots are immutable and created only while the parent is draft", () => {
  assert.match(SQL, /monthly_statement_receipt_immutable/);          // UPDATE/DELETE rejected
  assert.match(SQL, /monthly_statement_receipt_parent_not_draft/);   // INSERT only while draft
});

test("8. post-issuance allocation lifecycle: INSERT-only, UPDATE/DELETE locked by issued statement", () => {
  assert.match(SQL, /payment_allocation_locked_by_issued_statement/);
  assert.match(SQL, /payment_allocation_exceeds_payment_amount/);
  assert.match(SQL, /payment_allocation_exceeds_invoice_balance/);
  assert.match(SQL, /payment_allocation_payment_is_legacy_direct/); // allocated-mode requires null invoice_id
});

test("9. the closing formula is receipt-based and reconciliation is enforced", () => {
  assert.match(SQL, /new\.opening_balance \+ new\.current_total - new\.payments_received_total \+ new\.adjustments_total/);
  assert.match(SQL, /monthly_statement_reconciliation_mismatch/);
  assert.match(SQL, /monthly_statement_receipts_total_mismatch/);
  assert.match(SQL, /add column if not exists payments_received_total/);
  assert.match(SQL, /add column if not exists unapplied_credit_total/);
});

test("10. the payment mutation guard freezes payments captured by an issued statement", () => {
  assert.match(SQL, /payment_locked_by_issued_statement/);
  assert.match(SQL, /enforce_payment_not_in_issued_statement/);
});

test("11. the issuance RPC is SECURITY INVOKER, service_role-only EXECUTE, no SECURITY DEFINER", () => {
  assert.match(SQL, /create or replace function public\.issue_monthly_statement_rpc\(p_statement_id uuid, p_issued_by uuid\)/);
  assert.match(SQL, /revoke execute on function public\.issue_monthly_statement_rpc\(uuid, uuid\) from anon, authenticated/);
  assert.match(SQL, /grant\s+execute on function public\.issue_monthly_statement_rpc\(uuid, uuid\) to service_role/);
  assert.doesNotMatch(SQL, /security definer/);
});

test("12. every new PL/pgSQL function pins an empty search_path", () => {
  // Each `language plpgsql` function body sets an empty search_path; none omits it.
  const fns = (SQL.match(/language plpgsql/g) ?? []).length;
  const pinned = (SQL.match(/set search_path = ''/g) ?? []).length;
  assert.ok(fns >= 6, `expected the new + replaced functions (got ${fns})`);
  assert.ok(pinned >= fns, `every plpgsql function must pin search_path (fns=${fns} pinned=${pinned})`);
});

test("13. the server action makes exactly one issuance RPC call and no direct financial DML", () => {
  const rpcCalls = (ACTION.match(/\.rpc\(\s*["']issue_monthly_statement_rpc["']/g) ?? []).length;
  assert.equal(rpcCalls, 1, "exactly one issuance RPC call");
  assert.doesNotMatch(ACTION, /\.insert\(/, "no direct INSERT from the action");
  assert.doesNotMatch(ACTION, /\.update\(/, "no direct UPDATE from the action");
  assert.doesNotMatch(ACTION, /\.delete\(/, "no direct DELETE from the action");
  assert.match(ACTION, /createAdminClient\(\)/, "uses the service-role admin client");
  assert.match(ACTION, /requireStaffCapability\("finance"\)/, "verifies finance capability first");
});

test("14. the frozen LINE migration is never referenced by the B3 migration", () => {
  assert.doesNotMatch(SQL, /line_link_tokens/);
  assert.doesNotMatch(SQL, /20260801110110/);
});

// ── B3-B1A-R1: locking + snapshot-integrity repairs ─────────────────────────────────────────────────

test("15. issuance locks eligible payments (deterministic id order) BEFORE the receipt INSERT", () => {
  const lockIdx = SQL.indexOf("where id = v_pay_id for update");
  const insertIdx = SQL.indexOf("insert into public.monthly_statement_receipts (");
  assert.ok(lockIdx >= 0, "the eligible-payment FOR UPDATE lock loop exists");
  assert.ok(insertIdx >= 0, "the receipt snapshot INSERT exists");
  assert.ok(lockIdx < insertIdx, "the eligible-payment lock loop must precede the receipt INSERT");
  // deterministic payment-id ordering in BOTH the lock select and the snapshot INSERT
  assert.ok((SQL.match(/order by p\.id/g) ?? []).length >= 2, "lock select and snapshot INSERT order by p.id");
});

test("16. allocation DELETE locks OLD.payment_id; UPDATE checks OLD+NEW membership; identity is immutable", () => {
  assert.match(SQL, /perform 1 from public\.payments where id = old\.payment_id for update/);
  assert.match(SQL, /r\.payment_id in \(old\.payment_id, new\.payment_id\)/);
  assert.match(SQL, /payment_allocation_identity_immutable/);
  // deterministic locking of the (old,new) payment ids
  assert.match(SQL, /if old\.payment_id <= new\.payment_id then/);
});

test("17. receipt trigger re-validates authoritative payment identity, amount, period, and split", () => {
  for (const msg of [
    "monthly_statement_receipt_payment_not_found",
    "monthly_statement_receipt_payment_not_completed",
    "monthly_statement_receipt_dealer_mismatch",
    "monthly_statement_receipt_customer_mismatch",
    "monthly_statement_receipt_payment_date_mismatch",
    "monthly_statement_receipt_outside_period",
    "monthly_statement_receipt_identity_mismatch",
    "monthly_statement_receipt_split_mismatch",
  ]) {
    assert.ok(SQL.includes(msg), msg);
  }
  // the split is DERIVED from the persisted allocations under the payment lock, not trusted from input
  assert.match(SQL, /from public\.payments where id = new\.payment_id for update/);
  assert.match(SQL, /select coalesce\(sum\(allocated_amount\), 0\) into v_alloc/);
});

test("18. issued-payment guard freezes tenant + receipt identity; allocations lock tenant/status", () => {
  for (const f of ["dealer_id", "customer_id", "payment_number", "payment_method", "reference_no"]) {
    assert.match(SQL, new RegExp(`new\\.${f}\\s+is distinct from old\\.${f}`), `guard freezes ${f}`);
  }
  assert.match(SQL, /payment_tenant_locked_by_allocations/);
  assert.match(SQL, /payment_status_locked_by_allocations/);
});

test("19. payment allocations require a completed payment", () => {
  assert.match(SQL, /payment_allocation_payment_not_completed/);
  assert.match(SQL, /if v_pay_status <> 'completed' then/);
});

// ── B3-B1A-R2: atomic payment-mutation RPCs + payment-level idempotency ──────────────────────────────

test("20. both atomic payment-mutation RPCs exist, SECURITY INVOKER, empty search_path, no DEFINER", () => {
  for (const fn of ["record_payment_with_allocations_rpc", "convert_payment_to_allocated_rpc"]) {
    const body = fnBody(fn);
    assert.ok(body.length > 0, `${fn} exists`);
    assert.match(body, /set search_path = ''/, `${fn} pins empty search_path`);
    assert.doesNotMatch(body, /security definer/, `${fn} is not SECURITY DEFINER`);
  }
});

test("21. explicit EXECUTE restrictions on both RPCs (revoke public/anon, grant finance roles)", () => {
  for (const fn of ["record_payment_with_allocations_rpc", "convert_payment_to_allocated_rpc"]) {
    assert.match(SQL, new RegExp(`revoke all\\s+on function public\\.${fn}\\(`), `${fn} revoke all from public`);
    assert.match(SQL, new RegExp(`revoke execute on function public\\.${fn}\\([^;]*\\) from anon`), `${fn} revoke anon`);
    assert.match(SQL, new RegExp(`grant\\s+execute on function public\\.${fn}\\([^;]*\\) to authenticated, service_role`), `${fn} grant`);
    // finance authorization is enforced in-function.
    assert.match(fnBody(fn), /payment_rpc_not_finance_authorized/, `${fn} enforces finance auth`);
  }
});

test("22. payment-level per-dealer idempotency exists", () => {
  assert.match(SQL, /alter table public\.payments add column if not exists idempotency_key text/);
  assert.match(SQL, /create unique index if not exists payments_idempotency_uidx\s+on public\.payments \(dealer_id, idempotency_key\) where idempotency_key is not null/);
  assert.match(SQL, /payment_idempotency_conflict/);
});

test("23. the recording RPC inserts the payment + allocations, locks invoices, and recalculates", () => {
  const body = fnBody("record_payment_with_allocations_rpc");
  assert.match(body, /insert into public\.payments \(/, "inserts the payment");
  assert.match(body, /insert into public\.payment_allocations \(/, "inserts allocations");
  assert.match(body, /from public\.invoices where id = v_inv_id for update/, "locks affected invoices");
  assert.match(body, /order by 1/, "deterministic invoice locking order");
  assert.match(body, /perform public\.b3_recalc_invoice_payment\(/, "recalculates affected invoices");
});

test("24. the conversion RPC locks payment + invoices, sets invoice_id null, inserts allocations in one fn", () => {
  const body = fnBody("convert_payment_to_allocated_rpc");
  assert.match(body, /from public\.payments where id = p_payment_id and dealer_id = p_dealer_id for update/, "locks the payment");
  assert.match(body, /from public\.invoices where id = v_inv_id for update/, "locks affected invoices before mutation");
  assert.match(body, /update public\.payments set invoice_id = null/, "drops the direct link");
  assert.match(body, /insert into public\.payment_allocations \(/, "inserts the allocation set");
  assert.match(body, /payment_rpc_conversion_missing_original_invoice/, "requires a positive allocation back to the original invoice");
  assert.match(body, /perform public\.b3_recalc_invoice_payment\(/, "recalculates affected invoices");
});

test("25. neither payment-mutation RPC WRITES monthly_statement_receipts (snapshots stay issuance-only)", () => {
  // A read is allowed (convert reads receipts to reject a payment frozen by an issued statement); only
  // INSERT/UPDATE/DELETE of receipts is forbidden — receipt snapshots are created only during issuance.
  for (const fn of ["record_payment_with_allocations_rpc", "convert_payment_to_allocated_rpc"]) {
    const body = fnBody(fn);
    assert.doesNotMatch(body, /insert into public\.monthly_statement_receipts/, `${fn} must not insert receipts`);
    assert.doesNotMatch(body, /update public\.monthly_statement_receipts/, `${fn} must not update receipts`);
    assert.doesNotMatch(body, /delete from public\.monthly_statement_receipts/, `${fn} must not delete receipts`);
  }
});

// ── B3-B1A-R3: tenant, actor, idempotency, numeric, and direct-payment-cap repairs ──────────────────

test("26. allocated/unapplied load + dealer-check the customer from public.customers; legacy from invoice", () => {
  const rec = fnBody("record_payment_with_allocations_rpc");
  assert.match(rec, /select dealer_id into v_cust_dealer from public\.customers where id = p_customer_id for update/);
  assert.match(rec, /payment_rpc_customer_not_found/);
  assert.match(rec, /payment_rpc_invoice_missing_customer/);
});

test("27. both RPCs resolve a trusted actor and use it (not raw p_actor) for created_by", () => {
  for (const fn of ["record_payment_with_allocations_rpc", "convert_payment_to_allocated_rpc"]) {
    const body = fnBody(fn);
    assert.match(body, /v_actor := \(select auth\.uid\(\)\)/, `${fn} derives actor from auth.uid()`);
    assert.match(body, /payment_rpc_actor_mismatch/, `${fn} rejects a non-matching p_actor`);
    assert.match(body, /and ds\.user_id = v_actor/, `${fn} authorizes the RESOLVED actor`);
    assert.match(body, /v_rec\.ord, v_actor\)/, `${fn} uses v_actor for created_by`);
  }
  assert.doesNotMatch(SQL, /v_rec\.ord, p_actor\)/, "no allocation insert persists the raw p_actor");
});

test("28. the idempotency fingerprint is canonical JSONB over all fields + the sorted allocation set", () => {
  const rec = fnBody("record_payment_with_allocations_rpc");
  assert.match(rec, /payment_rpc_idempotency_key_required/);
  assert.match(rec, /idempotency_fingerprint/);
  assert.match(rec, /pg_catalog\.md5\(\(jsonb_build_object\(/, "canonical JSONB fingerprint, not delimiter concat");
  assert.match(rec, /'customer',\s*v_customer/, "fingerprint uses the resolved customer");
  assert.match(rec, /'net',\s*pg_catalog\.trim_scale\(v_net\)/, "fingerprint uses the server-derived, scale-normalized net");
  assert.match(rec, /'allocations', v_alloc_json/, "fingerprint uses the canonically sorted allocation set");
  assert.match(rec, /v_existing\.idempotency_fingerprint is distinct from v_fp/, "retry compares the full fingerprint");
  assert.match(SQL, /payment_idempotency_conflict/);
  assert.doesNotMatch(rec, /v_alloc_canon/, "no delimiter-concatenation fingerprint remains");
});

test("29. concurrent same-(dealer,key) first use is serialized (advisory lock) with a winner reload", () => {
  const rec = fnBody("record_payment_with_allocations_rpc");
  assert.match(rec, /pg_catalog\.pg_advisory_xact_lock\(/, "advisory lock serializes concurrent first use");
  assert.match(rec, /pg_catalog\.hashtextextended\(p_dealer_id::text \|\| '\|' \|\| p_idempotency_key/, "keyed by dealer+key");
  assert.match(rec, /where dealer_id = p_dealer_id and idempotency_key = p_idempotency_key for update/, "winner reload");
});

test("30. amount>0, fee finite/nonneg/<=amount, net server-derived (p_net_amount not trusted)", () => {
  const rec = fnBody("record_payment_with_allocations_rpc");
  assert.match(rec, /p_amount <= 0 or p_amount >= 'infinity'::numeric/);
  assert.match(rec, /payment_rpc_invalid_fee/);
  assert.match(rec, /v_fee > p_amount/);
  assert.match(rec, /v_net := p_amount - v_fee/, "net is derived in the DB");
  assert.match(rec, /payment_rpc_invalid_allocation/, "allocation values validated before mutation");
  assert.doesNotMatch(rec, /coalesce\(p_net_amount/, "the caller-supplied net amount is never used");
});

test("31. a DB-boundary trigger caps completed legacy-direct payments at the invoice total (INSERT+UPDATE)", () => {
  assert.match(SQL, /create or replace function public\.enforce_payment_direct_invoice_cap\(\)/);
  assert.match(SQL, /before insert or update on public\.payments\s+for each row execute function public\.enforce_payment_direct_invoice_cap\(\)/);
  const cap = fnBody("enforce_payment_direct_invoice_cap");
  assert.match(cap, /from public\.invoices where id = new\.invoice_id for update/, "locks the invoice before the cap check");
  assert.match(cap, /status = 'completed' and id <> new\.id/, "excludes the current row on UPDATE");
  assert.match(cap, /payment_direct_exceeds_invoice_total/, "overpayment must use allocated/unapplied credit");
  assert.match(cap, /payment_direct_invoice_not_found/, "missing/invisible invoice fails closed (not fail-open)");
});

test("32. conversion is retry-safe against the PERSISTED conversion fingerprint (not current allocations)", () => {
  const conv = fnBody("convert_payment_to_allocated_rpc");
  assert.match(conv, /if v_pay\.invoice_id is null then/, "detects an already-converted payment");
  assert.match(conv, /v_pay\.conversion_fingerprint is not distinct from v_conv_fp/, "compares the persisted fingerprint");
  assert.match(conv, /payment_rpc_conversion_conflict/, "materially different retry fails closed");
  assert.match(conv, /conversion_fingerprint = v_conv_fp/, "the conversion persists an immutable fingerprint");
  assert.doesNotMatch(conv, /v_existing_canon/, "does not compare the mutable allocation collection");
});

// ── B3-B1A-R4: raw-write tenant/numeric integrity + stable idempotency/conversion fingerprints ───────

test("33. the authoritative scope guard rejects missing/invisible/cross-dealer invoices for raw writes", () => {
  assert.match(SQL, /create or replace function public\.enforce_payment_authoritative_scope\(\)/);
  assert.match(SQL, /before insert or update on public\.payments\s+for each row execute function public\.enforce_payment_authoritative_scope\(\)/);
  const g = fnBody("enforce_payment_authoritative_scope");
  assert.match(g, /from public\.invoices where id = new\.invoice_id for update/, "locks the invoice");
  assert.match(g, /if not found or v_inv_dealer is distinct from new\.dealer_id then/, "fail closed on missing/cross-dealer");
  assert.match(g, /payment_invoice_tenant_violation/);
  assert.match(g, /payment_invoice_missing_customer/);
});

test("34. the scope guard loads + dealer-checks the customer for invoice-less raw writes", () => {
  const g = fnBody("enforce_payment_authoritative_scope");
  assert.match(g, /from public\.customers where id = new\.customer_id for update/, "locks the customer");
  assert.match(g, /if not found or v_cust_dealer is distinct from new\.dealer_id then/, "fail closed on missing/cross-dealer");
  assert.match(g, /payment_customer_tenant_violation/);
  assert.match(g, /payment_requires_customer/);
});

test("35. the scope guard enforces amount/fee/net integrity on raw writes", () => {
  const g = fnBody("enforce_payment_authoritative_scope");
  assert.match(g, /new\.amount <= 0 or new\.amount >= 'infinity'::numeric/);
  assert.match(g, /new\.fee_amount > new\.amount/);
  assert.match(g, /new\.net_amount is distinct from new\.amount - new\.fee_amount/);
  for (const m of ["payment_invalid_amount", "payment_invalid_fee", "payment_invalid_net"]) {
    assert.ok(SQL.includes(m), m);
  }
});

test("36. canonical fingerprint normalizes numerics (trim_scale) and is delimiter-injection-safe (JSONB)", () => {
  const rec = fnBody("record_payment_with_allocations_rpc");
  assert.match(rec, /'amount',\s*pg_catalog\.trim_scale\(p_amount\)/, "amount scale-normalized (10 == 10.00)");
  assert.match(rec, /pg_catalog\.trim_scale\(\(e->>'allocated_amount'\)::numeric\)/, "allocation amounts scale-normalized");
  assert.match(rec, /pg_catalog\.md5\(\(jsonb_build_object\(/, "the fingerprint md5 input is canonical JSONB (injection-safe)");
  assert.doesNotMatch(rec, /v_alloc_canon/, "no delimiter-concatenated fingerprint remains");
});

test("37. direct UPDATE cannot mutate record or conversion idempotency metadata", () => {
  const g = fnBody("enforce_payment_authoritative_scope");
  assert.match(g, /new\.idempotency_key is distinct from old\.idempotency_key/);
  assert.match(g, /new\.idempotency_fingerprint is distinct from old\.idempotency_fingerprint/);
  assert.match(g, /payment_idempotency_metadata_immutable/);
  // once set, the conversion fingerprint cannot be changed or cleared (init detail is in test 39)
  assert.match(g, /payment_conversion_fingerprint_immutable/);
});

test("38. conversion retry compares the immutable persisted fingerprint, unaffected by later allocations", () => {
  const conv = fnBody("convert_payment_to_allocated_rpc");
  assert.match(conv, /v_pay\.conversion_fingerprint is not distinct from v_conv_fp/, "compares the persisted fingerprint");
  assert.doesNotMatch(conv, /from public\.payment_allocations a where a\.payment_id = v_pay\.id/,
    "the retry compare does NOT read the current, mutable allocation collection");
  const g = fnBody("enforce_payment_authoritative_scope");
  assert.match(g, /payment_conversion_fingerprint_immutable/, "the persisted fingerprint cannot be mutated later");
});

test("39. conversion_fingerprint initializes ONLY on a real direct→allocated transition, then is frozen", () => {
  const g = fnBody("enforce_payment_authoritative_scope");
  // INSERT must reject any non-null conversion_fingerprint
  assert.match(g, /tg_op = 'insert' and new\.conversion_fingerprint is not null/);
  assert.match(g, /payment_conversion_fingerprint_invalid_init/);
  // a null→value initialization is permitted ONLY when old.invoice_id is non-null and new.invoice_id is null
  assert.match(g, /not \(old\.invoice_id is not null and new\.invoice_id is null\)/);
  // once non-null, any change or clear is rejected
  assert.match(g, /new\.conversion_fingerprint is distinct from old\.conversion_fingerprint/);
  assert.match(g, /payment_conversion_fingerprint_immutable/);
  // the conversion RPC still performs the permitted transition (sets the fingerprint in the SAME UPDATE
  // that changes invoice_id from the original invoice to null)
  const conv = fnBody("convert_payment_to_allocated_rpc");
  assert.match(conv, /update public\.payments set invoice_id = null, customer_id = v_customer,\s*conversion_fingerprint = v_conv_fp/);
});
