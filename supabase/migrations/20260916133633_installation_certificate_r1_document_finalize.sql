-- GDA Installation Certificate R1-C1-G1 — private PDF metadata finalization.
-- Source contract: GDA_INSTALLATION_CERTIFICATE_R1_C1_CONTRACT_V1.
-- This migration never renders, uploads, downloads, signs, or deletes a Storage object.

BEGIN;

-- The original R1-B2 guard recognized one broad issuance authority. Replace
-- only the trigger guard so every authority is constrained to its own table
-- and, for the shared audit table, its own event type.
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
    RAISE EXCEPTION 'PERMISSION_DENIED: certificate R1 rows are immutable';
  END IF;

  IF v_authority = 'issue_installation_certificate_r1_v1' THEN
    v_allowed := TG_TABLE_NAME IN (
      'certificate_issuances', 'certificate_issuance_requests'
    ) OR (
      TG_TABLE_NAME = 'certificate_audit_events'
      AND NEW.event_type = 'issued'
    );
  ELSIF v_authority = 'finalize_installation_certificate_r1_document_v1' THEN
    v_allowed := TG_TABLE_NAME = 'certificate_documents' OR (
      TG_TABLE_NAME = 'certificate_audit_events'
      AND NEW.event_type = 'document_stored'
    );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: certificate R1 rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.finalize_installation_certificate_r1_document_v1(
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
    || '/certificates/installation-r1/' || p_issuance_id::text
    || '/' || p_document_id::text || '.pdf';

  IF p_storage_bucket IS DISTINCT FROM 'documents'
     OR p_storage_path IS DISTINCT FROM v_expected_path
     OR p_mime_type IS DISTINCT FROM 'application/pdf'
     OR p_byte_size IS NULL OR p_byte_size < 1 OR p_byte_size > 20971520
     OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR p_template_version IS DISTINCT FROM 'installation-certificate-r1-v1' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: document metadata is invalid';
  END IF;

  -- One issuance-scoped arbiter serializes missing-row races. The issuance row
  -- is then locked before any existing document is inspected.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'installation-certificate-r1-document:' || p_dealer_id::text
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
     OR v_issuance.document_class IS DISTINCT FROM 'installation-certificate-r1'
     OR v_issuance.source_contract_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'NOT_FOUND: installation certificate issuance not found';
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
      'finalize_installation_certificate_r1_document_v1',
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

REVOKE EXECUTE ON FUNCTION public.finalize_installation_certificate_r1_document_v1(
  uuid, uuid, uuid, text, text, text, bigint, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_installation_certificate_r1_document_v1(
  uuid, uuid, uuid, text, text, text, bigint, text, text, uuid
) TO service_role;

COMMENT ON FUNCTION public.finalize_installation_certificate_r1_document_v1(
  uuid, uuid, uuid, text, text, text, bigint, text, text, uuid
) IS
  'Service-only, fail-closed R1 PDF metadata finalization after exact private '
  'Storage object verification. Exact replay is zero-write.';

COMMIT;
