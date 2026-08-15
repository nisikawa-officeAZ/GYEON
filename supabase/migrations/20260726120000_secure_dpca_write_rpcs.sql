-- 20260726120000 — B1.1-B7: secure write authorization for PPF + coating adjustment rules.
--
-- FORWARD-ONLY. Migrations 110, 20260726090000 and 20260726110000 are NOT edited, and neither is
-- any earlier migration.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
-- Migration 110 created `public.dealer_ppf_coating_adjustments` with RLS and three policies but
-- issued NO table privileges, so `authenticated` hit `permission denied` and the policies were
-- unreachable — the feature could not be used at all (found by B1.1-C2R).
--
-- The chosen repair is NOT simply to grant write DML. It is to adopt the security model migration
-- 108 already established for every other dealer-authored write:
--
--   authenticated  →  SELECT on the table, and EXECUTE on narrowly validated SECURITY DEFINER RPCs
--   writes         →  ONLY through those RPCs, each gated by public.wiz_can_configure()
--
-- Granting INSERT/UPDATE to `authenticated` would put write authorization in RLS policy predicates
-- spread across the schema. Routing writes through two SECURITY DEFINER functions keeps that
-- decision in one auditable place, matching `wiz_upsert_catalog_item` / `wiz_archive_catalog_item`.
--
-- ── TENANCY ─────────────────────────────────────────────────────────────────────
-- `p_expected_dealer` is an ASSERTION by the caller, never a grant of authority. It is accepted
-- only after `wiz_can_configure(p_expected_dealer)` proves — server-side, from the caller's own
-- active membership and role — that this user may configure that dealer. A forged or substituted
-- dealer id therefore fails closed with WIZ_FORBIDDEN and can never reach a row. The value is
-- server-injected into every write; no column is ever taken from the payload.
--
-- ── REVISION INVALIDATION (load-bearing detail) ─────────────────────────────────
-- These functions deliberately DO NOT call `wiz_bump_dealer_revision`. Migration 110 created
-- statement-level AFTER INSERT/UPDATE triggers on this table (repaired in 20260726110000), so the
-- bump already happens exactly once per statement. An explicit call here would DOUBLE-bump and
-- silently invalidate a review twice for a single edit. This differs from
-- `wiz_upsert_catalog_item`, which must bump explicitly because no such trigger covers its
-- dealer-scoped rows.
--
-- ── LIFECYCLE ───────────────────────────────────────────────────────────────────
-- Archive is an UPDATE (`is_active=false, deleted_at=now()`), never a DELETE. The table has no
-- DELETE policy and no DELETE grant, so a saved estimate can never lose the rule it referenced.
-- An already-archived row is an idempotent no-op that performs no UPDATE, and therefore does not
-- bump the revision — mirroring `wiz_archive_catalog_item`.

-- =============================================================================
-- Section 1: table privilege — SELECT only
-- =============================================================================
-- Reading is governed by the existing `dpca_select` policy (any ACTIVE member of the dealer).
-- No INSERT, UPDATE, DELETE or TRUNCATE is granted to any application role, here or anywhere.
GRANT SELECT ON public.dealer_ppf_coating_adjustments TO authenticated;

-- =============================================================================
-- Section 2: atomic create / update RPC
-- =============================================================================
-- p_rule_id NULL ⇒ create; non-null ⇒ update. The identity pair
-- (ppf_method_code, coating_code) is IMMUTABLE on update: changing it would silently re-target the
-- rule at a different combination while keeping its id, so a rename must be an archive plus a new
-- rule. Value ranges stay enforced by 110's CHECK constraints — they are not duplicated here.
CREATE OR REPLACE FUNCTION public.wiz_upsert_ppf_coating_adjustment(
  p_expected_dealer uuid,
  p_rule_id         uuid,
  p_payload         jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_allowed  text[] := ARRAY['ppf_method_code','coating_code','adjustment_type','adjustment_value','is_active'];
  v_bad_key  text;
  v_method   text;
  v_coating  text;
  v_type     text;
  v_value    integer;
  v_active   boolean;
  v_num      numeric;
  v_row      public.dealer_ppf_coating_adjustments%ROWTYPE;
  v_id       uuid;
  v_action   text;
BEGIN
  -- 1. Identity + capability. Never trust the payload for authorization.
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'WIZ_INVALID_PAYLOAD';
  END IF;

  -- 2. Payload key allowlist. `dealer_id`, `id`, `deleted_at` and every other server-owned column
  --    are absent from it, so they are unrepresentable rather than merely ignored.
  SELECT k INTO v_bad_key FROM jsonb_object_keys(p_payload) k WHERE k <> ALL (v_allowed) LIMIT 1;
  IF v_bad_key IS NOT NULL THEN RAISE EXCEPTION 'WIZ_UNKNOWN_FIELD: %', v_bad_key; END IF;

  -- 3. Shape validation. `IS DISTINCT FROM` is used throughout: an ABSENT key makes `->` return
  --    SQL NULL, and `NULL <> 'x'` is NULL, which an IF would treat as false and fail OPEN.
  IF jsonb_typeof(p_payload -> 'adjustment_type') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'WIZ_ADJUSTMENT_TYPE_REQUIRED';
  END IF;
  v_type := p_payload ->> 'adjustment_type';
  IF v_type NOT IN ('amount','percent') THEN RAISE EXCEPTION 'WIZ_ADJUSTMENT_TYPE_INVALID'; END IF;

  IF jsonb_typeof(p_payload -> 'adjustment_value') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'WIZ_ADJUSTMENT_VALUE_REQUIRED';
  END IF;
  v_num := (p_payload -> 'adjustment_value') #>> '{}';
  IF v_num = 'NaN'::numeric OR v_num = 'Infinity'::numeric OR v_num = '-Infinity'::numeric THEN
    RAISE EXCEPTION 'WIZ_ADJUSTMENT_VALUE_INVALID';
  END IF;
  IF v_num <> trunc(v_num) OR v_num < 0 THEN RAISE EXCEPTION 'WIZ_ADJUSTMENT_VALUE_INVALID'; END IF;
  v_value := v_num::integer;

  IF p_payload ? 'is_active' THEN
    IF jsonb_typeof(p_payload -> 'is_active') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'WIZ_IS_ACTIVE_TYPE';
    END IF;
    v_active := (p_payload ->> 'is_active')::boolean;
  ELSE
    v_active := true;
  END IF;

  -- ── CREATE ──
  IF p_rule_id IS NULL THEN
    IF jsonb_typeof(p_payload -> 'ppf_method_code') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_payload -> 'coating_code') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'WIZ_ADJUSTMENT_CODES_REQUIRED';
    END IF;
    v_method  := btrim(p_payload ->> 'ppf_method_code');
    v_coating := btrim(p_payload ->> 'coating_code');
    -- Format is also a CHECK on the table; rejecting here keeps the failure inside the stable
    -- vocabulary instead of surfacing a constraint name to the caller.
    IF v_method !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN RAISE EXCEPTION 'WIZ_PPF_METHOD_CODE_INVALID'; END IF;
    IF v_coating !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN RAISE EXCEPTION 'WIZ_COATING_CODE_INVALID'; END IF;

    BEGIN
      INSERT INTO public.dealer_ppf_coating_adjustments
        (dealer_id, ppf_method_code, coating_code, adjustment_type, adjustment_value, is_active)
      VALUES
        (p_expected_dealer, v_method, v_coating, v_type, v_value, v_active)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      -- The identity index is the only unique constraint on this table.
      RAISE EXCEPTION 'WIZ_ADJUSTMENT_ALREADY_EXISTS';
    END;
    v_action := 'created';

  -- ── UPDATE ──
  ELSE
    SELECT * INTO v_row FROM public.dealer_ppf_coating_adjustments
     WHERE id = p_rule_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_RULE_NOT_FOUND'; END IF;
    IF v_row.dealer_id IS DISTINCT FROM p_expected_dealer THEN
      RAISE EXCEPTION 'WIZ_FORBIDDEN_ROW';   -- another dealer's row
    END IF;
    IF v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'WIZ_ARCHIVED_ROW'; END IF;

    -- Identity is immutable: a supplied code must match the stored one exactly.
    IF p_payload ? 'ppf_method_code'
       AND btrim(p_payload ->> 'ppf_method_code') IS DISTINCT FROM v_row.ppf_method_code THEN
      RAISE EXCEPTION 'WIZ_ADJUSTMENT_IDENTITY_IMMUTABLE';
    END IF;
    IF p_payload ? 'coating_code'
       AND btrim(p_payload ->> 'coating_code') IS DISTINCT FROM v_row.coating_code THEN
      RAISE EXCEPTION 'WIZ_ADJUSTMENT_IDENTITY_IMMUTABLE';
    END IF;

    UPDATE public.dealer_ppf_coating_adjustments
       SET adjustment_type  = v_type,
           adjustment_value = v_value,
           is_active        = v_active,
           updated_at       = now()
     WHERE id = p_rule_id;

    v_id     := p_rule_id;
    v_action := 'updated';
  END IF;

  -- No explicit revision bump: 110's statement trigger already bumped exactly once.
  RETURN jsonb_build_object('ok', true, 'rule_id', v_id, 'action', v_action);
END $$;

-- =============================================================================
-- Section 3: atomic soft-archive RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.wiz_archive_ppf_coating_adjustment(
  p_expected_dealer uuid,
  p_rule_id         uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.dealer_ppf_coating_adjustments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF p_rule_id IS NULL THEN RAISE EXCEPTION 'WIZ_RULE_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;

  SELECT * INTO v_row FROM public.dealer_ppf_coating_adjustments
   WHERE id = p_rule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_RULE_NOT_FOUND'; END IF;
  IF v_row.dealer_id IS DISTINCT FROM p_expected_dealer THEN
    RAISE EXCEPTION 'WIZ_FORBIDDEN_ROW';
  END IF;

  -- Idempotent: an already-archived row performs NO update, so the statement trigger does not
  -- fire and the revision is not bumped for a no-op.
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'rule_id', p_rule_id, 'action', 'already_archived');
  END IF;

  -- Soft delete only. There is no DELETE policy and no DELETE grant on this table.
  UPDATE public.dealer_ppf_coating_adjustments
     SET is_active = false, deleted_at = now(), updated_at = now()
   WHERE id = p_rule_id;

  RETURN jsonb_build_object('ok', true, 'rule_id', p_rule_id, 'action', 'archived');
END $$;

-- =============================================================================
-- Section 4: EXECUTE discipline (mirrors migration 108)
-- =============================================================================
-- Revoke from everyone first, then grant back ONLY to `authenticated`. `anon` and `service_role`
-- are deliberately left without EXECUTE: these are operator actions taken by a signed-in member,
-- and a service_role caller would bypass the very membership check that authorizes them.
REVOKE EXECUTE ON FUNCTION public.wiz_upsert_ppf_coating_adjustment(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_archive_ppf_coating_adjustment(uuid, uuid)       FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.wiz_upsert_ppf_coating_adjustment(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiz_archive_ppf_coating_adjustment(uuid, uuid)       TO authenticated;

COMMENT ON FUNCTION public.wiz_upsert_ppf_coating_adjustment(uuid, uuid, jsonb) IS
  'B1.1 atomic dealer PPF+coating reduction create/update. SECURITY DEFINER; requires auth.uid() and '
  'wiz_can_configure(expected_dealer); dealer_id is server-injected, never from the payload; another '
  'dealer''s row is unmutable; the (ppf_method_code, coating_code) identity is immutable; does NOT bump '
  'the revision itself because the table''s statement trigger already does.';
COMMENT ON FUNCTION public.wiz_archive_ppf_coating_adjustment(uuid, uuid) IS
  'B1.1 atomic dealer PPF+coating reduction soft-archive (is_active=false, deleted_at=now()); never '
  'hard-deletes; idempotent on an already-archived row and performs no write in that case.';

-- =============================================================================
-- Rollback notes (manual, never automatic)
-- =============================================================================
--   REVOKE SELECT ON public.dealer_ppf_coating_adjustments FROM authenticated;
--   DROP FUNCTION IF EXISTS public.wiz_upsert_ppf_coating_adjustment(uuid, uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.wiz_archive_ppf_coating_adjustment(uuid, uuid);
--   Doing so restores the unusable state found by B1.1-C2R, so it is a last resort only.
