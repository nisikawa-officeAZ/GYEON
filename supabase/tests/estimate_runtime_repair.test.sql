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
--     behavior): on a freshly replayed database the estimate family is empty.
--
-- Standalone pgTAP candidate for a disposable local database that has replayed
-- every committed migration. No fixture rows are inserted; every assertion
-- reads catalogs or counts empty tables, so the file is deterministic and
-- side-effect free (the transaction ends in ROLLBACK regardless).

BEGIN;

SELECT plan(52);

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

SELECT * FROM finish();

ROLLBACK;
