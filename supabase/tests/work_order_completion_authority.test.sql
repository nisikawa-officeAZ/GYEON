-- ============================================================================
-- GDA-1W-C3 — DISPOSABLE-DB pgTAP candidate for
--             supabase/migrations/20260810070811_work_order_completion_authority.sql
--
-- STATUS: SOURCE CANDIDATE — WRITTEN ONLY. Execution belongs to the separately
--         authorized disposable-database verification phase (contract §10.2)
--         and must NEVER run against the linked, staging, or production stack.
--
-- Run (future authorized phase, disposable stack only):
--   psql "$DISPOSABLE_DB_URL" -f supabase/tests/work_order_completion_authority.test.sql
--
-- Everything runs in ONE transaction and rolls back. The separate-connection
-- concurrency evidence is intentionally NOT here — one session cannot prove a
-- concurrency claim (§10.2); scripts/e2e/gda-1w-completion/* owns that.
--
-- Shared TS↔PG fingerprint vectors: the canonical JSON literals below are
-- copied VERBATIM from src/lib/work-orders/work-order-completion-contract-core.test.ts.
-- Changing either side without the other is a contract break.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT no_plan();

-- ─── Impersonation helpers ───────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE OR REPLACE FUNCTION tests.authenticate_without_uid() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE OR REPLACE FUNCTION tests.as_postgres() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

GRANT USAGE ON SCHEMA tests TO authenticated;
GRANT USAGE ON SCHEMA tests TO anon, service_role;
-- ─── Fixture identifiers ─────────────────────────────────────────────────────
-- u_staff    : dealer_staff active 'staff' in d1, NO dealer_members row
--              (the §5.6/§10.2 staff-only end-to-end actor).
-- u_blocked  : dealer_staff DISABLED in d1 + ACTIVE dealer_members 'owner'
--              (proves the blocking row never falls back).
-- u_member   : active dealer_members 'manager' in d1, no staff row.
-- u_owner    : dealers.owner_user_id of d1, no staff row, no member row.
-- u_readonly : active dealer_members 'readonly' in d1 only.
-- u_foreign  : active member of d2 only (cross-dealer denial + RLS isolation).

\set d1        '11111111-0000-4000-8000-000000000001'
\set d2        '11111111-0000-4000-8000-000000000002'
\set u_staff   '22222222-0000-4000-8000-000000000001'
\set u_blocked '22222222-0000-4000-8000-000000000002'
\set u_member  '22222222-0000-4000-8000-000000000003'
\set u_owner   '22222222-0000-4000-8000-000000000004'
\set u_readonly '22222222-0000-4000-8000-000000000005'
\set u_foreign '22222222-0000-4000-8000-000000000006'
\set u_invited '22222222-0000-4000-8000-000000000007'
\set cust1     '33333333-0000-4000-8000-000000000001'
\set veh1      '44444444-0000-4000-8000-000000000001'
\set wo_staff  '55555555-0000-4000-8000-000000000001'
\set wo_member '55555555-0000-4000-8000-000000000002'
\set wo_owner  '55555555-0000-4000-8000-000000000003'
\set wo_cancel '55555555-0000-4000-8000-000000000004'
\set wo_legacy '55555555-0000-4000-8000-000000000005'
\set wo_nocust '55555555-0000-4000-8000-000000000006'
\set wo_orphan '55555555-0000-4000-8000-000000000007'
\set wo_fault_alloc   '55555555-0000-4000-8000-000000000008'
\set wo_fault_report  '55555555-0000-4000-8000-000000000009'
\set wo_fault_item    '55555555-0000-4000-8000-000000000010'
\set wo_fault_request '55555555-0000-4000-8000-000000000011'
\set wo_sidefx  '55555555-0000-4000-8000-000000000012'
\set rep_legacy '66666666-0000-4000-8000-000000000001'

-- ─── Fixtures (as postgres; guard flag used ONLY to seed the legacy row) ─────
DO $fixtures$
BEGIN
  -- Minimal auth users for FK targets. Disposable-stack auth.users accepts a
  -- minimal insert; adjust instance columns there if the local schema differs.
  INSERT INTO auth.users (id, email)
  VALUES
    ('22222222-0000-4000-8000-000000000001', 'staff@test.local'),
    ('22222222-0000-4000-8000-000000000002', 'blocked@test.local'),
    ('22222222-0000-4000-8000-000000000003', 'member@test.local'),
    ('22222222-0000-4000-8000-000000000004', 'owner@test.local'),
    ('22222222-0000-4000-8000-000000000005', 'readonly@test.local'),
    ('22222222-0000-4000-8000-000000000006', 'foreign@test.local'),
    ('22222222-0000-4000-8000-000000000007', 'invited@test.local');

  INSERT INTO public.dealers (id, name, owner_user_id)
  VALUES
    ('11111111-0000-4000-8000-000000000001', 'GDA Test Dealer 1',
     '22222222-0000-4000-8000-000000000004'),
    ('11111111-0000-4000-8000-000000000002', 'GDA Test Dealer 2', NULL);

  INSERT INTO public.dealer_staff (dealer_id, user_id, role, status) VALUES
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'staff', 'active'),
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', 'staff', 'disabled'),
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000007', 'manager', 'invited');

  INSERT INTO public.dealer_members (dealer_id, user_id, role, status) VALUES
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', 'owner',    'active'),
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000007', 'owner',    'active'),
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000003', 'manager',  'active'),
    ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000005', 'readonly', 'active'),
    ('11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000006', 'owner',    'active');

  INSERT INTO public.customers (id, dealer_id, name)
  VALUES ('33333333-0000-4000-8000-000000000001',
          '11111111-0000-4000-8000-000000000001', 'テスト顧客');

  INSERT INTO public.vehicles (id, dealer_id, customer_id, maker, model)
  VALUES ('44444444-0000-4000-8000-000000000001',
          '11111111-0000-4000-8000-000000000001',
          '33333333-0000-4000-8000-000000000001', 'Toyota', 'Prius');

  INSERT INTO public.work_orders
    (id, dealer_id, customer_id, vehicle_id, status, actual_start_at)
  VALUES
    ('55555555-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'in_progress', now() - interval '2 hours'),
    ('55555555-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'scheduled', NULL),
    ('55555555-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'on_hold', NULL),
    ('55555555-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'cancelled', NULL),
    ('55555555-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000001',
     NULL, NULL, 'in_progress', NULL),
    -- Four fresh completable orders consumed by the §10.2 rollback fault probes.
    ('55555555-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'in_progress', NULL),
    ('55555555-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'in_progress', NULL),
    ('55555555-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'in_progress', NULL),
    ('55555555-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'in_progress', NULL),
    -- Fresh completable order consumed by the §10.2 no-side-effect proof (G6).
    ('55555555-0000-4000-8000-000000000012', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'in_progress', now() - interval '3 hours');

  -- Preflight class-4 fixture: a completed order with ZERO reports (inserted
  -- as completed, so the transition guard does not fire).
  INSERT INTO public.work_orders
    (id, dealer_id, customer_id, vehicle_id, status, actual_end_at)
  VALUES
    ('55555555-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'completed', now() - interval '10 days');

  -- Legacy fixture: a work order INSERTED as completed (no UPDATE, so the
  -- transition guard does not fire) with ONE unconfirmed legacy report.
  INSERT INTO public.work_orders
    (id, dealer_id, customer_id, vehicle_id, status, actual_end_at)
  VALUES
    ('55555555-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001',
     '33333333-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001',
     'completed', now() - interval '30 days');

  PERFORM set_config('dealeros.completion_authority', 'test-fixture', true);
  INSERT INTO public.completion_reports
    (id, dealer_id, work_order_id, report_number, status, report_date)
  VALUES
    ('66666666-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
     '55555555-0000-4000-8000-000000000005', 'LEGACY-001', 'generated', current_date - 30);
  PERFORM set_config('dealeros.completion_authority', '', true);
END $fixtures$;

-- ═══ 1. SCHEMA: tables, columns, constraints, indexes ═══════════════════════

SELECT has_table('public', 'completion_report_items',        'completion_report_items exists');
SELECT has_table('public', 'work_order_completion_requests', 'work_order_completion_requests exists');

SELECT has_column('public', 'completion_reports', 'performed_work_confirmed_at', 'confirmed_at column');
SELECT has_column('public', 'completion_reports', 'performed_work_confirmed_by', 'confirmed_by column');
SELECT has_column('public', 'completion_reports', 'performed_work_version',      'version column');
SELECT has_column('public', 'completion_reports', 'performed_work_updated_at',   'updated_at column');

SELECT has_index('public', 'completion_reports', 'completion_reports_dealer_work_order_uidx',
                 'one canonical report per (dealer, work order)');
SELECT has_index('public', 'completion_reports', 'completion_reports_dealer_report_number_uidx',
                 'one number per dealer');
SELECT has_index('public', 'completion_report_items', 'completion_report_items_dealer_idx', 'items dealer index');
SELECT has_index('public', 'completion_report_items', 'completion_report_items_report_idx', 'items report FK index');
SELECT has_index('public', 'work_order_completion_requests', 'work_order_completion_requests_work_order_idx', 'requests WO FK index');
SELECT has_index('public', 'work_order_completion_requests', 'work_order_completion_requests_report_idx', 'requests report FK index');

-- Tenant-coherent composite FKs, all RESTRICT ('r'), never CASCADE.
SELECT results_eq(
  $$SELECT conname::text COLLATE "C", confdeltype::text COLLATE "C" FROM pg_constraint
     WHERE conname IN ('completion_reports_work_order_dealer_fkey',
                       'completion_report_items_report_dealer_fkey',
                       'work_order_completion_requests_work_order_dealer_fkey',
                       'work_order_completion_requests_report_dealer_fkey')
     ORDER BY conname$$,
  $$SELECT v.conname COLLATE "C", v.confdeltype COLLATE "C"
      FROM (VALUES ('completion_report_items_report_dealer_fkey','r'),
                   ('completion_reports_work_order_dealer_fkey','r'),
                   ('work_order_completion_requests_report_dealer_fkey','r'),
                   ('work_order_completion_requests_work_order_dealer_fkey','r'))
        AS v(conname, confdeltype)
     ORDER BY 1$$,
  'dealer-qualified FKs exist with ON DELETE RESTRICT');

-- Row checks (flag on so only the CHECKs decide).
SELECT tests.as_postgres();
SELECT lives_ok($$
  DO $x$ BEGIN
    PERFORM set_config('dealeros.completion_authority', 't', true);
    INSERT INTO public.completion_report_items
      (dealer_id, completion_report_id, sort_order, category, item_name)
    VALUES ('11111111-0000-4000-8000-000000000001',
            '66666666-0000-4000-8000-000000000001', 0, 'coating', 'legacy-check-probe');
    DELETE FROM public.completion_report_items WHERE item_name = 'legacy-check-probe';
    PERFORM set_config('dealeros.completion_authority', '', true);
  END $x$;$$,
  'a valid trimmed item row satisfies the checks');
SELECT throws_ok($$
  DO $x$ BEGIN
    PERFORM set_config('dealeros.completion_authority', 't', true);
    INSERT INTO public.completion_report_items
      (dealer_id, completion_report_id, sort_order, category, item_name)
    VALUES ('11111111-0000-4000-8000-000000000001',
            '66666666-0000-4000-8000-000000000001', 0, ' padded ', 'x');
  END $x$;$$,
  '23514', NULL, 'untrimmed category violates the CHECK');
SELECT throws_ok($$
  INSERT INTO public.work_order_completion_requests
    (dealer_id, idempotency_key, request_fingerprint, work_order_id,
     completion_report_id, actor_user_id, outcome)
  VALUES ('11111111-0000-4000-8000-000000000001', 'short', repeat('a', 64),
          '55555555-0000-4000-8000-000000000005',
          '66666666-0000-4000-8000-000000000001',
          '22222222-0000-4000-8000-000000000001', 'created')$$,
  NULL, NULL, 'a 5-char idempotency key is rejected (guard/CHECK)');

-- ═══ 2. SECURITY MODES, search_path, private schema ═════════════════════════

SELECT is((SELECT prosecdef FROM pg_proc WHERE proname = 'complete_work_order_v1'), true,
          'complete_work_order_v1 is SECURITY DEFINER');
SELECT is((SELECT prosecdef FROM pg_proc WHERE proname = 'update_completion_report_draft_v1'), true,
          'update_completion_report_draft_v1 is SECURITY DEFINER');
SELECT is((SELECT prosecdef FROM pg_proc WHERE proname = 'get_next_document_number'), true,
          'get_next_document_number stays SECURITY DEFINER');
SELECT is((SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'private' AND p.proname = 'allocate_next_document_number_v1'), false,
          'the internal allocation core is SECURITY INVOKER');

SELECT ok((SELECT 'search_path=""' = ANY(proconfig) OR 'search_path=' = ANY(proconfig)
             FROM pg_proc WHERE proname = 'complete_work_order_v1'),
          'complete_work_order_v1 pins an empty search_path');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) OR 'search_path=' = ANY(proconfig)
             FROM pg_proc WHERE proname = 'update_completion_report_draft_v1'),
          'update_completion_report_draft_v1 pins an empty search_path');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) OR 'search_path=' = ANY(proconfig)
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'private' AND p.proname = 'allocate_next_document_number_v1'),
          'the internal core pins an empty search_path');

-- C3-R1-SECURITY-SCHEMA-QUALIFICATION: EVERY completion function — the two
-- operations, the wrapper, the private helpers, and the trigger/guard set —
-- pins an empty search_path. (The qualification boundary itself is recorded in
-- the migration header: callable built-ins are pg_catalog-qualified; COALESCE/
-- NULLIF/CASE and operators are grammar/parser constructs with no search_path
-- lookup.)
SELECT is((
  SELECT pg_catalog.count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE ((n.nspname = 'public' AND p.proname IN (
            'complete_work_order_v1', 'update_completion_report_draft_v1',
            'get_next_document_number', 'gda_completion_authority_active',
            'gda_completion_reports_guard', 'gda_completion_report_items_guard',
            'gda_completion_requests_guard', 'gda_work_orders_completion_guard'))
       OR (n.nspname = 'private' AND p.proname IN (
            'allocate_next_document_number_v1', 'normalize_performed_items_v1',
            'build_completion_fingerprint_canonical_v1', 'completion_fingerprint_v1',
            'resolve_completion_actor_role_v1')))
     AND NOT (proconfig IS NOT NULL
              AND ('search_path=""' = ANY(proconfig) OR 'search_path=' = ANY(proconfig)))
  )::int, 0,
  'all 13 completion functions pin an empty search_path (none missing, none loose)');

SELECT is(has_schema_privilege('anon',          'private', 'USAGE'), false, 'anon: no USAGE on private');
SELECT is(has_schema_privilege('authenticated', 'private', 'USAGE'), false, 'authenticated: no USAGE on private');
SELECT is(has_schema_privilege('service_role',  'private', 'USAGE'), false, 'service_role: no USAGE on private');

-- ═══ 3. GRANTS: limited command surface ═════════════════════════════════════

-- Function EXECUTE matrix.
SELECT is(has_function_privilege('authenticated',
  'public.complete_work_order_v1(uuid, text, timestamptz, jsonb)', 'EXECUTE'), true,
  'authenticated may execute complete_work_order_v1');
SELECT is(has_function_privilege('anon',
  'public.complete_work_order_v1(uuid, text, timestamptz, jsonb)', 'EXECUTE'), false,
  'anon may not execute complete_work_order_v1');
SELECT is(has_function_privilege('service_role',
  'public.complete_work_order_v1(uuid, text, timestamptz, jsonb)', 'EXECUTE'), false,
  'service_role may not execute complete_work_order_v1');
SELECT is(has_function_privilege('authenticated',
  'public.update_completion_report_draft_v1(uuid, integer, text, text, text, jsonb)', 'EXECUTE'), true,
  'authenticated may execute the draft correction');
SELECT is(has_function_privilege('service_role',
  'public.update_completion_report_draft_v1(uuid, integer, text, text, text, jsonb)', 'EXECUTE'), false,
  'service_role may not execute the draft correction');
SELECT is(has_function_privilege('authenticated',
  'public.get_next_document_number(uuid, text, integer, text, integer, text)', 'EXECUTE'), true,
  'public allocator keeps its authenticated-only EXECUTE');
SELECT is(has_function_privilege('anon',
  'public.get_next_document_number(uuid, text, integer, text, integer, text)', 'EXECUTE'), false,
  'public allocator: anon denied');
SELECT is(has_function_privilege('service_role',
  'public.get_next_document_number(uuid, text, integer, text, integer, text)', 'EXECUTE'), false,
  'public allocator: service_role denied');
SELECT is(has_function_privilege('authenticated',
  'private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text)', 'EXECUTE'), false,
  'internal core: authenticated denied');
SELECT is(has_function_privilege('anon',
  'private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text)', 'EXECUTE'), false,
  'internal core: anon denied');
SELECT is(has_function_privilege('service_role',
  'private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text)', 'EXECUTE'), false,
  'internal core: service_role denied');

-- Table privilege matrix: SELECT-only for authenticated; nothing for others.
SELECT is(has_table_privilege('authenticated', 'public.completion_reports', 'SELECT'), true,  'reports: authenticated SELECT');
SELECT is(has_table_privilege('authenticated', 'public.completion_reports', 'INSERT'), false, 'reports: no raw INSERT');
SELECT is(has_table_privilege('authenticated', 'public.completion_reports', 'UPDATE'), false, 'reports: no raw UPDATE');
SELECT is(has_table_privilege('authenticated', 'public.completion_reports', 'DELETE'), false, 'reports: no raw DELETE');
SELECT is(has_table_privilege('service_role',  'public.completion_reports', 'UPDATE'), false, 'reports: service_role no raw UPDATE');
SELECT is(has_table_privilege('authenticated', 'public.completion_report_items', 'SELECT'), true,  'items: authenticated SELECT');
SELECT is(has_table_privilege('authenticated', 'public.completion_report_items', 'INSERT'), false, 'items: no raw INSERT');
SELECT is(has_table_privilege('service_role',  'public.completion_report_items', 'INSERT'), false, 'items: service_role no raw INSERT');
SELECT is(has_table_privilege('authenticated', 'public.work_order_completion_requests', 'SELECT'), false, 'requests: no application SELECT');
SELECT is(has_table_privilege('authenticated', 'public.work_order_completion_requests', 'INSERT'), false, 'requests: no raw INSERT');
SELECT is(has_table_privilege('service_role',  'public.work_order_completion_requests', 'SELECT'), false, 'requests: service_role no SELECT');
SELECT is(has_table_privilege('anon', 'public.completion_reports', 'SELECT'), false, 'anon: no report access');

-- work_orders: column grants replace table-wide UPDATE; actual_end_at denied.
SELECT is(has_table_privilege('authenticated', 'public.work_orders', 'UPDATE'), false,
          'work_orders: no table-wide UPDATE for authenticated');
SELECT is(has_column_privilege('authenticated', 'public.work_orders', 'status', 'UPDATE'), true,
          'work_orders: status stays column-grantable (guard-protected)');
SELECT is(has_column_privilege('authenticated', 'public.work_orders', 'actual_end_at', 'UPDATE'), false,
          'work_orders: authenticated cannot raw-update actual_end_at');
SELECT is(has_column_privilege('service_role', 'public.work_orders', 'actual_end_at', 'UPDATE'), false,
          'work_orders: service_role cannot raw-update actual_end_at');

-- ═══ 4. NORMALIZATION + SHARED FINGERPRINT VECTORS (§5.4) ═══════════════════

SELECT tests.as_postgres();

-- Normalization mirrors the TS core exactly.
SELECT is(
  private.normalize_performed_items_v1(
    '[{"category":"  コーティング ","itemName":" GYEON施工 ","description":"  "}]'::jsonb),
  '[{"category":"コーティング","itemName":"GYEON施工","description":null,"sortOrder":0}]'::jsonb,
  'normalization trims, nulls a blank description, derives sortOrder 0');
SELECT throws_ok(
  $$SELECT private.normalize_performed_items_v1(
      '[{"category":"c","itemName":"n","description":null,"unitPrice":1000}]'::jsonb)$$,
  'P0001', 'VALIDATION_ERROR: performed item 0 has a forbidden key',
  'a monetary key is rejected by name, never ignored');
SELECT throws_ok(
  $$SELECT private.normalize_performed_items_v1('[]'::jsonb)$$,
  'P0001', 'VALIDATION_ERROR: performedItems must contain at least 1 item',
  'zero items rejected');
SELECT throws_ok(
  $$SELECT private.normalize_performed_items_v1(
      (SELECT jsonb_agg(jsonb_build_object('category','c','itemName','n','description',NULL))
         FROM generate_series(1, 101)))$$,
  'P0001', 'VALIDATION_ERROR: performedItems must contain at most 100 items',
  '101 items rejected');
SELECT throws_ok(
  $$SELECT private.normalize_performed_items_v1(
      jsonb_build_array(jsonb_build_object(
        'category', repeat('a', 101), 'itemName', 'n', 'description', NULL)))$$,
  'P0001', 'VALIDATION_ERROR: performed item 0 category must be 1-100 characters',
  'category over 100 chars rejected');

-- VECTOR 1 (verbatim from the TS contract test).
SELECT is(
  private.build_completion_fingerprint_canonical_v1(
    '3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b'::uuid,
    '2026-08-10T03:04:05.678Z'::timestamptz,
    '[{"category":"コーティング","itemName":"GYEON施工","description":null,"sortOrder":0}]'::jsonb),
  '{"contractVersion":1,"workOrderId":"3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b","actualEndAt":"2026-08-10T03:04:05.678Z","performedItems":[{"category":"コーティング","itemName":"GYEON施工","description":null,"sortOrder":0}]}',
  'VECTOR 1: byte-identical canonical text');

-- VECTOR 2 (escaping: quote, backslash, newline, tab; zero-millisecond instant).
SELECT is(
  private.build_completion_fingerprint_canonical_v1(
    '00000000-0000-4000-8000-000000000001'::uuid,
    '2026-01-01T00:00:00.000Z'::timestamptz,
    jsonb_build_array(
      jsonb_build_object('category', 'coating',
                         'itemName', E'say "hi" \\ slash',
                         'description', E'line1\nline2\ttabbed',
                         'sortOrder', 0),
      jsonb_build_object('category', '洗車', 'itemName', 'wash',
                         'description', NULL, 'sortOrder', 1))),
  E'{"contractVersion":1,"workOrderId":"00000000-0000-4000-8000-000000000001","actualEndAt":"2026-01-01T00:00:00.000Z","performedItems":[{"category":"coating","itemName":"say \\"hi\\" \\\\ slash","description":"line1\\nline2\\ttabbed","sortOrder":0},{"category":"洗車","itemName":"wash","description":null,"sortOrder":1}]}',
  'VECTOR 2: byte-identical canonical text with escaping');

-- The stored fingerprint is the lowercase hex SHA-256 of the canonical text.
SELECT is(
  private.completion_fingerprint_v1(
    '3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b'::uuid,
    '2026-08-10T03:04:05.678Z'::timestamptz,
    '[{"category":"コーティング","itemName":"GYEON施工","description":null,"sortOrder":0}]'::jsonb),
  encode(sha256(convert_to(
    private.build_completion_fingerprint_canonical_v1(
      '3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b'::uuid,
      '2026-08-10T03:04:05.678Z'::timestamptz,
      '[{"category":"コーティング","itemName":"GYEON施工","description":null,"sortOrder":0}]'::jsonb),
    'UTF8')), 'hex'),
  'fingerprint = sha256(canonical text)');
SELECT matches(
  private.completion_fingerprint_v1(
    '3f2b8a54-1c6d-4e0f-9a7b-2d5c8e1f0a3b'::uuid,
    '2026-08-10T03:04:05.678Z'::timestamptz,
    '[{"category":"コーティング","itemName":"GYEON施工","description":null,"sortOrder":0}]'::jsonb),
  '^[0-9a-f]{64}$', 'fingerprint shape: lowercase 64-hex');

-- ═══ 5. §5.3 AUTHORIZATION: staff primary, blocking row, fallbacks ══════════

-- Staff-only actor (no member row) completes end-to-end INCLUDING numbering.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT results_eq(
  $$SELECT report_number, performed_work_version, outcome, created, replayed
      FROM public.complete_work_order_v1(
        '55555555-0000-4000-8000-000000000001',
        'staff-intent-key-0001', now() - interval '1 minute',
        '[{"category":"コーティング","itemName":"GYEON施工","description":null}]'::jsonb)$$,
  $$VALUES ('REP-00001'::text, 1, 'created'::text, true, false)$$,
  'ACTIVE dealer_staff-only actor: created, REP default numbering, version 1');

SELECT tests.as_postgres();
SELECT is((SELECT status FROM public.work_orders
            WHERE id = '55555555-0000-4000-8000-000000000001'), 'completed',
          'the work order transitioned to completed');
SELECT is((SELECT count(*) FROM public.completion_reports
            WHERE work_order_id = '55555555-0000-4000-8000-000000000001')::int, 1,
          'exactly one canonical report');
SELECT is((SELECT count(*) FROM public.completion_report_items i
            JOIN public.completion_reports r ON r.id = i.completion_report_id
           WHERE r.work_order_id = '55555555-0000-4000-8000-000000000001')::int, 1,
          'exactly one confirmed snapshot row');
SELECT is((SELECT outcome FROM public.work_order_completion_requests
            WHERE idempotency_key = 'staff-intent-key-0001'), 'created',
          'one immutable request row, outcome created');

-- Blocking staff row: NEVER falls back to the active owner membership.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000002');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000002', 'blocked-intent-key-01',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'PERMISSION_DENIED: staff state does not permit completion',
  'a DISABLED dealer_staff row blocks despite an active owner membership');

-- Member fallback (manager, no staff row) succeeds.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT results_eq(
  $$SELECT outcome, created FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000002', 'member-intent-key-01',
      now() - interval '1 minute',
      '[{"category":"coating","itemName":"MOHS EVO","description":null}]'::jsonb)$$,
  $$VALUES ('created'::text, true)$$,
  'active dealer_members manager authorizes when no staff row exists');

-- Owner bootstrap (owner_user_id only) succeeds.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000004');
SELECT results_eq(
  $$SELECT outcome, created FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000003', 'owner-intent-key-0001',
      now() - interval '1 minute',
      '[{"category":"coating","itemName":"CanCoat","description":null}]'::jsonb)$$,
  $$VALUES ('created'::text, true)$$,
  'dealers.owner_user_id authorizes as owner when no staff row exists');

-- readonly member, cross-dealer, unauthenticated, cancelled: all denied.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000005');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000004', 'readonly-intent-key-1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'PERMISSION_DENIED: role does not permit completion',
  'readonly membership never completes');
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000006');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000004', 'foreign-intent-key-01',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'NOT_FOUND: work order not found',
  'a cross-dealer caller receives the same coarse NOT_FOUND');
SELECT tests.authenticate_without_uid();
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000004', 'anonymous-intent-key-1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'UNAUTHENTICATED: authentication is required',
  'no auth.uid() -> UNAUTHENTICATED');
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000004', 'cancelled-intent-key-1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'INVALID_STATE: work order status does not permit completion',
  'cancelled -> completed is forbidden');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000006', 'nocustomer-intent-key1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'VALIDATION_ERROR: completion requires a customer and a vehicle',
  'a customer-less order cannot complete');

-- Legacy allocator role matrix is unchanged (§5.6 item 4).
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT ok((SELECT public.get_next_document_number(
             '11111111-0000-4000-8000-000000000001', 'estimate', 0) > 0),
          'active member still allocates through the public wrapper');
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT public.get_next_document_number('11111111-0000-4000-8000-000000000001', 'estimate', 0)$$,
  'P0001', 'FORBIDDEN: caller is not an active member or owner of the dealer',
  'a staff-only actor is still FORBIDDEN on the public wrapper (authorization preserved)');

-- ═══ 6. IDEMPOTENCY: replay, alias, conflicts, recovery ═════════════════════

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');

-- Same key + same payload: replayed, same IDs, zero new rows.
SELECT results_eq(
  $$SELECT report_number, performed_work_version, outcome, created, replayed
      FROM public.complete_work_order_v1(
        '55555555-0000-4000-8000-000000000001',
        'staff-intent-key-0001', now() - interval '1 minute',
        '[{"category":"コーティング","itemName":"GYEON施工","description":null}]'::jsonb)$$,
  $$VALUES ('REP-00001'::text, 1, 'replayed'::text, false, true)$$,
  'exact replay: stable result');
SELECT tests.as_postgres();
SELECT is((SELECT count(*) FROM public.work_order_completion_requests
            WHERE work_order_id = '55555555-0000-4000-8000-000000000001')::int, 1,
          'exact replay wrote nothing');

-- Same key + different fingerprint: IDEMPOTENCY_CONFLICT, no write.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000001',
      'staff-intent-key-0001', now(),
      '[{"category":"coating","itemName":"DIFFERENT","description":null}]'::jsonb)$$,
  'P0001', 'IDEMPOTENCY_CONFLICT: idempotency key was used for a different request',
  'same key + different payload conflicts');

-- Different key + identical fingerprint: immutable alias, replayed.
SELECT results_eq(
  $$SELECT report_number, outcome, created, replayed
      FROM public.complete_work_order_v1(
        '55555555-0000-4000-8000-000000000001',
        'staff-intent-key-ALIAS-2',
        (SELECT actual_end_at FROM public.work_orders
          WHERE id = '55555555-0000-4000-8000-000000000001'),
        '[{"category":"コーティング","itemName":"GYEON施工","description":null}]'::jsonb)$$,
  $$VALUES ('REP-00001'::text, 'replayed'::text, false, true)$$,
  'different key + identical intent replays the canonical result');
SELECT tests.as_postgres();
SELECT is((SELECT count(*) FROM public.work_order_completion_requests
            WHERE work_order_id = '55555555-0000-4000-8000-000000000001')::int, 2,
          'the alias intent appended one immutable request row');
SELECT is((SELECT count(*) FROM public.completion_reports
            WHERE work_order_id = '55555555-0000-4000-8000-000000000001')::int, 1,
          'still exactly one canonical report after the alias');

-- Different key + different fingerprint on a completed order: conflict.
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000001', 'staff-intent-key-DIFF-3',
      now(), '[{"category":"coating","itemName":"DIFFERENT","description":null}]'::jsonb)$$,
  'P0001', 'ALREADY_COMPLETED_CONFLICT: work order is already completed with different content',
  'already completed with different content conflicts');

-- Completed legacy order + one unconfirmed report: RECOVERY_REQUIRED, no write.
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000005', 'legacy-intent-key-0001',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'RECOVERY_REQUIRED: legacy completion requires explicit recovery confirmation',
  'a legacy completion is never silently converted');

-- ═══ 7. LEGACY-ROW PRESERVATION ═════════════════════════════════════════════

SELECT tests.as_postgres();
SELECT results_eq(
  $$SELECT report_number, status, performed_work_confirmed_at IS NULL,
           performed_work_version IS NULL
      FROM public.completion_reports
     WHERE id = '66666666-0000-4000-8000-000000000001'$$,
  $$VALUES ('LEGACY-001'::text, 'generated'::text, true, true)$$,
  'the legacy report keeps its number, status, and NULL confirmation fields');

-- ═══ 8. DRAFT CORRECTION: version check, stale, non-draft ═══════════════════

-- §7.2/§11: the staff-only actor sees ZERO completion_reports rows, so the
-- canonical report UUID is captured in postgres test context (transaction-
-- local GUC) and passed by value.
SELECT set_config('gda1w.staff_report_id',
  (SELECT id::text FROM public.completion_reports
    WHERE work_order_id = '55555555-0000-4000-8000-000000000001'), true);

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT results_eq(
  $$SELECT performed_work_version, outcome
      FROM public.update_completion_report_draft_v1(
        pg_catalog.current_setting('gda1w.staff_report_id')::uuid,
        1, 'タイトル修正', 'お客様メッセージ', '内部メモ',
        '[{"category":"コーティング","itemName":"GYEON施工（修正）","description":"再確認済み"}]'::jsonb)$$,
  $$VALUES (2, 'updated'::text)$$,
  'draft correction: version 1 -> 2, atomic snapshot replacement');
SELECT results_eq(
  $$SELECT performed_work_version, outcome
      FROM public.update_completion_report_draft_v1(
        pg_catalog.current_setting('gda1w.staff_report_id')::uuid,
        1, 't', NULL, NULL,
        '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  $$VALUES (2, 'STALE_VERSION'::text)$$,
  'a stale expected version returns STALE_VERSION with zero writes');
SELECT tests.as_postgres();
SELECT is((SELECT i.item_name FROM public.completion_report_items i
            JOIN public.completion_reports r ON r.id = i.completion_report_id
           WHERE r.work_order_id = '55555555-0000-4000-8000-000000000001'
           LIMIT 1), 'GYEON施工（修正）',
          'the stale attempt changed nothing; version-2 snapshot stands');

-- Non-draft: shared reports are immutable through the draft operation.
DO $x$ BEGIN
  PERFORM set_config('dealeros.completion_authority', 'test-fixture', true);
  UPDATE public.completion_reports SET status = 'shared', is_shared = true, shared_at = now()
   WHERE work_order_id = '55555555-0000-4000-8000-000000000002';
  PERFORM set_config('dealeros.completion_authority', '', true);
END $x$;
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT throws_ok(
  $$SELECT * FROM public.update_completion_report_draft_v1(
      (SELECT id FROM public.completion_reports
        WHERE work_order_id = '55555555-0000-4000-8000-000000000002'),
      1, 't', NULL, NULL, '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'INVALID_STATE: only a draft report may be corrected',
  'shared snapshots are immutable through the draft operation');

-- ═══ 9. TRANSITION GUARD + RAW-WRITE DENIAL ═════════════════════════════════

SELECT tests.as_postgres();
-- Even the table owner cannot raw-enter/leave completed or touch actual_end_at
-- without the completion-authority flag.
SELECT throws_ok(
  $$UPDATE public.work_orders SET status = 'completed'
     WHERE id = '55555555-0000-4000-8000-000000000004'$$,
  'P0001', 'COMPLETION_GUARD: completion state and actual_end_at change only through the completion authority operations',
  'raw transition INTO completed is rejected');
SELECT throws_ok(
  $$UPDATE public.work_orders SET status = 'scheduled'
     WHERE id = '55555555-0000-4000-8000-000000000001'$$,
  'P0001', 'COMPLETION_GUARD: completion state and actual_end_at change only through the completion authority operations',
  'raw transition OUT OF completed is rejected');
SELECT throws_ok(
  $$UPDATE public.work_orders SET actual_end_at = now()
     WHERE id = '55555555-0000-4000-8000-000000000004'$$,
  'P0001', 'COMPLETION_GUARD: completion state and actual_end_at change only through the completion authority operations',
  'raw actual_end_at change is rejected');
SELECT lives_ok(
  $$UPDATE public.work_orders SET status = 'in_progress'
     WHERE id = '55555555-0000-4000-8000-000000000003'
       AND status = 'on_hold' AND false$$,
  'ordinary non-completion transitions remain possible (no-op probe)');

-- Authority tables: even flagless owner writes are guarded.
SELECT throws_ok(
  $$UPDATE public.completion_reports SET title = 'raw'
     WHERE id = '66666666-0000-4000-8000-000000000001'$$,
  'P0001', 'COMPLETION_GUARD: completion reports are written only through the completion authority operations',
  'flagless report UPDATE is rejected by the guard');
SELECT throws_ok(
  $$DELETE FROM public.completion_reports
     WHERE id = '66666666-0000-4000-8000-000000000001'$$,
  'P0001', 'COMPLETION_GUARD: completion reports may not be deleted',
  'report DELETE is always rejected');
SELECT throws_ok(
  $$UPDATE public.work_order_completion_requests SET outcome = 'created'
     WHERE idempotency_key = 'staff-intent-key-0001'$$,
  'P0001', 'COMPLETION_GUARD: completion requests are append-only',
  'the request ledger rejects UPDATE');
SELECT throws_ok(
  $$DELETE FROM public.work_order_completion_requests
     WHERE idempotency_key = 'staff-intent-key-0001'$$,
  'P0001', 'COMPLETION_GUARD: completion requests are append-only',
  'the request ledger rejects DELETE');

-- Raw Data-API-shaped writes as authenticated: privilege denial (42501).
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT throws_ok(
  $$INSERT INTO public.completion_reports (dealer_id, work_order_id)
    VALUES ('11111111-0000-4000-8000-000000000001',
            '55555555-0000-4000-8000-000000000003')$$,
  '42501', NULL, 'authenticated raw report INSERT: permission denied');
SELECT throws_ok(
  $$INSERT INTO public.completion_report_items
      (dealer_id, completion_report_id, sort_order, category, item_name)
    VALUES ('11111111-0000-4000-8000-000000000001',
            '66666666-0000-4000-8000-000000000001', 9, 'x', 'y')$$,
  '42501', NULL, 'authenticated raw item INSERT: permission denied');
SELECT throws_ok(
  $$SELECT * FROM public.work_order_completion_requests$$,
  '42501', NULL, 'authenticated cannot even SELECT the request ledger');

-- ═══ 10. RLS SELECT ISOLATION ═══════════════════════════════════════════════

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT ok((SELECT count(*) FROM public.completion_reports) > 0,
          'an active same-dealer member sees the dealer reports');
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000006');
SELECT is((SELECT count(*) FROM public.completion_reports)::int, 0,
          'a foreign-dealer member sees zero reports (RLS isolation)');
SELECT is((SELECT count(*) FROM public.completion_report_items)::int, 0,
          'a foreign-dealer member sees zero snapshot rows');

-- ═══ 11. §5.3 ACTOR REACHABILITY (C3-R1, narrowed by C3-R2) ═════════════════
-- The COMMAND path to complete_work_order_v1 pre-reads exactly two things
-- through caller RLS: the target work_orders row and the actor's OWN
-- dealer_staff row; the RPC returns its canonical result directly. These
-- probes prove the ACTIVE staff-only actor can make exactly those reads, that
-- report/item SELECT stays §7.2-exact (membership/owner only — a staff-only
-- actor deliberately sees NO report or snapshot rows), and that the new
-- policies leak nothing to blocked or foreign actors.

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT is((SELECT pg_catalog.count(*) FROM public.dealer_staff
            WHERE user_id = '22222222-0000-4000-8000-000000000001')::int, 1,
          'staff-only actor reads their OWN dealer_staff row (self-select policy)');
SELECT ok((SELECT pg_catalog.count(*) FROM public.work_orders
            WHERE dealer_id = '11111111-0000-4000-8000-000000000001') > 0,
          'staff-only actor sees the dealer''s work orders (command-path reachability)');
-- §7.2 boundary held (C3-R2): NO staff-based report/item visibility exists.
SELECT is((SELECT pg_catalog.count(*) FROM public.completion_reports
            WHERE dealer_id = '11111111-0000-4000-8000-000000000001')::int, 0,
          'staff-only actor sees ZERO completion reports (§7.2: membership/owner context only)');
SELECT is((SELECT pg_catalog.count(*) FROM public.completion_report_items
            WHERE dealer_id = '11111111-0000-4000-8000-000000000001')::int, 0,
          'staff-only actor sees ZERO snapshot rows (§7.2: membership/owner context only)');

-- A DISABLED staff row grants no work-order visibility through the new policy
-- (u_blocked still sees rows via their ACTIVE membership — the pre-existing
-- member policy — so the probe uses visibility of the staff row itself).
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000002');
SELECT is((SELECT pg_catalog.count(*) FROM public.dealer_staff
            WHERE user_id = '22222222-0000-4000-8000-000000000002')::int, 1,
          'a blocked actor still reads only their OWN staff row (blocking state is resolvable)');
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000006');
SELECT is((SELECT pg_catalog.count(*) FROM public.work_orders
            WHERE dealer_id = '11111111-0000-4000-8000-000000000001')::int, 0,
          'a foreign-dealer actor still sees zero of dealer 1''s work orders');
SELECT is((SELECT pg_catalog.count(*) FROM public.dealer_staff
            WHERE dealer_id = '11111111-0000-4000-8000-000000000001')::int, 0,
          'a foreign-dealer actor sees none of dealer 1''s staff rows');

-- ═══ 12. PREFLIGHT FIVE-CLASS COVERAGE (C3-R1-PREFLIGHT-COVERAGE) ═══════════
-- Re-runs the migration's five identification queries verbatim against the
-- fixtures. Classes 1-3 must be zero here (the migration applied), class 4
-- detects the orphan completed order, class 5 detects the snapshot-less
-- legacy report. Count-only — no row content.

SELECT tests.as_postgres();
SELECT is((SELECT pg_catalog.count(*) FROM (
             SELECT cr.dealer_id, cr.work_order_id
               FROM public.completion_reports cr
              GROUP BY cr.dealer_id, cr.work_order_id
             HAVING pg_catalog.count(*) > 1) d)::int, 0,
          'preflight class 1: zero duplicate (dealer, work order) report pairs');
SELECT is((SELECT pg_catalog.count(*) FROM (
             SELECT cr.dealer_id, cr.report_number
               FROM public.completion_reports cr
              WHERE cr.report_number IS NOT NULL
              GROUP BY cr.dealer_id, cr.report_number
             HAVING pg_catalog.count(*) > 1) d)::int, 0,
          'preflight class 2: zero duplicate report-number groups');
SELECT is((SELECT pg_catalog.count(*)
             FROM public.completion_reports cr
             JOIN public.work_orders wo ON wo.id = cr.work_order_id
            WHERE wo.dealer_id IS DISTINCT FROM cr.dealer_id)::int, 0,
          'preflight class 3: zero report/work-order dealer mismatches');
SELECT ok((SELECT pg_catalog.count(*)
             FROM public.work_orders wo
            WHERE wo.status = 'completed'
              AND wo.deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM public.completion_reports cr
                               WHERE cr.work_order_id = wo.id)) >= 1,
          'preflight class 4: the zero-report completed order IS identified');
SELECT ok((SELECT pg_catalog.count(*)
             FROM public.completion_reports cr
            WHERE NOT EXISTS (SELECT 1 FROM public.completion_report_items i
                               WHERE i.completion_report_id = cr.id)) >= 1,
          'preflight class 5: the snapshot-less legacy report IS identified');

-- ═══ 13. DENIAL + ACL MATRIX (C3-R1-DENIAL-AND-ACL-MATRIX) ══════════════════

-- PUBLIC (aclitem grantee 0) holds nothing on the private schema or the core.
SELECT is((SELECT pg_catalog.count(*)
             FROM pg_namespace n,
                  LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl, '{}'::aclitem[])) a
            WHERE n.nspname = 'private' AND a.grantee = 0)::int, 0,
          'PUBLIC holds no privilege of any kind on schema private');
SELECT is((SELECT pg_catalog.count(*)
             FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace,
                  LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, '{}'::aclitem[])) a
            WHERE n.nspname = 'private'
              AND p.proname = 'allocate_next_document_number_v1'
              AND a.grantee = 0)::int, 0,
          'PUBLIC holds no EXECUTE on the internal allocation core');

-- Direct invocation of the internal core is DENIED for each concrete runtime
-- role (42501: schema USAGE and function EXECUTE are both revoked).
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT throws_ok(
  $$SELECT private.allocate_next_document_number_v1(
      '11111111-0000-4000-8000-000000000001', 'estimate', 0, '', 5, 'never')$$,
  '42501', NULL, 'authenticated: direct core invocation denied');
SELECT tests.as_postgres();
SELECT set_config('role', 'anon', true);
SELECT throws_ok(
  $$SELECT private.allocate_next_document_number_v1(
      '11111111-0000-4000-8000-000000000001', 'estimate', 0, '', 5, 'never')$$,
  '42501', NULL, 'anon: direct core invocation denied');
SELECT tests.as_postgres();
SELECT set_config('role', 'service_role', true);
SELECT throws_ok(
  $$SELECT private.allocate_next_document_number_v1(
      '11111111-0000-4000-8000-000000000001', 'estimate', 0, '', 5, 'never')$$,
  '42501', NULL, 'service_role: direct core invocation denied');
SELECT tests.as_postgres();

-- ACTUAL operation denial for anonymous and service-role callers: the
-- completion operation itself is unreachable (EXECUTE revoked), not merely
-- unauthorized inside.
SELECT set_config('role', 'anon', true);
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000008', 'anon-role-intent-key-1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  '42501', NULL, 'anon role: complete_work_order_v1 EXECUTE denied');
SELECT tests.as_postgres();
SELECT set_config('role', 'service_role', true);
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000008', 'service-role-intent-1x',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  '42501', NULL, 'service_role: complete_work_order_v1 EXECUTE denied');
SELECT tests.as_postgres();
SELECT set_config('role', 'service_role', true);
SELECT throws_ok(
  $$SELECT * FROM public.update_completion_report_draft_v1(
      '66666666-0000-4000-8000-000000000001', 1, NULL, NULL, NULL,
      '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  '42501', NULL, 'service_role: draft correction EXECUTE denied');
SELECT tests.as_postgres();

-- INVITED staff row blocks with no fallback (u_invited also holds an ACTIVE
-- owner membership that would otherwise authorize).
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000007');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000008', 'invited-intent-key-01',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'PERMISSION_DENIED: staff state does not permit completion',
  'an INVITED dealer_staff row blocks despite an active owner membership');

-- UNKNOWN-ROLE probe: dealer_staff roles are constrained by CHECK to the four
-- literals, so a stored unknown STAFF role is unrepresentable; the probe
-- therefore targets dealer_members. The insert is attempted in a guarded
-- subtransaction: when the local schema also CHECK-constrains member roles,
-- the state is unrepresentable and the probe passes vacuously.
SELECT tests.as_postgres();
DO $unknown$ BEGIN
  BEGIN
    INSERT INTO public.dealer_members (dealer_id, user_id, role, status)
    VALUES ('11111111-0000-4000-8000-000000000002',
            '22222222-0000-4000-8000-000000000006', 'consultant', 'active');
    PERFORM pg_catalog.set_config('gda1w.unknown_role_inserted', 't', true);
  EXCEPTION WHEN check_violation OR invalid_text_representation THEN
    PERFORM pg_catalog.set_config('gda1w.unknown_role_inserted', 'f', true);
  END;
END $unknown$;
SELECT tests.as_postgres();
DO $unknownprobe$
DECLARE
  v_ok boolean := false;
  v_msg text;
BEGIN
  IF pg_catalog.current_setting('gda1w.unknown_role_inserted', true) = 't' THEN
    -- u_foreign now has memberships 'owner' AND 'consultant' in d2: the
    -- ambiguous/unknown state must deny, never authorize.
    PERFORM tests.authenticate_as('22222222-0000-4000-8000-000000000006');
    BEGIN
      PERFORM * FROM public.complete_work_order_v1(
        '55555555-0000-4000-8000-000000000008', 'unknown-role-intent-1',
        pg_catalog.now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      -- Cross-dealer work order: either coarse NOT_FOUND or an ambiguity
      -- denial is acceptable; ANY success is a failure.
      v_ok := v_msg LIKE 'NOT_FOUND:%' OR v_msg LIKE 'PERMISSION_DENIED:%';
    END;
    PERFORM tests.as_postgres();
    PERFORM pg_catalog.set_config('gda1w.unknown_role_probe',
                                  CASE WHEN v_ok THEN 'denied' ELSE 'FAILED' END, true);
  ELSE
    PERFORM pg_catalog.set_config('gda1w.unknown_role_probe', 'unrepresentable', true);
  END IF;
END $unknownprobe$;
SELECT ok(pg_catalog.current_setting('gda1w.unknown_role_probe', true)
            IN ('denied', 'unrepresentable'),
          'unknown-role state denies (or is CHECK-unrepresentable): '
          || COALESCE(pg_catalog.current_setting('gda1w.unknown_role_probe', true), '?'));

-- ═══ 14. ROLLBACK FAULT PROBES (C3-R1-ROLLBACK-COVERAGE) ════════════════════
-- Reversible, transaction-local fault injection: one trigger function in the
-- tests schema plus four triggers created INSIDE this rolled-back transaction.
-- Each probe arms exactly one fault via a transaction-local GUC, drives a
-- fresh valid completion into the named failure, and proves ZERO partial
-- authority writes: no report, no items, no ledger row, work order untouched,
-- and the document sequence not advanced. No production fault hook exists —
-- everything here dies with the ROLLBACK.

SELECT tests.as_postgres();

CREATE FUNCTION tests.gda1w_fault() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.current_setting('gda1w.fault', true) = TG_ARGV[0] THEN
    RAISE EXCEPTION 'GDA1W_TEST_FAULT: %', TG_ARGV[0];
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER zzz_gda1w_fault_alloc
  BEFORE INSERT OR UPDATE ON public.document_sequences
  FOR EACH ROW EXECUTE FUNCTION tests.gda1w_fault('alloc');
CREATE TRIGGER zzz_gda1w_fault_report
  BEFORE INSERT ON public.completion_reports
  FOR EACH ROW EXECUTE FUNCTION tests.gda1w_fault('report');
CREATE TRIGGER zzz_gda1w_fault_item
  BEFORE INSERT ON public.completion_report_items
  FOR EACH ROW EXECUTE FUNCTION tests.gda1w_fault('item');
CREATE TRIGGER zzz_gda1w_fault_request
  BEFORE INSERT ON public.work_order_completion_requests
  FOR EACH ROW EXECUTE FUNCTION tests.gda1w_fault('request');

-- Baseline sequence position, captured once; every probe must leave it intact.
CREATE TEMP TABLE gda1w_seq_baseline AS
  SELECT s.current_number
    FROM public.document_sequences s
   WHERE s.dealer_id = '11111111-0000-4000-8000-000000000001'
     AND s.sequence_type = 'completion_report';

-- Shared zero-partial-write assertion, parameterized by work order.
CREATE FUNCTION tests.gda1w_no_partial_writes(p_wo uuid) RETURNS boolean
LANGUAGE sql AS $$
  SELECT (SELECT pg_catalog.count(*) FROM public.completion_reports cr
           WHERE cr.work_order_id = p_wo) = 0
     AND (SELECT pg_catalog.count(*) FROM public.work_order_completion_requests r
           WHERE r.work_order_id = p_wo) = 0
     AND (SELECT wo.status FROM public.work_orders wo WHERE wo.id = p_wo) = 'in_progress'
     AND (SELECT wo.actual_end_at FROM public.work_orders wo WHERE wo.id = p_wo) IS NULL
     AND (SELECT s.current_number FROM public.document_sequences s
           WHERE s.dealer_id = '11111111-0000-4000-8000-000000000001'
             AND s.sequence_type = 'completion_report')
         = (SELECT current_number FROM gda1w_seq_baseline);
$$;

-- Probe 1: ALLOCATION failure -> mapped stable code, full rollback.
SELECT set_config('gda1w.fault', 'alloc', true);
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000008', 'fault-alloc-intent-01',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'REPORT_NUMBER_FAILED: report number could not be allocated',
  'allocation fault surfaces as the stable REPORT_NUMBER_FAILED code');
SELECT tests.as_postgres();
SELECT set_config('gda1w.fault', '', true);
SELECT ok(tests.gda1w_no_partial_writes('55555555-0000-4000-8000-000000000008'),
          'allocation fault: zero partial authority writes');

-- Probe 2: REPORT INSERT failure -> full rollback (sequence advance included).
SELECT set_config('gda1w.fault', 'report', true);
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000009', 'fault-report-intent-1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'GDA1W_TEST_FAULT: report',
  'report-insert fault aborts the whole operation');
SELECT tests.as_postgres();
SELECT set_config('gda1w.fault', '', true);
SELECT ok(tests.gda1w_no_partial_writes('55555555-0000-4000-8000-000000000009'),
          'report-insert fault: zero partial writes AND the sequence advance rolled back');

-- Probe 3: ITEM INSERT failure -> full rollback (report row included).
SELECT set_config('gda1w.fault', 'item', true);
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000010', 'fault-item-intent-01x',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'GDA1W_TEST_FAULT: item',
  'item-insert fault aborts the whole operation');
SELECT tests.as_postgres();
SELECT set_config('gda1w.fault', '', true);
SELECT ok(tests.gda1w_no_partial_writes('55555555-0000-4000-8000-000000000010'),
          'item-insert fault: zero partial writes (no orphan report)');

-- Probe 4: REQUEST-LEDGER failure -> full rollback (report + items included).
SELECT set_config('gda1w.fault', 'request', true);
SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000011', 'fault-request-intent-1',
      now(), '[{"category":"c","itemName":"n","description":null}]'::jsonb)$$,
  'P0001', 'GDA1W_TEST_FAULT: request',
  'request-ledger fault aborts the whole operation');
SELECT tests.as_postgres();
SELECT set_config('gda1w.fault', '', true);
SELECT ok(tests.gda1w_no_partial_writes('55555555-0000-4000-8000-000000000011'),
          'request-ledger fault: zero partial writes (no orphan report or items)');
SELECT is((SELECT pg_catalog.count(*) FROM public.completion_report_items i
            JOIN public.completion_reports r ON r.id = i.completion_report_id
           WHERE r.work_order_id IN ('55555555-0000-4000-8000-000000000008',
                                     '55555555-0000-4000-8000-000000000009',
                                     '55555555-0000-4000-8000-000000000010',
                                     '55555555-0000-4000-8000-000000000011'))::int, 0,
          'no fault probe left any snapshot row behind');

-- The fault triggers are dropped so LATER hypothetical statements cannot trip
-- them; the ROLLBACK below removes them (and tests.*) regardless.
DROP TRIGGER zzz_gda1w_fault_alloc   ON public.document_sequences;
DROP TRIGGER zzz_gda1w_fault_report  ON public.completion_reports;
DROP TRIGGER zzz_gda1w_fault_item    ON public.completion_report_items;
DROP TRIGGER zzz_gda1w_fault_request ON public.work_order_completion_requests;

-- ═══ 15. G1 — FUNCTION OWNER ASSERTIONS (§10.2 'function owner') ════════════
-- Catalog-backed: every completion authority function is owned by the
-- migration owner. On the disposable stack migrations run as postgres.

SELECT tests.as_postgres();
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner)
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'complete_work_order_v1'),
          'postgres', 'complete_work_order_v1 is owned by the migration owner');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner)
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'update_completion_report_draft_v1'),
          'postgres', 'update_completion_report_draft_v1 is owned by the migration owner');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner)
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'get_next_document_number'),
          'postgres', 'the public allocator wrapper is owned by the migration owner');
SELECT is((SELECT pg_catalog.pg_get_userbyid(p.proowner)
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'private' AND p.proname = 'allocate_next_document_number_v1'),
          'postgres', 'the internal allocation core is owned by the migration owner');

-- ═══ 16. G2 — AUTHENTICATED EXECUTABLE RAW UPDATE/DELETE DENIAL ═════════════
-- Catalog privilege checks are asserted earlier; §10.2 additionally demands
-- EXECUTABLE denial evidence. Privilege is checked before RLS/row filtering,
-- so every probe fails 42501 regardless of visible rows.

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT throws_ok(
  $$UPDATE public.completion_reports SET title = 'raw-update-probe'$$,
  '42501', NULL, 'authenticated raw completion_reports UPDATE: permission denied (executable)');
SELECT throws_ok(
  $$DELETE FROM public.completion_reports$$,
  '42501', NULL, 'authenticated raw completion_reports DELETE: permission denied (executable)');
SELECT throws_ok(
  $$UPDATE public.completion_report_items SET category = 'raw-update-probe'$$,
  '42501', NULL, 'authenticated raw completion_report_items UPDATE: permission denied (executable)');
SELECT throws_ok(
  $$DELETE FROM public.completion_report_items$$,
  '42501', NULL, 'authenticated raw completion_report_items DELETE: permission denied (executable)');
SELECT tests.as_postgres();

-- ═══ 17. G3 — AUTHENTICATED EXECUTABLE RAW work_orders DENIAL ═══════════════
-- status: the column stays grantable for ordinary transitions, so the denial
-- authority for a raw completed transition is the transition GUARD (P0001).
-- actual_end_at: the column grant itself is withheld, so the denial is 42501
-- before any trigger can run. Both probes target the member-visible cancelled
-- fixture order (RLS row visible; nothing else about it changes).

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000003');
SELECT throws_ok(
  $$UPDATE public.work_orders SET status = 'completed'
     WHERE id = '55555555-0000-4000-8000-000000000004'$$,
  'P0001',
  'COMPLETION_GUARD: completion state and actual_end_at change only through the completion authority operations',
  'authenticated raw status -> completed: rejected by the transition guard (executable)');
SELECT throws_ok(
  $$UPDATE public.work_orders SET actual_end_at = now()
     WHERE id = '55555555-0000-4000-8000-000000000004'$$,
  '42501', NULL,
  'authenticated raw actual_end_at UPDATE: permission denied (executable)');
SELECT tests.as_postgres();

-- ═══ 18. G4 — EXECUTABLE DUPLICATE-KEY PROBES (SQLSTATE 23505) ══════════════
-- The unique indexes were asserted by catalog earlier; these probes prove the
-- final collision guards FIRE. The authority flag is set so ONLY the unique
-- constraints decide; throws_ok's savepoint rolls each attempt back, so no
-- probe row survives into later assertions.

SELECT set_config('dealeros.completion_authority', 'test-dup-probe', true);
-- (a) second report for an already-reported (dealer, work order) pair.
SELECT throws_ok(
  $$INSERT INTO public.completion_reports (dealer_id, work_order_id)
    VALUES ('11111111-0000-4000-8000-000000000001',
            '55555555-0000-4000-8000-000000000001')$$,
  '23505', NULL,
  'duplicate (dealer_id, work_order_id) report insert: unique violation (executable)');
-- (b) reuse of an allocated report number within the dealer (partial unique
--     index WHERE report_number IS NOT NULL) on the report-less completed order.
SELECT throws_ok(
  $$INSERT INTO public.completion_reports (dealer_id, work_order_id, report_number)
    VALUES ('11111111-0000-4000-8000-000000000001',
            '55555555-0000-4000-8000-000000000007', 'REP-00001')$$,
  '23505', NULL,
  'duplicate (dealer_id, report_number) insert: unique violation (executable)');
SELECT set_config('dealeros.completion_authority', '', true);

-- ═══ 19. G5 — VALIDATION-FAILURE ZERO-WRITE PROBE (§10.2 'rollback on
--             validation') ═════════════════════════════════════════════════
-- Runs BEFORE the G6 happy-path completion so the §14 sequence baseline is
-- still the comparison point. The fresh fault-probe order is reused: every
-- §14 probe against it rolled back, so it is still a zero-write in_progress
-- order, and the shared no-partial-writes assertion applies verbatim.

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT throws_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000008', 'validation-zero-write-1',
      now(), '[]'::jsonb)$$,
  'P0001', 'VALIDATION_ERROR: performedItems must contain at least 1 item',
  'validation failure raises the stable code before any write');
SELECT tests.as_postgres();
SELECT ok(tests.gda1w_no_partial_writes('55555555-0000-4000-8000-000000000008'),
          'validation failure: zero partial authority writes and sequence not advanced');

-- ═══ 20. G6 — NO-SIDE-EFFECT PROOF (§3.5 / §10.2) ═══════════════════════════
-- Before/after row counts across the five side-effect surfaces bracket one
-- fresh happy-path completion: the atomic operation must queue no message,
-- issue no invoice, record no payment, and create no maintenance reminder.

CREATE TEMP TABLE gda1w_sidefx_before AS SELECT
  (SELECT pg_catalog.count(*) FROM public.line_message_logs)       AS lml,
  (SELECT pg_catalog.count(*) FROM public.line_notification_queue) AS lnq,
  (SELECT pg_catalog.count(*) FROM public.invoices)                AS inv,
  (SELECT pg_catalog.count(*) FROM public.payments)                AS pay,
  (SELECT pg_catalog.count(*) FROM public.maintenance_reminders)   AS mr;

SELECT tests.authenticate_as('22222222-0000-4000-8000-000000000001');
SELECT lives_ok(
  $$SELECT * FROM public.complete_work_order_v1(
      '55555555-0000-4000-8000-000000000012', 'sidefx-intent-key-0001',
      now() - interval '1 minute',
      '[{"category":"コーティング","itemName":"GYEON施工","description":null}]'::jsonb)$$,
  'the G6 happy-path completion succeeds');
SELECT tests.as_postgres();

SELECT is((SELECT pg_catalog.count(*) FROM public.line_message_logs),
          (SELECT lml FROM gda1w_sidefx_before),
          'completion queued/sent no LINE message log row');
SELECT is((SELECT pg_catalog.count(*) FROM public.line_notification_queue),
          (SELECT lnq FROM gda1w_sidefx_before),
          'completion queued no LINE notification');
SELECT is((SELECT pg_catalog.count(*) FROM public.invoices),
          (SELECT inv FROM gda1w_sidefx_before),
          'completion issued no invoice');
SELECT is((SELECT pg_catalog.count(*) FROM public.payments),
          (SELECT pay FROM gda1w_sidefx_before),
          'completion recorded no payment');
SELECT is((SELECT pg_catalog.count(*) FROM public.maintenance_reminders),
          (SELECT mr FROM gda1w_sidefx_before),
          'completion created no maintenance reminder');
-- And the completion itself really happened (the bracket is not vacuous):
SELECT is((SELECT wo.status FROM public.work_orders wo
            WHERE wo.id = '55555555-0000-4000-8000-000000000012'), 'completed',
          'the bracketed completion committed (status = completed)');

SELECT tests.as_postgres();
SELECT * FROM finish();
ROLLBACK;
