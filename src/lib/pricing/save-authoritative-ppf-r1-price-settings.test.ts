import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SOURCE = readFileSync(
  join(process.cwd(), "src/lib/pricing/save-authoritative-ppf-r1-price-settings.ts"),
  "utf8",
);
const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826010000_ppf_r1_atomic_price_persistence.sql"),
  "utf8",
);

test("save boundary accepts only an untrusted PPF payload and no dealer ID", () => {
  assert.match(SOURCE, /saveAuthoritativePpfR1PriceSettings\(\s*ppf:\s*unknown,\s*coefficients:\s*unknown/);
  assert.doesNotMatch(SOURCE, /saveAuthoritativePpfR1PriceSettings\(\s*dealer/i);
  assert.doesNotMatch(SOURCE, /p_dealer_id:\s*ppf/);
});

test("payload is parsed before authorization or database I/O", () => {
  const parseAt = SOURCE.indexOf("parsed = parsePpfR1PriceSettings(ppf)");
  const coefficientsAt = SOURCE.indexOf("parsedCoefficients = parsePpfR1InstallationCoefficientSettings(coefficients)");
  const roleAt = SOURCE.indexOf('requireRole(["owner", "manager"])');
  const clientAt = SOURCE.indexOf("await createClient()");
  assert.ok(parseAt >= 0 && parseAt < coefficientsAt && coefficientsAt < roleAt && roleAt < clientAt);
  assert.match(SOURCE, /status:\s*"INVALID_PAYLOAD"/);
});

test("dealer scope is server-derived and owner-manager restricted", () => {
  assert.match(SOURCE, /requireRole\(\["owner",\s*"manager"\]\)/);
  assert.match(SOURCE, /\{\s*dealerId\s*\}\s*=\s*await requireRole/);
  assert.match(SOURCE, /status:\s*"UNAUTHORIZED"/);
});

test("uses the normal authenticated RPC with exact arguments", () => {
  assert.match(SOURCE, /createClient\(\)/);
  assert.match(SOURCE, /\.rpc\("save_ppf_r1_price_settings",\s*\{/);
  assert.match(SOURCE, /p_dealer_id:\s*dealerId/);
  assert.match(SOURCE, /p_ppf:\s*parsed/);
  assert.match(SOURCE, /p_coefficients:\s*parsedCoefficients/);
  assert.doesNotMatch(SOURCE, /service[_-]?role/i);
  assert.doesNotMatch(SOURCE, /adminClient|createAdmin/);
});

test("does not bypass the RPC or accept an unvalidated response", () => {
  assert.doesNotMatch(SOURCE, /\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(SOURCE, /settings:\s*parsePpfR1PriceSettings\(saved\.ppf\)/);
  assert.match(SOURCE, /coefficients:\s*parsePpfR1InstallationCoefficientSettings\(saved\.coefficients\)/);
  assert.match(SOURCE, /status:\s*"SAVE_FAILED"/);
});

test("migration is a narrowly callable SECURITY DEFINER RPC without direct table grants", () => {
  assert.match(MIGRATION, /create or replace function public\.save_ppf_r1_price_settings\(/i);
  assert.match(MIGRATION, /security definer/i);
  assert.match(MIGRATION, /set search_path = ''/i);
  assert.match(MIGRATION, /revoke all on function public\.save_ppf_r1_price_settings\(uuid, jsonb, jsonb\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(MIGRATION, /grant execute on function public\.save_ppf_r1_price_settings\(uuid, jsonb, jsonb\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(MIGRATION, /grant\s+(?:select|insert|update|delete)[\s\S]*dealer_wizard_catalog_overrides/i);
  assert.match(MIGRATION, /dealer_staff[\s\S]*v_staff_status <> 'active'[\s\S]*v_staff_role not in \('owner', 'manager'\)/i);
});

test("migration validates the exact versioned shape and seven-size maps", () => {
  for (const key of [
    "contractVersion",
    "frontFullPricesBySize",
    "fullBodyPricesBySize",
    "partialPartPrices",
  ]) assert.match(MIGRATION, new RegExp(key));
  assert.match(MIGRATION, /array\['L', 'LL', 'M', 'ML', 'S', 'SS', 'XL'\]/);
  assert.doesNotMatch(MIGRATION, /XXL/);
  for (const legacyKey of ["plan_prices", "film_coeff", "rank_coeff", "glass_prices", "parts_prices"]) {
    assert.doesNotMatch(MIGRATION, new RegExp(`p_ppf\\s*->\\s*'${legacyKey}'`));
  }
  assert.match(MIGRATION, /jsonb_typeof\(v_size_price\) = 'null'/);
  assert.match(MIGRATION, /jsonb_typeof\(v_size_price\) <> 'number'/);
  assert.match(MIGRATION, /trunc\(\(v_size_price #>> '\{\}'\)::numeric\)/);
});

test("migration locks the dealer settings row and updates only the PPF price column", () => {
  assert.match(MIGRATION, /from public\.dealer_settings ds[\s\S]*where ds\.dealer_id = p_dealer_id[\s\S]*for update/i);
  assert.match(MIGRATION, /update public\.dealer_settings[\s\S]*set ppf_price_tables = p_ppf,[\s\S]*updated_at = now\(\)/i);
  assert.doesNotMatch(MIGRATION, /create\s+table|alter\s+table|drop\s+table/i);
  assert.doesNotMatch(MIGRATION, /service_price_settings\s*=/i);
});

test("migration atomically stores exactly eight positive product coefficients by immutable identity", () => {
  assert.match(MIGRATION, /installationCoefficientsBpByProductCode/);
  assert.match(MIGRATION, /array\['black', 'carbon', 'color-line', 'enhance', 'hybrid', 'matte', 'protect-plus', 'tint'\]/);
  assert.match(MIGRATION, /v_coefficient_value #>> '\{\}'\)::numeric <= 0/);
  assert.match(MIGRATION, /kind = 'ppf_type_group'[\s\S]*owner_scope = 'global'[\s\S]*ppf_type_group_id is not null/i);
  assert.match(MIGRATION, /insert into public\.dealer_wizard_catalog_overrides[\s\S]*on conflict \(dealer_id, catalog_item_id\) do update[\s\S]*set install_coefficient_bp = excluded\.install_coefficient_bp/i);
  assert.match(MIGRATION, /return jsonb_build_object\('ppf', p_ppf, 'coefficients', p_coefficients\)/);
});
