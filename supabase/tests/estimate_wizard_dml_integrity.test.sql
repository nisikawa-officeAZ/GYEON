-- ============================================================================
-- pgTAP: direct-DML integrity for wizard-origin rows.
--
-- **NOT EXECUTED IN R56B.** Runs in R56C against a DISPOSABLE LOCAL stack only.
-- Never against the linked, staging or production project.
--
-- ROLE DISCIPLINE
--   * Every acceptance assertion runs as role `authenticated` with a real
--     request.jwt.claim.sub, so auth.uid() and RLS behave as in production.
--   * service_role is used ONLY for privileged fixture setup and post-hoc
--     verification. It is never the SUBJECT of an RLS acceptance assertion.
--
-- DENIAL SHAPES — these differ by operation and the difference is load-bearing.
-- Asserting the wrong shape would fail against a correctly configured system:
--
--   INSERT : BEFORE trigger fires, THEN RLS WITH CHECK. A blocked insert RAISES
--            (throws_matching).
--   UPDATE : RLS USING filters candidates first. A filtered row is a silent
--            zero-row no-op. A candidate row that reaches the trigger raises.
--   DELETE : RLS USING filters candidates. A filtered row is a SILENT ZERO-ROW
--            NO-OP -- no trigger, NO exception. Assert row counts, not throws.
--
-- DEFENCE LAYERS — restrictive policies independently cover active membership,
-- parent visibility, parent/dealer coherence and non-wizard parent status.
-- Item MARKER and SNAPSHOT protection lives ONLY in the trigger; the policies
-- do not duplicate it.
-- ============================================================================

BEGIN;

CREATE SCHEMA r56c_pgtap;
CREATE EXTENSION pgtap WITH SCHEMA r56c_pgtap;
GRANT USAGE ON SCHEMA r56c_pgtap TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA r56c_pgtap TO authenticated, service_role;
SET LOCAL search_path = r56c_pgtap, pg_temp, public, auth, extensions;

SELECT plan(50);

-- ─── Fixtures (privileged; runs as the session superuser role) ──────────────
CREATE TEMP TABLE t (k text PRIMARY KEY, v uuid);
INSERT INTO t (k, v) VALUES
  ('dealer_a',  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('dealer_b',  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('owner_a',   'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('owner_b',   'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('dual_ab',   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  ('invited_a', 'ffffffff-ffff-4fff-8fff-ffffffffffff');

CREATE OR REPLACE FUNCTION pg_temp.id(text) RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT v FROM t WHERE k = $1 $$;

INSERT INTO auth.users (id, email)
SELECT v, k || '@example.test' FROM t WHERE k NOT LIKE 'dealer\_%';

INSERT INTO public.dealers (id, name) VALUES
  (pg_temp.id('dealer_a'), 'Dealer A'), (pg_temp.id('dealer_b'), 'Dealer B');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status) VALUES
  (pg_temp.id('dealer_a'), pg_temp.id('owner_a'),   'owner', 'active'),
  (pg_temp.id('dealer_b'), pg_temp.id('owner_b'),   'owner', 'active'),
  (pg_temp.id('dealer_a'), pg_temp.id('dual_ab'),   'owner', 'active'),
  (pg_temp.id('dealer_b'), pg_temp.id('dual_ab'),   'owner', 'active'),
  (pg_temp.id('dealer_a'), pg_temp.id('invited_a'), 'owner', 'invited');

-- Customers / vehicles for both dealers.
CREATE TEMP TABLE r (k text PRIMARY KEY, v uuid);
CREATE OR REPLACE FUNCTION pg_temp.r(text) RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT v FROM r WHERE k = $1 $$;

WITH ca AS (INSERT INTO public.customers (dealer_id, name)
            VALUES (pg_temp.id('dealer_a'), 'CA') RETURNING id),
     cb AS (INSERT INTO public.customers (dealer_id, name)
            VALUES (pg_temp.id('dealer_b'), 'CB') RETURNING id)
INSERT INTO r SELECT 'cust_a', id FROM ca UNION ALL SELECT 'cust_b', id FROM cb;

WITH va AS (INSERT INTO public.vehicles (dealer_id, customer_id, maker)
            VALUES (pg_temp.id('dealer_a'), pg_temp.r('cust_a'), 'T') RETURNING id),
     vb AS (INSERT INTO public.vehicles (dealer_id, customer_id, maker)
            VALUES (pg_temp.id('dealer_b'), pg_temp.r('cust_b'), 'T') RETURNING id)
INSERT INTO r SELECT 'veh_a', id FROM va UNION ALL SELECT 'veh_b', id FROM vb;

-- wiz_a: wizard-origin (all three markers). ord_a / ord_b: ordinary.
WITH w AS (
  INSERT INTO public.estimates (dealer_id, customer_id, vehicle_id, estimate_no, status,
                                source, idempotency_key, wizard_schema_version)
  VALUES (pg_temp.id('dealer_a'), pg_temp.r('cust_a'), pg_temp.r('veh_a'), 'W-1', 'draft',
          'estimate-wizard-v2.2', 'wizardkey0000001', '2.2') RETURNING id),
     oa AS (
  INSERT INTO public.estimates (dealer_id, customer_id, vehicle_id, estimate_no, status)
  VALUES (pg_temp.id('dealer_a'), pg_temp.r('cust_a'), pg_temp.r('veh_a'), 'O-A', 'draft') RETURNING id),
     ob AS (
  INSERT INTO public.estimates (dealer_id, customer_id, vehicle_id, estimate_no, status)
  VALUES (pg_temp.id('dealer_b'), pg_temp.r('cust_b'), pg_temp.r('veh_b'), 'O-B', 'draft') RETURNING id)
INSERT INTO r SELECT 'wiz_a', id FROM w UNION ALL SELECT 'ord_a', id FROM oa
UNION ALL SELECT 'ord_b', id FROM ob;

-- TEST-LOCAL privileges for the fixture TEMP tables. The production trigger and
-- the RLS policies are never weakened; only these test-local objects are shared.
GRANT SELECT ON t TO service_role, authenticated;
GRANT SELECT ON r TO service_role, authenticated;
-- The item fixtures below MUST be built under SET LOCAL ROLE service_role (the
-- item trigger exempts only that role), and that block WRITES its returned ids
-- back into `r`. SELECT alone is therefore insufficient. INSERT is granted on
-- the TEMP fixture table only -- never to `authenticated`, never on a production
-- table -- and it dies with the enclosing ROLLBACK.
GRANT INSERT ON r TO service_role;

-- item_wiz_a: wizard item. item_ord_a: ordinary item.
-- mismatch_a: FK-VALID CROSS-TENANT MISMATCH (dealer A item -> dealer B estimate).
--
-- These MUST be created under SET LOCAL ROLE service_role. The production item
-- trigger exempts ONLY current_user = 'service_role'; the session/superuser role
-- does NOT bypass row triggers, so building these as postgres would be rejected
-- by the very guard under test. The foreign key is never dropped, disabled or
-- deferred, and the trigger is never modified.
SET LOCAL ROLE service_role;
WITH iw AS (
  INSERT INTO public.estimate_items (estimate_id, dealer_id, category, item_name, wizard_line_id,
                                     pricing_source, manual_pricing_identity)
  VALUES (pg_temp.r('wiz_a'), pg_temp.id('dealer_a'), 'maintenance', 'W item',
          'manual:maintenance:a', 'manual', 'maintenance:a') RETURNING id),
     io AS (
  INSERT INTO public.estimate_items (estimate_id, dealer_id, category, item_name)
  VALUES (pg_temp.r('ord_a'), pg_temp.id('dealer_a'), 'other', 'O item') RETURNING id),
     im AS (
  INSERT INTO public.estimate_items (estimate_id, dealer_id, category, item_name)
  VALUES (pg_temp.r('ord_b'), pg_temp.id('dealer_a'), 'other', 'Mismatch') RETURNING id)
INSERT INTO r SELECT 'item_wiz_a', id FROM iw UNION ALL SELECT 'item_ord_a', id FROM io
UNION ALL SELECT 'mismatch_a', id FROM im;
RESET ROLE;

-- Acting helper: become `authenticated` with a real JWT sub claim.
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user::text)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE OR REPLACE FUNCTION pg_temp.act_privileged() RETURNS void
LANGUAGE plpgsql AS $$ BEGIN EXECUTE 'RESET ROLE'; END $$;

-- ═══ 1. Grant surface ══════════════════════════════════════════════════════
SELECT ok(has_function_privilege('authenticated',
  'public.wiz_is_wizard_estimate(text,text,text)', 'EXECUTE'),
  'authenticated holds EXECUTE on the pure predicate (RLS policies need it)');
SELECT ok(NOT has_function_privilege('anon',
  'public.wiz_is_wizard_estimate(text,text,text)', 'EXECUTE'),
  'anon holds no EXECUTE on the predicate');
SELECT ok(NOT has_function_privilege('service_role',
  'public.wiz_is_wizard_estimate(text,text,text)', 'EXECUTE'),
  'service_role holds no EXECUTE on the predicate');
-- PUBLIC is an ACL grantee (oid 0), not a login role: inspect the ACL directly.
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid = 'public.wiz_is_wizard_estimate(text,text,text)'::regprocedure
     AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
  'PUBLIC holds no EXECUTE on the predicate');
-- The function OWNER always retains EXECUTE in the ACL after a REVOKE, so
-- asserting "no grantee at all" would be false. Name the four roles that matter.
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid IN ('public.wiz_guard_estimate_update()'::regprocedure,
                   'public.wiz_guard_estimate_item_dml()'::regprocedure)
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0
          OR a.grantee IN (SELECT oid FROM pg_roles
                            WHERE rolname IN ('anon','authenticated','service_role')))),
  'PUBLIC, anon, authenticated and service_role hold no EXECUTE on either trigger function');

-- ═══ 2. Wizard-origin INSERT block (any marker, fail closed) ═══════════════
SELECT pg_temp.act_as(pg_temp.id('owner_a'));

SELECT throws_ok($$ INSERT INTO public.estimates
  (dealer_id, customer_id, vehicle_id, estimate_no, status, source)
  VALUES ((SELECT v FROM t WHERE k='dealer_a'), (SELECT v FROM r WHERE k='cust_a'),
          (SELECT v FROM r WHERE k='veh_a'), 'X1', 'draft', 'estimate-wizard-v2.2') $$,
  NULL, 'source marker alone -> authenticated INSERT denied');
SELECT throws_ok($$ INSERT INTO public.estimates
  (dealer_id, customer_id, vehicle_id, estimate_no, status, idempotency_key)
  VALUES ((SELECT v FROM t WHERE k='dealer_a'), (SELECT v FROM r WHERE k='cust_a'),
          (SELECT v FROM r WHERE k='veh_a'), 'X2', 'draft', 'forgedkey0000001') $$,
  NULL, 'idempotency_key marker alone -> denied');
SELECT throws_ok($$ INSERT INTO public.estimates
  (dealer_id, customer_id, vehicle_id, estimate_no, status, wizard_schema_version)
  VALUES ((SELECT v FROM t WHERE k='dealer_a'), (SELECT v FROM r WHERE k='cust_a'),
          (SELECT v FROM r WHERE k='veh_a'), 'X3', 'draft', '2.2') $$,
  NULL, 'wizard_schema_version marker alone -> denied');
SELECT lives_ok($$ INSERT INTO public.estimates
  (dealer_id, customer_id, vehicle_id, estimate_no, status)
  VALUES ((SELECT v FROM t WHERE k='dealer_a'), (SELECT v FROM r WHERE k='cust_a'),
          (SELECT v FROM r WHERE k='veh_a'), 'X4', 'draft') $$,
  'ordinary estimate INSERT still allowed (createEstimate preserved)');

-- ═══ 3. Wizard estimate UPDATE immutability ════════════════════════════════
SELECT throws_matching($$ UPDATE public.estimates SET total = 99999
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'WIZARD_ESTIMATE_IMMUTABLE', 'financial UPDATE of a wizard estimate is denied');
SELECT throws_matching($$ UPDATE public.estimates SET notes = 'x'
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'WIZARD_ESTIMATE_IMMUTABLE', 'notes UPDATE of a wizard estimate is denied');
SELECT throws_matching($$ UPDATE public.estimates SET customer_id = (SELECT v FROM r WHERE k='cust_a'),
  vehicle_id = (SELECT v FROM r WHERE k='veh_a'), total = 1
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'WIZARD_ESTIMATE_IMMUTABLE', 'updateEstimate-shaped UPDATE of a wizard estimate is denied');
SELECT throws_matching($$ UPDATE public.estimates SET idempotency_key = 'other00000000001'
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'WIZARD_ESTIMATE_IMMUTABLE', 'changing the idempotency key is denied');
-- lives_ok alone would pass vacuously on UPDATE 0, so each is paired with a
-- privileged post-verification that the value actually changed.
SELECT lives_ok($$ UPDATE public.estimates SET status = 'sent', updated_at = now()
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'status + updated_at only IS allowed (updateEstimateStatus preserved)');
SELECT pg_temp.act_privileged();
SELECT is((SELECT status FROM public.estimates WHERE id = (SELECT v FROM r WHERE k='wiz_a')),
  'sent', 'PRIVILEGED verification: the status change really landed (not UPDATE 0)');
SELECT pg_temp.act_as(pg_temp.id('owner_a'));
SELECT lives_ok($$ UPDATE public.estimates SET status = 'approved'
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'status alone is allowed');
SELECT pg_temp.act_privileged();
SELECT is((SELECT status FROM public.estimates WHERE id = (SELECT v FROM r WHERE k='wiz_a')),
  'approved', 'PRIVILEGED verification: the second status change landed');
SELECT pg_temp.act_as(pg_temp.id('owner_a'));

-- ordinary -> wizard promotion, each marker separately
SELECT throws_matching($$ UPDATE public.estimates SET source = 'estimate-wizard-v2.2'
  WHERE id = (SELECT v FROM r WHERE k='ord_a') $$,
  'WIZARD_ORIGIN_FORBIDDEN', 'promotion via source is denied');
SELECT throws_matching($$ UPDATE public.estimates SET idempotency_key = 'promote000000001'
  WHERE id = (SELECT v FROM r WHERE k='ord_a') $$,
  'WIZARD_ORIGIN_FORBIDDEN', 'promotion via idempotency_key is denied');
SELECT throws_matching($$ UPDATE public.estimates SET wizard_schema_version = '2.2'
  WHERE id = (SELECT v FROM r WHERE k='ord_a') $$,
  'WIZARD_ORIGIN_FORBIDDEN', 'promotion via wizard_schema_version is denied');
SELECT lives_ok($$ UPDATE public.estimates SET total = 123, notes = 'legacy edit'
  WHERE id = (SELECT v FROM r WHERE k='ord_a') $$,
  'ordinary estimate UPDATE still allowed (updateEstimate preserved)');
SELECT pg_temp.act_privileged();
SELECT is((SELECT total FROM public.estimates WHERE id = (SELECT v FROM r WHERE k='ord_a')),
  123::numeric, 'PRIVILEGED verification: the ordinary edit really landed');
SELECT pg_temp.act_as(pg_temp.id('owner_a'));

-- ═══ 4. Item DML: parent lookup fails closed ═══════════════════════════════
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name)
  VALUES ('00000000-0000-4000-8000-000000000000',
          (SELECT v FROM t WHERE k='dealer_a'), 'other', 'orphan') $$,
  'WIZARD_ITEM_PARENT_UNRESOLVED',
  'non-existent parent -> WIZARD_ITEM_PARENT_UNRESOLVED (the BEFORE trigger fires before the FK check)');

SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name)
  VALUES ((SELECT v FROM r WHERE k='ord_b'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'cross') $$,
  'WIZARD_ITEM_PARENT_UNRESOLVED',
  'owner_A: dealer-B parent is RLS-INVISIBLE -> WIZARD_ITEM_PARENT_UNRESOLVED');

SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name)
  VALUES ((SELECT v FROM r WHERE k='wiz_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'unmarked into wizard parent') $$,
  'WIZARD_ITEM_IMMUTABLE',
  'UNMARKED item into a wizard parent is denied (parent-based protection)');

SELECT lives_ok($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'ordinary item') $$,
  'ordinary unmarked item into an ordinary parent is allowed');

-- dual_ab CAN see dealer B's estimate, so the parent is visible and only the
-- dealer-equality check can stop the attachment.
SELECT pg_temp.act_as(pg_temp.id('dual_ab'));
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name)
  VALUES ((SELECT v FROM r WHERE k='ord_b'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'dual cross') $$,
  'WIZARD_ITEM_DEALER_MISMATCH',
  'dual-member cross-tenant attachment -> DEALER_MISMATCH (visibility is not the check)');
SELECT pg_temp.act_as(pg_temp.id('owner_a'));

-- ═══ 5. Item marker / snapshot boundary (trigger-only authority) ═══════════
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, wizard_line_id)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'forged:line') $$,
  'wizard_line_id', 'forging wizard_line_id is denied and NAMES the column');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, pricing_source)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'catalog') $$,
  'pricing_source', 'forging pricing_source is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, pricing_reference_id)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'ref-1') $$,
  'pricing_reference_id', 'forging pricing_reference_id is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, manual_pricing_identity)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'man-1') $$,
  'manual_pricing_identity', 'forging manual_pricing_identity is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, pricing_policy)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'manual_only') $$,
  'pricing_policy', 'forging pricing_policy is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, manual_price_policy)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'required') $$,
  'manual_price_policy', 'forging manual_price_policy is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, wizard_category)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', 'maintenance') $$,
  'wizard_category', 'forging wizard_category is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, selected_option_reference_ids)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', '["x"]'::jsonb) $$,
  'snapshot', 'forging selected_option_reference_ids is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, pricing_metadata)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', '{"x":1}'::jsonb) $$,
  'snapshot', 'forging pricing_metadata is denied');
SELECT throws_matching($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, operational_metadata)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'm', '{"x":1}'::jsonb) $$,
  'snapshot', 'forging operational_metadata is denied');

-- ═══ 6. DELETE denial is a SILENT ZERO-ROW NO-OP ═══════════════════════════
-- RLS USING filters the row out of the candidate set, so the row trigger never
-- fires and NO exception is raised. The SELECT policy still SHOWS the row, so
-- asserting "the authenticated SELECT count became 0" would be false. Count the
-- AFFECTED rows via DELETE ... RETURNING inside a CTE instead.
--
-- The CTE must attach to the TOP-LEVEL statement: PostgreSQL rejects a
-- data-modifying WITH clause nested inside a scalar subquery with
-- "WITH clause containing a data-modifying statement must be at the top level".
-- The DELETE predicate, the expected count and the message are unchanged; only
-- the statement shape moves the CTE out to the top level.
SELECT pg_temp.act_as(pg_temp.id('owner_a'));

WITH d AS (
  DELETE FROM public.estimate_items
   WHERE id = (SELECT v FROM r WHERE k='item_wiz_a')
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM d),
  0::bigint, 'DELETE of a wizard item affects ZERO rows (silent policy filter, no exception)');

WITH d AS (
  DELETE FROM public.estimate_items
   WHERE id = (SELECT v FROM r WHERE k='mismatch_a')
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM d),
  0::bigint, 'DELETE of the cross-tenant mismatch row affects ZERO rows');

SELECT pg_temp.act_privileged();
SELECT is((SELECT count(*) FROM public.estimate_items WHERE id = (SELECT v FROM r WHERE k='item_wiz_a')),
  1::bigint, 'PRIVILEGED verification: the wizard item still EXISTS');
SELECT is((SELECT count(*) FROM public.estimate_items WHERE id = (SELECT v FROM r WHERE k='mismatch_a')),
  1::bigint, 'PRIVILEGED verification: the cross-tenant mismatch row still EXISTS');

-- Ordinary item DELETE must still work (updateEstimate deletes and recreates).
SELECT pg_temp.act_as(pg_temp.id('owner_a'));
WITH d AS (
  DELETE FROM public.estimate_items
   WHERE id = (SELECT v FROM r WHERE k='item_ord_a')
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM d),
  1::bigint, 'ordinary item DELETE affects exactly ONE row (updateEstimate preserved)');
SELECT pg_temp.act_privileged();
SELECT is((SELECT count(*) FROM public.estimate_items WHERE id = (SELECT v FROM r WHERE k='item_ord_a')),
  0::bigint, 'PRIVILEGED verification: the ordinary item is genuinely gone');

-- ═══ 7. Active-membership restrictive policy (closes the 037 gap) ══════════
SELECT pg_temp.act_as(pg_temp.id('invited_a'));
SELECT throws_ok($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name)
  VALUES ((SELECT v FROM r WHERE k='ord_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'invited') $$,
  NULL, 'an INVITED member cannot insert items (037 omitted status = active)');

-- ═══ 8. service_role remains exempt ════════════════════════════════════════
SELECT pg_temp.act_privileged();
SET LOCAL ROLE service_role;
SELECT lives_ok($$ UPDATE public.estimates SET total = 4242
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'service_role may still update a wizard estimate (sole trigger exemption)');
SELECT is((SELECT total FROM public.estimates WHERE id = (SELECT v FROM r WHERE k='wiz_a')),
  4242::numeric, 'PRIVILEGED verification: the service_role write really landed');
SELECT lives_ok($$ INSERT INTO public.estimate_items
  (estimate_id, dealer_id, category, item_name, wizard_line_id, pricing_source, manual_pricing_identity)
  VALUES ((SELECT v FROM r WHERE k='wiz_a'), (SELECT v FROM t WHERE k='dealer_a'),
          'other', 'server item', 'manual:other:z', 'manual', 'other:z') $$,
  'service_role may still write wizard items (the atomic RPC path)');
RESET ROLE;

-- ═══ 9. Future-column regression: the whole-row diff protects new columns ══
ALTER TABLE public.estimates ADD COLUMN r56c_probe text;
SELECT pg_temp.act_as(pg_temp.id('owner_a'));
SELECT throws_matching($$ UPDATE public.estimates SET r56c_probe = 'x'
  WHERE id = (SELECT v FROM r WHERE k='wiz_a') $$,
  'WIZARD_ESTIMATE_IMMUTABLE',
  'a column added AFTER the migration is protected automatically by the to_jsonb diff');
SELECT pg_temp.act_privileged();
ALTER TABLE public.estimates DROP COLUMN r56c_probe;

-- ═══ 10. Trigger-isolation DELETE (rollback-only) ══════════════════════════
-- Drops ONLY the restrictive DELETE policy so the mismatch row becomes a real
-- DELETE candidate and the trigger can be observed. RLS, the active-membership
-- policy, the FK and the trigger all remain enabled. The enclosing ROLLBACK
-- restores the policy and every fixture.
SAVEPOINT trigger_isolation;
DROP POLICY estimate_items_wizard_delete_block ON public.estimate_items;
SELECT pg_temp.act_as(pg_temp.id('dual_ab'));   -- dealer-B parent is visible
SELECT throws_matching($$ DELETE FROM public.estimate_items
  WHERE id = (SELECT v FROM r WHERE k='mismatch_a') $$,
  'WIZARD_ITEM_DEALER_MISMATCH',
  'with the DELETE policy removed, the TRIGGER raises on the cross-tenant row');
SELECT pg_temp.act_privileged();
ROLLBACK TO SAVEPOINT trigger_isolation;

SELECT ok(EXISTS (SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='estimate_items'
     AND policyname='estimate_items_wizard_delete_block'),
  'the DELETE policy is restored by the savepoint rollback');

SELECT * FROM finish();
ROLLBACK;

-- ============================================================================
-- NOTE ON DENIAL SHAPES
--   throws_ok(..., NULL, ...) is used where the denial is an RLS WITH CHECK
--   violation (an error whose exact text is a PostgreSQL message, not one of our
--   stable codes). throws_matching is used wherever OUR trigger raises, so the
--   stable code is asserted explicitly.
-- ============================================================================
