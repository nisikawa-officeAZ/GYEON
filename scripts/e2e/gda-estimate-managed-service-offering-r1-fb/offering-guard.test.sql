-- ============================================================================
-- GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B pgTAP: direct-RPC managed-service
-- offering guard (C.9a), against a fresh disposable PostgreSQL 17 stack.
--
-- NOT EXECUTED IN THIS PHASE. Runs only inside a separately authorized fresh
-- disposable runtime, after setup.sh has replayed every baseline migration
-- plus the guard migration in order. Never against the linked, staging, or
-- production project.
--
-- Local fixtures only. No GYEON-order table, RPC name, fixture, or assertion
-- is reused; every dealer/customer/vehicle/service line and every assertion
-- below belongs to the Estimate Wizard managed-service offering contract.
--
-- ROLE DISCIPLINE
--   * public.save_estimate_from_wizard is service-role-only, so every RPC
--     call runs under SET LOCAL ROLE service_role, matching the repository's
--     own supabase/tests/estimate_wizard_atomic_save.test.sql convention.
--   * Fixture creation runs as the session (superuser/postgres) role before
--     any SET LOCAL ROLE, because auth.users and dealers are not writable by
--     the application roles.
-- ============================================================================

BEGIN;

CREATE SCHEMA r1b_pgtap;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA r1b_pgtap;
GRANT USAGE ON SCHEMA r1b_pgtap TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA r1b_pgtap TO authenticated, service_role;
SET LOCAL search_path = r1b_pgtap, pg_temp, public, auth, extensions;

SELECT plan(39);

-- ─── Fixtures ───────────────────────────────────────────────────────────────
CREATE TEMP TABLE t_ids (k text PRIMARY KEY, v uuid);
INSERT INTO t_ids (k, v) VALUES
  ('dealer_single',  '10101010-1010-4101-8101-101010101010'),
  ('u_single',       '20202020-2020-4202-8202-202020202020'),
  ('dealer_mixed',   '30303030-3030-4303-8303-303030303030'),
  ('u_mixed',        '40404040-4040-4404-8404-404040404040'),
  ('dealer_bare',    '50505050-5050-4505-8505-505050505050'),
  ('u_bare',         '60606060-6060-4606-8606-606060606060');

CREATE OR REPLACE FUNCTION pg_temp.uid(text) RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT v FROM t_ids WHERE k = $1 $$;

INSERT INTO auth.users (id, email)
SELECT v, k || '@example.test' FROM t_ids WHERE k LIKE 'u\_%';

INSERT INTO public.dealers (id, name) VALUES
  (pg_temp.uid('dealer_single'), 'R1B Dealer Single'),
  (pg_temp.uid('dealer_mixed'),  'R1B Dealer Mixed'),
  (pg_temp.uid('dealer_bare'),   'R1B Dealer Bare (zero offering rows)');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status) VALUES
  (pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), 'owner', 'active'),
  (pg_temp.uid('dealer_mixed'),  pg_temp.uid('u_mixed'),  'owner', 'active'),
  (pg_temp.uid('dealer_bare'),   pg_temp.uid('u_bare'),   'owner', 'active');

-- ─── Payload builders ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.payload(p_key text, p_category text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'idempotencyKey', p_key,
    'customer', jsonb_build_object(
      'mode','new','name','R1B Customer','phone','090-0000-0000','email','r1b@example.test',
      'postalCode','1000001','address','東京都','lineId','',
      'isBusiness', false, 'tradeRatePercent', null,
      'accountsReceivableAllowed', false, 'closingDay', null, 'paymentDay', null),
    'vehicle', jsonb_build_object(
      'mode','new','maker','TOYOTA','model','CROWN','grade','','vehicleCode','','vin','',
      'firstRegistration','','registrationDate','','inspectionExpiry','',
      'displacement','','color','','plateNumber','','bodySizeKey','M'),
    'services', jsonb_build_array(jsonb_build_object(
      'lineId','manual:' || p_category || ':line-a','category',p_category,
      'wizardCategory',p_category,'pricingSource','manual',
      'pricingReferenceId', null,'manualPricingIdentity', p_category || ':r1b-a',
      'pricingPolicy','manual_only','manualPricePolicy','required',
      'label','R1B Line A','description', null,
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

CREATE OR REPLACE FUNCTION pg_temp.two_category_payload(p_key text, p_category_1 text, p_category_2 text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_set(
           pg_temp.payload(p_key, p_category_1),
           '{services}',
           (pg_temp.payload(p_key, p_category_1) -> 'services') ||
           jsonb_build_array(jsonb_set(
             pg_temp.payload(p_key, p_category_2) -> 'services' -> 0,
             '{lineId}', to_jsonb('manual:' || p_category_2 || ':line-b'))));
$$;

CREATE OR REPLACE FUNCTION pg_temp.call(p_dealer uuid, p_actor uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.save_estimate_from_wizard(p_dealer, p_actor, p_payload);
$$;

-- Server-owned lifecycle-revision reader for the zero-mutation proofs below.
-- Read under the SESSION (superuser) role via the established RESET ROLE /
-- SET LOCAL ROLE service_role toggle already used throughout this file for
-- direct dealer_service_offerings writes, so the assertion's outcome depends
-- only on the RPC's own behavior and never on whether service_role happens
-- to hold a SELECT grant on this table.
CREATE OR REPLACE FUNCTION pg_temp.lifecycle_rev(p_dealer uuid)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT current_configuration_revision FROM public.dealer_wizard_catalog_lifecycle WHERE dealer_id = p_dealer;
$$;
CREATE TEMP TABLE t_life_counts (k text PRIMARY KEY, l bigint);

GRANT SELECT ON t_ids TO service_role;

SET LOCAL ROLE service_role;

-- ═══ 1. Five exact category -> family mappings, missing / false / true ════
-- window -> window_film
RESET ROLE;
INSERT INTO t_life_counts VALUES ('before_window_missing_reject', pg_temp.lifecycle_rev(pg_temp.uid('dealer_single')));
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bwindowkey0001', 'window')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'window: missing row -> service-not-offered');
RESET ROLE;
INSERT INTO t_life_counts VALUES ('after_window_missing_reject', pg_temp.lifecycle_rev(pg_temp.uid('dealer_single')));
SELECT is((SELECT l FROM t_life_counts WHERE k='after_window_missing_reject'), (SELECT l FROM t_life_counts WHERE k='before_window_missing_reject'),
  'the missing-row rejection does not advance the dealer''s configuration-revision lifecycle');
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled) VALUES (pg_temp.uid('dealer_single'), 'window_film', false);
INSERT INTO t_life_counts VALUES ('before_window_disabled_reject', pg_temp.lifecycle_rev(pg_temp.uid('dealer_single')));
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bwindowkey0001', 'window')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'window: enabled=false -> service-not-offered');
RESET ROLE;
INSERT INTO t_life_counts VALUES ('after_window_disabled_reject', pg_temp.lifecycle_rev(pg_temp.uid('dealer_single')));
SELECT is((SELECT l FROM t_life_counts WHERE k='after_window_disabled_reject'), (SELECT l FROM t_life_counts WHERE k='before_window_disabled_reject'),
  'the enabled=false rejection does not advance the dealer''s configuration-revision lifecycle (snapshot taken AFTER the offering-disable commit)');
UPDATE public.dealer_service_offerings SET enabled = true WHERE dealer_id = pg_temp.uid('dealer_single') AND family = 'window_film';
SET LOCAL ROLE service_role;
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bwindowkey0001', 'window')) ->> 'idempotent_replay'),
  'false', 'window -> window_film: enabled=true permits a genuinely new save');

-- ppf -> ppf
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bppfkey00000001', 'ppf')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'ppf: missing row -> service-not-offered');
RESET ROLE;
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled) VALUES (pg_temp.uid('dealer_single'), 'ppf', false);
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bppfkey00000001', 'ppf')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'ppf: enabled=false -> service-not-offered');
RESET ROLE;
UPDATE public.dealer_service_offerings SET enabled = true WHERE dealer_id = pg_temp.uid('dealer_single') AND family = 'ppf';
SET LOCAL ROLE service_role;
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bppfkey00000001', 'ppf')) ->> 'idempotent_replay'),
  'false', 'ppf -> ppf: enabled=true permits a genuinely new save');

-- maintenance -> maintenance
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bmaintkey000001', 'maintenance')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'maintenance: missing row -> service-not-offered');
RESET ROLE;
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled) VALUES (pg_temp.uid('dealer_single'), 'maintenance', false);
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bmaintkey000001', 'maintenance')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'maintenance: enabled=false -> service-not-offered');
RESET ROLE;
UPDATE public.dealer_service_offerings SET enabled = true WHERE dealer_id = pg_temp.uid('dealer_single') AND family = 'maintenance';
SET LOCAL ROLE service_role;
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bmaintkey000001', 'maintenance')) ->> 'idempotent_replay'),
  'false', 'maintenance -> maintenance: enabled=true permits a genuinely new save');

-- roomclean -> room_cleaning
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1broomckey000001', 'roomclean')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'roomclean: missing row -> service-not-offered');
RESET ROLE;
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled) VALUES (pg_temp.uid('dealer_single'), 'room_cleaning', false);
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1broomckey000001', 'roomclean')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'roomclean: enabled=false -> service-not-offered');
RESET ROLE;
UPDATE public.dealer_service_offerings SET enabled = true WHERE dealer_id = pg_temp.uid('dealer_single') AND family = 'room_cleaning';
SET LOCAL ROLE service_role;
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1broomckey000001', 'roomclean')) ->> 'idempotent_replay'),
  'false', 'roomclean -> room_cleaning: enabled=true permits a genuinely new save');

-- carwash -> car_wash
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bcarwkey0000001', 'carwash')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'carwash: missing row -> service-not-offered');
RESET ROLE;
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled) VALUES (pg_temp.uid('dealer_single'), 'car_wash', false);
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bcarwkey0000001', 'carwash')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'carwash: enabled=false -> service-not-offered');
RESET ROLE;
UPDATE public.dealer_service_offerings SET enabled = true WHERE dealer_id = pg_temp.uid('dealer_single') AND family = 'car_wash';
SET LOCAL ROLE service_role;
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1bcarwkey0000001', 'carwash')) ->> 'idempotent_replay'),
  'false', 'carwash -> car_wash: enabled=true permits a genuinely new save');

-- ═══ 2. Mixed payload rejects when ANY required family is OFF; zero writes ═
RESET ROLE;
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled) VALUES
  (pg_temp.uid('dealer_mixed'), 'ppf', true),
  (pg_temp.uid('dealer_mixed'), 'window_film', true);
-- maintenance carries NO row for dealer_mixed: absence means OFF.
SET LOCAL ROLE service_role;
CREATE TEMP TABLE t_mixed_counts (k text PRIMARY KEY, c bigint, e bigint, v bigint, i bigint);
INSERT INTO t_mixed_counts SELECT 'before',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);
RESET ROLE;
INSERT INTO t_life_counts VALUES ('before_mixed_reject', pg_temp.lifecycle_rev(pg_temp.uid('dealer_mixed')));
SET LOCAL ROLE service_role;
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_mixed'), pg_temp.uid('u_mixed'),
       pg_temp.two_category_payload('r1bmixedkey000001', 'ppf', 'maintenance')) $$,
  '^VALIDATION_ERROR: service-not-offered$',
  'mixed ppf(on)+maintenance(off) payload rejects on the one OFF family');
RESET ROLE;
INSERT INTO t_life_counts VALUES ('after_mixed_reject', pg_temp.lifecycle_rev(pg_temp.uid('dealer_mixed')));
SELECT is((SELECT l FROM t_life_counts WHERE k='after_mixed_reject'), (SELECT l FROM t_life_counts WHERE k='before_mixed_reject'),
  'the mixed-family rejection does not advance the dealer''s configuration-revision lifecycle');
SET LOCAL ROLE service_role;
INSERT INTO t_mixed_counts SELECT 'after',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);
SELECT is((SELECT c FROM t_mixed_counts WHERE k='after'), (SELECT c FROM t_mixed_counts WHERE k='before'), 'mixed rejection wrote no customer');
SELECT is((SELECT v FROM t_mixed_counts WHERE k='after'), (SELECT v FROM t_mixed_counts WHERE k='before'), 'mixed rejection wrote no vehicle');
SELECT is((SELECT e FROM t_mixed_counts WHERE k='after'), (SELECT e FROM t_mixed_counts WHERE k='before'), 'mixed rejection wrote no estimate');
SELECT is((SELECT i FROM t_mixed_counts WHERE k='after'), (SELECT i FROM t_mixed_counts WHERE k='before'), 'mixed rejection wrote no items');

-- ═══ 3. coating / other remain outside this contract ═══════════════════════
-- dealer_bare carries ZERO dealer_service_offerings rows at all.
SELECT is((pg_temp.call(pg_temp.uid('dealer_bare'), pg_temp.uid('u_bare'), pg_temp.payload('r1bcoatingkey0001', 'coating')) ->> 'idempotent_replay'),
  'false', 'coating saves with zero dealer_service_offerings rows: unmanaged, unaffected');
SELECT is((pg_temp.call(pg_temp.uid('dealer_bare'), pg_temp.uid('u_bare'), pg_temp.payload('r1botherkey0000001', 'other')) ->> 'idempotent_replay'),
  'false', 'other saves with zero dealer_service_offerings rows: unmanaged, unaffected');
SELECT is((pg_temp.call(pg_temp.uid('dealer_bare'), pg_temp.uid('u_bare'), pg_temp.payload('r1binteriorkey0001', 'interior')) ->> 'idempotent_replay'),
  'false', 'interior saves with zero dealer_service_offerings rows: unmanaged, unaffected');
SELECT is((pg_temp.call(pg_temp.uid('dealer_bare'), pg_temp.uid('u_bare'), pg_temp.payload('r1bglasskey00000001', 'glass')) ->> 'idempotent_replay'),
  'false', 'glass saves with zero dealer_service_offerings rows: unmanaged, unaffected');

-- ═══ 4. Another dealer's enabled row never authorizes the caller ══════════
-- dealer_mixed has ppf ENABLED; dealer_bare has no row for any family.
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_bare'), pg_temp.uid('u_bare'), pg_temp.payload('r1bcrosstenant001', 'ppf')) $$,
  '^VALIDATION_ERROR: service-not-offered$',
  'dealer_mixed''s enabled ppf row does not authorize dealer_bare''s save');

-- ═══ 5. Exact replay keeps its original success after a later disable ═════
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1breplaykey00001', 'maintenance')) ->> 'idempotent_replay'),
  'false', 'baseline save for the replay-after-disable case succeeds while maintenance is enabled');
CREATE TEMP TABLE t_replay_counts (k text PRIMARY KEY, c bigint, e bigint, v bigint, i bigint);
INSERT INTO t_replay_counts SELECT 'before',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);
RESET ROLE;
UPDATE public.dealer_service_offerings SET enabled = false WHERE dealer_id = pg_temp.uid('dealer_single') AND family = 'maintenance';
INSERT INTO t_life_counts VALUES ('before_replay_after_disable', pg_temp.lifecycle_rev(pg_temp.uid('dealer_single')));
SET LOCAL ROLE service_role;
SELECT is((pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'), pg_temp.payload('r1breplaykey00001', 'maintenance')) ->> 'idempotent_replay'),
  'true', 'exact replay after a later disable still returns the original success');
RESET ROLE;
INSERT INTO t_life_counts VALUES ('after_replay_after_disable', pg_temp.lifecycle_rev(pg_temp.uid('dealer_single')));
SELECT is((SELECT l FROM t_life_counts WHERE k='after_replay_after_disable'), (SELECT l FROM t_life_counts WHERE k='before_replay_after_disable'),
  'the exact replay after a later disable does not advance the dealer''s configuration-revision lifecycle (snapshot taken AFTER the disable commit)');
SET LOCAL ROLE service_role;
INSERT INTO t_replay_counts SELECT 'after',
  (SELECT count(*) FROM public.customers), (SELECT count(*) FROM public.estimates),
  (SELECT count(*) FROM public.vehicles),  (SELECT count(*) FROM public.estimate_items);
SELECT is((SELECT c FROM t_replay_counts WHERE k='after'), (SELECT c FROM t_replay_counts WHERE k='before'), 'the disabled-offering replay wrote no customer');
SELECT is((SELECT e FROM t_replay_counts WHERE k='after'), (SELECT e FROM t_replay_counts WHERE k='before'), 'the disabled-offering replay wrote no estimate');
SELECT is((SELECT v FROM t_replay_counts WHERE k='after'), (SELECT v FROM t_replay_counts WHERE k='before'), 'the disabled-offering replay wrote no vehicle');
SELECT is((SELECT i FROM t_replay_counts WHERE k='after'), (SELECT i FROM t_replay_counts WHERE k='before'), 'the disabled-offering replay wrote no items');

-- ═══ 6. Same key + materially different payload stays DUPLICATE_SUBMISSION,
--        even though the relevant family is now OFF ═══════════════════════
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_single'), pg_temp.uid('u_single'),
       jsonb_set(pg_temp.payload('r1breplaykey00001', 'maintenance'), '{customer,name}', '"R1B Different Customer"')) $$,
  'DUPLICATE_SUBMISSION',
  'same key + different payload remains DUPLICATE_SUBMISSION precedence even though maintenance is now OFF');

-- ═══ 7. Disabled-family rejection allocates nothing, including a number ═══
CREATE OR REPLACE FUNCTION pg_temp.seq(p_dealer uuid, p_fy integer DEFAULT 0)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT s.current_number FROM public.document_sequences s
                    WHERE s.dealer_id = p_dealer
                      AND s.sequence_type = 'estimate'
                      AND s.fiscal_year = p_fy), 0)::bigint;
$$;
CREATE TEMP TABLE t_zero_seq (k text PRIMARY KEY, v bigint);
INSERT INTO t_zero_seq VALUES ('before', pg_temp.seq(pg_temp.uid('dealer_bare')));
SELECT throws_matching(
  $$ SELECT pg_temp.call(pg_temp.uid('dealer_bare'), pg_temp.uid('u_bare'), pg_temp.payload('r1bzeromutkey0001', 'ppf')) $$,
  '^VALIDATION_ERROR: service-not-offered$', 'a fresh missing-row rejection on dealer_bare allocates zero document numbers');
SELECT is(pg_temp.seq(pg_temp.uid('dealer_bare')), (SELECT v FROM t_zero_seq WHERE k='before'),
  'the rejection allocated zero document numbers');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.estimates WHERE dealer_id = pg_temp.uid('dealer_bare') AND idempotency_key = 'r1bzeromutkey0001'),
  'the rejection left no idempotency/estimate record for that key');

SELECT * FROM finish();
ROLLBACK;

-- ============================================================================
-- R1B_EXTERNAL_CONCURRENCY_GATE
--
-- NOT COVERED ABOVE and NOT REPORTED AS PASSED. The two required deterministic
-- offering/save interleavings require two separate OS-process database
-- connections plus a third observer and are proved by concurrency.mjs, never
-- by this single-session pgTAP file:
--
--   1. Disable-before-snapshot: commit enabled=false for the relevant family,
--      build a payload carrying the current post-change configuration
--      revision, then start a fresh direct RPC save. It MUST return
--      'VALIDATION_ERROR: service-not-offered'; observer counts for customer,
--      vehicle, estimate, item, document number, and idempotency MUST remain
--      unchanged.
--   2. Snapshot-before-disable: begin with the family enabled. Hold the
--      target estimate's document_sequences row so the save passes C.9a and
--      blocks at the first C.10 number-allocation write. Prove the save
--      backend is waiting there (distinct backend PID, pg_stat_activity
--      evidence), commit the offering disable from a separate connection,
--      release the number-row lock, and require the save to complete
--      successfully from its earlier guard snapshot -- one complete estimate
--      with every expected item and no partial/torn state.
-- ============================================================================
