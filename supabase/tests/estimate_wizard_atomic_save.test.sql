-- ============================================================================
-- pgTAP: hardened save_estimate_from_wizard.
--
-- **NOT EXECUTED IN R56B.** Runs in R56C against a DISPOSABLE LOCAL stack only,
-- after applying 000 -> 109 -> the hardening migration in order. Never against
-- the linked, staging or production project.
--
-- ROLE DISCIPLINE
--   * The RPC is service-role-only, so RPC assertions run under
--     SET LOCAL ROLE service_role.
--   * service_role is NEVER the subject of an RLS acceptance assertion; those
--     live in estimate_wizard_dml_integrity.test.sql under role authenticated.
--
-- Fixture creation runs as the session (superuser/postgres) role before any
-- SET LOCAL ROLE, because auth.users and dealers are not writable by the
-- application roles.
-- ============================================================================

BEGIN;

CREATE SCHEMA r56c_pgtap;
CREATE EXTENSION pgtap WITH SCHEMA r56c_pgtap;
GRANT USAGE ON SCHEMA r56c_pgtap TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA r56c_pgtap TO authenticated, service_role;
SET LOCAL search_path = r56c_pgtap, pg_temp, public, auth, extensions;

SELECT plan(165);

-- ─── Fixtures ───────────────────────────────────────────────────────────────
CREATE TEMP TABLE t_ids (k text PRIMARY KEY, v uuid);
INSERT INTO t_ids (k, v) VALUES
  ('dealer_a',    '11111111-1111-4111-8111-111111111111'),
  ('dealer_b',    '22222222-2222-4222-8222-222222222222'),
  ('u_owner_a',   '33333333-3333-4333-8333-333333333333'),
  ('u_readonly_a','44444444-4444-4444-8444-444444444444'),
  ('u_multi_ab',  '55555555-5555-4555-8555-555555555555'),
  ('u_none',      '66666666-6666-4666-8666-666666666666'),
  ('u_promoted',  '77777777-7777-4777-8777-777777777777'),
  ('u_demoted',   '88888888-8888-4888-8888-888888888888'),
  ('u_invited_a', '99999999-9999-4999-8999-999999999999'),
  ('dealer_c',    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('u_owner_c',   'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('dealer_d',    '1d1d1d1d-1d1d-4d1d-8d1d-1d1d1d1d1d1d'),
  ('u_owner_d',   '2d2d2d2d-2d2d-4d2d-8d2d-2d2d2d2d2d2d'),
  ('dealer_e',    '1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e'),
  ('u_owner_e',   '2e2e2e2e-2e2e-4e2e-8e2e-2e2e2e2e2e2e');

CREATE OR REPLACE FUNCTION pg_temp.uid(text) RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT v FROM t_ids WHERE k = $1 $$;

INSERT INTO auth.users (id, email)
SELECT v, k || '@example.test' FROM t_ids WHERE k LIKE 'u\_%';

INSERT INTO public.dealers (id, name) VALUES
  (pg_temp.uid('dealer_a'), 'Dealer A'),
  (pg_temp.uid('dealer_b'), 'Dealer B'),
  (pg_temp.uid('dealer_c'), 'Dealer C'),
  (pg_temp.uid('dealer_d'), 'Dealer D'),
  (pg_temp.uid('dealer_e'), 'Dealer E');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status) VALUES
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'),    'owner',    'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_readonly_a'), 'readonly', 'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_invited_a'),  'owner',    'invited'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_multi_ab'),   'owner',    'active'),
  (pg_temp.uid('dealer_b'), pg_temp.uid('u_multi_ab'),   'owner',    'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_promoted'),   'readonly', 'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_demoted'),    'owner',    'active'),
  (pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),    'owner',    'active'),
  (pg_temp.uid('dealer_d'), pg_temp.uid('u_owner_d'),    'owner',    'active'),
  (pg_temp.uid('dealer_e'), pg_temp.uid('u_owner_e'),    'owner',    'active');

INSERT INTO public.dealer_staff (dealer_id, user_id, role, status) VALUES
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_promoted'), 'owner',    'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_demoted'),  'readonly', 'active');

-- ─── R64A-F1 sequence-selection fixtures (session role; RLS is bypassed) ────
-- Dealer D proves the DETERMINISTIC configuration pick. Two estimate rows whose
-- prefix, padding, reset_policy, fiscal_year AND timestamps all differ, so only
-- `ORDER BY updated_at DESC, created_at DESC, fiscal_year DESC, id DESC LIMIT 1`
-- can select the intended one. updated_at is set explicitly here: the table's
-- updated_at trigger is BEFORE UPDATE only, so an INSERT keeps these values.
INSERT INTO public.document_sequences
  (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy,
   current_number, created_at, updated_at)
VALUES
  -- OLDER: every attribute visibly different, and never selected.
  (pg_temp.uid('dealer_d'), 'estimate', 2026, 'OLD', 6, 'yearly', 99,
   '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
  -- NEWEST: the row the resolver must choose.
  (pg_temp.uid('dealer_d'), 'estimate',    0, 'NEW', 3, 'never',   7,
   '2023-01-01 00:00:00+00', '2026-06-01 00:00:00+00');

-- Dealer E proves the TARGET row's stored configuration wins over the SOURCE
-- row's. The source row is selected (latest updated_at) and its 'monthly' policy
-- computes the CURRENT month, so the upsert conflicts with the target row that
-- already exists for that month -- and RETURNING must yield the TARGET row's
-- prefix/padding/fiscal_year, not the source's.
INSERT INTO public.document_sequences
  (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy,
   current_number, created_at, updated_at)
VALUES
  -- TARGET: current month. Never selected as the source (older updated_at).
  (pg_temp.uid('dealer_e'), 'estimate',
   public.wiz_document_fiscal_year('monthly', CURRENT_TIMESTAMP),
   'TARGET', 4, 'monthly', 4,
   '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
  -- SOURCE: a fiscal year that can never be the current month, but the latest
  -- updated_at, so it supplies the policy that resolves to the current month.
  (pg_temp.uid('dealer_e'), 'estimate', 202001, 'SOURCE', 8, 'monthly', 55,
   '2024-01-01 00:00:00+00', '2026-06-01 00:00:00+00');

-- Catalog-only attribute probe. Returns
--   prosecdef|provolatile|proisstrict|<normalised search_path>
-- so the three attribute assertions read as one exact string comparison each.
-- The search_path list is normalised to bare, comma-joined, ORDER-PRESERVING
-- tokens so the assertion pins the schemas and their order without depending on
-- how PostgreSQL happens to space the stored setting.
CREATE OR REPLACE FUNCTION pg_temp.fnattr(p_fn text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT p.prosecdef::text || '|' || p.provolatile::text || '|' || p.proisstrict::text || '|' ||
         coalesce((
           SELECT string_agg(btrim(u.t), ',' ORDER BY u.ord)
             FROM unnest(string_to_array(
                    split_part((SELECT c FROM unnest(p.proconfig) c
                                 WHERE c LIKE 'search_path=%'), '=', 2), ','))
                  WITH ORDINALITY AS u(t, ord)), 'NO-SEARCH-PATH')
    FROM pg_proc p
   WHERE p.oid = p_fn::regprocedure;
$$;

-- An existing customer + vehicle for dealer A, and a second customer to prove
-- the vehicle/customer coherence check.
CREATE TEMP TABLE t_rows (k text PRIMARY KEY, v uuid);
WITH c1 AS (
  INSERT INTO public.customers (dealer_id, name) VALUES (pg_temp.uid('dealer_a'), 'Cust A1') RETURNING id),
     c2 AS (
  INSERT INTO public.customers (dealer_id, name) VALUES (pg_temp.uid('dealer_a'), 'Cust A2') RETURNING id),
     cb AS (
  INSERT INTO public.customers (dealer_id, name) VALUES (pg_temp.uid('dealer_b'), 'Cust B1') RETURNING id)
INSERT INTO t_rows (k, v)
SELECT 'cust_a1', id FROM c1 UNION ALL SELECT 'cust_a2', id FROM c2 UNION ALL SELECT 'cust_b1', id FROM cb;

CREATE OR REPLACE FUNCTION pg_temp.rid(text) RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT v FROM t_rows WHERE k = $1 $$;

WITH v1 AS (
  INSERT INTO public.vehicles (dealer_id, customer_id, maker)
  VALUES (pg_temp.uid('dealer_a'), pg_temp.rid('cust_a1'), 'TOYOTA') RETURNING id),
     v2 AS (
  INSERT INTO public.vehicles (dealer_id, customer_id, maker)
  VALUES (pg_temp.uid('dealer_a'), pg_temp.rid('cust_a2'), 'NISSAN') RETURNING id)
INSERT INTO t_rows (k, v)
SELECT 'veh_a1', id FROM v1 UNION ALL SELECT 'veh_a2_other_cust', id FROM v2;

-- ─── Payload builder ────────────────────────────────────────────────────────
-- One canonical VALID payload; each case overrides exactly one path via
-- jsonb_set / #- so a failure is attributable to that single change.
CREATE OR REPLACE FUNCTION pg_temp.payload(p_key text DEFAULT 'abcdefghijklmnop')
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'idempotencyKey', p_key,
    'customer', jsonb_build_object(
      'mode','new','name','山田太郎','phone','090-0000-0000','email','a@example.test',
      'postalCode','1000001','address','東京都','lineId','',
      'isBusiness', false, 'tradeRatePercent', null,
      'accountsReceivableAllowed', false, 'closingDay', null, 'paymentDay', null),
    'vehicle', jsonb_build_object(
      'mode','new','maker','TOYOTA','model','CROWN','grade','','vehicleCode','','vin','',
      'firstRegistration','','registrationDate','','inspectionExpiry','',
      'displacement','','color','','plateNumber','','bodySizeKey','M'),
    'services', jsonb_build_array(jsonb_build_object(
      'lineId','manual:maintenance:maint-a','category','maintenance',
      'wizardCategory','maintenance','pricingSource','manual',
      'pricingReferenceId', null,'manualPricingIdentity','maintenance:maint-a',
      'pricingPolicy','manual_only','manualPricePolicy','required',
      'label','メンテA','description', null,
      'quantity', 1,'unitPrice', 5000,'lineTotal', 5000,
      'optionReferenceIds', '[]'::jsonb,'lineMetadata', '{}'::jsonb)),
    'nonPriceableSelections', '[]'::jsonb,
    'discountIntent', jsonb_build_object('mode','none','fixedAmount',null,'percentage',null,'percentageSupported',false),
    'discountAppliedAmount', null,
    'couponIntent', jsonb_build_object('selectedCouponIds','[]'::jsonb,'status','none'),
    'couponAppliedAmount', null,
    'pricingSnapshot', jsonb_build_object(
      'currency','JPY','completeness','complete',
      'subtotal',5000,'discountTotal',0,'couponTotal',0,'taxableSubtotal',5000,
      'taxRatePercent',10,'taxTotal',500,'grandTotal',5500,
      'warnings','[]'::jsonb,'errors','[]'::jsonb),
    'notes', jsonb_build_object('customerNotes','','internalMemo',''),
    'metadata', jsonb_build_object(
      'source','estimate-wizard-v2.2','schemaVersion','2.2','createdFromWizard',true,
      'draftLastUpdatedAt','2026-01-01T00:00:00.000Z','previewConfirmed',true));
$$;

-- B7-0A: THREE arguments. The estimate number is no longer a parameter -- the RPC
-- allocates it internally, after replay/conflict resolution, so no caller can choose
-- (or pre-burn) one.
CREATE OR REPLACE FUNCTION pg_temp.call(p_dealer uuid, p_actor uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.save_estimate_from_wizard(p_dealer, p_actor, p_payload);
$$;

-- Current sequence counter for a dealer's estimate sequence, 0 when no row exists.
-- Every B7-0A delta assertion is expressed as seq(after) - seq(before).
CREATE OR REPLACE FUNCTION pg_temp.seq(p_dealer uuid, p_fy integer DEFAULT 0)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT s.current_number FROM public.document_sequences s
                    WHERE s.dealer_id = p_dealer
                      AND s.sequence_type = 'estimate'
                      AND s.fiscal_year = p_fy), 0)::bigint;
$$;

-- TEST-LOCAL privileges: the fixture TEMP tables are owned by the session role,
-- so service_role cannot read them after the role switch and pg_temp.uid()/rid()
-- would fail. Grant ONLY these test-local objects. No production-table privilege
-- is granted, and every grant dies with the enclosing ROLLBACK.
GRANT SELECT ON t_ids  TO service_role;
GRANT SELECT ON t_rows TO service_role;

SET LOCAL ROLE service_role;

-- ═══ 1. EXECUTE grant surface ══════════════════════════════════════════════
-- PUBLIC is an ACL grantee (oid 0), not necessarily a login role, so the ACL is
-- inspected directly rather than via has_function_privilege('public', ...).
SELECT ok(
  (SELECT proacl IS NOT NULL FROM pg_proc
    WHERE oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure),
  'RPC ACL is explicit (not default, which would imply PUBLIC EXECUTE)');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,jsonb)'::regprocedure
     AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
  'PUBLIC holds no EXECUTE on the RPC');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.save_estimate_from_wizard(uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated holds no EXECUTE on the RPC');
SELECT ok(NOT has_function_privilege('anon',
  'public.save_estimate_from_wizard(uuid,uuid,jsonb)', 'EXECUTE'),
  'anon holds no EXECUTE on the RPC');
SELECT ok(has_function_privilege('service_role',
  'public.save_estimate_from_wizard(uuid,uuid,jsonb)', 'EXECUTE'),
  'service_role holds EXECUTE on the RPC');

-- ═══ 2. Actor authorization ════════════════════════════════════════════════
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), NULL, pg_temp.payload()) $$,
  'UNAUTHENTICATED', 'null actor -> UNAUTHENTICATED');
SELECT throws_matching($$ SELECT pg_temp.call(NULL, pg_temp.uid('u_owner_a'), pg_temp.payload()) $$,
  'DEALER_CONTEXT_REQUIRED', 'null dealer -> DEALER_CONTEXT_REQUIRED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_none'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'no active membership -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_invited_a'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'invited membership -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_multi_ab'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'two active memberships -> PERMISSION_DENIED (global ambiguity rule)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_b'), pg_temp.uid('u_multi_ab'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'ambiguity is not resolved by naming the other dealer either');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_b'), pg_temp.uid('u_owner_a'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'dealer mismatch -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_readonly_a'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'readonly -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_demoted'), pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'active dealer_staff readonly DEMOTES an owner membership');
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_promoted'), pg_temp.payload('promotedkey000001')) $$,
  'active dealer_staff owner PROMOTES a readonly membership');
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('ownerkey00000001')) $$,
  'owner saves successfully');

-- ═══ 3. Idempotency key format ═════════════════════════════════════════════
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload() #- '{idempotencyKey}') $$,
  'VALIDATION_ERROR', 'missing idempotency key -> VALIDATION_ERROR');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('')) $$,
  'VALIDATION_ERROR', 'empty idempotency key -> VALIDATION_ERROR (102 silently disabled idempotency)');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload(repeat('a',15))) $$,
  'VALIDATION_ERROR', '15-char key -> VALIDATION_ERROR');
SELECT lives_ok(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload(repeat('b',16))) $$,
  '16-char key accepted');
SELECT lives_ok(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload(repeat('c',64))) $$,
  '64-char key accepted');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload(repeat('d',65))) $$,
  'VALIDATION_ERROR', '65-char key -> VALIDATION_ERROR');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('aaaaaaaaaaaaaaa!')) $$,
  'VALIDATION_ERROR', 'illegal character in key -> VALIDATION_ERROR');

-- ═══ 4. Exact replay: ZERO additional rows ═════════════════════════════════
CREATE TEMP TABLE t_counts (k text PRIMARY KEY, c bigint, e bigint, v bigint, i bigint);
SELECT lives_ok(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('replaykey0000001')) $$,
  'baseline save for the replay case succeeds');
INSERT INTO t_counts SELECT 'before',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);

SELECT is(
  (pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('replaykey0000001')) ->> 'idempotent_replay'),
  'true', 'exact replay returns idempotent_replay = true');

INSERT INTO t_counts SELECT 'after',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);

SELECT is((SELECT c FROM t_counts WHERE k='after'), (SELECT c FROM t_counts WHERE k='before'), 'replay wrote no customer');
SELECT is((SELECT v FROM t_counts WHERE k='after'), (SELECT v FROM t_counts WHERE k='before'), 'replay wrote no vehicle');
SELECT is((SELECT e FROM t_counts WHERE k='after'), (SELECT e FROM t_counts WHERE k='before'), 'replay wrote no estimate');
SELECT is((SELECT i FROM t_counts WHERE k='after'), (SELECT i FROM t_counts WHERE k='before'), 'replay wrote no items');
SELECT ok((SELECT idempotency_fingerprint ~ '^[0-9a-f]{64}$' FROM public.estimates
            WHERE idempotency_key = 'replaykey0000001'),
  'only a 64-char SHA-256 hex digest is stored');

-- draftLastUpdatedAt is excluded from the canonical projection.
SELECT is(
  (pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{metadata,draftLastUpdatedAt}',
               '"2026-09-09T09:09:09.000Z"')) ->> 'idempotent_replay'),
  'true', 'a different draftLastUpdatedAt is still an exact replay');

-- Numeric scale is normalized before hashing.
SELECT is(
  (pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{pricingSnapshot,subtotal}', '5000.00')) ->> 'idempotent_replay'),
  'true', '5000 and 5000.00 fingerprint identically');

-- ═══ 5. Conflict: any material difference ══════════════════════════════════
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{notes,internalMemo}', '"changed"')) $$,
  'DUPLICATE_SUBMISSION', 'changed internalMemo -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{customer,name}', '"別人"')) $$,
  'DUPLICATE_SUBMISSION', 'changed customer name -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{vehicle,plateNumber}', '"品川300"')) $$,
  'DUPLICATE_SUBMISSION', 'changed vehicle plate -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{services,0,manualPricingIdentity}', '"maintenance:other"')) $$,
  'DUPLICATE_SUBMISSION', 'changed service identity -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{services,0,lineMetadata}', '{"x":"1"}')) $$,
  'DUPLICATE_SUBMISSION', 'changed lineMetadata -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{nonPriceableSelections}',
                 '[{"category":"other","identity":"x","label":"L"}]')) $$,
  'DUPLICATE_SUBMISSION', 'changed nonPriceableSelections -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('replaykey0000001'), '{metadata,previewConfirmed}', 'false')) $$,
  'DUPLICATE_SUBMISSION', 'changed metadata.previewConfirmed -> DUPLICATE_SUBMISSION');

-- SAME grand total, DIFFERENT content: the direct regression guard for
-- migration 102's total-only comparison.
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(jsonb_set(pg_temp.payload('replaykey0000001'),
         '{services,0,unitPrice}', '4000'), '{services,0,lineTotal}', '4000')) $$,
  'DUPLICATE_SUBMISSION', 'same grandTotal but different lines -> DUPLICATE_SUBMISSION');

-- ═══ 6. Numeric / JSON domains — no invented defaults ══════════════════════
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('numkey0000000001') #- '{pricingSnapshot,subtotal}') $$,
  'VALIDATION_ERROR', 'absent subtotal -> VALIDATION_ERROR (102 coerced to 0)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('numkey0000000001') #- '{pricingSnapshot,taxRatePercent}') $$,
  'VALIDATION_ERROR', 'absent taxRatePercent -> VALIDATION_ERROR (102 invented 10)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('numkey0000000001') #- '{services,0,quantity}') $$,
  'VALIDATION_ERROR', 'absent quantity -> VALIDATION_ERROR (102 invented 1)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('numkey0000000001') #- '{services,0,lineTotal}') $$,
  'VALIDATION_ERROR', 'absent lineTotal -> VALIDATION_ERROR (102 coerced to 0)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,subtotal}', '"5000"')) $$,
  'VALIDATION_ERROR', 'numeric STRING subtotal -> VALIDATION_ERROR, no raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{services,0,quantity}', '"1"')) $$,
  'VALIDATION_ERROR', 'numeric STRING quantity -> VALIDATION_ERROR, no raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,grandTotal}', '-1')) $$,
  'VALIDATION_ERROR', 'negative grandTotal -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,subtotal}', '100.005')) $$,
  'VALIDATION_ERROR', 'scale > 2 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,grandTotal}', '1000000000001')) $$,
  'VALIDATION_ERROR', 'value above 1e12 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{services,0,quantity}', '0')) $$,
  'VALIDATION_ERROR', 'zero quantity -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,taxRatePercent}', '101')) $$,
  'VALIDATION_ERROR', 'taxRatePercent above 100 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,completeness}', '"partial"')) $$,
  'PRICING_INCOMPLETE', 'incomplete pricing -> PRICING_INCOMPLETE');

-- Required containers are required, never invented.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('numkey0000000001') #- '{nonPriceableSelections}') $$,
  'VALIDATION_ERROR', 'absent nonPriceableSelections -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('numkey0000000001') #- '{services,0,optionReferenceIds}') $$,
  'VALIDATION_ERROR', 'absent optionReferenceIds -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('numkey0000000001'), '{services,0,lineMetadata}', '{"a":{"b":1}}')) $$,
  'VALIDATION_ERROR', 'nested lineMetadata -> VALIDATION_ERROR');

-- ═══ 6b. Explicit-null trade rate, presence, and scale parity ═════════════
-- The canonical payload carries an EXPLICIT null tradeRatePercent.
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('traderatekey0001')) $$,
  'explicit null tradeRatePercent saves successfully');
SELECT is((SELECT c.trade_discount_pct FROM public.customers c
            JOIN public.estimates e ON e.customer_id = c.id
           WHERE e.idempotency_key = 'traderatekey0001'),
  0::numeric, 'explicit null tradeRatePercent persists as the canonical 0');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('traderatekey0002') #- '{customer,tradeRatePercent}') $$,
  'VALIDATION_ERROR',
  'a MISSING tradeRatePercent key is rejected (absence is not explicit null)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('traderatekey0003'), '{customer,tradeRatePercent}', '10.123')) $$,
  'VALIDATION_ERROR',
  'tradeRatePercent 10.123 is REJECTED, never silently rounded by numeric(5,2)');
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('traderatekey0004'), '{customer,tradeRatePercent}', '12.50')) $$,
  'a valid scale-2 tradeRatePercent is accepted');

-- Other REQUIRED nullable keys: absence must be rejected, not read as null.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('presencekey00001') #- '{customer,closingDay}') $$,
  'VALIDATION_ERROR', 'missing closingDay key is rejected');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('presencekey00002') #- '{customer,paymentDay}') $$,
  'VALIDATION_ERROR', 'missing paymentDay key is rejected');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('presencekey00003') #- '{vehicle,registrationDate}') $$,
  'VALIDATION_ERROR', 'missing registrationDate key is rejected');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('presencekey00004') #- '{vehicle,inspectionExpiry}') $$,
  'VALIDATION_ERROR', 'missing inspectionExpiry key is rejected');

-- Tax-rate scale parity: 10.123 must not persist while fingerprinting as 10.12.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('taxscalekey00001'), '{pricingSnapshot,taxRatePercent}', '10.123')) $$,
  'VALIDATION_ERROR',
  'taxRatePercent scale 3 is REJECTED (fingerprint rounds to 2; storing 10.123 would collide)');

-- ═══ 6c. Fail-closed required-field regression (R56C-F3) ═══════════════════
-- Every case below removes or corrupts exactly ONE required field. Under the
-- pre-F3 `jsonb_typeof(x -> 'k') <> '...'` guards these were three-valued-logic
-- holes: an ABSENT key made jsonb_typeof return NULL, `NULL <> 'type'` evaluated
-- to NULL, and the IF skipped the guard entirely -- so the payload sailed past
-- validation and failed later as a raw NOT-NULL / cast error, or was persisted.
-- All seventeen must now raise the STABLE code before any write.
--
-- One shared key is deliberate: each case aborts in validation, before the
-- idempotency lookup, so no case can ever observe another's persisted state.

-- Required root containers.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{services}') $$,
  'VALIDATION_ERROR', 'absent root services -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('failclosedkey001'), '{services}', '{}'::jsonb)) $$,
  'VALIDATION_ERROR',
  'services as an OBJECT -> VALIDATION_ERROR (type proven before jsonb_array_length)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{notes}') $$,
  'VALIDATION_ERROR', 'absent root notes -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{metadata}') $$,
  'VALIDATION_ERROR', 'absent root metadata -> VALIDATION_ERROR');

-- Required pricing sub-containers.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{pricingSnapshot,warnings}') $$,
  'VALIDATION_ERROR', 'absent pricingSnapshot.warnings -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{pricingSnapshot,errors}') $$,
  'VALIDATION_ERROR', 'absent pricingSnapshot.errors -> VALIDATION_ERROR');

-- Required intent containers (both are persisted as NOT NULL jsonb columns).
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{discountIntent}') $$,
  'VALIDATION_ERROR', 'absent discountIntent -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{couponIntent}') $$,
  'VALIDATION_ERROR', 'absent couponIntent -> VALIDATION_ERROR');

-- Required customer fields.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{customer,accountsReceivableAllowed}') $$,
  'VALIDATION_ERROR',
  'absent customer.accountsReceivableAllowed -> VALIDATION_ERROR (never invented false)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{customer,name}') $$,
  'VALIDATION_ERROR', 'absent new-customer name -> VALIDATION_ERROR');

-- Required service-line fields.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{services,0,label}') $$,
  'VALIDATION_ERROR', 'absent service label -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{services,0,lineMetadata}') $$,
  'VALIDATION_ERROR', 'absent service lineMetadata -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{services,0,wizardCategory}') $$,
  'VALIDATION_ERROR', 'absent service wizardCategory -> VALIDATION_ERROR');

-- Reduction boundary: totals are stored VERBATIM and never recomputed, so an
-- incoherent snapshot has no downstream corrector.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('failclosedkey001'), '{pricingSnapshot,discountTotal}', '6000')) $$,
  'VALIDATION_ERROR', 'discountTotal greater than subtotal -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('failclosedkey001'), '{pricingSnapshot,couponTotal}', '6000')) $$,
  'VALIDATION_ERROR', 'couponTotal greater than subtotal -> VALIDATION_ERROR');

-- Exact metadata and currency contract, both validated before fingerprinting.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{metadata,source}') $$,
  'VALIDATION_ERROR', 'absent metadata.source -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('failclosedkey001') #- '{pricingSnapshot,currency}') $$,
  'VALIDATION_ERROR', 'absent pricingSnapshot.currency -> VALIDATION_ERROR');

-- ═══ 7. Identity, casts and calendar validity ══════════════════════════════
-- Every one of these would have leaked a raw SQLSTATE under migration 102.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', '"not-a-uuid"')) $$,
  'VALIDATION_ERROR', 'malformed customerId -> VALIDATION_ERROR, never raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', to_jsonb(repeat('-',36)))) $$,
  'VALIDATION_ERROR', '36 hyphens is rejected by the STRICT grouped UUID shape');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{vehicle,registrationDate}', '"2026-02-31"')) $$,
  'VALIDATION_ERROR', 'calendar-invalid 2026-02-31 -> VALIDATION_ERROR, never raw 22007/22008');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{vehicle,inspectionExpiry}', '"2026-13-01"')) $$,
  'VALIDATION_ERROR', 'month 13 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,closingDay}', '"abc"')) $$,
  'VALIDATION_ERROR', 'non-numeric closingDay -> VALIDATION_ERROR, never raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,paymentDay}', '"32"')) $$,
  'VALIDATION_ERROR', 'day 32 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), pg_temp.payload('idkey00000000001') #- '{customer,isBusiness}') $$,
  'VALIDATION_ERROR', 'absent isBusiness -> VALIDATION_ERROR (never invented false)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,tradeRatePercent}', '101')) $$,
  'VALIDATION_ERROR', 'tradeRatePercent above 100 -> VALIDATION_ERROR (never invented 0)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(jsonb_set(pg_temp.payload('idkey00000000001'), '{vehicle,maker}', '""'),
            '{vehicle,model}', '""')) $$,
  'VALIDATION_ERROR', 'new vehicle without maker or model -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{services,0,category}', '"wheel"')) $$,
  'VALIDATION_ERROR', 'category outside the 093 set -> VALIDATION_ERROR, never raw 23514');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{services}',
    (pg_temp.payload() -> 'services') || (pg_temp.payload() -> 'services'))) $$,
  'VALIDATION_ERROR', 'duplicate lineId -> VALIDATION_ERROR, never raw 23505');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('idkey00000000001'), '{services,0,pricingReferenceId}', '"cat-1"')) $$,
  'VALIDATION_ERROR', 'manual line carrying a catalog identity -> VALIDATION_ERROR');

-- Cross-tenant and vehicle/customer coherence.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(jsonb_set(pg_temp.payload('xkey000000000001'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', to_jsonb(pg_temp.rid('cust_b1')::text))) $$,
  'CUSTOMER_NOT_FOUND', 'cross-dealer customer -> CUSTOMER_NOT_FOUND');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.payload('xkey000000000001'),
    '{customer,mode}', '"existing"'), '{customer,customerId}', to_jsonb(pg_temp.rid('cust_a1')::text)),
    '{vehicle,mode}', '"existing"'), '{vehicle,vehicleId}', to_jsonb(pg_temp.rid('veh_a2_other_cust')::text))) $$,
  'VEHICLE_NOT_FOUND',
  'same-dealer vehicle belonging to ANOTHER customer -> VEHICLE_NOT_FOUND (the 102 gap)');

-- ═══ 8. REAL post-write atomic rollback ═══════════════════════════════════
-- The prevalidation case (a bad category) aborts BEFORE any write, so it proves
-- nothing about rollback. This installs a TEST-ONLY, rollback-scoped fault that
-- fires on the SECOND item -- after the customer, the vehicle, the estimate and
-- the FIRST item have all been written -- and asserts every one of them is gone.
-- The production trigger is never disabled or modified.
CREATE OR REPLACE FUNCTION pg_temp.r56c_fault() RETURNS trigger
LANGUAGE plpgsql AS $fault$
BEGIN
  IF NEW.item_name = 'FAULT_SECOND_ITEM' THEN
    RAISE EXCEPTION 'R56C_TEST_FAULT: deliberate post-write failure';
  END IF;
  RETURN NEW;
END $fault$;

CREATE TEMP TABLE t_roll (k text PRIMARY KEY, c bigint, v bigint, e bigint, i bigint);
INSERT INTO t_roll SELECT 'before',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.vehicles),
  (SELECT count(*) FROM public.estimates), (SELECT count(*) FROM public.estimate_items);

SAVEPOINT rollback_probe;
RESET ROLE;
CREATE TRIGGER r56c_fault_trg BEFORE INSERT ON public.estimate_items
  FOR EACH ROW EXECUTE FUNCTION pg_temp.r56c_fault();
SET LOCAL ROLE service_role;

SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), jsonb_set(pg_temp.payload('rollbackkey00001'), '{services}',
    (pg_temp.payload() -> 'services') ||
    jsonb_build_array(jsonb_set(jsonb_set(pg_temp.payload() -> 'services' -> 0,
      '{lineId}', '"manual:maintenance:second"'), '{label}', '"FAULT_SECOND_ITEM"')))) $$,
  'R56C_TEST_FAULT',
  'the deliberate fault fires on the SECOND item, after real writes have occurred');

INSERT INTO t_roll SELECT 'after',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.vehicles),
  (SELECT count(*) FROM public.estimates), (SELECT count(*) FROM public.estimate_items);
SELECT is((SELECT c FROM t_roll WHERE k='after'), (SELECT c FROM t_roll WHERE k='before'),
  'post-write rollback: ZERO new customer rows');
SELECT is((SELECT v FROM t_roll WHERE k='after'), (SELECT v FROM t_roll WHERE k='before'),
  'post-write rollback: ZERO new vehicle rows');
SELECT is((SELECT e FROM t_roll WHERE k='after'), (SELECT e FROM t_roll WHERE k='before'),
  'post-write rollback: ZERO new estimate rows');
SELECT is((SELECT i FROM t_roll WHERE k='after'), (SELECT i FROM t_roll WHERE k='before'),
  'post-write rollback: ZERO new item rows (including the first, already-written one)');

RESET ROLE;
DROP TRIGGER r56c_fault_trg ON public.estimate_items;
SET LOCAL ROLE service_role;
RELEASE SAVEPOINT rollback_probe;

SELECT ok(NOT EXISTS (SELECT 1 FROM pg_trigger
   WHERE tgrelid = 'public.estimate_items'::regclass AND tgname = 'r56c_fault_trg'),
  'the test-only fault trigger is removed');

-- ═══ 9. Success shape: lineId persisted, totals verbatim ═══════════════════
SELECT is(
  (SELECT wizard_line_id FROM public.estimate_items ei
     JOIN public.estimates e ON e.id = ei.estimate_id
    WHERE e.idempotency_key = 'ownerkey00000001'),
  'manual:maintenance:maint-a', 'lineId is persisted into wizard_line_id (102 dropped it)');
SELECT is(
  (SELECT total FROM public.estimates WHERE idempotency_key = 'ownerkey00000001'),
  5500::numeric, 'grandTotal stored verbatim; SQL never reprices');
SELECT is(
  (SELECT tax_rate FROM public.estimates WHERE idempotency_key = 'ownerkey00000001'),
  10::numeric, 'taxRatePercent stored from the payload, not an invented default');

-- ═══ 10. B7-0A: replay-aware numbering ═════════════════════════════════════
-- The defect this section pins: until B7-0A the caller allocated the estimate
-- number in a SEPARATE, already-committed RPC before this function ran, so an
-- exact replay, a DUPLICATE_SUBMISSION and every rejected save each permanently
-- burned a document number. Allocation now happens INSIDE the save transaction,
-- after the advisory lock and after the replay/conflict decision, so the only
-- path that may advance document_sequences is a genuinely new, successful save.
--
-- Every assertion below is a DELTA: seq(after) - seq(before).

-- ── 10a. The old writable path is gone ──────────────────────────────────────
SELECT ok(to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,text,jsonb)') IS NULL,
  'the four-argument RPC no longer exists (no second writable path)');
SELECT ok(to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)') IS NOT NULL,
  'the three-argument RPC exists');

-- ── 10b. Helper privilege surface ───────────────────────────────────────────
SELECT ok(NOT has_function_privilege('anon',
  'public.wiz_format_document_number(text,integer,integer,integer)', 'EXECUTE'),
  'anon holds no EXECUTE on the formatter');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.wiz_format_document_number(text,integer,integer,integer)', 'EXECUTE'),
  'authenticated holds no EXECUTE on the formatter');
SELECT ok(has_function_privilege('service_role',
  'public.wiz_format_document_number(text,integer,integer,integer)', 'EXECUTE'),
  'service_role holds EXECUTE on the formatter');
SELECT ok(NOT has_function_privilege('anon',
  'public.wiz_document_fiscal_year(text,timestamptz)', 'EXECUTE'),
  'anon holds no EXECUTE on the fiscal-year helper');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.wiz_document_fiscal_year(text,timestamptz)', 'EXECUTE'),
  'authenticated holds no EXECUTE on the fiscal-year helper');
SELECT ok(has_function_privilege('service_role',
  'public.wiz_document_fiscal_year(text,timestamptz)', 'EXECUTE'),
  'service_role holds EXECUTE on the fiscal-year helper');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid IN ('public.wiz_format_document_number(text,integer,integer,integer)'::regprocedure,
                   'public.wiz_document_fiscal_year(text,timestamptz)'::regprocedure)
     AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
  'PUBLIC holds no EXECUTE on either helper');

-- ── 10c. Canonical formatter parity with numbering-types.ts (R63) ───────────
SELECT is(public.wiz_format_document_number('',    1, 5, 0),      '00001',
  'blank prefix + never (no doubled number)');
SELECT is(public.wiz_format_document_number('',    1, 5, 2026),   '2026-00001',
  'blank prefix + yearly');
SELECT is(public.wiz_format_document_number('',    1, 5, 202607), '2026-07-00001',
  'blank prefix + monthly');
SELECT is(public.wiz_format_document_number('EST', 1, 5, 0),      'EST-00001',
  'EST + never');
SELECT is(public.wiz_format_document_number('EST', 1, 5, 2026),   'EST-2026-00001',
  'EST + yearly');
SELECT is(public.wiz_format_document_number('EST', 1, 5, 202607), 'EST-2026-07-00001',
  'EST + monthly');
SELECT is(public.wiz_format_document_number('EST', 1, 1, 0),  'EST-1',
  'padding 1');
SELECT is(public.wiz_format_document_number('EST', 1, 10, 0), 'EST-0000000001',
  'padding 10');
SELECT is(public.wiz_format_document_number('EST', 123456, 5, 0), 'EST-123456',
  'a number longer than the padding is NEVER truncated (bare lpad would cut it)');
SELECT is(public.wiz_format_document_number(' ', 1, 5, 0), ' -00001',
  'a stored prefix is emitted byte-for-byte, never trimmed');

-- ── 10d. Canonical JST clock ────────────────────────────────────────────────
SELECT is(public.wiz_document_fiscal_year('never', '2025-12-31 15:00:00+00'::timestamptz), 0,
  'never is always 0');
SELECT is(public.wiz_document_fiscal_year('yearly', '2025-12-31 14:59:59.999+00'::timestamptz), 2025,
  'JST year boundary: 23:59:59.999 JST is still 2025');
SELECT is(public.wiz_document_fiscal_year('monthly', '2025-12-31 14:59:59.999+00'::timestamptz), 202512,
  'JST year boundary: monthly still 202512');
SELECT is(public.wiz_document_fiscal_year('yearly', '2025-12-31 15:00:00+00'::timestamptz), 2026,
  'JST year boundary: 00:00 JST is already 2026');
SELECT is(public.wiz_document_fiscal_year('monthly', '2025-12-31 15:00:00+00'::timestamptz), 202601,
  'JST year boundary: monthly already 202601');
SELECT is(public.wiz_document_fiscal_year('monthly', '2026-01-31 14:59:59.999+00'::timestamptz), 202601,
  'JST month boundary: still 202601');
SELECT is(public.wiz_document_fiscal_year('monthly', '2026-01-31 15:00:00+00'::timestamptz), 202602,
  'JST month boundary: already 202602');

-- ── 10e. First save for a dealer with NO sequence row ───────────────────────
-- dealer_c has never saved, so this exercises the canonical defaults. The TABLE
-- default for prefix is '' and must NOT be used: the wizard's default is 'EST'.
SELECT is((pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
            pg_temp.payload('dealerckey000001')) ->> 'estimate_number'),
  'EST-00001', 'first save with no sequence row -> EST-00001 (EST/5/never defaults)');
SELECT is((SELECT prefix || '|' || padding || '|' || reset_policy || '|' || fiscal_year
             FROM public.document_sequences
            WHERE dealer_id = pg_temp.uid('dealer_c') AND sequence_type = 'estimate'),
  'EST|5|never|0', 'the created sequence row carries the canonical defaults');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')), 1::bigint,
  'the new save advanced the sequence exactly +1');

-- ── 10f. Replay and conflict advance NOTHING ────────────────────────────────
CREATE TEMP TABLE t_seq (k text PRIMARY KEY, v bigint);
INSERT INTO t_seq VALUES ('before_replay', pg_temp.seq(pg_temp.uid('dealer_c')));

SELECT is((pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
            pg_temp.payload('dealerckey000001')) ->> 'idempotent_replay'),
  'true', 'exact replay is recognised');
SELECT is((pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
            pg_temp.payload('dealerckey000001')) ->> 'estimate_number'),
  'EST-00001', 'replay returns the ORIGINAL stored number, not a freshly allocated one');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')),
          (SELECT v FROM t_seq WHERE k='before_replay'),
  'exact replay advanced the sequence by ZERO');

SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  jsonb_set(pg_temp.payload('dealerckey000001'), '{notes,internalMemo}', '"changed"')) $$,
  'DUPLICATE_SUBMISSION', 'same key + different payload -> DUPLICATE_SUBMISSION');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')),
          (SELECT v FROM t_seq WHERE k='before_replay'),
  'DUPLICATE_SUBMISSION advanced the sequence by ZERO');

-- ── 10g. Every rejection path advances NOTHING ──────────────────────────────
INSERT INTO t_seq VALUES ('before_fail', pg_temp.seq(pg_temp.uid('dealer_c')));
-- The VEHICLE_NOT_FOUND case necessarily runs on dealer A (that is where the
-- mismatched customer/vehicle fixtures live), so dealer A is measured too.
INSERT INTO t_seq VALUES ('before_fail_a', pg_temp.seq(pg_temp.uid('dealer_a')));

SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  pg_temp.payload('failkey000000001') #- '{services}') $$,
  'VALIDATION_ERROR', 'validation failure raises');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  jsonb_set(pg_temp.payload('failkey000000002'), '{pricingSnapshot,completeness}', '"partial"')) $$,
  'PRICING_INCOMPLETE', 'pricing failure raises');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  jsonb_set(jsonb_set(pg_temp.payload('failkey000000003'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', to_jsonb(pg_temp.rid('cust_b1')::text))) $$,
  'CUSTOMER_NOT_FOUND', 'customer failure raises');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'),
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.payload('failkey000000004'),
    '{customer,mode}', '"existing"'), '{customer,customerId}', to_jsonb(pg_temp.rid('cust_a1')::text)),
    '{vehicle,mode}', '"existing"'), '{vehicle,vehicleId}', to_jsonb(pg_temp.rid('veh_a2_other_cust')::text))) $$,
  'VEHICLE_NOT_FOUND', 'vehicle failure raises');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')),
          (SELECT v FROM t_seq WHERE k='before_fail'),
  'validation / pricing / customer failures advanced dealer C''s sequence by ZERO');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_a')),
          (SELECT v FROM t_seq WHERE k='before_fail_a'),
  'the VEHICLE_NOT_FOUND failure advanced dealer A''s sequence by ZERO');

-- Forced post-write item failure: the estimate and its first item are already
-- written when the fault fires, so this proves the sequence rolls back too.
INSERT INTO t_seq VALUES ('before_item_fault', pg_temp.seq(pg_temp.uid('dealer_c')));
RESET ROLE;
CREATE TRIGGER r64a_fault_trg BEFORE INSERT ON public.estimate_items
  FOR EACH ROW EXECUTE FUNCTION pg_temp.r56c_fault();
SET LOCAL ROLE service_role;
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  jsonb_set(pg_temp.payload('itemfaultkey0001'), '{services}',
    (pg_temp.payload() -> 'services') ||
    jsonb_build_array(jsonb_set(jsonb_set(pg_temp.payload() -> 'services' -> 0,
      '{lineId}', '"manual:maintenance:second"'), '{label}', '"FAULT_SECOND_ITEM"')))) $$,
  'R56C_TEST_FAULT', 'the deliberate item fault fires after real writes');
RESET ROLE;
DROP TRIGGER r64a_fault_trg ON public.estimate_items;
SET LOCAL ROLE service_role;
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')),
          (SELECT v FROM t_seq WHERE k='before_item_fault'),
  'a post-write item failure rolled the sequence allocation back to ZERO delta');

-- ── 10h. Rollback restores the pre-call sequence value ──────────────────────
INSERT INTO t_seq VALUES ('before_sp', pg_temp.seq(pg_temp.uid('dealer_c')));
SAVEPOINT seq_rollback_probe;
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  pg_temp.payload('rollbackseq00001')) $$,
  'a save inside the savepoint succeeds');
ROLLBACK TO SAVEPOINT seq_rollback_probe;
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')),
          (SELECT v FROM t_seq WHERE k='before_sp'),
  'transaction rollback restored the pre-call sequence value');

-- ── 10i. Distinct keys, consecutive numbers; dealers are independent ────────
SELECT is((pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
            pg_temp.payload('seqkey0000000002')) ->> 'estimate_number'),
  'EST-00002', 'a second distinct key receives the next consecutive number');
SELECT is((pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
            pg_temp.payload('seqkey0000000003')) ->> 'estimate_number'),
  'EST-00003', 'a third distinct key continues the sequence');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_c')), 3::bigint,
  'three successful saves advanced the sequence by exactly three');
SELECT isnt(pg_temp.seq(pg_temp.uid('dealer_a')), pg_temp.seq(pg_temp.uid('dealer_c')),
  'dealer A and dealer C advance INDEPENDENT sequence rows');
SELECT is((SELECT count(DISTINCT dealer_id) FROM public.document_sequences
            WHERE sequence_type = 'estimate'
              AND dealer_id IN (pg_temp.uid('dealer_a'), pg_temp.uid('dealer_c'))),
  2::bigint, 'each dealer owns its own estimate sequence row');

-- ── 10j. No raw database detail escapes any numbering path ──────────────────
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_c'), pg_temp.uid('u_owner_c'),
  jsonb_set(pg_temp.payload('dealerckey000001'), '{customer,name}', '"別人"')) $$,
  '^DUPLICATE_SUBMISSION', 'the conflict message begins with the stable code, never a SQLSTATE');
SELECT ok((SELECT count(*) FROM public.estimates
            WHERE dealer_id = pg_temp.uid('dealer_c')
              AND idempotency_key = 'dealerckey000001') = 1,
  'exactly one estimate exists for the replayed key -- no 23505 path created a second');

-- ═══ 11. R64A-F1: function attributes and configuration selection ══════════
-- Catalog evidence only (pg_proc via regprocedure) -- never source text, which
-- could agree with a comment while the deployed object disagrees.

-- ── 11a. Declared attributes are what the security review approved ──────────
SELECT is(pg_temp.fnattr('public.save_estimate_from_wizard(uuid,uuid,jsonb)'),
  'false|v|false|pg_catalog,public,pg_temp',
  'save RPC: SECURITY INVOKER, VOLATILE, search_path pinned to pg_catalog, public, pg_temp');
SELECT is(pg_temp.fnattr('public.wiz_document_fiscal_year(text,timestamptz)'),
  'false|s|true|pg_catalog,public',
  'fiscal-year helper: SECURITY INVOKER, STABLE, STRICT, search_path pinned to pg_catalog, public');
SELECT is(pg_temp.fnattr('public.wiz_format_document_number(text,integer,integer,integer)'),
  'false|i|true|pg_catalog,public',
  'formatter: SECURITY INVOKER, IMMUTABLE, STRICT, search_path pinned to pg_catalog, public');

-- ── 11b. The newest configuration row is the one that governs ───────────────
-- Dealer D holds two rows differing in EVERY attribute. Only the documented
-- ORDER BY can pick the 'NEW' row (fiscal_year 0, prefix NEW, padding 3,
-- current_number 7), so the persisted number can only be NEW-008.
SELECT is((pg_temp.call(pg_temp.uid('dealer_d'), pg_temp.uid('u_owner_d'),
            pg_temp.payload('dealerdkey000001')) ->> 'estimate_number'),
  'NEW-008',
  'the most recently updated configuration row governs prefix, padding and policy');
SELECT is((SELECT current_number FROM public.document_sequences
            WHERE dealer_id = pg_temp.uid('dealer_d')
              AND sequence_type = 'estimate' AND fiscal_year = 0),
  8, 'the selected (newest) row advanced 7 -> 8');
SELECT is((SELECT current_number || '|' || prefix || '|' || padding || '|' || reset_policy
             FROM public.document_sequences
            WHERE dealer_id = pg_temp.uid('dealer_d')
              AND sequence_type = 'estimate' AND fiscal_year = 2026),
  '99|OLD|6|yearly', 'the older row was not read, not advanced and not rewritten');

-- ── 11c. The TARGET row's stored configuration wins over the SOURCE row's ───
-- Dealer E's SOURCE row is selected (latest updated_at) and its 'monthly' policy
-- resolves to the CURRENT month, so the upsert conflicts with the pre-existing
-- TARGET row. RETURNING must therefore yield TARGET/4 -- never SOURCE/8.
SELECT is((pg_temp.call(pg_temp.uid('dealer_e'), pg_temp.uid('u_owner_e'),
            pg_temp.payload('dealerekey000001')) ->> 'estimate_number'),
  public.wiz_format_document_number('TARGET', 5, 4,
    public.wiz_document_fiscal_year('monthly', CURRENT_TIMESTAMP)),
  'ON CONFLICT ... RETURNING formats from the TARGET row, not the proposed source values');
SELECT is((SELECT current_number FROM public.document_sequences
            WHERE dealer_id = pg_temp.uid('dealer_e') AND sequence_type = 'estimate'
              AND fiscal_year = public.wiz_document_fiscal_year('monthly', CURRENT_TIMESTAMP)),
  5, 'the current-month target row advanced 4 -> 5');
SELECT is((SELECT current_number || '|' || prefix || '|' || padding
             FROM public.document_sequences
            WHERE dealer_id = pg_temp.uid('dealer_e')
              AND sequence_type = 'estimate' AND fiscal_year = 202001),
  '55|SOURCE|8', 'the source row supplied only the policy; it was never advanced');

SELECT * FROM finish();
ROLLBACK;

-- ============================================================================
-- R56C_EXTERNAL_CONCURRENCY_GATE
--
-- NOT COVERED ABOVE and NOT REPORTED AS PASSED. Two concurrent same-key
-- transactions cannot be expressed in a single pgTAP session, because the
-- advisory lock and the partial unique index only interact across two real
-- connections. Execute this separately in R56C:
--
--   Session 1                                  Session 2
--   ---------                                  ---------
--   BEGIN;
--   SET LOCAL ROLE service_role;
--                                              BEGIN;
--                                              SET LOCAL ROLE service_role;
--   SELECT save_estimate_from_wizard(
--     A, owner_A, payload('conckey000000001'));
--   -- holds pg_advisory_xact_lock(A:conckey000000001); do NOT commit yet
--                                              SELECT save_estimate_from_wizard(
--                                                A, owner_A,
--                                                payload('conckey000000001'));
--                                              -- MUST BLOCK on the advisory lock
--   COMMIT;
--                                              -- unblocks; then observe result
--                                              COMMIT;
--
-- REQUIRED OUTCOMES
--   * Session 2 BLOCKS while session 1 holds the lock (verify via pg_locks:
--     locktype='advisory' and granted=false for session 2).
--   * After session 1 commits, session 2 returns EITHER
--     idempotent_replay = true OR raises DUPLICATE_SUBMISSION.
--   * A raw unique_violation / SQLSTATE 23505 NEVER reaches either caller.
--   * Exactly ONE estimates row exists for (dealer A, 'conckey000000001').
--   * ROW-COUNT PARITY across ALL FOUR tables, not the estimate alone. Capture
--     count(customers), count(vehicles), count(estimates), count(estimate_items)
--     before session 1 begins and after both sessions commit. The deltas MUST be
--     exactly +1 customer, +1 vehicle, +1 estimate and +N items (N = the payload
--     line count) -- the totals for ONE save. Session 2 must contribute ZERO to
--     every one of the four. This is what proves the unique-race branch leaves
--     no orphan customer or vehicle, which splitting the exception subtransaction
--     would have broken.
--   * Repeat with session 2 sending a MATERIALLY DIFFERENT payload under the
--     same key: it must raise DUPLICATE_SUBMISSION, create no rows in any of the
--     four tables, and leave the four counts unchanged from the post-session-1
--     values.
-- ============================================================================

-- ============================================================================
-- B1.1 (migration 110) -- store pricing configuration foundation
--
-- **NOT EXECUTED IN B1.1-B.** Runs in the B1.1 verification phase against a
-- DISPOSABLE LOCAL stack only, after applying 000 -> 110 in order. Never
-- against the linked, staging or production project.
--
-- SCOPE NOTE
--   110 adds `estimates.configuration_revision` as the attribution slot but
--   does NOT rewrite save_estimate_from_wizard. Persisting the submitted value
--   through the RPC is a separate, separately-reviewed migration, so the
--   assertions below cover the COLUMN and the surrounding configuration
--   surfaces -- not RPC round-tripping of the revision.
--
-- REQUIRED OUTCOMES
--
-- 1. configuration_revision column contract
--    * public.estimates.configuration_revision EXISTS, is bigint and NULLABLE.
--    * It has NO default: an INSERT that omits it yields NULL ("unattributed"),
--      never a fabricated revision.
--    * CHECK estimates_configuration_revision_nonneg REJECTS -1 and ACCEPTS
--      both NULL and 0.
--    * Pre-existing estimate rows are UNCHANGED by the migration (no backfill).
--
-- 2. Saved-estimate immutability (the core B1.1 acceptance)
--    * Save an estimate through save_estimate_from_wizard whose lines carry a
--      PPF coefficient and a PPF+coating reduction in pricing_metadata.
--    * THEN mutate the configuration: change the catalog item's
--      install_coefficient_bp, edit a coupon's label and value, and archive the
--      matching dealer_ppf_coating_adjustments row.
--    * Re-read the estimate and its estimate_items. EVERY one of item_name,
--      unit_price, quantity, line_total, pricing_metadata, subtotal, tax,
--      tax_amount, discount_amount and total MUST be byte-identical to the
--      values captured immediately after the save.
--
-- 3. install_coefficient_bp constraints
--    * wci_install_coefficient_positive REJECTS 0 and -1; ACCEPTS NULL and 1.
--    * wci_install_coefficient_scope REJECTS a non-NULL coefficient on
--      maintenance_menu / wash_menu / room_cleaning_menu / other_work_preset /
--      store_global_option / coupon; ACCEPTS it on film_type and
--      ppf_type_group.
--    * dealer_wizard_catalog_overrides.install_coefficient_bp REJECTS 0 and -1.
--
-- 4. dealer_ppf_coating_adjustments contract
--    * UNIQUE (dealer_id, ppf_method_code, coating_code) REJECTS a second row
--      for the same triple.
--    * dpca_percent_range REJECTS adjustment_value = 10001 when
--      adjustment_type = 'percent'; ACCEPTS 10000.
--    * dpca_value_non_negative REJECTS -1 for BOTH adjustment types.
--    * dpca_ppf_method_code_format / dpca_coating_code_format REJECT 'Full Coat'
--      and ''; ACCEPT 'full' and 'pure-evo'.
--    * There is NO DELETE policy: archival is deleted_at / is_active only.
--
-- 5. Tenant isolation (role authenticated, TWO dealers)
--    * Dealer A member SELECTs only dealer A adjustment rows; dealer B rows are
--      invisible -- zero rows, never an error that leaks existence.
--    * A dealer A member with role 'staff' (not owner|manager) CANNOT INSERT or
--      UPDATE any adjustment row: wiz_can_configure is false, so both policies
--      refuse.
--    * A dealer A owner CANNOT INSERT a row carrying dealer B's dealer_id --
--      dpca_insert's WITH CHECK evaluates wiz_can_configure(dealer_id) against
--      the ROW's dealer, not the caller's claim.
--
-- 6. Revision invalidation
--    * INSERT, then UPDATE, on dealer_ppf_coating_adjustments each bump
--      dealer_wizard_catalog_lifecycle.current_configuration_revision by
--      exactly ONE per STATEMENT (a two-row INSERT bumps once, not twice).
--    * A lifecycle in CATALOG_REVIEWED leaves that state after any such bump.
--
-- 7. Authoring RPC allowlist (wiz_upsert_catalog_item, replaced by 110)
--    * ACCEPTS kind 'coupon' and 'ppf_type_group' for an owner|manager.
--    * STILL RAISES WIZ_UNSUPPORTED_KIND for 'ppf_method', 'ppf_part' and
--      'window_area'.
--    * RAISES WIZ_COUPON_PRICE_FORBIDDEN when a coupon payload carries
--      default_unit_price.
--    * RAISES WIZ_COUPON_TYPE_REQUIRED / WIZ_COUPON_VALUE_REQUIRED /
--      WIZ_COUPON_COMBINABLE_REQUIRED when those keys are absent.
--    * RAISES WIZ_COEFFICIENT_INVALID for install_coefficient_bp <= 0 and
--      WIZ_UNKNOWN_FIELD when install_coefficient_bp is sent on a menu kind.
--    * A created coupon row's generated code matches '^coupon-' and a created
--      PPF type's matches '^ppftype-'; NEITHER is derived from the label.
--    * Every one of the above still bumps the revision exactly once on success
--      and not at all on failure.
-- ============================================================================

-- ============================================================================
-- B1.1-B2 (migration 20260726090000) -- configuration_revision persistence
--
-- **NOT EXECUTED IN B1.1-B2.** Runs in the verification phase against a
-- DISPOSABLE LOCAL stack only, after applying 000 -> 110 -> 20260726090000 in
-- order. Never against the linked, staging or production project.
--
-- REQUIRED OUTCOMES
--
-- 1. Verbatim persistence, no arithmetic
--    * A save whose metadata carries configurationRevision = 7 stores exactly 7
--      in estimates.configuration_revision.
--    * Every money column is byte-identical to the same payload saved under the
--      PREVIOUS function definition: subtotal, tax, tax_rate, tax_amount,
--      discount_amount and total must not move by a single unit. The RPC still
--      performs NO pricing arithmetic.
--
-- 2. Optionality and fail-closed domain
--    * An ABSENT metadata.configurationRevision saves successfully and stores
--      NULL. An explicit JSON null does the same. Neither fabricates a value.
--    * A non-integer (7.5), a negative (-1), a non-finite, a string ("7") and a
--      boolean each RAISE
--      'VALIDATION_ERROR: metadata.configurationRevision ...' and create ZERO
--      rows in customers, vehicles, estimates and estimate_items.
--    * Rejection happens in C.2b -- BEFORE the fingerprint is computed and
--      BEFORE any write -- so a rejected value is never hashed or stored.
--
-- 3. Fingerprint participation (deliberate)
--    * Two saves identical in every respect EXCEPT configurationRevision
--      (7 vs 8) under the SAME idempotency key raise DUPLICATE_SUBMISSION.
--      They are materially different submissions and must never replay as one
--      another.
--    * A genuine retry carrying the SAME revision returns
--      idempotent_replay = true with ZERO writes and no document-number burn.
--    * An absent key and an explicit null fingerprint IDENTICALLY (both project
--      to JSON null), so a caller that omits the key and one that sends null
--      are the same submission.
--
-- 4. Preservation of every pre-existing behavior
--    Re-run the ENTIRE pre-existing suite above against the replaced function.
--    All of the following must be unchanged, not merely present:
--      * actor/membership/ambiguity/role authorization and its exact messages;
--      * every three-valued-logic payload guard;
--      * pricing numeric domain, scale and finiteness checks;
--      * the discountTotal/couponTotal reduction boundary;
--      * customer and vehicle validation, including calendar-real dates;
--      * the single service-line validation authority and duplicate lineId
--        rejection;
--      * the C.9 advisory lock and the replay/conflict ordering;
--      * estimate-number allocation AFTER the replay decision, with rollback on
--        replay, conflict and item failure (no burned numbers);
--      * the shared exception subtransaction and four-table row-count parity;
--      * constraint-specific unique_violation handling
--        (estimates_dealer_idempotency_key_uidx only);
--      * no raw SQLSTATE / SQLERRM / constraint text reaching any caller.
--
-- 5. Coupon snapshot round-trip
--    * couponIntent now carries `applications`. A save with two applied coupons
--      stores the FULL array verbatim in estimates.coupon_intent, including each
--      couponId, code, label, discountType, discountValue and appliedAmount.
--    * Those stored values are UNCHANGED after the underlying coupon rows are
--      edited (label and value) and archived. The snapshot is frozen.
--
-- 6. Grants and ACL
--    * CREATE OR REPLACE preserved the existing ACL: service_role still holds
--      EXECUTE and no new role gained it. Migration 104 remains the single
--      authority; this migration re-issues no GRANT.
-- ============================================================================
