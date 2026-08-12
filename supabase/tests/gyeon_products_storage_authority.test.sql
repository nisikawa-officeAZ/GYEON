-- PR2-GATE-B-R4D focused pgTAP candidate.
--
-- NOT EXECUTED IN R4D.  Run only in a fresh disposable local Supabase stack
-- after the migration replay gate is separately approved.  A later runtime
-- gate must additionally prove two-tenant behavior with real local Auth tokens;
-- the request claims used here exercise SQL/RLS and do not replace that proof.

begin;
set local storage.allow_delete_query = 'true';

create schema r4d_pgtap;
create extension if not exists pgtap with schema r4d_pgtap;
grant usage on schema r4d_pgtap to authenticated, service_role;
grant execute on all functions in schema r4d_pgtap to authenticated, service_role;
set local search_path = r4d_pgtap, pg_temp, public, extensions;

select plan(78);

-- Build an independent canonical policy catalog on a shadow table.  Comparing
-- pg_policies rows produced by the same PostgreSQL deparser proves the complete
-- definition (permissiveness, command, target roles, USING, WITH CHECK) without
-- relying on whitespace or a few predicate substrings.
create schema r4d_expected;
create table r4d_expected.objects (bucket_id text, name text);
alter table r4d_expected.objects enable row level security;

do $$
declare
  v_document_authority text := $predicate$
    bucket_id = 'documents'
    and (
      exists (
        select 1 from public.dealer_staff ds
         where ds.user_id = (select auth.uid())
           and ds.dealer_id::text = (storage.foldername(objects.name))[1]
           and ds.status = 'active'
           and ds.role in ('owner', 'manager', 'staff', 'readonly')
      )
      or (
        not exists (
          select 1 from public.dealer_staff ds
           where ds.user_id = (select auth.uid())
             and ds.dealer_id::text = (storage.foldername(objects.name))[1]
        )
        and exists (
          select 1 from public.dealer_members dm
           where dm.user_id = (select auth.uid())
             and dm.dealer_id::text = (storage.foldername(objects.name))[1]
             and dm.status = 'active'
             and dm.role in ('owner', 'manager', 'staff', 'readonly')
        )
      )
    )
  $predicate$;
  v_member_folder text := $predicate$
    bucket_id = %L
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  $predicate$;
  v_resource_read text := $predicate$
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.dealer_members dm
         where dm.user_id = (select auth.uid()) and dm.status = 'active'
      )
      or exists (
        select 1 from public.admin_users au
         where au.user_id = (select auth.uid())
           and au.status = 'active'
           and au.role in ('super_admin', 'gyeon_admin')
      )
    )
  $predicate$;
  v_resource_admin text := $predicate$
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.admin_users au
       where au.user_id = (select auth.uid())
         and au.status = 'active'
         and au.role in ('super_admin', 'gyeon_admin')
    )
  $predicate$;
  v_protected_artifact text := $predicate$
    bucket_id <> 'documents'
    or name !~ '^[^/]+/(invoice|monthly_invoice)/issued/'
  $predicate$;
  r record;
begin
  for r in
    select * from (values
      ('documents_member_read', 'PERMISSIVE', 'SELECT', v_document_authority, null::text),
      ('documents_member_insert', 'PERMISSIVE', 'INSERT', null::text, v_document_authority),
      ('documents_member_update', 'PERMISSIVE', 'UPDATE', v_document_authority, v_document_authority),
      ('documents_protected_artifacts_insert', 'RESTRICTIVE', 'INSERT', null::text, v_protected_artifact),
      ('documents_protected_artifacts_update', 'RESTRICTIVE', 'UPDATE', v_protected_artifact, v_protected_artifact),
      ('work_order_files_member_select', 'PERMISSIVE', 'SELECT', format(v_member_folder, 'work-order-files'), null::text),
      ('work_order_files_member_insert', 'PERMISSIVE', 'INSERT', null::text, format(v_member_folder, 'work-order-files')),
      ('vehicle_registration_documents_member_select', 'PERMISSIVE', 'SELECT', format(v_member_folder, 'vehicle-registration-documents'), null::text),
      ('vehicle_registration_documents_member_insert', 'PERMISSIVE', 'INSERT', null::text, format(v_member_folder, 'vehicle-registration-documents')),
      ('dealer_branding_member_select', 'PERMISSIVE', 'SELECT', format(v_member_folder, 'dealer-branding'), null::text),
      ('dealer_branding_member_insert', 'PERMISSIVE', 'INSERT', null::text, format(v_member_folder, 'dealer-branding')),
      ('dealer_branding_member_update', 'PERMISSIVE', 'UPDATE', format(v_member_folder, 'dealer-branding'), format(v_member_folder, 'dealer-branding')),
      ('dealer_branding_member_delete', 'PERMISSIVE', 'DELETE', format(v_member_folder, 'dealer-branding'), null::text),
      ('gyeon_resources_member_or_admin_select', 'PERMISSIVE', 'SELECT', v_resource_read, null::text),
      ('gyeon_resources_admin_insert', 'PERMISSIVE', 'INSERT', null::text, v_resource_admin),
      ('gyeon_resources_admin_update', 'PERMISSIVE', 'UPDATE', v_resource_admin, v_resource_admin),
      ('gyeon_resources_admin_delete', 'PERMISSIVE', 'DELETE', v_resource_admin, null::text)
    ) as expected(policyname, permissive, cmd, qual, with_check)
  loop
    execute format(
      'create policy %I on r4d_expected.objects as %s for %s to authenticated%s%s',
      r.policyname,
      r.permissive,
      r.cmd,
      case when r.qual is null then '' else format(' using (%s)', r.qual) end,
      case when r.with_check is null then '' else format(' with check (%s)', r.with_check) end
    );
  end loop;
end
$$;

-- Privileged fixtures.  The enclosing transaction is always rolled back.
create temp table r4d_ids (k text primary key, v uuid not null);
insert into r4d_ids (k, v) values
  ('dealer_a',   'a4100000-0000-4000-8000-000000000001'),
  ('dealer_b',   'b4100000-0000-4000-8000-000000000001'),
  ('active_a',   'a4100000-0000-4000-8000-000000000101'),
  ('active_b',   'b4100000-0000-4000-8000-000000000101'),
  ('invited_a',  'a4100000-0000-4000-8000-000000000102'),
  ('suspended_a','a4100000-0000-4000-8000-000000000103'),
  ('removed_a',  'a4100000-0000-4000-8000-000000000104'),
  ('no_member',  'a4100000-0000-4000-8000-000000000105'),
  ('admin',      'a4100000-0000-4000-8000-000000000106');

create or replace function pg_temp.r4d_id(p_key text) returns uuid
language sql stable as $$ select v from r4d_ids where k = p_key $$;

insert into auth.users (id, email)
select v, k || '@r4d.example.test'
  from r4d_ids
 where k not like 'dealer\_%';

insert into public.dealers (id, name) values
  (pg_temp.r4d_id('dealer_a'), 'R4D Dealer A'),
  (pg_temp.r4d_id('dealer_b'), 'R4D Dealer B');

insert into public.dealer_members (dealer_id, user_id, role, status) values
  (pg_temp.r4d_id('dealer_a'), pg_temp.r4d_id('active_a'), 'owner', 'active'),
  (pg_temp.r4d_id('dealer_b'), pg_temp.r4d_id('active_b'), 'owner', 'active'),
  (pg_temp.r4d_id('dealer_a'), pg_temp.r4d_id('invited_a'), 'staff', 'invited'),
  (pg_temp.r4d_id('dealer_a'), pg_temp.r4d_id('suspended_a'), 'staff', 'suspended'),
  (pg_temp.r4d_id('dealer_a'), pg_temp.r4d_id('removed_a'), 'staff', 'removed');

insert into public.admin_users (user_id, email, name, role, status) values
  (pg_temp.r4d_id('admin'), 'admin@r4d.example.test', 'R4D Admin', 'gyeon_admin', 'active');

insert into public.gyeon_products (id, sku, product_name)
values ('c4100000-0000-4000-8000-000000000001', 'R4D-SKU-1', 'R4D Product');

insert into storage.objects (id, bucket_id, name) values
  ('d4100000-0000-4000-8000-000000000008', 'documents',
    'a4100000-0000-4000-8000-000000000001/existing-document.pdf'),
  ('d4100000-0000-4000-8000-000000000009', 'documents',
    'b4100000-0000-4000-8000-000000000001/existing-document.pdf'),
  ('d4100000-0000-4000-8000-000000000001', 'work-order-files',
    'a4100000-0000-4000-8000-000000000001/existing-work.jpg'),
  ('d4100000-0000-4000-8000-000000000002', 'work-order-files',
    'b4100000-0000-4000-8000-000000000001/existing-work.jpg'),
  ('d4100000-0000-4000-8000-000000000003', 'vehicle-registration-documents',
    'a4100000-0000-4000-8000-000000000001/existing-registration.jpg'),
  ('d4100000-0000-4000-8000-000000000004', 'vehicle-registration-documents',
    'b4100000-0000-4000-8000-000000000001/existing-registration.jpg'),
  ('d4100000-0000-4000-8000-000000000005', 'dealer-branding',
    'a4100000-0000-4000-8000-000000000001/existing-logo.png'),
  ('d4100000-0000-4000-8000-000000000006', 'dealer-branding',
    'b4100000-0000-4000-8000-000000000001/existing-logo.png'),
  ('d4100000-0000-4000-8000-000000000007', 'gyeon-resources', 'existing-resource.pdf');

grant select on r4d_ids to authenticated, anon, service_role;

create or replace function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text)::text, true);
  execute 'set local role authenticated';
end
$$;

create or replace function pg_temp.act_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}'::text, true);
  execute 'set local role anon';
end
$$;

create or replace function pg_temp.act_privileged() returns void
language plpgsql as $$ begin execute 'reset role'; end $$;

-- 01-14: gyeon_products contract and ACL surface.
select ok((select relrowsecurity from pg_class where oid = 'public.gyeon_products'::regclass),
  '01 gyeon_products RLS is enabled');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'gyeon_products'),
  1::bigint, '02 exactly one gyeon_products policy exists');
select is((select policyname from pg_policies where schemaname = 'public' and tablename = 'gyeon_products'),
  'gyeon_products_active_member_select', '03 product policy has canonical name');
select is((select cmd from pg_policies where schemaname = 'public' and tablename = 'gyeon_products'),
  'SELECT', '04 product policy is SELECT only');
select ok((select roles = array['authenticated']::name[] from pg_policies
  where schemaname = 'public' and tablename = 'gyeon_products'),
  '05 product policy targets authenticated explicitly');
select ok((select qual ilike '%dealer_members%' and qual ilike '%status%active%'
  from pg_policies where schemaname = 'public' and tablename = 'gyeon_products'),
  '06 product predicate requires active dealer_members');
select ok((select qual ilike '%auth.uid%' from pg_policies
  where schemaname = 'public' and tablename = 'gyeon_products'),
  '07 product predicate is bound to auth.uid');
select ok((select qual not ilike '%auth.role%' from pg_policies
  where schemaname = 'public' and tablename = 'gyeon_products'),
  '08 product predicate does not authorize by auth.role');
select ok(has_table_privilege('authenticated', 'public.gyeon_products', 'SELECT'),
  '09 authenticated has product SELECT');
select ok(not has_table_privilege('authenticated', 'public.gyeon_products', 'INSERT'),
  '10 authenticated has no product INSERT');
select ok(not has_table_privilege('authenticated', 'public.gyeon_products', 'UPDATE'),
  '11 authenticated has no product UPDATE');
select ok(not has_table_privilege('authenticated', 'public.gyeon_products', 'DELETE'),
  '12 authenticated has no product DELETE');
select ok(not has_table_privilege('anon', 'public.gyeon_products', 'SELECT'),
  '13 anon has no product SELECT');
select ok(has_table_privilege('service_role', 'public.gyeon_products', 'SELECT,INSERT,UPDATE,DELETE'),
  '14 service_role retains product CRUD');

-- 15-21: exact canonical bucket configuration.
select results_eq($$select id::text from storage.buckets order by id$$,
  array['dealer-branding','documents','gyeon-resources','vehicle-registration-documents','work-order-files']::text[],
  '15 the complete Storage catalog is exactly the five canonical buckets');
select ok(exists(select 1 from storage.buckets where id='documents' and name='documents'
  and public=false and file_size_limit=52428800 and allowed_mime_types=array['application/pdf']::text[]),
  '16 documents configuration is exact');
select ok(exists(select 1 from storage.buckets where id='work-order-files' and name='work-order-files'
  and public=false and file_size_limit=20971520
  and allowed_mime_types=array['image/*','application/pdf','video/mp4','video/quicktime']::text[]),
  '17 work-order-files configuration is exact');
select ok(exists(select 1 from storage.buckets where id='vehicle-registration-documents'
  and name='vehicle-registration-documents' and public=false and file_size_limit=20971520
  and allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf']::text[]),
  '18 vehicle registration configuration is exact');
select ok(exists(select 1 from storage.buckets where id='dealer-branding' and name='dealer-branding'
  and public=true and file_size_limit=5242880 and allowed_mime_types=array['image/png']::text[]),
  '19 dealer-branding configuration is exact');
select ok(exists(select 1 from storage.buckets where id='gyeon-resources' and name='gyeon-resources'
  and public=false and file_size_limit=104857600 and allowed_mime_types is null),
  '20 gyeon-resources configuration is exact');
select is((select count(*) from storage.buckets where id='completion-reports'), 0::bigint,
  '21 completion-reports is absent');

-- 22-33: exact Storage policy matrix and legacy-name removal.
select results_eq(
  $$select policyname::text, permissive::text, roles::text, cmd::text,
           coalesce(qual, '')::text, coalesce(with_check, '')::text
      from pg_policies
     where schemaname='storage' and tablename='objects'
     order by policyname$$,
  $$select policyname::text, permissive::text, roles::text, cmd::text,
           coalesce(qual, '')::text, coalesce(with_check, '')::text
      from pg_policies
     where schemaname='r4d_expected' and tablename='objects'
     order by policyname$$,
  '22 all seventeen Storage policy definitions exactly match the canonical catalog');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'),
  17::bigint, '23 exact Storage policy count is seventeen, including two accepted restrictive document guards');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('Dealer members can upload work order files','Dealer members can read their work order files',
   'Dealer members can delete their work order files','dealer_branding_public_read','dealer_branding_member_read',
   'dealer_branding_member_write',
   'gyeon_resources_read','gyeon_resources_admin_write')),
  0::bigint, '24 legacy Storage policy names are absent');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('work_order_files_member_select','work_order_files_member_insert',
   'vehicle_registration_documents_member_select','vehicle_registration_documents_member_insert',
   'dealer_branding_member_select','dealer_branding_member_insert','dealer_branding_member_update',
   'dealer_branding_member_delete','gyeon_resources_member_or_admin_select','gyeon_resources_admin_insert',
   'gyeon_resources_admin_update','gyeon_resources_admin_delete')
  and roles <> array['authenticated']::name[]),
  '25 every R4D-created Storage policy targets authenticated');
select results_eq($$select cmd from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like 'work_order_files_member_%' order by cmd$$,
  array['INSERT','SELECT']::text[], '26 work-order-files has SELECT and INSERT only');
select results_eq($$select cmd from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like 'vehicle_registration_documents_member_%' order by cmd$$,
  array['INSERT','SELECT']::text[], '27 vehicle registration has SELECT and INSERT only');
select results_eq($$select cmd from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like 'dealer_branding_member_%' order by cmd$$,
  array['DELETE','INSERT','SELECT','UPDATE']::text[], '28 dealer-branding has its accepted upsert/delete matrix');
select results_eq($$select cmd from pg_policies where schemaname='storage' and tablename='objects'
  and policyname like 'gyeon_resources_%' order by cmd$$,
  array['DELETE','INSERT','SELECT','UPDATE']::text[], '29 gyeon-resources has read plus admin write matrix');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('documents_member_read','documents_member_insert','documents_member_update',
   'work_order_files_member_select','work_order_files_member_insert',
   'vehicle_registration_documents_member_select','vehicle_registration_documents_member_insert')
  and cmd='DELETE'), '30 documents/work-order/vehicle expose no authenticated DELETE');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('work_order_files_member_insert','vehicle_registration_documents_member_insert',
   'dealer_branding_member_insert','gyeon_resources_admin_insert') and with_check is null),
  '31 every R4D INSERT policy has WITH CHECK');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('dealer_branding_member_update','gyeon_resources_admin_update')
  and (qual is null or with_check is null)), '32 every R4D UPDATE has USING and WITH CHECK');
select ok((select qual ilike '%super_admin%' and qual ilike '%gyeon_admin%'
  from pg_policies where schemaname='storage' and tablename='objects'
   and policyname='gyeon_resources_admin_delete'),
  '33 resource mutation authority is limited to accepted admin roles');

-- 34-43: shared-product behavior by caller state.
select pg_temp.act_as(pg_temp.r4d_id('active_a'));
select is((select count(*) from public.gyeon_products), 1::bigint,
  '34 active dealer A reads the shared product');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('active_b'));
select is((select count(*) from public.gyeon_products), 1::bigint,
  '35 active dealer B reads the same shared product');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('invited_a'));
select is((select count(*) from public.gyeon_products), 0::bigint, '36 invited member is denied');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('suspended_a'));
select is((select count(*) from public.gyeon_products), 0::bigint, '37 suspended member is denied');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('removed_a'));
select is((select count(*) from public.gyeon_products), 0::bigint, '38 removed member is denied');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('no_member'));
select is((select count(*) from public.gyeon_products), 0::bigint, '39 no-member caller is denied');
select pg_temp.act_privileged();
select pg_temp.act_anon();
select throws_ok($$select count(*) from public.gyeon_products$$, null, '40 anon product SELECT is denied');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('active_a'));
select throws_ok($$insert into public.gyeon_products (sku, product_name) values ('R4D-DENY','Denied')$$,
  null, '41 authenticated product INSERT is denied');
select throws_ok($$update public.gyeon_products set product_name='Denied' where sku='R4D-SKU-1'$$,
  null, '42 authenticated product UPDATE is denied');
select throws_ok($$delete from public.gyeon_products where sku='R4D-SKU-1'$$,
  null, '43 authenticated product DELETE is denied');

-- 44-49: accepted documents upsert matrix and no-delete boundary.
select is((select count(*) from storage.objects where bucket_id='documents'), 1::bigint,
  '44 active dealer sees only own documents object');
select is((select count(*) from storage.objects where bucket_id='documents'
  and name like 'b4100000%'), 0::bigint, '45 cross-tenant documents read is denied');
select lives_ok($$insert into storage.objects (bucket_id,name) values
  ('documents','a4100000-0000-4000-8000-000000000001/new-document.pdf')$$,
  '46 own-folder documents INSERT succeeds');
select lives_ok($$update storage.objects set metadata='{"updated":true}'::jsonb
  where bucket_id='documents' and name like 'a4100000%/new-document.pdf'$$,
  '47 own-folder documents UPDATE succeeds');
select throws_ok($$insert into storage.objects (bucket_id,name) values
  ('documents','b4100000-0000-4000-8000-000000000001/cross-document.pdf')$$,
  null, '48 cross-tenant documents INSERT is denied');
with attempted as (
  delete from storage.objects where bucket_id='documents' returning id
)
select ok(
  (select count(*) = 0 from attempted)
  and exists(select 1 from storage.objects
              where id='d4100000-0000-4000-8000-000000000008'),
  '49 documents DELETE affects zero rows and the original object remains');

-- 50-54: work-order-files tenant isolation and immutable upload authority.
select is((select count(*) from storage.objects where bucket_id='work-order-files'), 1::bigint,
  '50 active dealer sees only own work-order object');
select is((select count(*) from storage.objects where bucket_id='work-order-files'
  and name like 'b4100000%'), 0::bigint, '51 cross-tenant work-order read is denied');
select lives_ok($$insert into storage.objects (bucket_id,name) values
  ('work-order-files','a4100000-0000-4000-8000-000000000001/new-work.jpg')$$,
  '52 own-folder work-order INSERT succeeds');
select throws_ok($$insert into storage.objects (bucket_id,name) values
  ('work-order-files','b4100000-0000-4000-8000-000000000001/cross-work.jpg')$$,
  null, '53 cross-tenant work-order INSERT is denied');
with attempted as (
  delete from storage.objects where bucket_id='work-order-files' returning id
)
select ok(
  (select count(*) = 0 from attempted)
  and exists(select 1 from storage.objects
              where id='d4100000-0000-4000-8000-000000000001'),
  '54 work-order DELETE affects zero rows and the original object remains');

-- 55-59: vehicle-registration-documents tenant isolation.
select is((select count(*) from storage.objects where bucket_id='vehicle-registration-documents'), 1::bigint,
  '55 active dealer sees only own registration object');
select is((select count(*) from storage.objects where bucket_id='vehicle-registration-documents'
  and name like 'b4100000%'), 0::bigint, '56 cross-tenant registration read is denied');
select lives_ok($$insert into storage.objects (bucket_id,name) values
  ('vehicle-registration-documents','a4100000-0000-4000-8000-000000000001/new-registration.jpg')$$,
  '57 own-folder registration INSERT succeeds');
select throws_ok($$insert into storage.objects (bucket_id,name) values
  ('vehicle-registration-documents','b4100000-0000-4000-8000-000000000001/cross-registration.jpg')$$,
  null, '58 cross-tenant registration INSERT is denied');
with attempted as (
  update storage.objects set metadata='{"blocked":true}'::jsonb
   where bucket_id='vehicle-registration-documents'
  returning id
)
select ok(
  (select count(*) = 0 from attempted)
  and exists(select 1 from storage.objects
              where id='d4100000-0000-4000-8000-000000000003'
                and metadata is null),
  '59 vehicle UPDATE affects zero rows and the original metadata remains unchanged');

-- 60-64: dealer-branding accepted public-delivery/upsert/delete source matrix.
select is((select count(*) from storage.objects where bucket_id='dealer-branding'), 1::bigint,
  '60 active dealer direct SELECT is own-folder scoped');
select is((select count(*) from storage.objects where bucket_id='dealer-branding'
  and name like 'b4100000%'), 0::bigint, '61 cross-tenant branding direct read is denied');
select lives_ok($$insert into storage.objects (bucket_id,name) values
  ('dealer-branding','a4100000-0000-4000-8000-000000000001/new-logo.png')$$,
  '62 own-folder branding INSERT succeeds');
select lives_ok($$update storage.objects set metadata='{"updated":true}'::jsonb
  where bucket_id='dealer-branding' and name like 'a4100000%/new-logo.png'$$,
  '63 own-folder branding UPDATE succeeds');
select lives_ok($$delete from storage.objects where bucket_id='dealer-branding'
  and name like 'a4100000%/new-logo.png'$$, '64 own-folder branding DELETE succeeds');

-- 65-70: global resource read, dealer write denial, and admin CRUD.
select is((select count(*) from storage.objects where bucket_id='gyeon-resources'), 1::bigint,
  '65 active dealer reads GYEON resources');
select throws_ok($$insert into storage.objects (bucket_id,name)
  values ('gyeon-resources','dealer-denied.pdf')$$, null, '66 ordinary dealer resource INSERT is denied');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('admin'));
select is((select count(*) from storage.objects where bucket_id='gyeon-resources'), 1::bigint,
  '67 active accepted admin reads GYEON resources');
select lives_ok($$insert into storage.objects (bucket_id,name)
  values ('gyeon-resources','admin-created.pdf')$$, '68 accepted admin resource INSERT succeeds');
select lives_ok($$update storage.objects set metadata='{"updated":true}'::jsonb
  where bucket_id='gyeon-resources' and name='admin-created.pdf'$$,
  '69 accepted admin resource UPDATE succeeds');
select lives_ok($$delete from storage.objects where bucket_id='gyeon-resources'
  and name='admin-created.pdf'$$, '70 accepted admin resource DELETE succeeds');

-- 71-78: inactive, no-member, and anonymous Storage actors fail closed.
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('invited_a'));
select is((select count(*) from storage.objects where bucket_id='work-order-files'), 0::bigint,
  '71 invited member cannot read Storage objects');
select throws_ok($$insert into storage.objects (bucket_id,name) values
  ('work-order-files','a4100000-0000-4000-8000-000000000001/invited-denied.jpg')$$,
  null, '72 invited member cannot insert Storage objects');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('suspended_a'));
select is((select count(*) from storage.objects where bucket_id='work-order-files'), 0::bigint,
  '73 suspended member cannot read Storage objects');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('removed_a'));
select is((select count(*) from storage.objects where bucket_id='work-order-files'), 0::bigint,
  '74 removed member cannot read Storage objects');
select pg_temp.act_privileged();
select pg_temp.act_as(pg_temp.r4d_id('no_member'));
select is((select count(*) from storage.objects where bucket_id='work-order-files'), 0::bigint,
  '75 no-member caller cannot read Storage objects');
select throws_ok($$insert into storage.objects (bucket_id,name) values
  ('work-order-files','a4100000-0000-4000-8000-000000000001/no-member-denied.jpg')$$,
  null, '76 no-member caller cannot insert Storage objects');
select pg_temp.act_privileged();
select pg_temp.act_anon();
select is((select count(*) from storage.objects where bucket_id='work-order-files'), 0::bigint,
  '77 anonymous caller cannot read Storage objects');
select throws_ok($$insert into storage.objects (bucket_id,name) values
  ('work-order-files','a4100000-0000-4000-8000-000000000001/anon-denied.jpg')$$,
  null, '78 anonymous caller cannot insert Storage objects');

select pg_temp.act_privileged();
select * from finish();
rollback;
