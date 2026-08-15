-- Migration: security_advisor_hardening  (phase R94M)
--
-- Closes the HARDENING advisor findings from R94J/R94K-H2 without touching any
-- INTENTIONAL_AND_JUSTIFIED object (no change to wiz_*/get_next_document_number
-- EXECUTE grants; no change to the platform rls_auto_enable/ensure_rls trigger).
--
-- (0025) dealer-branding: replace the broad public-listing SELECT policy with a
-- dealer-member-scoped SELECT policy. Public object URLs continue to serve via the
-- public-bucket path (independent of this policy); the scoped SELECT restores the
-- authenticated read that upload upsert:true overwrite requires, limited to the
-- caller's own active dealer folder. INSERT/UPDATE/DELETE member policies unchanged.
--
-- (0011) pin search_path = pg_catalog on the eight flagged functions (7 updated_at
-- trigger fns + wiz_is_wizard_estimate). ALTER FUNCTION ... SET search_path changes
-- only the config; bodies, ownership, security mode and grants are untouched.

DROP POLICY "dealer_branding_public_read" ON storage.objects;

CREATE POLICY "dealer_branding_member_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dealer-branding'
    AND (storage.foldername(name))[1] IN (
      SELECT dm.dealer_id::text
      FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid()
        AND dm.status = 'active'
    )
  );

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog;

ALTER FUNCTION public.update_staging_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION public.update_uat_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION public.update_billing_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION public.update_vehicle_registration_files_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION public.update_ocr_sessions_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION public.update_dealer_stock_levels_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION public.wiz_is_wizard_estimate(text, text, text)
  SET search_path = pg_catalog;
