-- GDA installation certificate R2 — authoritative Coating / PPF / CanCoat issuance.
-- Preserves immutable R1 issuances and adds kind-specific serials and multi-certificate reports.

BEGIN;

ALTER TABLE public.document_sequences
  DROP CONSTRAINT IF EXISTS document_sequences_sequence_type_check;
ALTER TABLE public.document_sequences
  ADD CONSTRAINT document_sequences_sequence_type_check
  CHECK (sequence_type IN (
    'estimate', 'work_order', 'completion_report',
    'invoice', 'payment', 'maintenance_reminder',
    'product_order', 'reservation', 'monthly_invoice',
    'installation_certificate_r1',
    'installation_certificate_coating_r2',
    'installation_certificate_ppf_r2',
    'installation_certificate_cancoat_r2'
  ));

ALTER TABLE public.certificate_issuances
  DROP CONSTRAINT certificate_issuances_document_class_check,
  DROP CONSTRAINT certificate_issuances_number_check,
  DROP CONSTRAINT certificate_issuances_contract_version_check,
  DROP CONSTRAINT certificate_issuances_snapshot_check;

ALTER TABLE public.certificate_issuances
  ADD CONSTRAINT certificate_issuances_document_class_check
    CHECK (document_class IN (
      'installation-certificate-r1',
      'installation-certificate-coating-r2',
      'installation-certificate-ppf-r2',
      'installation-certificate-cancoat-r2'
    )),
  ADD CONSTRAINT certificate_issuances_number_check
    CHECK (
      (document_class = 'installation-certificate-r1'
        AND certificate_number ~ '^CRT/IN/[0-9]{4}/[0-9]{5,}$')
      OR (document_class = 'installation-certificate-coating-r2'
        AND certificate_number ~ '^CRT/CO/[0-9]{4}/[0-9]{5,}$')
      OR (document_class = 'installation-certificate-ppf-r2'
        AND certificate_number ~ '^CRT/PPF/[0-9]{4}/[0-9]{5,}$')
      OR (document_class = 'installation-certificate-cancoat-r2'
        AND certificate_number ~ '^CRT/CC/[0-9]{4}/[0-9]{5,}$')
    ),
  ADD CONSTRAINT certificate_issuances_contract_version_check
    CHECK (
      (document_class = 'installation-certificate-r1' AND source_contract_version = 1)
      OR (document_class <> 'installation-certificate-r1' AND source_contract_version = 2)
    ),
  ADD CONSTRAINT certificate_issuances_snapshot_check
    CHECK (
      pg_catalog.jsonb_typeof(snapshot) = 'object'
      AND snapshot ->> 'documentClass' = document_class
      AND snapshot ->> 'certificateNumber' = certificate_number
      AND snapshot ->> 'issueDate' = issued_on::text
      AND pg_catalog.jsonb_typeof(snapshot -> 'customer') = 'object'
      AND pg_catalog.jsonb_typeof(snapshot -> 'vehicle') = 'object'
      AND pg_catalog.jsonb_typeof(snapshot -> 'installation') = 'object'
      AND pg_catalog.jsonb_typeof(snapshot -> 'items') = 'array'
      AND pg_catalog.jsonb_typeof(snapshot -> 'issuer') = 'object'
      AND (
        (document_class = 'installation-certificate-r1'
          AND snapshot ->> 'schemaVersion' = '1'
          AND NOT snapshot ? 'certificateKind')
        OR (
          document_class <> 'installation-certificate-r1'
          AND snapshot ->> 'schemaVersion' = '2'
          AND snapshot ->> 'certificateKind' = CASE document_class
            WHEN 'installation-certificate-coating-r2' THEN 'coating'
            WHEN 'installation-certificate-ppf-r2' THEN 'ppf'
            WHEN 'installation-certificate-cancoat-r2' THEN 'cancoat'
            ELSE NULL
          END
        )
      )
    );

CREATE OR REPLACE FUNCTION public.gda_certificate_r1_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_authority text := pg_catalog.current_setting(
    'dealeros.certificate_r1_authority', true);
  v_allowed boolean := false;
BEGIN
  IF TG_TABLE_SCHEMA IS DISTINCT FROM 'public' OR TG_OP IS DISTINCT FROM 'INSERT' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: certificate rows are immutable';
  END IF;

  IF v_authority IN (
    'issue_installation_certificate_r1_v1',
    'issue_installation_certificate_r2_v1'
  ) THEN
    IF TG_TABLE_NAME IN (
      'certificate_issuances', 'certificate_issuance_requests'
    ) THEN
      v_allowed := true;
    ELSIF TG_TABLE_NAME = 'certificate_audit_events' THEN
      v_allowed := NEW.event_type = 'issued';
    END IF;
  ELSIF v_authority IN (
    'finalize_installation_certificate_r1_document_v1',
    'finalize_installation_certificate_r2_document_v1'
  ) THEN
    IF TG_TABLE_NAME = 'certificate_documents' THEN
      v_allowed := true;
    ELSIF TG_TABLE_NAME = 'certificate_audit_events' THEN
      v_allowed := NEW.event_type = 'document_stored';
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: certificate rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.certificate_r2_item_kind_v1(
  p_category text,
  p_name text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_text text := pg_catalog.lower(
    pg_catalog.btrim(COALESCE(p_category, '') || ' ' || COALESCE(p_name, '')));
BEGIN
  IF v_text ~ '(maintenance|メンテナンス|wash|洗車|cleaning|クリーニング)' THEN
    RETURN 'other';
  ELSIF v_text ~ '(ppf|paint protection|プロテクションフィルム|protect[+]|enhance|hybrid|matte|carbon|color line)' THEN
    RETURN 'ppf';
  ELSIF v_text ~ '(cancoat|can coat|キャンコート)' THEN
    RETURN 'cancoat';
  ELSIF v_text ~ '(coating|コーティング|mohs|duraflex|pure|syncro|one evo|prime)' THEN
    RETURN 'coating';
  END IF;
  RETURN 'other';
END;
$$;

CREATE FUNCTION private.certificate_r2_request_canonical_v1(
  p_completion_report_id uuid,
  p_certificate_kind text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.certificate_r1_canonical_json_v1(pg_catalog.jsonb_build_object(
    'completionReportId', p_completion_report_id::text,
    'certificateKind', p_certificate_kind,
    'contractVersion', 2,
    'documentClass', 'installation-certificate-' || p_certificate_kind || '-r2'
  ));
$$;

CREATE FUNCTION public.issue_installation_certificate_r2_v1(
  p_completion_report_id uuid,
  p_certificate_kind text,
  p_idempotency_key text
)
RETURNS TABLE (
  issuance_id uuid,
  certificate_number text,
  issued_on date,
  source_fingerprint text,
  outcome text,
  created boolean,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor              uuid;
  v_key                text;
  v_kind               text;
  v_document_class     text;
  v_sequence_type      text;
  v_prefix             text;
  v_dealer_id          uuid;
  v_work_order_id      uuid;
  v_wo                 record;
  v_report             record;
  v_customer           record;
  v_vehicle            record;
  v_request            record;
  v_existing           record;
  v_business_name      text;
  v_company_name       text;
  v_postal_code        text;
  v_business_address   text;
  v_business_phone     text;
  v_business_email     text;
  v_business_website   text;
  v_invoice_number     text;
  v_detailer_rank      text;
  v_logo_path          text;
  v_logo_url           text;
  v_customer_name      text;
  v_vehicle_name       text;
  v_display_name       text;
  v_items              jsonb;
  v_item_count         integer;
  v_has_base_coating   boolean;
  v_projection         jsonb;
  v_issuer             jsonb;
  v_source_payload     jsonb;
  v_snapshot           jsonb;
  v_request_fp         text;
  v_source_fp          text;
  v_issued_at          timestamptz;
  v_issued_on          date;
  v_next               integer;
  v_number             text;
  v_issuance_id        uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: authentication is required';
  END IF;
  IF p_completion_report_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: completionReportId is required';
  END IF;

  v_kind := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_certificate_kind, '')));
  IF v_kind NOT IN ('coating', 'ppf', 'cancoat') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: certificateKind is invalid';
  END IF;
  v_document_class := 'installation-certificate-' || v_kind || '-r2';
  v_sequence_type := 'installation_certificate_' || v_kind || '_r2';
  v_prefix := CASE v_kind
    WHEN 'coating' THEN 'CRT/CO'
    WHEN 'ppf' THEN 'CRT/PPF'
    ELSE 'CRT/CC'
  END;

  v_key := pg_catalog.btrim(COALESCE(p_idempotency_key, ''));
  IF pg_catalog.char_length(v_key) NOT BETWEEN 16 AND 128
     OR v_key !~ '^[!-~]+$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: idempotencyKey is invalid';
  END IF;

  SELECT cr.dealer_id, cr.work_order_id
    INTO v_dealer_id, v_work_order_id
    FROM public.completion_reports cr
   WHERE cr.id = p_completion_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  SELECT wo.* INTO v_wo
    FROM public.work_orders wo
   WHERE wo.id = v_work_order_id
     AND wo.dealer_id = v_dealer_id
   FOR UPDATE;
  IF NOT FOUND OR v_wo.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  SELECT cr.* INTO v_report
    FROM public.completion_reports cr
   WHERE cr.id = p_completion_report_id
     AND cr.dealer_id = v_dealer_id
     AND cr.work_order_id = v_work_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  -- Same fail-closed dealer_staff-primary authorization as completion authority.
  PERFORM private.resolve_completion_actor_role_v1(v_dealer_id, v_actor);

  IF v_report.status = 'archived' THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: archived';
  END IF;
  IF v_wo.status <> 'completed' OR v_wo.actual_end_at IS NULL THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: work-order-not-completed';
  END IF;
  IF v_report.report_number IS NULL OR pg_catalog.btrim(v_report.report_number) = '' THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: missing-report-number';
  END IF;
  IF v_report.report_date IS NULL THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: missing-report-date';
  END IF;
  IF v_report.performed_work_confirmed_at IS NULL
     OR v_report.performed_work_confirmed_by IS NULL
     OR v_report.performed_work_version IS NULL
     OR v_report.performed_work_version < 1 THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: snapshot-unconfirmed';
  END IF;
  IF v_wo.assigned_staff IS NULL OR pg_catalog.btrim(v_wo.assigned_staff) = '' THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: missing-technician';
  END IF;

  SELECT c.* INTO v_customer
    FROM public.customers c
   WHERE c.id = v_wo.customer_id
     AND c.dealer_id = v_dealer_id
     AND c.deleted_at IS NULL
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  SELECT v.* INTO v_vehicle
    FROM public.vehicles v
   WHERE v.id = v_wo.vehicle_id
     AND v.dealer_id = v_dealer_id
     AND v.customer_id = v_customer.id
     AND v.deleted_at IS NULL
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  IF v_wo.estimate_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.estimates e
     WHERE e.id = v_wo.estimate_id
       AND e.dealer_id = v_dealer_id
       AND e.customer_id = v_customer.id
       AND e.vehicle_id = v_vehicle.id
       AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  v_customer_name := pg_catalog.btrim(pg_catalog.concat_ws(' ',
    NULLIF(pg_catalog.btrim(v_customer.last_name), ''),
    NULLIF(pg_catalog.btrim(v_customer.first_name), '')));
  IF v_customer_name = '' THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: missing-customer-name';
  END IF;

  v_vehicle_name := pg_catalog.btrim(pg_catalog.concat_ws(' ',
    NULLIF(pg_catalog.btrim(v_vehicle.maker), ''),
    NULLIF(pg_catalog.btrim(v_vehicle.model), '')));
  IF v_vehicle_name = '' THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: missing-vehicle-name';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.completion_report_items i
     WHERE i.dealer_id = v_dealer_id
       AND i.completion_report_id = v_report.id
       AND (i.category <> pg_catalog.btrim(i.category)
            OR i.category = ''
            OR i.item_name <> pg_catalog.btrim(i.item_name)
            OR i.item_name = '')
  ) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: invalid-snapshot-item';
  END IF;

  SELECT pg_catalog.bool_or(
           private.certificate_r2_item_kind_v1(i.category, i.item_name) = 'coating')
    INTO v_has_base_coating
    FROM public.completion_report_items i
   WHERE i.dealer_id = v_dealer_id
     AND i.completion_report_id = v_report.id;

  IF v_kind = 'cancoat' AND COALESCE(v_has_base_coating, false) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: certificate-kind-not-applicable';
  END IF;

  SELECT pg_catalog.count(*)::integer,
         pg_catalog.jsonb_agg(
           pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
             'category', i.category,
             'name', i.item_name,
             'description', i.description
           )) ORDER BY i.sort_order, i.id)
    INTO v_item_count, v_items
    FROM public.completion_report_items i
   WHERE i.dealer_id = v_dealer_id
     AND i.completion_report_id = v_report.id
     AND (
       (v_kind = 'coating' AND private.certificate_r2_item_kind_v1(i.category, i.item_name)
          IN ('coating', 'cancoat'))
       OR (v_kind = 'ppf' AND private.certificate_r2_item_kind_v1(i.category, i.item_name) = 'ppf')
       OR (v_kind = 'cancoat' AND private.certificate_r2_item_kind_v1(i.category, i.item_name) = 'cancoat')
     );
  IF v_item_count < 1 OR v_items IS NULL THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: certificate-kind-not-applicable';
  END IF;

  SELECT ds.business_name, ds.company_name, ds.postal_code,
         ds.business_address, ds.business_phone, ds.business_email,
         ds.business_website, ds.qualified_invoice_number,
         ds.detailer_rank, ds.logo_path, ds.logo_url
    INTO v_business_name, v_company_name, v_postal_code,
         v_business_address, v_business_phone, v_business_email,
         v_business_website, v_invoice_number,
         v_detailer_rank, v_logo_path, v_logo_url
    FROM public.dealer_settings ds
   WHERE ds.dealer_id = v_dealer_id
   FOR KEY SHARE;

  v_display_name := COALESCE(
    NULLIF(pg_catalog.btrim(v_business_name), ''),
    NULLIF(pg_catalog.btrim(v_company_name), '')
  );
  IF v_display_name IS NULL THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: missing-issuer-name';
  END IF;

  -- One dealer/key advisory arbiter protects same-key races on different sources.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_dealer_id::text || ':' || v_key, 0));

  v_request_fp := private.certificate_r1_sha256_v1(
    private.certificate_r2_request_canonical_v1(p_completion_report_id, v_kind));

  SELECT r.request_fingerprint, i.id AS issuance_id,
         i.certificate_number, i.issued_on, i.source_fingerprint
    INTO v_request
    FROM public.certificate_issuance_requests r
    JOIN public.certificate_issuances i
      ON i.id = r.issuance_id AND i.dealer_id = r.dealer_id
   WHERE r.dealer_id = v_dealer_id
     AND r.idempotency_key = v_key;
  IF FOUND THEN
    IF v_request.request_fingerprint <> v_request_fp THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: key belongs to another request';
    END IF;
    RETURN QUERY SELECT v_request.issuance_id, v_request.certificate_number,
      v_request.issued_on, v_request.source_fingerprint,
      'replayed'::text, false, true;
    RETURN;
  END IF;

  SELECT i.id AS issuance_id, i.certificate_number, i.issued_on, i.source_fingerprint
    INTO v_existing
    FROM public.certificate_issuances i
   WHERE i.dealer_id = v_dealer_id
     AND i.completion_report_id = p_completion_report_id
     AND i.document_class = v_document_class;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.issuance_id, v_existing.certificate_number,
      v_existing.issued_on, v_existing.source_fingerprint,
      'already_issued'::text, false, false;
    RETURN;
  END IF;

  v_issuer := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'displayName', v_display_name,
    'companyName', CASE
      WHEN NULLIF(pg_catalog.btrim(v_company_name), '') IS DISTINCT FROM v_display_name
        THEN NULLIF(pg_catalog.btrim(v_company_name), '')
      ELSE NULL END,
    'postalCode', NULLIF(pg_catalog.btrim(v_postal_code), ''),
    'address', NULLIF(pg_catalog.btrim(v_business_address), ''),
    'tel', NULLIF(pg_catalog.btrim(v_business_phone), ''),
    'email', NULLIF(pg_catalog.btrim(v_business_email), ''),
    'website', NULLIF(pg_catalog.btrim(v_business_website), ''),
    'invoiceRegistrationNumber', NULLIF(pg_catalog.btrim(v_invoice_number), ''),
    'detailerRank', NULLIF(pg_catalog.btrim(v_detailer_rank), ''),
    'logoMode', CASE
      WHEN NULLIF(pg_catalog.btrim(v_logo_path), '') IS NOT NULL
        OR NULLIF(pg_catalog.btrim(v_logo_url), '') IS NOT NULL
      THEN 'dealer' ELSE 'da-default' END
  ));

  v_projection := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'documentClass', v_document_class,
    'certificateKind', v_kind,
    'customer', pg_catalog.jsonb_build_object(
      'name', v_customer_name,
      'honorific', CASE WHEN v_customer.is_business THEN '御中' ELSE '様' END
    ),
    'vehicle', pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'name', v_vehicle_name,
      'maker', NULLIF(pg_catalog.btrim(v_vehicle.maker), ''),
      'model', NULLIF(pg_catalog.btrim(v_vehicle.model), ''),
      'year', NULLIF(pg_catalog.btrim(v_vehicle.year), ''),
      'grade', NULLIF(pg_catalog.btrim(v_vehicle.grade), ''),
      'vin', NULLIF(pg_catalog.btrim(v_vehicle.vin), ''),
      'plate', NULLIF(pg_catalog.btrim(v_vehicle.plate_number), ''),
      'color', NULLIF(pg_catalog.btrim(v_vehicle.color), '')
    )),
    'installation', pg_catalog.jsonb_build_object(
      'appliedDate', (v_wo.actual_end_at AT TIME ZONE 'Asia/Tokyo')::date::text,
      'technician', pg_catalog.btrim(v_wo.assigned_staff)
    ),
    'items', v_items
  ));

  v_source_payload := pg_catalog.jsonb_build_object(
    'issuer', v_issuer,
    'projection', v_projection
  );
  v_source_fp := private.certificate_r1_sha256_v1(
    private.certificate_r1_canonical_json_v1(v_source_payload));

  v_issued_at := pg_catalog.now();
  v_issued_on := (v_issued_at AT TIME ZONE 'Asia/Tokyo')::date;
  v_next := private.allocate_next_document_number_v1(
    v_dealer_id,
    v_sequence_type,
    EXTRACT(year FROM v_issued_on)::integer,
    v_prefix, 5, 'yearly'
  );
  v_number := v_prefix || '/' || EXTRACT(year FROM v_issued_on)::integer::text
              || '/' || pg_catalog.lpad(v_next::text, 5, '0');

  v_snapshot := v_projection || pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'certificateNumber', v_number,
    'issueDate', v_issued_on::text,
    'issuer', v_issuer
  );

  PERFORM pg_catalog.set_config(
    'dealeros.certificate_r1_authority', 'issue_installation_certificate_r2_v1', true);

  INSERT INTO public.certificate_issuances (
    dealer_id, completion_report_id, work_order_id, document_class,
    certificate_number, source_contract_version, source_fingerprint,
    snapshot, issued_on, issued_at, issued_by
  ) VALUES (
    v_dealer_id, p_completion_report_id, v_work_order_id,
    v_document_class, v_number, 2, v_source_fp,
    v_snapshot, v_issued_on, v_issued_at, v_actor
  ) RETURNING id INTO v_issuance_id;

  INSERT INTO public.certificate_issuance_requests (
    dealer_id, idempotency_key, request_fingerprint, completion_report_id,
    issuance_id, actor_user_id, outcome
  ) VALUES (
    v_dealer_id, v_key, v_request_fp, p_completion_report_id,
    v_issuance_id, v_actor, 'created'
  );

  INSERT INTO public.certificate_audit_events (
    dealer_id, issuance_id, event_type, actor_user_id, event_data, occurred_at
  ) VALUES (
    v_dealer_id, v_issuance_id, 'issued', v_actor,
    pg_catalog.jsonb_build_object(
      'documentClass', v_document_class,
      'certificateKind', v_kind
    ),
    v_issued_at
  );

  PERFORM pg_catalog.set_config('dealeros.certificate_r1_authority', '', true);

  RETURN QUERY SELECT v_issuance_id, v_number, v_issued_on, v_source_fp,
    'created'::text, true, false;
END;
$$;

-- ── 7. Exact function privileges. ───────────────────────────────────────────

CREATE FUNCTION public.finalize_installation_certificate_r2_document_v1(
  p_dealer_id uuid,
  p_issuance_id uuid,
  p_document_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_template_version text,
  p_actor_user_id uuid
)
RETURNS TABLE (
  document_id uuid,
  issuance_id uuid,
  storage_bucket text,
  storage_path text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  template_version text,
  generated_at timestamptz,
  outcome text,
  created boolean,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_issuance record;
  v_existing record;
  v_object_metadata jsonb;
  v_expected_path text;
  v_generated_at timestamptz;
BEGIN
  IF p_dealer_id IS NULL OR p_issuance_id IS NULL
     OR p_document_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: required UUID is missing';
  END IF;

  v_expected_path := p_dealer_id::text
    || '/certificates/installation-r2/' || p_issuance_id::text
    || '/' || p_document_id::text || '.pdf';

  IF p_storage_bucket IS DISTINCT FROM 'documents'
     OR p_storage_path IS DISTINCT FROM v_expected_path
     OR p_mime_type IS DISTINCT FROM 'application/pdf'
     OR p_byte_size IS NULL OR p_byte_size < 1 OR p_byte_size > 20971520
     OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR p_template_version IS DISTINCT FROM 'installation-certificate-r2-v1' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: document metadata is invalid';
  END IF;

  -- One issuance-scoped arbiter serializes missing-row races. The issuance row
  -- is then locked before any existing document is inspected.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'installation-certificate-r2-document:' || p_dealer_id::text
      || ':' || p_issuance_id::text,
    0
  ));

  SELECT i.id, i.dealer_id, i.document_class, i.source_contract_version
    INTO v_issuance
    FROM public.certificate_issuances i
   WHERE i.id = p_issuance_id
     AND i.dealer_id = p_dealer_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_issuance.document_class NOT IN (
       'installation-certificate-coating-r2',
       'installation-certificate-ppf-r2',
       'installation-certificate-cancoat-r2'
     )
     OR v_issuance.source_contract_version IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'NOT_FOUND: installation certificate R2 issuance not found';
  END IF;

  -- The supplied actor is data, not ambient authority. Revalidate the exact
  -- actor/dealer pair with the established fail-closed role resolver.
  PERFORM private.resolve_completion_actor_role_v1(p_dealer_id, p_actor_user_id);

  SELECT d.* INTO v_existing
    FROM public.certificate_documents d
   WHERE d.issuance_id = p_issuance_id
     AND d.revision = 1
   FOR UPDATE;

  IF FOUND AND (
    v_existing.id IS DISTINCT FROM p_document_id
    OR v_existing.dealer_id IS DISTINCT FROM p_dealer_id
    OR v_existing.storage_bucket IS DISTINCT FROM p_storage_bucket
    OR v_existing.storage_path IS DISTINCT FROM p_storage_path
    OR v_existing.mime_type IS DISTINCT FROM p_mime_type
    OR v_existing.byte_size IS DISTINCT FROM p_byte_size
    OR v_existing.sha256 IS DISTINCT FROM p_sha256
    OR v_existing.template_version IS DISTINCT FROM p_template_version
  ) THEN
    RAISE EXCEPTION 'ARTIFACT_CONFLICT: canonical document already finalized';
  END IF;

  SELECT o.metadata INTO v_object_metadata
    FROM storage.objects o
   WHERE o.bucket_id = p_storage_bucket
     AND o.name = p_storage_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARTIFACT_MISSING: uploaded object not found';
  END IF;
  IF pg_catalog.jsonb_typeof(v_object_metadata) IS DISTINCT FROM 'object'
     OR v_object_metadata ->> 'mimetype' IS DISTINCT FROM p_mime_type
     OR COALESCE(v_object_metadata ->> 'size', '') !~ '^[0-9]+$'
     OR (v_object_metadata ->> 'size')::bigint IS DISTINCT FROM p_byte_size THEN
    RAISE EXCEPTION 'ARTIFACT_INTEGRITY_ERROR: uploaded object metadata mismatch';
  END IF;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_existing.id, v_existing.issuance_id,
      v_existing.storage_bucket, v_existing.storage_path,
      v_existing.mime_type, v_existing.byte_size,
      v_existing.sha256, v_existing.template_version,
      v_existing.generated_at,
      'replayed'::text, false, true;
    RETURN;
  END IF;

  v_generated_at := pg_catalog.now();
  BEGIN
    PERFORM pg_catalog.set_config(
      'dealeros.certificate_r1_authority',
      'finalize_installation_certificate_r2_document_v1',
      true
    );

    INSERT INTO public.certificate_documents (
      id, dealer_id, issuance_id, revision,
      storage_bucket, storage_path, mime_type, byte_size, sha256,
      template_version, generated_at, generated_by
    ) VALUES (
      p_document_id, p_dealer_id, p_issuance_id, 1,
      p_storage_bucket, p_storage_path, p_mime_type, p_byte_size, p_sha256,
      p_template_version, v_generated_at, p_actor_user_id
    );

    INSERT INTO public.certificate_audit_events (
      dealer_id, issuance_id, event_type, actor_user_id, event_data, occurred_at
    ) VALUES (
      p_dealer_id, p_issuance_id, 'document_stored', p_actor_user_id,
      pg_catalog.jsonb_build_object('documentId', p_document_id, 'revision', 1),
      v_generated_at
    );

    PERFORM pg_catalog.set_config('dealeros.certificate_r1_authority', '', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('dealeros.certificate_r1_authority', '', true);
    RAISE;
  END;

  RETURN QUERY SELECT
    p_document_id, p_issuance_id,
    p_storage_bucket, p_storage_path,
    p_mime_type, p_byte_size,
    p_sha256, p_template_version,
    v_generated_at,
    'created'::text, true, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gda_certificate_r1_authority_active()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.gda_certificate_r1_immutable_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.certificate_r1_canonical_json_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.certificate_r1_request_canonical_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.certificate_r1_sha256_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION private.certificate_r2_item_kind_v1(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.certificate_r2_request_canonical_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.issue_installation_certificate_r2_v1(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_installation_certificate_r2_v1(uuid, text, text)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_installation_certificate_r2_document_v1(
  uuid, uuid, uuid, text, text, text, bigint, text, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_installation_certificate_r2_document_v1(
  uuid, uuid, uuid, text, text, text, bigint, text, text, uuid
) TO service_role;

COMMENT ON FUNCTION public.issue_installation_certificate_r2_v1(uuid, text, text) IS
  'Atomic authenticated R2 issuance for coating, PPF or standalone CanCoat. '
  'Allocates CRT/CO, CRT/PPF or CRT/CC and preserves immutable kind snapshots.';
COMMENT ON FUNCTION public.finalize_installation_certificate_r2_document_v1(
  uuid, uuid, uuid, text, text, text, bigint, text, text, uuid
) IS
  'Service-only fail-closed R2 PDF metadata finalization for kind-specific certificates.';

COMMIT;
