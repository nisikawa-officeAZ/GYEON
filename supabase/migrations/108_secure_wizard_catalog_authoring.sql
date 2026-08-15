-- ============================================================================
-- 108_secure_wizard_catalog_authoring.sql — Secure dealer authoring + review (C2C3)
--
-- Adds the fail-closed BACKEND for dealer Wizard catalog authoring and
-- configuration review. NO UI, NO mount, NO save wiring, NO activation.
--
-- What it adds:
--   • wiz_bump_dealer_revision(uuid) — the SINGLE authoritative revision-
--     invalidation point (upsert of the 106 lifecycle row). Called exactly once
--     per atomic mutation, so a revision never increments more than once for one
--     logical change.
--   • Triggers that drive invalidation for the mutation paths NOT owned by the
--     authoring RPCs: new-dealer lifecycle init (dealers), quote-affecting
--     dealer_settings changes, dealer override changes, and global catalog
--     changes (invalidate all dealers). Dealer catalog item/child changes are
--     invalidated by the RPC itself (one bump), so those tables carry NO bump
--     trigger — this is how double-increment is avoided.
--   • wiz_upsert_catalog_item(uuid,uuid,text,jsonb)  — atomic create/update
--   • wiz_archive_catalog_item(uuid,uuid)            — atomic soft archive
--   • wiz_confirm_catalog_review(uuid)               — atomic review confirm
--     All three: SECURITY DEFINER, pinned search_path, auth.uid() required,
--     wiz_can_configure(expected_dealer) required, per-row dealer ownership
--     enforced, global rows unmutable, immutable identity preserved (via the 103
--     immutability trigger), soft-delete only, never CATALOG_ACTIVE.
--
-- Grants: every new function has its default PUBLIC EXECUTE revoked (104 §H:
-- PUBLIC EXECUTE reappears on new functions), then EXECUTE is regranted to
-- `authenticated` ONLY on the three RPCs. The helper and trigger functions get
-- NO grant (they run as the definer inside the RPCs/triggers). NO authenticated
-- INSERT/UPDATE/DELETE grant is added on any catalog or lifecycle table.
--
-- Supported dealer-authoring kinds (105 dealer-scope ownership): maintenance_menu,
-- wash_menu, room_cleaning_menu, film_type, other_work_preset, store_global_option.
-- Coupons are REFUSED by the mutation RPC. PPF / window_area / ppf_type_group
-- globals stay read-only. Percentage discount and coupon pricing are NOT
-- implemented. No pricing arithmetic and no tax is computed here.
--
-- NOT APPLIED to any persistent database in this phase.
-- ============================================================================

BEGIN;

-- ── Section 1: the single authoritative revision-invalidation point ──────────
-- Upserts the dealer's 106 lifecycle row: increments the current revision by
-- exactly one and forces the row back to the unreviewed state (clearing every
-- review field). Idempotent per call. Callers guarantee "exactly once per atomic
-- mutation" by invoking this once; the catalog item/child tables therefore carry
-- NO bump trigger. SECURITY DEFINER so no authenticated lifecycle write grant is
-- ever needed; search_path pinned.
CREATE OR REPLACE FUNCTION public.wiz_bump_dealer_revision(p_dealer uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_dealer IS NULL THEN
    RAISE EXCEPTION 'wiz_bump_dealer_revision: dealer id is required';
  END IF;

  INSERT INTO public.dealer_wizard_catalog_lifecycle
    (dealer_id, state, current_configuration_revision)
  VALUES (p_dealer, 'MIGRATED_UNREVIEWED', 1)
  ON CONFLICT (dealer_id) DO UPDATE
    SET current_configuration_revision =
          public.dealer_wizard_catalog_lifecycle.current_configuration_revision + 1,
        state                           = 'MIGRATED_UNREVIEWED',
        reviewed_configuration_revision = NULL,
        reviewed_at                     = NULL,
        reviewed_by                     = NULL;
END $$;

-- ── Section 2: new-dealer lifecycle initialisation (safe non-reviewed state) ──
-- A dealer created after this migration receives a MIGRATED_UNREVIEWED lifecycle
-- row (revision 0). SECURITY DEFINER; grants no direct lifecycle write to anyone.
CREATE OR REPLACE FUNCTION public.wiz_init_dealer_lifecycle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.dealer_wizard_catalog_lifecycle (dealer_id)
  VALUES (NEW.id)
  ON CONFLICT (dealer_id) DO NOTHING;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_dealers_wiz_lifecycle_init ON public.dealers;
CREATE TRIGGER trg_dealers_wiz_lifecycle_init
  AFTER INSERT ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.wiz_init_dealer_lifecycle();

-- ── Section 3: quote-affecting dealer_settings invalidation ──────────────────
-- Fires only when a QUOTE-AFFECTING column actually changes value (IS DISTINCT
-- FROM), so an unrelated settings save (branding, LINE, PDF, bank, onboarding,
-- scheduling, etc.) never invalidates a review. Watched set = the columns the
-- pricing/catalog/estimate code consumes (service_price_settings, ppf_price_tables,
-- tax_rate, coupon_settings, discount_presets, default_dealer_rate_percent,
-- ) plus the two reserved pricing/tax slots (tax_settings, dealer_trade_defaults)
-- so future activation cannot silently skip invalidation. NOTE: detailer_rank is
-- deliberately NOT watched here — the dealer_settings copy is a MIRROR; the
-- authoritative rank lives in public.dealers.detailer_rank and is invalidated by
-- trg_dealers_wiz_rank_invalidate below. Watching the mirror too would double-count.
CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_settings_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF (NEW.service_price_settings      IS DISTINCT FROM OLD.service_price_settings)
     OR (NEW.ppf_price_tables         IS DISTINCT FROM OLD.ppf_price_tables)
     OR (NEW.tax_rate                 IS DISTINCT FROM OLD.tax_rate)
     OR (NEW.coupon_settings          IS DISTINCT FROM OLD.coupon_settings)
     OR (NEW.discount_presets         IS DISTINCT FROM OLD.discount_presets)
     OR (NEW.default_dealer_rate_percent IS DISTINCT FROM OLD.default_dealer_rate_percent)
     OR (NEW.tax_settings             IS DISTINCT FROM OLD.tax_settings)
     OR (NEW.dealer_trade_defaults    IS DISTINCT FROM OLD.dealer_trade_defaults)
  THEN
    PERFORM public.wiz_bump_dealer_revision(NEW.dealer_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_dealer_settings_wiz_invalidate ON public.dealer_settings;
CREATE TRIGGER trg_dealer_settings_wiz_invalidate
  AFTER UPDATE ON public.dealer_settings
  FOR EACH ROW EXECUTE FUNCTION public.wiz_invalidate_on_settings_change();

-- ── Section 3b: authoritative rank change invalidation (dealers.detailer_rank) ─
-- The canonical rank the review RPC enforces lives in public.dealers.detailer_rank
-- (the exact column getAuthoritativeShopRank reads). A change to it can alter the
-- required-family (window-film) rule, so it must invalidate the review. Row-level,
-- value-compared, one dealer row => exactly one bump. Unrelated dealer-column
-- updates do not fire it, and the dealer_settings mirror is NOT watched — so a rank
-- change increments the revision exactly once, never twice.
CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_rank_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.detailer_rank IS DISTINCT FROM OLD.detailer_rank THEN
    PERFORM public.wiz_bump_dealer_revision(NEW.id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_dealers_wiz_rank_invalidate ON public.dealers;
CREATE TRIGGER trg_dealers_wiz_rank_invalidate
  AFTER UPDATE ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.wiz_invalidate_on_rank_change();

-- ── Section 4: dealer override invalidation (statement-level, deduped) ────────
-- Overrides may be written outside the authoring RPCs (103 RLS write policies),
-- so their changes must invalidate too. Statement-level with a transition table:
-- each distinct affected dealer is bumped exactly once per statement (no double
-- increment when a statement touches several of a dealer's overrides). The same
-- function serves INSERT/UPDATE/DELETE because every trigger exposes its
-- transition table under the same alias `chg`.
CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_override_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.wiz_bump_dealer_revision(s.dealer_id)
     FROM (SELECT DISTINCT dealer_id FROM chg) s;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_dwco_wiz_invalidate_ins ON public.dealer_wizard_catalog_overrides;
CREATE TRIGGER trg_dwco_wiz_invalidate_ins
  AFTER INSERT ON public.dealer_wizard_catalog_overrides
  REFERENCING NEW TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

DROP TRIGGER IF EXISTS trg_dwco_wiz_invalidate_upd ON public.dealer_wizard_catalog_overrides;
CREATE TRIGGER trg_dwco_wiz_invalidate_upd
  AFTER UPDATE ON public.dealer_wizard_catalog_overrides
  REFERENCING NEW TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

DROP TRIGGER IF EXISTS trg_dwco_wiz_invalidate_del ON public.dealer_wizard_catalog_overrides;
CREATE TRIGGER trg_dwco_wiz_invalidate_del
  AFTER DELETE ON public.dealer_wizard_catalog_overrides
  REFERENCING OLD TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

-- ── Section 5: global catalog change invalidation (all dealers) ──────────────
-- A change to any GLOBAL catalog row (only an authorized migration can perform
-- one) invalidates every dealer's review. Statement-level; acts only when the
-- statement's transition table contains a global row, so a dealer-row write
-- (owner_scope='dealer', done by the authoring RPC which bumps that dealer once)
-- is a no-op here — preventing any double increment on the dealer path.
CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_global_catalog_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM chg WHERE owner_scope = 'global') THEN
    PERFORM public.wiz_bump_dealer_revision(d.id) FROM public.dealers d;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wci_wiz_invalidate_global_ins ON public.wizard_catalog_items;
CREATE TRIGGER trg_wci_wiz_invalidate_global_ins
  AFTER INSERT ON public.wizard_catalog_items
  REFERENCING NEW TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_global_catalog_change();

DROP TRIGGER IF EXISTS trg_wci_wiz_invalidate_global_upd ON public.wizard_catalog_items;
CREATE TRIGGER trg_wci_wiz_invalidate_global_upd
  AFTER UPDATE ON public.wizard_catalog_items
  REFERENCING NEW TABLE AS chg
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_global_catalog_change();

-- ── Section 6: atomic create / update RPC ────────────────────────────────────
-- One narrowly validated upsert. p_item_id NULL => create; non-null => update.
-- The DB generates the id and derives an immutable, non-label code (kind prefix +
-- generated uuid). Ranks/categories are DERIVED from central policy (never client
-- supplied). Everything (item + children + revision bump) is one transaction.
CREATE OR REPLACE FUNCTION public.wiz_upsert_catalog_item(
  p_expected_dealer uuid,
  p_item_id         uuid,
  p_kind            text,
  p_payload         jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_mode           text;
  v_permitted      text[];
  v_supports       boolean;
  v_allowed        text[];
  v_bad_key        text;
  v_category       text;
  v_prefix         text;
  v_id             uuid;
  v_code           text;
  v_row            public.wizard_catalog_items%ROWTYPE;
  v_action         text;
  -- validated payload values
  v_label          text;
  v_display_order  integer;
  v_is_active      boolean;
  v_price          integer;
  v_duration       integer;
  v_priceable      boolean;
  v_qty_required   boolean;
  v_min_qty        integer;
  v_max_qty        integer;
  v_presentation   jsonb;
  v_num            numeric;
BEGIN
  -- 6.1 Identity + capability (never trust the payload for authorization).
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'WIZ_INVALID_PAYLOAD';
  END IF;

  -- 6.2 Supported kind (refuses coupon, ppf_*, window_area, ppf_type_group, …).
  IF p_kind NOT IN ('maintenance_menu','wash_menu','room_cleaning_menu',
                    'film_type','other_work_preset','store_global_option') THEN
    RAISE EXCEPTION 'WIZ_UNSUPPORTED_KIND: %', p_kind;
  END IF;

  -- 6.3 Dealer's product mode (the guard trigger requires item mode = dealer mode;
  --     generic is runtime-disabled, so only gyeon dealers can author).
  SELECT product_mode INTO v_mode FROM public.dealers WHERE id = p_expected_dealer;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_NOT_FOUND'; END IF;

  -- 6.4 Central policy for this (mode, kind): permitted ranks + category support.
  SELECT permitted_ranks, supports_categories INTO v_permitted, v_supports
    FROM public.wizard_kind_policy WHERE product_mode = v_mode AND kind = p_kind;
  IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_NO_POLICY'; END IF;

  -- 6.5 Per-kind payload key allowlist (unknown / cross-kind keys are rejected).
  v_allowed := ARRAY['label_ja','display_order','is_active'];
  IF p_kind IN ('maintenance_menu','wash_menu','room_cleaning_menu') THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','duration_minutes'];
  ELSIF p_kind = 'film_type' THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','presentation'];
  ELSIF p_kind = 'store_global_option' THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','priceable',
                                    'quantity_required','min_quantity','max_quantity'];
  END IF;   -- other_work_preset: common keys only
  SELECT k INTO v_bad_key
    FROM jsonb_object_keys(p_payload) k
   WHERE k <> ALL (v_allowed) LIMIT 1;
  IF v_bad_key IS NOT NULL THEN
    RAISE EXCEPTION 'WIZ_UNKNOWN_FIELD: %', v_bad_key;
  END IF;

  -- 6.6 Common fields.
  v_label := btrim(p_payload ->> 'label_ja');
  IF v_label IS NULL OR v_label = '' THEN RAISE EXCEPTION 'WIZ_LABEL_REQUIRED'; END IF;
  IF char_length(v_label) > 200 THEN RAISE EXCEPTION 'WIZ_LABEL_TOO_LONG'; END IF;

  IF p_payload ? 'display_order' THEN
    IF jsonb_typeof(p_payload -> 'display_order') <> 'number' THEN RAISE EXCEPTION 'WIZ_DISPLAY_ORDER_TYPE'; END IF;
    v_num := (p_payload ->> 'display_order')::numeric;
    IF v_num <> trunc(v_num) OR v_num < 0 OR v_num > 100000 THEN RAISE EXCEPTION 'WIZ_DISPLAY_ORDER_RANGE'; END IF;
    v_display_order := v_num::integer;
  ELSE
    v_display_order := 0;
  END IF;

  IF p_payload ? 'is_active' THEN
    IF jsonb_typeof(p_payload -> 'is_active') <> 'boolean' THEN RAISE EXCEPTION 'WIZ_IS_ACTIVE_TYPE'; END IF;
    v_is_active := (p_payload ->> 'is_active')::boolean;
  ELSE
    v_is_active := true;
  END IF;

  -- 6.7 default_unit_price: NULL or non-negative tax-exclusive integer.
  IF p_payload ? 'default_unit_price'
     AND jsonb_typeof(p_payload -> 'default_unit_price') <> 'null' THEN
    IF jsonb_typeof(p_payload -> 'default_unit_price') <> 'number' THEN RAISE EXCEPTION 'WIZ_PRICE_TYPE'; END IF;
    v_num := (p_payload ->> 'default_unit_price')::numeric;
    IF v_num <> trunc(v_num) OR v_num < 0 THEN RAISE EXCEPTION 'WIZ_PRICE_INVALID'; END IF;
    v_price := v_num::integer;
  ELSE
    v_price := NULL;
  END IF;

  -- 6.8 Kind-specific derivation of duration / price / quantity / presentation.
  v_duration     := NULL;
  v_priceable    := true;
  v_qty_required := false;
  v_min_qty      := 1;
  v_max_qty      := NULL;
  v_presentation := '{}'::jsonb;

  IF p_kind IN ('maintenance_menu','wash_menu','room_cleaning_menu') THEN
    IF p_payload ? 'duration_minutes'
       AND jsonb_typeof(p_payload -> 'duration_minutes') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'duration_minutes') <> 'number' THEN RAISE EXCEPTION 'WIZ_DURATION_TYPE'; END IF;
      v_num := (p_payload ->> 'duration_minutes')::numeric;
      IF v_num <> trunc(v_num) OR v_num <= 0 THEN RAISE EXCEPTION 'WIZ_DURATION_INVALID'; END IF;
      v_duration := v_num::integer;
    END IF;

  ELSIF p_kind = 'film_type' THEN
    -- duration and quantity must stay NULL/default (keys already disallowed).
    IF p_payload ? 'presentation' THEN
      IF jsonb_typeof(p_payload -> 'presentation') <> 'object' THEN RAISE EXCEPTION 'WIZ_PRESENTATION_TYPE'; END IF;
      -- allowlist: brand?, vlt?, heatRejection?, color? — each a string.
      SELECT k INTO v_bad_key
        FROM jsonb_object_keys(p_payload -> 'presentation') k
       WHERE k <> ALL (ARRAY['brand','vlt','heatRejection','color']) LIMIT 1;
      IF v_bad_key IS NOT NULL THEN RAISE EXCEPTION 'WIZ_PRESENTATION_KEY: %', v_bad_key; END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_each(p_payload -> 'presentation') e
         WHERE jsonb_typeof(e.value) <> 'string'
      ) THEN RAISE EXCEPTION 'WIZ_PRESENTATION_VALUE'; END IF;
      v_presentation := p_payload -> 'presentation';
    END IF;

  ELSIF p_kind = 'other_work_preset' THEN
    -- MANUAL category: no catalog price, no duration, no quantity (keys disallowed).
    IF v_price IS NOT NULL THEN RAISE EXCEPTION 'WIZ_OTHER_WORK_PRICE_FORBIDDEN'; END IF;

  ELSIF p_kind = 'store_global_option' THEN
    IF NOT (p_payload ? 'priceable') OR jsonb_typeof(p_payload -> 'priceable') <> 'boolean' THEN
      RAISE EXCEPTION 'WIZ_PRICEABLE_REQUIRED';
    END IF;
    v_priceable := (p_payload ->> 'priceable')::boolean;

    IF NOT (p_payload ? 'quantity_required') OR jsonb_typeof(p_payload -> 'quantity_required') <> 'boolean' THEN
      RAISE EXCEPTION 'WIZ_QUANTITY_REQUIRED_FLAG';
    END IF;
    v_qty_required := (p_payload ->> 'quantity_required')::boolean;

    IF p_payload ? 'min_quantity' AND jsonb_typeof(p_payload -> 'min_quantity') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'min_quantity') <> 'number' THEN RAISE EXCEPTION 'WIZ_MIN_QTY_TYPE'; END IF;
      v_num := (p_payload ->> 'min_quantity')::numeric;
      IF v_num <> trunc(v_num) OR v_num < 1 THEN RAISE EXCEPTION 'WIZ_MIN_QTY_INVALID'; END IF;
      v_min_qty := v_num::integer;
    END IF;

    IF p_payload ? 'max_quantity' AND jsonb_typeof(p_payload -> 'max_quantity') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'max_quantity') <> 'number' THEN RAISE EXCEPTION 'WIZ_MAX_QTY_TYPE'; END IF;
      v_num := (p_payload ->> 'max_quantity')::numeric;
      IF v_num <> trunc(v_num) THEN RAISE EXCEPTION 'WIZ_MAX_QTY_INVALID'; END IF;
      v_max_qty := v_num::integer;
      IF v_max_qty < v_min_qty THEN RAISE EXCEPTION 'WIZ_MAX_LT_MIN'; END IF;
    END IF;
  END IF;

  -- 6.9 Canonical category per kind (store_global_option supports none).
  v_category := CASE p_kind
    WHEN 'maintenance_menu'   THEN 'maintenance'
    WHEN 'wash_menu'          THEN 'carwash'
    WHEN 'room_cleaning_menu' THEN 'roomclean'
    WHEN 'film_type'          THEN 'window'
    WHEN 'other_work_preset'  THEN 'other'
    ELSE NULL END;

  -- ── CREATE ──
  IF p_item_id IS NULL THEN
    v_prefix := CASE p_kind
      WHEN 'maintenance_menu'   THEN 'maint'
      WHEN 'wash_menu'          THEN 'wash'
      WHEN 'room_cleaning_menu' THEN 'room'
      WHEN 'film_type'          THEN 'film'
      WHEN 'other_work_preset'  THEN 'otherwork'
      WHEN 'store_global_option' THEN 'store'
    END;
    v_id   := gen_random_uuid();
    v_code := v_prefix || '-' || v_id::text;   -- immutable, non-label, unique by construction

    INSERT INTO public.wizard_catalog_items (
      id, market, product_mode, kind, owner_scope, dealer_id, code,
      label_owner, price_owner, pricing_ref, label_ja, label_en, description,
      display_order, is_active, default_unit_price, editable_unit_price, priceable,
      quantity_required, min_quantity, max_quantity, duration_minutes, presentation
    ) VALUES (
      v_id, 'jp', v_mode, p_kind, 'dealer', p_expected_dealer, v_code,
      'wizard_catalog', 'wizard_catalog', NULL, v_label, NULL, NULL,
      v_display_order, v_is_active, v_price, false, v_priceable,
      v_qty_required, v_min_qty, v_max_qty, v_duration, v_presentation
    );

    INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
    SELECT v_id, r FROM unnest(v_permitted) AS r;

    IF v_supports THEN
      INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
      VALUES (v_id, v_category);
    END IF;

    v_action := 'created';

  -- ── UPDATE ──
  ELSE
    SELECT * INTO v_row FROM public.wizard_catalog_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_ITEM_NOT_FOUND'; END IF;
    IF v_row.owner_scope <> 'dealer' OR v_row.dealer_id IS DISTINCT FROM p_expected_dealer THEN
      RAISE EXCEPTION 'WIZ_FORBIDDEN_ROW';   -- global or another dealer's row
    END IF;
    IF v_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'WIZ_ARCHIVED_ROW'; END IF;
    IF v_row.kind <> p_kind THEN RAISE EXCEPTION 'WIZ_KIND_MISMATCH'; END IF;

    -- Only mutable fields; identity/ownership are preserved (103 immutability trigger).
    UPDATE public.wizard_catalog_items SET
      label_ja           = v_label,
      display_order      = v_display_order,
      is_active          = v_is_active,
      default_unit_price = v_price,
      priceable          = v_priceable,
      quantity_required  = v_qty_required,
      min_quantity       = v_min_qty,
      max_quantity       = v_max_qty,
      duration_minutes   = v_duration,
      presentation       = v_presentation
    WHERE id = p_item_id;

    v_id     := p_item_id;
    v_code   := v_row.code;
    v_action := 'updated';
  END IF;

  -- 6.10 Single authoritative revision bump for this atomic mutation.
  PERFORM public.wiz_bump_dealer_revision(p_expected_dealer);

  RETURN jsonb_build_object(
    'ok', true, 'item_id', v_id, 'code', v_code, 'kind', p_kind, 'action', v_action);
END $$;

-- ── Section 7: atomic archive RPC (soft delete only) ─────────────────────────
CREATE OR REPLACE FUNCTION public.wiz_archive_catalog_item(
  p_expected_dealer uuid,
  p_item_id         uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.wizard_catalog_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF p_item_id IS NULL THEN RAISE EXCEPTION 'WIZ_ITEM_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;

  SELECT * INTO v_row FROM public.wizard_catalog_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_ITEM_NOT_FOUND'; END IF;
  IF v_row.owner_scope <> 'dealer' OR v_row.dealer_id IS DISTINCT FROM p_expected_dealer THEN
    RAISE EXCEPTION 'WIZ_FORBIDDEN_ROW';   -- global or another dealer's row
  END IF;

  -- Idempotent: an already-archived row is a no-op, and does NOT bump the revision.
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'action', 'already_archived');
  END IF;

  -- Soft delete only; the 103 hard-delete trigger additionally rejects any DELETE.
  UPDATE public.wizard_catalog_items
     SET is_active = false, deleted_at = now()
   WHERE id = p_item_id;

  PERFORM public.wiz_bump_dealer_revision(p_expected_dealer);

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'action', 'archived');
END $$;

-- ── Section 8: atomic review-confirmation RPC ────────────────────────────────
-- Resolves the DATABASE-AUTHORITATIVE rank, validates the current snapshot, and
-- records the exact locked revision. Never sets CATALOG_ACTIVE. There is NO rank
-- parameter: the rank is read from public.dealers.detailer_rank (the exact source
-- getAuthoritativeShopRank uses) so a direct authenticated caller cannot forge a
-- lower rank to weaken the required-film-type check.
--
-- LOCK ORDER (single, consistent, deadlock-free): (1) dealer/rank row, (2) lifecycle
-- row, (3) catalog validation, (4) review update. Holding the dealer row for the
-- whole review means a concurrent rank change (which must lock that same row to
-- update detailer_rank) cannot slip in between the rank read and the review update,
-- and its trigger bump will invalidate any review that lands first.
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;

  -- LOCK ORDER step 1: lock the authoritative dealer/rank row, then read the
  -- canonical rank. Fail closed on missing / inactive(deleted) / NULL / non-canonical
  -- rank — never coerced onto a default (mirrors the fail-closed resolver core).
  SELECT product_mode, detailer_rank, deleted_at
    INTO v_mode, v_rank, v_deleted
    FROM public.dealers WHERE id = p_expected_dealer FOR UPDATE;
  IF NOT FOUND OR v_mode IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_NOT_FOUND'; END IF;
  IF v_deleted IS NOT NULL THEN RAISE EXCEPTION 'WIZ_DEALER_INACTIVE'; END IF;
  IF v_rank IS NULL OR v_rank NOT IN ('shop','detailer','ppf_installer','certified') THEN
    RAISE EXCEPTION 'WIZ_INVALID_RANK';
  END IF;

  -- LOCK ORDER step 2: lock the lifecycle row so an interleaved edit's bump
  -- serialises against this review; the recorded revision is exactly the locked value.
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

  -- Required family: when window film is available for this rank, at least one
  -- active dealer film type must exist. Other families (maintenance/wash/room/
  -- other/store) are optional and may be empty. Coupons stay disabled.
  SELECT permitted_ranks INTO v_film_ranks
    FROM public.wizard_kind_policy WHERE product_mode=v_mode AND kind='film_type';
  IF v_film_ranks IS NOT NULL AND v_rank = ANY (v_film_ranks) THEN
    SELECT count(*) INTO v_n FROM public.wizard_catalog_items
     WHERE owner_scope='dealer' AND dealer_id=p_expected_dealer
       AND kind='film_type' AND is_active AND deleted_at IS NULL;
    IF v_n = 0 THEN RAISE EXCEPTION 'WIZ_FILM_TYPE_REQUIRED'; END IF;
  END IF;

  UPDATE public.dealer_wizard_catalog_lifecycle
     SET state                           = 'CATALOG_REVIEWED',
         reviewed_configuration_revision = current_configuration_revision,
         reviewed_at                     = now(),
         reviewed_by                     = v_uid
   WHERE dealer_id = p_expected_dealer;

  RETURN jsonb_build_object(
    'ok', true, 'state', 'CATALOG_REVIEWED',
    'reviewed_revision', v_life.current_configuration_revision);
END $$;

-- ── Section 9: privileges (revoke default PUBLIC EXECUTE; regrant only RPCs) ──
-- 104 §H proved PUBLIC EXECUTE reappears on newly created functions, so revoke it
-- (and every runtime role) on all new functions, then grant EXECUTE to
-- `authenticated` on ONLY the three authoring/review RPCs. The helper and the
-- trigger functions get NO grant — they run as the definer inside the RPCs/
-- triggers. NO table-write grant is added anywhere.
-- Defensively drop any prior two-argument review signature so the one-argument RPC
-- is the ONLY callable review function (a caller can never supply a forged rank).
DROP FUNCTION IF EXISTS public.wiz_confirm_catalog_review(uuid, text);

REVOKE EXECUTE ON FUNCTION public.wiz_bump_dealer_revision(uuid)                        FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_init_dealer_lifecycle()                           FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_settings_change()                   FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_rank_change()                       FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_override_change()                   FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_invalidate_on_global_catalog_change()             FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_upsert_catalog_item(uuid, uuid, text, jsonb)      FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_archive_catalog_item(uuid, uuid)                  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_confirm_catalog_review(uuid)                      FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.wiz_upsert_catalog_item(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiz_archive_catalog_item(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiz_confirm_catalog_review(uuid)                 TO authenticated;

COMMENT ON FUNCTION public.wiz_upsert_catalog_item(uuid, uuid, text, jsonb) IS
  'C2C3 atomic dealer catalog create/update. SECURITY DEFINER; requires auth.uid() and '
  'wiz_can_configure(expected_dealer); dealer_id is server-injected, never from the payload; '
  'global/other-dealer rows are unmutable; code/identity immutable; bumps the review revision once.';
COMMENT ON FUNCTION public.wiz_archive_catalog_item(uuid, uuid) IS
  'C2C3 atomic dealer catalog soft-archive (is_active=false, deleted_at=now()); never hard-deletes; '
  'idempotent on an already-archived row; bumps the review revision once.';
COMMENT ON FUNCTION public.wiz_confirm_catalog_review(uuid) IS
  'C2C3 atomic review confirm. Rank is DATABASE-authoritative (public.dealers.detailer_rank) — no rank '
  'parameter. Locks the dealer/rank row then the lifecycle row, validates the snapshot, records the '
  'locked revision as reviewed; sets CATALOG_REVIEWED only — never CATALOG_ACTIVE.';

COMMIT;
