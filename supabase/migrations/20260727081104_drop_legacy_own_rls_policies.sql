-- 20260727081104 — RLS-R2: drop the superseded 002-era `*_own` RLS policies.
--
-- FORWARD-ONLY. No existing migration is edited. This migration only REMOVES obsolete permissive
-- policies; it creates, alters and widens nothing.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────
-- `002_enable_rls.sql` established a legacy access model whose predicate is
-- `dealer_id = auth.uid()` — a dealer id compared to a user id, with no membership row and no
-- `status = 'active'` check. `004_enable_saas_rls.sql` replaced that model with the
-- dealer_members-based predicate and states so in its own header:
--
--     Users access data only through dealer_members membership.
--     dealer_id = auth.uid() is NOT used.
--
-- but it never dropped the 002 policies. RLS-R1 confirmed against the live catalog that all 16
-- survive on all four tables 004 touches. Every one is PERMISSIVE, so on each table the effective
-- grant is `SaaS OR legacy` — the superseded model is still an active OR branch on every command.
--
-- ── WHY THIS MATTERS EVEN THOUGH THE BRANCH IS CURRENTLY DEAD ───────────────────
-- The legacy predicate can only be true if some `dealers.id` equals an `auth.users.id`. Nothing
-- links those UUID spaces, so in practice it never fires — which is why tenant isolation has always
-- behaved correctly in testing. But nothing CONSTRAINS them to differ either: a seed or fixture that
-- reused a UUID would silently activate every legacy policy at once.
--
-- The four legacy DELETE policies are the sharpest edge. Each SaaS DELETE deliberately restricts
-- deletion to `role IN ('owner','manager')`; the legacy DELETE imposes no role condition at all. An
-- activated predicate would therefore bypass that restriction on customers, vehicles, estimates and
-- gyeon_service_estimates alike.
--
-- ── WHY THIS IS SAFE ────────────────────────────────────────────────────────────
-- Dropping a PERMISSIVE policy removes an OR branch: it can only NARROW access, never broaden it.
-- Command coverage is 1:1 — every policy dropped here has a same-table, same-command SaaS
-- counterpart, so no command is left without a policy. `estimates_wizard_insert_block` is
-- RESTRICTIVE, ANDs with the permissive group rather than joining it, and is deliberately NOT
-- touched. The expected observable behaviour change is none.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────────
-- Sixteen DROP POLICY statements and nothing else. No CREATE POLICY, no ALTER POLICY, no table DDL,
-- no RLS enable/disable, no GRANT/REVOKE, no function, trigger, index, DML or seed.
--
-- `IF EXISTS` is used so the migration is idempotent and so an environment that never received 002
-- replays it without error.

DROP POLICY IF EXISTS customers_select_own ON public.customers;
DROP POLICY IF EXISTS customers_insert_own ON public.customers;
DROP POLICY IF EXISTS customers_update_own ON public.customers;
DROP POLICY IF EXISTS customers_delete_own ON public.customers;

DROP POLICY IF EXISTS vehicles_select_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete_own ON public.vehicles;

DROP POLICY IF EXISTS estimates_select_own ON public.estimates;
DROP POLICY IF EXISTS estimates_insert_own ON public.estimates;
DROP POLICY IF EXISTS estimates_update_own ON public.estimates;
DROP POLICY IF EXISTS estimates_delete_own ON public.estimates;

DROP POLICY IF EXISTS gyeon_select_own ON public.gyeon_service_estimates;
DROP POLICY IF EXISTS gyeon_insert_own ON public.gyeon_service_estimates;
DROP POLICY IF EXISTS gyeon_update_own ON public.gyeon_service_estimates;
DROP POLICY IF EXISTS gyeon_delete_own ON public.gyeon_service_estimates;

-- =============================================================================
-- Rollback note (manual, never automatic)
-- =============================================================================
--   Re-apply the four `*_own` policy definitions for the affected table from
--   002_enable_rls.sql verbatim. Doing so would restore the superseded model and re-open the
--   permissive OR branch this migration exists to close, so it should only ever be done to
--   diagnose an unexpected access regression, never as a fix.
