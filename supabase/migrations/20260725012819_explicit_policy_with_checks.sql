-- Migration: explicit_policy_with_checks  (phase R94C-C2)
--
-- Adds an explicit WITH CHECK to 29 PERMISSIVE policies (17 direct UPDATE + 12
-- FOR ALL) that today rely on PostgreSQL's implicit "USING is reused as WITH
-- CHECK" behavior for their INSERT/UPDATE write arms. Making the check explicit
-- is defense-in-depth and guarantees the new row stays inside the same tenant /
-- admin / role boundary the USING clause already enforces.
--
-- Each statement mirrors that policy's OWN existing USING predicate verbatim.
-- ALTER POLICY changes ONLY the WITH CHECK clause: policy name, table, roles,
-- permissive mode, command, and the USING predicate are all left unchanged.
-- No CREATE/DROP POLICY, no GRANT/REVOKE, no DML, no table / RLS-flag / function
-- / trigger / data changes. Authoritative target set: R94C-B-H1 sections 1-7.

-- ============================================================================
-- A. 17 direct UPDATE policies
-- ============================================================================

-- A.1  dealer_billing :: dealer_billing_admin_update            (064)
ALTER POLICY "dealer_billing_admin_update" ON public.dealer_billing
  WITH CHECK (exists (select 1 from admin_users where user_id = auth.uid()));

-- A.2  billing_invoices :: billing_invoices_admin_update        (064)
ALTER POLICY "billing_invoices_admin_update" ON public.billing_invoices
  WITH CHECK (exists (select 1 from admin_users where user_id = auth.uid()));

-- A.3  dealer_staff :: dealer_staff_update                      (050)
ALTER POLICY "dealer_staff_update" ON public.dealer_staff
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
         AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

-- A.4  dealer_stock_levels :: dealer_stock_levels_update        (069)
ALTER POLICY "dealer_stock_levels_update" ON public.dealer_stock_levels
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- A.5  document_files :: document_files_dealer_update           (053)
ALTER POLICY "document_files_dealer_update" ON public.document_files
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- A.6  notifications :: notifications_update                    (054)
ALTER POLICY "notifications_update" ON public.notifications
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- A.7  reservations :: reservations_dealer_update               (052)
ALTER POLICY "reservations_dealer_update" ON public.reservations
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- A.8  staging_verification_runs :: admin_update_staging_verification_runs   (062)
ALTER POLICY "admin_update_staging_verification_runs" ON public.staging_verification_runs
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.9  staging_verification_items :: admin_update_staging_verification_items (062)
ALTER POLICY "admin_update_staging_verification_items" ON public.staging_verification_items
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.10 staging_issues :: admin_update_staging_issues            (062)
ALTER POLICY "admin_update_staging_issues" ON public.staging_issues
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.11 uat_dealers :: admin_update_uat_dealers                  (063)
ALTER POLICY "admin_update_uat_dealers" ON public.uat_dealers
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.12 uat_sessions :: admin_update_uat_sessions                (063)
ALTER POLICY "admin_update_uat_sessions" ON public.uat_sessions
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.13 uat_feedback :: admin_update_uat_feedback                (063)
ALTER POLICY "admin_update_uat_feedback" ON public.uat_feedback
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.14 uat_issues :: admin_update_uat_issues                    (063)
ALTER POLICY "admin_update_uat_issues" ON public.uat_issues
  WITH CHECK (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
        and admin_users.status  = 'active'
    )
  );

-- A.15 vehicle_registration_files :: vehicle_registration_files_update       (067)
ALTER POLICY "vehicle_registration_files_update" ON public.vehicle_registration_files
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- A.16 vehicle_registration_ocr_sessions :: ocr_sessions_update              (068)
ALTER POLICY "ocr_sessions_update" ON public.vehicle_registration_ocr_sessions
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- A.17 work_bays :: work_bays_update                            (092)
ALTER POLICY "work_bays_update" ON public.work_bays
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
       WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','manager')
    )
    OR dealer_id IN (
      SELECT id FROM dealers WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- B. 12 FOR ALL policies  (WITH CHECK covers their INSERT and UPDATE arms)
-- ============================================================================

-- B.1  work_orders :: "Dealer members can manage their work orders"          (038)
ALTER POLICY "Dealer members can manage their work orders" ON public.work_orders
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.2  work_order_files :: "Dealer members can manage their work order files" (039)
ALTER POLICY "Dealer members can manage their work order files" ON public.work_order_files
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.3  completion_reports :: "Dealer members can manage their completion reports" (040)
ALTER POLICY "Dealer members can manage their completion reports" ON public.completion_reports
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.4  invoices :: "Dealer members can manage their invoices"                (041)
ALTER POLICY "Dealer members can manage their invoices" ON public.invoices
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.5  invoice_items :: "Dealer members can manage their invoice items"      (041)
ALTER POLICY "Dealer members can manage their invoice items" ON public.invoice_items
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.6  payments :: "Dealer members can manage their payments"                (042)
ALTER POLICY "Dealer members can manage their payments" ON public.payments
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.7  dealer_settings :: "Dealer members can manage their settings"         (043)
ALTER POLICY "Dealer members can manage their settings" ON public.dealer_settings
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.8  line_customers :: "Dealer members can manage their line customers"    (043)
ALTER POLICY "Dealer members can manage their line customers" ON public.line_customers
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.9  document_sequences :: "dealer members can manage document_sequences"  (046)
ALTER POLICY "dealer members can manage document_sequences" ON public.document_sequences
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dealer_members
      WHERE dealer_members.dealer_id = document_sequences.dealer_id
        AND dealer_members.user_id = auth.uid()
    )
  );

-- B.10 product_orders :: "Dealer members can manage their product_orders"    (048)
ALTER POLICY "Dealer members can manage their product_orders" ON public.product_orders
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- B.11 product_order_items :: "Dealer members can manage their product_order_items" (048)
ALTER POLICY "Dealer members can manage their product_order_items" ON public.product_order_items
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.product_orders
      WHERE dealer_id IN (
        SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
      )
    )
  );

-- B.12 estimate_items :: "Dealer members can manage their estimate items"    (037)
ALTER POLICY "Dealer members can manage their estimate items" ON public.estimate_items
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );
