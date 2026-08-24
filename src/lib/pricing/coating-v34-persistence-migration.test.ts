import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824151255_coating_v34_atomic_persistence.sql",
  ),
  "utf8",
);

test("function is an authenticated SECURITY INVOKER boundary", () => {
  assert.match(SQL, /create or replace function public\.save_coating_v34_settings\(\s*p_dealer_id uuid,\s*p_coating jsonb\s*\)/i);
  assert.match(SQL, /security invoker\s+set search_path = ''/i);
  assert.doesNotMatch(SQL, /security definer/i);
  assert.match(SQL, /revoke all on function public\.save_coating_v34_settings\(uuid, jsonb\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(SQL, /grant execute on function public\.save_coating_v34_settings\(uuid, jsonb\)[\s\S]*to authenticated/i);
});

test("authorization is fail closed with dealer_staff precedence", () => {
  assert.match(SQL, /auth\.uid\(\)/i);
  assert.match(SQL, /v_active_membership_count <> 1/);
  assert.match(SQL, /v_member_dealer_id is distinct from p_dealer_id/);
  assert.match(SQL, /from public\.dealer_staff ds[\s\S]*ds\.dealer_id = p_dealer_id[\s\S]*ds\.user_id = v_actor/i);
  assert.match(SQL, /v_staff_count = 1[\s\S]*v_staff_status <> 'active'[\s\S]*v_staff_role not in \('owner', 'manager'\)/i);
  assert.match(SQL, /elsif v_member_role not in \('owner', 'manager'\)/i);
});

test("payload is exact V3.4 with three independent seven-size catalogs", () => {
  assert.match(SQL, /'baseProducts'[\s\S]*'contractVersion'[\s\S]*'layer2Products'[\s\S]*'layer3Products'[\s\S]*'option_names'[\s\S]*'option_prices'/);
  assert.match(SQL, /p_coating->>'contractVersion' <> '3\.4'/);
  assert.match(SQL, /array\['baseProducts', 'layer2Products', 'layer3Products'\]/);
  assert.match(SQL, /when 'baseProducts' then 'pricesBySize'/);
  assert.match(SQL, /when 'layer2Products' then 'layer2PricesBySize'/);
  assert.match(SQL, /else 'layer3PricesBySize'/);
  assert.match(SQL, /array\['SS', 'S', 'M', 'ML', 'L', 'LL', 'XL'\]/);
  assert.doesNotMatch(SQL, /XXL|size8|8サイズ/i);
});

test("money, unknown keys and duplicate product IDs fail closed", () => {
  assert.match(SQL, /jsonb_object_keys\(p_coating\)/);
  assert.match(SQL, /jsonb_object_keys\(v_entry\)/);
  assert.match(SQL, /jsonb_object_keys\(v_price_map\)/);
  assert.match(SQL, /jsonb_typeof\(v_price\) = 'null'/);
  assert.match(SQL, /jsonb_typeof\(v_price\) <> 'number'/);
  assert.match(SQL, /trunc\(\(v_price #>> '\{\}'\)::numeric\)/);
  assert.match(SQL, /group by item->>'productId'[\s\S]*having count\(\*\) > 1/i);
});

test("update is locked, update-only and preserves sibling settings", () => {
  const validationAt = SQL.indexOf("Exact top-level V3.4 shape");
  const lockAt = SQL.indexOf("for update;");
  const updateAt = SQL.indexOf("update public.dealer_settings");
  assert.ok(validationAt >= 0 && validationAt < lockAt && lockAt < updateAt);
  assert.match(SQL, /if not found then[\s\S]*coating_v34_not_configured/i);
  assert.match(SQL, /jsonb_set\([\s\S]*coalesce\(v_service_price_settings, '\{\}'::jsonb\)[\s\S]*'\{coating\}'[\s\S]*p_coating[\s\S]*true/i);
  assert.doesNotMatch(SQL, /insert into public\.dealer_settings|upsert/i);
});
