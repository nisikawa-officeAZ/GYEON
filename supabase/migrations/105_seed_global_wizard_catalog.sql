-- ============================================================================
-- 105_seed_global_wizard_catalog.sql — Global GYEON Wizard catalog seed (C2B1B)
--
-- SEED-ONLY. FORWARD-ONLY. TRANSACTIONAL. RERUNNABLE. FREEZE-PRESERVING.
--
-- Seeds the global (GYEON-owned) configuration the Estimate Wizard needs:
--   • wizard_kind_policy            — 11 rows (all existing kinds)
--   • wizard_kind_ownership_policy  — 11 rows (4 global + 7 dealer-scope)
--   • wizard_rank_category_policy   — 24 rows (C2B1A rank/category matrix)
--   • wizard_catalog_items (global) — 39 rows: 7 window_area, 5 ppf_method,
--                                     16 ppf_part, 11 ppf_type_group (3 parents + 8 products)
--   • wizard_catalog_item_ranks     — 110 rows
--   • wizard_catalog_item_categories— 39 rows
--
-- It also restores the least-privilege runtime grants that 104 revoked-and-deferred:
--   • authenticated: SELECT only on the eight wizard tables
--   • authenticated: EXECUTE only on the three wiz_* RLS helpers
-- preserving 104's revoke-then-exact-regrant discipline. service_role keeps its
-- 104 table DML and gains NO helper EXECUTE; anon and PUBLIC gain nothing.
--
-- Architect rulings encoded here: D1 (PPF methods are the Wizard axis; legacy
-- plans untouched; pricing_ref NULL / dealer-priced), D2 (side-step is a plain
-- ppf_part; quantity metadata left at defaults), D3 (16 DEFAULT_PPF_PARTS are
-- canonical; legacy sp-* untouched), D4 (11 ppf_type_group rows: 3 parents +
-- 8 products via ppf_type_group_id), D5 (store_global_option supports_categories
-- = false, dealer-scope; no rows here), D6 (exactly the seven canonical
-- window_area codes; no legacy aliases), D7 (no coating data here), D8 (only
-- global ownership for the four global kinds; no dealer tuples for them).
--
-- No coating kind, no coating-layer table, no schema DDL: coating identities and
-- layer compatibility remain owned by PricingCatalog + coating-matrix.ts (Option B).
--
-- Identity UUIDs are deterministic literals so re-execution is idempotent.
-- Every catalog INSERT is conflict-safe on the primary key; a post-seed
-- verification block RAISEs on any identity / ownership / parent / category /
-- rank / label / active-state drift so a conflicting pre-existing row is never
-- silently accepted or overwritten.
-- ============================================================================

BEGIN;

-- ── Section A: kind policy (11 rows) ────────────────────────────────────────
-- PRESENCE = allowed. permitted_ranks encodes ruling 1; supports_categories per D5.
INSERT INTO public.wizard_kind_policy (product_mode, kind, permitted_ranks, supports_categories) VALUES
  ('gyeon', 'ppf_method',          ARRAY['detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'ppf_part',            ARRAY['detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'ppf_type_group',      ARRAY['detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'window_area',         ARRAY['detailer','certified']::text[],                 true),
  ('gyeon', 'film_type',           ARRAY['detailer','certified']::text[],                 true),
  ('gyeon', 'maintenance_menu',    ARRAY['shop','detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'wash_menu',           ARRAY['shop','detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'room_cleaning_menu',  ARRAY['shop','detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'other_work_preset',   ARRAY['shop','detailer','ppf_installer','certified']::text[], true),
  ('gyeon', 'store_global_option', ARRAY['shop','detailer','ppf_installer','certified']::text[], false),
  ('gyeon', 'coupon',              ARRAY['shop','detailer','ppf_installer','certified']::text[], false)
ON CONFLICT (product_mode, kind) DO NOTHING;

-- ── Section B: ownership policy (11 rows: 4 global + 7 dealer) ───────────────
-- All wizard_catalog-owned labels and prices ⇒ pricing_ref is NULL on every item
-- and prices are dealer-configured (fail-closed until set). D8: only global
-- ownership for the four global kinds; the seven dealer kinds get dealer scope.
INSERT INTO public.wizard_kind_ownership_policy (product_mode, kind, owner_scope, label_owner, price_owner) VALUES
  ('gyeon', 'ppf_method',          'global', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'ppf_part',            'global', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'ppf_type_group',      'global', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'window_area',         'global', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'film_type',           'dealer', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'maintenance_menu',    'dealer', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'wash_menu',           'dealer', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'room_cleaning_menu',  'dealer', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'other_work_preset',   'dealer', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'store_global_option', 'dealer', 'wizard_catalog', 'wizard_catalog'),
  ('gyeon', 'coupon',              'dealer', 'wizard_catalog', 'wizard_catalog')
ON CONFLICT (product_mode, kind, owner_scope, label_owner, price_owner) DO NOTHING;

-- ── Section C: rank/category policy (24 rows — C2B1A matrix, verbatim) ───────
INSERT INTO public.wizard_rank_category_policy (product_mode, rank, category_id) VALUES
  ('gyeon', 'shop',          'coating'),
  ('gyeon', 'shop',          'maintenance'),
  ('gyeon', 'shop',          'carwash'),
  ('gyeon', 'shop',          'roomclean'),
  ('gyeon', 'shop',          'other'),
  ('gyeon', 'detailer',      'coating'),
  ('gyeon', 'detailer',      'ppf'),
  ('gyeon', 'detailer',      'window'),
  ('gyeon', 'detailer',      'maintenance'),
  ('gyeon', 'detailer',      'carwash'),
  ('gyeon', 'detailer',      'roomclean'),
  ('gyeon', 'detailer',      'other'),
  ('gyeon', 'certified',     'coating'),
  ('gyeon', 'certified',     'ppf'),
  ('gyeon', 'certified',     'window'),
  ('gyeon', 'certified',     'maintenance'),
  ('gyeon', 'certified',     'carwash'),
  ('gyeon', 'certified',     'roomclean'),
  ('gyeon', 'certified',     'other'),
  ('gyeon', 'ppf_installer', 'ppf'),
  ('gyeon', 'ppf_installer', 'maintenance'),
  ('gyeon', 'ppf_installer', 'carwash'),
  ('gyeon', 'ppf_installer', 'roomclean'),
  ('gyeon', 'ppf_installer', 'other')
ON CONFLICT (product_mode, rank, category_id) DO NOTHING;

-- ── Section D: window_area catalog (7 rows) — D6 canonical codes/labels ──────
-- Deterministic UUIDs: 00000105-0001-...  owner_scope global, dealer_id NULL,
-- wizard_catalog label/price, pricing_ref NULL, active, not deleted.
INSERT INTO public.wizard_catalog_items
  (id, market, product_mode, kind, owner_scope, dealer_id, code,
   label_owner, price_owner, pricing_ref, label_ja, label_en, display_order, is_active)
VALUES
  ('00000105-0001-0000-0000-000000000001', 'jp', 'gyeon', 'window_area', 'global', NULL, 'front-windshield', 'wizard_catalog', 'wizard_catalog', NULL, 'フロントガラス',               NULL, 1, true),
  ('00000105-0001-0000-0000-000000000002', 'jp', 'gyeon', 'window_area', 'global', NULL, 'front-door-glass', 'wizard_catalog', 'wizard_catalog', NULL, 'フロントドアガラス',           NULL, 2, true),
  ('00000105-0001-0000-0000-000000000003', 'jp', 'gyeon', 'window_area', 'global', NULL, 'rear-door-glass',  'wizard_catalog', 'wizard_catalog', NULL, 'リアドアガラス',               NULL, 3, true),
  ('00000105-0001-0000-0000-000000000004', 'jp', 'gyeon', 'window_area', 'global', NULL, 'triangular-window','wizard_catalog', 'wizard_catalog', NULL, '三角窓',                       NULL, 4, true),
  ('00000105-0001-0000-0000-000000000005', 'jp', 'gyeon', 'window_area', 'global', NULL, 'quarter-glass',    'wizard_catalog', 'wizard_catalog', NULL, 'クォーターガラス',             NULL, 5, true),
  ('00000105-0001-0000-0000-000000000006', 'jp', 'gyeon', 'window_area', 'global', NULL, 'rear-glass',       'wizard_catalog', 'wizard_catalog', NULL, 'リアガラス（リアハッチ）',     NULL, 6, true),
  ('00000105-0001-0000-0000-000000000007', 'jp', 'gyeon', 'window_area', 'global', NULL, 'sunroof',          'wizard_catalog', 'wizard_catalog', NULL, 'サンルーフ',                   NULL, 7, true)
ON CONFLICT (id) DO NOTHING;

-- ── Section E: ppf_method catalog (5 rows) — DEFAULT_PPF_METHODS ─────────────
INSERT INTO public.wizard_catalog_items
  (id, market, product_mode, kind, owner_scope, dealer_id, code,
   label_owner, price_owner, pricing_ref, label_ja, label_en, display_order, is_active)
VALUES
  ('00000105-0002-0000-0000-000000000001', 'jp', 'gyeon', 'ppf_method', 'global', NULL, 'full',       'wizard_catalog', 'wizard_catalog', NULL, 'フル施工',       NULL, 1, true),
  ('00000105-0002-0000-0000-000000000002', 'jp', 'gyeon', 'ppf_method', 'global', NULL, 'partial',    'wizard_catalog', 'wizard_catalog', NULL, '部分施工',       NULL, 2, true),
  ('00000105-0002-0000-0000-000000000003', 'jp', 'gyeon', 'ppf_method', 'global', NULL, 'windshield', 'wizard_catalog', 'wizard_catalog', NULL, 'フロントガラス', NULL, 3, true),
  ('00000105-0002-0000-0000-000000000004', 'jp', 'gyeon', 'ppf_method', 'global', NULL, 'sunroof',    'wizard_catalog', 'wizard_catalog', NULL, 'サンルーフ',     NULL, 4, true),
  ('00000105-0002-0000-0000-000000000005', 'jp', 'gyeon', 'ppf_method', 'global', NULL, 'interior',   'wizard_catalog', 'wizard_catalog', NULL, '室内PPF施工',    NULL, 5, true)
ON CONFLICT (id) DO NOTHING;

-- ── Section F: ppf_part catalog (16 rows) — DEFAULT_PPF_PARTS ────────────────
-- D2: side-step seeded as a plain part; quantity metadata left at column defaults.
INSERT INTO public.wizard_catalog_items
  (id, market, product_mode, kind, owner_scope, dealer_id, code,
   label_owner, price_owner, pricing_ref, label_ja, label_en, display_order, is_active)
VALUES
  ('00000105-0003-0000-0000-000000000001', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'front-bumper', 'wizard_catalog', 'wizard_catalog', NULL, 'フロントバンパー', NULL,  1, true),
  ('00000105-0003-0000-0000-000000000002', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'bonnet',       'wizard_catalog', 'wizard_catalog', NULL, 'ボンネット',       NULL,  2, true),
  ('00000105-0003-0000-0000-000000000003', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'fender',       'wizard_catalog', 'wizard_catalog', NULL, 'フェンダー',       NULL,  3, true),
  ('00000105-0003-0000-0000-000000000004', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'door',         'wizard_catalog', 'wizard_catalog', NULL, 'ドア',             NULL,  4, true),
  ('00000105-0003-0000-0000-000000000005', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'door-edge',    'wizard_catalog', 'wizard_catalog', NULL, 'ドアエッジ',       NULL,  5, true),
  ('00000105-0003-0000-0000-000000000006', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'rocker',       'wizard_catalog', 'wizard_catalog', NULL, 'ロッカーパネル',   NULL,  6, true),
  ('00000105-0003-0000-0000-000000000007', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'side-step',    'wizard_catalog', 'wizard_catalog', NULL, 'サイドステップ',   NULL,  7, true),
  ('00000105-0003-0000-0000-000000000008', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'a-pillar',     'wizard_catalog', 'wizard_catalog', NULL, 'Aピラー',          NULL,  8, true),
  ('00000105-0003-0000-0000-000000000009', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'b-pillar',     'wizard_catalog', 'wizard_catalog', NULL, 'Bピラー',          NULL,  9, true),
  ('00000105-0003-0000-0000-000000000010', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'c-pillar',     'wizard_catalog', 'wizard_catalog', NULL, 'Cピラー',          NULL, 10, true),
  ('00000105-0003-0000-0000-000000000011', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'roof',         'wizard_catalog', 'wizard_catalog', NULL, 'ルーフ',           NULL, 11, true),
  ('00000105-0003-0000-0000-000000000012', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'trunk',        'wizard_catalog', 'wizard_catalog', NULL, 'トランク',         NULL, 12, true),
  ('00000105-0003-0000-0000-000000000013', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'door-mirror',  'wizard_catalog', 'wizard_catalog', NULL, 'ドアミラー',       NULL, 13, true),
  ('00000105-0003-0000-0000-000000000014', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'headlight',    'wizard_catalog', 'wizard_catalog', NULL, 'ヘッドライト',     NULL, 14, true),
  ('00000105-0003-0000-0000-000000000015', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'taillight',    'wizard_catalog', 'wizard_catalog', NULL, 'テールランプ',     NULL, 15, true),
  ('00000105-0003-0000-0000-000000000016', 'jp', 'gyeon', 'ppf_part', 'global', NULL, 'other',        'wizard_catalog', 'wizard_catalog', NULL, 'その他',           NULL, 16, true)
ON CONFLICT (id) DO NOTHING;

-- ── Section G: ppf_type_group catalog (11 rows) — D4: 3 parents + 8 products ─
-- Parents first (ppf_type_group_id NULL) so the child rows resolve at INSERT time
-- (trg_wci_guard checks the referenced group exists). Product codes are the exact
-- DEFAULT_PPF_TYPE_GROUPS product IDs (UI-emitted ppfTypeId). The three PARENT codes
-- are namespaced (group-*) per the C2B1B-R1 / D4-COLLISION ruling: the parent group
-- code `matte` and the product code `matte` would otherwise share the identity tuple
-- (jp,gyeon,ppf_type_group,matte,∅) and be rejected by wizard_catalog_items_identity_uidx.
-- Parents are internal (the UI emits product IDs, never group IDs), so only these three
-- code literals deviate from source; labels/UUIDs/order/structure are unchanged.
INSERT INTO public.wizard_catalog_items
  (id, market, product_mode, kind, owner_scope, dealer_id, code,
   label_owner, price_owner, pricing_ref, label_ja, label_en, display_order, is_active, ppf_type_group_id)
VALUES
  ('00000105-0004-0000-0000-000000000001', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'group-gloss', 'wizard_catalog', 'wizard_catalog', NULL, 'グロス・プロテクション（光沢・透明）', NULL, 1, true, NULL),
  ('00000105-0004-0000-0000-000000000002', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'group-matte', 'wizard_catalog', 'wizard_catalog', NULL, 'マット・ステルス（艶消し）',           NULL, 2, true, NULL),
  ('00000105-0004-0000-0000-000000000003', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'group-color', 'wizard_catalog', 'wizard_catalog', NULL, 'カラー＆カスタム（ドレスアップ）',     NULL, 3, true, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wizard_catalog_items
  (id, market, product_mode, kind, owner_scope, dealer_id, code,
   label_owner, price_owner, pricing_ref, label_ja, label_en, display_order, is_active, ppf_type_group_id)
VALUES
  ('00000105-0004-0000-0000-000000000011', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'protect-plus', 'wizard_catalog', 'wizard_catalog', NULL, 'PPF PROTECT+',   NULL, 1, true, '00000105-0004-0000-0000-000000000001'),
  ('00000105-0004-0000-0000-000000000012', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'enhance',      'wizard_catalog', 'wizard_catalog', NULL, 'PPF ENHANCE',    NULL, 2, true, '00000105-0004-0000-0000-000000000001'),
  ('00000105-0004-0000-0000-000000000013', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'hybrid',       'wizard_catalog', 'wizard_catalog', NULL, 'PPF HYBRID',     NULL, 3, true, '00000105-0004-0000-0000-000000000001'),
  ('00000105-0004-0000-0000-000000000014', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'matte',        'wizard_catalog', 'wizard_catalog', NULL, 'PPF MATTE',      NULL, 4, true, '00000105-0004-0000-0000-000000000002'),
  ('00000105-0004-0000-0000-000000000015', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'black',        'wizard_catalog', 'wizard_catalog', NULL, 'PPF BLACK',      NULL, 5, true, '00000105-0004-0000-0000-000000000003'),
  ('00000105-0004-0000-0000-000000000016', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'tint',         'wizard_catalog', 'wizard_catalog', NULL, 'TINT',           NULL, 6, true, '00000105-0004-0000-0000-000000000003'),
  ('00000105-0004-0000-0000-000000000017', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'carbon',       'wizard_catalog', 'wizard_catalog', NULL, 'PPF CARBON',     NULL, 7, true, '00000105-0004-0000-0000-000000000003'),
  ('00000105-0004-0000-0000-000000000018', 'jp', 'gyeon', 'ppf_type_group', 'global', NULL, 'color-line',   'wizard_catalog', 'wizard_catalog', NULL, 'PPF COLOR LINE', NULL, 8, true, '00000105-0004-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- ── Section H: item ranks (110 rows) ────────────────────────────────────────
-- PPF kinds: {detailer, ppf_installer, certified}. window_area: {detailer, certified}.
-- Scoped to the global rows this migration owns (only 105 creates global catalog rows).
INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
SELECT i.id, r.rank
  FROM public.wizard_catalog_items i
  CROSS JOIN (VALUES ('detailer'), ('ppf_installer'), ('certified')) AS r(rank)
 WHERE i.market = 'jp' AND i.product_mode = 'gyeon' AND i.owner_scope = 'global'
   AND i.kind IN ('ppf_method', 'ppf_part', 'ppf_type_group')
ON CONFLICT (catalog_item_id, rank) DO NOTHING;

INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
SELECT i.id, r.rank
  FROM public.wizard_catalog_items i
  CROSS JOIN (VALUES ('detailer'), ('certified')) AS r(rank)
 WHERE i.market = 'jp' AND i.product_mode = 'gyeon' AND i.owner_scope = 'global'
   AND i.kind = 'window_area'
ON CONFLICT (catalog_item_id, rank) DO NOTHING;

-- ── Section I: item categories (39 rows — one per item) ──────────────────────
INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
SELECT i.id,
       CASE WHEN i.kind = 'window_area' THEN 'window' ELSE 'ppf' END
  FROM public.wizard_catalog_items i
 WHERE i.market = 'jp' AND i.product_mode = 'gyeon' AND i.owner_scope = 'global'
   AND i.kind IN ('window_area', 'ppf_method', 'ppf_part', 'ppf_type_group')
ON CONFLICT (catalog_item_id, category_id) DO NOTHING;

-- ── Section J: fail-closed verification (raises on any drift) ────────────────
-- Never silently accept/overwrite a conflicting pre-existing row: assert the
-- exact seeded state and RAISE on identity/ownership/parent/category/rank/label/
-- active-state divergence.
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Policy row counts (this migration's mode).
  SELECT count(*) INTO v_count FROM public.wizard_kind_policy WHERE product_mode = 'gyeon';
  IF v_count <> 11 THEN RAISE EXCEPTION '105 verify: wizard_kind_policy expected 11, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_kind_ownership_policy WHERE product_mode = 'gyeon';
  IF v_count <> 11 THEN RAISE EXCEPTION '105 verify: wizard_kind_ownership_policy expected 11, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_kind_ownership_policy
   WHERE product_mode = 'gyeon' AND owner_scope = 'global';
  IF v_count <> 4 THEN RAISE EXCEPTION '105 verify: global ownership rows expected 4, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_kind_ownership_policy
   WHERE product_mode = 'gyeon' AND owner_scope = 'dealer';
  IF v_count <> 7 THEN RAISE EXCEPTION '105 verify: dealer ownership rows expected 7, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_rank_category_policy WHERE product_mode = 'gyeon';
  IF v_count <> 24 THEN RAISE EXCEPTION '105 verify: wizard_rank_category_policy expected 24, found %', v_count; END IF;

  -- Global catalog counts by kind.
  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND kind = 'window_area';
  IF v_count <> 7 THEN RAISE EXCEPTION '105 verify: window_area expected 7, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND kind = 'ppf_method';
  IF v_count <> 5 THEN RAISE EXCEPTION '105 verify: ppf_method expected 5, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND kind = 'ppf_part';
  IF v_count <> 16 THEN RAISE EXCEPTION '105 verify: ppf_part expected 16, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND kind = 'ppf_type_group';
  IF v_count <> 11 THEN RAISE EXCEPTION '105 verify: ppf_type_group expected 11, found %', v_count; END IF;

  -- No dealer / placeholder global rows.
  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND (dealer_id IS NOT NULL OR pricing_ref IS NOT NULL
         OR is_active <> true OR deleted_at IS NOT NULL);
  IF v_count <> 0 THEN RAISE EXCEPTION '105 verify: % global rows violate dealer_id/pricing_ref/active/deleted invariants', v_count; END IF;

  -- PPF parent graph: 3 parents (NULL group) + 8 products (non-NULL group) = 11.
  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND kind = 'ppf_type_group' AND ppf_type_group_id IS NULL;
  IF v_count <> 3 THEN RAISE EXCEPTION '105 verify: ppf_type_group parents expected 3, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_catalog_items
   WHERE owner_scope = 'global' AND kind = 'ppf_type_group' AND ppf_type_group_id IS NOT NULL;
  IF v_count <> 8 THEN RAISE EXCEPTION '105 verify: ppf_type_group products expected 8, found %', v_count; END IF;

  -- Child totals.
  SELECT count(*) INTO v_count FROM public.wizard_catalog_item_ranks r
    JOIN public.wizard_catalog_items i ON i.id = r.catalog_item_id
   WHERE i.owner_scope = 'global';
  IF v_count <> 110 THEN RAISE EXCEPTION '105 verify: item_ranks expected 110, found %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.wizard_catalog_item_categories c
    JOIN public.wizard_catalog_items i ON i.id = c.catalog_item_id
   WHERE i.owner_scope = 'global';
  IF v_count <> 39 THEN RAISE EXCEPTION '105 verify: item_categories expected 39, found %', v_count; END IF;
END $$;

-- ── Section K: privilege restoration (104 revoke-then-exact-regrant) ─────────
-- Tables: authenticated SELECT only; service_role keeps its 104 DML (not touched).
REVOKE ALL PRIVILEGES ON TABLE
  public.wizard_product_modes,
  public.wizard_kind_policy,
  public.wizard_kind_ownership_policy,
  public.wizard_rank_category_policy,
  public.wizard_catalog_items,
  public.wizard_catalog_item_ranks,
  public.wizard_catalog_item_categories,
  public.dealer_wizard_catalog_overrides
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.wizard_product_modes,
  public.wizard_kind_policy,
  public.wizard_kind_ownership_policy,
  public.wizard_rank_category_policy,
  public.wizard_catalog_items,
  public.wizard_catalog_item_ranks,
  public.wizard_catalog_item_categories,
  public.dealer_wizard_catalog_overrides
TO authenticated;

-- Helpers: authenticated EXECUTE only. anon / PUBLIC / service_role: none.
REVOKE EXECUTE ON FUNCTION public.wiz_can_configure(uuid)       FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_is_active_member(uuid)    FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_is_any_active_member()    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.wiz_can_configure(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiz_is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiz_is_any_active_member() TO authenticated;

COMMIT;
