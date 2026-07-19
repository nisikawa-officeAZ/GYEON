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

SELECT plan(106);

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
  ('u_invited_a', '99999999-9999-4999-8999-999999999999');

CREATE OR REPLACE FUNCTION pg_temp.uid(text) RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT v FROM t_ids WHERE k = $1 $$;

INSERT INTO auth.users (id, email)
SELECT v, k || '@example.test' FROM t_ids WHERE k LIKE 'u\_%';

INSERT INTO public.dealers (id, name) VALUES
  (pg_temp.uid('dealer_a'), 'Dealer A'),
  (pg_temp.uid('dealer_b'), 'Dealer B');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status) VALUES
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'),    'owner',    'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_readonly_a'), 'readonly', 'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_invited_a'),  'owner',    'invited'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_multi_ab'),   'owner',    'active'),
  (pg_temp.uid('dealer_b'), pg_temp.uid('u_multi_ab'),   'owner',    'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_promoted'),   'readonly', 'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_demoted'),    'owner',    'active');

INSERT INTO public.dealer_staff (dealer_id, user_id, role, status) VALUES
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_promoted'), 'owner',    'active'),
  (pg_temp.uid('dealer_a'), pg_temp.uid('u_demoted'),  'readonly', 'active');

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

CREATE OR REPLACE FUNCTION pg_temp.call(p_dealer uuid, p_actor uuid, p_num text, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.save_estimate_from_wizard(p_dealer, p_actor, p_num, p_payload);
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
    WHERE oid = 'public.save_estimate_from_wizard(uuid,uuid,text,jsonb)'::regprocedure),
  'RPC ACL is explicit (not default, which would imply PUBLIC EXECUTE)');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid = 'public.save_estimate_from_wizard(uuid,uuid,text,jsonb)'::regprocedure
     AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
  'PUBLIC holds no EXECUTE on the RPC');
SELECT ok(NOT has_function_privilege('authenticated',
  'public.save_estimate_from_wizard(uuid,uuid,text,jsonb)', 'EXECUTE'),
  'authenticated holds no EXECUTE on the RPC');
SELECT ok(NOT has_function_privilege('anon',
  'public.save_estimate_from_wizard(uuid,uuid,text,jsonb)', 'EXECUTE'),
  'anon holds no EXECUTE on the RPC');
SELECT ok(has_function_privilege('service_role',
  'public.save_estimate_from_wizard(uuid,uuid,text,jsonb)', 'EXECUTE'),
  'service_role holds EXECUTE on the RPC');

-- ═══ 2. Actor authorization ════════════════════════════════════════════════
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), NULL, 'E-1', pg_temp.payload()) $$,
  'UNAUTHENTICATED', 'null actor -> UNAUTHENTICATED');
SELECT throws_matching($$ SELECT pg_temp.call(NULL, pg_temp.uid('u_owner_a'), 'E-1', pg_temp.payload()) $$,
  'DEALER_CONTEXT_REQUIRED', 'null dealer -> DEALER_CONTEXT_REQUIRED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), '   ', pg_temp.payload()) $$,
  'ESTIMATE_NUMBER_FAILED', 'blank estimate number -> ESTIMATE_NUMBER_FAILED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_none'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'no active membership -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_invited_a'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'invited membership -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_multi_ab'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'two active memberships -> PERMISSION_DENIED (global ambiguity rule)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_b'), pg_temp.uid('u_multi_ab'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'ambiguity is not resolved by naming the other dealer either');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_b'), pg_temp.uid('u_owner_a'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'dealer mismatch -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_readonly_a'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'readonly -> PERMISSION_DENIED');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_demoted'), 'E-1', pg_temp.payload()) $$,
  'PERMISSION_DENIED', 'active dealer_staff readonly DEMOTES an owner membership');
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_promoted'), 'E-PROMO', pg_temp.payload('promotedkey000001')) $$,
  'active dealer_staff owner PROMOTES a readonly membership');
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-OK1', pg_temp.payload('ownerkey00000001')) $$,
  'owner saves successfully');

-- ═══ 3. Idempotency key format ═════════════════════════════════════════════
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-2',
       pg_temp.payload() #- '{idempotencyKey}') $$,
  'VALIDATION_ERROR', 'missing idempotency key -> VALIDATION_ERROR');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-2', pg_temp.payload('')) $$,
  'VALIDATION_ERROR', 'empty idempotency key -> VALIDATION_ERROR (102 silently disabled idempotency)');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-2', pg_temp.payload(repeat('a',15))) $$,
  'VALIDATION_ERROR', '15-char key -> VALIDATION_ERROR');
SELECT lives_ok(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-16', pg_temp.payload(repeat('b',16))) $$,
  '16-char key accepted');
SELECT lives_ok(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-64', pg_temp.payload(repeat('c',64))) $$,
  '64-char key accepted');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-2', pg_temp.payload(repeat('d',65))) $$,
  'VALIDATION_ERROR', '65-char key -> VALIDATION_ERROR');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-2', pg_temp.payload('aaaaaaaaaaaaaaa!')) $$,
  'VALIDATION_ERROR', 'illegal character in key -> VALIDATION_ERROR');

-- ═══ 4. Exact replay: ZERO additional rows ═════════════════════════════════
CREATE TEMP TABLE t_counts (k text PRIMARY KEY, c bigint, e bigint, v bigint, i bigint);
SELECT lives_ok(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-REPLAY',
       pg_temp.payload('replaykey0000001')) $$,
  'baseline save for the replay case succeeds');
INSERT INTO t_counts SELECT 'before',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);

SELECT is(
  (pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-REPLAY-2', pg_temp.payload('replaykey0000001')) ->> 'idempotent_replay'),
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
  (pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-R3',
     jsonb_set(pg_temp.payload('replaykey0000001'), '{metadata,draftLastUpdatedAt}',
               '"2026-09-09T09:09:09.000Z"')) ->> 'idempotent_replay'),
  'true', 'a different draftLastUpdatedAt is still an exact replay');

-- Numeric scale is normalized before hashing.
SELECT is(
  (pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-R4',
     jsonb_set(pg_temp.payload('replaykey0000001'), '{pricingSnapshot,subtotal}', '5000.00')) ->> 'idempotent_replay'),
  'true', '5000 and 5000.00 fingerprint identically');

-- ═══ 5. Conflict: any material difference ══════════════════════════════════
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C1',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{notes,internalMemo}', '"changed"')) $$,
  'DUPLICATE_SUBMISSION', 'changed internalMemo -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C2',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{customer,name}', '"別人"')) $$,
  'DUPLICATE_SUBMISSION', 'changed customer name -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C3',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{vehicle,plateNumber}', '"品川300"')) $$,
  'DUPLICATE_SUBMISSION', 'changed vehicle plate -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C4',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{services,0,manualPricingIdentity}', '"maintenance:other"')) $$,
  'DUPLICATE_SUBMISSION', 'changed service identity -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C5',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{services,0,lineMetadata}', '{"x":"1"}')) $$,
  'DUPLICATE_SUBMISSION', 'changed lineMetadata -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C6',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{nonPriceableSelections}',
                 '[{"category":"other","identity":"x","label":"L"}]')) $$,
  'DUPLICATE_SUBMISSION', 'changed nonPriceableSelections -> DUPLICATE_SUBMISSION');
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C7',
       jsonb_set(pg_temp.payload('replaykey0000001'), '{metadata,previewConfirmed}', 'false')) $$,
  'DUPLICATE_SUBMISSION', 'changed metadata.previewConfirmed -> DUPLICATE_SUBMISSION');

-- SAME grand total, DIFFERENT content: the direct regression guard for
-- migration 102's total-only comparison.
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-C8',
       jsonb_set(jsonb_set(pg_temp.payload('replaykey0000001'),
         '{services,0,unitPrice}', '4000'), '{services,0,lineTotal}', '4000')) $$,
  'DUPLICATE_SUBMISSION', 'same grandTotal but different lines -> DUPLICATE_SUBMISSION');

-- ═══ 6. Numeric / JSON domains — no invented defaults ══════════════════════
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N1',
  pg_temp.payload('numkey0000000001') #- '{pricingSnapshot,subtotal}') $$,
  'VALIDATION_ERROR', 'absent subtotal -> VALIDATION_ERROR (102 coerced to 0)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N2',
  pg_temp.payload('numkey0000000001') #- '{pricingSnapshot,taxRatePercent}') $$,
  'VALIDATION_ERROR', 'absent taxRatePercent -> VALIDATION_ERROR (102 invented 10)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N3',
  pg_temp.payload('numkey0000000001') #- '{services,0,quantity}') $$,
  'VALIDATION_ERROR', 'absent quantity -> VALIDATION_ERROR (102 invented 1)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N4',
  pg_temp.payload('numkey0000000001') #- '{services,0,lineTotal}') $$,
  'VALIDATION_ERROR', 'absent lineTotal -> VALIDATION_ERROR (102 coerced to 0)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N5',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,subtotal}', '"5000"')) $$,
  'VALIDATION_ERROR', 'numeric STRING subtotal -> VALIDATION_ERROR, no raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N6',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{services,0,quantity}', '"1"')) $$,
  'VALIDATION_ERROR', 'numeric STRING quantity -> VALIDATION_ERROR, no raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N7',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,grandTotal}', '-1')) $$,
  'VALIDATION_ERROR', 'negative grandTotal -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N8',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,subtotal}', '100.005')) $$,
  'VALIDATION_ERROR', 'scale > 2 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N9',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,grandTotal}', '1000000000001')) $$,
  'VALIDATION_ERROR', 'value above 1e12 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N10',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{services,0,quantity}', '0')) $$,
  'VALIDATION_ERROR', 'zero quantity -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N11',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,taxRatePercent}', '101')) $$,
  'VALIDATION_ERROR', 'taxRatePercent above 100 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N12',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{pricingSnapshot,completeness}', '"partial"')) $$,
  'PRICING_INCOMPLETE', 'incomplete pricing -> PRICING_INCOMPLETE');

-- Required containers are required, never invented.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N13',
  pg_temp.payload('numkey0000000001') #- '{nonPriceableSelections}') $$,
  'VALIDATION_ERROR', 'absent nonPriceableSelections -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N14',
  pg_temp.payload('numkey0000000001') #- '{services,0,optionReferenceIds}') $$,
  'VALIDATION_ERROR', 'absent optionReferenceIds -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-N15',
  jsonb_set(pg_temp.payload('numkey0000000001'), '{services,0,lineMetadata}', '{"a":{"b":1}}')) $$,
  'VALIDATION_ERROR', 'nested lineMetadata -> VALIDATION_ERROR');

-- ═══ 6b. Explicit-null trade rate, presence, and scale parity ═════════════
-- The canonical payload carries an EXPLICIT null tradeRatePercent.
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-TR1',
  pg_temp.payload('traderatekey0001')) $$,
  'explicit null tradeRatePercent saves successfully');
SELECT is((SELECT c.trade_discount_pct FROM public.customers c
            JOIN public.estimates e ON e.customer_id = c.id
           WHERE e.idempotency_key = 'traderatekey0001'),
  0::numeric, 'explicit null tradeRatePercent persists as the canonical 0');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-TR2',
  pg_temp.payload('traderatekey0002') #- '{customer,tradeRatePercent}') $$,
  'VALIDATION_ERROR',
  'a MISSING tradeRatePercent key is rejected (absence is not explicit null)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-TR3',
  jsonb_set(pg_temp.payload('traderatekey0003'), '{customer,tradeRatePercent}', '10.123')) $$,
  'VALIDATION_ERROR',
  'tradeRatePercent 10.123 is REJECTED, never silently rounded by numeric(5,2)');
SELECT lives_ok($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-TR4',
  jsonb_set(pg_temp.payload('traderatekey0004'), '{customer,tradeRatePercent}', '12.50')) $$,
  'a valid scale-2 tradeRatePercent is accepted');

-- Other REQUIRED nullable keys: absence must be rejected, not read as null.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-PK1',
  pg_temp.payload('presencekey00001') #- '{customer,closingDay}') $$,
  'VALIDATION_ERROR', 'missing closingDay key is rejected');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-PK2',
  pg_temp.payload('presencekey00002') #- '{customer,paymentDay}') $$,
  'VALIDATION_ERROR', 'missing paymentDay key is rejected');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-PK3',
  pg_temp.payload('presencekey00003') #- '{vehicle,registrationDate}') $$,
  'VALIDATION_ERROR', 'missing registrationDate key is rejected');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-PK4',
  pg_temp.payload('presencekey00004') #- '{vehicle,inspectionExpiry}') $$,
  'VALIDATION_ERROR', 'missing inspectionExpiry key is rejected');

-- Tax-rate scale parity: 10.123 must not persist while fingerprinting as 10.12.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-TX1',
  jsonb_set(pg_temp.payload('taxscalekey00001'), '{pricingSnapshot,taxRatePercent}', '10.123')) $$,
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
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F1',
  pg_temp.payload('failclosedkey001') #- '{services}') $$,
  'VALIDATION_ERROR', 'absent root services -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F2',
  jsonb_set(pg_temp.payload('failclosedkey001'), '{services}', '{}'::jsonb)) $$,
  'VALIDATION_ERROR',
  'services as an OBJECT -> VALIDATION_ERROR (type proven before jsonb_array_length)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F3',
  pg_temp.payload('failclosedkey001') #- '{notes}') $$,
  'VALIDATION_ERROR', 'absent root notes -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F4',
  pg_temp.payload('failclosedkey001') #- '{metadata}') $$,
  'VALIDATION_ERROR', 'absent root metadata -> VALIDATION_ERROR');

-- Required pricing sub-containers.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F5',
  pg_temp.payload('failclosedkey001') #- '{pricingSnapshot,warnings}') $$,
  'VALIDATION_ERROR', 'absent pricingSnapshot.warnings -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F6',
  pg_temp.payload('failclosedkey001') #- '{pricingSnapshot,errors}') $$,
  'VALIDATION_ERROR', 'absent pricingSnapshot.errors -> VALIDATION_ERROR');

-- Required intent containers (both are persisted as NOT NULL jsonb columns).
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F7',
  pg_temp.payload('failclosedkey001') #- '{discountIntent}') $$,
  'VALIDATION_ERROR', 'absent discountIntent -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F8',
  pg_temp.payload('failclosedkey001') #- '{couponIntent}') $$,
  'VALIDATION_ERROR', 'absent couponIntent -> VALIDATION_ERROR');

-- Required customer fields.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F9',
  pg_temp.payload('failclosedkey001') #- '{customer,accountsReceivableAllowed}') $$,
  'VALIDATION_ERROR',
  'absent customer.accountsReceivableAllowed -> VALIDATION_ERROR (never invented false)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F10',
  pg_temp.payload('failclosedkey001') #- '{customer,name}') $$,
  'VALIDATION_ERROR', 'absent new-customer name -> VALIDATION_ERROR');

-- Required service-line fields.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F11',
  pg_temp.payload('failclosedkey001') #- '{services,0,label}') $$,
  'VALIDATION_ERROR', 'absent service label -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F12',
  pg_temp.payload('failclosedkey001') #- '{services,0,lineMetadata}') $$,
  'VALIDATION_ERROR', 'absent service lineMetadata -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F17',
  pg_temp.payload('failclosedkey001') #- '{services,0,wizardCategory}') $$,
  'VALIDATION_ERROR', 'absent service wizardCategory -> VALIDATION_ERROR');

-- Reduction boundary: totals are stored VERBATIM and never recomputed, so an
-- incoherent snapshot has no downstream corrector.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F13',
  jsonb_set(pg_temp.payload('failclosedkey001'), '{pricingSnapshot,discountTotal}', '6000')) $$,
  'VALIDATION_ERROR', 'discountTotal greater than subtotal -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F14',
  jsonb_set(pg_temp.payload('failclosedkey001'), '{pricingSnapshot,couponTotal}', '6000')) $$,
  'VALIDATION_ERROR', 'couponTotal greater than subtotal -> VALIDATION_ERROR');

-- Exact metadata and currency contract, both validated before fingerprinting.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F15',
  pg_temp.payload('failclosedkey001') #- '{metadata,source}') $$,
  'VALIDATION_ERROR', 'absent metadata.source -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-F16',
  pg_temp.payload('failclosedkey001') #- '{pricingSnapshot,currency}') $$,
  'VALIDATION_ERROR', 'absent pricingSnapshot.currency -> VALIDATION_ERROR');

-- ═══ 7. Identity, casts and calendar validity ══════════════════════════════
-- Every one of these would have leaked a raw SQLSTATE under migration 102.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I1',
  jsonb_set(jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', '"not-a-uuid"')) $$,
  'VALIDATION_ERROR', 'malformed customerId -> VALIDATION_ERROR, never raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I2',
  jsonb_set(jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', to_jsonb(repeat('-',36)))) $$,
  'VALIDATION_ERROR', '36 hyphens is rejected by the STRICT grouped UUID shape');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I3',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{vehicle,registrationDate}', '"2026-02-31"')) $$,
  'VALIDATION_ERROR', 'calendar-invalid 2026-02-31 -> VALIDATION_ERROR, never raw 22007/22008');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I4',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{vehicle,inspectionExpiry}', '"2026-13-01"')) $$,
  'VALIDATION_ERROR', 'month 13 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I5',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,closingDay}', '"abc"')) $$,
  'VALIDATION_ERROR', 'non-numeric closingDay -> VALIDATION_ERROR, never raw 22P02');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I6',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,paymentDay}', '"32"')) $$,
  'VALIDATION_ERROR', 'day 32 -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I7',
  pg_temp.payload('idkey00000000001') #- '{customer,isBusiness}') $$,
  'VALIDATION_ERROR', 'absent isBusiness -> VALIDATION_ERROR (never invented false)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I8',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{customer,tradeRatePercent}', '101')) $$,
  'VALIDATION_ERROR', 'tradeRatePercent above 100 -> VALIDATION_ERROR (never invented 0)');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I9',
  jsonb_set(jsonb_set(pg_temp.payload('idkey00000000001'), '{vehicle,maker}', '""'),
            '{vehicle,model}', '""')) $$,
  'VALIDATION_ERROR', 'new vehicle without maker or model -> VALIDATION_ERROR');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I10',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{services,0,category}', '"wheel"')) $$,
  'VALIDATION_ERROR', 'category outside the 093 set -> VALIDATION_ERROR, never raw 23514');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I11',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{services}',
    (pg_temp.payload() -> 'services') || (pg_temp.payload() -> 'services'))) $$,
  'VALIDATION_ERROR', 'duplicate lineId -> VALIDATION_ERROR, never raw 23505');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-I12',
  jsonb_set(pg_temp.payload('idkey00000000001'), '{services,0,pricingReferenceId}', '"cat-1"')) $$,
  'VALIDATION_ERROR', 'manual line carrying a catalog identity -> VALIDATION_ERROR');

-- Cross-tenant and vehicle/customer coherence.
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-X1',
  jsonb_set(jsonb_set(pg_temp.payload('xkey000000000001'), '{customer,mode}', '"existing"'),
            '{customer,customerId}', to_jsonb(pg_temp.rid('cust_b1')::text))) $$,
  'CUSTOMER_NOT_FOUND', 'cross-dealer customer -> CUSTOMER_NOT_FOUND');
SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-X2',
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.payload('xkey000000000001'),
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

SELECT throws_matching($$ SELECT pg_temp.call(pg_temp.uid('dealer_a'), pg_temp.uid('u_owner_a'), 'E-ROLL',
  jsonb_set(pg_temp.payload('rollbackkey00001'), '{services}',
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
--     A, owner_A, 'E-CONC-1', payload('conckey000000001'));
--   -- holds pg_advisory_xact_lock(A:conckey000000001); do NOT commit yet
--                                              SELECT save_estimate_from_wizard(
--                                                A, owner_A, 'E-CONC-2',
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
