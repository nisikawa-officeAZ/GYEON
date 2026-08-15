-- ============================================================================
-- 109_wizard_catalog_review_history.sql — Durable last-review history (C2C4)
--
-- Adds DURABLE last-review history to public.dealer_wizard_catalog_lifecycle so a
-- dealer can always see "when the configuration was last confirmed and by whom",
-- even after a later quote-affecting change moves them back to review-required.
--
-- It changes NOTHING about dealer isolation, DB-authoritative rank, grants,
-- lifecycle meaning, or lock order established by 106–108:
--   • Adds three nullable columns: last_reviewed_configuration_revision,
--     last_reviewed_at, last_reviewed_by (auth.users, ON DELETE SET NULL).
--   • Backfills currently-reviewed rows' durable history from their current
--     reviewed_* values; never-reviewed rows keep NULL durable history.
--   • CREATE OR REPLACEs the ONE-ARGUMENT review RPC wiz_confirm_catalog_review(uuid)
--     so a successful review writes current reviewed_* AND durable last_reviewed_*
--     from the SAME revision, timestamp, and reviewer in one transaction. The
--     signature, the DB-authoritative rank resolution (dealers.detailer_rank under
--     FOR UPDATE), the dealer→lifecycle lock order, and every guard are preserved.
--
-- Invalidation needs NO change: wiz_bump_dealer_revision (108) clears only the
-- CURRENT reviewed_* fields and never touches last_reviewed_*, so a later catalog
-- or rank change automatically preserves durable history. A re-review overwrites
-- last_reviewed_* with the new successful review.
--
-- Does NOT: assign CATALOG_ACTIVE; add any authenticated table-write grant; grant
-- anything to anon/PUBLIC/service_role; restore the removed (uuid,text) overload;
-- modify Migration 108 or any historical migration; weaken RLS/SECURITY DEFINER.
-- NOT APPLIED to any persistent database in this phase.
-- ============================================================================

BEGIN;

-- ── Section 1: durable last-review columns ───────────────────────────────────
ALTER TABLE public.dealer_wizard_catalog_lifecycle
  ADD COLUMN IF NOT EXISTS last_reviewed_configuration_revision bigint,
  ADD COLUMN IF NOT EXISTS last_reviewed_at                     timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_by                     uuid;

-- Reviewer deletion must NULL only the reviewer identity, preserving revision +
-- timestamp history (same ON DELETE SET NULL policy as the current reviewed_by).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dwcl_last_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.dealer_wizard_catalog_lifecycle
      ADD CONSTRAINT dwcl_last_reviewed_by_fkey
      FOREIGN KEY (last_reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Named coherence constraints (fail closed on incoherent history). Reviewer is
-- deliberately independent so ON DELETE SET NULL on last_reviewed_by can NEVER make
-- an otherwise-valid historical record violate a CHECK.
ALTER TABLE public.dealer_wizard_catalog_lifecycle
  ADD CONSTRAINT dwcl_last_review_rev_nonneg
  CHECK (last_reviewed_configuration_revision IS NULL
         OR last_reviewed_configuration_revision >= 0);

-- Revision and timestamp are both-absent (never reviewed) or both-present.
ALTER TABLE public.dealer_wizard_catalog_lifecycle
  ADD CONSTRAINT dwcl_last_review_pair_coherent
  CHECK (
    (last_reviewed_configuration_revision IS NULL AND last_reviewed_at IS NULL)
    OR (last_reviewed_configuration_revision IS NOT NULL AND last_reviewed_at IS NOT NULL)
  );

-- Durable history can never be from the future relative to the current revision.
ALTER TABLE public.dealer_wizard_catalog_lifecycle
  ADD CONSTRAINT dwcl_last_review_not_future
  CHECK (last_reviewed_configuration_revision IS NULL
         OR last_reviewed_configuration_revision <= current_configuration_revision);

-- A reviewer id can only exist alongside real durable history.
ALTER TABLE public.dealer_wizard_catalog_lifecycle
  ADD CONSTRAINT dwcl_last_reviewer_requires_history
  CHECK (last_reviewed_by IS NULL OR last_reviewed_configuration_revision IS NOT NULL);

-- ── Section 2: backfill (currently-reviewed rows only; never fabricate history) ─
-- Reviewed/active rows carry coherent reviewed_* (dwcl_reviewed_coherent, 106):
-- copy them verbatim into the durable columns. Every other state leaves durable
-- history NULL.
UPDATE public.dealer_wizard_catalog_lifecycle
   SET last_reviewed_configuration_revision = reviewed_configuration_revision,
       last_reviewed_at                     = reviewed_at,
       last_reviewed_by                     = reviewed_by
 WHERE state IN ('CATALOG_REVIEWED', 'CATALOG_ACTIVE')
   AND reviewed_configuration_revision IS NOT NULL
   AND last_reviewed_configuration_revision IS NULL;

-- ── Section 3: review RPC now writes durable history (same one-arg signature) ──
-- Identical to the 108 definition EXCEPT the final UPDATE also records the durable
-- last_reviewed_* trio from the SAME locked revision, single transaction timestamp,
-- and authenticated reviewer. Rank stays DB-authoritative; lock order unchanged;
-- CATALOG_ACTIVE never assigned.
CREATE OR REPLACE FUNCTION public.wiz_confirm_catalog_review(
  p_expected_dealer uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_mode         text;
  v_rank         text;
  v_deleted      timestamptz;
  v_life         public.dealer_wizard_catalog_lifecycle%ROWTYPE;
  v_film_ranks   text[];
  v_n            integer;
  v_rev          bigint;
  v_now          timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;

  -- LOCK ORDER step 1: lock the authoritative dealer/rank row, then read the
  -- canonical rank. Fail closed on missing / inactive(deleted) / NULL / non-canonical.
  SELECT product_mode, detailer_rank, deleted_at
    INTO v_mode, v_rank, v_deleted
    FROM public.dealers WHERE id = p_expected_dealer FOR UPDATE;
  IF NOT FOUND OR v_mode IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_NOT_FOUND'; END IF;
  IF v_deleted IS NOT NULL THEN RAISE EXCEPTION 'WIZ_DEALER_INACTIVE'; END IF;
  IF v_rank IS NULL OR v_rank NOT IN ('shop','detailer','ppf_installer','certified') THEN
    RAISE EXCEPTION 'WIZ_INVALID_RANK';
  END IF;

  -- LOCK ORDER step 2: lock the lifecycle row (serialises against an interleaved bump).
  SELECT * INTO v_life FROM public.dealer_wizard_catalog_lifecycle
   WHERE dealer_id = p_expected_dealer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_LIFECYCLE_MISSING'; END IF;
  IF v_life.state = 'LEGACY' THEN RAISE EXCEPTION 'WIZ_LIFECYCLE_LEGACY'; END IF;

  -- Required Migration 105 globals must be intact (fail-closed).
  SELECT count(*) INTO v_n FROM public.wizard_catalog_items
   WHERE market='jp' AND product_mode=v_mode AND owner_scope='global'
     AND kind='window_area' AND is_active AND deleted_at IS NULL;
  IF v_n <> 7 THEN RAISE EXCEPTION 'WIZ_GLOBALS_MISSING: window_area=%', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.wizard_catalog_items
   WHERE market='jp' AND product_mode=v_mode AND owner_scope='global'
     AND kind='ppf_method' AND is_active AND deleted_at IS NULL;
  IF v_n <> 5 THEN RAISE EXCEPTION 'WIZ_GLOBALS_MISSING: ppf_method=%', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.wizard_catalog_items
   WHERE market='jp' AND product_mode=v_mode AND owner_scope='global'
     AND kind='ppf_part' AND is_active AND deleted_at IS NULL;
  IF v_n <> 16 THEN RAISE EXCEPTION 'WIZ_GLOBALS_MISSING: ppf_part=%', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.wizard_catalog_items
   WHERE market='jp' AND product_mode=v_mode AND owner_scope='global'
     AND kind='ppf_type_group' AND is_active AND deleted_at IS NULL;
  IF v_n <> 11 THEN RAISE EXCEPTION 'WIZ_GLOBALS_MISSING: ppf_type_group=%', v_n; END IF;

  -- Snapshot must be well-formed: no active dealer row with an empty wizard label.
  IF EXISTS (
    SELECT 1 FROM public.wizard_catalog_items
     WHERE owner_scope='dealer' AND dealer_id=p_expected_dealer
       AND is_active AND deleted_at IS NULL
       AND label_owner='wizard_catalog'
       AND (label_ja IS NULL OR btrim(label_ja)='')
  ) THEN RAISE EXCEPTION 'WIZ_MALFORMED_DEALER_ROW'; END IF;

  -- Required family: window film must have ≥1 active dealer type when the DB rank
  -- can sell it. Other families optional. Coupons stay disabled.
  SELECT permitted_ranks INTO v_film_ranks
    FROM public.wizard_kind_policy WHERE product_mode=v_mode AND kind='film_type';
  IF v_film_ranks IS NOT NULL AND v_rank = ANY (v_film_ranks) THEN
    SELECT count(*) INTO v_n FROM public.wizard_catalog_items
     WHERE owner_scope='dealer' AND dealer_id=p_expected_dealer
       AND kind='film_type' AND is_active AND deleted_at IS NULL;
    IF v_n = 0 THEN RAISE EXCEPTION 'WIZ_FILM_TYPE_REQUIRED'; END IF;
  END IF;

  -- Current + durable history from ONE revision, ONE transaction timestamp, ONE reviewer.
  v_rev := v_life.current_configuration_revision;
  v_now := now();
  UPDATE public.dealer_wizard_catalog_lifecycle
     SET state                                = 'CATALOG_REVIEWED',
         reviewed_configuration_revision      = v_rev,
         reviewed_at                          = v_now,
         reviewed_by                          = v_uid,
         last_reviewed_configuration_revision = v_rev,
         last_reviewed_at                     = v_now,
         last_reviewed_by                     = v_uid
   WHERE dealer_id = p_expected_dealer;

  RETURN jsonb_build_object(
    'ok', true, 'state', 'CATALOG_REVIEWED', 'reviewed_revision', v_rev);
END $$;

-- ── Section 4: preserve the accepted EXECUTE grant (defensive; adds nothing new) ─
-- CREATE OR REPLACE keeps existing privileges, but per 104 §H the platform may
-- restore PUBLIC EXECUTE on a (re)created function. Re-revoke the non-runtime roles
-- and re-affirm the single accepted authenticated grant. No new grant is introduced;
-- anon/PUBLIC/service_role gain nothing; the other two 108 RPC grants are untouched.
REVOKE EXECUTE ON FUNCTION public.wiz_confirm_catalog_review(uuid) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.wiz_confirm_catalog_review(uuid) TO authenticated;

COMMENT ON FUNCTION public.wiz_confirm_catalog_review(uuid) IS
  'C2C4 atomic review confirm with durable history. Rank is DB-authoritative '
  '(public.dealers.detailer_rank); no rank parameter. Writes current reviewed_* and '
  'durable last_reviewed_* from one revision/timestamp/reviewer; sets CATALOG_REVIEWED '
  'only — never CATALOG_ACTIVE. Lock order dealer→lifecycle preserved.';

COMMIT;
