-- ============================================================================
-- 107_wizard_catalog_lifecycle_read_grant.sql — Lifecycle read grant (C2C2)
--
-- Enables the C2C2 authoritative runtime resolver to read
-- public.dealer_wizard_catalog_lifecycle through the authenticated, user-scoped
-- Supabase path — gated by the existing 106 dealer-scoped RLS policy (dwcl_select,
-- USING wiz_is_active_member(dealer_id)).
--
-- READ-ONLY grant. It adds NO schema, seed, write policy, function, EXECUTE, or
-- activation behavior. anon stays with no access; authenticated gains SELECT only
-- (no INSERT/UPDATE/DELETE); service_role and every other Wizard-catalog grant are
-- unchanged. No TRUNCATE/REFERENCES/TRIGGER/MAINTAIN is granted.
-- ============================================================================

BEGIN;

GRANT SELECT ON TABLE public.dealer_wizard_catalog_lifecycle TO authenticated;

COMMIT;
