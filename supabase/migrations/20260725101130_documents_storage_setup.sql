-- Migration: documents_storage_setup  (phase R94T-B)
--
-- Scope: storage.objects RLS policies ONLY for the private `documents` bucket.
--
-- Bucket creation is intentionally NOT performed here. The `documents` bucket is
-- API/Dashboard-managed (id/name=documents, public=false, file_size_limit=52428800,
-- allowed_mime_types={application/pdf}) and is created out-of-band via the official
-- Storage API or Dashboard. This migration owns only the storage.objects RLS
-- policies and performs no DML on storage.buckets or storage.objects.
--
-- Application access model: PDF regeneration uses upsert:true, whose overwrite
-- path performs SELECT (locate existing object) + INSERT (create) + UPDATE
-- (overwrite). Therefore SELECT, INSERT and UPDATE member policies are all
-- required. No authenticated DELETE policy is needed: deletes/removals in the
-- executable code use the admin/service-role client, which bypasses RLS.
--
-- Every policy is TO authenticated and uses the identical dealer-folder
-- authorization predicate (active dealer membership matching the object's
-- top-level folder = dealer_id). No public/anon access.

-- Idempotent removal of legacy/current policy names.
DROP POLICY IF EXISTS "documents_read_own_dealer" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_own_dealer" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_own_dealer" ON storage.objects;
DROP POLICY IF EXISTS "documents_member_read" ON storage.objects;
DROP POLICY IF EXISTS "documents_member_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_member_update" ON storage.objects;

-- Policy A: SELECT (read) — dealer members may read objects in their dealer folder.
CREATE POLICY "documents_member_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
        AND dm.dealer_id::text = (storage.foldername(name))[1]
    )
  );

-- Policy B: INSERT (create) — dealer members may create objects in their dealer folder.
CREATE POLICY "documents_member_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
        AND dm.dealer_id::text = (storage.foldername(name))[1]
    )
  );

-- Policy C: UPDATE (overwrite) — both USING and WITH CHECK confine old and new rows.
CREATE POLICY "documents_member_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
        AND dm.dealer_id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1
      FROM public.dealer_members AS dm
      WHERE dm.user_id = (SELECT auth.uid())
        AND dm.status = 'active'
        AND dm.dealer_id::text = (storage.foldername(name))[1]
    )
  );
