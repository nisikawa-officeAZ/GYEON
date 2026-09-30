-- GDA-ESTIMATE-QUANTITY-POLICY-R1 B5 — dedicated dealer wheel/glass menus.
-- Source-only candidate. Do not apply to a remote or production database without
-- the separate Owner gate and disposable-DB execution evidence.
-- No catalogue items, prices, customer data or service-offering opt-ins are seeded.

BEGIN;

-- Fail before any DDL if the canonical functions are absent or no longer have
-- the security posture expected by the 110 / 2026-09-21 migrations. The
-- authoring function is DEFINER; the current save function is INVOKER.
DO $preflight$
DECLARE
  v_author oid := to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)');
  v_save oid := to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)');
BEGIN
  IF v_author IS NULL OR v_save IS NULL THEN
    RAISE EXCEPTION 'B5_PREFLIGHT: canonical authoring/save function missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_author AND prosecdef)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_save AND NOT prosecdef) THEN
    RAISE EXCEPTION 'B5_PREFLIGHT: function security contract drift';
  END IF;
END
$preflight$;

-- The estimate and invoice taxonomies are widened together. Existing rows stay
-- valid; historical Other rows are not guessed or backfilled.
ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_category_check;
ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_category_check CHECK (category IN (
    'coating','ppf','window','interior','glass','wheel','other',
    'maintenance','carwash','roomclean'
  ));
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_category_check;
ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_category_check CHECK (category IN (
    'coating','ppf','window','interior','glass','wheel','other',
    'maintenance','carwash','roomclean'
  ));

-- New catalogue kind/category values are restricted to existing dealer-owned
-- GYEON policy machinery. No new grant, RLS policy or dealer bypass is added.
ALTER TABLE public.wizard_kind_policy
  DROP CONSTRAINT IF EXISTS wizard_kind_policy_kind_check;
ALTER TABLE public.wizard_kind_policy
  ADD CONSTRAINT wizard_kind_policy_kind_check CHECK (kind IN (
    'film_type','window_area','maintenance_menu','wash_menu','room_cleaning_menu',
    'wheel_menu','glass_menu','other_work_preset','store_global_option','coupon',
    'ppf_method','ppf_part','ppf_type_group'
  ));
ALTER TABLE public.wizard_rank_category_policy
  DROP CONSTRAINT IF EXISTS wizard_rcp_category_check;
ALTER TABLE public.wizard_rank_category_policy
  ADD CONSTRAINT wizard_rcp_category_check CHECK (category_id IN (
    'coating','ppf','window','wheel','glass','maintenance','carwash','roomclean','other'
  ));
ALTER TABLE public.wizard_catalog_item_categories
  DROP CONSTRAINT IF EXISTS wcic_category_check;
ALTER TABLE public.wizard_catalog_item_categories
  ADD CONSTRAINT wcic_category_check CHECK (category_id IN (
    'coating','ppf','window','wheel','glass','maintenance','carwash','roomclean','other'
  ));
ALTER TABLE public.wizard_catalog_items
  DROP CONSTRAINT IF EXISTS wci_quantity_scope;
ALTER TABLE public.wizard_catalog_items
  ADD CONSTRAINT wci_quantity_scope CHECK (
    kind IN ('store_global_option','wheel_menu','glass_menu')
    OR (quantity_required = false AND min_quantity = 1 AND max_quantity IS NULL)
  );
ALTER TABLE public.wizard_catalog_items
  ADD CONSTRAINT wci_dedicated_unit_menu_quantity_required CHECK (
    kind NOT IN ('wheel_menu','glass_menu') OR quantity_required = true
  );

-- The existing dealer-authored maintenance menu is the rank-access pattern;
-- the item is still dealer-owned and the runtime resolver still checks owner,
-- active state, rank, and category. No menu rows or amounts are inserted.
INSERT INTO public.wizard_kind_policy
  (product_mode, kind, permitted_ranks, supports_categories)
VALUES
  ('gyeon','wheel_menu',ARRAY['shop','detailer','ppf_installer','certified']::text[],true),
  ('gyeon','glass_menu',ARRAY['shop','detailer','ppf_installer','certified']::text[],true)
ON CONFLICT (product_mode,kind) DO NOTHING;

DO $policy_check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES ('wheel_menu'),('glass_menu')) AS expected(kind)
    LEFT JOIN public.wizard_kind_policy p
      ON p.product_mode = 'gyeon' AND p.kind = expected.kind
    WHERE p.kind IS NULL
       OR p.permitted_ranks IS DISTINCT FROM ARRAY['shop','detailer','ppf_installer','certified']::text[]
       OR p.supports_categories IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'B5_PREFLIGHT: dedicated-menu kind policy drift';
  END IF;
END
$policy_check$;

INSERT INTO public.wizard_kind_ownership_policy
  (product_mode,kind,owner_scope,label_owner,price_owner)
VALUES
  ('gyeon','wheel_menu','dealer','wizard_catalog','wizard_catalog'),
  ('gyeon','glass_menu','dealer','wizard_catalog','wizard_catalog')
ON CONFLICT (product_mode,kind,owner_scope,label_owner,price_owner) DO NOTHING;

INSERT INTO public.wizard_rank_category_policy (product_mode,rank,category_id)
SELECT 'gyeon', r.rank, c.category_id
FROM (VALUES ('shop'),('detailer'),('ppf_installer'),('certified')) AS r(rank)
CROSS JOIN (VALUES ('wheel'),('glass')) AS c(category_id)
ON CONFLICT (product_mode,rank,category_id) DO NOTHING;

-- Upgrade the CURRENT authoring RPC by replacing exact, uniquely-asserted
-- source fragments. This is safer than reissuing a stale 110-era function and
-- accidentally discarding later security/validation repairs. If any expected
-- fragment drifted, the whole transaction fails and rolls back.
DO $author_patch$
DECLARE
  v_oid oid := to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)');
  v_def text;
  v_patch record;
BEGIN
  v_def := pg_get_functiondef(v_oid);
  FOR v_patch IN
    SELECT old_text, new_text FROM (VALUES
      ($old$IF p_kind NOT IN ('maintenance_menu','wash_menu','room_cleaning_menu',
                    'film_type','other_work_preset','store_global_option',
                    'coupon','ppf_type_group') THEN$old$,
       $new$IF p_kind NOT IN ('maintenance_menu','wash_menu','room_cleaning_menu',
                    'film_type','other_work_preset','store_global_option',
                    'coupon','ppf_type_group','wheel_menu','glass_menu') THEN$new$),
      ($old$  ELSIF p_kind = 'store_global_option' THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','priceable',
                                    'quantity_required','min_quantity','max_quantity'];$old$,
       $new$  ELSIF p_kind IN ('wheel_menu','glass_menu') THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','quantity_required',
                                    'min_quantity','max_quantity'];
  ELSIF p_kind = 'store_global_option' THEN
    v_allowed := v_allowed || ARRAY['default_unit_price','priceable',
                                    'quantity_required','min_quantity','max_quantity'];$new$),
      ($old$  ELSIF p_kind = 'store_global_option' THEN
    IF NOT (p_payload ? 'priceable')$old$,
       $new$  ELSIF p_kind IN ('wheel_menu','glass_menu') THEN
    -- Quantity is fixed BY KIND; a supplied false/non-boolean flag is rejected.
    v_qty_required := true;
    IF p_payload ? 'quantity_required' THEN
      IF jsonb_typeof(p_payload -> 'quantity_required') <> 'boolean' THEN
        RAISE EXCEPTION 'WIZ_QUANTITY_REQUIRED_FLAG';
      END IF;
      IF (p_payload ->> 'quantity_required')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'WIZ_QUANTITY_REQUIRED_FLAG';
      END IF;
    END IF;
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

  ELSIF p_kind = 'store_global_option' THEN
    IF NOT (p_payload ? 'priceable')$new$),
      ($old$    WHEN 'room_cleaning_menu' THEN 'roomclean'
    WHEN 'film_type'          THEN 'window'$old$,
       $new$    WHEN 'room_cleaning_menu' THEN 'roomclean'
    WHEN 'wheel_menu'         THEN 'wheel'
    WHEN 'glass_menu'         THEN 'glass'
    WHEN 'film_type'          THEN 'window'$new$),
      ($old$      WHEN 'room_cleaning_menu'  THEN 'room'
      WHEN 'film_type'           THEN 'film'$old$,
       $new$      WHEN 'room_cleaning_menu'  THEN 'room'
      WHEN 'wheel_menu'          THEN 'wheel'
      WHEN 'glass_menu'          THEN 'glass'
      WHEN 'film_type'           THEN 'film'$new$)
    ) AS patch(old_text,new_text)
  LOOP
    IF length(v_def) - length(replace(v_def,v_patch.old_text,'')) <> length(v_patch.old_text) THEN
      RAISE EXCEPTION 'B5_PREFLIGHT: authoring RPC source drift';
    END IF;
    v_def := replace(v_def,v_patch.old_text,v_patch.new_text);
  END LOOP;
  EXECUTE v_def;
END
$author_patch$;

-- The September runtime-repair migration is the latest save definition. Its
-- existing auth, idempotency, totals, offering guard and grants are preserved.
DO $save_patch$
DECLARE
  v_oid oid := to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)');
  v_def text;
  v_old text := $old$  c_cats   CONSTANT text[] := ARRAY['coating','ppf','window','interior','glass',
                                    'other','maintenance','carwash','roomclean'];$old$;
  v_new text := $new$  c_cats   CONSTANT text[] := ARRAY['coating','ppf','window','interior','glass','wheel',
                                    'other','maintenance','carwash','roomclean'];$new$;
BEGIN
  v_def := pg_get_functiondef(v_oid);
  IF length(v_def) - length(replace(v_def,v_old,'')) <> length(v_old) THEN
    RAISE EXCEPTION 'B5_PREFLIGHT: save RPC source drift';
  END IF;
  EXECUTE replace(v_def,v_old,v_new);
END
$save_patch$;

-- No GRANT statements: CREATE OR REPLACE keeps existing privileges. Verify each
-- function preserves its own SECURITY mode and established search path.
DO $postflight$
DECLARE
  v_author oid := to_regprocedure('public.wiz_upsert_catalog_item(uuid,uuid,text,jsonb)');
  v_save oid := to_regprocedure('public.save_estimate_from_wizard(uuid,uuid,jsonb)');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_author AND prosecdef AND proconfig @> ARRAY['search_path=public, pg_catalog']::text[])
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_save AND NOT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'B5_POSTFLIGHT: function security/search_path drift';
  END IF;
END
$postflight$;

COMMIT;
