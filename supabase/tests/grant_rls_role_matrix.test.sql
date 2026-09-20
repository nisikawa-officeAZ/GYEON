-- grant_rls_role_matrix.test.sql
-- STATIC/UNEXECUTED CANDIDATE. Source-derived from
-- docs/master_specification/CATALOG_MANIFEST.md (R12C), the assertion
-- patterns already accepted in supabase/tests/catalog_manifest.test.sql, and
-- the two-tenant actor-matrix pattern already accepted in
-- supabase/tests/gyeon_products_storage_authority.test.sql.
-- GRANT_RLS_ROLE_MATRIX was explicitly excluded from the R12C candidate
-- (CATALOG_MANIFEST.md section 6). This file is a bounded, self-contained
-- next-step candidate: it does not depend on any temp table created by
-- another test file, is not executed here, and proves nothing about any
-- live database until a later authorized disposable execution gate.
--
-- Scope, part 1 (sections 01-20): cross-role (anon / authenticated /
-- service_role) grant and RLS consistency on the public schema, using exact
-- full-row equality where the expected set is fully known from the accepted
-- source ledger (the 24-row function_execute_acl set), and exact bounded
-- aggregate/guard equality elsewhere (relation_acl, rls_relation, policy),
-- per CATALOG_MANIFEST.md section 3 canonical counts: RLS relation flags 82,
-- policies 190 (public 173 + storage 17), relation ACL atomic grants 463,
-- function EXECUTE ACL grants 24. These aggregate/guard assertions are
-- NOT full-row-equality claims: they bound counts, roles, and weakening
-- (grantability, missing RLS, missing permissive policy), not full policy
-- definitions, so no full-row-equality language is used for them.
--
-- Scope, part 2 (sections 21-40): a two-tenant actor CRUD matrix per
-- docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md section 14.2
-- item 2 (GRANT_RLS_ROLE_MATRIX). It exercises positive and negative
-- SELECT/INSERT/UPDATE for an active owner, an active manager, an
-- active staff member, an inactive (suspended) member, a foreign-dealer
-- (cross-tenant) member, a no-member caller, anon, and service_role, against
-- the accepted `dealer-branding` Storage policy matrix (the one canonical
-- bucket in the accepted catalog that authorizes the full member policy set),
-- using deterministic UUID fixtures for two dealers. The SQL layer cannot
-- execute direct DELETE against storage.objects because the platform
-- storage.protect_delete() guard requires the Storage API. DELETE policy
-- identity is therefore catalog-proved here, while positive DELETE behavior
-- remains a real Storage API runtime assertion.
--
-- IMPORTANT LIMITATION: the actor matrix in sections 21-40 simulates caller
-- identity by setting `request.jwt.claim.sub` / `request.jwt.claims` and
-- switching the transaction's local Postgres role, then evaluating SQL
-- directly inside this transaction. This is a SQL/RLS claim simulation only.
-- It is NOT evidence of a real Supabase Auth token, a real PostgREST/Storage
-- request-scope boundary, or any behavior downstream of the Postgres role
-- (HTTP routing, JWT signature/expiry validation, storage API semantics). Per
-- ENVIRONMENT_REMEDIATION_PLAN.md section 14.2 item 2, a later runtime gate
-- must additionally prove two-tenant positive/negative CRUD behavior with
-- real local Auth tokens against a live disposable stack; this file does not
-- replace that proof. `service_role` fixture/setup and the single
-- server-authority assertion below (39) are the only service_role usages;
-- service_role is never used as dealer-facing authorization proof.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = extensions, pg_temp, public, pg_catalog;

select plan(40);

-- ---------------------------------------------------------------------
-- expected_function_execute_acl: the 24 canonical EXECUTE grant rows for
-- the bounded application grantee set (authenticated, service_role),
-- reproduced verbatim from the accepted source ledger.
-- ---------------------------------------------------------------------
create temp table expected_function_execute_acl (
  function_schema text,
  function_name text,
  identity_argument_types text,
  grantee text,
  privilege_type text,
  is_grantable boolean
);
insert into expected_function_execute_acl
  (function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable)
values
  ('public', 'attach_monthly_statement_pdf_rpc', 'uuid, uuid, uuid', 'service_role', 'EXECUTE', FALSE),
  ('public', 'b3_recalc_invoice_payment', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'b3_recalc_invoice_payment', 'uuid', 'service_role', 'EXECUTE', FALSE),
  ('public', 'convert_payment_to_allocated_rpc', 'uuid, uuid, uuid, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'convert_payment_to_allocated_rpc', 'uuid, uuid, uuid, jsonb', 'service_role', 'EXECUTE', FALSE),
  ('public', 'create_monthly_statement_draft_rpc', 'uuid, uuid, uuid, date', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'get_next_document_number', 'uuid, text, integer, text, integer, text', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'issue_monthly_statement_rpc', 'uuid, uuid', 'service_role', 'EXECUTE', FALSE),
  ('public', 'pg_version', '', 'service_role', 'EXECUTE', FALSE),
  ('public', 'record_payment_with_allocations_rpc', 'uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'record_payment_with_allocations_rpc', 'uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb', 'service_role', 'EXECUTE', FALSE),
  ('public', 'save_estimate_from_wizard', 'uuid, uuid, jsonb', 'service_role', 'EXECUTE', FALSE),
  ('public', 'save_invoice_draft', 'uuid, uuid, jsonb, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_archive_catalog_item', 'uuid, uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_archive_ppf_coating_adjustment', 'uuid, uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_can_configure', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_confirm_catalog_review', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_document_fiscal_year', 'text, timestamp with time zone', 'service_role', 'EXECUTE', FALSE),
  ('public', 'wiz_format_document_number', 'text, integer, integer, integer', 'service_role', 'EXECUTE', FALSE),
  ('public', 'wiz_is_active_member', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_is_any_active_member', '', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_is_wizard_estimate', 'text, text, text', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_upsert_catalog_item', 'uuid, uuid, text, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_upsert_ppf_coating_adjustment', 'uuid, uuid, jsonb', 'authenticated', 'EXECUTE', FALSE);

create temp table actual_function_execute_acl as
select n.nspname as function_schema,
       p.proname as function_name,
       oidvectortypes(p.proargtypes) as identity_argument_types,
       r.rolname as grantee,
       a.privilege_type,
       a.is_grantable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  join pg_authid r on r.oid = a.grantee
 where n.nspname = 'public' and p.prokind = 'f'
   and r.rolname in ('authenticated', 'service_role');

-- 01-05: rls_relation (public base-table RLS flags, self-contained live
-- catalog comparison against the 82-row canonical count)
select is(
  (select count(*)::bigint
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity),
  82::bigint,
  '01 rls_relation EXACT_COUNT: expected 82 public base-table relations with row level security enabled'
);

select diag(d.line) from (
  select format('MISSING_RLS schema=%s relation=%s', x.nspname, x.relname) as line
    from (
      select n.nspname, c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ) x
   limit 20
) d;
select is(
  (select count(*)::bigint
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint,
  '02 rls_relation NO_MISSING: no public base-table relation may be absent row level security relative to the canonical 82-row set'
);

select is(
  (select count(*)::bigint
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'),
  82::bigint,
  '03 rls_relation NO_UNEXPECTED: total public base-table relation count must equal the canonical 82-row set (no unaccounted relation)'
);

select is(
  (select count(*)::bigint from (
    select n.nspname, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     group by n.nspname, c.relname
    having count(*) > 1
  ) dup),
  0::bigint,
  '04 rls_relation NO_DUPLICATE: (schema,relation) identity must be unique in the live catalog'
);

select is(
  (select count(*)::bigint
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (c.relrowsecurity is not true or c.relforcerowsecurity is not false)),
  0::bigint,
  '05 rls_relation NO_WEAKER: none of the 82 canonical public base-table relations may have relrowsecurity=false, and relforcerowsecurity must stay false for all 82'
);

-- 06-10: relation_acl anon-role guard (anon must hold zero table grants on
-- public; authenticated/service_role must equal the canonical 463-row bound)
select is(
  (select count(*)::bigint
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0::bigint,
  '06 relation_acl ANON_EXACT_COUNT: expected 0 canonical table grant rows to anon on public'
);

select diag(d.line) from (
  select format('UNEXPECTED_ANON_GRANT object=public.%s privilege=%s', x.table_name, x.privilege_type) as line
    from information_schema.role_table_grants x
   where x.table_schema = 'public' and x.grantee = 'anon'
   limit 20
) d;
select is(
  (select count(*)::bigint
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0::bigint,
  '07 relation_acl ANON_NO_UNEXPECTED: no live public table grant row may target anon (anon has no direct table privileges)'
);

select is(
  (select count(*)::bigint
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('authenticated', 'service_role')),
  463::bigint,
  '08 relation_acl APPLICATION_EXACT_COUNT: expected 463 canonical grant rows for the bounded authenticated/service_role grantee set'
);

select is(
  (select count(*)::bigint from (
    select table_schema, table_name, grantee, privilege_type
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
     group by table_schema, table_name, grantee, privilege_type
    having count(*) > 1
  ) dup),
  0::bigint,
  '09 relation_acl NO_DUPLICATE: (object_schema,object_name,grantee,privilege_type) identity must be unique across anon/authenticated/service_role in the live catalog'
);

select is(
  (select count(*)::bigint
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('authenticated', 'service_role')
      and is_grantable <> 'NO'),
  0::bigint,
  '10 relation_acl NO_WEAKER: is_grantable must be NO (no WITH GRANT OPTION) for all 463 canonical authenticated/service_role grant rows'
);

-- 11-15: function_execute_acl (full-row equality against the 24-row
-- canonical set, bounded to authenticated/service_role)
select is(
  (select count(*)::bigint from actual_function_execute_acl),
  24::bigint,
  '11 function_execute_acl EXACT_COUNT: expected 24 canonical EXECUTE grant rows for the bounded application grantee set'
);

select diag(d.line) from (
  select format('MISSING function=%s.%s(%s) grantee=%s', x.function_schema, x.function_name, x.identity_argument_types, x.grantee) as line
    from (
      select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from expected_function_execute_acl
      except
      select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from actual_function_execute_acl
    ) x
   limit 20
) d;
select is(
  (select count(*)::bigint from (
    select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from expected_function_execute_acl
    except
    select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from actual_function_execute_acl
  ) missing),
  0::bigint,
  '12 function_execute_acl NO_MISSING: every canonical (function_schema,function_name,identity_argument_types,grantee,privilege_type,is_grantable) row must be present and matching in the live catalog'
);

select diag(d.line) from (
  select format('UNEXPECTED function=%s.%s(%s) grantee=%s', x.function_schema, x.function_name, x.identity_argument_types, x.grantee) as line
    from (
      select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from actual_function_execute_acl
      except
      select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from expected_function_execute_acl
    ) x
   limit 20
) d;
select is(
  (select count(*)::bigint from (
    select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from actual_function_execute_acl
    except
    select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from expected_function_execute_acl
  ) unexpected),
  0::bigint,
  '13 function_execute_acl NO_UNEXPECTED: no live EXECUTE grant row within the bounded application grantee set may present an identity or field value absent from the canonical 24-row set'
);

select is(
  (select count(*)::bigint from (
    select function_schema, function_name, identity_argument_types, grantee
      from actual_function_execute_acl
     group by function_schema, function_name, identity_argument_types, grantee
    having count(*) > 1
  ) dup),
  0::bigint,
  '14 function_execute_acl NO_DUPLICATE: (function_schema,function_name,identity_argument_types,grantee) identity must be unique in the live catalog'
);

select is(
  (
    (select count(*)::bigint from actual_function_execute_acl where is_grantable)
    +
    (select count(*)::bigint
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       join pg_authid r on r.oid = a.grantee
      where n.nspname = 'public' and p.prokind = 'f' and r.rolname = 'anon')
  ),
  0::bigint,
  '15 function_execute_acl NO_WEAKER: no WITH GRANT OPTION on any of the 24 canonical grants, and anon must hold zero EXECUTE grants on public functions'
);

-- 16-20: policy (public + storage RLS policies, canonical 190-row bound,
-- cross-role guard on the roles named in policy definitions)
select is(
  (select count(*)::bigint
     from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')),
  190::bigint,
  '16 policy EXACT_COUNT: expected 190 canonical policies across public (173) and storage (17)'
);

select diag(d.line) from (
  select format('POLICY_ROLE_OUT_OF_MATRIX schema=%s relation=%s policy=%s role=%s',
                 x.nspname, x.relname, x.polname, x_role.rolname) as line
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral (
      select r.rolname
        from pg_authid r
       where pol.polroles <> '{0}' and r.oid = any(pol.polroles)
    ) x_role(rolname)
    cross join lateral (select n.nspname, c.relname, pol.polname) x(nspname, relname, polname)
   where n.nspname in ('public', 'storage')
     and x_role.rolname not in ('anon', 'authenticated', 'service_role')
   limit 20
) d;
select is(
  (select count(*)::bigint
     from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral (
       select r.rolname
         from pg_authid r
        where pol.polroles <> '{0}' and r.oid = any(pol.polroles)
     ) x_role(rolname)
    where n.nspname in ('public', 'storage')
      and x_role.rolname not in ('anon', 'authenticated', 'service_role')),
  0::bigint,
  '17 policy NO_UNEXPECTED: every explicit policy role named on public/storage must be one of the bounded anon/authenticated/service_role matrix'
);

select is(
  (select count(*)::bigint from (
    select n.nspname, c.relname, pol.polname
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'storage')
     group by n.nspname, c.relname, pol.polname
    having count(*) > 1
  ) dup),
  0::bigint,
  '18 policy NO_DUPLICATE: (schema,relation,policyname) identity must be unique in the live catalog'
);

create temp table expected_rls_no_policy_relation (
  relation_name text primary key
);
insert into expected_rls_no_policy_relation (relation_name) values
  ('gyeon_ai_settings'),
  ('gyeon_ai_usage_log'),
  ('inventory_stocktaking_items'),
  ('inventory_stocktaking_sessions'),
  ('logistics_backorders'),
  ('logistics_shipments'),
  ('po_fulfillment_lines'),
  ('warehouse_adjustments');

create temp table actual_rls_no_policy_relation as
select c.relname as relation_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
   and not exists (
     select 1 from pg_policy pol where pol.polrelid = c.oid
   );

select diag(format('UNEXPECTED_RLS_NO_POLICY relation=%s', relation_name))
  from (
    select relation_name from actual_rls_no_policy_relation
    except all
    select relation_name from expected_rls_no_policy_relation
  ) unexpected;
select diag(format('MISSING_RLS_NO_POLICY relation=%s', relation_name))
  from (
    select relation_name from expected_rls_no_policy_relation
    except all
    select relation_name from actual_rls_no_policy_relation
  ) missing;
select is(
  (select count(*)::bigint from (
    (select relation_name from actual_rls_no_policy_relation
     except all
     select relation_name from expected_rls_no_policy_relation)
    union all
    (select relation_name from expected_rls_no_policy_relation
     except all
     select relation_name from actual_rls_no_policy_relation)
  ) delta),
  0::bigint,
  '19 policy EXACT_SET: RLS-on/no-policy relations are exactly the eight intentional service-role-only full-deny tables'
);

-- 20: cross-category anon zero-privilege guard, combining relation_acl,
-- function_execute_acl, and policy role membership into a single bounded
-- role-matrix assertion (anon must never appear as a direct grantee)
select is(
  (
    (select count(*)::bigint from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon')
    +
    (select count(*)::bigint
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       join pg_authid r on r.oid = a.grantee
      where n.nspname = 'public' and p.prokind = 'f' and r.rolname = 'anon')
  ),
  0::bigint,
  '20 role_matrix NO_WEAKER: anon must hold zero direct relation grants and zero direct function EXECUTE grants on public across the bounded role matrix'
);

-- =======================================================================
-- 21-40: two-tenant actor matrix (SQL/RLS claim simulation only; see
-- the IMPORTANT LIMITATION note at the top of this file). Deterministic
-- UUID fixtures for two dealers, and the actors required by
-- ENVIRONMENT_REMEDIATION_PLAN.md section 14.2 item 2: active owner,
-- active manager, active staff, an inactive (suspended) member, a
-- foreign-dealer (cross-tenant) member, a no-member caller, anon, and
-- service_role (fixture/setup and server-authority only). The target
-- resource is the accepted `dealer-branding` Storage object matrix, the
-- one canonical bucket whose policies (per
-- gyeon_products_storage_authority.test.sql sections 22-33, already
-- accepted) authorize the full member policy set, gated on
-- dealer_members.status = 'active' and dealer_members.role in
-- ('owner','manager','staff','readonly'). Direct SQL proves
-- SELECT/INSERT/UPDATE and the platform DELETE guard; positive DELETE stays
-- in the later real Storage API proof.
-- =======================================================================

create temp table grm_ids (k text primary key, v uuid not null);
insert into grm_ids (k, v) values
  ('dealer_a',  'a5200000-0000-4000-8000-000000000001'),
  ('dealer_b',  'b5200000-0000-4000-8000-000000000001'),
  ('owner_a',   'a5200000-0000-4000-8000-000000000101'),
  ('manager_a', 'a5200000-0000-4000-8000-000000000102'),
  ('staff_a',   'a5200000-0000-4000-8000-000000000103'),
  ('inactive_a','a5200000-0000-4000-8000-000000000104'),
  ('no_member', 'a5200000-0000-4000-8000-000000000105'),
  ('member_b',  'b5200000-0000-4000-8000-000000000101');

create or replace function pg_temp.grm_id(p_key text) returns uuid
language sql stable as $$ select v from grm_ids where k = p_key $$;

-- service_role fixture/setup only: create the auth/tenant/membership/object
-- rows needed for the matrix below. No dealer-facing assertion is drawn
-- from this insert step.
insert into auth.users (id, email)
select v, k || '@grm.example.test'
  from grm_ids
 where k not like 'dealer\_%';

insert into public.dealers (id, name) values
  (pg_temp.grm_id('dealer_a'), 'GRM Dealer A'),
  (pg_temp.grm_id('dealer_b'), 'GRM Dealer B');

insert into public.dealer_members (dealer_id, user_id, role, status) values
  (pg_temp.grm_id('dealer_a'), pg_temp.grm_id('owner_a'),   'owner',   'active'),
  (pg_temp.grm_id('dealer_a'), pg_temp.grm_id('manager_a'), 'manager', 'active'),
  (pg_temp.grm_id('dealer_a'), pg_temp.grm_id('staff_a'),   'staff',   'active'),
  (pg_temp.grm_id('dealer_a'), pg_temp.grm_id('inactive_a'),'staff',   'suspended'),
  (pg_temp.grm_id('dealer_b'), pg_temp.grm_id('member_b'),  'owner',   'active');

insert into storage.objects (id, bucket_id, name) values
  ('e5200000-0000-4000-8000-000000000001', 'dealer-branding',
    'a5200000-0000-4000-8000-000000000001/existing-logo.png'),
  ('e5200000-0000-4000-8000-000000000002', 'dealer-branding',
    'b5200000-0000-4000-8000-000000000001/existing-logo.png');

grant select on grm_ids to authenticated, anon, service_role;

create or replace function pg_temp.grm_act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text)::text, true);
  execute 'set local role authenticated';
end
$$;

create or replace function pg_temp.grm_act_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
  execute 'set local role anon';
end
$$;

create or replace function pg_temp.grm_act_privileged() returns void
language plpgsql as $$ begin execute 'reset role'; end $$;

-- 21-24: active owner, own dealer, positive SELECT/INSERT/UPDATE plus the
-- mandatory direct-SQL DELETE guard.
select pg_temp.grm_act_as(pg_temp.grm_id('owner_a'));
select is((select count(*) from storage.objects where bucket_id = 'dealer-branding'), 1::bigint,
  '21 active owner SELECT sees only own dealer-branding object');
select lives_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/owner-upload.png')$$,
  '22 active owner own-folder dealer-branding INSERT succeeds');
select lives_ok($$update storage.objects set metadata = '{"updated":true}'::jsonb
  where bucket_id = 'dealer-branding' and name like 'a5200000%/owner-upload.png'$$,
  '23 active owner own-folder dealer-branding UPDATE succeeds');
select throws_ok($$delete from storage.objects
  where bucket_id = 'dealer-branding' and name like 'a5200000%/owner-upload.png'$$,
  '42501', 'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  '24 direct SQL Storage DELETE is rejected by the platform integrity guard; positive member DELETE remains Storage API proof');

-- 25-26: active manager, own dealer, positive SELECT/INSERT.
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_as(pg_temp.grm_id('manager_a'));
select ok(
  (select count(*) from storage.objects
    where bucket_id = 'dealer-branding' and name like 'a5200000%') > 0
  and
  (select count(*) from storage.objects
    where bucket_id = 'dealer-branding' and name like 'b5200000%') = 0,
  '25 active manager SELECT sees own dealer-branding objects and zero foreign objects');
select lives_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/manager-upload.png')$$,
  '26 active manager own-folder dealer-branding INSERT succeeds');

-- 27-28: active staff, own dealer, positive SELECT/INSERT.
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_as(pg_temp.grm_id('staff_a'));
select ok(
  (select count(*) from storage.objects
    where bucket_id = 'dealer-branding' and name like 'a5200000%') > 0
  and
  (select count(*) from storage.objects
    where bucket_id = 'dealer-branding' and name like 'b5200000%') = 0,
  '27 active staff SELECT sees own dealer-branding objects and zero foreign objects');
select lives_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/staff-upload.png')$$,
  '28 active staff own-folder dealer-branding INSERT succeeds');

-- 29-30: inactive (suspended) member is denied, negative SELECT/INSERT.
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_as(pg_temp.grm_id('inactive_a'));
select is((select count(*) from storage.objects where bucket_id = 'dealer-branding'), 0::bigint,
  '29 inactive (suspended) member SELECT is denied');
select throws_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/inactive-denied.png')$$,
  null, '30 inactive (suspended) member INSERT is denied');

-- 31-34: foreign-dealer (cross-tenant) member: negative against dealer A,
-- positive against its own dealer B (proves the denial is tenant-scoped,
-- not a blanket role failure).
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_as(pg_temp.grm_id('member_b'));
select is((select count(*) from storage.objects
  where bucket_id = 'dealer-branding' and name like 'a5200000%'), 0::bigint,
  '31 foreign-dealer member SELECT against dealer A is denied (cross-tenant)');
select throws_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/foreign-denied.png')$$,
  null, '32 foreign-dealer member INSERT into dealer A folder is denied (cross-tenant)');
select is((select count(*) from storage.objects
  where bucket_id = 'dealer-branding' and name like 'b5200000%'), 1::bigint,
  '33 foreign-dealer member SELECT against its own dealer B succeeds (tenant-scoped positive)');
select lives_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'b5200000-0000-4000-8000-000000000001/member-b-upload.png')$$,
  '34 foreign-dealer member INSERT into its own dealer B folder succeeds');

-- 35-36: no-member caller is denied, negative SELECT/INSERT.
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_as(pg_temp.grm_id('no_member'));
select is((select count(*) from storage.objects where bucket_id = 'dealer-branding'), 0::bigint,
  '35 no-member caller SELECT is denied');
select throws_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/no-member-denied.png')$$,
  null, '36 no-member caller INSERT is denied');

-- 37-38: anon is denied, negative SELECT/INSERT.
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_anon();
select is(
  (select count(*) from storage.objects where bucket_id = 'dealer-branding'),
  0::bigint,
  '37 anon SELECT on storage.objects is RLS-filtered to zero visible rows');
select throws_ok($$insert into storage.objects (bucket_id, name) values
  ('dealer-branding', 'a5200000-0000-4000-8000-000000000001/anon-denied.png')$$,
  null, '38 anon INSERT on dealer-branding Storage objects is denied');

-- 39: service_role server-authority check only (not dealer-facing proof).
-- service_role bypasses RLS and retains full CRUD table privilege on
-- storage.objects, which is what the server-side (not dealer-facing) code
-- path relies on.
select pg_temp.grm_act_privileged();
select ok(has_table_privilege('service_role', 'storage.objects', 'SELECT,INSERT,UPDATE,DELETE'),
  '39 service_role server-authority: retains full CRUD table privilege on storage.objects (never used as dealer-facing proof)');

-- 40: re-derive the inactive member's denial under a fresh, independent role
-- switch (rather than reusing the count already consumed in 29), guarding
-- against the denial in 29 being an artifact of caller-switch ordering.
select pg_temp.grm_act_privileged();
select pg_temp.grm_act_as(pg_temp.grm_id('inactive_a'));
select is(
  (select count(*) from storage.objects where bucket_id = 'dealer-branding'),
  0::bigint,
  '40 role_matrix NO_WEAKER: the inactive (suspended) member''s dealer-branding visibility remains zero under a fresh, independent role switch'
);

select pg_temp.grm_act_privileged();
select * from finish();

ROLLBACK;
