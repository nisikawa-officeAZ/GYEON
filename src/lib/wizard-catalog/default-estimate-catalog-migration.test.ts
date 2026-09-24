import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20260923032901_seed_estimate_default_catalog.sql", import.meta.url),
  "utf8",
);

const expectedDefaults = [
  ["鉄粉除去", 8000],
  ["ハードポリッシュ", 30000],
  ["傷補修", 12000],
  ["ヘッドライトリペア", 15000],
  ["タッチペン", 3000],
  ["ライトメンテナンス", 5000],
  ["6か月メンテナンス", 8000],
  ["12か月メンテナンス", 15000],
  ["コーティング定期メンテナンス", 25000],
  ["プレミアムメンテナンス", 40000],
] as const;

test("seeds the ten configurable DA defaults with their canonical prices", () => {
  for (const [label, price] of expectedDefaults) {
    assert.match(sql, new RegExp(`'${label}', ${price}`));
  }
  assert.equal((sql.match(/\('(?:store_global_option|maintenance_menu)'/g) ?? []).length, 10);
});

test("preserves dealer-owned and archived equivalents", () => {
  assert.match(sql, /i\.code = v_default\.code[\s\S]*btrim\(i\.label_ja\) = btrim\(v_default\.label_ja\)/);
  assert.doesNotMatch(sql, /UPDATE public\.wizard_catalog_items/i);
  assert.doesNotMatch(sql, /ON CONFLICT[\s\S]{0,100}DO UPDATE/i);
});

test("makes maintenance available without overriding an explicit offering", () => {
  assert.match(sql, /INSERT INTO public\.dealer_service_offerings/);
  assert.match(sql, /'maintenance', true/);
  assert.match(sql, /ON CONFLICT \(dealer_id, family\) DO NOTHING/);
});

test("backfills active GYEON dealers and seeds future dealers", () => {
  assert.match(sql, /WHERE product_mode = 'gyeon'[\s\S]*deleted_at IS NULL/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.wiz_init_dealer_lifecycle\(\)/);
  assert.match(
    sql,
    /SELECT runtime_enabled\s+INTO v_runtime_enabled\s+FROM public\.wizard_product_modes\s+WHERE mode = NEW\.product_mode/,
  );
  assert.match(
    sql,
    /IF v_runtime_enabled IS NOT TRUE THEN[\s\S]*RAISE WARNING[\s\S]*RETURN NULL/,
  );
  assert.match(sql, /PERFORM public\.wiz_seed_default_estimate_catalog\(NEW\.id\)/);
  assert.doesNotMatch(sql, /EXCEPTION WHEN OTHERS/);
});

test("keeps the internal SECURITY DEFINER helper non-callable", () => {
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = public, pg_catalog/);
  assert.match(
    sql,
    /REVOKE EXECUTE ON FUNCTION public\.wiz_seed_default_estimate_catalog\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
  );
});
