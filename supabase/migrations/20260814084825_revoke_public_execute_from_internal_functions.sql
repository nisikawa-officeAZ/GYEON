-- 20260814084825_revoke_public_execute_from_internal_functions.sql
--
-- WHY: 104_least_privilege_grants.sql (section G) explicitly REVOKEd EXECUTE
-- on 23 functions and documented that ALTER DEFAULT PRIVILEGES ... ON
-- FUNCTIONS did not empirically prevent Supabase from restoring PUBLIC
-- EXECUTE on functions CREATEd afterward (104, lines 352-354). Every
-- function added by later migrations therefore still carries the default
-- PUBLIC EXECUTE grant unless explicitly revoked.
--
-- This migration closes that gap for the 26 zero-grant function identities
-- (per catalog_manifest.test.sql expected_function / expected_function_execute_acl,
-- 43 total zero-grant identities minus the 17 already covered by 104) that are
-- not present in expected_function_execute_acl and therefore intend zero
-- EXECUTE grants to authenticated/anon/service_role, but are not part of
-- 104's explicit 23-function REVOKE list.
--
-- Scope: PUBLIC only. No behavior change for any role that already holds an
-- explicit grant; no schema/table changes.

REVOKE EXECUTE ON FUNCTION public.bump_invoice_content_version() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_invoice_cancel_not_in_issued_statement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_invoice_delete_is_draft() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_invoice_insert_is_draft() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_invoice_issued_immutability() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_invoice_items_issued_immutability() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_monthly_statement_adjustment_rules() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_monthly_statement_line_rules() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_monthly_statement_no_hard_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_monthly_statement_pdf_pointer() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_monthly_statement_receipt_rules() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_monthly_statement_rules() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_payment_allocation_rules() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_payment_authoritative_scope() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_payment_direct_invoice_cap() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_payment_not_in_issued_statement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_protected_artifact_rows() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_bump_dealer_revision(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_estimate_item_dml() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_estimate_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_init_dealer_lifecycle() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_global_catalog_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_offering_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_override_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_rank_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_settings_change() FROM PUBLIC;
