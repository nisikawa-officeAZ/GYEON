-- 110 — B1.1 Store Pricing Configuration Foundation
--
-- Enables three dealer-authored pricing surfaces that the Ver2.2 specification requires and
-- that no configuration path could previously express:
--
--   1. Coupons                      — authoring only; every value constraint already exists in 103.
--   2. PPF types + install coeff.   — dealer-scope ownership + one typed basis-points column.
--   3. PPF + coating adjustment     — one dealer-scoped table with active/archive lifecycle.
--
-- Plus `estimates.configuration_revision`, the attribution slot that lets a saved estimate name
-- the configuration revision that produced it.
--
-- ── WHAT THIS MIGRATION DELIBERATELY DOES NOT DO ────────────────────────────────
-- It performs NO pricing arithmetic and defines NO pricing formula. `calculateEstimate` remains
-- the production authority (B1.1 decision 1) and its sum-then-clamp discount order, tax behaviour
-- and rounding are untouched (decision 2). It does not read, migrate, drop or revive the legacy
-- `dealer_settings.coupon_settings` / `ppf_price_tables` JSONB columns (decision 5) — they keep
-- their existing NULL defaults and their existing revision-invalidation watch.
--
-- Percentages are integer BASIS POINTS everywhere (10000 = 100% = ×1.0), matching the existing
-- `wci_coupon_percent_range` discipline and the application-side `ew-dc-1` convention, so no float
-- multiplier can ever reach a yen amount.

-- =============================================================================
-- Section 1: PPF installation coefficient (typed, basis points)
-- =============================================================================
-- A multiplier, NOT a price and NOT a cost. It carries no purchase price and enables no margin
-- calculation, so the inventory/cost boundary (Track C) stays closed.

ALTER TABLE public.wizard_catalog_items
  ADD COLUMN IF NOT EXISTS install_coefficient_bp integer;

COMMENT ON COLUMN public.wizard_catalog_items.install_coefficient_bp IS
  'PPF施工係数（basis points, 10000 = ×1.0）。NULL = 係数なし（等倍）。価格ではなく倍率。';

-- Scope: the coefficient belongs to PPF/film products and nothing else — the same containment
-- pattern as wci_coupon_fields_scope and wci_quantity_scope.
ALTER TABLE public.wizard_catalog_items
  DROP CONSTRAINT IF EXISTS wci_install_coefficient_scope;
ALTER TABLE public.wizard_catalog_items
  ADD CONSTRAINT wci_install_coefficient_scope CHECK (
    install_coefficient_bp IS NULL
    OR kind IN ('ppf_type_group', 'film_type')
  );

-- Positive integers only. Zero is rejected: a ×0 coefficient would silently zero a line, which is
-- indistinguishable from a pricing failure.
ALTER TABLE public.wizard_catalog_items
  DROP CONSTRAINT IF EXISTS wci_install_coefficient_positive;
ALTER TABLE public.wizard_catalog_items
  ADD CONSTRAINT wci_install_coefficient_positive CHECK (
    install_coefficient_bp IS NULL OR install_coefficient_bp > 0
  );

-- A dealer may override a GLOBAL PPF type's coefficient without authoring a new item, exactly as
-- they may already override its price and display order. Overrides may only narrow/adjust — they
-- never create an item and never widen rank or category eligibility.
ALTER TABLE public.dealer_wizard_catalog_overrides
  ADD COLUMN IF NOT EXISTS install_coefficient_bp integer;

COMMENT ON COLUMN public.dealer_wizard_catalog_overrides.install_coefficient_bp IS
  'ディーラー個別のPPF施工係数（basis points）。NULL = 継承。';

ALTER TABLE public.dealer_wizard_catalog_overrides
  DROP CONSTRAINT IF EXISTS dwco_install_coefficient_positive;
ALTER TABLE public.dealer_wizard_catalog_overrides
  ADD CONSTRAINT dwco_install_coefficient_positive CHECK (
    install_coefficient_bp IS NULL OR install_coefficient_bp > 0
  );

-- =============================================================================
-- Section 2: dealer-scope ownership for PPF type groups
-- =============================================================================
-- 105 seeded ppf_method / ppf_part / ppf_type_group as GLOBAL only, so no dealer could author a
-- PPF type. Ver2.2 requires supporting APUs who install non-GYEON film, so ppf_type_group gains a
-- dealer-scope ownership row. ppf_method and ppf_part stay global read-only: they are the fixed
-- vocabulary of WHERE film is applied, not WHICH film a dealer sells.
--
-- PRESENCE = allowed. This single row is what makes dealer PPF authoring representable at all.
INSERT INTO public.wizard_kind_ownership_policy
  (product_mode, kind, owner_scope, label_owner, price_owner)
VALUES
  ('gyeon', 'ppf_type_group', 'dealer', 'wizard_catalog', 'wizard_catalog')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Section 3: dealer-scoped PPF + coating adjustment rules
-- =============================================================================
-- Ver2.2: "PPF＋コーティングの選択肢も必要。その場合はコーティング費用が安くなる […] 自社設定に
-- 減額補正項目を設ける". The canonical baseline additionally forbids a client-hard-coded discount,
-- so the reduction must be dealer-defined data — this table — and never a constant in the UI.
--
-- Identity is the pair of stable CODES, never labels and never array indices.

CREATE TABLE IF NOT EXISTS public.dealer_ppf_coating_adjustments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT, never CASCADE — matches wizard_catalog_items.dealer_id and the overrides table:
  -- a dealer hard-deletion must never silently erase pricing configuration.
  dealer_id        uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  ppf_method_code  text NOT NULL,
  coating_code     text NOT NULL,
  adjustment_type  text NOT NULL,
  adjustment_value integer NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dpca_type_check CHECK (adjustment_type IN ('amount', 'percent')),
  CONSTRAINT dpca_value_non_negative CHECK (adjustment_value >= 0),
  -- Basis points, capped at 100%. Mirrors wci_coupon_percent_range's intent in bp units.
  CONSTRAINT dpca_percent_range CHECK (
    adjustment_type <> 'percent' OR adjustment_value <= 10000
  ),
  -- Same immutable code shape the catalog enforces (wci_code_format_check).
  CONSTRAINT dpca_ppf_method_code_format CHECK (ppf_method_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  CONSTRAINT dpca_coating_code_format     CHECK (coating_code    ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  CONSTRAINT dpca_dealer_not_zero_uuid CHECK (
    dealer_id <> '00000000-0000-0000-0000-000000000000'::uuid
  )
);

-- Multiplicity is UNREPRESENTABLE: at most one rule per (dealer, ppf method, coating), so the
-- resolver needs no precedence policy and two rules can never silently disagree.
CREATE UNIQUE INDEX IF NOT EXISTS dealer_ppf_coating_adjustments_identity_uidx
  ON public.dealer_ppf_coating_adjustments (dealer_id, ppf_method_code, coating_code);

CREATE INDEX IF NOT EXISTS dealer_ppf_coating_adjustments_dealer_idx
  ON public.dealer_ppf_coating_adjustments (dealer_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.dealer_ppf_coating_adjustments IS
  'PPF＋コーティング併用時の店舗別減額規則。adjustment_value は amount=円 / percent=basis points。';

-- ── RLS: identical pattern to the wizard catalog (read = any active member of the dealer;
--    write = owner|manager via wiz_can_configure). dealer_id is never client-asserted.
ALTER TABLE public.dealer_ppf_coating_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpca_select ON public.dealer_ppf_coating_adjustments;
CREATE POLICY dpca_select ON public.dealer_ppf_coating_adjustments
  FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members
       WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS dpca_insert ON public.dealer_ppf_coating_adjustments;
CREATE POLICY dpca_insert ON public.dealer_ppf_coating_adjustments
  FOR INSERT
  WITH CHECK (public.wiz_can_configure(dealer_id));

DROP POLICY IF EXISTS dpca_update ON public.dealer_ppf_coating_adjustments;
CREATE POLICY dpca_update ON public.dealer_ppf_coating_adjustments
  FOR UPDATE
  USING (public.wiz_can_configure(dealer_id))
  WITH CHECK (public.wiz_can_configure(dealer_id));

-- No DELETE policy: archival is `deleted_at` / `is_active`, never a hard delete, so a saved
-- estimate's explanation can never lose the rule it referenced.

-- ── Revision invalidation, matching the existing statement-level override triggers ──
DROP TRIGGER IF EXISTS trg_dpca_wiz_invalidate_ins ON public.dealer_ppf_coating_adjustments;
CREATE TRIGGER trg_dpca_wiz_invalidate_ins
  AFTER INSERT ON public.dealer_ppf_coating_adjustments
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

DROP TRIGGER IF EXISTS trg_dpca_wiz_invalidate_upd ON public.dealer_ppf_coating_adjustments;
CREATE TRIGGER trg_dpca_wiz_invalidate_upd
  AFTER UPDATE ON public.dealer_ppf_coating_adjustments
  FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change();

-- =============================================================================
-- Section 4: saved-estimate configuration attribution
-- =============================================================================
-- Values on a saved estimate are ALREADY immutable: save_estimate_from_wizard copies labels and
-- money verbatim and performs no arithmetic, so a later configuration edit cannot change a saved
-- estimate. What was missing is ATTRIBUTION — which revision produced those numbers.
--
-- No DEFAULT and no backfill: existing rows keep NULL, which honestly means "unattributed", rather
-- than being stamped with a revision that did not produce them.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS configuration_revision bigint;

COMMENT ON COLUMN public.estimates.configuration_revision IS
  '保存時点の dealer_wizard_catalog_lifecycle.current_configuration_revision。書込後は不変。NULL = 帰属不明（本カラム導入前の見積）。';

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_configuration_revision_nonneg;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_configuration_revision_nonneg CHECK (
    configuration_revision IS NULL OR configuration_revision >= 0
  );

-- =============================================================================
-- Section 5: authoring RPC — extend the kind allowlist
-- =============================================================================
-- Full replacement of wiz_upsert_catalog_item (108 §6). The ONLY changes are additive:
--   • §6.2  allowlist gains 'coupon' and 'ppf_type_group'
--   • §6.5  per-kind payload keys for the two new kinds
--   • §6.8  per-kind derivation + validation for the two new kinds
--   • §6.9/create  canonical category and code prefix for the two new kinds
--   • INSERT/UPDATE carry install_coefficient_bp and the five coupon_* columns
-- Every pre-existing rule — capability gate, product mode, central policy, key allowlist, label
-- rules, price rules, immutable generated code, rank/category derivation, ownership checks and the
-- single revision bump — is preserved verbatim. Coupon VALUE validation is NOT duplicated here:
-- 103's wci_coupon_* CHECK constraints remain the authority.

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
  -- B1.1 additions
  v_coeff          integer;
  v_cpn_type       text;
  v_cpn_value      integer;
  v_cpn_combin     boolean;
  v_cpn_from       date;
  v_cpn_to         date;
BEGIN
  -- 6.1 Identity + capability (never trust the payload for authorization).
  IF v_uid IS NULL THEN RAISE EXCEPTION 'WIZ_UNAUTHENTICATED'; END IF;
  IF p_expected_dealer IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_REQUIRED'; END IF;
  IF NOT public.wiz_can_configure(p_expected_dealer) THEN RAISE EXCEPTION 'WIZ_FORBIDDEN'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'WIZ_INVALID_PAYLOAD';
  END IF;

  -- 6.2 Supported kind. B1.1 adds coupon and ppf_type_group; ppf_method / ppf_part /
  --     window_area remain global read-only vocabulary and are still refused.
  IF p_kind NOT IN ('maintenance_menu','wash_menu','room_cleaning_menu',
                    'film_type','other_work_preset','store_global_option',
                    'coupon','ppf_type_group') THEN
    RAISE EXCEPTION 'WIZ_UNSUPPORTED_KIND: %', p_kind;
  END IF;

  -- 6.3 Dealer's product mode.
  SELECT product_mode INTO v_mode FROM public.dealers WHERE id = p_expected_dealer;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'WIZ_DEALER_NOT_FOUND'; END IF;

  -- 6.4 Central policy for this (mode, kind).
  SELECT permitted_ranks, supports_categories INTO v_permitted, v_supports
    FROM public.wizard_kind_policy WHERE product_mode = v_mode AND kind = p_kind;
  IF NOT FOUND THEN RAISE EXCEPTION 'WIZ_NO_POLICY'; END IF;

  -- 6.5 Per-kind payload key allowlist.
  v_allowed := ARRAY['label_ja','display_order','is_active'];
  IF p_kind IN ('maintenance_menu','wash_menu','room_cleaning_menu') THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','duration_minutes'];
  ELSIF p_kind = 'film_type' THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','presentation','install_coefficient_bp'];
  ELSIF p_kind = 'ppf_type_group' THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','install_coefficient_bp'];
  ELSIF p_kind = 'coupon' THEN
    v_allowed := v_allowed || ARRAY['coupon_discount_type','coupon_discount_value',
                                    'coupon_combinable','coupon_valid_from','coupon_valid_to'];
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

  -- 6.8 Kind-specific derivation.
  v_duration     := NULL;
  v_priceable    := true;
  v_qty_required := false;
  v_min_qty      := 1;
  v_max_qty      := NULL;
  v_presentation := '{}'::jsonb;
  v_coeff        := NULL;
  v_cpn_type     := NULL;
  v_cpn_value    := NULL;
  v_cpn_combin   := NULL;
  v_cpn_from     := NULL;
  v_cpn_to       := NULL;

  IF p_kind IN ('maintenance_menu','wash_menu','room_cleaning_menu') THEN
    IF p_payload ? 'duration_minutes'
       AND jsonb_typeof(p_payload -> 'duration_minutes') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'duration_minutes') <> 'number' THEN RAISE EXCEPTION 'WIZ_DURATION_TYPE'; END IF;
      v_num := (p_payload ->> 'duration_minutes')::numeric;
      IF v_num <> trunc(v_num) OR v_num <= 0 THEN RAISE EXCEPTION 'WIZ_DURATION_INVALID'; END IF;
      v_duration := v_num::integer;
    END IF;

  ELSIF p_kind IN ('film_type','ppf_type_group') THEN
    IF p_kind = 'film_type' AND p_payload ? 'presentation' THEN
      IF jsonb_typeof(p_payload -> 'presentation') <> 'object' THEN RAISE EXCEPTION 'WIZ_PRESENTATION_TYPE'; END IF;
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

    -- Installation coefficient: positive integer basis points. Zero is refused — a x0 coefficient
    -- would silently zero a line and be indistinguishable from a pricing failure.
    IF p_payload ? 'install_coefficient_bp'
       AND jsonb_typeof(p_payload -> 'install_coefficient_bp') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'install_coefficient_bp') <> 'number' THEN
        RAISE EXCEPTION 'WIZ_COEFFICIENT_TYPE';
      END IF;
      v_num := (p_payload ->> 'install_coefficient_bp')::numeric;
      IF v_num <> trunc(v_num) OR v_num <= 0 THEN RAISE EXCEPTION 'WIZ_COEFFICIENT_INVALID'; END IF;
      v_coeff := v_num::integer;
    END IF;

  ELSIF p_kind = 'coupon' THEN
    -- Coupons carry no catalog unit price: their monetary meaning is the discount value.
    IF v_price IS NOT NULL THEN RAISE EXCEPTION 'WIZ_COUPON_PRICE_FORBIDDEN'; END IF;

    IF NOT (p_payload ? 'coupon_discount_type') THEN RAISE EXCEPTION 'WIZ_COUPON_TYPE_REQUIRED'; END IF;
    v_cpn_type := p_payload ->> 'coupon_discount_type';
    IF v_cpn_type NOT IN ('amount','percent') THEN RAISE EXCEPTION 'WIZ_COUPON_TYPE_INVALID'; END IF;

    IF NOT (p_payload ? 'coupon_discount_value')
       OR jsonb_typeof(p_payload -> 'coupon_discount_value') <> 'number' THEN
      RAISE EXCEPTION 'WIZ_COUPON_VALUE_REQUIRED';
    END IF;
    v_num := (p_payload ->> 'coupon_discount_value')::numeric;
    IF v_num <> trunc(v_num) OR v_num < 0 THEN RAISE EXCEPTION 'WIZ_COUPON_VALUE_INVALID'; END IF;
    v_cpn_value := v_num::integer;

    IF NOT (p_payload ? 'coupon_combinable')
       OR jsonb_typeof(p_payload -> 'coupon_combinable') <> 'boolean' THEN
      RAISE EXCEPTION 'WIZ_COUPON_COMBINABLE_REQUIRED';
    END IF;
    v_cpn_combin := (p_payload ->> 'coupon_combinable')::boolean;

    IF p_payload ? 'coupon_valid_from' AND jsonb_typeof(p_payload -> 'coupon_valid_from') <> 'null' THEN
      v_cpn_from := (p_payload ->> 'coupon_valid_from')::date;
    END IF;
    IF p_payload ? 'coupon_valid_to' AND jsonb_typeof(p_payload -> 'coupon_valid_to') <> 'null' THEN
      v_cpn_to := (p_payload ->> 'coupon_valid_to')::date;
    END IF;
    -- Range/order/percent bounds are enforced by 103's wci_coupon_* CHECKs — not duplicated here.

  ELSIF p_kind = 'other_work_preset' THEN
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

  -- 6.9 Canonical category per kind. store_global_option and coupon support none
  --     (wizard_kind_policy.supports_categories = false for both).
  v_category := CASE p_kind
    WHEN 'maintenance_menu'   THEN 'maintenance'
    WHEN 'wash_menu'          THEN 'carwash'
    WHEN 'room_cleaning_menu' THEN 'roomclean'
    WHEN 'film_type'          THEN 'window'
    WHEN 'ppf_type_group'     THEN 'ppf'
    WHEN 'other_work_preset'  THEN 'other'
    ELSE NULL END;

  -- ── CREATE ──
  IF p_item_id IS NULL THEN
    v_prefix := CASE p_kind
      WHEN 'maintenance_menu'    THEN 'maint'
      WHEN 'wash_menu'           THEN 'wash'
      WHEN 'room_cleaning_menu'  THEN 'room'
      WHEN 'film_type'           THEN 'film'
      WHEN 'ppf_type_group'      THEN 'ppftype'
      WHEN 'coupon'              THEN 'coupon'
      WHEN 'other_work_preset'   THEN 'otherwork'
      WHEN 'store_global_option' THEN 'store'
    END;
    v_id   := gen_random_uuid();
    v_code := v_prefix || '-' || v_id::text;   -- immutable, non-label, unique by construction

    INSERT INTO public.wizard_catalog_items (
      id, market, product_mode, kind, owner_scope, dealer_id, code,
      label_owner, price_owner, pricing_ref, label_ja, label_en, description,
      display_order, is_active, default_unit_price, editable_unit_price, priceable,
      quantity_required, min_quantity, max_quantity, duration_minutes, presentation,
      install_coefficient_bp,
      coupon_discount_type, coupon_discount_value, coupon_combinable,
      coupon_valid_from, coupon_valid_to
    ) VALUES (
      v_id, 'jp', v_mode, p_kind, 'dealer', p_expected_dealer, v_code,
      'wizard_catalog', 'wizard_catalog', NULL, v_label, NULL, NULL,
      v_display_order, v_is_active, v_price, false, v_priceable,
      v_qty_required, v_min_qty, v_max_qty, v_duration, v_presentation,
      v_coeff,
      v_cpn_type, v_cpn_value, v_cpn_combin,
      v_cpn_from, v_cpn_to
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

    UPDATE public.wizard_catalog_items SET
      label_ja               = v_label,
      display_order          = v_display_order,
      is_active              = v_is_active,
      default_unit_price     = v_price,
      priceable              = v_priceable,
      quantity_required      = v_qty_required,
      min_quantity           = v_min_qty,
      max_quantity           = v_max_qty,
      duration_minutes       = v_duration,
      presentation           = v_presentation,
      install_coefficient_bp = v_coeff,
      coupon_discount_type   = v_cpn_type,
      coupon_discount_value  = v_cpn_value,
      coupon_combinable      = v_cpn_combin,
      coupon_valid_from      = v_cpn_from,
      coupon_valid_to        = v_cpn_to
    WHERE id = p_item_id;

    v_id     := p_item_id;
    v_code   := v_row.code;
    v_action := 'updated';
  END IF;

  -- 6.10 Single authoritative revision bump for this atomic mutation.
  PERFORM public.wiz_bump_dealer_revision(p_expected_dealer);

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_id,
    'code', v_code,
    'kind', p_kind,
    'action', v_action
  );
END $$;

-- =============================================================================
-- Rollback notes (manual, never automatic)
-- =============================================================================
--   ALTER TABLE public.estimates                       DROP COLUMN IF EXISTS configuration_revision;
--   ALTER TABLE public.dealer_wizard_catalog_overrides DROP COLUMN IF EXISTS install_coefficient_bp;
--   ALTER TABLE public.wizard_catalog_items            DROP COLUMN IF EXISTS install_coefficient_bp;
--   DROP TABLE IF EXISTS public.dealer_ppf_coating_adjustments;
--   DELETE FROM public.wizard_kind_ownership_policy
--     WHERE product_mode='gyeon' AND kind='ppf_type_group' AND owner_scope='dealer';
--   -- then re-apply 108's wiz_upsert_catalog_item definition verbatim.
