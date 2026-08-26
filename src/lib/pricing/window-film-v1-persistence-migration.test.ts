import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260826143000_window_film_v1_atomic_persistence.sql",
  "utf8",
);
const saveAction = readFileSync(
  "src/lib/pricing/save-authoritative-window-film-v1-settings.ts",
  "utf8",
);

test("migration is one authenticated, dealer-scoped, revision-guarded atomic writer", () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /window_film_v1_revision_conflict/);
  assert.match(migration, /p_expected_revision is null/);
  assert.match(migration, /window_film_v1_duplicate_film/);
  assert.match(migration, /jsonb_set\(coalesce\(v_service, '\{\}'::jsonb\), '\{window_film_v1\}'/);
  assert.match(migration, /wiz_bump_dealer_revision/);
  assert.match(migration, /revoke all on function public\.save_window_film_v1_settings/);
  assert.match(migration, /grant execute on function public\.save_window_film_v1_settings[\s\S]*to authenticated/);
});

test("migration validates the exact fixed seven-area authority", () => {
  for (const code of [
    "front-windshield", "front-door-glass", "rear-door-glass",
    "triangular-window", "quarter-glass", "rear-glass", "sunroof",
  ]) assert.match(migration, new RegExp(code));
  assert.match(migration, /<> array\['front-door-glass','front-windshield','quarter-glass','rear-door-glass','rear-glass','sunroof','triangular-window'\]/);
});

test("database issues final custom-item codes and the action calls only the atomic RPC", () => {
  assert.match(migration, /draft-package-/);
  assert.match(migration, /draft-option-/);
  assert.match(migration, /film-package-' else 'film-option-/);
  assert.match(migration, /gen_random_uuid/);
  assert.match(migration, /window_film_v1_unissued_custom_code/);
  assert.doesNotMatch(saveAction, /randomUUID/);
  assert.match(saveAction, /supabase\.rpc\("save_window_film_v1_settings"/);
  assert.doesNotMatch(saveAction, /service_role|SUPABASE_SERVICE_ROLE/);
});

test("migration rejects normalized active names and archives omitted dealer film rows", () => {
  assert.match(migration, /lower\(btrim\(v_item->>'name'\)\) = any\(v_seen_active_names\)/);
  assert.match(migration, /lower\(btrim\(v_film->>'name'\)\) = any\(v_seen_active_names\)/);
  assert.match(migration, /update public\.wizard_catalog_items i[\s\S]*deleted_at = now\(\)[\s\S]*not \(i\.id = any\(v_seen_item_ids\)\)/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.wizard_catalog_items/i);
});

test("persistence sources contain no client sample prices", () => {
  assert.doesNotMatch(migration, /30000|20000|25000|8000/);
  assert.doesNotMatch(saveAction, /30000|20000|25000|8000/);
});
