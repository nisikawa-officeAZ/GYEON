-- GDA legacy customer registration — Gate B1 pgTAP suite (source-only authoring).
-- Target migration: supabase/migrations/20260915063440_legacy_customer_registration.sql
-- Contract: docs/master_specification/GDA_LEGACY_CUSTOMER_REGISTRATION_IMPLEMENTATION_CONTRACT_V1.md
--
-- This file is AUTHORED in Gate B1 but EXECUTED only at a later, separately authorized
-- verification gate (`supabase test db`). No Supabase instance or database is touched in
-- this phase. Everything below runs inside one transaction and is rolled back.
--
-- Fixture assumption (recorded limitation): seeds use the minimum columns the migration
-- itself relies on — auth.users(id, email), public.dealers(id, name),
-- public.dealer_members(dealer_id, user_id, status). If those parents carry additional
-- NOT NULL columns without defaults, the seed block below needs a bounded follow-up.

BEGIN;

SELECT plan(42);

-- ─── Fixtures (session role: postgres — table owner, bypasses RLS) ───────────────────────────
-- dealer A:  aaaa0000-0000-4000-8000-00000000000a
-- dealer B:  bbbb0000-0000-4000-8000-00000000000b
-- user a1:   aaaa0000-0000-4000-8000-000000000001  (ACTIVE member of dealer A)
-- user a2:   aaaa0000-0000-4000-8000-000000000002  (SUSPENDED member of dealer A)
-- user b1:   bbbb0000-0000-4000-8000-000000000001  (ACTIVE member of dealer B)
-- user c1:   cccc0000-0000-4000-8000-000000000001  (NO membership)
-- user a3:   aaaa0000-0000-4000-8000-000000000003  (ACTIVE member of dealer A, role readonly, no staff row)
-- user a4:   aaaa0000-0000-4000-8000-000000000004  (ACTIVE member readonly + ACTIVE dealer_staff role staff)
-- user a5:   aaaa0000-0000-4000-8000-000000000005  (ACTIVE member owner + ACTIVE dealer_staff role readonly)

INSERT INTO auth.users (id, email) VALUES
  ('aaaa0000-0000-4000-8000-000000000001', 'lcr-active-a@example.test'),
  ('aaaa0000-0000-4000-8000-000000000002', 'lcr-suspended-a@example.test'),
  ('bbbb0000-0000-4000-8000-000000000001', 'lcr-active-b@example.test'),
  ('cccc0000-0000-4000-8000-000000000001', 'lcr-no-membership@example.test'),
  ('aaaa0000-0000-4000-8000-000000000003', 'lcr-readonly-a@example.test'),
  ('aaaa0000-0000-4000-8000-000000000004', 'lcr-staff-override-a@example.test'),
  ('aaaa0000-0000-4000-8000-000000000005', 'lcr-readonly-override-a@example.test');

INSERT INTO public.dealers (id, name) VALUES
  ('aaaa0000-0000-4000-8000-00000000000a', 'LCR pgTAP Dealer A'),
  ('bbbb0000-0000-4000-8000-00000000000b', 'LCR pgTAP Dealer B');

INSERT INTO public.dealer_members (dealer_id, user_id, status, role) VALUES
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000001', 'active',   'owner'),
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000002', 'suspended', 'staff'),
  ('bbbb0000-0000-4000-8000-00000000000b', 'bbbb0000-0000-4000-8000-000000000001', 'active',   'staff'),
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000003', 'active',   'readonly'),
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000004', 'active',   'readonly'),
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000005', 'active',   'owner');

-- dealer_staff capability rows: a4's active staff row UPGRADES a readonly membership; a5's active
-- staff row DOWNGRADES an owner membership to readonly (the staff row wins for the same dealer).
INSERT INTO public.dealer_staff (dealer_id, user_id, role, status) VALUES
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000004', 'staff',    'active'),
  ('aaaa0000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000005', 'readonly', 'active');

-- Scratch table for RPC responses (rolled back with everything else).
CREATE TABLE public.__lcr_pgtap_scratch (label text PRIMARY KEY, resp jsonb NOT NULL);
GRANT SELECT, INSERT ON public.__lcr_pgtap_scratch TO authenticated;

-- JWT simulation helper: sets the transaction-local claims Supabase auth.uid() reads.
CREATE FUNCTION public.__lcr_test_login(p_user uuid) RETURNS void
LANGUAGE plpgsql AS $helper$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END
$helper$;

-- ─── A. Structural posture: RLS, policies, explicit privileges, invoker rights ───────────────

-- 1-2. RLS enabled on both new tables.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.vehicle_service_history'::regclass),
  'RLS is enabled on vehicle_service_history');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.legacy_customer_registration_receipts'::regclass),
  'RLS is enabled on legacy_customer_registration_receipts');

-- 3-4. Exactly the two member-bound policies per table; no UPDATE/DELETE policy exists.
SELECT policies_are('public', 'vehicle_service_history',
  ARRAY['vsh_member_select', 'vsh_member_insert'],
  'vehicle_service_history has ONLY member SELECT + INSERT policies (fail closed on UPDATE/DELETE)');
SELECT policies_are('public', 'legacy_customer_registration_receipts',
  ARRAY['lcr_member_select', 'lcr_member_insert'],
  'receipts have ONLY member SELECT + INSERT policies (immutable: no UPDATE/DELETE policy)');

-- 5-8. Explicit table privileges: anon has NOTHING; authenticated has exactly SELECT + INSERT.
SELECT table_privs_are('public', 'vehicle_service_history', 'anon',
  '{}'::text[], 'anon holds no privilege on vehicle_service_history');
SELECT table_privs_are('public', 'vehicle_service_history', 'authenticated',
  ARRAY['SELECT', 'INSERT'], 'authenticated holds exactly SELECT, INSERT on vehicle_service_history');
SELECT table_privs_are('public', 'legacy_customer_registration_receipts', 'anon',
  '{}'::text[], 'anon holds no privilege on receipts');
SELECT table_privs_are('public', 'legacy_customer_registration_receipts', 'authenticated',
  ARRAY['SELECT', 'INSERT'], 'authenticated holds exactly SELECT, INSERT on receipts (append-only)');

-- 9-10. Function privileges: PUBLIC/anon execute revoked; authenticated is the only caller.
SELECT function_privs_are('public', 'register_legacy_customer', ARRAY['jsonb']::name[],
  'anon', '{}'::text[], 'anon (and therefore PUBLIC) cannot execute register_legacy_customer');
SELECT function_privs_are('public', 'register_legacy_customer', ARRAY['jsonb']::name[],
  'authenticated', ARRAY['EXECUTE'], 'authenticated can execute register_legacy_customer');

-- 11. SECURITY INVOKER, not definer.
SELECT ok(
  NOT (SELECT prosecdef FROM pg_proc
       WHERE oid = 'public.register_legacy_customer(jsonb)'::regprocedure),
  'register_legacy_customer is SECURITY INVOKER');

-- ─── B. Unauthorized caller denial ───────────────────────────────────────────────────────────

-- 12. anon role: EXECUTE itself is denied.
SET LOCAL ROLE anon;
SELECT throws_ok(
  $q$SELECT public.register_legacy_customer('{}'::jsonb)$q$,
  '42501', NULL,
  'anon caller is denied EXECUTE on register_legacy_customer');
RESET ROLE;

-- 13. authenticated role without a JWT subject: auth.uid() is NULL and the function fails closed.
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE authenticated;
SELECT throws_like(
  $q$SELECT public.register_legacy_customer('{}'::jsonb)$q$,
  'AUTH_REQUIRED%',
  'authenticated role without auth.uid() fails closed with AUTH_REQUIRED');
RESET ROLE;

-- 14. Authenticated user with NO dealer membership fails closed.
SELECT public.__lcr_test_login('cccc0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_like(
  $q$SELECT public.register_legacy_customer('{}'::jsonb)$q$,
  'FORBIDDEN_NO_ACTIVE_MEMBERSHIP%',
  'caller with no dealer membership is rejected');
RESET ROLE;

-- 15. Authenticated user whose only membership is SUSPENDED fails closed.
SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_like(
  $q$SELECT public.register_legacy_customer('{}'::jsonb)$q$,
  'FORBIDDEN_NO_ACTIVE_MEMBERSHIP%',
  'caller with only a suspended membership is rejected (authentication alone is not authorization)');
RESET ROLE;

-- ─── C. Zero-history registration by an active member ────────────────────────────────────────

SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;

-- 16. A valid registration with ZERO history rows is accepted.
SELECT lives_ok(
  $q$INSERT INTO public.__lcr_pgtap_scratch (label, resp)
     VALUES ('first', public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-001',
       'customer', jsonb_build_object(
         'mode', 'new', 'name', '検証 太郎',
         'lastNameKana', 'ケンショウ', 'firstNameKana', 'タロウ'),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Toyota', 'model', 'Prius'),
       'history', jsonb_build_array())))$q$,
  'active member registers new customer + new vehicle with zero history rows');

-- 17-18. The first call reports success and is NOT a replay.
SELECT is(
  (SELECT resp ->> 'ok' FROM public.__lcr_pgtap_scratch WHERE label = 'first'),
  'true', 'first registration returns ok=true');
SELECT is(
  (SELECT resp ->> 'idempotentReplay' FROM public.__lcr_pgtap_scratch WHERE label = 'first'),
  'false', 'first registration is not flagged as an idempotent replay');

RESET ROLE;

-- 19-20. Durable receipt exists even though NO history row was written (zero-history anchor).
SELECT is(
  (SELECT count(*)::int FROM public.legacy_customer_registration_receipts
   WHERE dealer_id = 'aaaa0000-0000-4000-8000-00000000000a'
     AND idempotency_key = 'pgtap-key-001'),
  1, 'exactly one receipt anchors the zero-history registration');
SELECT is(
  (SELECT count(*)::int FROM public.vehicle_service_history
   WHERE dealer_id = 'aaaa0000-0000-4000-8000-00000000000a'),
  0, 'zero-history registration wrote no vehicle_service_history rows');

-- ─── D. Same-key + same-fingerprint replay: original ids, NO writes ──────────────────────────

SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;

-- 21. Identical payload + identical key succeeds again.
SELECT lives_ok(
  $q$INSERT INTO public.__lcr_pgtap_scratch (label, resp)
     VALUES ('replay', public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-001',
       'customer', jsonb_build_object(
         'mode', 'new', 'name', '検証 太郎',
         'lastNameKana', 'ケンショウ', 'firstNameKana', 'タロウ'),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Toyota', 'model', 'Prius'),
       'history', jsonb_build_array())))$q$,
  'same-key same-canonical-payload replay is accepted');

-- 22-23. Replay is flagged and returns the ORIGINAL customer/vehicle ids.
SELECT is(
  (SELECT resp ->> 'idempotentReplay' FROM public.__lcr_pgtap_scratch WHERE label = 'replay'),
  'true', 'replay is flagged idempotentReplay=true');
SELECT is(
  (SELECT (resp ->> 'customerId') || '/' || (resp ->> 'vehicleId')
   FROM public.__lcr_pgtap_scratch WHERE label = 'replay'),
  (SELECT (resp ->> 'customerId') || '/' || (resp ->> 'vehicleId')
   FROM public.__lcr_pgtap_scratch WHERE label = 'first'),
  'replay returns the originally resolved customer and vehicle ids');

RESET ROLE;

-- 24. Replay wrote NOTHING: receipt/history/customer/vehicle counts are unchanged.
SELECT is(
  ARRAY[
    (SELECT count(*)::int FROM public.legacy_customer_registration_receipts
     WHERE dealer_id = 'aaaa0000-0000-4000-8000-00000000000a'),
    (SELECT count(*)::int FROM public.vehicle_service_history
     WHERE dealer_id = 'aaaa0000-0000-4000-8000-00000000000a'),
    (SELECT count(*)::int FROM public.customers
     WHERE dealer_id = 'aaaa0000-0000-4000-8000-00000000000a' AND name = '検証 太郎'),
    (SELECT count(*)::int FROM public.vehicles
     WHERE dealer_id = 'aaaa0000-0000-4000-8000-00000000000a'
       AND maker = 'Toyota' AND model = 'Prius')],
  ARRAY[1, 0, 1, 1],
  'replay created no receipt, history, customer, or vehicle rows');

-- ─── E. Same-key + DIFFERENT fingerprint: fail closed ────────────────────────────────────────

SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;

-- 25. Reusing the key with a different canonical payload raises the stable conflict code.
SELECT throws_like(
  $q$SELECT public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-001',
       'customer', jsonb_build_object(
         'mode', 'new', 'name', '検証 次郎',
         'lastNameKana', 'ケンショウ', 'firstNameKana', 'ジロウ'),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Toyota', 'model', 'Prius'),
       'history', jsonb_build_array()))$q$,
  'IDEMPOTENCY_CONFLICT%',
  'same key with a different payload fingerprint fails closed');

RESET ROLE;

-- ─── F. Tenant isolation ─────────────────────────────────────────────────────────────────────

-- 26. Dealer B member cannot register against dealer A''s customer id (cross-tenant reference).
SELECT public.__lcr_test_login('bbbb0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_like(
  $q$SELECT public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-b-001',
       'customer', jsonb_build_object('mode', 'existing', 'customerId',
         (SELECT resp ->> 'customerId' FROM public.__lcr_pgtap_scratch WHERE label = 'first')),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Honda'),
       'history', jsonb_build_array()))$q$,
  'CUSTOMER_NOT_FOUND%',
  'dealer B member cannot reference a dealer A customer (server-derived tenant wins)');
RESET ROLE;

-- 27. Seed ONE dealer-A history row as owner so row visibility is observable.
SELECT lives_ok(
  $q$INSERT INTO public.vehicle_service_history
       (dealer_id, vehicle_id, customer_id, category, performed_on, service_name, created_by)
     SELECT 'aaaa0000-0000-4000-8000-00000000000a',
            (resp ->> 'vehicleId')::uuid, (resp ->> 'customerId')::uuid,
            'coating', date '2020-01-15', 'ガラスコーティング',
            'aaaa0000-0000-4000-8000-000000000001'
     FROM public.__lcr_pgtap_scratch WHERE label = 'first'$q$,
  'fixture: one dealer A history row seeded by table owner');

-- 28-29. Active dealer A member reads dealer A rows.
SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicle_service_history), 1,
  'active dealer A member can read dealer A history');
SELECT is((SELECT count(*)::int FROM public.legacy_customer_registration_receipts), 1,
  'active dealer A member can read dealer A receipts');
RESET ROLE;

-- 30-31. Active dealer B member sees ZERO dealer A rows through RLS.
SELECT public.__lcr_test_login('bbbb0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.vehicle_service_history), 0,
  'tenant isolation: dealer B member sees no dealer A history');
SELECT is((SELECT count(*)::int FROM public.legacy_customer_registration_receipts), 0,
  'tenant isolation: dealer B member sees no dealer A receipts');
RESET ROLE;

-- ─── G. Immutability: no authenticated UPDATE/DELETE authority exists ────────────────────────

SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;

-- 32-33. Receipts are immutable even for the member who created them.
SELECT throws_ok(
  $q$UPDATE public.legacy_customer_registration_receipts
     SET payload_fingerprint = repeat('0', 64)$q$,
  '42501', NULL, 'authenticated UPDATE on receipts is denied (no grant, no policy)');
SELECT throws_ok(
  $q$DELETE FROM public.legacy_customer_registration_receipts$q$,
  '42501', NULL, 'authenticated DELETE on receipts is denied (no grant, no policy)');

-- 34-35. History rows have no authenticated UPDATE/DELETE authority in V1 either.
SELECT throws_ok(
  $q$UPDATE public.vehicle_service_history SET service_name = 'tampered'$q$,
  '42501', NULL, 'authenticated UPDATE on vehicle_service_history is denied');
SELECT throws_ok(
  $q$DELETE FROM public.vehicle_service_history$q$,
  '42501', NULL, 'authenticated DELETE on vehicle_service_history is denied');

-- ─── H. Direct-INSERT RLS: membership + self-attribution enforced ────────────────────────────

-- 36. A dealer A member cannot insert a receipt claiming dealer B tenancy.
SELECT throws_ok(
  $q$INSERT INTO public.legacy_customer_registration_receipts
       (dealer_id, idempotency_key, payload_fingerprint, customer_id, vehicle_id, created_by)
     VALUES ('bbbb0000-0000-4000-8000-00000000000b', 'direct-cross-tenant', repeat('0', 64),
             gen_random_uuid(), gen_random_uuid(),
             'aaaa0000-0000-4000-8000-000000000001')$q$,
  '42501', NULL, 'direct receipt INSERT into a non-member dealer is blocked by RLS');

-- 37. created_by must be the caller: attributing rows to another user is blocked.
SELECT throws_ok(
  $q$INSERT INTO public.vehicle_service_history
       (dealer_id, vehicle_id, customer_id, category, performed_on, service_name, created_by)
     SELECT 'aaaa0000-0000-4000-8000-00000000000a',
            (resp ->> 'vehicleId')::uuid, (resp ->> 'customerId')::uuid,
            'coating', date '2021-03-01', 'なりすまし行',
            'bbbb0000-0000-4000-8000-000000000001'
     FROM public.__lcr_pgtap_scratch WHERE label = 'first'$q$,
  '42501', NULL, 'history INSERT with created_by <> auth.uid() is blocked by RLS');

RESET ROLE;

-- ─── I. Edit capability: readonly denial and dealer_staff override (RPC + direct INSERT) ─────

-- 38. readonly member (no staff row) is denied by the RPC with the stable sanitized code.
SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT throws_like(
  $q$SELECT public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-ro-001',
       'customer', jsonb_build_object(
         'mode', 'new', 'name', '閲覧 のみ',
         'lastNameKana', 'エツラン', 'firstNameKana', 'ノミ'),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Mazda'),
       'history', jsonb_build_array()))$q$,
  'PERMISSION_DENIED%',
  'readonly member is denied registration with stable PERMISSION_DENIED');

-- 39-40. readonly member cannot bypass the RPC via direct INSERT into either new table.
SELECT throws_ok(
  $q$INSERT INTO public.vehicle_service_history
       (dealer_id, vehicle_id, customer_id, category, performed_on, service_name, created_by)
     SELECT 'aaaa0000-0000-4000-8000-00000000000a',
            (resp ->> 'vehicleId')::uuid, (resp ->> 'customerId')::uuid,
            'coating', date '2022-05-01', '読み取り専用の直接挿入',
            'aaaa0000-0000-4000-8000-000000000003'
     FROM public.__lcr_pgtap_scratch WHERE label = 'first'$q$,
  '42501', NULL, 'readonly member direct history INSERT is blocked by the capability-bound policy');
SELECT throws_ok(
  $q$INSERT INTO public.legacy_customer_registration_receipts
       (dealer_id, idempotency_key, payload_fingerprint, customer_id, vehicle_id, created_by)
     SELECT 'aaaa0000-0000-4000-8000-00000000000a', 'direct-readonly', repeat('1', 64),
            (resp ->> 'customerId')::uuid, (resp ->> 'vehicleId')::uuid,
            'aaaa0000-0000-4000-8000-000000000003'
     FROM public.__lcr_pgtap_scratch WHERE label = 'first'$q$,
  '42501', NULL, 'readonly member direct receipt INSERT is blocked by the capability-bound policy');
RESET ROLE;

-- 41. An ACTIVE dealer_staff row (role staff) overrides a readonly membership: RPC is accepted.
SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $q$SELECT public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-staff-001',
       'customer', jsonb_build_object(
         'mode', 'new', 'name', '昇格 花子',
         'lastNameKana', 'ショウカク', 'firstNameKana', 'ハナコ'),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Subaru'),
       'history', jsonb_build_array()))$q$,
  'active dealer_staff role staff overrides a readonly membership (capability granted)');
RESET ROLE;

-- 42. An ACTIVE dealer_staff row (role readonly) overrides an owner membership: fail closed.
SELECT public.__lcr_test_login('aaaa0000-0000-4000-8000-000000000005');
SET LOCAL ROLE authenticated;
SELECT throws_like(
  $q$SELECT public.register_legacy_customer(jsonb_build_object(
       'idempotencyKey', 'pgtap-key-demoted-001',
       'customer', jsonb_build_object(
         'mode', 'new', 'name', '降格 一郎',
         'lastNameKana', 'コウカク', 'firstNameKana', 'イチロウ'),
       'vehicle', jsonb_build_object('mode', 'new', 'maker', 'Nissan'),
       'history', jsonb_build_array()))$q$,
  'PERMISSION_DENIED%',
  'active dealer_staff readonly row wins over an owner membership (staff row is authoritative)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
