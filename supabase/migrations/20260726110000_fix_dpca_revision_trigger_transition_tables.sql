-- 20260726110000 — B1.1-B6: repair the PPF/coating adjustment revision triggers.
--
-- FORWARD-ONLY. Migration 110 is NOT edited, and neither is any earlier migration.
--
-- ── THE DEFECT ──────────────────────────────────────────────────────────────────
-- Migration 110 created the two statement-level revision-invalidation triggers on
-- `public.dealer_ppf_coating_adjustments` but omitted the transition-table declaration:
--
--   CREATE TRIGGER trg_dpca_wiz_invalidate_ins
--     AFTER INSERT ON public.dealer_ppf_coating_adjustments
--     FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();
--
-- The shared function (migration 108) reads a transition table named `chg`:
--
--   PERFORM public.wiz_bump_dealer_revision(s.dealer_id)
--      FROM (SELECT DISTINCT dealer_id FROM chg) s;
--
-- A statement trigger only exposes that relation when the trigger itself declares
-- `REFERENCING ... TABLE AS chg`. Without it every INSERT and UPDATE on the table aborted with
-- `relation "chg" does not exist`, which made `dealer_ppf_coating_adjustments` entirely
-- unwritable — no dealer could author a PPF + coating reduction rule at all. Migration 108's own
-- triggers on `dealer_wizard_catalog_overrides` declare it correctly; 110 simply failed to copy
-- that clause.
--
-- ── WHAT THIS MIGRATION CHANGES ─────────────────────────────────────────────────
-- Only the two affected triggers, dropped and recreated with the SAME timing (AFTER), the SAME
-- event coverage (INSERT and UPDATE, one trigger each), the SAME level (FOR EACH STATEMENT) and
-- the SAME shared function. The only difference is the added `REFERENCING NEW TABLE AS chg`.
--
-- NEW TABLE is correct for both events: the function bumps the revision of every dealer touched by
-- the statement, and for INSERT/UPDATE the post-image carries those dealer ids. This matches how
-- 108 declares its own INSERT and UPDATE override triggers exactly.
--
-- No DELETE trigger is created, because migration 110 deliberately created none: the table has no
-- DELETE policy and is archived through `is_active` / `deleted_at`, so an archive is an UPDATE and
-- is already covered by the UPDATE trigger. (108 needs an OLD TABLE variant only because its
-- overrides table does permit deletes.)
--
-- ── WHAT THIS MIGRATION DOES NOT CHANGE ─────────────────────────────────────────
-- No table column, constraint, index, RLS policy, grant, RPC, pricing rule, tax rule, rounding
-- rule or application behaviour. Revision-invalidation SEMANTICS are preserved exactly: one bump
-- per statement, per affected dealer — which is what the triggers were always meant to do and
-- what they could not do while they were failing outright.

-- ── INSERT ──────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_dpca_wiz_invalidate_ins ON public.dealer_ppf_coating_adjustments;
CREATE TRIGGER trg_dpca_wiz_invalidate_ins
  AFTER INSERT ON public.dealer_ppf_coating_adjustments
  REFERENCING NEW TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

-- ── UPDATE ──────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_dpca_wiz_invalidate_upd ON public.dealer_ppf_coating_adjustments;
CREATE TRIGGER trg_dpca_wiz_invalidate_upd
  AFTER UPDATE ON public.dealer_ppf_coating_adjustments
  REFERENCING NEW TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

-- =============================================================================
-- Rollback note (manual, never automatic)
-- =============================================================================
--   Re-apply migration 110's two trigger statements verbatim. Doing so restores the defect and
--   makes the table unwritable again, so it is a rollback of last resort only.
