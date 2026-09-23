-- Seed an immediately usable DA estimate catalog without overwriting dealer-owned choices.
-- Existing rows win by permanent code OR normalized Japanese label, including archived rows.
-- Prices are tax-exclusive integers and remain editable through Estimate Wizard Settings.

BEGIN;

CREATE OR REPLACE FUNCTION public.wiz_seed_default_estimate_catalog(p_dealer uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_mode              text;
  v_deleted_at        timestamptz;
  v_default           record;
  v_item_id           uuid;
  v_permitted_ranks   text[];
  v_inserted_items    integer := 0;
  v_offering_inserted integer := 0;
BEGIN
  IF p_dealer IS NULL THEN
    RAISE EXCEPTION 'wiz_seed_default_estimate_catalog: dealer id is required';
  END IF;

  SELECT product_mode, deleted_at
    INTO v_mode, v_deleted_at
    FROM public.dealers
   WHERE id = p_dealer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wiz_seed_default_estimate_catalog: dealer not found';
  END IF;

  -- Dealer Assistance defaults belong only to active GYEON dealers.
  IF v_mode <> 'gyeon' OR v_deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'seeded', false,
      'inserted_items', 0,
      'maintenance_offering_inserted', false
    );
  END IF;

  FOR v_default IN
    SELECT *
      FROM (VALUES
        -- kind, code, label, price, duration, order, priceable, qty-required, min, max
        ('store_global_option', 'da-default-iron-removal',
          '鉄粉除去', 8000, NULL::integer, 10, true, false, 1, NULL::integer),
        ('store_global_option', 'da-default-hard-polish',
          'ハードポリッシュ', 30000, NULL::integer, 20, true, false, 1, NULL::integer),
        ('store_global_option', 'da-default-scratch-repair',
          '傷補修', 12000, NULL::integer, 30, true, true, 1, 20),
        ('store_global_option', 'da-default-headlight-repair',
          'ヘッドライトリペア', 15000, NULL::integer, 40, true, false, 1, NULL::integer),
        ('store_global_option', 'da-default-touch-up-pen',
          'タッチペン', 3000, NULL::integer, 50, true, true, 1, NULL::integer),
        ('maintenance_menu', 'da-default-maint-light',
          'ライトメンテナンス', 5000, 30, 110, true, false, 1, NULL::integer),
        ('maintenance_menu', 'da-default-maint-6m',
          '6か月メンテナンス', 8000, 60, 120, true, false, 1, NULL::integer),
        ('maintenance_menu', 'da-default-maint-12m',
          '12か月メンテナンス', 15000, 120, 130, true, false, 1, NULL::integer),
        ('maintenance_menu', 'da-default-maint-coating',
          'コーティング定期メンテナンス', 25000, 150, 140, true, false, 1, NULL::integer),
        ('maintenance_menu', 'da-default-maint-premium',
          'プレミアムメンテナンス', 40000, 240, 150, true, false, 1, NULL::integer)
      ) AS d(
        kind, code, label_ja, default_unit_price, duration_minutes,
        display_order, priceable, quantity_required, min_quantity, max_quantity
      )
  LOOP
    -- A dealer-authored equivalent, even archived, is authoritative. Never overwrite it,
    -- duplicate it, or silently resurrect it.
    IF EXISTS (
      SELECT 1
        FROM public.wizard_catalog_items i
       WHERE i.dealer_id = p_dealer
         AND i.owner_scope = 'dealer'
         AND i.kind = v_default.kind
         AND (
           i.code = v_default.code
           OR btrim(i.label_ja) = btrim(v_default.label_ja)
         )
    ) THEN
      CONTINUE;
    END IF;

    SELECT permitted_ranks
      INTO v_permitted_ranks
      FROM public.wizard_kind_policy
     WHERE product_mode = v_mode
       AND kind = v_default.kind;

    IF v_permitted_ranks IS NULL OR cardinality(v_permitted_ranks) = 0 THEN
      RAISE EXCEPTION
        'wiz_seed_default_estimate_catalog: missing kind policy for mode %, kind %',
        v_mode, v_default.kind;
    END IF;

    INSERT INTO public.wizard_catalog_items (
      market, product_mode, kind, owner_scope, dealer_id, code,
      label_owner, price_owner, pricing_ref, label_ja, label_en, description,
      display_order, is_active, default_unit_price, editable_unit_price, priceable,
      quantity_required, min_quantity, max_quantity, duration_minutes, presentation
    ) VALUES (
      'jp', v_mode, v_default.kind, 'dealer', p_dealer, v_default.code,
      'wizard_catalog', 'wizard_catalog', NULL, v_default.label_ja, NULL, NULL,
      v_default.display_order, true, v_default.default_unit_price, false, v_default.priceable,
      v_default.quantity_required, v_default.min_quantity, v_default.max_quantity,
      v_default.duration_minutes, '{}'::jsonb
    )
    RETURNING id INTO v_item_id;

    INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
    SELECT v_item_id, ranks.rank
      FROM unnest(v_permitted_ranks) AS ranks(rank);

    IF v_default.kind = 'maintenance_menu' THEN
      INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
      VALUES (v_item_id, 'maintenance');
    END IF;

    v_inserted_items := v_inserted_items + 1;
  END LOOP;

  -- Make the seeded maintenance menu reachable in the estimate wizard, but preserve any
  -- explicit existing ON/OFF choice by never updating a pre-existing offering row.
  INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled)
  SELECT p_dealer, 'maintenance', true
   WHERE EXISTS (
     SELECT 1
       FROM public.wizard_catalog_items i
      WHERE i.dealer_id = p_dealer
        AND i.kind = 'maintenance_menu'
        AND i.is_active
        AND i.deleted_at IS NULL
   )
  ON CONFLICT (dealer_id, family) DO NOTHING;

  GET DIAGNOSTICS v_offering_inserted = ROW_COUNT;

  -- The offering INSERT trigger already bumps once. When it was an existing row, catalog
  -- insertion still needs exactly one explicit revision invalidation.
  IF v_inserted_items > 0 AND v_offering_inserted = 0 THEN
    PERFORM public.wiz_bump_dealer_revision(p_dealer);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'seeded', v_inserted_items > 0,
    'inserted_items', v_inserted_items,
    'maintenance_offering_inserted', v_offering_inserted = 1
  );
END;
$$;

-- Existing active GYEON dealers receive only missing defaults.
DO $$
DECLARE
  v_dealer record;
BEGIN
  FOR v_dealer IN
    SELECT id
      FROM public.dealers
     WHERE product_mode = 'gyeon'
       AND deleted_at IS NULL
     ORDER BY id
  LOOP
    PERFORM public.wiz_seed_default_estimate_catalog(v_dealer.id);
  END LOOP;
END;
$$;

-- Future dealers receive the same defaults as part of the existing lifecycle-init trigger.
CREATE OR REPLACE FUNCTION public.wiz_init_dealer_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.dealer_wizard_catalog_lifecycle (dealer_id)
  VALUES (NEW.id)
  ON CONFLICT (dealer_id) DO NOTHING;

  -- Default-catalog availability must never become a hard dependency of dealer signup.
  -- Keep the lifecycle row, roll back only the seed subtransaction on failure, and surface
  -- a warning for operators. The migration backfill calls the seed helper directly, so
  -- policy or validator failures during deployment still fail the migration closed.
  BEGIN
    PERFORM public.wiz_seed_default_estimate_catalog(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
      'wiz_init_dealer_lifecycle: default catalog seed skipped for dealer % (SQLSTATE %)',
      NEW.id, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;

-- Both functions are internal trigger/migration helpers, never public RPCs.
REVOKE EXECUTE ON FUNCTION public.wiz_seed_default_estimate_catalog(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_init_dealer_lifecycle()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
