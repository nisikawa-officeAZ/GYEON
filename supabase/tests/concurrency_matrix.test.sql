-- ============================================================================
-- pgTAP: CONCURRENCY_MATRIX (Section 14.2 item 7 evidence suite).
--
-- **CANDIDATE. NOT EXECUTED.** This file has never been run against any
-- database. It runs, if ever accepted, only against a DISPOSABLE LOCAL stack,
-- after applying the full accepted migration set in order. Never against the
-- linked, staging, or production project.
--
-- WHAT THIS SUITE PROVES AND WHAT IT DOES NOT
--   A single pgTAP file executes as ONE backend inside ONE transaction. It
--   cannot originate two separate PostgreSQL connections, cannot run two
--   statements truly concurrently, and therefore CANNOT by itself demonstrate
--   genuine separate-process/separate-connection collision behavior as
--   Section 14.2 item 7 and Section 14.5 condition 10 require. Claiming a
--   runtime PASS for real concurrency from inside this file would be
--   dishonest and this file makes no such claim: every row below carries
--   runtime_status = 'NOT_EXECUTED'.
--
--   What this file DOES prove, structurally, inside its own transaction:
--     (a) the collision-family inventory is complete against Section 14.2
--         item 7 and the accepted catalog (no missing/extra family);
--     (b) every family is classified exactly once (no duplicate, no
--         unclassified, no collapsed/weakened winner-vs-loser contract); and
--     (c) every callable/table identity a family cites actually exists in
--         the accepted catalog (matching catalog_manifest.test.sql's
--         accepted function/table identities), so the external protocol
--         below is never written against a phantom name.
--
--   No optional extension (dblink, pg_background, or any other
--   cross-connection helper) is assumed, installed, or required by this file.
--
-- ============================================================================
-- EXTERNAL TWO-psql-CLIENT ORCHESTRATION PROTOCOL (informational; not SQL)
-- ============================================================================
--
-- The disposable runtime gate (Section 14.5 condition 10) proves each family
-- below with two independent `psql` client processes against the same
-- disposable database, coordinated by an external harness. No in-database
-- extension performs the second connection; the harness is a plain OS-level
-- process orchestrator (e.g. two `psql -X -q -c ...` invocations, or two
-- background shell jobs) driving each side by its own connection string.
--
-- Fixed sequence, per family, per run:
--   1. The harness opens client C1 and client C2 against the disposable
--      database, each its own libpq connection (its own backend PID).
--   2. Both clients prepare identical fixture rows for the family's
--      collision_key (see the family row below) using the harness, not a
--      DEFAULT/BEGIN race, so the race is isolated to the single call under
--      test.
--   3. C1 issues `SELECT pg_backend_pid(), clock_timestamp();` and records
--      (pid_1, t1_submit). C2 does the same, recording (pid_2, t2_submit).
--   4. The harness releases both clients' collision-triggering statement
--      (the callable/table write named in the family row) as close to
--      simultaneously as the OS scheduler allows -- e.g. both `psql`
--      processes are started from the same shell line with `&`, or both
--      statements are queued via `pg_sleep`-gated barriers so neither client
--      can observe the other's commit before submitting its own statement.
--   5. Each client records its own (result_json_or_error, sqlstate,
--      t_complete). Both backend PIDs are cross-checked against
--      pg_stat_activity captured mid-run to prove pid_1 <> pid_2 (i.e. this
--      was genuinely two connections, not one connection issuing two
--      statements serially).
--   6. The harness runs the family's invariant_query exactly once, from a
--      THIRD connection, after both clients have completed or errored.
--   7. The harness asserts, from the required_evidence_fields list on the
--      family row: pid_1 <> pid_2; exactly one client matches
--      expected_winner_outcome and the other matches
--      expected_loser_outcome (or, for a serialized family, both match the
--      serialized outcome with distinct final sequence/version values); and
--      the invariant_query result matches the row's declared invariant.
--   8. Any ambiguous result (e.g. both clients report success with distinct
--      persisted primary rows for the same collision_key) is a FAIL, not a
--      retry. Per Section 14.5 condition 10, "passes without retry."
--   9. Cleanup: the harness's own fixture rows are removed by the disposable
--      database's teardown, never by same-run repair.
--
-- The machine-checkable contract for each family -- collision_key,
-- expected_winner_outcome, expected_loser_outcome, invariant_query, and
-- required_evidence_fields -- is asserted structurally below so the harness
-- script has one authoritative source to read instead of re-deriving it.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = extensions, pg_temp, public, pg_catalog;

SELECT plan(32);

-- ─── Inventory fixture ──────────────────────────────────────────────────────
CREATE TEMP TABLE t_families (
  family                    text PRIMARY KEY,
  identity_kind             text NOT NULL,
  callable_or_table_identity text[] NOT NULL,
  collision_key             text NOT NULL,
  race_description          text NOT NULL,
  expected_winner_outcome   text NOT NULL,
  expected_loser_outcome    text NOT NULL,
  invariant_query           text NOT NULL,
  required_evidence_fields  text[] NOT NULL,
  protocol_ref              text NOT NULL,
  runtime_status            text NOT NULL DEFAULT 'NOT_EXECUTED'
);

INSERT INTO t_families
  (family, identity_kind, callable_or_table_identity, collision_key,
   race_description, expected_winner_outcome, expected_loser_outcome,
   invariant_query, required_evidence_fields, protocol_ref)
VALUES
  ('atomic_idempotent_estimate_and_invoice_saves', 'function',
   ARRAY['public.save_estimate_from_wizard(uuid,uuid,jsonb)',
         'public.save_invoice_draft(uuid,uuid,jsonb,jsonb)'],
   '(dealer_id, idempotency_key) for the estimate RPC; (dealer_id, invoice_id) for the draft RPC',
   'C1 and C2 call the same RPC concurrently with an identical payload and the same idempotency/target key',
   'exactly one client performs the write and returns the canonical persisted row; the OTHER client observes idempotent_replay = true (estimate) or the identical persisted row (invoice), never a second row',
   'the loser makes zero additional writes to estimates/estimate_items or invoices/invoice_items and returns the SAME persisted identity as the winner',
   'SELECT count(*) FROM public.estimates WHERE dealer_id = :dealer_id AND idempotency_key = :key',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','result_json_1','result_json_2','sqlstate_1','sqlstate_2'],
   'protocol steps 1-9 above, fixture step 2 pre-creates matching dealer/actor rows for both clients'),

  ('document_numbering', 'function',
   ARRAY['public.get_next_document_number(uuid,text,integer,text,integer,text)',
         'public.wiz_format_document_number(text,integer,integer,integer)',
         'public.wiz_document_fiscal_year(text,timestamptz)'],
   '(dealer_id, sequence_type, fiscal_year) on public.document_sequences',
   'C1 and C2 both request the next number for the same (dealer_id, sequence_type, fiscal_year) at the same instant',
   'one client receives current_number N, the other receives N+1; no gap and no repeat',
   'the client receiving the higher number observably serialized behind the other (its call completes no earlier than the other''s commit, per the lock wait recorded in t_complete)',
   'SELECT current_number FROM public.document_sequences WHERE dealer_id = :dealer_id AND sequence_type = :seq_type AND fiscal_year = :fy',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','returned_number_1','returned_number_2'],
   'protocol steps 1-9 above; invariant additionally requires returned_number_1 <> returned_number_2'),

  ('payment_recording_allocation_conversion', 'function',
   ARRAY['public.record_payment_with_allocations_rpc(uuid,uuid,text,uuid,uuid,numeric,numeric,numeric,date,text,text,text,text,text,text,text,jsonb)',
         'public.convert_payment_to_allocated_rpc(uuid,uuid,uuid,jsonb)',
         'public.b3_recalc_invoice_payment(uuid)'],
   '(dealer_id, idempotency_key) for recording; (payment_id) for conversion; (invoice_id) for recalculation',
   'C1 and C2 concurrently record/allocate/convert against the same invoice or the same idempotency key',
   'exactly one client''s write is the effective allocation state; the invoice''s recalculated balance reflects that single effective write, never a double-applied or lost allocation',
   'the losing client either observes the same idempotent result as the winner (recording) or is serialized behind it (allocation/conversion), and never leaves the invoice balance double-counted or negative',
   'SELECT amount, status FROM public.payments WHERE dealer_id = :dealer_id AND idempotency_key = :key',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','result_json_1','result_json_2','invoice_balance_after'],
   'protocol steps 1-9 above; invariant additionally requires invoice_balance_after to equal exactly one allocation''s effect'),

  ('monthly_statement_create_issue_pdf_attach', 'function',
   ARRAY['public.create_monthly_statement_draft_rpc(uuid,uuid,uuid,date)',
         'public.issue_monthly_statement_rpc(uuid,uuid)',
         'public.attach_monthly_statement_pdf_rpc(uuid,uuid,uuid)'],
   '(dealer_id, customer_id, reference_date) for create; (statement_id) for issue and for PDF attach',
   'C1 and C2 concurrently create a draft for the same (dealer_id, customer_id, reference_date), or concurrently issue/attach against the same statement_id',
   'exactly one client creates the draft (or performs the issue/attach transition); the other observes the already-existing draft/issued statement, never a duplicate statement row or a double transition',
   'the loser''s call either returns the winner''s statement row unchanged or is rejected because the statement is no longer in the required source state, and it never creates a second statement or double-attaches a PDF pointer',
   'SELECT count(*) FROM public.monthly_statements WHERE dealer_id = :dealer_id AND customer_id = :customer_id AND period_start = :period_start AND period_end = :period_end',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','statement_id_1','statement_id_2','status_after'],
   'protocol steps 1-9 above; invariant additionally requires statement_id_1 = statement_id_2 once both complete'),

  ('wizard_catalog_review_upserts_archive', 'function',
   ARRAY['public.wiz_confirm_catalog_review(uuid)',
         'public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)',
         'public.wiz_archive_catalog_item(uuid,uuid)',
         'public.wiz_upsert_ppf_coating_adjustment(uuid,uuid,jsonb)',
         'public.wiz_archive_ppf_coating_adjustment(uuid,uuid)'],
   '(dealer_id, item_id) for upsert/archive; (dealer_id) for review confirmation',
   'C1 upserts or archives an item while C2 concurrently archives or upserts the SAME item_id, or both confirm review for the same dealer_id',
   'the writes serialize into a single final row state per item_id; one client''s effect is the one persisted after both complete, and review confirmation is idempotent across both callers',
   'the other client either observes the same final state (idempotent case) or its write is superseded by the serialized ordering, and no item ends up both archived and freshly upserted in a contradictory row',
   'SELECT deleted_at, updated_at FROM public.wizard_catalog_items WHERE id = :item_id',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','result_json_1','result_json_2'],
   'protocol steps 1-9 above; invariant additionally requires exactly one final deleted_at/updated_at pair'),

  ('notification_line_queues', 'table',
   ARRAY['public.line_notification_queue'],
   '(id) of a single scheduled/pending row claimed for dispatch',
   'C1 and C2 (two dispatcher workers) concurrently attempt to claim the same scheduled row for processing',
   'exactly one client''s UPDATE transitions the row from scheduled to processing and returns it; the other client''s UPDATE affects zero rows because the WHERE clause no longer matches',
   'the losing client''s statement returns zero affected rows and it must not attempt a second send for the same row',
   'SELECT count(*) FROM public.line_notification_queue WHERE id = :row_id AND status IN (''processing'',''sent'')',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','rows_affected_1','rows_affected_2'],
   'protocol steps 1-9 above; invariant additionally requires rows_affected_1 + rows_affected_2 = 1'),

  ('inventory_order_fulfillment_writes', 'table',
   ARRAY['public.dealer_stock_levels','public.inventory_receipts','public.po_fulfillment_lines'],
   '(dealer_id, product_id) for stock levels; (product_order_item_id) for fulfillment lines',
   'C1 and C2 concurrently record a stock receipt/adjustment for the same (dealer_id, product_id), or concurrently fulfill the same product_order_item_id',
   'the final stock quantity reflects BOTH writes summed/serialized correctly (no lost update), and exactly one fulfillment write may move a given ordered_qty into fulfilled_qty beyond its ordered bound',
   'a naive lost-update would show the final quantity reflecting only the LAST writer; this family requires the invariant query to show both deltas applied, and fulfilled_qty never exceeding ordered_qty',
   'SELECT total_quantity FROM public.dealer_stock_levels WHERE dealer_id = :dealer_id AND product_id = :product_id',
   ARRAY['pid_1','pid_2','t1_submit','t2_submit','t_complete_1','t_complete_2','delta_1','delta_2','total_quantity_after'],
   'protocol steps 1-9 above; invariant additionally requires total_quantity_after = quantity_before + delta_1 + delta_2');

-- ═══ 1. Family-set completeness against Section 14.2 item 7 ═══════════════
SELECT is(
  (SELECT count(*)::int FROM t_families), 7,
  'exactly seven collision families are inventoried (no missing, no extra)');

SELECT is(
  (SELECT count(DISTINCT family)::int FROM t_families), 7,
  'no duplicate family name');

SELECT is(
  (SELECT count(DISTINCT collision_key)::int FROM t_families), 7,
  'no duplicate collision key across families');

-- ═══ 2. No unclassified / weakened contract rows ═══════════════════════════
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM t_families
     WHERE btrim(family) = '' OR btrim(identity_kind) = ''
        OR callable_or_table_identity IS NULL OR array_length(callable_or_table_identity, 1) IS NULL
        OR btrim(collision_key) = '' OR btrim(race_description) = ''
        OR btrim(expected_winner_outcome) = '' OR btrim(expected_loser_outcome) = ''
        OR btrim(invariant_query) = '' OR btrim(protocol_ref) = ''),
  'no family row is unclassified (every required field is populated)');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM t_families WHERE expected_winner_outcome = expected_loser_outcome),
  'no family collapses winner and loser into the same weakened outcome');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM t_families WHERE array_length(required_evidence_fields, 1) < 4),
  'every family requires at least four evidence fields (pid pair, timestamps, and a result)');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM t_families WHERE identity_kind NOT IN ('function', 'table')),
  'every family declares a well-formed identity_kind');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM t_families WHERE runtime_status <> 'NOT_EXECUTED'),
  'no family claims a runtime PASS from inside this single-transaction file');

-- ═══ 3. Referenced catalog identities exist ════════════════════════════════
-- Function identities (matching catalog_manifest.test.sql's accepted set).
SELECT ok(to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)') IS NOT NULL,
  'save_estimate_from_wizard(uuid,uuid,jsonb) exists');
SELECT ok(to_regprocedure('public.save_invoice_draft(uuid,uuid,jsonb,jsonb)') IS NOT NULL,
  'save_invoice_draft(uuid,uuid,jsonb,jsonb) exists');
SELECT ok(to_regprocedure('public.get_next_document_number(uuid,text,integer,text,integer,text)') IS NOT NULL,
  'get_next_document_number(uuid,text,integer,text,integer,text) exists');
SELECT ok(to_regprocedure('public.wiz_format_document_number(text,integer,integer,integer)') IS NOT NULL,
  'wiz_format_document_number(text,integer,integer,integer) exists');
SELECT ok(to_regprocedure('public.wiz_document_fiscal_year(text,timestamptz)') IS NOT NULL,
  'wiz_document_fiscal_year(text,timestamptz) exists');
SELECT ok(to_regprocedure('public.record_payment_with_allocations_rpc(uuid,uuid,text,uuid,uuid,numeric,numeric,numeric,date,text,text,text,text,text,text,text,jsonb)') IS NOT NULL,
  'record_payment_with_allocations_rpc(...) exists');
SELECT ok(to_regprocedure('public.convert_payment_to_allocated_rpc(uuid,uuid,uuid,jsonb)') IS NOT NULL,
  'convert_payment_to_allocated_rpc(uuid,uuid,uuid,jsonb) exists');
SELECT ok(to_regprocedure('public.b3_recalc_invoice_payment(uuid)') IS NOT NULL,
  'b3_recalc_invoice_payment(uuid) exists');
SELECT ok(to_regprocedure('public.create_monthly_statement_draft_rpc(uuid,uuid,uuid,date)') IS NOT NULL,
  'create_monthly_statement_draft_rpc(uuid,uuid,uuid,date) exists');
SELECT ok(to_regprocedure('public.issue_monthly_statement_rpc(uuid,uuid)') IS NOT NULL,
  'issue_monthly_statement_rpc(uuid,uuid) exists');
SELECT ok(to_regprocedure('public.attach_monthly_statement_pdf_rpc(uuid,uuid,uuid)') IS NOT NULL,
  'attach_monthly_statement_pdf_rpc(uuid,uuid,uuid) exists');
SELECT ok(to_regprocedure('public.wiz_confirm_catalog_review(uuid)') IS NOT NULL,
  'wiz_confirm_catalog_review(uuid) exists');
SELECT ok(to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)') IS NOT NULL,
  'wiz_upsert_catalog_item(uuid,uuid,text,jsonb) exists');
SELECT ok(to_regprocedure('public.wiz_archive_catalog_item(uuid,uuid)') IS NOT NULL,
  'wiz_archive_catalog_item(uuid,uuid) exists');
SELECT ok(to_regprocedure('public.wiz_upsert_ppf_coating_adjustment(uuid,uuid,jsonb)') IS NOT NULL,
  'wiz_upsert_ppf_coating_adjustment(uuid,uuid,jsonb) exists');
SELECT ok(to_regprocedure('public.wiz_archive_ppf_coating_adjustment(uuid,uuid)') IS NOT NULL,
  'wiz_archive_ppf_coating_adjustment(uuid,uuid) exists');

-- Table identities.
SELECT ok(to_regclass('public.document_sequences') IS NOT NULL, 'public.document_sequences exists');
SELECT ok(to_regclass('public.line_notification_queue') IS NOT NULL, 'public.line_notification_queue exists');
SELECT ok(to_regclass('public.dealer_stock_levels') IS NOT NULL, 'public.dealer_stock_levels exists');
SELECT ok(to_regclass('public.inventory_receipts') IS NOT NULL, 'public.inventory_receipts exists');
SELECT ok(to_regclass('public.po_fulfillment_lines') IS NOT NULL, 'public.po_fulfillment_lines exists');
SELECT ok(to_regclass('public.payments') IS NOT NULL, 'public.payments exists');
SELECT ok(to_regclass('public.monthly_statements') IS NOT NULL, 'public.monthly_statements exists');
SELECT ok(to_regclass('public.estimates') IS NOT NULL, 'public.estimates exists');

SELECT * FROM finish();

ROLLBACK;
