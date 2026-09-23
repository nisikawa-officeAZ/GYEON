BEGIN;

DO $$
DECLARE
  v_dealer constant uuid := '91000000-0000-0000-0000-000000000001';
  v_result jsonb;
BEGIN
  INSERT INTO public.dealers
    (id, name, status, approval_status, product_mode, detailer_rank)
  VALUES
    (v_dealer, 'Default Catalog Runtime Test', 'active', 'approved', 'gyeon', 'detailer');

  IF (SELECT count(*) FROM public.wizard_catalog_items WHERE dealer_id = v_dealer) <> 10 THEN
    RAISE EXCEPTION 'expected exactly ten seeded catalog items';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (VALUES
        ('鉄粉除去', 8000, NULL::integer),
        ('ハードポリッシュ', 30000, NULL::integer),
        ('傷補修', 12000, NULL::integer),
        ('ヘッドライトリペア', 15000, NULL::integer),
        ('タッチペン', 3000, NULL::integer),
        ('ライトメンテナンス', 5000, 30),
        ('6か月メンテナンス', 8000, 60),
        ('12か月メンテナンス', 15000, 120),
        ('コーティング定期メンテナンス', 25000, 150),
        ('プレミアムメンテナンス', 40000, 240)
      ) AS expected(label_ja, unit_price, duration_minutes)
      LEFT JOIN public.wizard_catalog_items actual
        ON actual.dealer_id = v_dealer
       AND actual.label_ja = expected.label_ja
       AND actual.default_unit_price = expected.unit_price
       AND actual.duration_minutes IS NOT DISTINCT FROM expected.duration_minutes
     WHERE actual.id IS NULL
  ) THEN
    RAISE EXCEPTION 'a seeded label, price, or duration differs from the contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dealer_service_offerings
     WHERE dealer_id = v_dealer AND family = 'maintenance' AND enabled
  ) THEN
    RAISE EXCEPTION 'maintenance offering was not enabled for a fresh dealer';
  END IF;

  SELECT public.wiz_seed_default_estimate_catalog(v_dealer) INTO v_result;
  IF v_result ->> 'inserted_items' <> '0'
     OR (SELECT count(*) FROM public.wizard_catalog_items WHERE dealer_id = v_dealer) <> 10 THEN
    RAISE EXCEPTION 'seed is not idempotent: %', v_result;
  END IF;

  UPDATE public.wizard_catalog_items
     SET default_unit_price = 33333
   WHERE dealer_id = v_dealer AND label_ja = 'ハードポリッシュ';

  UPDATE public.wizard_catalog_items
     SET is_active = false, deleted_at = clock_timestamp()
   WHERE dealer_id = v_dealer AND label_ja = '鉄粉除去';

  PERFORM public.wiz_seed_default_estimate_catalog(v_dealer);

  IF (SELECT default_unit_price FROM public.wizard_catalog_items
       WHERE dealer_id = v_dealer AND label_ja = 'ハードポリッシュ') <> 33333 THEN
    RAISE EXCEPTION 'dealer-owned price was overwritten';
  END IF;

  IF (SELECT count(*) FROM public.wizard_catalog_items
       WHERE dealer_id = v_dealer AND label_ja = '鉄粉除去') <> 1
     OR EXISTS (
       SELECT 1 FROM public.wizard_catalog_items
        WHERE dealer_id = v_dealer AND label_ja = '鉄粉除去' AND deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'archived dealer-owned item was duplicated or resurrected';
  END IF;
END
$$;

DO $$
DECLARE
  v_dealer constant uuid := '91000000-0000-0000-0000-000000000002';
BEGIN
  ALTER TABLE public.dealers DISABLE TRIGGER trg_dealers_wiz_lifecycle_init;
  INSERT INTO public.dealers
    (id, name, status, approval_status, product_mode, detailer_rank)
  VALUES
    (v_dealer, 'Explicit Offering Runtime Test', 'active', 'approved', 'gyeon', 'detailer');
  ALTER TABLE public.dealers ENABLE TRIGGER trg_dealers_wiz_lifecycle_init;

  INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled)
  VALUES (v_dealer, 'maintenance', false);

  PERFORM public.wiz_seed_default_estimate_catalog(v_dealer);
  IF (SELECT enabled FROM public.dealer_service_offerings
       WHERE dealer_id = v_dealer AND family = 'maintenance') THEN
    RAISE EXCEPTION 'explicit maintenance OFF choice was overwritten';
  END IF;
END
$$;

DO $$
DECLARE
  v_dealer constant uuid := '91000000-0000-0000-0000-000000000003';
BEGIN
  INSERT INTO public.dealers
    (id, name, status, approval_status, product_mode, detailer_rank)
  VALUES
    (v_dealer, 'Generic Runtime Test', 'active', 'approved', 'generic', 'detailer');

  IF EXISTS (SELECT 1 FROM public.wizard_catalog_items WHERE dealer_id = v_dealer) THEN
    RAISE EXCEPTION 'generic dealer received GYEON defaults';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
       SELECT 1
         FROM pg_proc p
         CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
        WHERE p.oid = 'public.wiz_seed_default_estimate_catalog(uuid)'::regprocedure
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
     )
     OR has_function_privilege('anon', 'public.wiz_seed_default_estimate_catalog(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.wiz_seed_default_estimate_catalog(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.wiz_seed_default_estimate_catalog(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal seed helper is externally executable';
  END IF;
END
$$;

SELECT 'DEFAULT_ESTIMATE_CATALOG_RUNTIME_OK' AS result;

ROLLBACK;
