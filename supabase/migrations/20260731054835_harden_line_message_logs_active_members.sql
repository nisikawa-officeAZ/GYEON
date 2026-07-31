-- Migration: harden_line_message_logs_active_members (GYEON-EST-LINE-F1-R1)
--
-- The 044 policy admitted ANY dealer_members row (`user_id = auth.uid()`), so a
-- member whose status is no longer 'active' could still read the dealer's LINE
-- message logs through the authenticated role. This migration replaces that
-- FOR ALL policy with a SELECT-only policy that additionally requires
-- status = 'active', matching the predicate newer policies already use
-- (e.g. 20260725012819, 085).
--
-- Grants are NOT touched: 104 already revoked all authenticated DML and left
-- authenticated with SELECT only; service_role keeps its existing DML grants
-- and, as always, bypasses RLS. No SECURITY DEFINER object is created.
-- Forward-only; source file only — application is a separately authorized step.

DROP POLICY IF EXISTS "Dealer members can manage their line_message_logs"
  ON public.line_message_logs;

CREATE POLICY "line_message_logs_active_member_select"
  ON public.line_message_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dealer_members dm
      WHERE dm.dealer_id = line_message_logs.dealer_id
        AND dm.user_id   = auth.uid()
        AND dm.status    = 'active'
    )
  );

-- Deliberately NO authenticated INSERT/UPDATE/DELETE policy: writes remain
-- service_role-only (log composition happens exclusively in trusted server
-- code), so client-forged log rows stay unrepresentable.
