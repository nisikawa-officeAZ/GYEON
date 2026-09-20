-- ESTIMATE-REVISION-R1
--
-- Formal "issue a new version" contract for canonical Estimate Wizard v2.2.
-- The predecessor estimate is never updated. A revision is a newly numbered estimate,
-- linked to one immutable predecessor and backed by the exact validated wizard draft
-- that produced it. Legacy estimates without a canonical snapshot fail closed.

BEGIN;

CREATE TABLE public.estimate_wizard_snapshots (
  estimate_id              uuid PRIMARY KEY REFERENCES public.estimates(id) ON DELETE RESTRICT,
  dealer_id                uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  schema_version           text NOT NULL CHECK (schema_version = '2.2'),
  draft_snapshot           jsonb NOT NULL CHECK (jsonb_typeof(draft_snapshot) = 'object'),
  snapshot_fingerprint     text NOT NULL CHECK (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  configuration_revision   bigint NOT NULL CHECK (configuration_revision >= 0),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, estimate_id)
);

CREATE INDEX estimate_wizard_snapshots_dealer_created_idx
  ON public.estimate_wizard_snapshots (dealer_id, created_at DESC);

CREATE TABLE public.estimate_revisions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id                   uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  root_estimate_id            uuid NOT NULL REFERENCES public.estimates(id) ON DELETE RESTRICT,
  predecessor_estimate_id     uuid NOT NULL REFERENCES public.estimates(id) ON DELETE RESTRICT,
  successor_estimate_id       uuid NOT NULL REFERENCES public.estimates(id) ON DELETE RESTRICT,
  revision_number             integer NOT NULL CHECK (revision_number >= 2),
  source_snapshot_fingerprint text NOT NULL CHECK (source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by                  uuid NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CHECK (predecessor_estimate_id <> successor_estimate_id),
  UNIQUE (predecessor_estimate_id),
  UNIQUE (successor_estimate_id),
  UNIQUE (root_estimate_id, revision_number)
);

CREATE INDEX estimate_revisions_dealer_root_idx
  ON public.estimate_revisions (dealer_id, root_estimate_id, revision_number);

ALTER TABLE public.estimate_wizard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.estimate_wizard_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.estimate_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.estimate_wizard_snapshots TO service_role;
GRANT SELECT, INSERT ON TABLE public.estimate_revisions TO service_role;

CREATE FUNCTION public.reject_estimate_revision_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_HISTORY: estimate revision history cannot be changed';
END;
$fn$;

CREATE TRIGGER estimate_wizard_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.estimate_wizard_snapshots
FOR EACH ROW EXECUTE FUNCTION public.reject_estimate_revision_history_mutation();

CREATE TRIGGER estimate_revisions_immutable
BEFORE UPDATE OR DELETE ON public.estimate_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_estimate_revision_history_mutation();

-- Snapshot-backed estimate content is immutable even if a stale/dead legacy
-- action or a direct SQL caller survives elsewhere. Workflow status remains a
-- separate lifecycle concern and may change together with updated_at.
CREATE FUNCTION public.protect_snapshot_backed_estimate_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.estimate_wizard_snapshots s WHERE s.estimate_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'IMMUTABLE_ESTIMATE: snapshot-backed estimate cannot be deleted';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status', 'updated_at']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'updated_at']::text[])
    THEN
      RAISE EXCEPTION 'IMMUTABLE_ESTIMATE: issue a new version instead of updating content';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

CREATE TRIGGER estimates_snapshot_content_immutable
BEFORE UPDATE OR DELETE ON public.estimates
FOR EACH ROW EXECUTE FUNCTION public.protect_snapshot_backed_estimate_content();

CREATE FUNCTION public.protect_snapshot_backed_estimate_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_old_estimate_id uuid;
  v_new_estimate_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_estimate_id := OLD.estimate_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_estimate_id := NEW.estimate_id;
  END IF;

  -- UPDATE must check BOTH parents. Checking only NEW would let a caller move an
  -- immutable line away from its snapshot-backed predecessor into a legacy row.
  IF EXISTS (
    SELECT 1
      FROM public.estimate_wizard_snapshots s
     WHERE s.estimate_id = v_old_estimate_id
        OR s.estimate_id = v_new_estimate_id
  ) THEN
    RAISE EXCEPTION 'IMMUTABLE_ESTIMATE: issue a new version instead of changing items';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

CREATE TRIGGER estimate_items_snapshot_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_items
FOR EACH ROW EXECUTE FUNCTION public.protect_snapshot_backed_estimate_items();

-- Validate only the minimum identity envelope here. The complete draft is already
-- validated by the authoritative TypeScript save-intent boundary before this RPC.
-- Keeping the raw snapshot beside the priced estimate is what makes exact revision
-- restoration possible without reconstructing intent from lossy line items.
CREATE FUNCTION public.assert_estimate_wizard_snapshot_v22(p_draft jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object'
     OR p_draft ->> 'version' IS DISTINCT FROM '2.2'
     OR jsonb_typeof(p_draft -> 'metadata') IS DISTINCT FROM 'object'
     OR p_draft #>> '{metadata,schemaVersion}' IS DISTINCT FROM '2.2'
     OR p_draft #>> '{metadata,source}' IS DISTINCT FROM 'estimate-wizard-v2.2'
  THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: canonical wizard snapshot required';
  END IF;
END;
$fn$;

CREATE FUNCTION public.save_estimate_from_wizard_v2(
  p_dealer_id       uuid,
  p_actor_user_id   uuid,
  p_payload         jsonb,
  p_draft_snapshot  jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_result      jsonb;
  v_estimate_id uuid;
  v_fingerprint text;
  v_existing_fp text;
  v_config_rev  bigint;
BEGIN
  PERFORM public.assert_estimate_wizard_snapshot_v22(p_draft_snapshot);

  v_fingerprint := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_draft_snapshot::text, 'UTF8')),
    'hex'
  );

  -- The nested call and snapshot insert share this transaction. Any failure below
  -- rolls back the new estimate and every row created by the existing save RPC.
  v_result := public.save_estimate_from_wizard(p_dealer_id, p_actor_user_id, p_payload);
  v_estimate_id := (v_result ->> 'estimate_id')::uuid;

  SELECT configuration_revision INTO v_config_rev
    FROM public.estimates
   WHERE id = v_estimate_id AND dealer_id = p_dealer_id;
  IF NOT FOUND OR v_config_rev IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: configuration revision required';
  END IF;

  IF coalesce((v_result ->> 'idempotent_replay')::boolean, false) THEN
    SELECT snapshot_fingerprint INTO v_existing_fp
      FROM public.estimate_wizard_snapshots
     WHERE estimate_id = v_estimate_id AND dealer_id = p_dealer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SNAPSHOT_MISSING: replay target has no canonical draft';
    END IF;
    IF v_existing_fp IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'DUPLICATE_SUBMISSION: snapshot differs for replay';
    END IF;
    RETURN v_result;
  END IF;

  INSERT INTO public.estimate_wizard_snapshots (
    estimate_id, dealer_id, schema_version, draft_snapshot,
    snapshot_fingerprint, configuration_revision
  ) VALUES (
    v_estimate_id, p_dealer_id, '2.2', p_draft_snapshot,
    v_fingerprint, v_config_rev
  );

  RETURN v_result;
END;
$fn$;

CREATE FUNCTION public.issue_estimate_revision_from_wizard(
  p_dealer_id                  uuid,
  p_actor_user_id              uuid,
  p_predecessor_estimate_id    uuid,
  p_source_snapshot_fingerprint text,
  p_payload                    jsonb,
  p_draft_snapshot             jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_source       record;
  v_prior        record;
  v_existing     record;
  v_result       jsonb;
  v_successor_id uuid;
  v_root_id      uuid;
  v_revision     integer;
  v_new_fp       text;
  v_config_rev   bigint;
  v_idem         text;
BEGIN
  PERFORM public.assert_estimate_wizard_snapshot_v22(p_draft_snapshot);
  IF p_predecessor_estimate_id IS NULL
     OR p_source_snapshot_fingerprint IS NULL
     OR p_source_snapshot_fingerprint !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: revision source required';
  END IF;

  SELECT e.id, e.dealer_id, s.snapshot_fingerprint
    INTO v_source
    FROM public.estimates e
    JOIN public.estimate_wizard_snapshots s ON s.estimate_id = e.id AND s.dealer_id = e.dealer_id
   WHERE e.id = p_predecessor_estimate_id AND e.dealer_id = p_dealer_id
   FOR UPDATE OF e;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVISION_SOURCE_UNAVAILABLE: canonical source not found';
  END IF;
  IF v_source.snapshot_fingerprint IS DISTINCT FROM p_source_snapshot_fingerprint THEN
    RAISE EXCEPTION 'REVISION_SOURCE_CHANGED: source snapshot mismatch';
  END IF;

  v_idem := p_payload ->> 'idempotencyKey';
  SELECT r.successor_estimate_id, e.estimate_number, e.customer_id, e.vehicle_id,
         e.idempotency_key, s.snapshot_fingerprint
    INTO v_existing
    FROM public.estimate_revisions r
    JOIN public.estimates e ON e.id = r.successor_estimate_id
    JOIN public.estimate_wizard_snapshots s ON s.estimate_id = e.id
   WHERE r.predecessor_estimate_id = p_predecessor_estimate_id
     AND r.dealer_id = p_dealer_id
     AND e.dealer_id = p_dealer_id
     AND s.dealer_id = p_dealer_id;
  IF FOUND THEN
    v_new_fp := pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_draft_snapshot::text, 'UTF8')),
      'hex'
    );
    IF v_existing.idempotency_key IS NOT DISTINCT FROM v_idem
       AND v_existing.snapshot_fingerprint IS NOT DISTINCT FROM v_new_fp
    THEN
      RETURN jsonb_build_object(
        'ok', true,
        'estimate_id', v_existing.successor_estimate_id,
        'estimate_number', v_existing.estimate_number,
        'customer_id', v_existing.customer_id,
        'vehicle_id', v_existing.vehicle_id,
        'idempotent_replay', true,
        'revision_replay', true
      );
    END IF;
    RAISE EXCEPTION 'REVISION_CONFLICT: predecessor already has a successor';
  END IF;

  SELECT root_estimate_id, revision_number
    INTO v_prior
    FROM public.estimate_revisions
   WHERE successor_estimate_id = p_predecessor_estimate_id
     AND dealer_id = p_dealer_id;
  IF FOUND THEN
    v_root_id := v_prior.root_estimate_id;
    v_revision := v_prior.revision_number + 1;
  ELSE
    v_root_id := p_predecessor_estimate_id;
    v_revision := 2;
  END IF;

  v_new_fp := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_draft_snapshot::text, 'UTF8')),
    'hex'
  );

  v_result := public.save_estimate_from_wizard(p_dealer_id, p_actor_user_id, p_payload);
  v_successor_id := (v_result ->> 'estimate_id')::uuid;

  IF coalesce((v_result ->> 'idempotent_replay')::boolean, false) THEN
    -- A free-standing estimate created by another flow may never be retroactively
    -- attached as a revision. Only the atomic path below may create this history.
    RAISE EXCEPTION 'REVISION_CONFLICT: successor idempotency key already exists';
  END IF;

  SELECT configuration_revision INTO v_config_rev
    FROM public.estimates
   WHERE id = v_successor_id AND dealer_id = p_dealer_id;
  IF NOT FOUND OR v_config_rev IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: configuration revision required';
  END IF;

  INSERT INTO public.estimate_wizard_snapshots (
    estimate_id, dealer_id, schema_version, draft_snapshot,
    snapshot_fingerprint, configuration_revision
  ) VALUES (
    v_successor_id, p_dealer_id, '2.2', p_draft_snapshot,
    v_new_fp, v_config_rev
  );

  INSERT INTO public.estimate_revisions (
    dealer_id, root_estimate_id, predecessor_estimate_id, successor_estimate_id,
    revision_number, source_snapshot_fingerprint, created_by
  ) VALUES (
    p_dealer_id, v_root_id, p_predecessor_estimate_id, v_successor_id,
    v_revision, p_source_snapshot_fingerprint, p_actor_user_id
  );

  RETURN v_result || jsonb_build_object(
    'revision_number', v_revision,
    'root_estimate_id', v_root_id,
    'predecessor_estimate_id', p_predecessor_estimate_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.reject_estimate_revision_history_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_snapshot_backed_estimate_content() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_snapshot_backed_estimate_items() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_estimate_wizard_snapshot_v22(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_estimate_from_wizard_v2(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_estimate_revision_from_wizard(uuid, uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard_v2(uuid, uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_estimate_revision_from_wizard(uuid, uuid, uuid, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_estimate_wizard_snapshot_v22(jsonb) TO service_role;

COMMENT ON TABLE public.estimate_wizard_snapshots IS
  'Immutable canonical Wizard v2.2 draft used to create an estimate; authority for exact revision restoration.';
COMMENT ON TABLE public.estimate_revisions IS
  'Immutable one-successor revision chain. A predecessor is never overwritten.';

COMMIT;
