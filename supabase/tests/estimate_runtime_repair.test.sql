-- ESTIMATE_RUNTIME_REPAIR (20260921132331_estimate_runtime_repair.sql):
-- deterministic, metadata-only pgTAP proof that the converged runtime carries
-- the canonical estimate save/revision contract:
--   * save_estimate_from_wizard holds the managed-service offering guard AND
--     the body-size contract, SECURITY INVOKER, pinned search_path;
--   * both revision tables, all six revision functions, and all four
--     immutability triggers exist with canonical binding and security;
--   * save/revision entry-point ACLs exclude PUBLIC/anon/authenticated and
--     allow service_role;
--   * snapshot/revision tables have RLS enabled and exactly the canonical
--     service_role SELECT, INSERT table privileges;
--   * the immutability and revision contracts are present;
--   * migration replay created ZERO business rows (no backfill/update/delete
--     behavior): on a freshly replayed database the estimate family is empty;
--   * the converged tables are EXACTLY canonical: columns/types/NOT NULL/
--     DEFAULT expressions, exact named constraints (including exact CHECK
--     expressions and PK/UNIQUE/FK semantics), and exact named index
--     definitions are proven equal to a same-transaction shadow replay of
--     the VERBATIM canonical DDL from 20260920141616;
--   * ACL grantee/privilege sets are EXACT: beyond the owner, the revision
--     tables carry only service_role SELECT, INSERT (not grantable); the
--     four entry points carry only service_role EXECUTE (not grantable);
--     the three trigger functions carry no non-owner EXECUTE; no
--     column-level ACL and no unknown grantee exists anywhere in scope;
--   * hostile negative controls prove the drift detectors detect: a seeded
--     scratch-schema drift replica (weakened CHECK, dropped DEFAULT, extra
--     column, de-DESCed index, hostile EXECUTE grant) is flagged by the very
--     comparison queries used for the canonical assertions.
--
-- DOCUMENTED LIMITATION: a full replay-mutation scenario — running
-- 20260921132331 against a deliberately drifted database and observing its
-- fail-closed abort — cannot live in this post-migration pgTAP file: the
-- migration has already been applied by the harness, and seeding drift into
-- the live public objects would mutate canonical state outside this file's
-- allowlist. Section O therefore proves detector sensitivity against
-- scratch-schema replicas inside this rolled-back transaction instead.
--
-- Standalone pgTAP candidate for a disposable local database that has replayed
-- every committed migration. No fixture rows are inserted into any business
-- table; assertions read catalogs, count empty tables, or compare against
-- scratch-schema shadow objects created inside this transaction, and the
-- transaction ends in ROLLBACK regardless, so the file is deterministic and
-- side-effect free.

BEGIN;

SELECT plan(74);

-- ============================================================
-- A. Canonical save_estimate_from_wizard
-- ============================================================
SELECT ok(
  to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)') IS NOT NULL,
  '01: save_estimate_from_wizard(uuid,uuid,jsonb) exists'
);
SELECT ok(
  NOT (SELECT p.prosecdef FROM pg_proc p
        WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure),
  '02: save_estimate_from_wizard is SECURITY INVOKER'
);
SELECT is(
  (SELECT p.proconfig FROM pg_proc p
    WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure),
  ARRAY['search_path=pg_catalog, public, pg_temp']::text[],
  '03: save_estimate_from_wizard pins search_path = pg_catalog, public, pg_temp'
);
SELECT ok(
  position('VALIDATION_ERROR: service-not-offered' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure)) > 0,
  '04: save_estimate_from_wizard raises the stable service-not-offered denial'
);
SELECT ok(
  position('dealer_service_offerings' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure)) > 0,
  '05: save_estimate_from_wizard consults dealer_service_offerings (C.9a guard)'
);
SELECT ok(
  position('bodySizeKey' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure)) > 0,
  '06: save_estimate_from_wizard keeps the bodySizeKey contract'
);
SELECT ok(
  position($sz$ARRAY['SS','S','M','ML','L','LL','XL']$sz$ IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure)) > 0,
  '07: save_estimate_from_wizard enforces the canonical seven-size key set'
);
SELECT ok(
  position('body_size' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure)) > 0,
  '08: save_estimate_from_wizard persists vehicles.body_size'
);

-- ============================================================
-- B. save_estimate_from_wizard EXECUTE ACL
-- ============================================================
SELECT ok(
  NOT has_function_privilege('anon',
    'public.save_estimate_from_wizard(uuid,uuid,jsonb)', 'EXECUTE'),
  '09: anon cannot execute save_estimate_from_wizard'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.save_estimate_from_wizard(uuid,uuid,jsonb)', 'EXECUTE'),
  '10: authenticated cannot execute save_estimate_from_wizard'
);
SELECT ok(
  has_function_privilege('service_role',
    'public.save_estimate_from_wizard(uuid,uuid,jsonb)', 'EXECUTE'),
  '11: service_role can execute save_estimate_from_wizard'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure
      AND a.grantee = 0),
  0::bigint,
  '12: PUBLIC holds no privilege on save_estimate_from_wizard'
);

-- ============================================================
-- C. Revision tables and RLS
-- ============================================================
SELECT ok(
  to_regclass('public.estimate_wizard_snapshots') IS NOT NULL,
  '13: estimate_wizard_snapshots exists'
);
SELECT ok(
  to_regclass('public.estimate_revisions') IS NOT NULL,
  '14: estimate_revisions exists'
);
SELECT ok(
  (SELECT c.relrowsecurity FROM pg_class c
    WHERE c.oid = 'public.estimate_wizard_snapshots'::regclass),
  '15: estimate_wizard_snapshots has RLS enabled'
);
SELECT ok(
  (SELECT c.relrowsecurity FROM pg_class c
    WHERE c.oid = 'public.estimate_revisions'::regclass),
  '16: estimate_revisions has RLS enabled'
);

-- ============================================================
-- D. Revision functions: existence and security identity
-- ============================================================
SELECT is(
  (SELECT count(*) FROM (VALUES
     (to_regprocedure('public.reject_estimate_revision_history_mutation()')),
     (to_regprocedure('public.protect_snapshot_backed_estimate_content()')),
     (to_regprocedure('public.protect_snapshot_backed_estimate_items()')),
     (to_regprocedure('public.assert_estimate_wizard_snapshot_v22(jsonb)')),
     (to_regprocedure('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)')),
     (to_regprocedure('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'))
   ) AS f(oid) WHERE f.oid IS NOT NULL),
  6::bigint,
  '17: all six canonical revision functions exist'
);
SELECT ok(
  NOT (SELECT p.prosecdef FROM pg_proc p
        WHERE p.oid = 'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure),
  '18: save_estimate_from_wizard_v2 is SECURITY INVOKER'
);
SELECT ok(
  NOT (SELECT p.prosecdef FROM pg_proc p
        WHERE p.oid = 'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure),
  '19: issue_estimate_revision_from_wizard is SECURITY INVOKER'
);
SELECT ok(
  NOT (SELECT p.prosecdef FROM pg_proc p
        WHERE p.oid = 'public.reject_estimate_revision_history_mutation()'::regprocedure),
  '20: reject_estimate_revision_history_mutation is SECURITY INVOKER'
);
SELECT ok(
  (SELECT p.prosecdef FROM pg_proc p
    WHERE p.oid = 'public.protect_snapshot_backed_estimate_content()'::regprocedure),
  '21: protect_snapshot_backed_estimate_content is SECURITY DEFINER (canonical)'
);
SELECT ok(
  (SELECT p.prosecdef FROM pg_proc p
    WHERE p.oid = 'public.protect_snapshot_backed_estimate_items()'::regprocedure),
  '22: protect_snapshot_backed_estimate_items is SECURITY DEFINER (canonical)'
);
SELECT ok(
  (SELECT p.provolatile = 'i' AND NOT p.prosecdef FROM pg_proc p
    WHERE p.oid = 'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure),
  '23: assert_estimate_wizard_snapshot_v22 is IMMUTABLE SECURITY INVOKER'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
    WHERE p.oid IN (
      'public.reject_estimate_revision_history_mutation()'::regprocedure,
      'public.protect_snapshot_backed_estimate_content()'::regprocedure,
      'public.protect_snapshot_backed_estimate_items()'::regprocedure,
      'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure,
      'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
      'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure)
      AND p.proconfig = ARRAY['search_path=""']::text[]),
  6::bigint,
  '24: all six revision functions pin an empty search_path'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
    WHERE p.oid IN (
      'public.reject_estimate_revision_history_mutation()'::regprocedure,
      'public.protect_snapshot_backed_estimate_content()'::regprocedure,
      'public.protect_snapshot_backed_estimate_items()'::regprocedure)
      AND p.prorettype = 'trigger'::regtype),
  3::bigint,
  '25: the three guard functions return trigger'
);

-- ============================================================
-- E. The four immutability triggers (canonical binding and shape)
--    tgtype 27 = ROW+BEFORE+DELETE+UPDATE; 31 additionally INSERT.
-- ============================================================
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger g
           WHERE NOT g.tgisinternal
             AND g.tgname  = 'estimate_wizard_snapshots_immutable'
             AND g.tgrelid = 'public.estimate_wizard_snapshots'::regclass
             AND g.tgfoid  = 'public.reject_estimate_revision_history_mutation()'::regprocedure
             AND g.tgenabled = 'O'
             AND g.tgtype::integer = 27),
  '26: estimate_wizard_snapshots_immutable trigger is canonical and enabled'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger g
           WHERE NOT g.tgisinternal
             AND g.tgname  = 'estimate_revisions_immutable'
             AND g.tgrelid = 'public.estimate_revisions'::regclass
             AND g.tgfoid  = 'public.reject_estimate_revision_history_mutation()'::regprocedure
             AND g.tgenabled = 'O'
             AND g.tgtype::integer = 27),
  '27: estimate_revisions_immutable trigger is canonical and enabled'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger g
           WHERE NOT g.tgisinternal
             AND g.tgname  = 'estimates_snapshot_content_immutable'
             AND g.tgrelid = 'public.estimates'::regclass
             AND g.tgfoid  = 'public.protect_snapshot_backed_estimate_content()'::regprocedure
             AND g.tgenabled = 'O'
             AND g.tgtype::integer = 27),
  '28: estimates_snapshot_content_immutable trigger is canonical and enabled'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger g
           WHERE NOT g.tgisinternal
             AND g.tgname  = 'estimate_items_snapshot_immutable'
             AND g.tgrelid = 'public.estimate_items'::regclass
             AND g.tgfoid  = 'public.protect_snapshot_backed_estimate_items()'::regprocedure
             AND g.tgenabled = 'O'
             AND g.tgtype::integer = 31),
  '29: estimate_items_snapshot_immutable trigger is canonical and enabled'
);

-- ============================================================
-- F. Canonical table shape: keys, FKs, checks, indexes
-- ============================================================
SELECT is(
  (SELECT count(*)
     FROM (VALUES
       ('public.estimate_wizard_snapshots', 'p', ARRAY['estimate_id']),
       ('public.estimate_wizard_snapshots', 'u', ARRAY['dealer_id', 'estimate_id']),
       ('public.estimate_revisions',        'p', ARRAY['id']),
       ('public.estimate_revisions',        'u', ARRAY['predecessor_estimate_id']),
       ('public.estimate_revisions',        'u', ARRAY['successor_estimate_id']),
       ('public.estimate_revisions',        'u', ARRAY['root_estimate_id', 'revision_number'])
     ) AS c(tbl, want_type, cols)
    WHERE EXISTS (
      SELECT 1 FROM pg_constraint k
       WHERE k.conrelid = to_regclass(c.tbl)
         AND k.contype::text = c.want_type
         AND (SELECT array_agg(a.attname::text ORDER BY o.ord)
                FROM unnest(k.conkey) WITH ORDINALITY o(attnum, ord)
                JOIN pg_attribute a
                  ON a.attrelid = k.conrelid AND a.attnum = o.attnum)
             = c.cols)),
  6::bigint,
  '30: canonical PK and UNIQUE contracts present (one-successor revision chain)'
);
SELECT is(
  (SELECT count(*)
     FROM (VALUES
       ('public.estimate_wizard_snapshots', ARRAY['estimate_id'],             'public.estimates'),
       ('public.estimate_wizard_snapshots', ARRAY['dealer_id'],               'public.dealers'),
       ('public.estimate_revisions',        ARRAY['dealer_id'],               'public.dealers'),
       ('public.estimate_revisions',        ARRAY['root_estimate_id'],        'public.estimates'),
       ('public.estimate_revisions',        ARRAY['predecessor_estimate_id'], 'public.estimates'),
       ('public.estimate_revisions',        ARRAY['successor_estimate_id'],   'public.estimates')
     ) AS c(tbl, cols, reftbl)
    WHERE EXISTS (
      SELECT 1 FROM pg_constraint k
       WHERE k.conrelid  = to_regclass(c.tbl)
         AND k.contype   = 'f'
         AND k.confrelid = to_regclass(c.reftbl)
         AND k.confdeltype::text = 'r'
         AND (SELECT array_agg(a.attname::text ORDER BY o.ord)
                FROM unnest(k.conkey) WITH ORDINALITY o(attnum, ord)
                JOIN pg_attribute a
                  ON a.attrelid = k.conrelid AND a.attnum = o.attnum)
             = c.cols)),
  6::bigint,
  '31: all six canonical ON DELETE RESTRICT foreign keys present'
);
SELECT is(
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.estimate_wizard_snapshots'::regclass
      AND contype = 'c'),
  4::bigint,
  '32: estimate_wizard_snapshots keeps its four canonical CHECK constraints'
);
SELECT is(
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.estimate_revisions'::regclass
      AND contype = 'c'),
  3::bigint,
  '33: estimate_revisions keeps its three canonical CHECK constraints'
);
SELECT ok(
  to_regclass('public.estimate_wizard_snapshots_dealer_created_idx') IS NOT NULL
  AND to_regclass('public.estimate_revisions_dealer_root_idx') IS NOT NULL,
  '34: both canonical revision indexes exist'
);

-- ============================================================
-- G. Table privileges: canonical service_role SELECT, INSERT only
-- ============================================================
SELECT ok(
  has_table_privilege('service_role', 'public.estimate_wizard_snapshots', 'SELECT')
  AND has_table_privilege('service_role', 'public.estimate_wizard_snapshots', 'INSERT'),
  '35: service_role holds SELECT, INSERT on estimate_wizard_snapshots'
);
SELECT ok(
  NOT has_table_privilege('service_role', 'public.estimate_wizard_snapshots', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.estimate_wizard_snapshots', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.estimate_wizard_snapshots', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.estimate_wizard_snapshots', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.estimate_wizard_snapshots', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.estimate_wizard_snapshots', 'INSERT')
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
     CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     WHERE c.oid = 'public.estimate_wizard_snapshots'::regclass AND a.grantee = 0),
  '36: estimate_wizard_snapshots denies UPDATE/DELETE and PUBLIC/anon/authenticated'
);
SELECT ok(
  has_table_privilege('service_role', 'public.estimate_revisions', 'SELECT')
  AND has_table_privilege('service_role', 'public.estimate_revisions', 'INSERT'),
  '37: service_role holds SELECT, INSERT on estimate_revisions'
);
SELECT ok(
  NOT has_table_privilege('service_role', 'public.estimate_revisions', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.estimate_revisions', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.estimate_revisions', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.estimate_revisions', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.estimate_revisions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.estimate_revisions', 'INSERT')
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
     CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     WHERE c.oid = 'public.estimate_revisions'::regclass AND a.grantee = 0),
  '38: estimate_revisions denies UPDATE/DELETE and PUBLIC/anon/authenticated'
);

-- ============================================================
-- H. Revision entry-point EXECUTE ACLs
-- ============================================================
SELECT ok(
  NOT has_function_privilege('anon',
    'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)', 'EXECUTE'),
  '39: anon cannot execute save_estimate_from_wizard_v2'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)', 'EXECUTE'),
  '40: authenticated cannot execute save_estimate_from_wizard_v2'
);
SELECT ok(
  has_function_privilege('service_role',
    'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)', 'EXECUTE'),
  '41: service_role can execute save_estimate_from_wizard_v2'
);
SELECT ok(
  NOT has_function_privilege('anon',
    'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)', 'EXECUTE'),
  '42: anon cannot execute issue_estimate_revision_from_wizard'
);
SELECT ok(
  NOT has_function_privilege('authenticated',
    'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)', 'EXECUTE'),
  '43: authenticated cannot execute issue_estimate_revision_from_wizard'
);
SELECT ok(
  has_function_privilege('service_role',
    'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)', 'EXECUTE'),
  '44: service_role can execute issue_estimate_revision_from_wizard'
);
SELECT ok(
  has_function_privilege('service_role',
    'public.assert_estimate_wizard_snapshot_v22(jsonb)', 'EXECUTE'),
  '45: service_role can execute assert_estimate_wizard_snapshot_v22'
);
SELECT is(
  (SELECT count(*) FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid IN (
      'public.reject_estimate_revision_history_mutation()'::regprocedure,
      'public.protect_snapshot_backed_estimate_content()'::regprocedure,
      'public.protect_snapshot_backed_estimate_items()'::regprocedure,
      'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure,
      'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
      'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure)
      AND a.grantee = 0),
  0::bigint,
  '46: PUBLIC holds no privilege on any revision function'
);

-- ============================================================
-- I. Immutability and revision contract markers
-- ============================================================
SELECT ok(
  position('IMMUTABLE_HISTORY' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.reject_estimate_revision_history_mutation()'::regprocedure)) > 0,
  '47: revision history mutation raises IMMUTABLE_HISTORY'
);
SELECT ok(
  position('IMMUTABLE_ESTIMATE' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.protect_snapshot_backed_estimate_content()'::regprocedure)) > 0
  AND position('IMMUTABLE_ESTIMATE' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.protect_snapshot_backed_estimate_items()'::regprocedure)) > 0,
  '48: snapshot-backed estimate content/items raise IMMUTABLE_ESTIMATE'
);
SELECT ok(
  position('REVISION_SOURCE_UNAVAILABLE' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure)) > 0
  AND position('REVISION_SOURCE_CHANGED' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure)) > 0
  AND position('REVISION_CONFLICT' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure)) > 0,
  '49: issue_estimate_revision_from_wizard carries the canonical revision contract'
);
SELECT ok(
  position('SNAPSHOT_MISSING' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure)) > 0
  AND position('DUPLICATE_SUBMISSION' IN (
    SELECT p.prosrc FROM pg_proc p
     WHERE p.oid = 'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure)) > 0,
  '50: save_estimate_from_wizard_v2 carries the canonical snapshot/replay contract'
);

-- ============================================================
-- J. No backfill: replaying every migration created ZERO business rows
-- ============================================================
SELECT ok(
  (SELECT count(*) FROM public.estimates) = 0
  AND (SELECT count(*) FROM public.estimate_items) = 0,
  '51: migration replay created no estimate or estimate_item rows'
);
SELECT ok(
  (SELECT count(*) FROM public.estimate_wizard_snapshots) = 0
  AND (SELECT count(*) FROM public.estimate_revisions) = 0,
  '52: migration replay created no snapshot or revision rows'
);

-- ============================================================
-- K. Exact canonical table shape (same-transaction shadow replay)
--    The canonical DDL from 20260920141616 is replayed VERBATIM into a
--    scratch schema; live tables must match it EXACTLY. Both sides are
--    rendered by the same server, so no hand-maintained expected text can
--    drift. Everything below is rolled back with this transaction.
-- ============================================================
CREATE SCHEMA estimate_runtime_repair_shadow_pgtap;

CREATE TABLE estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots (
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
  ON estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots (dealer_id, created_at DESC);

CREATE TABLE estimate_runtime_repair_shadow_pgtap.estimate_revisions (
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
  ON estimate_runtime_repair_shadow_pgtap.estimate_revisions (dealer_id, root_estimate_id, revision_number);

SELECT is(
  (SELECT count(*) FROM (
    (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'public.estimate_wizard_snapshots'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
     EXCEPT
     SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
    UNION ALL
    (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
     EXCEPT
     SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'public.estimate_wizard_snapshots'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
  ) diff),
  0::bigint,
  '53: estimate_wizard_snapshots columns/types/NOT NULL/defaults exactly canonical (no extras)'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'public.estimate_revisions'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
     EXCEPT
     SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_revisions'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
    UNION ALL
    (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_revisions'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
     EXCEPT
     SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'public.estimate_revisions'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
  ) diff),
  0::bigint,
  '54: estimate_revisions columns/types/NOT NULL/defaults exactly canonical (no extras)'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'public.estimate_wizard_snapshots'::regclass
     EXCEPT
     SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass)
    UNION ALL
    (SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
     EXCEPT
     SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'public.estimate_wizard_snapshots'::regclass)
  ) diff),
  0::bigint,
  '55: estimate_wizard_snapshots named constraint set (incl. exact CHECK expressions) exactly canonical'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'public.estimate_revisions'::regclass
     EXCEPT
     SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_revisions'::regclass)
    UNION ALL
    (SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_revisions'::regclass
     EXCEPT
     SELECT k.conname::text, k.contype::text, pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'public.estimate_revisions'::regclass)
  ) diff),
  0::bigint,
  '56: estimate_revisions named constraint set (incl. exact CHECK expressions) exactly canonical'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'public.estimate_wizard_snapshots'::regclass
     EXCEPT
     SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass)
    UNION ALL
    (SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
     EXCEPT
     SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'public.estimate_wizard_snapshots'::regclass)
  ) diff),
  0::bigint,
  '57: estimate_wizard_snapshots named index definitions exactly canonical (no extras)'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'public.estimate_revisions'::regclass
     EXCEPT
     SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_revisions'::regclass)
    UNION ALL
    (SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_revisions'::regclass
     EXCEPT
     SELECT replace(replace(pg_get_indexdef(i.indexrelid),
              ' ON estimate_runtime_repair_shadow_pgtap.', ' ON '), ' ON public.', ' ON ')
       FROM pg_index i
      WHERE i.indrelid = 'public.estimate_revisions'::regclass)
  ) diff),
  0::bigint,
  '58: estimate_revisions named index definitions exactly canonical (no extras)'
);

-- ============================================================
-- L. Explicit contract-critical CHECK expressions and DEFAULTs
--    Human-readable direct evidence on top of the shadow equality above.
-- ============================================================
SELECT ok(
  (SELECT position($c$schema_version = '2.2'$c$ IN defs) > 0
      AND position($c$jsonb_typeof(draft_snapshot) = 'object'$c$ IN defs) > 0
      AND position($c$snapshot_fingerprint ~ '^[0-9a-f]{64}$'$c$ IN defs) > 0
      AND position($c$configuration_revision >= 0$c$ IN defs) > 0
     FROM (SELECT string_agg(pg_get_constraintdef(k.oid), ' ') AS defs
             FROM pg_constraint k
            WHERE k.conrelid = 'public.estimate_wizard_snapshots'::regclass
              AND k.contype = 'c') d),
  '59: estimate_wizard_snapshots CHECKs carry the four exact canonical expressions'
);
SELECT ok(
  (SELECT position($c$revision_number >= 2$c$ IN defs) > 0
      AND position($c$source_snapshot_fingerprint ~ '^[0-9a-f]{64}$'$c$ IN defs) > 0
      AND position($c$predecessor_estimate_id <> successor_estimate_id$c$ IN defs) > 0
     FROM (SELECT string_agg(pg_get_constraintdef(k.oid), ' ') AS defs
             FROM pg_constraint k
            WHERE k.conrelid = 'public.estimate_revisions'::regclass
              AND k.contype = 'c') d),
  '60: estimate_revisions CHECKs carry the three exact canonical expressions'
);
SELECT ok(
  (SELECT count(*) = 2 AND bool_and(pg_get_expr(d.adbin, d.adrelid) = 'now()')
     FROM pg_attrdef d
     JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid IN ('public.estimate_wizard_snapshots'::regclass,
                        'public.estimate_revisions'::regclass)
      AND a.attname = 'created_at'),
  '61: created_at defaults to now() on both revision tables'
);
SELECT is(
  (SELECT pg_get_expr(d.adbin, d.adrelid)
     FROM pg_attrdef d
     JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.estimate_revisions'::regclass
      AND a.attname = 'id'),
  'gen_random_uuid()',
  '62: estimate_revisions.id defaults to gen_random_uuid()'
);

-- ============================================================
-- M. Exact ACL grantee/privilege sets
--    Not merely "PUBLIC/anon/authenticated excluded": beyond the owner,
--    NOTHING may hold privileges except the literal canonical allowlist.
-- ============================================================
SELECT is(
  (SELECT count(*) FROM (
    (SELECT a.grantee, a.privilege_type, a.is_grantable
       FROM pg_class c
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      WHERE c.oid = 'public.estimate_wizard_snapshots'::regclass
        AND a.grantee <> c.relowner
     EXCEPT
     SELECT v.* FROM (VALUES
       ('service_role'::regrole::oid, 'SELECT'::text, false),
       ('service_role'::regrole::oid, 'INSERT'::text, false)) AS v(g, p, o))
    UNION ALL
    (SELECT v.* FROM (VALUES
       ('service_role'::regrole::oid, 'SELECT'::text, false),
       ('service_role'::regrole::oid, 'INSERT'::text, false)) AS v(g, p, o)
     EXCEPT
     SELECT a.grantee, a.privilege_type, a.is_grantable
       FROM pg_class c
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      WHERE c.oid = 'public.estimate_wizard_snapshots'::regclass
        AND a.grantee <> c.relowner)
  ) diff),
  0::bigint,
  '63: estimate_wizard_snapshots non-owner ACL is exactly service_role SELECT, INSERT (not grantable)'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT a.grantee, a.privilege_type, a.is_grantable
       FROM pg_class c
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      WHERE c.oid = 'public.estimate_revisions'::regclass
        AND a.grantee <> c.relowner
     EXCEPT
     SELECT v.* FROM (VALUES
       ('service_role'::regrole::oid, 'SELECT'::text, false),
       ('service_role'::regrole::oid, 'INSERT'::text, false)) AS v(g, p, o))
    UNION ALL
    (SELECT v.* FROM (VALUES
       ('service_role'::regrole::oid, 'SELECT'::text, false),
       ('service_role'::regrole::oid, 'INSERT'::text, false)) AS v(g, p, o)
     EXCEPT
     SELECT a.grantee, a.privilege_type, a.is_grantable
       FROM pg_class c
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      WHERE c.oid = 'public.estimate_revisions'::regclass
        AND a.grantee <> c.relowner)
  ) diff),
  0::bigint,
  '64: estimate_revisions non-owner ACL is exactly service_role SELECT, INSERT (not grantable)'
);
SELECT is(
  (SELECT count(*)
     FROM pg_attribute att
     CROSS JOIN LATERAL aclexplode(att.attacl) a
    WHERE att.attrelid IN ('public.estimate_wizard_snapshots'::regclass,
                           'public.estimate_revisions'::regclass)
      AND att.attnum > 0 AND NOT att.attisdropped
      AND att.attacl IS NOT NULL AND cardinality(att.attacl) > 0),
  0::bigint,
  '65: no column-level ACL entry exists on either revision table'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT p.oid::oid AS fnoid, a.grantee, a.privilege_type, a.is_grantable
       FROM pg_proc p
       CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid IN (
              'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure,
              'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
              'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure,
              'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure)
        AND a.grantee <> p.proowner
     EXCEPT
     SELECT v.fn::regprocedure::oid, 'service_role'::regrole::oid, 'EXECUTE'::text, false
       FROM (VALUES
         ('public.save_estimate_from_wizard(uuid,uuid,jsonb)'),
         ('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'),
         ('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'),
         ('public.assert_estimate_wizard_snapshot_v22(jsonb)')) AS v(fn))
    UNION ALL
    (SELECT v.fn::regprocedure::oid, 'service_role'::regrole::oid, 'EXECUTE'::text, false
       FROM (VALUES
         ('public.save_estimate_from_wizard(uuid,uuid,jsonb)'),
         ('public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'),
         ('public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'),
         ('public.assert_estimate_wizard_snapshot_v22(jsonb)')) AS v(fn)
     EXCEPT
     SELECT p.oid::oid, a.grantee, a.privilege_type, a.is_grantable
       FROM pg_proc p
       CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid IN (
              'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure,
              'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
              'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure,
              'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure)
        AND a.grantee <> p.proowner)
  ) diff),
  0::bigint,
  '66: entry-point non-owner EXECUTE ACL is exactly service_role on all four functions (not grantable)'
);
SELECT is(
  (SELECT count(*)
     FROM pg_proc p
     CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid IN (
            'public.reject_estimate_revision_history_mutation()'::regprocedure,
            'public.protect_snapshot_backed_estimate_content()'::regprocedure,
            'public.protect_snapshot_backed_estimate_items()'::regprocedure)
      AND a.grantee <> p.proowner),
  0::bigint,
  '67: the three trigger functions hold no non-owner EXECUTE grant at all'
);
SELECT ok(
  (SELECT bool_and(has_table_privilege(c.relowner, c.oid, pr.priv))
     FROM pg_class c
     CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE',
                             'TRUNCATE','REFERENCES','TRIGGER']) AS pr(priv)
    WHERE c.oid IN ('public.estimate_wizard_snapshots'::regclass,
                    'public.estimate_revisions'::regclass))
  AND
  (SELECT bool_and(has_function_privilege(p.proowner, p.oid, 'EXECUTE'))
     FROM pg_proc p
    WHERE p.oid IN (
            'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure,
            'public.save_estimate_from_wizard_v2(uuid,uuid,jsonb,jsonb)'::regprocedure,
            'public.issue_estimate_revision_from_wizard(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure,
            'public.assert_estimate_wizard_snapshot_v22(jsonb)'::regprocedure,
            'public.reject_estimate_revision_history_mutation()'::regprocedure,
            'public.protect_snapshot_backed_estimate_content()'::regprocedure,
            'public.protect_snapshot_backed_estimate_items()'::regprocedure)),
  '68: canonical owner privileges remain semantically intact on tables and functions'
);

-- ============================================================
-- N. Exact trigger/policy surface on the revision tables
-- ============================================================
SELECT ok(
  (SELECT count(*) FROM pg_trigger g
    WHERE NOT g.tgisinternal
      AND g.tgrelid = 'public.estimate_wizard_snapshots'::regclass) = 1
  AND
  (SELECT count(*) FROM pg_trigger g
    WHERE NOT g.tgisinternal
      AND g.tgrelid = 'public.estimate_revisions'::regclass) = 1,
  '69: each revision table carries EXACTLY its one canonical trigger (no extras)'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_policy
               WHERE polrelid IN ('public.estimate_wizard_snapshots'::regclass,
                                  'public.estimate_revisions'::regclass))
  AND
  (SELECT bool_and(NOT c.relforcerowsecurity) FROM pg_class c
    WHERE c.oid IN ('public.estimate_wizard_snapshots'::regclass,
                    'public.estimate_revisions'::regclass)),
  '70: revision tables carry zero RLS policies and no FORCE ROW LEVEL SECURITY (canonical)'
);

-- ============================================================
-- O. Hostile negative controls: the detectors must actually detect.
--    A drift replica seeded with a weakened CHECK, a dropped DEFAULT, an
--    extra column, and a de-DESCed index — plus a scratch function holding a
--    hostile EXECUTE grant — must be flagged by the very same comparison
--    queries. All scratch objects roll back with this transaction.
-- ============================================================
CREATE TABLE estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift (
  estimate_id              uuid PRIMARY KEY REFERENCES public.estimates(id) ON DELETE RESTRICT,
  dealer_id                uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  schema_version           text NOT NULL CHECK (schema_version = '2.2'),
  draft_snapshot           jsonb NOT NULL CHECK (jsonb_typeof(draft_snapshot) = 'object'),
  snapshot_fingerprint     text NOT NULL CHECK (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  configuration_revision   bigint NOT NULL CHECK (configuration_revision >= -1),
  created_at               timestamptz NOT NULL,
  extra_probe              integer,
  UNIQUE (dealer_id, estimate_id)
);
CREATE INDEX estimate_wizard_snapshots_drift_dealer_created_idx
  ON estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift (dealer_id, created_at);

CREATE FUNCTION estimate_runtime_repair_shadow_pgtap.acl_probe() RETURNS void
LANGUAGE sql AS 'SELECT';
REVOKE ALL ON FUNCTION estimate_runtime_repair_shadow_pgtap.acl_probe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION estimate_runtime_repair_shadow_pgtap.acl_probe() TO anon;

SELECT is(
  (SELECT count(*) FROM (
    (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
     EXCEPT
     SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
    UNION ALL
    (SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
     EXCEPT
     SELECT a.attname::text, format_type(a.atttypid, a.atttypmod),
            a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '')
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped)
  ) diff),
  3::bigint,
  '71: column detector flags the extra column and dropped DEFAULT (exactly 3 differences)'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift'::regclass
        AND k.contype = 'c'
     EXCEPT
     SELECT pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
        AND k.contype = 'c')
    UNION ALL
    (SELECT pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
        AND k.contype = 'c'
     EXCEPT
     SELECT pg_get_constraintdef(k.oid)
       FROM pg_constraint k
      WHERE k.conrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift'::regclass
        AND k.contype = 'c')
  ) diff),
  2::bigint,
  '72: CHECK-expression detector flags the weakened configuration_revision bound (exactly 2 differences)'
);
SELECT is(
  (SELECT count(*) FROM (
    (SELECT substring(pg_get_indexdef(i.indexrelid) FROM ' USING .*$')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift'::regclass
     EXCEPT
     SELECT substring(pg_get_indexdef(i.indexrelid) FROM ' USING .*$')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass)
    UNION ALL
    (SELECT substring(pg_get_indexdef(i.indexrelid) FROM ' USING .*$')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots'::regclass
     EXCEPT
     SELECT substring(pg_get_indexdef(i.indexrelid) FROM ' USING .*$')
       FROM pg_index i
      WHERE i.indrelid = 'estimate_runtime_repair_shadow_pgtap.estimate_wizard_snapshots_drift'::regclass)
  ) diff),
  2::bigint,
  '73: index detector flags the de-DESCed index definition (exactly 2 differences)'
);
SELECT ok(
  (SELECT count(*)
     FROM pg_proc p
     CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'estimate_runtime_repair_shadow_pgtap.acl_probe()'::regprocedure
      AND a.grantee <> p.proowner) = 1
  AND EXISTS (
    SELECT 1
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     WHERE p.oid = 'estimate_runtime_repair_shadow_pgtap.acl_probe()'::regprocedure
       AND a.grantee = 'anon'::regrole
       AND a.privilege_type = 'EXECUTE'),
  '74: ACL detector surfaces a hostile non-owner EXECUTE grant (anon on the probe function)'
);

SELECT * FROM finish();

ROLLBACK;
