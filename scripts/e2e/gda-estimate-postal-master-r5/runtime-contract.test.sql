-- GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5 fresh-lane runtime-contract pgTAP.
--
-- STATIC/UNEXECUTED CANDIDATE. This file is authored as part of the R5
-- harness static source candidate; it is not run, and no database/Supabase/
-- CLI action occurs while authoring it. It runs later, in the fresh lane
-- only, immediately after `supabase/tests/jp_postal_master_rpc.test.sql`,
-- and proves exactly the runtime facts that file does NOT already cover:
--
--   1. the earlier GYEON-order private-function/RLS contract
--      (private.gyeon_order_v3_can_read_dealer / schema usage) survives the
--      postal migration's grant changes at RUNTIME, not merely in the
--      static text-contract test;
--   2. MASTER_UNAVAILABLE before any batch has ever been promoted;
--   3. a genuine multi-postal-code AMBIGUOUS forward result (two distinct
--      synthetic fixture addresses sharing one postal code), not merely the
--      distinct-address-reduction FOUND case already proven upstream;
--   4. a real runtime/request path reverse NOT_FOUND using synthetic
--      fixture data, plus a defensively bounded long-input probe;
--   5. active-batch filtering: a postal code that exists only in a
--      SUPERSEDED batch is not reachable through the lookup RPCs, and
--      becomes reachable again after rollback.
--
-- All fixture rows are synthetic and non-personal, following the same
-- actor-simulation pattern already accepted in
-- supabase/tests/jp_postal_master_rpc.test.sql: caller identity is
-- simulated by setting request.jwt.claim.sub / request.jwt.claims and
-- switching the transaction's local Postgres role.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = extensions, pg_temp, public, pg_catalog;

SELECT plan(20);

-- ===========================================================================
-- 01-04: earlier GYEON-order private-function/RLS contract is unaffected by
-- the postal migration's additive `grant usage on schema private to
-- service_role` and its object-scoped postal-table revokes.
-- ===========================================================================
SELECT has_function(
  'private', 'gyeon_order_v3_can_read_dealer', ARRAY['uuid'],
  '01 the earlier private.gyeon_order_v3_can_read_dealer(uuid) helper still exists'
);
SELECT is(
  has_function_privilege('authenticated', 'private.gyeon_order_v3_can_read_dealer(uuid)', 'EXECUTE'),
  true,
  '02 authenticated retains EXECUTE on private.gyeon_order_v3_can_read_dealer(uuid) (no shared-schema regression)'
);
SELECT is(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  true,
  '03 authenticated retains USAGE on the shared private schema (postal migration is additive-only)'
);
SELECT is(
  has_schema_privilege('service_role', 'private', 'USAGE'),
  true,
  '04 service_role holds the postal-added USAGE on the shared private schema'
);

-- ===========================================================================
-- Fixtures: one synthetic dealer + one active member, reusing the identity
-- pattern already accepted in jp_postal_master_rpc.test.sql, in a distinct
-- id block so this file never depends on state left by another test file.
-- ===========================================================================
CREATE TEMP TABLE rc_ids (k text PRIMARY KEY, v uuid NOT NULL);
INSERT INTO rc_ids (k, v) VALUES
  ('dealer', 'c9200000-0000-4000-8000-000000000001'),
  ('member', 'c9200000-0000-4000-8000-000000000101');

CREATE OR REPLACE FUNCTION pg_temp.rc_id(p_key text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT v FROM rc_ids WHERE k = p_key $$;

INSERT INTO auth.users (id, email) VALUES (pg_temp.rc_id('member'), 'member@rc.jpm.example.test');
INSERT INTO public.dealers (id, name) VALUES (pg_temp.rc_id('dealer'), 'RC Synthetic Dealer 〔GDA-R5-SYNTHETIC〕');
INSERT INTO public.dealer_members (dealer_id, user_id, role, status)
VALUES (pg_temp.rc_id('dealer'), pg_temp.rc_id('member'), 'owner', 'active');

CREATE OR REPLACE FUNCTION pg_temp.rc_act_as_member() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', pg_temp.rc_id('member')::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.rc_id('member')::text)::text, true);
  EXECUTE 'set local role authenticated';
END
$$;

-- pg_temp SECURITY DEFINER inspection helpers, defined before any
-- service_role switch (service_role holds zero direct table grants).
CREATE FUNCTION pg_temp.rc_batch_id(p_sha256 text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM private.jp_postal_import_batches WHERE sha256 = p_sha256
$$;

-- ===========================================================================
-- 05-06: MASTER_UNAVAILABLE before any batch has ever been promoted in this
-- fresh database.
-- ===========================================================================
SELECT pg_temp.rc_act_as_member();
SELECT is(
  ((public.jp_postal_master_lookup_forward('000-0040')) ->> 'result_code'),
  'MASTER_UNAVAILABLE',
  '05 forward lookup reports MASTER_UNAVAILABLE before any batch is ever promoted'
);
SELECT is(
  ((public.jp_postal_master_lookup_reverse('実験県〔GDA-R5-SYNTHETIC〕合成市〔GDA-R5-SYNTHETIC〕合成一丁目〔GDA-R5-SYNTHETIC〕1-1')) ->> 'result_code'),
  'MASTER_UNAVAILABLE',
  '06 reverse lookup reports MASTER_UNAVAILABLE before any batch is ever promoted'
);
RESET ROLE;

-- ===========================================================================
-- 07-10: batch RC-A -- two genuinely DIFFERENT specific addresses sharing one
-- postal code (true ambiguity, distinct from the accepted distinct-address
-- REDUCTION case already covered upstream) plus one uniquely resolvable
-- address for the later active-batch-filtering scenario.
-- ===========================================================================
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT (public.jp_postal_import_begin('2026-09-10'::date, repeat('c', 64), 3)) ->> 'result_code' = 'OK'),
  '07 begin succeeds for batch RC-A'
);
SELECT ok(
  (SELECT (public.jp_postal_import_append(
     pg_temp.rc_batch_id(repeat('c', 64)), 0,
     '[
        {"jisCode":"99992","oldPostalCode":"","postalCode":"0000010",
         "prefectureKana":"ｼﾞｯｹﾝｹﾝ","cityKana":"ｺﾞｳｾｲｼﾁｭｳｵｳｸ","townKana":"ｺﾞｳｾｲｶﾞｲｴﾝ",
         "prefectureKanji":"実験県〔GDA-R5-SYNTHETIC〕","cityKanji":"合成市中央区〔GDA-R5-SYNTHETIC〕","townKanji":"合成外苑〔GDA-R5-SYNTHETIC〕",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0"},
        {"jisCode":"99992","oldPostalCode":"","postalCode":"0000010",
         "prefectureKana":"ｼﾞｯｹﾝｹﾝ","cityKana":"ｺﾞｳｾｲｼﾁｭｳｵｳｸ","townKana":"ｺﾞｳｾｲｵｶ",
         "prefectureKanji":"実験県〔GDA-R5-SYNTHETIC〕","cityKanji":"合成市中央区〔GDA-R5-SYNTHETIC〕","townKanji":"合成丘〔GDA-R5-SYNTHETIC〕",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0"},
        {"jisCode":"99993","oldPostalCode":"","postalCode":"0000020",
         "prefectureKana":"ｶｸｳｹﾝ","cityKana":"ｶｸｳｼ","townKana":"ｶｸｳﾏﾁ",
         "prefectureKanji":"架空県〔GDA-R5-SYNTHETIC〕","cityKanji":"架空市〔GDA-R5-SYNTHETIC〕","townKanji":"架空町〔GDA-R5-SYNTHETIC〕",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0"}
      ]'::jsonb
   )) ->> 'result_code' = 'OK'),
  '08 append inserts the three RC-A synthetic rows'
);
SELECT ok(
  (SELECT (public.jp_postal_import_finalize(pg_temp.rc_batch_id(repeat('c', 64)))) ->> 'result_code' = 'OK'),
  '09 finalize promotes batch RC-A'
);
SELECT ok(
  (SELECT (public.jp_postal_import_status('2026-09-10'::date, repeat('c', 64), 3)) ->> 'is_active' = 'true'),
  '10 batch RC-A is now the active promoted generation'
);
RESET ROLE;

-- ===========================================================================
-- 11-14: real multi-postal-code AMBIGUOUS, real NOT_FOUND, and a defensively
-- bounded long-input reverse probe (bounded_input evidence item).
-- ===========================================================================
SELECT pg_temp.rc_act_as_member();
SELECT is(
  ((public.jp_postal_master_lookup_reverse('実験県〔GDA-R5-SYNTHETIC〕合成市中央区〔GDA-R5-SYNTHETIC〕合成外苑〔GDA-R5-SYNTHETIC〕1-1')) ->> 'result_code'),
  'FOUND',
  '11 reverse lookup resolves the first of the two truly distinct RC-A addresses'
);
SELECT is(
  ((public.jp_postal_master_lookup_reverse('実験県〔GDA-R5-SYNTHETIC〕合成市中央区〔GDA-R5-SYNTHETIC〕合成丘〔GDA-R5-SYNTHETIC〕2-2')) ->> 'result_code'),
  'FOUND',
  '12 reverse lookup resolves the second, genuinely different RC-A address'
);
SELECT is(
  ((public.jp_postal_master_lookup_forward('000-0010')) ->> 'result_code'),
  'AMBIGUOUS',
  '13 forward lookup reports AMBIGUOUS for a postal code shared by two genuinely different specific addresses'
);
SELECT is(
  ((public.jp_postal_master_lookup_reverse('未登録県〔GDA-R5-SYNTHETIC〕未登録市〔GDA-R5-SYNTHETIC〕に実在しない架空の町です')) ->> 'result_code'),
  'NOT_FOUND',
  '14 reverse lookup reports NOT_FOUND for a well-formed but genuinely absent address'
);
SELECT lives_ok(
  $$ SELECT public.jp_postal_master_lookup_reverse(repeat('架空', 2000)); $$,
  '15 reverse lookup never errors on an extreme-length input (prefix-candidate generation is bounded to 8 heads regardless of input length)'
);
RESET ROLE;

-- ===========================================================================
-- 16-20: active-batch filtering. Batch RC-B (a disjoint postal code) is
-- promoted and supersedes RC-A; RC-A's postal code must then be unreachable
-- through the lookup RPCs (not merely absent from a direct private-table
-- SELECT), and reachable again after rollback.
-- ===========================================================================
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT (public.jp_postal_import_begin('2026-09-11'::date, repeat('d', 64), 1)) ->> 'result_code' = 'OK'),
  '16 begin succeeds for the superseding batch RC-B'
);
SELECT ok(
  (SELECT (public.jp_postal_import_append(
     pg_temp.rc_batch_id(repeat('d', 64)), 0,
     '[{"jisCode":"99994","oldPostalCode":"","postalCode":"0000030",
        "prefectureKana":"ｺｳｼﾝｹﾝ","cityKana":"ｺｳｼﾝｼ","townKana":"ｺｳｼﾝﾁｮｳ",
        "prefectureKanji":"更新県〔GDA-R5-SYNTHETIC〕","cityKanji":"更新市〔GDA-R5-SYNTHETIC〕","townKanji":"更新町〔GDA-R5-SYNTHETIC〕",
        "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
        "updateFlag":"0","changeReasonCode":"0"}]'::jsonb
   )) ->> 'result_code' = 'OK'),
  '17 append inserts the one RC-B row'
);
SELECT ok(
  (SELECT (public.jp_postal_import_finalize(pg_temp.rc_batch_id(repeat('d', 64)))) ->> 'result_code' = 'OK'),
  '18 finalize promotes batch RC-B, which now supersedes RC-A as the active generation'
);
RESET ROLE;

SELECT pg_temp.rc_act_as_member();
SELECT is(
  ((public.jp_postal_master_lookup_forward('000-0020')) ->> 'result_code'),
  'NOT_FOUND',
  '19 repair-verification: RC-A''s postal code is unreachable through the lookup RPC once RC-B is the active batch (active-batch filtering)'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT (public.jp_postal_import_rollback(pg_temp.rc_batch_id(repeat('c', 64)))) ->> 'result_code' = 'OK'),
  '20 rollback repoints the active batch back to RC-A'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
