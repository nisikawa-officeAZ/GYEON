-- GDA-OTHER-COATINGS-R1: dealer-owned optional coatings and provisional starting prices.
-- Applies AFTER 20260930025030_estimate_wheel_glass_service_menus.sql.
-- Source-only candidate. Production application requires a separate Owner gate.
-- Existing dealer-authored or archived entries win by code OR trimmed Japanese label.

BEGIN;

DO $preflight$
DECLARE
  v_author oid := to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)');
  v_save oid := to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)');
  v_seed oid := to_regprocedure('public.wiz_seed_default_estimate_catalog(uuid)');
BEGIN
  IF v_author IS NULL OR v_save IS NULL OR v_seed IS NULL THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: canonical function missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_author AND prosecdef
                 AND proconfig @> ARRAY['search_path=public, pg_catalog']::text[])
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_save AND NOT prosecdef
                    AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[])
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_seed AND prosecdef
                    AND proconfig @> ARRAY['search_path=public, pg_catalog']::text[])
  THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: function security/search_path drift';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.wizard_catalog_items'::regclass
                    AND conname = 'wci_dedicated_unit_menu_quantity_required') THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: prerequisite B5 migration missing';
  END IF;
END
$preflight$;

-- Every stored category boundary must accept the new category together. No old
-- 'other' or 'coating' row is guessed, relabelled or backfilled.
ALTER TABLE public.estimate_items DROP CONSTRAINT IF EXISTS estimate_items_category_check;
ALTER TABLE public.estimate_items ADD CONSTRAINT estimate_items_category_check CHECK (category IN (
  'coating','ppf','window','interior','glass','wheel','other_coating','other',
  'maintenance','carwash','roomclean'
));
ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_category_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_category_check CHECK (category IN (
  'coating','ppf','window','interior','glass','wheel','other_coating','other',
  'maintenance','carwash','roomclean'
));
ALTER TABLE public.wizard_kind_policy DROP CONSTRAINT IF EXISTS wizard_kind_policy_kind_check;
ALTER TABLE public.wizard_kind_policy ADD CONSTRAINT wizard_kind_policy_kind_check CHECK (kind IN (
  'film_type','window_area','maintenance_menu','wash_menu','room_cleaning_menu',
  'wheel_menu','glass_menu','other_coating_menu','other_work_preset',
  'store_global_option','coupon','ppf_method','ppf_part','ppf_type_group'
));
ALTER TABLE public.wizard_rank_category_policy DROP CONSTRAINT IF EXISTS wizard_rcp_category_check;
ALTER TABLE public.wizard_rank_category_policy ADD CONSTRAINT wizard_rcp_category_check CHECK (category_id IN (
  'coating','ppf','window','wheel','glass','other_coating',
  'maintenance','carwash','roomclean','other'
));
ALTER TABLE public.wizard_catalog_item_categories DROP CONSTRAINT IF EXISTS wcic_category_check;
ALTER TABLE public.wizard_catalog_item_categories ADD CONSTRAINT wcic_category_check CHECK (category_id IN (
  'coating','ppf','window','wheel','glass','other_coating',
  'maintenance','carwash','roomclean','other'
));
ALTER TABLE public.wizard_catalog_items DROP CONSTRAINT IF EXISTS wci_quantity_scope;
ALTER TABLE public.wizard_catalog_items ADD CONSTRAINT wci_quantity_scope CHECK (
  kind IN ('store_global_option','wheel_menu','glass_menu','other_coating_menu')
  OR (quantity_required = false AND min_quantity = 1 AND max_quantity IS NULL)
);
ALTER TABLE public.wizard_catalog_items ADD CONSTRAINT wci_other_coating_fixed_one CHECK (
  kind <> 'other_coating_menu' OR quantity_required
  OR (min_quantity = 1 AND max_quantity IS NULL)
);
ALTER TABLE public.wizard_catalog_items ADD CONSTRAINT wci_other_coating_positive_price CHECK (
  kind <> 'other_coating_menu' OR default_unit_price IS NULL OR default_unit_price >= 1
);

-- Reuse the existing dealer-owned policy and rank×category validators. No new
-- broad SELECT/INSERT grants or RLS policy is added.
INSERT INTO public.wizard_kind_policy
  (product_mode, kind, permitted_ranks, supports_categories)
VALUES ('gyeon','other_coating_menu',ARRAY['shop','detailer','ppf_installer','certified']::text[],true)
ON CONFLICT (product_mode,kind) DO NOTHING;

DO $policy_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.wizard_kind_policy p
    WHERE p.product_mode = 'gyeon' AND p.kind = 'other_coating_menu'
      AND p.permitted_ranks = ARRAY['shop','detailer','ppf_installer','certified']::text[]
      AND p.supports_categories = true
  ) THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: kind policy drift';
  END IF;
END
$policy_check$;

INSERT INTO public.wizard_kind_ownership_policy
  (product_mode,kind,owner_scope,label_owner,price_owner)
VALUES ('gyeon','other_coating_menu','dealer','wizard_catalog','wizard_catalog')
ON CONFLICT (product_mode,kind,owner_scope,label_owner,price_owner) DO NOTHING;

INSERT INTO public.wizard_rank_category_policy (product_mode,rank,category_id)
SELECT 'gyeon', r.rank, 'other_coating'
FROM (VALUES ('shop'),('detailer'),('ppf_installer'),('certified')) AS r(rank)
ON CONFLICT (product_mode,rank,category_id) DO NOTHING;

-- Patch only uniquely matched fragments of the current B5 authoring function.
-- Any upstream drift aborts the transaction instead of restoring an older body.
DO $author_patch$
DECLARE
  v_oid oid := to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)');
  v_def text := pg_get_functiondef(v_oid);
  v_patch record;
BEGIN
  FOR v_patch IN SELECT old_text, new_text FROM (VALUES
    ($old$'coupon','ppf_type_group','wheel_menu','glass_menu') THEN$old$,
     $new$'coupon','ppf_type_group','wheel_menu','glass_menu','other_coating_menu') THEN$new$),
    ($old$  ELSIF p_kind IN ('wheel_menu','glass_menu') THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','quantity_required',
                                    'min_quantity','max_quantity'];$old$,
     $new$  ELSIF p_kind IN ('wheel_menu','glass_menu','other_coating_menu') THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','quantity_required',
                                    'min_quantity','max_quantity'];$new$),
    ($old$  ELSIF p_kind = 'store_global_option' THEN
    IF NOT (p_payload ? 'priceable')$old$,
     $new$  ELSIF p_kind = 'other_coating_menu' THEN
    -- Authoring accepts NULL as unconfigured, but refuses an authored zero price.
    IF v_price IS NOT NULL AND v_price < 1 THEN
      RAISE EXCEPTION 'WIZ_PRICE_INVALID';
    END IF;
    IF NOT (p_payload ? 'quantity_required')
       OR jsonb_typeof(p_payload -> 'quantity_required') <> 'boolean' THEN
      RAISE EXCEPTION 'WIZ_QUANTITY_REQUIRED_FLAG';
    END IF;
    v_qty_required := (p_payload ->> 'quantity_required')::boolean;
    IF p_payload ? 'min_quantity' AND jsonb_typeof(p_payload -> 'min_quantity') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'min_quantity') <> 'number' THEN RAISE EXCEPTION 'WIZ_MIN_QTY_TYPE'; END IF;
      v_num := (p_payload ->> 'min_quantity')::numeric;
      IF v_num <> trunc(v_num) OR v_num < 1 OR v_num > 2147483647 THEN RAISE EXCEPTION 'WIZ_MIN_QTY_INVALID'; END IF;
      v_min_qty := v_num::integer;
    END IF;
    IF p_payload ? 'max_quantity' AND jsonb_typeof(p_payload -> 'max_quantity') <> 'null' THEN
      IF jsonb_typeof(p_payload -> 'max_quantity') <> 'number' THEN RAISE EXCEPTION 'WIZ_MAX_QTY_TYPE'; END IF;
      v_num := (p_payload ->> 'max_quantity')::numeric;
      IF v_num <> trunc(v_num) OR v_num > 2147483647 OR v_num < v_min_qty THEN RAISE EXCEPTION 'WIZ_MAX_QTY_INVALID'; END IF;
      v_max_qty := v_num::integer;
    END IF;
    IF NOT v_qty_required AND (v_min_qty <> 1 OR v_max_qty IS NOT NULL) THEN
      RAISE EXCEPTION 'WIZ_FIXED_ONE_QUANTITY';
    END IF;

  ELSIF p_kind = 'store_global_option' THEN
    IF NOT (p_payload ? 'priceable')$new$),
    ($old$    WHEN 'glass_menu'         THEN 'glass'
    WHEN 'film_type'          THEN 'window'$old$,
     $new$    WHEN 'glass_menu'         THEN 'glass'
    WHEN 'other_coating_menu' THEN 'other_coating'
    WHEN 'film_type'          THEN 'window'$new$),
    ($old$      WHEN 'glass_menu'          THEN 'glass'
      WHEN 'film_type'           THEN 'film'$old$,
     $new$      WHEN 'glass_menu'          THEN 'glass'
      WHEN 'other_coating_menu'  THEN 'ocoat'
      WHEN 'film_type'           THEN 'film'$new$)
  ) AS patch(old_text,new_text) LOOP
    IF length(v_def) - length(replace(v_def,v_patch.old_text,'')) <> length(v_patch.old_text) THEN
      RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: authoring RPC source drift';
    END IF;
    v_def := replace(v_def,v_patch.old_text,v_patch.new_text);
  END LOOP;
  EXECUTE v_def;
END
$author_patch$;

DO $save_patch$
DECLARE
  v_oid oid := to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)');
  v_def text := pg_get_functiondef(v_oid);
  v_old text := $old$  c_cats   CONSTANT text[] := ARRAY['coating','ppf','window','interior','glass','wheel',
                                    'other','maintenance','carwash','roomclean'];$old$;
  v_new text := $new$  c_cats   CONSTANT text[] := ARRAY['coating','ppf','window','interior','glass','wheel',
                                    'other_coating','other','maintenance','carwash','roomclean'];$new$;
BEGIN
  IF length(v_def) - length(replace(v_def,v_old,'')) <> length(v_old) THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: save RPC source drift';
  END IF;
  EXECUTE replace(v_def,v_old,v_new);
END
$save_patch$;

-- Preserve the canonical seeder and its new-dealer lifecycle trigger. Extend
-- only its default rows, category links and descriptive provisional-price note.
DO $seed_patch$
DECLARE
  v_oid oid := to_regprocedure('public.wiz_seed_default_estimate_catalog(uuid)');
  v_def text := pg_get_functiondef(v_oid);
  v_patch record;
BEGIN
  FOR v_patch IN SELECT old_text, new_text FROM (VALUES
    ($old$        ('maintenance_menu', 'da-default-maint-premium',
          'プレミアムメンテナンス', 40000, 240, 150, true, false, 1, NULL::integer)$old$,
     $new$        ('maintenance_menu', 'da-default-maint-premium',
          'プレミアムメンテナンス', 40000, 240, 150, true, false, 1, NULL::integer),
        ('wheel_menu', 'da-default-wheel-coating',
          'ホイールコーティング', 5000, NULL::integer, 210, true, true, 1, 8),
        ('glass_menu', 'da-default-glass-coating',
          'ガラスコーティング', 9000, NULL::integer, 220, true, true, 1, 12),
        ('other_coating_menu', 'da-default-trim-coating',
          '樹脂TRIMコーティング', 15000, NULL::integer, 230, true, false, 1, NULL::integer),
        ('other_coating_menu', 'da-default-seat-coating',
          'シートコーティング', 11000, NULL::integer, 240, true, true, 1, 10),
        ('other_coating_menu', 'da-default-engine-room-coating',
          'エンジンルームコーティング', 20000, NULL::integer, 250, true, false, 1, NULL::integer)$new$),
    ($old$      'wizard_catalog', 'wizard_catalog', NULL, v_default.label_ja, NULL, NULL,
      v_default.display_order$old$,
     $new$      'wizard_catalog', 'wizard_catalog', NULL, v_default.label_ja, NULL,
      CASE WHEN v_default.kind IN ('wheel_menu','glass_menu','other_coating_menu')
           THEN '参考初期価格（税込ではありません）。店舗で確認・変更してください。'
           ELSE NULL END,
      v_default.display_order$new$),
    ($old$    IF v_default.kind = 'maintenance_menu' THEN
      INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
      VALUES (v_item_id, 'maintenance');
    END IF;$old$,
     $new$    IF v_default.kind IN ('maintenance_menu','wheel_menu','glass_menu','other_coating_menu') THEN
      INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
      VALUES (v_item_id, CASE v_default.kind
        WHEN 'maintenance_menu' THEN 'maintenance'
        WHEN 'wheel_menu' THEN 'wheel'
        WHEN 'glass_menu' THEN 'glass'
        ELSE 'other_coating' END);
    END IF;$new$)
  ) AS patch(old_text,new_text) LOOP
    IF length(v_def) - length(replace(v_def,v_patch.old_text,'')) <> length(v_patch.old_text) THEN
      RAISE EXCEPTION 'GDA_OTHER_COATINGS_PREFLIGHT: seeder source drift';
    END IF;
    v_def := replace(v_def,v_patch.old_text,v_patch.new_text);
  END LOOP;
  EXECUTE v_def;
END
$seed_patch$;

-- The seeder is an internal migration/trigger helper, not a public RPC.
REVOKE EXECUTE ON FUNCTION public.wiz_seed_default_estimate_catalog(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Backfill only missing defaults for active GYEON dealers. The same updated
-- function is already called for future dealers by wiz_init_dealer_lifecycle.
DO $backfill$
DECLARE v_dealer record;
BEGIN
  FOR v_dealer IN SELECT id FROM public.dealers
                   WHERE product_mode = 'gyeon' AND deleted_at IS NULL ORDER BY id
  LOOP
    PERFORM public.wiz_seed_default_estimate_catalog(v_dealer.id);
  END LOOP;
END
$backfill$;

DO $postflight$
DECLARE
  v_author oid := to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)');
  v_save oid := to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)');
  v_seed oid := to_regprocedure('public.wiz_seed_default_estimate_catalog(uuid)');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_author AND prosecdef
                 AND proconfig @> ARRAY['search_path=public, pg_catalog']::text[])
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_save AND NOT prosecdef
                    AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[])
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_seed AND prosecdef
                    AND proconfig @> ARRAY['search_path=public, pg_catalog']::text[])
  THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_POSTFLIGHT: function security/search_path drift';
  END IF;
  IF has_function_privilege('anon', v_seed, 'EXECUTE')
     OR has_function_privilege('authenticated', v_seed, 'EXECUTE')
     OR has_function_privilege('service_role', v_seed, 'EXECUTE') THEN
    RAISE EXCEPTION 'GDA_OTHER_COATINGS_POSTFLIGHT: seeder execute grant drift';
  END IF;
END
$postflight$;

COMMIT;
