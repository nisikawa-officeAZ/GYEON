-- Fix R1 immutable guard record-field access across heterogeneous tables.
--
-- PostgreSQL may evaluate both operands of a boolean expression. The previous
-- guard referenced NEW.event_type in an OR expression even when the trigger
-- was running for certificate_issuances, certificate_issuance_requests, or
-- certificate_documents, none of which has that column. Branch on the table
-- first so event_type is read only for certificate_audit_events.

BEGIN;

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
    IF TG_TABLE_NAME IN (
      'certificate_issuances', 'certificate_issuance_requests'
    ) THEN
      v_allowed := true;
    ELSIF TG_TABLE_NAME = 'certificate_audit_events' THEN
      v_allowed := NEW.event_type = 'issued';
    END IF;
  ELSIF v_authority = 'finalize_installation_certificate_r1_document_v1' THEN
    IF TG_TABLE_NAME = 'certificate_documents' THEN
      v_allowed := true;
    ELSIF TG_TABLE_NAME = 'certificate_audit_events' THEN
      v_allowed := NEW.event_type = 'document_stored';
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: certificate R1 rows are immutable';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
