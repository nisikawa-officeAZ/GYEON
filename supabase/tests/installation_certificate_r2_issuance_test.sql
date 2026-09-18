-- Disposable local DB only: R2 kind-specific issuance integration proof.
BEGIN;

CREATE SCHEMA IF NOT EXISTS tests;
CREATE OR REPLACE FUNCTION tests.certificate_r2_authenticate_as(p_uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;
CREATE OR REPLACE FUNCTION tests.certificate_r2_as_postgres() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;
GRANT USAGE ON SCHEMA tests TO authenticated;

DO $fixtures$
BEGIN
  INSERT INTO auth.users(id, email) VALUES
    ('b2222222-0000-4000-8000-000000000001', 'certificate-r2-staff@test.local');
  INSERT INTO public.dealers(id, name) VALUES
    ('b1111111-0000-4000-8000-000000000001', 'Certificate R2 Dealer');
  INSERT INTO public.dealer_staff(dealer_id, user_id, role, status) VALUES
    ('b1111111-0000-4000-8000-000000000001',
     'b2222222-0000-4000-8000-000000000001', 'staff', 'active');
  INSERT INTO public.dealer_settings(
    dealer_id, business_name, company_name, detailer_rank
  ) VALUES (
    'b1111111-0000-4000-8000-000000000001',
    'カーディテーリング西川', '有限会社オフィスアズ', 'detailer'
  );
  INSERT INTO public.customers(id, dealer_id, name, last_name, first_name, is_business)
  VALUES (
    'b3333333-0000-4000-8000-000000000001',
    'b1111111-0000-4000-8000-000000000001',
    '石井 紗也華', '石井', '紗也華', false
  );
  INSERT INTO public.vehicles(
    id, dealer_id, customer_id, maker, model, year, grade, vin, plate_number, color
  ) VALUES (
    'b4444444-0000-4000-8000-000000000001',
    'b1111111-0000-4000-8000-000000000001',
    'b3333333-0000-4000-8000-000000000001',
    'Ferrari', '458 Italia', '2015', 'Base', 'ZFF67N', '名古屋 300', '赤'
  );
  INSERT INTO public.work_orders(
    id, dealer_id, customer_id, vehicle_id, status, actual_end_at, assigned_staff
  ) VALUES
    ('b5555555-0000-4000-8000-000000000001',
     'b1111111-0000-4000-8000-000000000001',
     'b3333333-0000-4000-8000-000000000001',
     'b4444444-0000-4000-8000-000000000001',
     'completed', '2026-09-18T01:00:00Z', '西川 敦司'),
    ('b5555555-0000-4000-8000-000000000002',
     'b1111111-0000-4000-8000-000000000001',
     'b3333333-0000-4000-8000-000000000001',
     'b4444444-0000-4000-8000-000000000001',
     'completed', '2026-09-18T02:00:00Z', '西川 敦司'),
    ('b5555555-0000-4000-8000-000000000003',
     'b1111111-0000-4000-8000-000000000001',
     'b3333333-0000-4000-8000-000000000001',
     'b4444444-0000-4000-8000-000000000001',
     'completed', '2026-09-18T03:00:00Z', '西川 敦司');

  PERFORM set_config('dealeros.completion_authority', 'test-fixture', true);
  INSERT INTO public.completion_reports(
    id, dealer_id, work_order_id, report_number, status, report_date,
    performed_work_confirmed_at, performed_work_confirmed_by,
    performed_work_version, performed_work_updated_at
  ) VALUES
    ('b6666666-0000-4000-8000-000000000001',
     'b1111111-0000-4000-8000-000000000001',
     'b5555555-0000-4000-8000-000000000001',
     'REP-R2-001', 'draft', '2026-09-18', now(),
     'b2222222-0000-4000-8000-000000000001', 1, now()),
    ('b6666666-0000-4000-8000-000000000002',
     'b1111111-0000-4000-8000-000000000001',
     'b5555555-0000-4000-8000-000000000002',
     'REP-R2-002', 'draft', '2026-09-18', now(),
     'b2222222-0000-4000-8000-000000000001', 1, now()),
    ('b6666666-0000-4000-8000-000000000003',
     'b1111111-0000-4000-8000-000000000001',
     'b5555555-0000-4000-8000-000000000003',
     'REP-R2-003', 'draft', '2026-09-18', now(),
     'b2222222-0000-4000-8000-000000000001', 1, now());
  INSERT INTO public.completion_report_items(
    dealer_id, completion_report_id, sort_order, category, item_name, description
  ) VALUES
    ('b1111111-0000-4000-8000-000000000001',
     'b6666666-0000-4000-8000-000000000001', 0,
     'コーティング', 'Q² PURE EVO', 'ベースコート'),
    ('b1111111-0000-4000-8000-000000000001',
     'b6666666-0000-4000-8000-000000000001', 1,
     'コーティング', 'Q² CANCOAT EVO', 'トップコート'),
    ('b1111111-0000-4000-8000-000000000001',
     'b6666666-0000-4000-8000-000000000002', 0,
     'PPF', 'PROTECT+', 'フロント全面'),
    ('b1111111-0000-4000-8000-000000000001',
     'b6666666-0000-4000-8000-000000000003', 0,
     'コーティング', 'Q² CANCOAT EVO', '単独施工');
  PERFORM set_config('dealeros.completion_authority', '', true);
END $fixtures$;

SELECT tests.certificate_r2_authenticate_as('b2222222-0000-4000-8000-000000000001');
DO $authenticated_tests$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result FROM public.issue_installation_certificate_r2_v1(
    'b6666666-0000-4000-8000-000000000001', 'coating', 'r2-coating-intent-0001');
  IF v_result.outcome <> 'created' OR NOT v_result.created OR v_result.replayed THEN
    RAISE EXCEPTION 'coating issuance result mismatch';
  END IF;

  BEGIN
    PERFORM * FROM public.issue_installation_certificate_r2_v1(
      'b6666666-0000-4000-8000-000000000001', 'cancoat', 'r2-cancoat-combo-0001');
    RAISE EXCEPTION 'combo CanCoat was incorrectly issued';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NOT_ELIGIBLE: certificate-kind-not-applicable' THEN RAISE; END IF;
  END;

  SELECT * INTO v_result FROM public.issue_installation_certificate_r2_v1(
    'b6666666-0000-4000-8000-000000000002', 'ppf', 'r2-ppf-intent-000001');
  IF v_result.outcome <> 'created' OR NOT v_result.created OR v_result.replayed THEN
    RAISE EXCEPTION 'PPF issuance result mismatch';
  END IF;

  SELECT * INTO v_result FROM public.issue_installation_certificate_r2_v1(
    'b6666666-0000-4000-8000-000000000003', 'cancoat', 'r2-cancoat-intent-01');
  IF v_result.outcome <> 'created' OR NOT v_result.created OR v_result.replayed THEN
    RAISE EXCEPTION 'standalone CanCoat issuance result mismatch';
  END IF;

  SELECT * INTO v_result FROM public.issue_installation_certificate_r1_v1(
    'b6666666-0000-4000-8000-000000000002', 'r1-regression-intent-01');
  IF v_result.outcome <> 'created' OR NOT v_result.created OR v_result.replayed THEN
    RAISE EXCEPTION 'legacy R1 issuance regression';
  END IF;
END $authenticated_tests$;

SELECT tests.certificate_r2_as_postgres();
DO $postgres_tests$
BEGIN
  IF (SELECT count(*) FROM public.certificate_issuances) <> 4 THEN
    RAISE EXCEPTION 'expected three R2 issuances and one preserved R1 issuance';
  END IF;
  IF (SELECT certificate_number FROM public.certificate_issuances
       WHERE document_class='installation-certificate-coating-r2')
       !~ '^CRT/CO/[0-9]{4}/00001$' THEN
    RAISE EXCEPTION 'coating number is not canonical';
  END IF;
  IF (SELECT certificate_number FROM public.certificate_issuances
       WHERE document_class='installation-certificate-ppf-r2')
       !~ '^CRT/PPF/[0-9]{4}/00001$' THEN
    RAISE EXCEPTION 'PPF number is not canonical';
  END IF;
  IF (SELECT certificate_number FROM public.certificate_issuances
       WHERE document_class='installation-certificate-cancoat-r2')
       !~ '^CRT/CC/[0-9]{4}/00001$' THEN
    RAISE EXCEPTION 'CanCoat number is not canonical';
  END IF;
  IF (SELECT certificate_number FROM public.certificate_issuances
       WHERE document_class='installation-certificate-r1')
       !~ '^CRT/IN/[0-9]{4}/00001$' THEN
    RAISE EXCEPTION 'legacy R1 number was not preserved';
  END IF;
  IF (SELECT snapshot ->> 'certificateKind' FROM public.certificate_issuances
      WHERE document_class='installation-certificate-coating-r2') <> 'coating' THEN
    RAISE EXCEPTION 'coating snapshot kind mismatch';
  END IF;
  IF (SELECT jsonb_array_length(snapshot -> 'items') FROM public.certificate_issuances
      WHERE document_class='installation-certificate-coating-r2') <> 2 THEN
    RAISE EXCEPTION 'coating snapshot omitted CanCoat top coat';
  END IF;
  IF (SELECT snapshot #>> '{items,0,name}' FROM public.certificate_issuances
      WHERE document_class='installation-certificate-ppf-r2') <> 'PROTECT+' THEN
    RAISE EXCEPTION 'PPF snapshot filtering failed';
  END IF;
  IF (SELECT snapshot #>> '{items,0,name}' FROM public.certificate_issuances
      WHERE document_class='installation-certificate-cancoat-r2') <> 'Q² CANCOAT EVO' THEN
    RAISE EXCEPTION 'CanCoat snapshot filtering failed';
  END IF;
  IF (SELECT count(*) FROM public.document_sequences
      WHERE dealer_id='b1111111-0000-4000-8000-000000000001'
        AND sequence_type IN (
          'installation_certificate_coating_r2',
          'installation_certificate_ppf_r2',
          'installation_certificate_cancoat_r2'
        )) <> 3 THEN
    RAISE EXCEPTION 'kind-specific sequence rows are incomplete';
  END IF;
END $postgres_tests$;

SELECT 'R2_ISSUANCE_INTEGRATION_PASS' AS result;
ROLLBACK;
