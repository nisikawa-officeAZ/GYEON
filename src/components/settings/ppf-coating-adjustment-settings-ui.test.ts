import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const CLIENT = readFileSync(new URL("./PpfCoatingAdjustmentClient.tsx", import.meta.url), "utf8");
const PPF_SETTINGS = readFileSync(new URL("./PpfSettingsClient.tsx", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../../app/settings/ppf/coating-discount/page.tsx", import.meta.url), "utf8");
const LOADER = readFileSync(new URL("../../lib/pricing/get-ppf-coating-adjustment-settings.ts", import.meta.url), "utf8");
const ADAPTER = readFileSync(new URL("../estimates/wizard/pricing/wizard-pricing-input-adapter-config.ts", import.meta.url), "utf8");
const ACTIONS = readFileSync(new URL("../../lib/wizard-catalog/wizard-catalog-authoring-actions.ts", import.meta.url), "utf8");

test("PPF settings links to the approved dedicated combination-discount page", () => {
  assert.match(PPF_SETTINGS, /href="\/settings\/ppf\/coating-discount"/);
  assert.match(PAGE, /getPpfCoatingAdjustmentSettings\(\)/);
  assert.match(PAGE, /<PpfCoatingAdjustmentClient result=\{result\}/);
});

test("one global rule replaces scope and coating-product matrices", () => {
  assert.match(LOADER, /GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE/);
  assert.match(LOADER, /GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE/);
  assert.doesNotMatch(CLIENT, /front_full|full_body|scopeTabs/);
  assert.match(CLIENT, /coatingCode: GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE/);
  assert.match(CLIENT, /全組み合わせ一律/);
  assert.match(CLIENT, /円（固定額）/);
  assert.match(CLIENT, /％（割合）/);
});

test("approved applicability and coating-total base are explicit and implemented", () => {
  assert.match(CLIENT, /全体・範囲プリセット・部分PPF単体/);
  assert.match(CLIENT, /室内PPF・フロントウインドPPF・PPF専用コーティング・その他作業/);
  assert.match(ADAPTER, /catalog_line_role === "base" \|\| line\.catalog_line_role === "topcoat2" \|\| line\.catalog_line_role === "topcoat3"/);
  assert.match(ADAPTER, /scope === "front_full" \|\| scope === "full_body" \|\| scope === "partial"/);
  assert.match(ADAPTER, /ppfCoatingAdjustmentBase: "coating_layers_total"/);
  assert.match(ADAPTER, /extraAmount: extraAmount \+ ppfCoatingReductionYen/);
});

test("the GenSpark sections save through the existing secured action", () => {
  for (const label of ["減額ルール設定", "適用条件", "計算例", "保存する"]) assert.match(CLIENT, new RegExp(label));
  assert.match(CLIENT, /saveDealerPpfCoatingAdjustment\(/);
  assert.match(ACTIONS, /wiz_upsert_ppf_coating_adjustment/);
  assert.match(ACTIONS, /revalidatePath\(PPF_COATING_ADJUSTMENT_SETTINGS_PATH\)/);
});
