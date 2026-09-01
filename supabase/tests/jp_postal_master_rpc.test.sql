-- GDA-2A-OCR-POSTAL-MASTER-R2 pgTAP candidate for supabase/migrations/20260901001246_jp_postal_master.sql.
--
-- STATIC/UNEXECUTED CANDIDATE. This file is a source candidate for a LATER, separately authorized
-- disposable-DB gate (per the R2 directive section 9); it is not run, and no database/Supabase/CLI
-- action occurred while authoring or repairing it. It follows the actor-simulation pattern already
-- accepted in supabase/tests/grant_rls_role_matrix.test.sql: caller identity is simulated by setting
-- `request.jwt.claim.sub` / `request.jwt.claims` and switching the transaction's local Postgres
-- role, then evaluating SQL directly inside this transaction. This is a SQL/RLS claim simulation
-- only -- it is NOT evidence of a real Supabase Auth token or a real PostgREST request-scope
-- boundary. All postal/address fixture data below is synthetic and non-personal.
--
-- A1 repair (2026-09-01): the prior candidate declared an unused `fx_actor` fixture and called the
-- lookup RPCs after a bare `SET LOCAL ROLE authenticated` with no dealer/member row and no JWT claim,
-- so `public.wiz_is_any_active_member()` could never accurately return true and the "authenticated
-- member" behavioral assertions proved nothing about real member access. This file replaces that
-- pseudo-fixture with the same synthetic dealer/member/claim-simulation rows already accepted in
-- grant_rls_role_matrix.test.sql, so the active-member guard is exercised accurately for both a real
-- member and a genuine non-member (repair A1-8).
--
-- A2 repair (2026-09-01): four residual defects. (1) Several assertions directly SELECTed a
-- private.jp_postal_* table while `current_user = service_role`, which now holds zero direct table
-- grants -- those assertions now route through the pg_temp SECURITY DEFINER helpers defined below
-- the fixtures, never through a bare SELECT while service_role is active. (2) jp_postal_import_finalize
-- and jp_postal_import_rollback now both lock the singleton pointer FIRST, before any batch row, in
-- the same order, closing a preventable finalize/rollback deadlock cycle. (3) A second begin for a
-- still staged/validating identity now returns IMPORT_IN_PROGRESS instead of a resumable OK. (4) The
-- append row-payload validation now rejects NULL sequence, NULL/non-array rows, non-object elements,
-- and any element whose required field is missing or holds the wrong JSON scalar type.
--
-- A3 repair (2026-09-01): test 28 previously called jp_postal_import_begin a SECOND time for identity
-- `b` (already begun in test 27) inside a WITH clause, solely to recover batch_id ahead of the append
-- call. Under the accepted A2-3 contract, that second begin for a still-staged identity returns
-- IMPORT_IN_PROGRESS with no batch_id, so append would receive NULL and fail as UNKNOWN_BATCH -- the
-- fixture contradicted its own accepted contract. Test 28 now obtains the batch id already created by
-- test 27 through the existing pg_temp.jpm_batch_id(repeat('b', 64)) inspection helper instead of a
-- second begin. Test 27 remains the single fresh begin for identity `b`; the later already-promoted
-- replay (test 42) and the intentional identity-`i` conflict replay (tests 54-57) are unchanged.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = extensions, pg_temp, public, pg_catalog;

SELECT plan(65);

-- ===========================================================================
-- 01-08: schema, tables, columns, indexes
-- ===========================================================================
SELECT has_schema('private', '01 private schema exists');

SELECT has_table('private', 'jp_postal_import_batches', '02 private.jp_postal_import_batches exists');
SELECT has_table('private', 'jp_postal_master', '03 private.jp_postal_master exists');
SELECT has_table('private', 'jp_postal_active_batch', '04 private.jp_postal_active_batch exists');

SELECT has_column('private', 'jp_postal_master', 'postal_code_norm', '05 postal_code_norm column present');
SELECT has_column('private', 'jp_postal_master', 'address_key', '06 address_key column present');
SELECT has_column('private', 'jp_postal_master', 'address_prefix_head', '07 address_prefix_head column present');
SELECT has_column('private', 'jp_postal_master', 'is_non_specific_town', '08 is_non_specific_town column present');

SELECT has_index('private', 'jp_postal_master', 'jp_postal_master_batch_postal_idx',
  ARRAY['batch_id', 'postal_code_norm'], '09 forward-lookup index on (batch_id, postal_code_norm)');
SELECT has_index('private', 'jp_postal_master', 'jp_postal_master_batch_prefix_idx',
  ARRAY['batch_id', 'address_prefix_head'], '10 reverse-lookup prefilter index on (batch_id, address_prefix_head)');

-- ===========================================================================
-- 11-16: RLS enabled and no direct browser-or-service-role table grants
-- ===========================================================================
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private' AND c.relname = 'jp_postal_import_batches'),
  true, '11 jp_postal_import_batches has RLS enabled'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private' AND c.relname = 'jp_postal_master'),
  true, '12 jp_postal_master has RLS enabled'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private' AND c.relname = 'jp_postal_active_batch'),
  true, '13 jp_postal_active_batch has RLS enabled'
);

-- Repair A1-4: NO role -- including service_role -- may hold a direct table grant on any private
-- table; service_role writes only through the SECURITY DEFINER import RPCs.
SELECT is(
  (SELECT count(*)::bigint FROM information_schema.role_table_grants
    WHERE table_schema = 'private'
      AND grantee IN ('anon', 'authenticated', 'service_role', 'public')),
  0::bigint,
  '14 no anon/authenticated/service_role/public grant exists on any private schema table (repair A1-4)'
);

SELECT is(
  (SELECT count(*)::bigint FROM information_schema.role_table_grants
    WHERE table_schema = 'private' AND table_name = 'jp_postal_master'
      AND privilege_type IN ('UPDATE', 'DELETE')
      AND grantee IN ('anon', 'authenticated', 'service_role', 'public')),
  0::bigint,
  '15 jp_postal_master has no UPDATE/DELETE grant for any role (append-only)'
);

SELECT is(
  has_schema_privilege('anon', 'private', 'USAGE'),
  false, '16 anon has no USAGE privilege on the private schema'
);

-- ===========================================================================
-- 17-22: function existence and EXECUTE ACL boundary
-- ===========================================================================
SELECT has_function('public', 'jp_postal_master_lookup_forward', ARRAY['text'], '17 forward lookup RPC exists');
SELECT has_function('public', 'jp_postal_master_lookup_reverse', ARRAY['text'], '18 reverse lookup RPC exists');
SELECT has_function('public', 'jp_postal_import_begin', ARRAY['date', 'text', 'integer'], '19 import begin RPC exists');
SELECT has_function('public', 'jp_postal_import_rollback', ARRAY['uuid'], '20 import rollback RPC exists');

SELECT is(
  (SELECT count(*)::bigint FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'jp_postal_master_lookup_forward', 'jp_postal_master_lookup_reverse'
    ) AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  '21 anon has EXECUTE on neither lookup RPC'
);

SELECT is(
  (SELECT count(*)::bigint FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'jp_postal_import_begin', 'jp_postal_import_append', 'jp_postal_import_finalize', 'jp_postal_import_rollback'
    ) AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  0::bigint,
  '22 neither anon nor authenticated has EXECUTE on any of the four import RPCs'
);

-- ===========================================================================
-- 23: search_path pinning on every new SECURITY DEFINER function
-- ===========================================================================
SELECT is(
  (SELECT count(*)::bigint FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'jp_postal_master_lookup_forward', 'jp_postal_master_lookup_reverse',
        'jp_postal_import_begin', 'jp_postal_import_append', 'jp_postal_import_finalize', 'jp_postal_import_rollback'
      )
      AND p.prosecdef
      AND NOT (p.proconfig IS NOT NULL AND 'search_path=""' = ANY (p.proconfig))),
  0::bigint,
  '23 every one of the six new SECURITY DEFINER functions pins search_path to empty'
);

-- ===========================================================================
-- Fixtures (repair A1-8): one synthetic non-personal dealer, one ACTIVE member of
-- that dealer, and one genuine NON-member (no dealer_members row at all), plus
-- request-claim-simulation helpers mirroring the accepted
-- grant_rls_role_matrix.test.sql pattern, so `public.wiz_is_any_active_member()`
-- is exercised accurately for both a real member and a real non-member.
-- ===========================================================================
CREATE TEMP TABLE jpm_ids (k text PRIMARY KEY, v uuid NOT NULL);
INSERT INTO jpm_ids (k, v) VALUES
  ('dealer',     'c9100000-0000-4000-8000-000000000001'),
  ('member',     'c9100000-0000-4000-8000-000000000101'),
  ('non_member', 'c9100000-0000-4000-8000-000000000102');

CREATE OR REPLACE FUNCTION pg_temp.jpm_id(p_key text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT v FROM jpm_ids WHERE k = p_key $$;

INSERT INTO auth.users (id, email)
SELECT v, k || '@jpm.example.test' FROM jpm_ids WHERE k <> 'dealer';

INSERT INTO public.dealers (id, name) VALUES (pg_temp.jpm_id('dealer'), 'JPM Synthetic Dealer');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status) VALUES
  (pg_temp.jpm_id('dealer'), pg_temp.jpm_id('member'), 'owner', 'active');
-- 'non_member' deliberately has NO dealer_members row: it is a real authenticated actor who has
-- never joined any dealer, not merely an inactive/suspended one.

CREATE OR REPLACE FUNCTION pg_temp.jpm_act_as(p_user uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user::text)::text, true);
  EXECUTE 'set local role authenticated';
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.jpm_act_privileged() RETURNS void
LANGUAGE plpgsql AS $$ BEGIN EXECUTE 'reset role'; END $$;

-- Repair A2-1: these pg_temp SECURITY DEFINER helpers are defined here, before any role switch, so
-- they are owned by the disposable session/test runner -- not by service_role. service_role holds
-- zero direct grants on any private.jp_postal_* table (test 14), so a bare SELECT against one of
-- those tables while `SET LOCAL ROLE service_role` is active would simply fail to execute. Every
-- evidence inspection below that needs to read a private row therefore calls one of these helpers
-- instead of touching the table directly; SECURITY DEFINER makes each helper run with its owner's
-- privileges regardless of the caller's currently active role.
CREATE FUNCTION pg_temp.jpm_batch_id(p_sha256 text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM private.jp_postal_import_batches WHERE sha256 = p_sha256
$$;

CREATE FUNCTION pg_temp.jpm_batch_status(p_sha256 text)
RETURNS TABLE(status text, rolled_back_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT b.status, b.rolled_back_at FROM private.jp_postal_import_batches b WHERE b.sha256 = p_sha256
$$;

CREATE FUNCTION pg_temp.jpm_active_batch_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT batch_id FROM private.jp_postal_active_batch WHERE singleton
$$;

CREATE FUNCTION pg_temp.jpm_master_row(p_sha256 text, p_postal_code text, p_flag_has_chome boolean)
RETURNS TABLE(address_key text, is_non_specific_town boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.address_key, m.is_non_specific_town
  FROM private.jp_postal_master m
  JOIN private.jp_postal_import_batches b ON b.id = m.batch_id
  WHERE b.sha256 = p_sha256 AND m.postal_code = p_postal_code AND m.flag_has_chome = p_flag_has_chome
$$;

CREATE FUNCTION pg_temp.jpm_master_row_count(p_sha256 text) RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::bigint
  FROM private.jp_postal_master m
  JOIN private.jp_postal_import_batches b ON b.id = m.batch_id
  WHERE b.sha256 = p_sha256
$$;

-- 24: can switch to the service_role Postgres role for import RPC calls.
SELECT lives_ok(
  $$ SET LOCAL ROLE service_role; $$,
  '24 can switch to the service_role Postgres role for import RPC calls'
);
RESET ROLE;

-- 25: repair A1-3 -- authorization is now GRANT-only (no internal auth.role() check), so a caller
-- holding only the 'authenticated' Postgres role (which has no EXECUTE grant on any import RPC) must
-- be denied by Postgres' native function-privilege check inside THIS disposable pgTAP session, not
-- merely by a JWT-claim comparison a non-Supabase session could never exercise.
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.jp_postal_import_begin('2026-09-01'::date, repeat('a', 64), 1); $$,
  '42501',
  NULL,
  '25 jp_postal_import_begin denies a caller holding only the authenticated role (GRANT-only enforcement)'
);
RESET ROLE;

-- 26: a malformed sha256 is refused before any row is written.
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT (public.jp_postal_import_begin('2026-09-01'::date, 'not-hex', 1)) ->> 'result_code'),
  'INVALID_SHA256',
  '26 jp_postal_import_begin rejects a malformed sha256'
);
RESET ROLE;

-- 27-32: end-to-end begin/append/finalize promotes exactly the inserted rows.
-- The 4-row synthetic batch below simultaneously proves: (row 1) address_key is
-- server-recomputed and a lying addressKey/addressPrefixHead/isNonSpecificTown payload is ignored
-- (repair A1-6); (row 1 + row 2) two raw rows sharing one postal code but reducing to one specific
-- address collapse to FOUND, not AMBIGUOUS (repair A1-7); (row 4) a specific address_key shorter
-- than the 8-character prefix head still matches a longer input (repair A1-2), using the exact
-- synthetic case from the corrective dispatch: address_key = '三重県津市栄町', input
-- '三重県津市栄町1-2-3'.
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT (public.jp_postal_import_begin('2026-09-01'::date, repeat('b', 64), 4)) ->> 'result_code' = 'OK'),
  '27 jp_postal_import_begin succeeds for a fresh (date, sha256) identity'
);

-- Repair A3: the batch id is obtained via the already-staged pg_temp.jpm_batch_id helper (the same
-- pattern already used by test 31/47/48/etc.), not a second jp_postal_import_begin call -- a second
-- begin for the still-staged identity `b` would return IMPORT_IN_PROGRESS with no batch_id under the
-- accepted A2-3 contract.
SELECT ok(
  (SELECT (public.jp_postal_import_append(
     pg_temp.jpm_batch_id(repeat('b', 64)),
     0,
     '[
        {"jisCode":"13101","oldPostalCode":"100","postalCode":"1000001",
         "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ﾁﾖﾀﾞ",
         "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"千代田",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0",
         "addressKey":"LIAR","addressPrefixHead":"LIAR","isNonSpecificTown":true},
        {"jisCode":"13101","oldPostalCode":"100","postalCode":"1000001",
         "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ﾁﾖﾀﾞ",
         "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"千代田",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"1","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0",
         "addressKey":"東京都千代田区千代田","addressPrefixHead":"東京都千代田区千代田","isNonSpecificTown":false},
        {"jisCode":"13101","oldPostalCode":"100","postalCode":"1000002",
         "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ｶｽﾐｶﾞｾｷ",
         "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"霞が関",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0",
         "addressKey":"東京都千代田区霞が関","addressPrefixHead":"東京都千代田区霞が関","isNonSpecificTown":false},
        {"jisCode":"24201","oldPostalCode":"","postalCode":"5140831",
         "prefectureKana":"ﾐｴｹﾝ","cityKana":"ﾂｼ","townKana":"ｻｶｴﾏﾁ",
         "prefectureKanji":"三重県","cityKanji":"津市","townKanji":"栄町",
         "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
         "updateFlag":"0","changeReasonCode":"0",
         "addressKey":"三重県津市栄町","addressPrefixHead":"三重県津市栄町","isNonSpecificTown":false}
      ]'::jsonb
   )) ->> 'result_code' = 'OK'),
  '28 repair A3: jp_postal_import_append inserts the four synthetic rows using the staged batch id from test 27'
);

SELECT is(
  (SELECT address_key FROM pg_temp.jpm_master_row(repeat('b', 64), '1000001', false)),
  '東京都千代田区千代田',
  '29 repair A1-6: address_key is server-recomputed from prefecture/city/town kanji, ignoring the caller''s lying addressKey'
);
SELECT is(
  (SELECT is_non_specific_town FROM pg_temp.jpm_master_row(repeat('b', 64), '1000001', false)),
  false,
  '30 repair A1-6: is_non_specific_town is server-recomputed, ignoring the caller''s lying isNonSpecificTown=true'
);

-- 31: repair A1-1 -- replaying the identical (batch, sequence) is a stable, zero-write no-op.
-- Repair A2-1: the batch id is obtained via the pg_temp helper, not a direct private-table SELECT.
SELECT is(
  (SELECT (public.jp_postal_import_append(
     pg_temp.jpm_batch_id(repeat('b', 64)), 0,
     '[{"jisCode":"13101","oldPostalCode":"100","postalCode":"1000001",
        "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ﾁﾖﾀﾞ",
        "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"千代田",
        "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
        "updateFlag":"0","changeReasonCode":"0"}]'::jsonb
   )) ->> 'result_code'),
  'DUPLICATE_SEQUENCE',
  '31 repair A1-1: replaying sequence 0 for an already-appended batch is a stable zero-write no-op'
);
SELECT is(
  pg_temp.jpm_master_row_count(repeat('b', 64)),
  4::bigint,
  '32 repair A1-1: the duplicate-sequence replay in 31 wrote zero additional rows (still exactly 4)'
);

-- 33: repair A1-6 -- an official 0/1 flag column carrying any value other than '0'/'1' is refused,
-- never silently coerced to false, and writes zero rows.
SELECT is(
  (WITH b AS (SELECT public.jp_postal_import_begin('2026-09-05'::date, repeat('7', 64), 1) AS r)
   SELECT (public.jp_postal_import_append(
     ((SELECT r FROM b) ->> 'batch_id')::uuid, 0,
     '[{"jisCode":"13101","oldPostalCode":"100","postalCode":"1000003",
        "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ﾋﾄﾂﾊﾞｼ",
        "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"一ツ橋",
        "flagMultiPostalPerTown":"2","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
        "updateFlag":"0","changeReasonCode":"0"}]'::jsonb
   )) ->> 'result_code'),
  'INVALID_ROW_PAYLOAD',
  '33 repair A1-6: an invalid flag value (not exactly ''0''/''1'') is refused, never coerced to false'
);
SELECT is(
  pg_temp.jpm_master_row_count(repeat('7', 64)),
  0::bigint,
  '34 repair A1-6: the rejected invalid-flag append in 33 wrote zero rows'
);

-- Repair A2-1: the batch id is obtained via the pg_temp helper, not a direct private-table SELECT.
SELECT ok(
  (SELECT (public.jp_postal_import_finalize(pg_temp.jpm_batch_id(repeat('b', 64)))) ->> 'result_code' = 'OK'),
  '35 jp_postal_import_finalize promotes the batch once row counts match'
);
RESET ROLE;

-- 36-40: authenticated ACTIVE MEMBER lookup access (repair A1-8: a real dealer/member fixture, not a
-- role-only pseudo-fixture).
SELECT pg_temp.jpm_act_as(pg_temp.jpm_id('member'));
SELECT is(
  ((public.jp_postal_master_lookup_forward('100-0001')) ->> 'result_code'),
  'FOUND',
  '36 repair A1-7: forward lookup returns FOUND for two raw rows that reduce to one distinct address (distinct-address reduction)'
);
SELECT is(
  ((public.jp_postal_master_lookup_forward('not-a-code')) ->> 'result_code'),
  'INVALID_INPUT',
  '37 forward lookup rejects a malformed postal code as INVALID_INPUT'
);
SELECT is(
  ((public.jp_postal_master_lookup_reverse('東京都千代田区千代田1-1')) ->> 'result_code'),
  'FOUND',
  '38 reverse lookup resolves a full specific address to its postal code for an authenticated member'
);
SELECT is(
  ((public.jp_postal_master_lookup_reverse('   ')) ->> 'result_code'),
  'INVALID_INPUT',
  '39 reverse lookup rejects whitespace-only input as INVALID_INPUT'
);
SELECT is(
  ((public.jp_postal_master_lookup_reverse('三重県津市栄町1-2-3')) ->> 'result_code'),
  'FOUND',
  '40 repair A1-2: reverse lookup matches a specific address_key shorter than the 8-char prefix head against a longer input'
);
RESET ROLE;

-- 41: repair A1-8 -- a genuine non-member (authenticated, but zero dealer_members rows) is denied by
-- the same active-member guard, not merely by role-level GRANT (which authenticated does hold).
SELECT pg_temp.jpm_act_as(pg_temp.jpm_id('non_member'));
SELECT throws_ok(
  $$ SELECT public.jp_postal_master_lookup_forward('100-0001'); $$,
  '42501',
  'not authorized',
  '41 repair A1-8: a genuine non-member authenticated actor is denied by the active-member guard'
);
RESET ROLE;

-- 42: replaying the identical (date, sha256) after promotion is a no-write
-- already-promoted success, not a fresh insert.
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT (public.jp_postal_import_begin('2026-09-01'::date, repeat('b', 64), 4)) ->> 'already_promoted'),
  'true',
  '42 replaying an identical promoted (date, sha256) reports already_promoted=true'
);

-- 43: an oversized append batch is refused.
SELECT is(
  (WITH b AS (SELECT public.jp_postal_import_begin('2026-09-02'::date, repeat('c', 64), 0) AS r)
   SELECT (public.jp_postal_import_append(
     ((SELECT r FROM b) ->> 'batch_id')::uuid, 0, (SELECT jsonb_agg(x) FROM generate_series(1, 1001) x)
   )) ->> 'result_code'),
  'INVALID_BATCH_SIZE',
  '43 jp_postal_import_append refuses a payload above the 1000-row bound'
);

-- 44: finalize refuses a batch whose actual row count does not match expected.
SELECT is(
  (WITH b AS (SELECT public.jp_postal_import_begin('2026-09-03'::date, repeat('d', 64), 5) AS r)
   SELECT (public.jp_postal_import_finalize(((SELECT r FROM b) ->> 'batch_id')::uuid)) ->> 'result_code'),
  'ROW_COUNT_MISMATCH',
  '44 jp_postal_import_finalize rejects a batch whose row count does not match the declared expectation'
);

-- 45: rollback requires the target batch to already be promoted.
SELECT is(
  (WITH b AS (SELECT public.jp_postal_import_begin('2026-09-04'::date, repeat('e', 64), 0) AS r)
   SELECT (public.jp_postal_import_rollback(((SELECT r FROM b) ->> 'batch_id')::uuid)) ->> 'result_code'),
  'BATCH_NOT_ROLLBACK_TARGET',
  '45 jp_postal_import_rollback refuses a target batch that was never promoted'
);

-- 46-49: repair A1-5 -- rollback atomically repoints the singleton AND records the batch it moves
-- AWAY FROM as rolled_back, while the rollback TARGET keeps its existing promoted state and no
-- jp_postal_master row is ever rewritten or deleted. A second promoted batch is required to make the
-- outgoing-vs-target distinction observable.
SELECT ok(
  (WITH b AS (SELECT public.jp_postal_import_begin('2026-09-06'::date, repeat('8', 64), 1) AS r)
   SELECT (public.jp_postal_import_append(
     ((SELECT r FROM b) ->> 'batch_id')::uuid, 0,
     '[{"jisCode":"27102","oldPostalCode":"530","postalCode":"5300001",
        "prefectureKana":"ｵｵｻｶﾌ","cityKana":"ｵｵｻｶｼｷﾀｸ","townKana":"ｳﾒﾀﾞ",
        "prefectureKanji":"大阪府","cityKanji":"大阪市北区","townKanji":"梅田",
        "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
        "updateFlag":"0","changeReasonCode":"0"}]'::jsonb
   )) ->> 'result_code' = 'OK'),
  '46 a second batch (h) appends its one synthetic row for the rollback-evidence scenario'
);
-- Repair A2-1: both batch ids below are obtained via the pg_temp helper, not a direct private-table
-- SELECT, while service_role remains the active role.
SELECT ok(
  (SELECT (public.jp_postal_import_finalize(pg_temp.jpm_batch_id(repeat('8', 64)))) ->> 'result_code' = 'OK'),
  '47 the second batch (h) promotes and becomes the new active batch, superseding batch (b)'
);

SELECT ok(
  (SELECT (public.jp_postal_import_rollback(pg_temp.jpm_batch_id(repeat('b', 64)))) ->> 'result_code' = 'OK'),
  '48 jp_postal_import_rollback succeeds, repointing the active pointer back to the previously promoted batch (b)'
);
SELECT is(
  pg_temp.jpm_active_batch_id(),
  pg_temp.jpm_batch_id(repeat('b', 64)),
  '49 repair A1-5: the active-batch pointer now targets batch (b), the rollback target'
);
SELECT is(
  (SELECT status FROM pg_temp.jpm_batch_status(repeat('8', 64))),
  'rolled_back',
  '50 repair A1-5: the outgoing batch (h) -- the one the pointer moved AWAY FROM -- is recorded rolled_back'
);
SELECT is(
  (SELECT rolled_back_at FROM pg_temp.jpm_batch_status(repeat('8', 64))) IS NOT NULL,
  true,
  '51 repair A1-5: the outgoing batch (h) carries a rolled_back_at timestamp'
);
SELECT is(
  (SELECT status FROM pg_temp.jpm_batch_status(repeat('b', 64))),
  'promoted',
  '52 repair A1-5: the rollback TARGET batch (b) keeps its existing promoted status, unchanged'
);
SELECT is(
  pg_temp.jpm_master_row_count(repeat('b', 64)),
  4::bigint,
  '53 the four promoted rows of batch (b) survive rollback untouched (never rewritten/deleted)'
);
RESET ROLE;

-- ===========================================================================
-- 54-57: repair A2-3 -- a second begin for a still in-progress (staged) identity is a stable
-- non-OK conflict, never a resumable/writable success, and no path exists to append against it.
-- ===========================================================================
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT (public.jp_postal_import_begin('2026-09-07'::date, repeat('9', 64), 1)) ->> 'result_code' = 'OK'),
  '54 repair A2-3: the first begin for a fresh (date, sha256) identity succeeds and leaves the batch staged'
);
SELECT is(
  (SELECT (public.jp_postal_import_begin('2026-09-07'::date, repeat('9', 64), 1)) ->> 'result_code'),
  'IMPORT_IN_PROGRESS',
  '55 repair A2-3: a second begin for the still-staged identity returns IMPORT_IN_PROGRESS, not OK'
);
SELECT is(
  (SELECT (public.jp_postal_import_begin('2026-09-07'::date, repeat('9', 64), 1)) ->> 'batch_id'),
  NULL,
  '56 repair A2-3: the IMPORT_IN_PROGRESS conflict result exposes no batch_id to resume with'
);
SELECT is(
  pg_temp.jpm_master_row_count(repeat('9', 64)),
  0::bigint,
  '57 repair A2-3: no row exists for the in-progress identity after the conflicting replay calls'
);
RESET ROLE;

-- ===========================================================================
-- 58-64: repair A2-4 -- NULL sequence, NULL/non-object rows, a bare scalar or JSON-null array
-- element, a missing required field, and a wrong JSON scalar type are all refused with zero writes.
-- ===========================================================================
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT (public.jp_postal_import_begin('2026-09-08'::date, repeat('f', 64), 1)) ->> 'result_code' = 'OK'),
  '58 repair A2-4: begin succeeds for the payload-validation batch (j)'
);
SELECT is(
  (SELECT (public.jp_postal_import_append(pg_temp.jpm_batch_id(repeat('f', 64)), NULL, '[]'::jsonb)) ->> 'result_code'),
  'INVALID_SEQUENCE',
  '59 repair A2-4: append rejects a NULL sequence as INVALID_SEQUENCE'
);
SELECT is(
  (SELECT (public.jp_postal_import_append(pg_temp.jpm_batch_id(repeat('f', 64)), 0, '[1]'::jsonb)) ->> 'result_code'),
  'INVALID_ROW_PAYLOAD',
  '60 repair A2-4: append rejects a row array element that is a bare JSON scalar, not an object'
);
SELECT is(
  (SELECT (public.jp_postal_import_append(pg_temp.jpm_batch_id(repeat('f', 64)), 0, '[null]'::jsonb)) ->> 'result_code'),
  'INVALID_ROW_PAYLOAD',
  '61 repair A2-4: append rejects a row array element that is JSON null'
);
SELECT is(
  (SELECT (public.jp_postal_import_append(
     pg_temp.jpm_batch_id(repeat('f', 64)), 0,
     '[{"postalCode":"1000001","oldPostalCode":"100",
        "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ﾁﾖﾀﾞ",
        "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"千代田",
        "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
        "updateFlag":"0","changeReasonCode":"0"}]'::jsonb
   )) ->> 'result_code'),
  'INVALID_ROW_PAYLOAD',
  '62 repair A2-4: append rejects a row object missing the required jisCode field'
);
SELECT is(
  (SELECT (public.jp_postal_import_append(
     pg_temp.jpm_batch_id(repeat('f', 64)), 0,
     '[{"jisCode":"13101","postalCode":1000001,"oldPostalCode":"100",
        "prefectureKana":"ﾄｳｷﾖｳﾄ","cityKana":"ﾁﾖﾀﾞｸ","townKana":"ﾁﾖﾀﾞ",
        "prefectureKanji":"東京都","cityKanji":"千代田区","townKanji":"千代田",
        "flagMultiPostalPerTown":"0","flagKoazaBanchi":"0","flagHasChome":"0","flagMultiTownPerPostal":"0",
        "updateFlag":"0","changeReasonCode":"0"}]'::jsonb
   )) ->> 'result_code'),
  'INVALID_ROW_PAYLOAD',
  '63 repair A2-4: append rejects a numeric postalCode JSON value where a string is required'
);
SELECT is(
  pg_temp.jpm_master_row_count(repeat('f', 64)),
  0::bigint,
  '64 repair A2-4: none of the rejected payload-validation attempts wrote any row for batch (j)'
);
RESET ROLE;

-- 65: no test above left a dangling role switch.
SELECT is(current_user, session_user, '65 the transaction role has been reset to the session role');

SELECT * FROM finish();
ROLLBACK;
