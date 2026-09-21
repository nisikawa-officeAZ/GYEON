-- 20260921132331 — ESTIMATE-RUNTIME-REPAIR-R1: runtime-schema convergence.
--
-- FORWARD-ONLY, TRANSACTIONAL, FAIL-CLOSED. No existing migration is edited
-- and no migration-history table is written. Accepted read-only live preflight
-- found Staging/Production identical, holding the PRE-guard
-- save_estimate_from_wizard (bodySizeKey/body_size contract present, no
-- dealer_service_offerings guard) and NONE of the estimate revision objects,
-- while the canonical source migrations
--   * 20260830160000_estimate_managed_service_offering_guard.sql
--   * 20260920141616_estimate_revision_issuance.sql
-- define the required runtime. This migration converges BOTH supported
-- starting states to that canonical runtime:
--   A. live-equivalent: pre-guard save function present, revision objects
--      entirely absent;
--   B. fresh canonical: both canonical source migrations already applied.
--
-- CONTRACT
--   * Step 0 fails closed on a PARTIAL revision state: if only some of the
--     two revision tables, six revision functions, or four immutability
--     triggers exist, a stable ESTIMATE_RUNTIME_REPAIR_PRECONDITION error is
--     raised before anything is changed.
--   * public.save_estimate_from_wizard is upgraded via CREATE OR REPLACE to
--     the EXACT canonical definition copied VERBATIM from 20260830160000
--     (body-size behavior preserved; C.9a managed-service offering guard
--     included). Nothing is hand-reconstructed or simplified.
--   * The revision tables and their indexes are created with the EXACT
--     canonical DDL from 20260920141616, and ONLY when all revision objects
--     are absent. When all are present they are validated instead — no
--     destructive table recreation, no data rewrite.
--   * The six revision functions are converged via CREATE OR REPLACE to the
--     exact canonical bodies and security attributes (save RPCs remain
--     SECURITY INVOKER; the two snapshot-protection trigger functions remain
--     SECURITY DEFINER with pinned search_path, as canonical).
--   * The four immutability triggers are created with the exact canonical
--     definitions when missing and validated when present.
--   * Grants/revokes/comments are re-issued to the canonical least-privilege
--     end state: entry points EXECUTE only for service_role; PUBLIC, anon and
--     authenticated revoked everywhere. Step 6b then converges the ACLs
--     EXACTLY: every grantee outside the literal canonical allowlist (owner;
--     service_role SELECT, INSERT on the two revision tables; service_role
--     EXECUTE on the four canonical entry points) is revoked dynamically,
--     including column-level entries, so an ACL preserved by CREATE OR
--     REPLACE or an additive historical GRANT cannot survive convergence.
--     Plain REVOKE only (never CASCADE): a dependent grant chain raises and
--     fails the repair closed.
--   * NO business-row backfill: this migration contains no INSERT, UPDATE or
--     DELETE against customers, vehicles, estimates, estimate_items or any
--     other business table.
--   * No CASCADE, no broad exception handler, no migration repair.
--   * Steps 7-7i re-validate identity/security/shape at the end. Step 7h
--     proves that every accepted all-present table state is EXACTLY the
--     canonical shape — columns/types/NOT NULL/DEFAULT expressions, every
--     named constraint with its exact definition (including exact CHECK
--     expressions and PK/UNIQUE/FK semantics), and every exact named index
--     definition, with extra columns/constraints/indexes/triggers/policies
--     rejected — by replaying the VERBATIM canonical DDL into a scratch
--     schema inside this same transaction and requiring server-rendered
--     equality with the live tables. Step 7i proves the exact ACL
--     grantee/privilege end state (no unknown grantee, no grant option, no
--     column ACL, canonical owner privileges intact). Any violation raises
--     and rolls the entire transaction back before commit.

BEGIN;

-- --- Step 0: fail-closed preconditions ---------------------------------------
DO $precheck$
DECLARE
  v_name    text;
  v_present integer := 0;
  v_total   constant integer := 12;
BEGIN
  -- 0a. Base runtime prerequisites shared by BOTH supported starting states.
  FOREACH v_name IN ARRAY ARRAY[
    'public.estimates', 'public.estimate_items', 'public.customers',
    'public.vehicles', 'public.dealers', 'public.dealer_members',
    'public.dealer_staff', 'public.document_sequences',
    'public.dealer_service_offerings']
  LOOP
    IF to_regclass(v_name) IS NULL THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_PRECONDITION: required table % is missing', v_name;
    END IF;
  END LOOP;

  FOR v_name IN
    SELECT t.tbl || '.' || t.col
      FROM (VALUES
        ('public.vehicles',                 'body_size'),
        ('public.estimates',                'configuration_revision'),
        ('public.estimates',                'idempotency_key'),
        ('public.estimates',                'idempotency_fingerprint'),
        ('public.dealer_service_offerings', 'dealer_id'),
        ('public.dealer_service_offerings', 'family'),
        ('public.dealer_service_offerings', 'enabled')
      ) AS t(tbl, col)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = to_regclass(t.tbl)
          AND a.attname  = t.col
          AND a.attnum > 0
          AND NOT a.attisdropped)
  LOOP
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_PRECONDITION: required column % is missing', v_name;
  END LOOP;

  IF to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)') IS NULL
     OR to_regprocedure('public.wiz_document_fiscal_year(text,timestamptz)') IS NULL
     OR to_regprocedure('public.wiz_format_document_number(text,integer,integer,integer)') IS NULL
  THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_PRECONDITION: canonical wizard save/numbering functions are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'estimates_dealer_idempotency_key_uidx'
       AND c.relkind = 'i')
  THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_PRECONDITION: estimates idempotency unique index is missing';
  END IF;

  -- 0b. Revision state must be ALL-ABSENT or ALL-PRESENT. Anything partial is
  --     an unknown hand-modified runtime and is refused before any change.
  v_present :=
      (to_regclass('public.estimate_wizard_snapshots') IS NOT NULL)::integer
    + (to_regclass('public.estimate_revisions') IS NOT NULL)::integer
    + (to_regprocedure('public.reject_estimate_revision_history_mutation()') IS NOT NULL)::integer
    + (to_regprocedure('public.protect_snapshot_backed_estimate_content()') IS NOT NULL)::integer
    + (to_regprocedure('public.protect_snapshot_backed_estimate_items()') IS NOT NULL)::integer
    + (to_regprocedure('public.assert_estimate_wizard_snapshot_v22(jsonb)') IS NOT NULL)::integer
    + (to_regprocedure('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)') IS NOT NULL)::integer
    + (to_regprocedure('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)') IS NOT NULL)::integer
    + (EXISTS (SELECT 1 FROM pg_trigger g
                WHERE NOT g.tgisinternal
                  AND g.tgname  = 'estimate_wizard_snapshots_immutable'
                  AND g.tgrelid = to_regclass('public.estimate_wizard_snapshots')))::integer
    + (EXISTS (SELECT 1 FROM pg_trigger g
                WHERE NOT g.tgisinternal
                  AND g.tgname  = 'estimate_revisions_immutable'
                  AND g.tgrelid = to_regclass('public.estimate_revisions')))::integer
    + (EXISTS (SELECT 1 FROM pg_trigger g
                WHERE NOT g.tgisinternal
                  AND g.tgname  = 'estimates_snapshot_content_immutable'
                  AND g.tgrelid = to_regclass('public.estimates')))::integer
    + (EXISTS (SELECT 1 FROM pg_trigger g
                WHERE NOT g.tgisinternal
                  AND g.tgname  = 'estimate_items_snapshot_immutable'
                  AND g.tgrelid = to_regclass('public.estimate_items')))::integer;

  IF v_present <> 0 AND v_present <> v_total THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_PRECONDITION: partial estimate revision state (% of % objects present); refusing to converge',
      v_present, v_total;
  END IF;
END
$precheck$;

-- --- Step 1: revision tables + indexes (exact canonical DDL, all-absent only) -
-- The DDL strings below are copied VERBATIM from 20260920141616. Step 0 has
-- already excluded every partial state, so a NULL to_regclass here means the
-- whole revision object set is absent and is created canonically; otherwise
-- the existing tables are left untouched and validated in Step 7.
DO $create_revision_tables$
BEGIN
  IF to_regclass('public.estimate_wizard_snapshots') IS NULL THEN
    EXECUTE $ddl$
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
    $ddl$;
    EXECUTE $ddl$
CREATE INDEX estimate_wizard_snapshots_dealer_created_idx
  ON public.estimate_wizard_snapshots (dealer_id, created_at DESC);
    $ddl$;
  END IF;

  IF to_regclass('public.estimate_revisions') IS NULL THEN
    EXECUTE $ddl$
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
    $ddl$;
    EXECUTE $ddl$
CREATE INDEX estimate_revisions_dealer_root_idx
  ON public.estimate_revisions (dealer_id, root_estimate_id, revision_number);
    $ddl$;
  END IF;
END
$create_revision_tables$;

-- --- Step 2: RLS and table privileges ----------------------------------------
-- Canonical 20260920141616 enables RLS, revokes PUBLIC/anon/authenticated and
-- grants SELECT, INSERT to service_role. Supabase default privileges can
-- additionally hand service_role ALL on newly created tables, which would let
-- the two supported starting states diverge. service_role is therefore
-- revoked first and re-granted exactly the canonical SELECT, INSERT, so both
-- states converge to one deterministic least-privilege ACL. UPDATE/DELETE
-- remain blocked for every path by the immutability triggers below. All of
-- these statements are idempotent.
ALTER TABLE public.estimate_wizard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.estimate_wizard_snapshots FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.estimate_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.estimate_wizard_snapshots TO service_role;
GRANT SELECT, INSERT ON TABLE public.estimate_revisions TO service_role;

-- --- Step 3: canonical save_estimate_from_wizard (VERBATIM from 20260830160000)
-- Copied byte-for-byte from
-- 20260830160000_estimate_managed_service_offering_guard.sql. CREATE OR
-- REPLACE converges state A (pre-guard definition) and is a no-op re-issue of
-- the identical definition in state B. See that migration's header for the
-- full C.9a offering-guard and body-size contract commentary.
CREATE OR REPLACE FUNCTION public.save_estimate_from_wizard(
  p_dealer_id       uuid,
  p_actor_user_id   uuid,
  p_payload         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_customer    jsonb := p_payload -> 'customer';
  v_vehicle     jsonb := p_payload -> 'vehicle';
  v_pricing     jsonb := p_payload -> 'pricingSnapshot';
  v_services    jsonb := p_payload -> 'services';
  v_notes       jsonb := p_payload -> 'notes';
  v_metadata    jsonb := p_payload -> 'metadata';
  v_idem        text;
  v_cnt         integer;
  v_mem_dealer  uuid;
  v_mem_role    text;
  v_staff_role  text;
  v_role        text;
  v_fp          text;
  v_canonical   jsonb;
  v_existing    record;
  v_customer_id uuid;
  v_vehicle_id  uuid;
  v_estimate_id uuid;
  v_line        jsonb;
  v_sort        integer := 0;
  v_seen_lines  text[]  := ARRAY[]::text[];
  v_line_id     text;
  v_category    text;
  v_label       text;
  v_src         text;
  v_ref         text;
  v_man         text;
  v_opts        jsonb;
  v_meta        jsonb;
  v_k           text;
  v_j           jsonb;
  v_n           numeric;
  v_qty         numeric;
  v_unit        numeric;
  v_ltotal      numeric;
  v_subtotal    numeric;
  v_disc_total  numeric;
  v_coupon_tot  numeric;
  v_key         text;
  v_txt         text;
  v_y           integer;
  v_m           integer;
  v_d           integer;
  v_dim         integer;
  v_constraint  text;
  v_estimate_number text;
  v_seq_prefix  text;
  v_seq_padding integer;
  v_seq_policy  text;
  v_fiscal_year integer;
  v_next_number integer;
  v_config_rev  bigint;   -- B1.1-B2: optional configuration attribution
  c_money  CONSTANT text[] := ARRAY['subtotal','discountTotal','couponTotal',
                                    'taxableSubtotal','taxTotal','grandTotal'];
  c_cats   CONSTANT text[] := ARRAY['coating','ppf','window','interior','glass',
                                    'other','maintenance','carwash','roomclean'];
  c_uuid   CONSTANT text   :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  c_max    CONSTANT numeric := 1000000000000;   -- 1e12
BEGIN
  -- --- C.1 Actor authorization ---------------------------------------------
  -- auth.uid() is NULL under service_role, so p_actor_user_id is trusted; the
  -- caller is a service-role holder by construction of the EXECUTE grant.
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: actor user id is required';
  END IF;
  IF p_dealer_id IS NULL THEN
    RAISE EXCEPTION 'DEALER_CONTEXT_REQUIRED: dealer context missing';
  END IF;

  -- Reproduces the B3 actor contract EXACTLY: the ambiguity rule is GLOBAL
  -- (across all dealers), not scoped to p_dealer_id. More than one active
  -- membership means the tenant is ambiguous and is never picked arbitrarily.
  SELECT count(*) INTO v_cnt
    FROM public.dealer_members
   WHERE user_id = p_actor_user_id AND status = 'active';
  IF v_cnt = 0 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: no active membership';
  END IF;
  IF v_cnt > 1 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: ambiguous tenant context';
  END IF;

  SELECT dealer_id, role INTO v_mem_dealer, v_mem_role
    FROM public.dealer_members
   WHERE user_id = p_actor_user_id AND status = 'active';
  IF v_mem_dealer IS DISTINCT FROM p_dealer_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: dealer does not match the active membership';
  END IF;

  -- dealer_staff is PRIMARY for this exact (actor, dealer); absence falls back
  -- to the SAME membership row's role. Role and dealer can never diverge.
  SELECT role INTO v_staff_role
    FROM public.dealer_staff
   WHERE user_id = p_actor_user_id AND dealer_id = p_dealer_id AND status = 'active';
  v_role := coalesce(v_staff_role, v_mem_role);
  IF v_role IS NULL OR v_role NOT IN ('owner','manager','staff') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: role may not save estimates';
  END IF;

  -- --- C.2 Payload shape and REQUIRED containers ---------------------------
  -- THREE-VALUED LOGIC IS THE ENEMY HERE. `x -> 'k'` is SQL NULL for an ABSENT
  -- key, jsonb_typeof(NULL) is NULL, and `NULL <> 'object'` is NULL -- which an
  -- IF treats as FALSE, silently SKIPPING the guard and failing OPEN. Every
  -- required-field guard below therefore uses `IS DISTINCT FROM`, which yields a
  -- proper boolean for a NULL left operand and so rejects an absent key.
  --
  -- The payload itself must be a real object: a SQL-NULL or a JSON scalar would
  -- make every `->` below return NULL and cascade the same fail-open.
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: payload must be an object';
  END IF;

  -- Required containers are required, never coalesced to an invented default.
  IF jsonb_typeof(v_customer) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_vehicle)  IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_pricing)  IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_notes)    IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: incomplete payload';
  END IF;

  -- SEQUENTIAL, never combined with OR: SQL does not guarantee left-to-right
  -- evaluation, so `typeof <> 'array' OR jsonb_array_length(...) = 0` could
  -- evaluate jsonb_array_length on a non-array and leak a raw 22023.
  IF jsonb_typeof(v_services) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: no service lines';
  END IF;
  IF jsonb_array_length(v_services) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: no service lines';
  END IF;

  IF jsonb_typeof(p_payload -> 'nonPriceableSelections') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: nonPriceableSelections is required';
  END IF;
  IF jsonb_typeof(v_pricing -> 'warnings') IS DISTINCT FROM 'array'
     OR jsonb_typeof(v_pricing -> 'errors') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing warnings/errors are required';
  END IF;
  IF jsonb_typeof(p_payload -> 'discountIntent') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: discountIntent is required';
  END IF;
  IF jsonb_typeof(p_payload -> 'couponIntent') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: couponIntent is required';
  END IF;
  IF jsonb_typeof(v_notes -> 'customerNotes') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_notes -> 'internalMemo') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: notes fields are required strings';
  END IF;
  IF (v_pricing ->> 'completeness') IS DISTINCT FROM 'complete' THEN
    RAISE EXCEPTION 'PRICING_INCOMPLETE: pricing completeness is not complete';
  END IF;

  -- Currency is a CONTRACT, not a preference: the whole pricing pipeline is
  -- whole-yen. An absent key makes ->> return NULL, which IS DISTINCT FROM
  -- rejects, so absence and a wrong currency fail identically.
  IF (v_pricing ->> 'currency') IS DISTINCT FROM 'JPY' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing currency must be JPY';
  END IF;

  -- --- C.2b Metadata: exact, and validated BEFORE fingerprint/persistence ---
  -- C.8 projects these into the canonical fingerprint and C.10 persists
  -- source + schemaVersion + configurationRevision, so an unvalidated metadata
  -- block would be hashed and stored before anything checked it.
  IF jsonb_typeof(v_metadata -> 'source') IS DISTINCT FROM 'string'
     OR (v_metadata ->> 'source') IS DISTINCT FROM 'estimate-wizard-v2.2' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.source is required and must be estimate-wizard-v2.2';
  END IF;
  IF jsonb_typeof(v_metadata -> 'schemaVersion') IS DISTINCT FROM 'string'
     OR (v_metadata ->> 'schemaVersion') IS DISTINCT FROM '2.2' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.schemaVersion is required and must be 2.2';
  END IF;
  -- Compared as jsonb: this accepts ONLY JSON true, never the string "true".
  IF (v_metadata -> 'createdFromWizard') IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.createdFromWizard must be true';
  END IF;
  IF jsonb_typeof(v_metadata -> 'previewConfirmed') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.previewConfirmed must be a boolean';
  END IF;

  -- B1.1-B2: OPTIONAL configuration attribution. Absent OR explicit JSON null
  -- both mean "unattributed" and persist as NULL. When present as a number it
  -- must be a non-negative INTEGER: the column is bigint, so a fractional value
  -- would be silently rounded by the cast, and a negative one would only be
  -- caught later by estimates_configuration_revision_nonneg. Reject, never repair.
  v_config_rev := NULL;
  IF v_metadata ? 'configurationRevision' THEN
    IF jsonb_typeof(v_metadata -> 'configurationRevision') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: metadata.configurationRevision must be a number or null';
    END IF;
    IF jsonb_typeof(v_metadata -> 'configurationRevision') = 'number' THEN
      v_n := ((v_metadata -> 'configurationRevision') #>> '{}')::numeric;
      IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: metadata.configurationRevision is not finite';
      END IF;
      IF v_n <> trunc(v_n) OR v_n < 0 OR v_n > 9223372036854775807 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: metadata.configurationRevision is outside the accepted domain';
      END IF;
      v_config_rev := v_n::bigint;
    END IF;
  END IF;

  -- --- C.3 Idempotency key: REQUIRED, exact format, no blank fallback ------
  v_idem := p_payload ->> 'idempotencyKey';
  IF v_idem IS NULL OR v_idem !~ '^[A-Za-z0-9_-]{16,64}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: idempotency key missing or malformed';
  END IF;

  -- --- C.4 Pricing numeric domains: NO invented defaults, NO coercion ------
  -- jsonb_typeof(...) = 'number' rejects numeric STRINGS ("1000") outright.
  -- NaN and +/-Infinity are valid `numeric` values in PostgreSQL, so both are
  -- rejected EXPLICITLY rather than relying on the range bounds.
  FOREACH v_k IN ARRAY c_money LOOP
    v_j := v_pricing -> v_k;
    IF jsonb_typeof(v_j) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: pricing.% is missing or not a number', v_k;
    END IF;
    v_n := (v_j #>> '{}')::numeric;
    IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: pricing.% is not finite', v_k;
    END IF;
    IF v_n < 0 OR v_n > c_max OR scale(v_n) > 2 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: pricing.% is outside the accepted domain', v_k;
    END IF;
  END LOOP;

  v_j := v_pricing -> 'taxRatePercent';
  IF jsonb_typeof(v_j) IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.taxRatePercent is missing or not a number';
  END IF;
  v_n := (v_j #>> '{}')::numeric;
  IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric
     OR v_n < 0 OR v_n > 100 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.taxRatePercent is outside the accepted domain';
  END IF;
  -- FINGERPRINT PARITY: the canonical projection rounds this to scale 2, but the
  -- stored column is unbounded numeric. Without this check, 10.123 would persist
  -- as 10.123 while fingerprinting as 10.12, so 10.123 and 10.124 would collide
  -- into the same fingerprint and one would be accepted as a replay of the other.
  IF scale(v_n) > 2 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.taxRatePercent scale exceeds 2';
  END IF;

  -- --- C.4b Reduction boundary --------------------------------------------
  -- Every c_money member is now proven to be a finite, non-negative, in-range
  -- JSON number, so these three reads are cast-safe. A reduction larger than the
  -- subtotal is an incoherent snapshot: totals are stored VERBATIM and never
  -- recomputed here, so nothing downstream would catch it. Reject, never repair.
  v_subtotal   := ((v_pricing -> 'subtotal')      #>> '{}')::numeric;
  v_disc_total := ((v_pricing -> 'discountTotal') #>> '{}')::numeric;
  v_coupon_tot := ((v_pricing -> 'couponTotal')   #>> '{}')::numeric;
  IF v_disc_total > v_subtotal THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.discountTotal exceeds subtotal';
  END IF;
  IF v_coupon_tot > v_subtotal THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.couponTotal exceeds subtotal';
  END IF;

  -- --- C.5 Customer input validation (BEFORE any cast) ---------------------
  IF (v_customer ->> 'mode') = 'existing' THEN
    -- Strict grouped UUID shape. A loose character-class regex would admit
    -- values like 36 hyphens and leak 22P02 at the cast.
    IF jsonb_typeof(v_customer -> 'customerId') IS DISTINCT FROM 'string'
       OR (v_customer ->> 'customerId') !~ c_uuid THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer id is malformed';
    END IF;
  ELSIF (v_customer ->> 'mode') = 'new' THEN
    IF jsonb_typeof(v_customer -> 'name') IS DISTINCT FROM 'string'
       OR btrim(v_customer ->> 'name') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer name required';
    END IF;
    -- Booleans are REQUIRED by the DTO; absence is not silently false. These two
    -- are cast with ::boolean in C.10, so an absent key previously slipped past
    -- the guard and surfaced as a raw NOT-NULL violation instead of a stable code.
    IF jsonb_typeof(v_customer -> 'isBusiness') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.isBusiness must be a boolean';
    END IF;
    IF jsonb_typeof(v_customer -> 'accountsReceivableAllowed') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.accountsReceivableAllowed must be a boolean';
    END IF;
    -- PRESENCE FIRST. `jsonb_typeof(x -> 'k') NOT IN (...)` does NOT reject an
    -- absent key: `x -> 'k'` is SQL NULL, jsonb_typeof(NULL) is NULL, and
    -- `NULL NOT IN (...)` is NULL, which an IF treats as false. The `?` operator
    -- is the only reliable presence test, and absence must NOT become explicit null.
    IF NOT (v_customer ? 'tradeRatePercent') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent is required';
    END IF;
    IF jsonb_typeof(v_customer -> 'tradeRatePercent') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent must be a number or null';
    END IF;
    IF jsonb_typeof(v_customer -> 'tradeRatePercent') = 'number' THEN
      v_n := ((v_customer -> 'tradeRatePercent') #>> '{}')::numeric;
      IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric
         OR v_n < 0 OR v_n > 100 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent is outside the accepted domain';
      END IF;
      -- customers.trade_discount_pct is numeric(5,2): a scale-3 value would be
      -- SILENTLY ROUNDED by the column type. Reject instead of rounding.
      IF scale(v_n) > 2 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent scale exceeds 2';
      END IF;
    END IF;
    -- closingDay / paymentDay: REQUIRED keys, each string | null, and a decimal
    -- day 1..31 before ::integer.
    FOREACH v_key IN ARRAY ARRAY['closingDay','paymentDay'] LOOP
      IF NOT (v_customer ? v_key) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.% is required', v_key;
      END IF;
      IF jsonb_typeof(v_customer -> v_key) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a string or null', v_key;
      END IF;
      v_txt := v_customer ->> v_key;
      IF v_txt IS NOT NULL AND v_txt <> '' THEN
        -- The shape check is a SEPARATE statement, not an OR branch: SQL does not
        -- guarantee left-to-right short-circuit evaluation, so combining them would
        -- still allow ::integer to fire on non-numeric text and leak 22P02.
        IF v_txt !~ '^[0-9]{1,2}$' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a day between 1 and 31', v_key;
        END IF;
        IF v_txt::integer < 1 OR v_txt::integer > 31 THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a day between 1 and 31', v_key;
        END IF;
      END IF;
    END LOOP;
    -- B2-B.3: kana / creditTerms — OPTIONAL keys, each string | null when present.
    --
    -- Validated but NOT required, deliberately. Requiring them would reject every payload produced
    -- by a client that has not yet been redeployed, turning a persistence fix into a save outage.
    -- An ABSENT key is treated exactly like an explicit null: nothing to persist. A key present with
    -- a non-string, non-null type is still a malformed payload and is refused, consistent with every
    -- other field validated here.
    FOREACH v_key IN ARRAY ARRAY['kana','creditTerms'] LOOP
      IF v_customer ? v_key
         AND jsonb_typeof(v_customer -> v_key) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a string or null', v_key;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'VALIDATION_ERROR: customer mode is invalid';
  END IF;

  -- --- C.6 Vehicle input validation (BEFORE any cast) ----------------------
  -- C3B: bodySizeKey remains optional for compatibility with already-deployed
  -- callers, but any supplied nonblank value must be one of the canonical seven
  -- 3M size keys. An absent/null/blank value means "no confirmed replacement"
  -- for an existing vehicle and therefore preserves its current ledger value.
  IF (v_vehicle ? 'bodySizeKey')
     AND jsonb_typeof(v_vehicle -> 'bodySizeKey') NOT IN ('string','null') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.bodySizeKey must be a string or null';
  END IF;
  v_txt := nullif(btrim(v_vehicle ->> 'bodySizeKey'), '');
  IF v_txt IS NOT NULL
     AND NOT (v_txt = ANY (ARRAY['SS','S','M','ML','L','LL','XL']::text[])) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.bodySizeKey is outside the canonical seven-size contract';
  END IF;

  IF (v_vehicle ->> 'mode') = 'existing' THEN
    IF jsonb_typeof(v_vehicle -> 'vehicleId') IS DISTINCT FROM 'string'
       OR (v_vehicle ->> 'vehicleId') !~ c_uuid THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vehicle id is malformed';
    END IF;
  ELSIF (v_vehicle ->> 'mode') = 'new' THEN
    -- Mirrors the authoritative DTO validator: maker OR model must be present.
    IF coalesce(btrim(v_vehicle ->> 'maker'), '') = ''
       AND coalesce(btrim(v_vehicle ->> 'model'), '') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vehicle maker or model required';
    END IF;
    -- Real CALENDAR validation, not merely YYYY-MM-DD shape: 2026-02-31 has the
    -- right shape and would raise 22008 at ::date.
    FOREACH v_key IN ARRAY ARRAY['registrationDate','inspectionExpiry'] LOOP
      -- Presence first, for the same three-valued-logic reason as above.
      IF NOT (v_vehicle ? v_key) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is required', v_key;
      END IF;
      IF jsonb_typeof(v_vehicle -> v_key) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% must be a string or null', v_key;
      END IF;
      v_txt := v_vehicle ->> v_key;
      IF v_txt IS NOT NULL AND v_txt <> '' THEN
        IF v_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is malformed', v_key;
        END IF;
        v_y := substr(v_txt, 1, 4)::integer;
        v_m := substr(v_txt, 6, 2)::integer;
        v_d := substr(v_txt, 9, 2)::integer;
        IF v_y < 1900 OR v_y > 2999 OR v_m < 1 OR v_m > 12 OR v_d < 1 THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is not a valid date', v_key;
        END IF;
        -- Days in month, computed without ever constructing an invalid date.
        v_dim := EXTRACT(DAY FROM (make_date(v_y, v_m, 1) + INTERVAL '1 month - 1 day'))::integer;
        IF v_d > v_dim THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is not a valid date', v_key;
        END IF;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'VALIDATION_ERROR: vehicle mode is invalid';
  END IF;

  -- --- C.7 Service-line validation: THE single validation authority --------
  -- Runs over EVERY line before the fingerprint is built and before any write.
  -- The persistence loop (C.11) consumes what this pass proved. C.9a below
  -- also consumes the categories this pass proves, and never re-validates them.
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_services) LOOP
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service line is not an object';
    END IF;

    -- Required string fields must have JSON string type AND be nonblank.
    -- wizardCategory / pricingPolicy / manualPricePolicy are persisted in C.11
    -- through nullif(..., ''), so an absent or blank value would have written a
    -- silent NULL into a wizard identity column instead of being rejected.
    FOREACH v_key IN ARRAY ARRAY['lineId','category','label',
                                 'wizardCategory','pricingPolicy','manualPricePolicy'] LOOP
      IF jsonb_typeof(v_line -> v_key) IS DISTINCT FROM 'string'
         OR btrim(v_line ->> v_key) = '' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is required', v_key;
      END IF;
    END LOOP;
    v_line_id  := btrim(v_line ->> 'lineId');
    v_category := btrim(v_line ->> 'category');

    IF NOT (v_category = ANY (c_cats)) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service category is not permitted';
    END IF;
    IF v_line_id = ANY (v_seen_lines) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: duplicate service lineId';
    END IF;
    v_seen_lines := v_seen_lines || v_line_id;

    -- Hybrid identity: EXACTLY one non-empty identity, matching pricingSource.
    v_src := v_line ->> 'pricingSource';
    v_ref := nullif(btrim(coalesce(v_line ->> 'pricingReferenceId', '')), '');
    v_man := nullif(btrim(coalesce(v_line ->> 'manualPricingIdentity', '')), '');
    IF v_src = 'catalog' THEN
      IF v_ref IS NULL OR v_man IS NOT NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: catalog line requires exactly a catalog identity';
      END IF;
    ELSIF v_src = 'manual' THEN
      IF v_man IS NULL OR v_ref IS NOT NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: manual line requires exactly a manual identity';
      END IF;
    ELSE
      RAISE EXCEPTION 'VALIDATION_ERROR: pricingSource must be catalog or manual';
    END IF;

    -- Amounts: JSON number type, finite, in range and scale. No invented defaults.
    FOREACH v_key IN ARRAY ARRAY['quantity','unitPrice','lineTotal'] LOOP
      v_j := v_line -> v_key;
      IF jsonb_typeof(v_j) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is missing or not a number', v_key;
      END IF;
      v_n := (v_j #>> '{}')::numeric;
      IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is not finite', v_key;
      END IF;
      IF v_n > c_max OR scale(v_n) > 2 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is outside the accepted domain', v_key;
      END IF;
    END LOOP;
    IF ((v_line -> 'quantity') #>> '{}')::numeric <= 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service quantity must be greater than zero';
    END IF;
    IF ((v_line -> 'quantity') #>> '{}')::numeric > 100000 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service quantity is outside the accepted domain';
    END IF;
    IF ((v_line -> 'unitPrice')  #>> '{}')::numeric < 0
       OR ((v_line -> 'lineTotal') #>> '{}')::numeric < 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service amounts must not be negative';
    END IF;

    -- optionReferenceIds: REQUIRED array of strings. The column is NOT NULL, so
    -- an absent key used to reach the INSERT and leak a raw 23502.
    IF jsonb_typeof(v_line -> 'optionReferenceIds') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: optionReferenceIds is required and must be an array';
    END IF;
    -- Elements are already MATERIALIZED by jsonb_array_elements, so jsonb_typeof
    -- can never be NULL here; IS DISTINCT FROM is used purely for consistency and
    -- accepts exactly the same values as the previous `<>`.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_line -> 'optionReferenceIds') e
                WHERE jsonb_typeof(e) IS DISTINCT FROM 'string') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: optionReferenceIds must contain only strings';
    END IF;

    -- lineMetadata: REQUIRED flat object (no nested object/array values).
    IF jsonb_typeof(v_line -> 'lineMetadata') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: lineMetadata is required and must be an object';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(v_line -> 'lineMetadata') m
                WHERE jsonb_typeof(m.value) IN ('object','array')) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: lineMetadata must be flat';
    END IF;
  END LOOP;

  -- --- C.8 Canonical material projection + fingerprint ---------------------
  -- SAFE BY CONSTRUCTION: every value cast or rounded below was proven a finite,
  -- in-range JSON number by C.4 and C.7. metadata.draftLastUpdatedAt is EXCLUDED
  -- -- it is an in-memory timestamp that is never persisted, and including it
  -- would turn a legitimate retry into a false DUPLICATE_SUBMISSION. Numeric
  -- scale is normalized because jsonb preserves 1 and 1.0 as distinct texts.
  --
  -- B1.1-B2: configurationRevision JOINS the projection. Two saves that differ
  -- only in the configuration that produced them are materially different and
  -- must not replay as one another; a genuine retry carries the same revision
  -- and still fingerprints identically. `coalesce(..., 'null')` keeps an absent
  -- key and an explicit null hashing identically, since both mean unattributed.
  SELECT jsonb_build_object(
    'customer', v_customer,
    'vehicle',  v_vehicle,
    'services', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'lineId',                s ->> 'lineId',
                 'category',              s ->> 'category',
                 'wizardCategory',        s ->> 'wizardCategory',
                 'pricingSource',         s ->> 'pricingSource',
                 'pricingReferenceId',    s ->> 'pricingReferenceId',
                 'manualPricingIdentity', s ->> 'manualPricingIdentity',
                 'pricingPolicy',         s ->> 'pricingPolicy',
                 'manualPricePolicy',     s ->> 'manualPricePolicy',
                 'label',                 s ->> 'label',
                 'description',           s ->> 'description',
                 'quantity',              round(((s -> 'quantity')  #>> '{}')::numeric, 2),
                 'unitPrice',             round(((s -> 'unitPrice') #>> '{}')::numeric, 2),
                 'lineTotal',             round(((s -> 'lineTotal') #>> '{}')::numeric, 2),
                 'optionReferenceIds',    s -> 'optionReferenceIds',
                 'lineMetadata',          s -> 'lineMetadata')
                 ORDER BY ord)
        FROM jsonb_array_elements(v_services) WITH ORDINALITY AS t(s, ord)), '[]'::jsonb),
    'nonPriceableSelections', p_payload -> 'nonPriceableSelections',
    'notes',    v_notes,
    'pricing',  jsonb_build_object(
                  'currency',        v_pricing ->> 'currency',
                  'completeness',    v_pricing ->> 'completeness',
                  'subtotal',        round(((v_pricing -> 'subtotal')        #>> '{}')::numeric, 2),
                  'discountTotal',   round(((v_pricing -> 'discountTotal')   #>> '{}')::numeric, 2),
                  'couponTotal',     round(((v_pricing -> 'couponTotal')     #>> '{}')::numeric, 2),
                  'taxableSubtotal', round(((v_pricing -> 'taxableSubtotal') #>> '{}')::numeric, 2),
                  'taxRatePercent',  round(((v_pricing -> 'taxRatePercent')  #>> '{}')::numeric, 2),
                  'taxTotal',        round(((v_pricing -> 'taxTotal')        #>> '{}')::numeric, 2),
                  'grandTotal',      round(((v_pricing -> 'grandTotal')      #>> '{}')::numeric, 2)),
    'discountIntent',        p_payload -> 'discountIntent',
    'discountAppliedAmount', coalesce(p_payload -> 'discountAppliedAmount', 'null'::jsonb),
    'couponIntent',          p_payload -> 'couponIntent',
    'couponAppliedAmount',   coalesce(p_payload -> 'couponAppliedAmount', 'null'::jsonb),
    'metadata', jsonb_build_object(
                  'source',                v_metadata ->> 'source',
                  'schemaVersion',         v_metadata ->> 'schemaVersion',
                  'createdFromWizard',     v_metadata -> 'createdFromWizard',
                  'previewConfirmed',      v_metadata -> 'previewConfirmed',
                  'configurationRevision', coalesce(v_metadata -> 'configurationRevision', 'null'::jsonb))
  ) INTO v_canonical;

  -- sha256(bytea) is core since PG11 -- no pgcrypto dependency.
  v_fp := encode(sha256(convert_to(v_canonical::text, 'UTF8')), 'hex');

  -- --- C.9 Serialize same (dealer,key) work, then replay-detect ------------
  -- The advisory lock removes the check-then-act race that would otherwise let
  -- two concurrent same-key requests both miss the lookup and collide on the
  -- partial unique index, leaking a raw 23505.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dealer_id::text || ':' || v_idem, 0));

  SELECT id, estimate_number, customer_id, vehicle_id, idempotency_fingerprint
    INTO v_existing
    FROM public.estimates
   WHERE dealer_id = p_dealer_id AND idempotency_key = v_idem;
  IF FOUND THEN
    IF v_existing.idempotency_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'DUPLICATE_SUBMISSION: idempotency key reused with a different payload';
    END IF;
    -- Exact replay: ZERO writes. Reached before C.9a, so a same-key exact
    -- replay keeps this success even if the relevant offering is disabled
    -- after the original save.
    RETURN jsonb_build_object(
      'ok', true, 'estimate_id', v_existing.id, 'estimate_number', v_existing.estimate_number,
      'customer_id', v_existing.customer_id, 'vehicle_id', v_existing.vehicle_id,
      'idempotent_replay', true);
  END IF;

  -- --- C.9a Managed-service offering guard ---------------------------------
  -- Reached ONLY by a genuinely new save: C.9 has already returned an exact
  -- replay above, or raised DUPLICATE_SUBMISSION for a same-key, materially
  -- different payload. Neither of those paths reaches here, so neither one's
  -- outcome is affected by the current offering state.
  --
  -- ONE set-based statement. The distinct required families are derived from
  -- the C.7-proven service categories via the fixed five-row mapping below;
  -- every required family is checked against public.dealer_service_offerings
  -- for p_dealer_id in that SAME statement, so its start snapshot under
  -- READ COMMITTED is the sole authority for every family at once. A missing
  -- row or enabled IS NOT TRUE both mean OFF. Another dealer's row is never
  -- consulted: every EXISTS/NOT EXISTS predicate below is scoped to
  -- p_dealer_id. coating, other, and any category outside the five-row
  -- mapping never produce a required family and are therefore unaffected.
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT DISTINCT m.family
          FROM jsonb_array_elements(v_services) AS s(line)
          JOIN (VALUES
                  ('window',     'window_film'),
                  ('ppf',        'ppf'),
                  ('maintenance','maintenance'),
                  ('roomclean',  'room_cleaning'),
                  ('carwash',    'car_wash')
               ) AS m(category, family)
            ON m.category = (s.line ->> 'category')
      ) AS required_family
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.dealer_service_offerings o
        WHERE o.dealer_id = p_dealer_id
          AND o.family    = required_family.family
          AND o.enabled IS TRUE
     )
  ) THEN
    -- Stable, sanitized. Never discloses which family, the dealer, customer,
    -- vehicle, pricing, draft, configuration, SQLSTATE, or raw SQL detail.
    RAISE EXCEPTION 'VALIDATION_ERROR: service-not-offered';
  END IF;

  -- --- C.10 ATOMIC create block: customer + vehicle + estimate ----------
  -- All three writes share ONE exception subtransaction. If the idempotency
  -- unique index fires, this whole block rolls back, so a concurrent-race
  -- replay can never leave an orphan customer or vehicle behind. Splitting
  -- them would make the 'zero writes' replay guarantee false.
  --
  -- Explicit dealer predicates throughout: service_role bypasses RLS, so there
  -- is no backstop. Every value cast here was validated in C.5 / C.6.
  BEGIN
    -- --- C.10a Estimate number: allocated ONLY for a genuinely new save ------
    -- ORDERING IS THE WHOLE POINT OF THE NUMBERING MIGRATION. Allocation sits
    -- AFTER the C.9 advisory lock and AFTER the replay/conflict decision, and
    -- now also AFTER the C.9a offering guard, so an exact replay, a
    -- DUPLICATE_SUBMISSION, and a disabled-family rejection all return having
    -- advanced NOTHING.
    --
    -- It also sits INSIDE this block, which is the same exception
    -- subtransaction as the customer/vehicle/estimate writes. That placement is
    -- load-bearing: when the idempotency unique index fires below and the
    -- handler returns a replay, PostgreSQL rolls this block back in full, so the
    -- allocation this attempt performed is undone with it. A later item failure
    -- (C.11) raises out of the function and aborts the whole transaction, which
    -- rolls the sequence back as well.
    --
    -- get_next_document_number is deliberately NOT called: migration 104 revoked
    -- its EXECUTE from service_role and its authorization reads auth.uid(),
    -- which is NULL under service_role. The upsert is therefore inlined here,
    -- guarded by the actor/dealer/role checks C.1 already performed.

    -- Deterministic single configuration row: most recently updated wins.
    SELECT s.prefix, s.padding, s.reset_policy
      INTO v_seq_prefix, v_seq_padding, v_seq_policy
      FROM public.document_sequences s
     WHERE s.dealer_id = p_dealer_id
       AND s.sequence_type = 'estimate'
     ORDER BY s.updated_at DESC, s.created_at DESC, s.fiscal_year DESC, s.id DESC
     LIMIT 1;

    -- No row yet: the wizard's canonical defaults, which mirror the TypeScript
    -- defaultPrefix("estimate") / padding 5 / "never". The TABLE default for
    -- prefix is '' and is deliberately NOT used -- it would produce a blank
    -- prefix the TypeScript allocator would never have chosen.
    IF NOT FOUND THEN
      v_seq_prefix  := 'EST';
      v_seq_padding := 5;
      v_seq_policy  := 'never';
    END IF;

    -- CURRENT_TIMESTAMP is the transaction timestamp, so every read of the
    -- clock inside this save agrees, and the JST conversion is explicit.
    v_fiscal_year := public.wiz_document_fiscal_year(v_seq_policy, CURRENT_TIMESTAMP);
    IF v_fiscal_year IS NULL THEN
      RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate numbering configuration is unusable';
    END IF;

    -- Nested ONLY to map an allocation fault to the stable code. It remains
    -- inside the outer block, so it cannot escape the rollback boundary above.
    BEGIN
      INSERT INTO public.document_sequences
        (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy, current_number)
      VALUES
        (p_dealer_id, 'estimate', v_fiscal_year, v_seq_prefix, v_seq_padding, v_seq_policy, 1)
      ON CONFLICT (dealer_id, sequence_type, fiscal_year) DO UPDATE
        SET current_number = document_sequences.current_number + 1,
            updated_at     = now()
      RETURNING current_number, prefix, padding, reset_policy, fiscal_year
        INTO v_next_number, v_seq_prefix, v_seq_padding, v_seq_policy, v_fiscal_year;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate number could not be allocated';
    END;

    -- Formatted from the values the TARGET ROW actually holds after the upsert,
    -- never from the values this call proposed: an existing row's stored prefix
    -- and padding are authoritative.
    v_estimate_number := public.wiz_format_document_number(
      v_seq_prefix, v_next_number, v_seq_padding, v_fiscal_year);
    IF v_estimate_number IS NULL OR btrim(v_estimate_number) = '' THEN
      RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate number could not be formatted';
    END IF;

    IF (v_customer ->> 'mode') = 'existing' THEN
      SELECT id INTO v_customer_id FROM public.customers
       WHERE id = (v_customer ->> 'customerId')::uuid
         AND dealer_id = p_dealer_id AND deleted_at IS NULL;
      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: customer does not belong to the dealer';
      END IF;
    ELSE
      -- B2-B.3: the LEGACY columns (`name`, `address`) keep exactly the values they had, and the
      -- CANONICAL columns are written from the SAME normalized expressions. Both sets are populated
      -- because migration 035 retained the legacy columns without a sync trigger, so writing only
      -- one set leaves the other permanently stale for this row. `first_name`, `first_name_kana` and
      -- `address2` are explicit NULLs: Screen 1 has a single name field and a single address field,
      -- and splitting one entered string into parts would be a guess — wrong for company names and
      -- for any spacing that does not match the assumed convention, and a wrong split corrupts both
      -- the displayed label and the search key.
      INSERT INTO public.customers (
        dealer_id, name, phone, email, postal_code, address, line_user_id,
        is_business, trade_discount_pct, accounts_receivable_allowed, closing_day, payment_day,
        last_name, first_name, last_name_kana, first_name_kana, address1, address2, credit_terms
      ) VALUES (
        p_dealer_id,
        btrim(v_customer ->> 'name'),
        nullif(v_customer ->> 'phone', ''),
        nullif(v_customer ->> 'email', ''),
        nullif(v_customer ->> 'postalCode', ''),
        nullif(v_customer ->> 'address', ''),
        nullif(v_customer ->> 'lineId', ''),
        (v_customer ->> 'isBusiness')::boolean,
        -- customers.trade_discount_pct is numeric(5,2) NOT NULL, but the DTO
        -- permits an explicit null. Ratified mapping: explicit JSON null means
        -- "no trade discount" and persists as the canonical 0. An ABSENT key was
        -- already rejected in C.5, so this CASE can never silently convert a
        -- missing key -- which is exactly why a broad COALESCE is not used here.
        -- The FINGERPRINT keeps the ORIGINAL payload value, so explicit null and
        -- explicit numeric 0 stay materially distinct intents.
        CASE jsonb_typeof(v_customer -> 'tradeRatePercent')
          WHEN 'null'   THEN 0::numeric
          WHEN 'number' THEN ((v_customer -> 'tradeRatePercent') #>> '{}')::numeric
        END,
        (v_customer ->> 'accountsReceivableAllowed')::boolean,
        nullif(v_customer ->> 'closingDay', '')::integer,
        nullif(v_customer ->> 'paymentDay', '')::integer,
        -- last_name: the WHOLE trimmed entered name, matching what `name` receives and following the
        -- existing create-customer.ts convention (`last_name = lastName ?? fullName`). This is the
        -- column the tenant customer search and the reference preload actually read.
        btrim(v_customer ->> 'name'),
        NULL,                                              -- first_name: never guessed
        nullif(btrim(v_customer ->> 'kana'), ''),          -- last_name_kana
        NULL,                                              -- first_name_kana: never guessed
        nullif(v_customer ->> 'address', ''),              -- address1: same value as legacy `address`
        NULL,                                              -- address2: Screen 1 has one address field
        nullif(btrim(v_customer ->> 'creditTerms'), '')    -- credit_terms: column already existed
      ) RETURNING id INTO v_customer_id;
    END IF;

    IF (v_vehicle ->> 'mode') = 'existing' THEN
      SELECT id INTO v_vehicle_id FROM public.vehicles
       WHERE id = (v_vehicle ->> 'vehicleId')::uuid
         AND dealer_id   = p_dealer_id
         AND customer_id = v_customer_id      -- the gap migration 102 left open
         AND deleted_at IS NULL;
      IF v_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'VEHICLE_NOT_FOUND: vehicle does not belong to the dealer and customer';
      END IF;

      -- C3B: persist the operator-confirmed 3M size on the already-selected
      -- vehicle inside the SAME exception subtransaction as the estimate save.
      -- Exact idempotent replay returned at C.9 before reaching this statement,
      -- so replay remains zero-write. A later estimate/item failure rolls this
      -- update back together with every other write in C.10/C.11.
      IF v_txt IS NOT NULL THEN
        UPDATE public.vehicles
           SET body_size = v_txt
         WHERE id          = v_vehicle_id
           AND dealer_id   = p_dealer_id
           AND customer_id = v_customer_id
           AND deleted_at IS NULL;
      END IF;
    ELSE
      INSERT INTO public.vehicles (
        dealer_id, customer_id, maker, model, grade, vehicle_code, vin,
        first_registration_year_month, registration_date, inspection_expiry_date,
        displacement, color, plate_number, body_size
      ) VALUES (
        p_dealer_id, v_customer_id,
        nullif(v_vehicle ->> 'maker', ''),
        nullif(v_vehicle ->> 'model', ''),
        nullif(v_vehicle ->> 'grade', ''),
        nullif(v_vehicle ->> 'vehicleCode', ''),
        nullif(v_vehicle ->> 'vin', ''),
        nullif(v_vehicle ->> 'firstRegistration', ''),
        nullif(v_vehicle ->> 'registrationDate', '')::date,
        nullif(v_vehicle ->> 'inspectionExpiry', '')::date,
        nullif(v_vehicle ->> 'displacement', ''),
        nullif(v_vehicle ->> 'color', ''),
        nullif(v_vehicle ->> 'plateNumber', ''),
        nullif(v_vehicle ->> 'bodySizeKey', '')
      ) RETURNING id INTO v_vehicle_id;
    END IF;


    -- Estimate: totals stored VERBATIM; never recomputed here.
    -- B1.1-B2 adds ONE column: configuration_revision, copied verbatim from the
    -- validated metadata. It participates in no arithmetic.
      INSERT INTO public.estimates (
        dealer_id, customer_id, vehicle_id, estimate_no, estimate_number, status,
        subtotal, tax, tax_rate, tax_amount, discount_amount, total, notes, internal_memo,
        pricing_completeness, pricing_warnings, pricing_errors, discount_intent, coupon_intent,
        non_priceable_selections, idempotency_key, idempotency_fingerprint, source,
        wizard_schema_version, configuration_revision
      ) VALUES (
        p_dealer_id, v_customer_id, v_vehicle_id, v_estimate_number, v_estimate_number, 'draft',
        ((v_pricing -> 'subtotal')       #>> '{}')::numeric,
        ((v_pricing -> 'taxTotal')       #>> '{}')::numeric,
        ((v_pricing -> 'taxRatePercent') #>> '{}')::numeric,
        ((v_pricing -> 'taxTotal')       #>> '{}')::numeric,
        ((v_pricing -> 'discountTotal')  #>> '{}')::numeric,
        ((v_pricing -> 'grandTotal')     #>> '{}')::numeric,
        v_notes ->> 'customerNotes',
        v_notes ->> 'internalMemo',
        v_pricing ->> 'completeness',
        v_pricing -> 'warnings',
        v_pricing -> 'errors',
        p_payload -> 'discountIntent',
        p_payload -> 'couponIntent',
        p_payload -> 'nonPriceableSelections',
        v_idem, v_fp,
        v_metadata ->> 'source',
        v_metadata ->> 'schemaVersion',
        v_config_rev
      ) RETURNING id INTO v_estimate_id;
  EXCEPTION WHEN unique_violation THEN
      -- CONSTRAINT-SPECIFIC. Only the idempotency index may be interpreted as a
      -- concurrent same-key race. Any other unique violation is an unrelated
      -- defect and must not be reported as a replay. SQLERRM / detail / hint /
      -- SQLSTATE are never surfaced.
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'estimates_dealer_idempotency_key_uidx' THEN
        RAISE EXCEPTION 'ESTIMATE_CREATE_FAILED: estimate could not be created';
      END IF;
      SELECT id, estimate_number, customer_id, vehicle_id, idempotency_fingerprint
        INTO v_existing
        FROM public.estimates
       WHERE dealer_id = p_dealer_id AND idempotency_key = v_idem;
      IF NOT FOUND OR v_existing.idempotency_fingerprint IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'DUPLICATE_SUBMISSION: idempotency key reused with a different payload';
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'estimate_id', v_existing.id, 'estimate_number', v_existing.estimate_number,
        'customer_id', v_existing.customer_id, 'vehicle_id', v_existing.vehicle_id,
        'idempotent_replay', true);
  END;

  -- --- C.11 Service lines: consume the C.7-proven values -------------------
  BEGIN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_services) LOOP
      v_line_id  := btrim(v_line ->> 'lineId');
      v_category := btrim(v_line ->> 'category');
      v_label    := btrim(v_line ->> 'label');
      v_src      := v_line ->> 'pricingSource';
      v_ref      := nullif(btrim(coalesce(v_line ->> 'pricingReferenceId', '')), '');
      v_man      := nullif(btrim(coalesce(v_line ->> 'manualPricingIdentity', '')), '');
      v_opts     := v_line -> 'optionReferenceIds';
      v_meta     := v_line -> 'lineMetadata';
      v_qty      := ((v_line -> 'quantity')  #>> '{}')::numeric;
      v_unit     := ((v_line -> 'unitPrice') #>> '{}')::numeric;
      v_ltotal   := ((v_line -> 'lineTotal') #>> '{}')::numeric;

      INSERT INTO public.estimate_items (
        estimate_id, dealer_id, category, item_name, description, quantity, unit_price,
        discount_rate, line_total, sort_order, item_type,
        pricing_source, pricing_reference_id, manual_pricing_identity, pricing_policy,
        manual_price_policy, wizard_category, wizard_line_id,
        selected_option_reference_ids, pricing_metadata
      ) VALUES (
        v_estimate_id, p_dealer_id, v_category, v_label,
        nullif(v_line ->> 'description', ''),
        v_qty, v_unit, 0, v_ltotal, v_sort, 'manual',
        v_src, v_ref, v_man,
        nullif(v_line ->> 'pricingPolicy', ''),
        nullif(v_line ->> 'manualPricePolicy', ''),
        nullif(v_line ->> 'wizardCategory', ''),
        v_line_id,
        v_opts, v_meta
      );
      v_sort := v_sort + 1;
    END LOOP;
  EXCEPTION WHEN unique_violation THEN
    -- C.7 already rejects in-payload duplicate lineIds, so reaching the partial
    -- unique index here is an unrelated defect. Controlled, stable, no leakage.
    RAISE EXCEPTION 'ESTIMATE_ITEM_CREATE_FAILED: estimate items could not be created';
  END;

  RETURN jsonb_build_object(
    'ok', true, 'estimate_id', v_estimate_id, 'estimate_number', v_estimate_number,
    'customer_id', v_customer_id, 'vehicle_id', v_vehicle_id, 'idempotent_replay', false);
END;
$fn$;

-- CREATE OR REPLACE preserves the function's existing ACL, so the canonical
-- least-privilege grant set from 20260720024724 (the authority migration 104
-- defers to) is re-issued explicitly to converge both starting states.
REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, jsonb)
  TO service_role;

-- --- Step 4: canonical revision functions (VERBATIM from 20260920141616) -----
-- The six bodies and every security attribute below are copied verbatim from
-- 20260920141616_estimate_revision_issuance.sql; the only transformation is
-- CREATE FUNCTION -> CREATE OR REPLACE FUNCTION so the identical definitions
-- also converge an all-present state without destructive drops. Functions are
-- created before Step 5 wires the triggers to them.
CREATE OR REPLACE FUNCTION public.reject_estimate_revision_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_HISTORY: estimate revision history cannot be changed';
END;
$fn$;

-- Snapshot-backed estimate content is immutable even if a stale/dead legacy
-- action or a direct SQL caller survives elsewhere. Workflow status remains a
-- separate lifecycle concern and may change together with updated_at.
CREATE OR REPLACE FUNCTION public.protect_snapshot_backed_estimate_content()
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

CREATE OR REPLACE FUNCTION public.protect_snapshot_backed_estimate_items()
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

-- Validate only the minimum identity envelope here. The complete draft is already
-- validated by the authoritative TypeScript save-intent boundary before this RPC.
-- Keeping the raw snapshot beside the priced estimate is what makes exact revision
-- restoration possible without reconstructing intent from lossy line items.
CREATE OR REPLACE FUNCTION public.assert_estimate_wizard_snapshot_v22(p_draft jsonb)
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

CREATE OR REPLACE FUNCTION public.save_estimate_from_wizard_v2(
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

CREATE OR REPLACE FUNCTION public.issue_estimate_revision_from_wizard(
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

-- --- Step 5: canonical immutability triggers (exact canonical DDL) -----------
-- Step 0 excluded partial states, so a missing trigger here means the whole
-- revision set was absent and every trigger is created canonically; present
-- triggers are left untouched and validated in Step 7.
DO $create_triggers$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger g
                  WHERE NOT g.tgisinternal
                    AND g.tgname  = 'estimate_wizard_snapshots_immutable'
                    AND g.tgrelid = 'public.estimate_wizard_snapshots'::regclass) THEN
    EXECUTE $ddl$
CREATE TRIGGER estimate_wizard_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.estimate_wizard_snapshots
FOR EACH ROW EXECUTE FUNCTION public.reject_estimate_revision_history_mutation();
    $ddl$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger g
                  WHERE NOT g.tgisinternal
                    AND g.tgname  = 'estimate_revisions_immutable'
                    AND g.tgrelid = 'public.estimate_revisions'::regclass) THEN
    EXECUTE $ddl$
CREATE TRIGGER estimate_revisions_immutable
BEFORE UPDATE OR DELETE ON public.estimate_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_estimate_revision_history_mutation();
    $ddl$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger g
                  WHERE NOT g.tgisinternal
                    AND g.tgname  = 'estimates_snapshot_content_immutable'
                    AND g.tgrelid = 'public.estimates'::regclass) THEN
    EXECUTE $ddl$
CREATE TRIGGER estimates_snapshot_content_immutable
BEFORE UPDATE OR DELETE ON public.estimates
FOR EACH ROW EXECUTE FUNCTION public.protect_snapshot_backed_estimate_content();
    $ddl$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger g
                  WHERE NOT g.tgisinternal
                    AND g.tgname  = 'estimate_items_snapshot_immutable'
                    AND g.tgrelid = 'public.estimate_items'::regclass) THEN
    EXECUTE $ddl$
CREATE TRIGGER estimate_items_snapshot_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_items
FOR EACH ROW EXECUTE FUNCTION public.protect_snapshot_backed_estimate_items();
    $ddl$;
  END IF;
END
$create_triggers$;

-- --- Step 6: canonical function privileges and comments (VERBATIM) -----------
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

-- --- Step 6b: exact ACL convergence to the literal canonical allowlist -------
-- GRANT is additive and CREATE OR REPLACE FUNCTION preserves a pre-existing
-- ACL, so in the all-present starting state a grantee outside
-- PUBLIC/anon/authenticated/service_role (which the static statements above
-- already reset) could silently retain table privileges or EXECUTE. Every
-- non-owner grantee — table-level, column-level, and function-level — is
-- therefore revoked dynamically here, and the exact canonical grants are
-- re-issued below. Plain REVOKE only (never CASCADE): a dependent grant
-- chain raises and rolls the whole repair back, so an unknown ACL topology
-- fails closed instead of being partially truncated. PostgreSQL checks
-- EXECUTE on a trigger function only at CREATE TRIGGER time against the
-- trigger's creator, so the owner-only end state on the three trigger
-- functions cannot break trigger execution.
DO $acl_converge$
DECLARE
  v_rec record;
BEGIN
  -- 6b-1. Table-level entries beyond the owner.
  FOR v_rec IN
    SELECT DISTINCT n.nspname, c.relname, a.grantee
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     WHERE c.oid IN ('public.estimate_wizard_snapshots'::regclass,
                     'public.estimate_revisions'::regclass)
       AND a.grantee <> c.relowner
  LOOP
    IF v_rec.grantee = 0 THEN
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC',
                     v_rec.nspname, v_rec.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %s',
                     v_rec.nspname, v_rec.relname, v_rec.grantee::regrole);
    END IF;
  END LOOP;

  -- 6b-2. Column-level entries. REVOKE at table level does NOT remove
  -- column-level privileges, so a drifted per-column grant would otherwise
  -- survive both the static revokes and 6b-1. Canonical state has none.
  FOR v_rec IN
    SELECT DISTINCT n.nspname, c.relname, att.attname, a.grantee
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute att
        ON att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
       AND att.attacl IS NOT NULL AND cardinality(att.attacl) > 0
      CROSS JOIN LATERAL aclexplode(att.attacl) a
     WHERE c.oid IN ('public.estimate_wizard_snapshots'::regclass,
                     'public.estimate_revisions'::regclass)
  LOOP
    IF v_rec.grantee = 0 THEN
      EXECUTE format('REVOKE ALL (%I) ON TABLE %I.%I FROM PUBLIC',
                     v_rec.attname, v_rec.nspname, v_rec.relname);
    ELSE
      EXECUTE format('REVOKE ALL (%I) ON TABLE %I.%I FROM %s',
                     v_rec.attname, v_rec.nspname, v_rec.relname,
                     v_rec.grantee::regrole);
    END IF;
  END LOOP;

  -- 6b-3. Function EXECUTE entries beyond the owner, across all seven
  -- functions of this contract (the four entry points regain their canonical
  -- service_role EXECUTE immediately below).
  FOR v_rec IN
    SELECT DISTINCT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args, a.grantee
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     WHERE p.oid IN (
             'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure,
             'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
             'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure,
             'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure,
             'public.reject_estimate_revision_history_mutation()'::regprocedure,
             'public.protect_snapshot_backed_estimate_content()'::regprocedure,
             'public.protect_snapshot_backed_estimate_items()'::regprocedure)
       AND a.grantee <> p.proowner
  LOOP
    IF v_rec.grantee = 0 THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
                     v_rec.nspname, v_rec.proname, v_rec.args);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM %s',
                     v_rec.nspname, v_rec.proname, v_rec.args,
                     v_rec.grantee::regrole);
    END IF;
  END LOOP;
END
$acl_converge$;

-- Exact canonical grants, re-issued AFTER the dynamic revoke so both
-- supported starting states end identically: the revision tables carry
-- service_role SELECT, INSERT; the four canonical entry points carry
-- service_role EXECUTE; the three trigger functions stay owner-only.
GRANT SELECT, INSERT ON TABLE public.estimate_wizard_snapshots TO service_role;
GRANT SELECT, INSERT ON TABLE public.estimate_revisions TO service_role;
GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard_v2(uuid, uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_estimate_revision_from_wizard(uuid, uuid, uuid, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_estimate_wizard_snapshot_v22(jsonb) TO service_role;

-- --- Step 7: final fail-closed validation ------------------------------------
-- Runs in BOTH starting states after convergence. Any violation raises and
-- rolls the whole repair back, so a drifted all-present runtime is never
-- silently accepted.
DO $validate$
DECLARE
  v_rec  record;
  v_name text;
BEGIN
  -- 7a. save_estimate_from_wizard: identity, security, contract markers.
  SELECT p.prosecdef, p.proconfig, p.prosrc, l.lanname
    INTO v_rec
    FROM pg_proc p
    JOIN pg_language l ON l.oid = p.prolang
   WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure;
  IF v_rec.prosecdef
     OR v_rec.lanname IS DISTINCT FROM 'plpgsql'
     OR v_rec.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
  THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: save_estimate_from_wizard security/identity drifted';
  END IF;
  IF position('VALIDATION_ERROR: service-not-offered' IN v_rec.prosrc) = 0
     OR position('dealer_service_offerings' IN v_rec.prosrc) = 0
     OR position('bodySizeKey' IN v_rec.prosrc) = 0
  THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: save_estimate_from_wizard lacks the offering guard or body-size contract';
  END IF;

  -- 7b. Revision function security matrix (canonical attributes).
  FOR v_rec IN
    SELECT f.fn, f.want_secdef, f.want_volatile,
           p.prosecdef, p.provolatile, p.proconfig
      FROM (VALUES
        ('public.reject_estimate_revision_history_mutation()',                          false, 'v'),
        ('public.protect_snapshot_backed_estimate_content()',                           true,  'v'),
        ('public.protect_snapshot_backed_estimate_items()',                             true,  'v'),
        ('public.assert_estimate_wizard_snapshot_v22(jsonb)',                           false, 'i'),
        ('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)',                  false, 'v'),
        ('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)', false, 'v')
      ) AS f(fn, want_secdef, want_volatile)
      JOIN pg_proc p ON p.oid = f.fn::regprocedure
  LOOP
    IF v_rec.prosecdef IS DISTINCT FROM v_rec.want_secdef
       OR v_rec.provolatile::text IS DISTINCT FROM v_rec.want_volatile
       OR v_rec.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % security/shape drifted', v_rec.fn;
    END IF;
  END LOOP;

  -- 7c. Function ACLs: PUBLIC/anon/authenticated excluded everywhere;
  --     service_role keeps exactly the canonical entry points.
  FOR v_name IN
    SELECT f.fn
      FROM (VALUES
        ('public.save_estimate_from_wizard(uuid,uuid,jsonb)'),
        ('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'),
        ('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'),
        ('public.assert_estimate_wizard_snapshot_v22(jsonb)'),
        ('public.reject_estimate_revision_history_mutation()'),
        ('public.protect_snapshot_backed_estimate_content()'),
        ('public.protect_snapshot_backed_estimate_items()')
      ) AS f(fn)
     WHERE EXISTS (
       SELECT 1
         FROM pg_proc p
         CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        WHERE p.oid = f.fn::regprocedure
          AND (a.grantee = 0
               OR a.grantee = 'anon'::regrole
               OR a.grantee = 'authenticated'::regrole))
  LOOP
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % remains executable by PUBLIC/anon/authenticated', v_name;
  END LOOP;

  FOREACH v_name IN ARRAY ARRAY[
    'public.save_estimate_from_wizard(uuid,uuid,jsonb)',
    'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)',
    'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)',
    'public.assert_estimate_wizard_snapshot_v22(jsonb)']
  LOOP
    IF NOT has_function_privilege('service_role', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: service_role lost EXECUTE on %', v_name;
    END IF;
  END LOOP;

  -- 7d. Revision tables: RLS enabled and deterministic least-privilege ACL.
  FOREACH v_name IN ARRAY ARRAY[
    'public.estimate_wizard_snapshots', 'public.estimate_revisions']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c
                    WHERE c.oid = to_regclass(v_name) AND c.relrowsecurity) THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % does not have RLS enabled', v_name;
    END IF;
    IF NOT has_table_privilege('service_role', v_name, 'SELECT')
       OR NOT has_table_privilege('service_role', v_name, 'INSERT')
       OR has_table_privilege('service_role', v_name, 'UPDATE')
       OR has_table_privilege('service_role', v_name, 'DELETE')
       OR has_table_privilege('anon', v_name, 'SELECT')
       OR has_table_privilege('anon', v_name, 'INSERT')
       OR has_table_privilege('authenticated', v_name, 'SELECT')
       OR has_table_privilege('authenticated', v_name, 'INSERT')
    THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % table privileges drifted from canonical', v_name;
    END IF;
    IF EXISTS (SELECT 1
                 FROM pg_class c
                 CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                WHERE c.oid = to_regclass(v_name)
                  AND a.grantee = 0) THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % is accessible by PUBLIC', v_name;
    END IF;
  END LOOP;

  -- 7e. Canonical column shape (exact types + NOT NULL), both tables.
  FOR v_rec IN
    SELECT t.tbl, t.col, t.typ, t.want_nn,
           (SELECT format_type(a.atttypid, a.atttypmod)
              FROM pg_attribute a
             WHERE a.attrelid = to_regclass(t.tbl) AND a.attname = t.col
               AND a.attnum > 0 AND NOT a.attisdropped) AS actual_type,
           (SELECT a.attnotnull
              FROM pg_attribute a
             WHERE a.attrelid = to_regclass(t.tbl) AND a.attname = t.col
               AND a.attnum > 0 AND NOT a.attisdropped) AS actual_nn
      FROM (VALUES
        ('public.estimate_wizard_snapshots', 'estimate_id',                 'uuid',                     true),
        ('public.estimate_wizard_snapshots', 'dealer_id',                   'uuid',                     true),
        ('public.estimate_wizard_snapshots', 'schema_version',              'text',                     true),
        ('public.estimate_wizard_snapshots', 'draft_snapshot',              'jsonb',                    true),
        ('public.estimate_wizard_snapshots', 'snapshot_fingerprint',        'text',                     true),
        ('public.estimate_wizard_snapshots', 'configuration_revision',      'bigint',                   true),
        ('public.estimate_wizard_snapshots', 'created_at',                  'timestamp with time zone', true),
        ('public.estimate_revisions',        'id',                          'uuid',                     true),
        ('public.estimate_revisions',        'dealer_id',                   'uuid',                     true),
        ('public.estimate_revisions',        'root_estimate_id',            'uuid',                     true),
        ('public.estimate_revisions',        'predecessor_estimate_id',     'uuid',                     true),
        ('public.estimate_revisions',        'successor_estimate_id',       'uuid',                     true),
        ('public.estimate_revisions',        'revision_number',             'integer',                  true),
        ('public.estimate_revisions',        'source_snapshot_fingerprint', 'text',                     true),
        ('public.estimate_revisions',        'created_by',                  'uuid',                     true),
        ('public.estimate_revisions',        'created_at',                  'timestamp with time zone', true)
      ) AS t(tbl, col, typ, want_nn)
  LOOP
    IF v_rec.actual_type IS DISTINCT FROM v_rec.typ
       OR v_rec.actual_nn IS DISTINCT FROM v_rec.want_nn THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: %.% column shape drifted (type %, notnull %)',
        v_rec.tbl, v_rec.col, v_rec.actual_type, v_rec.actual_nn;
    END IF;
  END LOOP;

  -- 7f. Canonical primary keys, unique contracts, and RESTRICT FKs.
  FOR v_rec IN
    SELECT c.tbl, c.want_type, c.cols
      FROM (VALUES
        ('public.estimate_wizard_snapshots', 'p', ARRAY['estimate_id']),
        ('public.estimate_wizard_snapshots', 'u', ARRAY['dealer_id', 'estimate_id']),
        ('public.estimate_revisions',        'p', ARRAY['id']),
        ('public.estimate_revisions',        'u', ARRAY['predecessor_estimate_id']),
        ('public.estimate_revisions',        'u', ARRAY['successor_estimate_id']),
        ('public.estimate_revisions',        'u', ARRAY['root_estimate_id', 'revision_number'])
      ) AS c(tbl, want_type, cols)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_constraint k
        WHERE k.conrelid = to_regclass(c.tbl)
          AND k.contype::text = c.want_type
          AND (SELECT array_agg(a.attname::text ORDER BY o.ord)
                 FROM unnest(k.conkey) WITH ORDINALITY o(attnum, ord)
                 JOIN pg_attribute a
                   ON a.attrelid = k.conrelid AND a.attnum = o.attnum)
              = c.cols)
  LOOP
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % is missing its canonical ''%'' constraint on (%)',
      v_rec.tbl, v_rec.want_type, array_to_string(v_rec.cols, ', ');
  END LOOP;

  FOR v_rec IN
    SELECT c.tbl, c.cols, c.reftbl
      FROM (VALUES
        ('public.estimate_wizard_snapshots', ARRAY['estimate_id'],             'public.estimates'),
        ('public.estimate_wizard_snapshots', ARRAY['dealer_id'],               'public.dealers'),
        ('public.estimate_revisions',        ARRAY['dealer_id'],               'public.dealers'),
        ('public.estimate_revisions',        ARRAY['root_estimate_id'],        'public.estimates'),
        ('public.estimate_revisions',        ARRAY['predecessor_estimate_id'], 'public.estimates'),
        ('public.estimate_revisions',        ARRAY['successor_estimate_id'],   'public.estimates')
      ) AS c(tbl, cols, reftbl)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_constraint k
        WHERE k.conrelid  = to_regclass(c.tbl)
          AND k.contype   = 'f'
          AND k.confrelid = to_regclass(c.reftbl)
          AND k.confdeltype::text = 'r'
          AND (SELECT array_agg(a.attname::text ORDER BY o.ord)
                 FROM unnest(k.conkey) WITH ORDINALITY o(attnum, ord)
                 JOIN pg_attribute a
                   ON a.attrelid = k.conrelid AND a.attnum = o.attnum)
              = c.cols)
  LOOP
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % is missing its canonical RESTRICT FK (%) -> %',
      v_rec.tbl, array_to_string(v_rec.cols, ', '), v_rec.reftbl;
  END LOOP;

  IF (SELECT count(*) FROM pg_constraint
       WHERE conrelid = 'public.estimate_wizard_snapshots'::regclass
         AND contype = 'c') <> 4
     OR (SELECT count(*) FROM pg_constraint
          WHERE conrelid = 'public.estimate_revisions'::regclass
            AND contype = 'c') <> 3
  THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: canonical CHECK constraint set drifted';
  END IF;

  IF to_regclass('public.estimate_wizard_snapshots_dealer_created_idx') IS NULL
     OR to_regclass('public.estimate_revisions_dealer_root_idx') IS NULL
  THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: canonical revision indexes are missing';
  END IF;

  -- 7g. The four immutability triggers: enabled, canonical binding and shape.
  --     tgtype 27 = ROW + BEFORE + DELETE + UPDATE; 31 additionally INSERT.
  FOR v_rec IN
    SELECT t.tgname, t.tbl, t.fn, t.want_type
      FROM (VALUES
        ('estimate_wizard_snapshots_immutable', 'public.estimate_wizard_snapshots',
         'public.reject_estimate_revision_history_mutation()',  27),
        ('estimate_revisions_immutable',        'public.estimate_revisions',
         'public.reject_estimate_revision_history_mutation()',  27),
        ('estimates_snapshot_content_immutable', 'public.estimates',
         'public.protect_snapshot_backed_estimate_content()',   27),
        ('estimate_items_snapshot_immutable',   'public.estimate_items',
         'public.protect_snapshot_backed_estimate_items()',     31)
      ) AS t(tgname, tbl, fn, want_type)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_trigger g
        WHERE NOT g.tgisinternal
          AND g.tgname  = t.tgname
          AND g.tgrelid = to_regclass(t.tbl)
          AND g.tgfoid  = t.fn::regprocedure
          AND g.tgenabled = 'O'
          AND g.tgtype::integer = t.want_type)
  LOOP
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: trigger % on % is missing or drifted',
      v_rec.tgname, v_rec.tbl;
  END LOOP;
END
$validate$;

-- --- Step 7h: exact canonical table equivalence (same-transaction shadow) ----
-- Presence/count checks alone cannot prove that an all-present runtime is the
-- canonical one: a weakened CHECK expression, a wrong or extra index, a
-- missing DEFAULT, or an extra column/constraint would pass them. The exact
-- canonical DDL from 20260920141616 is therefore replayed VERBATIM into a
-- scratch schema inside this same transaction, and each live table must match
-- its shadow EXACTLY on the column set (name, type, NOT NULL, DEFAULT
-- expression), the complete named-constraint set (name, type, full
-- server-rendered definition — exact CHECK expressions and PK/UNIQUE/FK
-- semantics included), and the complete named-index-definition set. Both
-- sides are rendered by this server in this session, so nothing depends on
-- hand-maintained expected text. Extra triggers, RLS policies, or FORCE ROW
-- LEVEL SECURITY on the two revision tables are rejected as non-canonical.
-- The scratch schema is dropped WITHOUT CASCADE before COMMIT.
DO $shadow_validate$
DECLARE
  v_tbl  text;
  v_diff bigint;
BEGIN
  IF to_regnamespace('estimate_runtime_repair_shadow') IS NOT NULL THEN
    RAISE EXCEPTION
      'ESTIMATE_RUNTIME_REPAIR_VALIDATION: scratch schema estimate_runtime_repair_shadow already exists';
  END IF;
  EXECUTE 'CREATE SCHEMA estimate_runtime_repair_shadow';

  -- VERBATIM canonical DDL from 20260920141616; the schema name of the
  -- created object is the only transformation.
  EXECUTE $ddl$
CREATE TABLE estimate_runtime_repair_shadow.estimate_wizard_snapshots (
  estimate_id              uuid PRIMARY KEY REFERENCES public.estimates(id) ON DELETE RESTRICT,
  dealer_id                uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  schema_version           text NOT NULL CHECK (schema_version = '2.2'),
  draft_snapshot           jsonb NOT NULL CHECK (jsonb_typeof(draft_snapshot) = 'object'),
  snapshot_fingerprint     text NOT NULL CHECK (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  configuration_revision   bigint NOT NULL CHECK (configuration_revision >= 0),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, estimate_id)
);
  $ddl$;
  EXECUTE $ddl$
CREATE INDEX estimate_wizard_snapshots_dealer_created_idx
  ON estimate_runtime_repair_shadow.estimate_wizard_snapshots (dealer_id, created_at DESC);
  $ddl$;
  EXECUTE $ddl$
CREATE TABLE estimate_runtime_repair_shadow.estimate_revisions (
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
  $ddl$;
  EXECUTE $ddl$
CREATE INDEX estimate_revisions_dealer_root_idx
  ON estimate_runtime_repair_shadow.estimate_revisions (dealer_id, root_estimate_id, revision_number);
  $ddl$;

  FOREACH v_tbl IN ARRAY ARRAY['estimate_wizard_snapshots', 'estimate_revisions'] LOOP
    -- Exact column set: name, type, NOT NULL, DEFAULT expression; both
    -- missing and EXTRA columns count as differences.
    SELECT count(*) INTO v_diff FROM (
      (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod) AS typ,
              a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '') AS dflt
         FROM pg_attribute a
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = to_regclass('public.' || v_tbl)
          AND a.attnum > 0 AND NOT a.attisdropped
       EXCEPT
       SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
              a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
         FROM pg_attribute a
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = to_regclass('estimate_runtime_repair_shadow.' || v_tbl)
          AND a.attnum > 0 AND NOT a.attisdropped)
      UNION ALL
      (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
              a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
         FROM pg_attribute a
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = to_regclass('estimate_runtime_repair_shadow.' || v_tbl)
          AND a.attnum > 0 AND NOT a.attisdropped
       EXCEPT
       SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
              a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
         FROM pg_attribute a
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = to_regclass('public.' || v_tbl)
          AND a.attnum > 0 AND NOT a.attisdropped)
    ) diff;
    IF v_diff <> 0 THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: public.% column set diverges from canonical (% differences)',
        v_tbl, v_diff;
    END IF;

    -- Exact complete constraint set: name, type, and full server-rendered
    -- definition. Covers exact CHECK expressions, PK/UNIQUE/FK semantics,
    -- and rejects EXTRA constraints of any type.
    SELECT count(*) INTO v_diff FROM (
      (SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
         FROM pg_constraint k
        WHERE k.conrelid = to_regclass('public.' || v_tbl)
       EXCEPT
       SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
         FROM pg_constraint k
        WHERE k.conrelid = to_regclass('estimate_runtime_repair_shadow.' || v_tbl))
      UNION ALL
      (SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
         FROM pg_constraint k
        WHERE k.conrelid = to_regclass('estimate_runtime_repair_shadow.' || v_tbl)
       EXCEPT
       SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
         FROM pg_constraint k
        WHERE k.conrelid = to_regclass('public.' || v_tbl))
    ) diff;
    IF v_diff <> 0 THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: public.% constraint set diverges from canonical (% differences)',
        v_tbl, v_diff;
    END IF;

    -- Exact complete named index definitions. The schema qualifier is
    -- stripped from BOTH sides with the same transformation, so the
    -- comparison is name + full definition, never schema spelling.
    SELECT count(*) INTO v_diff FROM (
      (SELECT replace(replace(pg_get_indexdef(i.indexrelid),
                ' ON estimate_runtime_repair_shadow.', ' ON '), ' ON public.', ' ON ')
         FROM pg_index i
        WHERE i.indrelid = to_regclass('public.' || v_tbl)
       EXCEPT
       SELECT replace(replace(pg_get_indexdef(i.indexrelid),
                ' ON estimate_runtime_repair_shadow.', ' ON '), ' ON public.', ' ON ')
         FROM pg_index i
        WHERE i.indrelid = to_regclass('estimate_runtime_repair_shadow.' || v_tbl))
      UNION ALL
      (SELECT replace(replace(pg_get_indexdef(i.indexrelid),
                ' ON estimate_runtime_repair_shadow.', ' ON '), ' ON public.', ' ON ')
         FROM pg_index i
        WHERE i.indrelid = to_regclass('estimate_runtime_repair_shadow.' || v_tbl)
       EXCEPT
       SELECT replace(replace(pg_get_indexdef(i.indexrelid),
                ' ON estimate_runtime_repair_shadow.', ' ON '), ' ON public.', ' ON ')
         FROM pg_index i
        WHERE i.indrelid = to_regclass('public.' || v_tbl))
    ) diff;
    IF v_diff <> 0 THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: public.% index definitions diverge from canonical (% differences)',
        v_tbl, v_diff;
    END IF;

    -- Canonical trigger/policy surface on the revision tables: exactly ONE
    -- non-internal trigger (validated by name/function/shape in Step 7g),
    -- zero RLS policies, and no FORCE ROW LEVEL SECURITY.
    IF (SELECT count(*) FROM pg_trigger g
         WHERE g.tgrelid = to_regclass('public.' || v_tbl)
           AND NOT g.tgisinternal) <> 1 THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: public.% carries a non-canonical trigger set', v_tbl;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy
                WHERE polrelid = to_regclass('public.' || v_tbl)) THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: public.% carries an unexpected RLS policy', v_tbl;
    END IF;
    IF (SELECT c.relforcerowsecurity FROM pg_class c
         WHERE c.oid = to_regclass('public.' || v_tbl)) THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: public.% has non-canonical FORCE ROW LEVEL SECURITY', v_tbl;
    END IF;
  END LOOP;

  EXECUTE 'DROP TABLE estimate_runtime_repair_shadow.estimate_revisions';
  EXECUTE 'DROP TABLE estimate_runtime_repair_shadow.estimate_wizard_snapshots';
  EXECUTE 'DROP SCHEMA estimate_runtime_repair_shadow';
END
$shadow_validate$;

-- --- Step 7i: exact ACL end-state validation ----------------------------------
-- Excluding PUBLIC/anon/authenticated is not exactness: an unknown grantee
-- kept by GRANT-additivity or a CREATE OR REPLACE-preserved function ACL must
-- also be impossible. Every non-owner ACL entry is compared against the
-- literal canonical allowlist, column ACLs must not exist, and canonical
-- owner privileges are proven semantically intact.
DO $acl_validate$
DECLARE
  v_rec  record;
  v_diff bigint;
  v_priv text;
BEGIN
  -- Tables: the non-owner entry set is EXACTLY service_role SELECT, INSERT,
  -- neither grantable; and no column-level ACL entry exists.
  FOR v_rec IN
    SELECT t.tbl FROM (VALUES
      ('public.estimate_wizard_snapshots'),
      ('public.estimate_revisions')) AS t(tbl)
  LOOP
    SELECT count(*) INTO v_diff FROM (
      (SELECT a.grantee, a.privilege_type, a.is_grantable
         FROM pg_class c
         CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        WHERE c.oid = to_regclass(v_rec.tbl) AND a.grantee <> c.relowner
       EXCEPT
       SELECT v.* FROM (VALUES
         ('service_role'::regrole::oid, 'SELECT'::text, false),
         ('service_role'::regrole::oid, 'INSERT'::text, false)) AS v(grantee, privilege_type, is_grantable))
      UNION ALL
      (SELECT v.* FROM (VALUES
         ('service_role'::regrole::oid, 'SELECT'::text, false),
         ('service_role'::regrole::oid, 'INSERT'::text, false)) AS v(grantee, privilege_type, is_grantable)
       EXCEPT
       SELECT a.grantee, a.privilege_type, a.is_grantable
         FROM pg_class c
         CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        WHERE c.oid = to_regclass(v_rec.tbl) AND a.grantee <> c.relowner)
    ) diff;
    IF v_diff <> 0 THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % table ACL diverges from the canonical allowlist', v_rec.tbl;
    END IF;

    IF EXISTS (
      SELECT 1
        FROM pg_attribute att
        CROSS JOIN LATERAL aclexplode(att.attacl) a
       WHERE att.attrelid = to_regclass(v_rec.tbl)
         AND att.attnum > 0 AND NOT att.attisdropped
         AND att.attacl IS NOT NULL AND cardinality(att.attacl) > 0) THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % carries a non-canonical column-level ACL', v_rec.tbl;
    END IF;

    FOREACH v_priv IN ARRAY ARRAY[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF NOT has_table_privilege(
               (SELECT c.relowner FROM pg_class c WHERE c.oid = to_regclass(v_rec.tbl)),
               to_regclass(v_rec.tbl), v_priv) THEN
        RAISE EXCEPTION
          'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % owner lost canonical % privilege', v_rec.tbl, v_priv;
      END IF;
    END LOOP;
  END LOOP;

  -- Entry points: the non-owner entry set is EXACTLY service_role EXECUTE,
  -- not grantable.
  FOR v_rec IN
    SELECT f.fn FROM (VALUES
      ('public.save_estimate_from_wizard(uuid,uuid,jsonb)'),
      ('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'),
      ('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'),
      ('public.assert_estimate_wizard_snapshot_v22(jsonb)')) AS f(fn)
  LOOP
    SELECT count(*) INTO v_diff FROM (
      (SELECT a.grantee, a.privilege_type, a.is_grantable
         FROM pg_proc p
         CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        WHERE p.oid = v_rec.fn::regprocedure AND a.grantee <> p.proowner
       EXCEPT
       SELECT v.* FROM (VALUES
         ('service_role'::regrole::oid, 'EXECUTE'::text, false)) AS v(grantee, privilege_type, is_grantable))
      UNION ALL
      (SELECT v.* FROM (VALUES
         ('service_role'::regrole::oid, 'EXECUTE'::text, false)) AS v(grantee, privilege_type, is_grantable)
       EXCEPT
       SELECT a.grantee, a.privilege_type, a.is_grantable
         FROM pg_proc p
         CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        WHERE p.oid = v_rec.fn::regprocedure AND a.grantee <> p.proowner)
    ) diff;
    IF v_diff <> 0 THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % EXECUTE ACL diverges from the canonical allowlist', v_rec.fn;
    END IF;
  END LOOP;

  -- Trigger functions: NO non-owner grantee at all.
  FOR v_rec IN
    SELECT f.fn FROM (VALUES
      ('public.reject_estimate_revision_history_mutation()'),
      ('public.protect_snapshot_backed_estimate_content()'),
      ('public.protect_snapshot_backed_estimate_items()')) AS f(fn)
  LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_proc p
        CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       WHERE p.oid = v_rec.fn::regprocedure AND a.grantee <> p.proowner) THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: % grants EXECUTE beyond the owner', v_rec.fn;
    END IF;
  END LOOP;

  -- The owner keeps EXECUTE on all seven functions.
  FOR v_rec IN
    SELECT f.fn FROM (VALUES
      ('public.save_estimate_from_wizard(uuid,uuid,jsonb)'),
      ('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'),
      ('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'),
      ('public.assert_estimate_wizard_snapshot_v22(jsonb)'),
      ('public.reject_estimate_revision_history_mutation()'),
      ('public.protect_snapshot_backed_estimate_content()'),
      ('public.protect_snapshot_backed_estimate_items()')) AS f(fn)
  LOOP
    IF NOT has_function_privilege(
             (SELECT p.proowner FROM pg_proc p WHERE p.oid = v_rec.fn::regprocedure),
             v_rec.fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION
        'ESTIMATE_RUNTIME_REPAIR_VALIDATION: owner lost EXECUTE on %', v_rec.fn;
    END IF;
  END LOOP;
END
$acl_validate$;

COMMIT;
