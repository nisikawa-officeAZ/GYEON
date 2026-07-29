-- =============================================================================
-- B2-E2Q-D2R — The catalog review attests REVIEW, not COMPLETENESS.
--
-- Forward-only. No existing migration is edited.
--
-- WHAT CHANGES: exactly one thing. `wiz_confirm_catalog_review` no longer refuses
-- to confirm a review because the dealer has authored no `film_type` row.
--
-- WHY. The rule this removes read:
--
--     film_type is REQUIRED  <=>  dealers.detailer_rank ∈
--                                 wizard_kind_policy('gyeon','film_type').permitted_ranks
--
-- It predates the service-offering model and asks the wrong question. Since
-- 20260728150348 a dealer states which of the five families it sells, and rank
-- decides none of them; since that migration widened film_type to all four ranks,
-- the predicate became TRUE for EVERY dealer, so a store that sells no window film
-- at all could not confirm its review and therefore could not open the wizard.
--
-- The replacement is NOT an offering-based version of the same check. Confirming a
-- review means "the owner has looked at this configuration", not "every enabled
-- family is fully set up". A dealer may deliberately turn window film ON and finish
-- registering its film types tomorrow; that is a half-finished FAMILY, not an
-- unreviewed configuration, and Step 4 already renders exactly that state as a
-- present-but-locked section with an actionable reason. Blocking the whole review —
-- and with it the entire wizard, including families that ARE ready — is the wrong
-- consequence for it.
--
-- WHAT DOES NOT CHANGE — every other guarantee is preserved verbatim:
--   • authentication, wiz_can_configure authorization, expected-dealer check
--   • lock order: dealers FOR UPDATE, then dealer_wizard_catalog_lifecycle FOR UPDATE
--   • rank is still read DB-authoritatively and still fails closed when absent,
--     deleted, NULL or non-canonical (v_rank is retained solely for those checks)
--   • the migration-105 global structural counts (7 / 5 / 16 / 11)
--   • the malformed dealer-row check (active row with a blank wizard label)
--   • LEGACY lifecycle refusal and missing-lifecycle refusal
--   • one revision, one transaction timestamp, one reviewer written to both the
--     current reviewed_* trio and the durable last_reviewed_* trio
--   • CATALOG_REVIEWED only — CATALOG_ACTIVE is never assigned here
--   • the same one-argument signature and the same single authenticated grant
-- =============================================================================

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
  v_n            integer;
  v_rev          bigint;
  v_now          timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;

  -- LOCK ORDER step 1: lock the authoritative dealer/rank row, then read the
  -- canonical rank. Fail closed on missing / inactive(deleted) / NULL / non-canonical.
  -- The rank is still validated here; it simply no longer decides what must be authored.
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

  -- NO per-family completeness gate. WIZ_FILM_TYPE_REQUIRED is gone, and nothing
  -- replaces it: not a rank rule, not an offering rule. An enabled-but-unconfigured
  -- family is surfaced by the settings screen as a non-blocking warning and by Step 4
  -- as a locked section — never by refusing the review of the whole configuration.

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

-- Preserve the accepted EXECUTE grant, as 109 §4 does: CREATE OR REPLACE keeps
-- existing privileges, but per 104 §H the platform may restore PUBLIC EXECUTE on a
-- (re)created function. Re-revoke the non-runtime roles and re-affirm the single
-- accepted authenticated grant. No new grant is introduced.
REVOKE EXECUTE ON FUNCTION public.wiz_confirm_catalog_review(uuid) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.wiz_confirm_catalog_review(uuid) TO authenticated;

COMMENT ON FUNCTION public.wiz_confirm_catalog_review(uuid) IS
  'Atomic review confirm with durable history. Rank is DB-authoritative '
  '(public.dealers.detailer_rank) and validated, but no longer decides which catalog '
  'rows must exist: the review attests that the configuration was reviewed, not that '
  'every enabled service family is complete. Writes current reviewed_* and durable '
  'last_reviewed_* from one revision/timestamp/reviewer; sets CATALOG_REVIEWED only — '
  'never CATALOG_ACTIVE. Lock order dealer→lifecycle preserved.';
