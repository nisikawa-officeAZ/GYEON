-- DEALEROS-ESTIMATE-INVOICE-PDF-B1-V2-R1 — fail-closed documents Storage authorization.
--
-- Successor to 20260725101130_documents_storage_setup.sql, which is HISTORICAL
-- and must never be edited. That migration's three policies authorized on an
-- active dealer_members row alone, so an invited or disabled canonical
-- dealer_staff identity whose membership row was still active kept direct
-- authenticated Storage access to its dealer folder — exactly the fallback hole
-- the accepted B1-R5 invoice policies close for invoices and invoice_items.
--
-- This migration re-creates the SAME three policies with the R5 two-branch rule:
--
--   PRIMARY : the caller's dealer_staff row for the folder's dealer must be
--             status 'active' with a recognized role. A dealer_staff row that
--             exists in ANY other state (invited, disabled, unknown) is
--             authoritative and DENIES — it never falls through.
--   FALLBACK: only when NO dealer_staff row of any status or role exists for
--             the caller in that dealer, an ACTIVE dealer_members row with a
--             recognized role may stand in (pre-staff-table tenants).
--
-- Everything else the accepted contract fixed stays fixed:
--   * bucket_id = 'documents' and the first folder segment must equal the
--     authorized dealer's UUID rendered as text — folder isolation unchanged;
--   * SELECT / INSERT / UPDATE only, because the application's upsert model
--     needs all three; there is still NO authenticated DELETE policy —
--     deletions remain service-role-only and bypass RLS;
--   * auth.uid() stays wrapped in a scalar subselect; no auth.role(), no
--     SECURITY DEFINER helper, no service-role-specific policy;
--   * no bucket creation, no storage.buckets mutation, no storage.objects DML —
--     the bucket itself remains API/Dashboard-managed out of band.
--
-- The outer object path is always referenced with the QUALIFIED form
-- "objects.name". dealer_staff itself has a `name` column, so an unqualified
-- `name` inside its EXISTS subqueries is captured by ds.name and silently
-- voids both the canonical branch and the absence gate (proven live in
-- B1-V2-R2, environment d76c0a0c).
--
-- Under caller RLS the subqueries behave exactly as proven for B1-R5:
-- dm_self_select (104) always shows the caller their own membership row, and
-- dealer_staff rows are visible to active members of the dealer
-- (dealer_staff_select) — every combination that hides an existing dealer_staff
-- row also fails the fallback branch's active-membership demand, so each
-- visibility mismatch denies rather than falls open.

drop policy if exists "documents_member_read" on storage.objects;
drop policy if exists "documents_member_insert" on storage.objects;
drop policy if exists "documents_member_update" on storage.objects;

create policy "documents_member_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      exists (
        select 1
          from public.dealer_staff ds
         where ds.user_id = (select auth.uid())
           and ds.dealer_id::text = (storage.foldername(objects.name))[1]
           and ds.status = 'active'
           and ds.role in ('owner', 'manager', 'staff', 'readonly')
      )
      or (
        not exists (
          select 1
            from public.dealer_staff ds
           where ds.user_id = (select auth.uid())
             and ds.dealer_id::text = (storage.foldername(objects.name))[1]
        )
        and exists (
          select 1
            from public.dealer_members dm
           where dm.user_id = (select auth.uid())
             and dm.dealer_id::text = (storage.foldername(objects.name))[1]
             and dm.status = 'active'
             and dm.role in ('owner', 'manager', 'staff', 'readonly')
        )
      )
    )
  );

create policy "documents_member_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (
      exists (
        select 1
          from public.dealer_staff ds
         where ds.user_id = (select auth.uid())
           and ds.dealer_id::text = (storage.foldername(objects.name))[1]
           and ds.status = 'active'
           and ds.role in ('owner', 'manager', 'staff', 'readonly')
      )
      or (
        not exists (
          select 1
            from public.dealer_staff ds
           where ds.user_id = (select auth.uid())
             and ds.dealer_id::text = (storage.foldername(objects.name))[1]
        )
        and exists (
          select 1
            from public.dealer_members dm
           where dm.user_id = (select auth.uid())
             and dm.dealer_id::text = (storage.foldername(objects.name))[1]
             and dm.status = 'active'
             and dm.role in ('owner', 'manager', 'staff', 'readonly')
        )
      )
    )
  );

create policy "documents_member_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      exists (
        select 1
          from public.dealer_staff ds
         where ds.user_id = (select auth.uid())
           and ds.dealer_id::text = (storage.foldername(objects.name))[1]
           and ds.status = 'active'
           and ds.role in ('owner', 'manager', 'staff', 'readonly')
      )
      or (
        not exists (
          select 1
            from public.dealer_staff ds
           where ds.user_id = (select auth.uid())
             and ds.dealer_id::text = (storage.foldername(objects.name))[1]
        )
        and exists (
          select 1
            from public.dealer_members dm
           where dm.user_id = (select auth.uid())
             and dm.dealer_id::text = (storage.foldername(objects.name))[1]
             and dm.status = 'active'
             and dm.role in ('owner', 'manager', 'staff', 'readonly')
        )
      )
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      exists (
        select 1
          from public.dealer_staff ds
         where ds.user_id = (select auth.uid())
           and ds.dealer_id::text = (storage.foldername(objects.name))[1]
           and ds.status = 'active'
           and ds.role in ('owner', 'manager', 'staff', 'readonly')
      )
      or (
        not exists (
          select 1
            from public.dealer_staff ds
           where ds.user_id = (select auth.uid())
             and ds.dealer_id::text = (storage.foldername(objects.name))[1]
        )
        and exists (
          select 1
            from public.dealer_members dm
           where dm.user_id = (select auth.uid())
             and dm.dealer_id::text = (storage.foldername(objects.name))[1]
             and dm.status = 'active'
             and dm.role in ('owner', 'manager', 'staff', 'readonly')
        )
      )
    )
  );
