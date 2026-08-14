-- PR2-GATE-B-R4D — canonical GYEON product read authority and Storage policy/configuration candidate.
--
-- This migration is intentionally fail-closed.  The retired completion-reports
-- bucket must be removed by an independently approved operation before this
-- migration may run.  This migration never deletes that bucket or its objects.

begin;

do $$
begin
  if exists (
    select 1
      from storage.buckets
     where id = 'completion-reports'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'R4D_COMPLETION_REPORTS_BUCKET_PRESENT',
      detail = 'Remove or archive completion-reports through a separately approved operation before applying R4D.';
  end if;

  if exists (
    select 1
      from storage.buckets
     where id not in (
       'documents',
       'work-order-files',
       'vehicle-registration-documents',
       'dealer-branding',
       'gyeon-resources'
     )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'R4D_UNEXPECTED_STORAGE_BUCKET_PRESENT',
      detail = 'R4D never deletes or mutates unratified buckets; reconcile the catalog through a separately approved operation.';
  end if;
end
$$;

-- Canonical bucket configuration.  Object mutation is deliberately absent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 52428800, array['application/pdf']::text[]),
  -- Do not widen this list to application/octet-stream.  The current
  -- uploadWorkOrderFile() fallback for an empty browser MIME is an accepted
  -- APPLICATION_SOURCE blocker: a later source-only phase must
  -- validate/normalize the actual bytes to one of these types or fail closed.
  ('work-order-files', 'work-order-files', false, 20971520,
    array['image/*', 'application/pdf', 'video/mp4', 'video/quicktime']::text[]),
  ('vehicle-registration-documents', 'vehicle-registration-documents', false, 20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]),
  ('dealer-branding', 'dealer-branding', true, 5242880, array['image/png']::text[]),
  ('gyeon-resources', 'gyeon-resources', false, 104857600, null)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- gyeon_products is a global shared product master.  Authenticated access is
-- read-only and requires at least one active dealer membership.
drop policy if exists "Authenticated users can read gyeon_products" on public.gyeon_products;
drop policy if exists "gyeon_products_active_member_select" on public.gyeon_products;

create policy "gyeon_products_active_member_select"
  on public.gyeon_products
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
    )
  );

revoke all privileges on table public.gyeon_products from public, anon, authenticated, service_role;
grant select on table public.gyeon_products to authenticated;
grant select, insert, update, delete on table public.gyeon_products to service_role;

-- Remove known historical/manual policy names before creating the canonical
-- explicit authenticated policy set.
drop policy if exists "Dealer members can upload work order files" on storage.objects;
drop policy if exists "Dealer members can read their work order files" on storage.objects;
drop policy if exists "Dealer members can delete their work order files" on storage.objects;
drop policy if exists "work_order_files_member_select" on storage.objects;
drop policy if exists "work_order_files_member_insert" on storage.objects;

drop policy if exists "vehicle_registration_documents_member_select" on storage.objects;
drop policy if exists "vehicle_registration_documents_member_insert" on storage.objects;

drop policy if exists "dealer_branding_public_read" on storage.objects;
drop policy if exists "dealer_branding_member_read" on storage.objects;
drop policy if exists "dealer_branding_member_write" on storage.objects;
drop policy if exists "dealer_branding_member_update" on storage.objects;
drop policy if exists "dealer_branding_member_delete" on storage.objects;
drop policy if exists "dealer_branding_member_select" on storage.objects;
drop policy if exists "dealer_branding_member_insert" on storage.objects;

drop policy if exists "gyeon_resources_read" on storage.objects;
drop policy if exists "gyeon_resources_admin_write" on storage.objects;
drop policy if exists "gyeon_resources_admin_update" on storage.objects;
drop policy if exists "gyeon_resources_admin_delete" on storage.objects;
drop policy if exists "gyeon_resources_member_or_admin_select" on storage.objects;
drop policy if exists "gyeon_resources_admin_insert" on storage.objects;

-- work-order-files: current application writes immutable names (upsert=false),
-- so authenticated authority is intentionally limited to SELECT and INSERT.
create policy "work_order_files_member_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'work-order-files'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "work_order_files_member_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'work-order-files'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

-- vehicle-registration-documents: immutable upload path; archive/delete remains
-- blocked until its separate source repair is accepted.
create policy "vehicle_registration_documents_member_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'vehicle-registration-documents'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "vehicle_registration_documents_member_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-registration-documents'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

-- dealer-branding is publicly delivered by the bucket setting.  Direct
-- authenticated object operations remain dealer-folder scoped; upsert=true
-- requires SELECT, INSERT, and UPDATE, and the accepted source also deletes.
create policy "dealer_branding_member_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'dealer-branding'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "dealer_branding_member_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'dealer-branding'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "dealer_branding_member_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'dealer-branding'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  )
  with check (
    bucket_id = 'dealer-branding'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "dealer_branding_member_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'dealer-branding'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.dealer_members dm
       where dm.user_id = (select auth.uid())
         and dm.status = 'active'
         and dm.dealer_id::text = (storage.foldername(objects.name))[1]
    )
  );

-- gyeon-resources is globally readable to active dealers and active admins,
-- but only active super_admin/gyeon_admin identities may mutate objects.
create policy "gyeon_resources_member_or_admin_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and (
      exists (
        select 1
          from public.dealer_members dm
         where dm.user_id = (select auth.uid())
           and dm.status = 'active'
      )
      or exists (
        select 1
          from public.admin_users au
         where au.user_id = (select auth.uid())
           and au.status = 'active'
           and au.role in ('super_admin', 'gyeon_admin')
      )
    )
  );

create policy "gyeon_resources_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.admin_users au
       where au.user_id = (select auth.uid())
         and au.status = 'active'
         and au.role in ('super_admin', 'gyeon_admin')
    )
  );

create policy "gyeon_resources_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.admin_users au
       where au.user_id = (select auth.uid())
         and au.status = 'active'
         and au.role in ('super_admin', 'gyeon_admin')
    )
  )
  with check (
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.admin_users au
       where au.user_id = (select auth.uid())
         and au.status = 'active'
         and au.role in ('super_admin', 'gyeon_admin')
    )
  );

create policy "gyeon_resources_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'gyeon-resources'
    and (select auth.uid()) is not null
    and exists (
      select 1
        from public.admin_users au
       where au.user_id = (select auth.uid())
         and au.status = 'active'
         and au.role in ('super_admin', 'gyeon_admin')
    )
  );

commit;
