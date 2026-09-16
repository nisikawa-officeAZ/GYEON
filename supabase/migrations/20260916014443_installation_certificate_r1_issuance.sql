-- GDA Installation Certificate R1-B2 — atomic non-warranty issuance authority.
-- Source contract: GDA_INSTALLATION_CERTIFICATE_R1_B2_CONTRACT_V1.
-- This migration creates no Storage bucket and uploads/renders no PDF.

BEGIN;

-- ── 1. Extend the existing closed numbering type without narrowing it. ──────

ALTER TABLE public.document_sequences
  DROP CONSTRAINT IF EXISTS document_sequences_sequence_type_check;
ALTER TABLE public.document_sequences
  ADD CONSTRAINT document_sequences_sequence_type_check
  CHECK (sequence_type IN (
    'estimate', 'work_order', 'completion_report',
    'invoice', 'payment', 'maintenance_reminder',
    'product_order', 'reservation', 'monthly_invoice',
    'installation_certificate_r1'
  ));

-- ── 2. Immutable issuance, request, document-metadata and audit tables. ─────

CREATE TABLE public.certificate_issuances (
  id                      uuid        PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  dealer_id               uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  completion_report_id    uuid        NOT NULL,
  work_order_id           uuid        NOT NULL,
  document_class          text        NOT NULL,
  certificate_number      text        NOT NULL,
  source_contract_version smallint    NOT NULL,
  source_fingerprint      text        NOT NULL,
  snapshot                jsonb       NOT NULL,
  issued_on               date        NOT NULL,
  issued_at               timestamptz NOT NULL DEFAULT pg_catalog.now(),
  issued_by               uuid        NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT certificate_issuances_id_dealer_uidx UNIQUE (id, dealer_id),
  CONSTRAINT certificate_issuances_source_uidx
    UNIQUE (dealer_id, completion_report_id, document_class),
  CONSTRAINT certificate_issuances_number_uidx
    UNIQUE (dealer_id, certificate_number),
  CONSTRAINT certificate_issuances_report_dealer_fkey
    FOREIGN KEY (completion_report_id, dealer_id)
    REFERENCES public.completion_reports(id, dealer_id) ON DELETE RESTRICT,
  CONSTRAINT certificate_issuances_work_order_dealer_fkey
    FOREIGN KEY (work_order_id, dealer_id)
    REFERENCES public.work_orders(id, dealer_id) ON DELETE RESTRICT,
  CONSTRAINT certificate_issuances_document_class_check
    CHECK (document_class = 'installation-certificate-r1'),
  CONSTRAINT certificate_issuances_number_check
    CHECK (certificate_number ~ '^CRT/IN/[0-9]{4}/[0-9]{5,}$'),
  CONSTRAINT certificate_issuances_contract_version_check
    CHECK (source_contract_version = 1),
  CONSTRAINT certificate_issuances_source_fingerprint_check
    CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT certificate_issuances_snapshot_check
    CHECK (
      pg_catalog.jsonb_typeof(snapshot) = 'object'
      AND snapshot ->> 'documentClass' = document_class
      AND snapshot ->> 'certificateNumber' = certificate_number
      AND snapshot ->> 'issueDate' = issued_on::text
      AND snapshot ->> 'schemaVersion' = '1'
      AND pg_catalog.jsonb_typeof(snapshot -> 'customer') = 'object'
      AND pg_catalog.jsonb_typeof(snapshot -> 'vehicle') = 'object'
      AND pg_catalog.jsonb_typeof(snapshot -> 'installation') = 'object'
      AND pg_catalog.jsonb_typeof(snapshot -> 'items') = 'array'
      AND pg_catalog.jsonb_typeof(snapshot -> 'issuer') = 'object'
    )
);

CREATE INDEX certificate_issuances_dealer_issued_idx
  ON public.certificate_issuances(dealer_id, issued_at DESC);
CREATE INDEX certificate_issuances_work_order_idx
  ON public.certificate_issuances(work_order_id);

CREATE TABLE public.certificate_issuance_requests (
  id                   uuid        PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  dealer_id            uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  idempotency_key      text        NOT NULL,
  request_fingerprint  text        NOT NULL,
  completion_report_id uuid        NOT NULL,
  issuance_id          uuid        NOT NULL,
  actor_user_id        uuid        NOT NULL,
  outcome              text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT certificate_issuance_requests_dealer_key_uidx
    UNIQUE (dealer_id, idempotency_key),
  CONSTRAINT certificate_issuance_requests_report_dealer_fkey
    FOREIGN KEY (completion_report_id, dealer_id)
    REFERENCES public.completion_reports(id, dealer_id) ON DELETE RESTRICT,
  CONSTRAINT certificate_issuance_requests_issuance_dealer_fkey
    FOREIGN KEY (issuance_id, dealer_id)
    REFERENCES public.certificate_issuances(id, dealer_id) ON DELETE RESTRICT,
  CONSTRAINT certificate_issuance_requests_key_check
    CHECK (
      idempotency_key = pg_catalog.btrim(idempotency_key)
      AND pg_catalog.char_length(idempotency_key) BETWEEN 16 AND 128
      AND idempotency_key ~ '^[!-~]+$'
    ),
  CONSTRAINT certificate_issuance_requests_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT certificate_issuance_requests_outcome_check
    CHECK (outcome = 'created')
);

CREATE INDEX certificate_issuance_requests_report_idx
  ON public.certificate_issuance_requests(completion_report_id);
CREATE INDEX certificate_issuance_requests_issuance_idx
  ON public.certificate_issuance_requests(issuance_id);

CREATE TABLE public.certificate_documents (
  id               uuid        PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  dealer_id        uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  issuance_id      uuid        NOT NULL,
  revision         integer     NOT NULL,
  storage_bucket   text        NOT NULL,
  storage_path     text        NOT NULL,
  mime_type        text        NOT NULL,
  byte_size        bigint      NOT NULL,
  sha256           text        NOT NULL,
  template_version text        NOT NULL,
  generated_at     timestamptz NOT NULL,
  generated_by     uuid        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT certificate_documents_issuance_dealer_fkey
    FOREIGN KEY (issuance_id, dealer_id)
    REFERENCES public.certificate_issuances(id, dealer_id) ON DELETE RESTRICT,
  CONSTRAINT certificate_documents_issuance_revision_uidx UNIQUE (issuance_id, revision),
  CONSTRAINT certificate_documents_storage_object_uidx UNIQUE (storage_bucket, storage_path),
  CONSTRAINT certificate_documents_revision_check CHECK (revision = 1),
  CONSTRAINT certificate_documents_bucket_check
    CHECK (storage_bucket = pg_catalog.btrim(storage_bucket) AND storage_bucket <> ''),
  CONSTRAINT certificate_documents_path_check
    CHECK (storage_path = pg_catalog.btrim(storage_path) AND storage_path <> ''),
  CONSTRAINT certificate_documents_mime_check CHECK (mime_type = 'application/pdf'),
  CONSTRAINT certificate_documents_size_check CHECK (byte_size > 0),
  CONSTRAINT certificate_documents_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT certificate_documents_template_check
    CHECK (template_version = pg_catalog.btrim(template_version) AND template_version <> '')
);

CREATE INDEX certificate_documents_dealer_idx ON public.certificate_documents(dealer_id);

CREATE TABLE public.certificate_audit_events (
  id            uuid        PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  dealer_id     uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  issuance_id   uuid        NOT NULL,
  event_type    text        NOT NULL,
  actor_user_id uuid        NOT NULL,
  event_data    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT certificate_audit_events_issuance_dealer_fkey
    FOREIGN KEY (issuance_id, dealer_id)
    REFERENCES public.certificate_issuances(id, dealer_id) ON DELETE RESTRICT,
  CONSTRAINT certificate_audit_events_type_check
    CHECK (event_type IN ('issued', 'document_stored', 'reprinted')),
  CONSTRAINT certificate_audit_events_data_check
    CHECK (pg_catalog.jsonb_typeof(event_data) = 'object')
);

CREATE INDEX certificate_audit_events_issuance_idx
  ON public.certificate_audit_events(issuance_id, occurred_at);
CREATE INDEX certificate_audit_events_dealer_idx
  ON public.certificate_audit_events(dealer_id, occurred_at DESC);

-- ── 3. RLS and least-privilege table grants. ────────────────────────────────

ALTER TABLE public.certificate_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_issuances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_issuance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_issuance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY certificate_issuances_same_dealer_select
  ON public.certificate_issuances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dealer_staff ds
       WHERE ds.dealer_id = certificate_issuances.dealer_id
         AND ds.user_id = auth.uid()
         AND ds.status = 'active'
         AND ds.role IN ('owner', 'manager', 'staff', 'readonly')
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.dealer_staff ds
         WHERE ds.dealer_id = certificate_issuances.dealer_id
           AND ds.user_id = auth.uid()
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.dealer_members dm
           WHERE dm.dealer_id = certificate_issuances.dealer_id
             AND dm.user_id = auth.uid()
             AND dm.status = 'active'
             AND dm.role IN ('owner', 'manager', 'staff', 'readonly')
        )
        OR EXISTS (
          SELECT 1 FROM public.dealers d
           WHERE d.id = certificate_issuances.dealer_id
             AND d.owner_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY certificate_documents_same_dealer_select
  ON public.certificate_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dealer_staff ds
       WHERE ds.dealer_id = certificate_documents.dealer_id
         AND ds.user_id = auth.uid()
         AND ds.status = 'active'
         AND ds.role IN ('owner', 'manager', 'staff', 'readonly')
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.dealer_staff ds
         WHERE ds.dealer_id = certificate_documents.dealer_id
           AND ds.user_id = auth.uid()
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.dealer_members dm
           WHERE dm.dealer_id = certificate_documents.dealer_id
             AND dm.user_id = auth.uid()
             AND dm.status = 'active'
             AND dm.role IN ('owner', 'manager', 'staff', 'readonly')
        )
        OR EXISTS (
          SELECT 1 FROM public.dealers d
           WHERE d.id = certificate_documents.dealer_id
             AND d.owner_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY certificate_audit_events_manager_select
  ON public.certificate_audit_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dealer_staff ds
       WHERE ds.dealer_id = certificate_audit_events.dealer_id
         AND ds.user_id = auth.uid()
         AND ds.status = 'active'
         AND ds.role IN ('owner', 'manager')
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.dealer_staff ds
         WHERE ds.dealer_id = certificate_audit_events.dealer_id
           AND ds.user_id = auth.uid()
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.dealer_members dm
           WHERE dm.dealer_id = certificate_audit_events.dealer_id
             AND dm.user_id = auth.uid()
             AND dm.status = 'active'
             AND dm.role IN ('owner', 'manager')
        )
        OR EXISTS (
          SELECT 1 FROM public.dealers d
           WHERE d.id = certificate_audit_events.dealer_id
             AND d.owner_user_id = auth.uid()
        )
      )
    )
  );

REVOKE ALL ON public.certificate_issuances FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.certificate_issuance_requests FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.certificate_documents FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.certificate_audit_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.certificate_issuances TO authenticated;
GRANT SELECT ON public.certificate_documents TO authenticated;
GRANT SELECT ON public.certificate_audit_events TO authenticated;

-- ── 4. Guard every immutable R1 authority table. ────────────────────────────

CREATE FUNCTION public.gda_certificate_r1_authority_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.current_setting('dealeros.certificate_r1_authority', true)
         = 'issue_installation_certificate_r1_v1';
$$;

CREATE FUNCTION public.gda_certificate_r1_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR NOT public.gda_certificate_r1_authority_active() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: certificate R1 rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certificate_issuances_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.certificate_issuances
  FOR EACH ROW EXECUTE FUNCTION public.gda_certificate_r1_immutable_guard();
CREATE TRIGGER trg_certificate_issuance_requests_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.certificate_issuance_requests
  FOR EACH ROW EXECUTE FUNCTION public.gda_certificate_r1_immutable_guard();
CREATE TRIGGER trg_certificate_documents_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.certificate_documents
  FOR EACH ROW EXECUTE FUNCTION public.gda_certificate_r1_immutable_guard();
CREATE TRIGGER trg_certificate_audit_events_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.certificate_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.gda_certificate_r1_immutable_guard();

-- ── 5. Deterministic canonical JSON and SHA-256 helpers. ────────────────────

CREATE FUNCTION private.certificate_r1_canonical_json_v1(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_text text;
BEGIN
  v_type := pg_catalog.jsonb_typeof(p_value);
  IF v_type IS NULL OR v_type = 'null' THEN
    RETURN 'null';
  ELSIF v_type = 'string' THEN
    RETURN pg_catalog.to_json(p_value #>> '{}')::text;
  ELSIF v_type IN ('number', 'boolean') THEN
    RETURN p_value::text;
  ELSIF v_type = 'array' THEN
    SELECT '[' || COALESCE(pg_catalog.string_agg(
             private.certificate_r1_canonical_json_v1(e.value), ',' ORDER BY e.ordinality), '') || ']'
      INTO v_text
      FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY AS e(value, ordinality);
    RETURN v_text;
  ELSIF v_type = 'object' THEN
    SELECT '{' || COALESCE(pg_catalog.string_agg(
             pg_catalog.to_json(e.key)::text || ':' ||
             private.certificate_r1_canonical_json_v1(e.value), ',' ORDER BY e.key), '') || '}'
      INTO v_text
      FROM pg_catalog.jsonb_each(p_value) AS e(key, value);
    RETURN v_text;
  END IF;
  RAISE EXCEPTION 'VALIDATION_ERROR: unsupported canonical JSON value';
END;
$$;

CREATE FUNCTION private.certificate_r1_request_canonical_v1(p_completion_report_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.certificate_r1_canonical_json_v1(pg_catalog.jsonb_build_object(
    'completionReportId', p_completion_report_id::text,
    'contractVersion', 1,
    'documentClass', 'installation-certificate-r1'
  ));
$$;

CREATE FUNCTION private.certificate_r1_sha256_v1(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_text, 'UTF8')), 'hex');
$$;

-- ── 6. One atomic authenticated issuance operation. ─────────────────────────

CREATE FUNCTION public.issue_installation_certificate_r1_v1(
  p_completion_report_id uuid,
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
     AND i.completion_report_id = v_report.id;
  IF v_item_count < 1 OR v_items IS NULL THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: snapshot-empty';
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
    private.certificate_r1_request_canonical_v1(p_completion_report_id));

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
     AND i.document_class = 'installation-certificate-r1';
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
    'documentClass', 'installation-certificate-r1',
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
    'installation_certificate_r1',
    EXTRACT(year FROM v_issued_on)::integer,
    'CRT/IN', 5, 'yearly'
  );
  v_number := 'CRT/IN/' || EXTRACT(year FROM v_issued_on)::integer::text
              || '/' || pg_catalog.lpad(v_next::text, 5, '0');

  v_snapshot := v_projection || pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'certificateNumber', v_number,
    'issueDate', v_issued_on::text,
    'issuer', v_issuer
  );

  PERFORM pg_catalog.set_config(
    'dealeros.certificate_r1_authority', 'issue_installation_certificate_r1_v1', true);

  INSERT INTO public.certificate_issuances (
    dealer_id, completion_report_id, work_order_id, document_class,
    certificate_number, source_contract_version, source_fingerprint,
    snapshot, issued_on, issued_at, issued_by
  ) VALUES (
    v_dealer_id, p_completion_report_id, v_work_order_id,
    'installation-certificate-r1', v_number, 1, v_source_fp,
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
    pg_catalog.jsonb_build_object('documentClass', 'installation-certificate-r1'),
    v_issued_at
  );

  PERFORM pg_catalog.set_config('dealeros.certificate_r1_authority', '', true);

  RETURN QUERY SELECT v_issuance_id, v_number, v_issued_on, v_source_fp,
    'created'::text, true, false;
END;
$$;

-- ── 7. Exact function privileges. ───────────────────────────────────────────

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
REVOKE EXECUTE ON FUNCTION public.issue_installation_certificate_r1_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_installation_certificate_r1_v1(uuid, text)
  TO authenticated;

COMMENT ON TABLE public.certificate_issuances IS
  'Immutable common non-warranty R1 installation-certificate snapshots.';
COMMENT ON TABLE public.certificate_issuance_requests IS
  'Immutable R1 issuance idempotency arbiter; no application table access.';
COMMENT ON TABLE public.certificate_documents IS
  'Private canonical PDF metadata boundary; R1-C1 will authorize first insert.';
COMMENT ON TABLE public.certificate_audit_events IS
  'Append-only minimal certificate issuance/document/reprint audit events.';
COMMENT ON FUNCTION public.issue_installation_certificate_r1_v1(uuid, text) IS
  'Atomic authenticated R1 non-warranty issuance. Rebuilds canonical source, '
  'allocates CRT/IN/YYYY/NNNNN, and commits immutable snapshot, request and audit.';

COMMIT;
