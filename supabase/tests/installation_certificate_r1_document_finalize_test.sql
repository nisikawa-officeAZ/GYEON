-- GDA Installation Certificate R1-C1-G1 disposable-DB pgTAP candidate.
-- SOURCE ONLY: never run against a linked or production database.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

CREATE SCHEMA IF NOT EXISTS tests;
CREATE OR REPLACE FUNCTION tests.r1c1_as_postgres() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;
CREATE OR REPLACE FUNCTION tests.r1c1_as_service() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', null, 'role', 'service_role')::text, true);
  PERFORM set_config('role', 'service_role', true);
END $$;
GRANT USAGE ON SCHEMA tests TO service_role;
GRANT EXECUTE ON FUNCTION tests.r1c1_as_postgres() TO service_role;
GRANT EXECUTE ON FUNCTION tests.r1c1_as_service() TO service_role;

\set dealer_id   'c1111111-1111-4111-8111-111111111111'
\set actor_id    'c2222222-2222-4222-8222-222222222222'
\set outsider_id 'c2222222-2222-4222-8222-222222222223'
\set customer_id 'c3333333-3333-4333-8333-333333333333'
\set vehicle_id  'c4444444-4444-4444-8444-444444444444'
\set work_id     'c5555555-5555-4555-8555-555555555555'
\set report_id   'c6666666-6666-4666-8666-666666666666'
\set issuance_id 'c7777777-7777-4777-8777-777777777777'
\set document_id 'c8888888-8888-4888-8888-888888888888'
\set missing_id  'c8888888-8888-4888-8888-888888888889'
\set mismatch_id 'c8888888-8888-4888-8888-888888888890'
\set conflict_id 'c8888888-8888-4888-8888-888888888891'

DO $fixtures$
DECLARE
  v_path text := 'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/'
    || 'c7777777-7777-4777-8777-777777777777/';
BEGIN
  INSERT INTO auth.users(id, email) VALUES
    ('c2222222-2222-4222-8222-222222222222', 'r1c1-staff@test.local'),
    ('c2222222-2222-4222-8222-222222222223', 'r1c1-outsider@test.local');
  INSERT INTO public.dealers(id, name) VALUES
    ('c1111111-1111-4111-8111-111111111111', 'R1-C1 Dealer');
  INSERT INTO public.dealer_staff(dealer_id, user_id, role, status) VALUES
    ('c1111111-1111-4111-8111-111111111111',
     'c2222222-2222-4222-8222-222222222222', 'staff', 'active');

  INSERT INTO public.customers(id, dealer_id, name, last_name, first_name, is_business)
  VALUES ('c3333333-3333-4333-8333-333333333333',
          'c1111111-1111-4111-8111-111111111111',
          '証明 太郎', '証明', '太郎', false);
  INSERT INTO public.vehicles(id, dealer_id, customer_id, maker, model)
  VALUES ('c4444444-4444-4444-8444-444444444444',
          'c1111111-1111-4111-8111-111111111111',
          'c3333333-3333-4333-8333-333333333333', 'GYEON', 'Test Car');
  INSERT INTO public.work_orders(
    id, dealer_id, customer_id, vehicle_id, status, actual_end_at, assigned_staff
  ) VALUES (
    'c5555555-5555-4555-8555-555555555555',
    'c1111111-1111-4111-8111-111111111111',
    'c3333333-3333-4333-8333-333333333333',
    'c4444444-4444-4444-8444-444444444444',
    'completed', '2026-09-16T00:00:00Z', '証明担当'
  );

  PERFORM set_config('dealeros.completion_authority', 'test-fixture', true);
  INSERT INTO public.completion_reports(
    id, dealer_id, work_order_id, report_number, status, report_date,
    performed_work_confirmed_at, performed_work_confirmed_by,
    performed_work_version, performed_work_updated_at
  ) VALUES (
    'c6666666-6666-4666-8666-666666666666',
    'c1111111-1111-4111-8111-111111111111',
    'c5555555-5555-4555-8555-555555555555',
    'REP-R1C1', 'draft', '2026-09-16', now(),
    'c2222222-2222-4222-8222-222222222222', 1, now()
  );
  PERFORM set_config('dealeros.completion_authority', '', true);

  PERFORM set_config(
    'dealeros.certificate_r1_authority', 'issue_installation_certificate_r1_v1', true);
  INSERT INTO public.certificate_issuances(
    id, dealer_id, completion_report_id, work_order_id, document_class,
    certificate_number, source_contract_version, source_fingerprint,
    snapshot, issued_on, issued_by
  ) VALUES (
    'c7777777-7777-4777-8777-777777777777',
    'c1111111-1111-4111-8111-111111111111',
    'c6666666-6666-4666-8666-666666666666',
    'c5555555-5555-4555-8555-555555555555',
    'installation-certificate-r1', 'CRT/IN/2026/00001', 1,
    repeat('a', 64),
    jsonb_build_object(
      'schemaVersion', 1,
      'documentClass', 'installation-certificate-r1',
      'certificateNumber', 'CRT/IN/2026/00001',
      'issueDate', '2026-09-16',
      'customer', jsonb_build_object('name', '証明 太郎', 'honorific', '様'),
      'vehicle', jsonb_build_object('name', 'GYEON Test Car'),
      'installation', jsonb_build_object(
        'appliedDate', '2026-09-16', 'technician', '証明担当'),
      'items', jsonb_build_array(jsonb_build_object('category', 'coating', 'name', 'Q² MOHS')),
      'issuer', jsonb_build_object('displayName', 'R1-C1 Dealer', 'logoMode', 'da-default')
    ),
    '2026-09-16', 'c2222222-2222-4222-8222-222222222222'
  );
  PERFORM set_config('dealeros.certificate_r1_authority', '', true);

  INSERT INTO storage.objects(id, bucket_id, name, metadata) VALUES
    ('c9999999-9999-4999-8999-999999999991', 'documents',
     v_path || 'c8888888-8888-4888-8888-888888888888.pdf',
     '{"mimetype":"application/pdf","size":4096}'::jsonb),
    ('c9999999-9999-4999-8999-999999999992', 'documents',
     v_path || 'c8888888-8888-4888-8888-888888888890.pdf',
     '{"mimetype":"application/pdf","size":12}'::jsonb);
END $fixtures$;

SELECT has_function(
  'public', 'finalize_installation_certificate_r1_document_v1',
  ARRAY['uuid','uuid','uuid','text','text','text','bigint','text','text','uuid'],
  'finalization RPC exact signature exists');
SELECT is((SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public'
              AND p.proname='finalize_installation_certificate_r1_document_v1'),
          true, 'finalization RPC is SECURITY DEFINER');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) OR 'search_path=' = ANY(proconfig)
             FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public'
              AND p.proname='finalize_installation_certificate_r1_document_v1'),
          'finalization RPC pins empty search_path');
SELECT is(has_function_privilege('service_role',
  'public.finalize_installation_certificate_r1_document_v1(uuid,uuid,uuid,text,text,text,bigint,text,text,uuid)',
  'EXECUTE'), true, 'service_role may execute finalization RPC');
SELECT is(has_function_privilege('authenticated',
  'public.finalize_installation_certificate_r1_document_v1(uuid,uuid,uuid,text,text,text,bigint,text,text,uuid)',
  'EXECUTE'), false, 'authenticated cannot execute finalization RPC');
SELECT is(has_function_privilege('anon',
  'public.finalize_installation_certificate_r1_document_v1(uuid,uuid,uuid,text,text,text,bigint,text,text,uuid)',
  'EXECUTE'), false, 'anon cannot execute finalization RPC');
SELECT is(has_table_privilege('service_role', 'public.certificate_documents', 'INSERT'), false,
          'service_role has no raw document INSERT');

-- Missing and mismatched Storage objects fail before any database write.
SELECT tests.r1c1_as_service();
SELECT throws_ok(
  $$SELECT * FROM public.finalize_installation_certificate_r1_document_v1(
    'c1111111-1111-4111-8111-111111111111',
    'c7777777-7777-4777-8777-777777777777',
    'c8888888-8888-4888-8888-888888888889',
    'documents',
    'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/c7777777-7777-4777-8777-777777777777/c8888888-8888-4888-8888-888888888889.pdf',
    'application/pdf', 4096, repeat('b', 64),
    'installation-certificate-r1-v1',
    'c2222222-2222-4222-8222-222222222222')$$,
  'P0001', 'ARTIFACT_MISSING: uploaded object not found',
  'missing Storage object fails closed');
SELECT throws_ok(
  $$SELECT * FROM public.finalize_installation_certificate_r1_document_v1(
    'c1111111-1111-4111-8111-111111111111',
    'c7777777-7777-4777-8777-777777777777',
    'c8888888-8888-4888-8888-888888888890',
    'documents',
    'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/c7777777-7777-4777-8777-777777777777/c8888888-8888-4888-8888-888888888890.pdf',
    'application/pdf', 4096, repeat('b', 64),
    'installation-certificate-r1-v1',
    'c2222222-2222-4222-8222-222222222222')$$,
  'P0001', 'ARTIFACT_INTEGRITY_ERROR: uploaded object metadata mismatch',
  'Storage size mismatch fails closed');
SELECT throws_ok(
  $$SELECT * FROM public.finalize_installation_certificate_r1_document_v1(
    'c1111111-1111-4111-8111-111111111111',
    'c7777777-7777-4777-8777-777777777777',
    'c8888888-8888-4888-8888-888888888888',
    'documents', 'wrong/path.pdf', 'application/pdf', 4096, repeat('b', 64),
    'installation-certificate-r1-v1',
    'c2222222-2222-4222-8222-222222222222')$$,
  'P0001', 'VALIDATION_ERROR: document metadata is invalid',
  'non-canonical path fails validation');
SELECT throws_ok(
  $$SELECT * FROM public.finalize_installation_certificate_r1_document_v1(
    'c1111111-1111-4111-8111-111111111111',
    'c7777777-7777-4777-8777-777777777777',
    'c8888888-8888-4888-8888-888888888888',
    'documents',
    'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/c7777777-7777-4777-8777-777777777777/c8888888-8888-4888-8888-888888888888.pdf',
    'application/pdf', 4096, repeat('b', 64),
    'installation-certificate-r1-v1',
    'c2222222-2222-4222-8222-222222222223')$$,
  'P0001', 'NOT_FOUND: work order not found',
  'unrelated actor cannot finalize');

-- First finalization creates one document and one minimal audit event.
SELECT results_eq(
  $$SELECT outcome, created, replayed
      FROM public.finalize_installation_certificate_r1_document_v1(
        'c1111111-1111-4111-8111-111111111111',
        'c7777777-7777-4777-8777-777777777777',
        'c8888888-8888-4888-8888-888888888888',
        'documents',
        'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/c7777777-7777-4777-8777-777777777777/c8888888-8888-4888-8888-888888888888.pdf',
        'application/pdf', 4096, repeat('b', 64),
        'installation-certificate-r1-v1',
        'c2222222-2222-4222-8222-222222222222')$$,
  $$VALUES ('created'::text, true, false)$$,
  'first finalization creates the canonical row');

SELECT tests.r1c1_as_postgres();
SELECT is((SELECT count(*)::int FROM public.certificate_documents), 1,
          'exactly one document row exists');
SELECT is((SELECT count(*)::int FROM public.certificate_audit_events
            WHERE event_type='document_stored'), 1,
          'exactly one document_stored event exists');
SELECT is((SELECT event_data FROM public.certificate_audit_events
            WHERE event_type='document_stored'),
          '{"revision": 1, "documentId": "c8888888-8888-4888-8888-888888888888"}'::jsonb,
          'audit event contains only document id and revision');
SELECT is(current_setting('dealeros.certificate_r1_authority', true), '',
          'finalization authority is cleared after success');

-- Exact replay is zero-write; any different identity is a stable conflict.
SELECT tests.r1c1_as_service();
SELECT results_eq(
  $$SELECT outcome, created, replayed
      FROM public.finalize_installation_certificate_r1_document_v1(
        'c1111111-1111-4111-8111-111111111111',
        'c7777777-7777-4777-8777-777777777777',
        'c8888888-8888-4888-8888-888888888888',
        'documents',
        'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/c7777777-7777-4777-8777-777777777777/c8888888-8888-4888-8888-888888888888.pdf',
        'application/pdf', 4096, repeat('b', 64),
        'installation-certificate-r1-v1',
        'c2222222-2222-4222-8222-222222222222')$$,
  $$VALUES ('replayed'::text, false, true)$$,
  'exact replay returns the stored document');
SELECT throws_ok(
  $$SELECT * FROM public.finalize_installation_certificate_r1_document_v1(
    'c1111111-1111-4111-8111-111111111111',
    'c7777777-7777-4777-8777-777777777777',
    'c8888888-8888-4888-8888-888888888891',
    'documents',
    'c1111111-1111-4111-8111-111111111111/certificates/installation-r1/c7777777-7777-4777-8777-777777777777/c8888888-8888-4888-8888-888888888891.pdf',
    'application/pdf', 4096, repeat('b', 64),
    'installation-certificate-r1-v1',
    'c2222222-2222-4222-8222-222222222222')$$,
  'P0001', 'ARTIFACT_CONFLICT: canonical document already finalized',
  'different document identity conflicts');

SELECT tests.r1c1_as_postgres();
SELECT is((SELECT count(*)::int FROM public.certificate_documents), 1,
          'replay/conflict writes no second document');
SELECT is((SELECT count(*)::int FROM public.certificate_audit_events
            WHERE event_type='document_stored'), 1,
          'replay/conflict writes no second audit event');

-- The trigger enforces the authority/table/event matrix even for postgres.
SELECT set_config(
  'dealeros.certificate_r1_authority', 'issue_installation_certificate_r1_v1', true);
SELECT throws_ok(
  $$INSERT INTO public.certificate_audit_events(
      dealer_id, issuance_id, event_type, actor_user_id, event_data)
    VALUES (
      'c1111111-1111-4111-8111-111111111111',
      'c7777777-7777-4777-8777-777777777777', 'document_stored',
      'c2222222-2222-4222-8222-222222222222', '{}'::jsonb)$$,
  'P0001', 'PERMISSION_DENIED: certificate R1 rows are immutable',
  'issuance authority cannot write document_stored events');
SELECT set_config(
  'dealeros.certificate_r1_authority', 'finalize_installation_certificate_r1_document_v1', true);
SELECT throws_ok(
  $$INSERT INTO public.certificate_audit_events(
      dealer_id, issuance_id, event_type, actor_user_id, event_data)
    VALUES (
      'c1111111-1111-4111-8111-111111111111',
      'c7777777-7777-4777-8777-777777777777', 'issued',
      'c2222222-2222-4222-8222-222222222222', '{}'::jsonb)$$,
  'P0001', 'PERMISSION_DENIED: certificate R1 rows are immutable',
  'finalization authority cannot write issued events');
SELECT throws_ok(
  $$UPDATE public.certificate_documents SET byte_size=4097$$,
  'P0001', 'PERMISSION_DENIED: certificate R1 rows are immutable',
  'finalization authority cannot update documents');
SELECT set_config('dealeros.certificate_r1_authority', '', true);

-- A service role cannot convert the custom GUC into raw table authority.
SELECT tests.r1c1_as_service();
SELECT set_config(
  'dealeros.certificate_r1_authority', 'finalize_installation_certificate_r1_document_v1', true);
SELECT throws_ok(
  $$DELETE FROM public.certificate_documents$$,
  NULL, NULL, 'service_role still has no raw document DELETE');
SELECT set_config('dealeros.certificate_r1_authority', '', true);

SELECT tests.r1c1_as_postgres();
SELECT * FROM finish();
ROLLBACK;
