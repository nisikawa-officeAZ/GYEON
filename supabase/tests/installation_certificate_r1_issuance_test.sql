-- GDA Installation Certificate R1-B2 disposable-DB pgTAP candidate.
-- SOURCE ONLY: run later against a fresh disposable stack, never a linked DB.
-- Separate-connection race evidence is intentionally outside this one-session test.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

CREATE SCHEMA IF NOT EXISTS tests;
CREATE OR REPLACE FUNCTION tests.certificate_authenticate_as(p_uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;
CREATE OR REPLACE FUNCTION tests.certificate_as_postgres() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;
GRANT USAGE ON SCHEMA tests TO authenticated;

\set d1      'a1111111-0000-4000-8000-000000000001'
\set d2      'a1111111-0000-4000-8000-000000000002'
\set u_staff 'a2222222-0000-4000-8000-000000000001'
\set u_other 'a2222222-0000-4000-8000-000000000002'
\set cust1   'a3333333-0000-4000-8000-000000000001'
\set veh1    'a4444444-0000-4000-8000-000000000001'
\set wo1     'a5555555-0000-4000-8000-000000000001'
\set wo2     'a5555555-0000-4000-8000-000000000002'
\set rep1    'a6666666-0000-4000-8000-000000000001'
\set rep2    'a6666666-0000-4000-8000-000000000002'

DO $fixtures$
BEGIN
  INSERT INTO auth.users(id, email) VALUES
    ('a2222222-0000-4000-8000-000000000001', 'certificate-staff@test.local'),
    ('a2222222-0000-4000-8000-000000000002', 'certificate-other@test.local');

  INSERT INTO public.dealers(id, name) VALUES
    ('a1111111-0000-4000-8000-000000000001', 'Certificate Dealer'),
    ('a1111111-0000-4000-8000-000000000002', 'Foreign Dealer');
  INSERT INTO public.dealer_staff(dealer_id, user_id, role, status) VALUES
    ('a1111111-0000-4000-8000-000000000001',
     'a2222222-0000-4000-8000-000000000001', 'staff', 'active');
  INSERT INTO public.dealer_members(dealer_id, user_id, role, status) VALUES
    ('a1111111-0000-4000-8000-000000000002',
     'a2222222-0000-4000-8000-000000000002', 'owner', 'active');

  INSERT INTO public.dealer_settings(
    dealer_id, business_name, company_name, postal_code, business_address,
    business_phone, business_email, business_website,
    qualified_invoice_number, detailer_rank
  ) VALUES (
    'a1111111-0000-4000-8000-000000000001', 'カーディテーリング西川',
    '有限会社オフィスアズ', '5291331', '滋賀県愛知郡愛荘町愛知川774-4',
    '0749-42-7568', 'test@example.invalid', 'https://example.invalid',
    'T1234567890123', 'detailer'
  );

  INSERT INTO public.customers(id, dealer_id, name, last_name, first_name, is_business)
  VALUES ('a3333333-0000-4000-8000-000000000001',
          'a1111111-0000-4000-8000-000000000001', '石井 紗也華', '石井', '紗也華', false);
  INSERT INTO public.vehicles(
    id, dealer_id, customer_id, maker, model, year, grade, vin, plate_number, color
  ) VALUES (
    'a4444444-0000-4000-8000-000000000001',
    'a1111111-0000-4000-8000-000000000001',
    'a3333333-0000-4000-8000-000000000001',
    'Ferrari', '458 Italia', '2015', 'Base', 'ZFF67N', '名古屋 300', '赤'
  );

  INSERT INTO public.work_orders(
    id, dealer_id, customer_id, vehicle_id, status, actual_end_at, assigned_staff
  ) VALUES
    ('a5555555-0000-4000-8000-000000000001',
     'a1111111-0000-4000-8000-000000000001',
     'a3333333-0000-4000-8000-000000000001',
     'a4444444-0000-4000-8000-000000000001',
     'completed', '2026-09-15T10:00:00Z', '西川 敦司'),
    ('a5555555-0000-4000-8000-000000000002',
     'a1111111-0000-4000-8000-000000000001',
     'a3333333-0000-4000-8000-000000000001',
     'a4444444-0000-4000-8000-000000000001',
     'completed', '2026-09-15T11:00:00Z', '西川 敦司');

  PERFORM set_config('dealeros.completion_authority', 'test-fixture', true);
  INSERT INTO public.completion_reports(
    id, dealer_id, work_order_id, report_number, status, report_date,
    performed_work_confirmed_at, performed_work_confirmed_by,
    performed_work_version, performed_work_updated_at
  ) VALUES
    ('a6666666-0000-4000-8000-000000000001',
     'a1111111-0000-4000-8000-000000000001',
     'a5555555-0000-4000-8000-000000000001',
     'REP-00001', 'draft', '2026-09-15', now(),
     'a2222222-0000-4000-8000-000000000001', 1, now()),
    ('a6666666-0000-4000-8000-000000000002',
     'a1111111-0000-4000-8000-000000000001',
     'a5555555-0000-4000-8000-000000000002',
     'REP-00002', 'draft', '2026-09-15', now(),
     'a2222222-0000-4000-8000-000000000001', 1, now());
  INSERT INTO public.completion_report_items(
    dealer_id, completion_report_id, sort_order, category, item_name, description
  ) VALUES
    ('a1111111-0000-4000-8000-000000000001',
     'a6666666-0000-4000-8000-000000000001', 0,
     'coating', 'Q² CanCoat EVO', NULL),
    ('a1111111-0000-4000-8000-000000000001',
     'a6666666-0000-4000-8000-000000000002', 0,
     'coating', 'Q² MOHS EVO', 'confirmed work');
  PERFORM set_config('dealeros.completion_authority', '', true);
END $fixtures$;

-- Schema, constraints and security shape.
SELECT has_table('public', 'certificate_issuances', 'issuance table exists');
SELECT has_table('public', 'certificate_issuance_requests', 'request arbiter exists');
SELECT has_table('public', 'certificate_documents', 'private document metadata exists');
SELECT has_table('public', 'certificate_audit_events', 'audit table exists');
SELECT has_function('public', 'issue_installation_certificate_r1_v1', ARRAY['uuid','text'],
                    'issuance RPC exact signature exists');
SELECT is((SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='issue_installation_certificate_r1_v1'),
          true, 'issuance RPC is SECURITY DEFINER');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) OR 'search_path=' = ANY(proconfig)
             FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='issue_installation_certificate_r1_v1'),
          'issuance RPC pins empty search_path');
SELECT is(has_function_privilege('authenticated',
  'public.issue_installation_certificate_r1_v1(uuid,text)', 'EXECUTE'), true,
  'authenticated may execute issuance RPC');
SELECT is(has_function_privilege('anon',
  'public.issue_installation_certificate_r1_v1(uuid,text)', 'EXECUTE'), false,
  'anon cannot execute issuance RPC');
SELECT is(has_function_privilege('service_role',
  'public.issue_installation_certificate_r1_v1(uuid,text)', 'EXECUTE'), false,
  'service_role cannot execute issuance RPC');
SELECT is(has_table_privilege('authenticated', 'public.certificate_issuances', 'SELECT'), true,
          'authenticated has issuance SELECT');
SELECT is(has_table_privilege('authenticated', 'public.certificate_issuances', 'INSERT'), false,
          'authenticated has no raw issuance INSERT');
SELECT is(has_table_privilege('authenticated', 'public.certificate_issuance_requests', 'SELECT'), false,
          'request ledger is not application-readable');
SELECT is(has_table_privilege('service_role', 'public.certificate_documents', 'INSERT'), false,
          'service role has no raw document INSERT');
SELECT is((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname='certificate_issuances'), true,
          'issuance RLS enabled');
SELECT is((SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname='certificate_issuances'), true,
          'issuance FORCE RLS enabled');

-- Shared TS/PG canonical request vector.
SELECT tests.certificate_as_postgres();
SELECT is(
  private.certificate_r1_request_canonical_v1(
    '123e4567-e89b-42d3-a456-426614174000'::uuid),
  '{"completionReportId":"123e4567-e89b-42d3-a456-426614174000","contractVersion":1,"documentClass":"installation-certificate-r1"}',
  'request canonical JSON exactly matches TypeScript');
SELECT is(
  private.certificate_r1_sha256_v1(private.certificate_r1_request_canonical_v1(
    '123e4567-e89b-42d3-a456-426614174000'::uuid)),
  '8a249bf336a918f896dc6f1112bb055f289b6d8ffef53cc074ed474ec058743a',
  'request SHA-256 exactly matches TypeScript');
SELECT is(
  private.certificate_r1_canonical_json_v1(
    '{"issuer":{"displayName":"カーディテーリング西川","logoMode":"da-default"},"projection":{"customer":{"name":"石井 紗也華","honorific":"様"},"vehicle":{"name":"Ferrari 458 Italia","maker":"Ferrari","model":"458 Italia"},"installation":{"appliedDate":"2026-09-15","technician":"西川 敦司"},"items":[{"category":"coating","name":"Q² CanCoat EVO"}],"documentClass":"installation-certificate-r1"}}'::jsonb),
  '{"issuer":{"displayName":"カーディテーリング西川","logoMode":"da-default"},"projection":{"customer":{"honorific":"様","name":"石井 紗也華"},"documentClass":"installation-certificate-r1","installation":{"appliedDate":"2026-09-15","technician":"西川 敦司"},"items":[{"category":"coating","name":"Q² CanCoat EVO"}],"vehicle":{"maker":"Ferrari","model":"458 Italia","name":"Ferrari 458 Italia"}}}',
  'source canonical JSON exactly matches TypeScript');
SELECT is(
  private.certificate_r1_sha256_v1(private.certificate_r1_canonical_json_v1(
    '{"issuer":{"displayName":"カーディテーリング西川","logoMode":"da-default"},"projection":{"customer":{"name":"石井 紗也華","honorific":"様"},"vehicle":{"name":"Ferrari 458 Italia","maker":"Ferrari","model":"458 Italia"},"installation":{"appliedDate":"2026-09-15","technician":"西川 敦司"},"items":[{"category":"coating","name":"Q² CanCoat EVO"}],"documentClass":"installation-certificate-r1"}}'::jsonb)),
  'f4a5f422458e6763358dbfd38ec9bd0de0fe3986b7d0d9cf7413384191e3d69c',
  'source SHA-256 exactly matches TypeScript');

-- First issue: CanCoat remains ordinary, non-warranty R1 content.
SELECT tests.certificate_authenticate_as('a2222222-0000-4000-8000-000000000001');
SELECT results_eq(
  $$SELECT outcome, created, replayed
      FROM public.issue_installation_certificate_r1_v1(
        'a6666666-0000-4000-8000-000000000001', 'certificate-intent-0001')$$,
  $$VALUES ('created'::text, true, false)$$,
  'active staff creates exactly one R1 issuance');

SELECT tests.certificate_as_postgres();
SELECT is((SELECT count(*)::int FROM public.certificate_issuances), 1,
          'one issuance committed');
SELECT is((SELECT count(*)::int FROM public.certificate_issuance_requests), 1,
          'one request committed');
SELECT is((SELECT count(*)::int FROM public.certificate_audit_events
            WHERE event_type='issued'), 1, 'one issued audit event committed');
SELECT is((SELECT count(*)::int FROM public.certificate_documents), 0,
          'B2 creates no PDF/document row');
SELECT matches((SELECT certificate_number FROM public.certificate_issuances),
               '^CRT/IN/[0-9]{4}/00001$', 'number is CRT/IN/YYYY/00001');
SELECT is((SELECT snapshot #>> '{items,0,name}' FROM public.certificate_issuances),
          'Q² CanCoat EVO', 'CanCoat stays an ordinary confirmed item');
SELECT is((SELECT snapshot #>> '{issuer,logoMode}' FROM public.certificate_issuances),
          'da-default', 'no configured logo selects the DA default');
SELECT is((SELECT snapshot #>> '{customer,name}' FROM public.certificate_issuances),
          '石井 紗也華', 'customer name comes from canonical customer');
SELECT is((SELECT snapshot #>> '{installation,technician}' FROM public.certificate_issuances),
          '西川 敦司', 'technician comes from completed work order');
SELECT ok((SELECT snapshot::text !~* '(warranty|unit.?price|subtotal|discount|total|margin|qr)'
             FROM public.certificate_issuances),
          'snapshot excludes warranty, money and QR data');
SELECT matches((SELECT source_fingerprint FROM public.certificate_issuances),
               '^[0-9a-f]{64}$', 'source fingerprint is lowercase SHA-256');

-- Same-key replay and different-key duplicate are zero-write outcomes.
SELECT tests.certificate_authenticate_as('a2222222-0000-4000-8000-000000000001');
SELECT results_eq(
  $$SELECT outcome, created, replayed
      FROM public.issue_installation_certificate_r1_v1(
        'a6666666-0000-4000-8000-000000000001', 'certificate-intent-0001')$$,
  $$VALUES ('replayed'::text, false, true)$$,
  'same key and request replays');
SELECT results_eq(
  $$SELECT outcome, created, replayed
      FROM public.issue_installation_certificate_r1_v1(
        'a6666666-0000-4000-8000-000000000001', 'certificate-intent-0002')$$,
  $$VALUES ('already_issued'::text, false, false)$$,
  'different key on same source returns already_issued');
SELECT throws_ok(
  $$SELECT * FROM public.issue_installation_certificate_r1_v1(
      'a6666666-0000-4000-8000-000000000002', 'certificate-intent-0001')$$,
  'P0001', 'IDEMPOTENCY_CONFLICT: key belongs to another request',
  'same key on another source conflicts');

SELECT tests.certificate_as_postgres();
SELECT is((SELECT count(*)::int FROM public.certificate_issuances), 1,
          'replay/duplicate/conflict created no second issuance');
SELECT is((SELECT current_number FROM public.document_sequences
            WHERE dealer_id='a1111111-0000-4000-8000-000000000001'
              AND sequence_type='installation_certificate_r1'), 1,
          'replay/duplicate/conflict did not advance sequence');

-- Direct raw writes and cross-dealer calls are denied.
SELECT tests.certificate_authenticate_as('a2222222-0000-4000-8000-000000000001');
SELECT throws_ok($$DELETE FROM public.certificate_issuances$$,
                 NULL, NULL, 'authenticated cannot raw-delete issuance');
SELECT tests.certificate_authenticate_as('a2222222-0000-4000-8000-000000000002');
SELECT throws_ok(
  $$SELECT * FROM public.issue_installation_certificate_r1_v1(
      'a6666666-0000-4000-8000-000000000002', 'foreign-certificate-01')$$,
  'P0001', 'NOT_FOUND: work order not found',
  'cross-dealer actor receives coarse NOT_FOUND');

SELECT * FROM finish();
ROLLBACK;
