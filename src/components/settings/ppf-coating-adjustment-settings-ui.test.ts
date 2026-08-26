import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const CLIENT = readFileSync(new URL("./PpfCoatingAdjustmentClient.tsx", import.meta.url), "utf8");
const PPF_SETTINGS = readFileSync(new URL("./PpfSettingsClient.tsx", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../../app/settings/ppf/coating-discount/page.tsx", import.meta.url), "utf8");
const LOADER = readFileSync(new URL("../../lib/pricing/get-ppf-coating-adjustment-settings.ts", import.meta.url), "utf8");
const ADAPTER = readFileSync(new URL("../estimates/wizard/pricing/wizard-pricing-input-adapter-config.ts", import.meta.url), "utf8");
const ACTIONS = readFileSync(new URL("../../lib/wizard-catalog/wizard-catalog-authoring-actions.ts", import.meta.url), "utf8");

test("PPF settings links to a dedicated coating-reduction page without changing its existing layout", () => {
  assert.match(PPF_SETTINGS, /href="\/settings\/ppf\/coating-discount"/);
  assert.match(PAGE, /getPpfCoatingAdjustmentSettings\(\)/);
  assert.match(PAGE, /<PpfCoatingAdjustmentClient result=\{result\}/);
});

test("automatic reduction supports front-full and full-body only", () => {
  assert.match(LOADER, /PPF_COATING_ADJUSTMENT_SCOPES = \["front_full", "full_body"\] as const/);
  assert.doesNotMatch(LOADER, /PPF_COATING_ADJUSTMENT_SCOPES[^\n]*partial/);
  assert.match(CLIENT, /\["front_full", "full_body"\] as const/);
  assert.match(CLIENT, /部分施工には自動適用されません/);
  assert.match(ADAPTER, /scope !== "front_full" && scope !== "full_body"/);
});

test("reduction comes from the layer-1 coating base while PPF pricing remains untouched", () => {
  assert.match(ADAPTER, /service\.type === "coating"/);
  assert.match(ADAPTER, /catalog_line_role === "base"/);
  assert.match(ADAPTER, /resolvePpfCoatingAdjustment\([\s\S]*coatingBaseYen/);
  assert.match(ADAPTER, /ppfCoatingAdjustmentBase: "coating_layer1"/);
  assert.match(ADAPTER, /extraAmount: extraAmount \+ ppfCoatingReductionYen/);
  assert.doesNotMatch(ADAPTER, /price:\s*[^,\n]*-\s*adjustment\.reductionYen/);
});

test("the dedicated UI explains the business rule and saves through the existing secured action", () => {
  assert.match(CLIENT, /1層目コーティング料金から差し引く金額/);
  assert.match(CLIENT, /クーポンではありません。PPF料金は変更されず/);
  assert.match(CLIENT, /saveDealerPpfCoatingAdjustment\(/);
  assert.match(ACTIONS, /wiz_upsert_ppf_coating_adjustment/);
  assert.match(ACTIONS, /revalidatePath\(PPF_COATING_ADJUSTMENT_SETTINGS_PATH\)/);
});
