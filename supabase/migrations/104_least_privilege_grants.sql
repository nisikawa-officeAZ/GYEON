-- ============================================================================
-- 104_least_privilege_grants.sql — Least-privilege normalization (Phase C1R-B1)
--
-- Forward-only, rerunnable, transactional. Normalizes table/function/schema
-- privileges for the 72 application tables and 23 functions to the exact
-- C1R-B1H3/B1H4 manifest, plus three RLS policies, one authorization hardening,
-- and default-privilege defence-in-depth.
--
-- WHY: on a clean replay, Supabase's role bootstrap grants anon AND authenticated
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on every table (empirically: an
-- unauthenticated caller could TRUNCATE ... CASCADE the entire dataset), while
-- granting no SELECT/INSERT/UPDATE/DELETE — so the app is simultaneously
-- over-privileged (destructive) and under-privileged (non-functional). This
-- migration replaces that with an explicit least-privilege manifest.
--
-- Contains NO unrelated cleanup and NO application-defect fixes. Deferred defects
-- (gyeon_products user-scoped writes; nonexistent dealer_ai_* tables) are NOT
-- touched here. Migrations 000–103 are NOT modified.
-- ============================================================================

BEGIN;

-- ── B. SCHEMA PRIVILEGES ────────────────────────────────────────────────────
-- No runtime role may create objects in public. USAGE is preserved (required so
-- granted tables/functions are name-resolvable; USAGE alone exposes no row data).
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

-- ── C. TABLE PRIVILEGES (72 tables, explicit; no ALL-TABLES shortcut) ──
-- ── C.1 REVOKE ALL from every runtime role on the 72 tables ──
REVOKE ALL PRIVILEGES ON TABLE public.activity_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.admin_audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.admin_users FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.billing_invoices FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.completion_reports FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.customer_app_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.customers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_billing FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_members FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_staff FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_stock_levels FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_subscriptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_wizard_catalog_overrides FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.document_files FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.document_sequences FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.estimate_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.estimates FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_ai_settings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_ai_usage_log FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_news FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_news_reads FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_products FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_resource_downloads FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_resources FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.gyeon_service_estimates FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_receipts FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_stocktaking_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_stocktaking_sessions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.invoice_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.invoices FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.line_customers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.line_message_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.line_notification_queue FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.logistics_backorders FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.logistics_shipments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.maintenance_reminders FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.news_delivery_jobs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.news_delivery_recipients FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.po_fulfillment_lines FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.point_cards FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.point_transactions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.product_order_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.product_orders FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.reservations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.staging_issues FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.staging_verification_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.staging_verification_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.stock_movements FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.subscription_plans FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.uat_dealers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.uat_feedback FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.uat_issues FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.uat_sessions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.vehicle_registration_files FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.vehicle_registration_ocr_sessions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.vehicles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.warehouse_adjustments FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_catalog_item_categories FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_catalog_item_ranks FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_catalog_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_kind_ownership_policy FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_kind_policy FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_product_modes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.wizard_rank_category_policy FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.work_bays FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.work_order_files FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.work_orders FROM PUBLIC, anon, authenticated, service_role;

-- ── C.2 service_role: exactly SELECT,INSERT,UPDATE,DELETE on all 72 ──
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.billing_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.completion_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_app_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_billing TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_staff TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_stock_levels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_wizard_catalog_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_sequences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimate_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_ai_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_ai_usage_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_news TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_news_reads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_resource_downloads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_resources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gyeon_service_estimates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_receipts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_stocktaking_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_stocktaking_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_message_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_notification_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.logistics_backorders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.logistics_shipments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.maintenance_reminders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_delivery_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news_delivery_recipients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.po_fulfillment_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.point_cards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.point_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staging_issues TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staging_verification_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staging_verification_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stock_movements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.uat_dealers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.uat_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.uat_issues TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.uat_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_registration_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_registration_ocr_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.warehouse_adjustments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_catalog_item_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_catalog_item_ranks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_catalog_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_kind_ownership_policy TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_kind_policy TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_product_modes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wizard_rank_category_policy TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_bays TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_order_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_orders TO service_role;

-- ── C.3 authenticated: exact 109-pair manifest (44 tables; 28 deferred/service-only get NONE) ──
GRANT SELECT,INSERT ON TABLE public.activity_logs TO authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT,INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.completion_reports TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.customer_app_settings TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.customers TO authenticated;
GRANT SELECT ON TABLE public.dealer_members TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.dealer_settings TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.dealer_staff TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.dealer_stock_levels TO authenticated;
GRANT SELECT ON TABLE public.dealer_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.dealers TO authenticated;
GRANT SELECT ON TABLE public.document_files TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.document_sequences TO authenticated;
GRANT SELECT,INSERT,DELETE ON TABLE public.estimate_items TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.estimates TO authenticated;
GRANT SELECT ON TABLE public.gyeon_news TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.gyeon_news_reads TO authenticated;
GRANT SELECT ON TABLE public.gyeon_products TO authenticated;
GRANT INSERT ON TABLE public.gyeon_resource_downloads TO authenticated;
GRANT SELECT ON TABLE public.gyeon_resources TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.gyeon_service_estimates TO authenticated;
GRANT INSERT ON TABLE public.inventory_receipts TO authenticated;
GRANT SELECT,INSERT,DELETE ON TABLE public.invoice_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.invoices TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.line_customers TO authenticated;
GRANT SELECT ON TABLE public.line_message_logs TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.line_notification_queue TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.maintenance_reminders TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.point_cards TO authenticated;
GRANT SELECT,INSERT ON TABLE public.point_transactions TO authenticated;
GRANT INSERT ON TABLE public.product_order_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.product_orders TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.reservations TO authenticated;
GRANT SELECT,INSERT ON TABLE public.stock_movements TO authenticated;
GRANT SELECT ON TABLE public.subscription_plans TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.vehicle_registration_files TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.vehicle_registration_ocr_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.vehicles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.work_bays TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.work_order_files TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.work_orders TO authenticated;

-- anon: no application-table grant (intentionally none).

-- ── D. APPROVED RLS POLICIES (three only) ───────────────────────────────────
-- dealers and dealer_members currently have RLS DISABLED and are read directly
-- by the user-scoped (authenticated) client (getCurrentDealer etc.). Enable RLS
-- and add self/tenant-scoped SELECT so authenticated SELECT (granted above) is
-- row-confined. Writes remain service_role-only (no authenticated write grant).
-- No SECURITY DEFINER helper is used; predicates are inline and non-recursive
-- (dealers -> dealer_members; dealer_members self-only -> acyclic).

ALTER TABLE public.dealer_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dm_self_select ON public.dealer_members;
CREATE POLICY dm_self_select ON public.dealer_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());       -- a user always sees their OWN membership row,
                                       -- active or not (onboarding/no-dealer needs this)

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS d_member_or_owner_select ON public.dealers;
CREATE POLICY d_member_or_owner_select ON public.dealers
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()                              -- owner fallback
    OR id IN (SELECT dealer_id FROM public.dealer_members   -- active membership only:
              WHERE user_id = auth.uid() AND status = 'active')  -- inactive user does NOT
  );                                                         -- see the dealer (unless owner)

-- gyeon_news_reads: authenticated self upsert. Existing self INSERT/SELECT exist;
-- add the matching self UPDATE (USING + WITH CHECK), mirroring the INSERT model.
DROP POLICY IF EXISTS gyeon_news_reads_self_update ON public.gyeon_news_reads;
CREATE POLICY gyeon_news_reads_self_update ON public.gyeon_news_reads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dealer_members dm
                WHERE dm.user_id = auth.uid()
                  AND dm.dealer_id = gyeon_news_reads.dealer_id
                  AND dm.status = 'active')
  );

-- ── E. HARDEN get_next_document_number (authorization boundary) ──────────────
-- Identity, return type, and numbering/concurrency behavior are preserved exactly.
-- Adds an active-member-or-owner check BEFORE any sequence row is created/advanced.
-- This is a postgres-owned SECURITY DEFINER function, so it BYPASSES the RLS policy
-- on document_sequences (proven: an authenticated caller could advance another
-- dealer's sequence). The in-function check is therefore mandatory. search_path is
-- pinned to trusted schemas only (pg_catalog, public; no pg_temp).
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_dealer_id     uuid,
  p_sequence_type text,
  p_fiscal_year   integer,
  p_prefix        text DEFAULT '',
  p_padding       integer DEFAULT 5,
  p_reset_policy  text DEFAULT 'never'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_next integer;
BEGIN
  -- Authorization: deny before any write. Deterministic FORBIDDEN on failure.
  IF NOT EXISTS (
        SELECT 1 FROM public.dealer_members
         WHERE dealer_id = p_dealer_id AND user_id = auth.uid() AND status = 'active'
      )
     AND NOT EXISTS (
        SELECT 1 FROM public.dealers
         WHERE id = p_dealer_id AND owner_user_id = auth.uid()
      )
  THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an active member or owner of the dealer';
  END IF;

  INSERT INTO public.document_sequences
    (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy, current_number)
  VALUES
    (p_dealer_id, p_sequence_type, p_fiscal_year, p_prefix, p_padding, p_reset_policy, 1)
  ON CONFLICT (dealer_id, sequence_type, fiscal_year) DO UPDATE
    SET current_number = document_sequences.current_number + 1,
        updated_at     = now()
  RETURNING current_number INTO v_next;

  RETURN v_next;
END;
$$;

-- ── G. FUNCTION EXECUTE NORMALIZATION (all 23; revoke then exact regrant) ────
REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text, integer, text, integer, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pg_version()                                                        FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb)                  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_billing_updated_at()                                         FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_dealer_stock_levels_updated_at()                             FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_ocr_sessions_updated_at()                                    FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_staging_updated_at()                                         FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_uat_updated_at()                                             FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                                          FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_vehicle_registration_files_updated_at()                      FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_can_configure(uuid)                                             FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_catalog_item()                                            FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_catalog_item_immutable()                                  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_dealers_product_mode()                                    FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_override()                                                FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_is_active_member(uuid)                                          FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_is_any_active_member()                                          FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_reject_hard_delete()                                            FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_revalidate_items_for_kind()                                     FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_revalidate_items_for_mode()                                     FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_validate_catalog_item(uuid)                                     FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_validate_item_child_trigger()                                   FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_validate_item_trigger()                                         FROM PUBLIC, anon, authenticated, service_role;

-- Exact regrants — only proven runtime callers.
GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb)                   TO authenticated;   -- INVOKER; RLS-enforced; proven .rpc caller
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text, integer, text, integer, text)   TO authenticated;   -- hardened above; proven user-scoped caller
GRANT EXECUTE ON FUNCTION public.pg_version()                                                         TO service_role;    -- only service-role diagnostics caller
-- DENIED (revoke-and-defer): wiz_can_configure, wiz_is_active_member, wiz_is_any_active_member —
--   their only caller is RLS-policy evaluation on the 8 deferred wizard tables, which authenticated
--   cannot reach (grant revoked) and service_role bypasses. C2 restores them when the wizard mounts.
-- DENIED: all remaining wiz_* (trigger/validator) and 7 update_* trigger functions — fired as the
--   owner (postgres) inside triggers; PostgreSQL does not check EXECUTE for triggers.

-- ── H. DEFAULT PRIVILEGES (defence-in-depth, both creator roles) ─────────────
-- VERIFIED PLATFORM CAVEAT (disposable replay):
--   * Future TABLE and SEQUENCE defaults ARE neutralized by the statements below
--     for objects created by postgres AND supabase_admin (no anon/auth/svc access).
--   * Platform behavior can STILL restore PUBLIC EXECUTE on newly created FUNCTIONS
--     (the REVOKE-on-FUNCTIONS default did not hold empirically). Therefore every
--     future migration that CREATE/REPLACEs a function MUST explicitly
--     REVOKE EXECUTE FROM PUBLIC, anon, authenticated, service_role and then regrant
--     only proven callers. No event trigger / global workaround is added here.
-- Creator role postgres — the role migrations run as; covers every future object a
-- migration creates (migrations create objects as postgres).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES    FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Creator role supabase_admin — attempted for completeness. A migration running as a
-- NON-superuser postgres cannot ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
-- (ERROR 42501, verified on disposable replay); app migrations never create objects as
-- supabase_admin, so the postgres defaults above already cover migration-created objects.
-- Tolerated so 104 applies cleanly everywhere; where the running role is permitted
-- (e.g. a superuser session) it takes effect.
DO $$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES    FROM PUBLIC, anon, authenticated, service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'skipped supabase_admin default-privilege revoke: current role lacks authority (expected under migration role)';
END $$;

COMMIT;
