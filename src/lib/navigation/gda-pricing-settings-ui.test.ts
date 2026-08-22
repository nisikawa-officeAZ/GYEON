import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const CLIENT_PATH = "src/app/settings/estimate-wizard/EstimateWizardSettingsClient.tsx";
const PAGE_PATH = "src/app/settings/estimate-wizard/page.tsx";

test("estimate-wizard page remains unchanged (S8B: read-only, no edit needed)", () => {
  const page = read(PAGE_PATH);
  assert.match(page, /getEstimateWizardSettingsView/);
  assert.match(page, /<EstimateWizardSettingsClient view=\{result\.view\} \/>/);
});

test("estimate wizard exposes exactly the four real access cards in the approved order", () => {
  const client = read(CLIENT_PATH);

  const order = [...client.matchAll(/id:\s+"(service-availability|service-menus|work-presets|shop-options)"/g)]
    .map((m) => m[1]);
  assert.deepEqual(order, ["service-availability", "service-menus", "work-presets", "shop-options"]);

  assert.match(client, /label:\s+"施工メニュー提供設定",\s*\n\s*labelEn:\s+"SERVICE AVAILABILITY"/);
  assert.match(client, /label:\s+"サービスメニュー",\s*\n\s*labelEn:\s+"SERVICE MENUS"/);
  assert.match(client, /label:\s+"その他作業プリセット",\s*\n\s*labelEn:\s+"WORK PRESETS"/);
  assert.match(client, /label:\s+"店舗オプション",\s*\n\s*labelEn:\s+"SHOP OPTIONS"/);
});

test("estimate wizard access cards use the approved badge states and derive anchors from view.sections, never a hardcoded route", () => {
  const client = read(CLIENT_PATH);

  assert.equal((client.match(/badge:\s+"solid_active"/g) ?? []).length, 1, "only SERVICE AVAILABILITY is solid_active");
  assert.equal((client.match(/badge:\s+"solid_unset"/g) ?? []).length, 3, "the other three real cards are solid_unset");
  assert.match(client, /anchorId:\s+"section-service-offerings"/);

  assert.match(client, /const serviceSection = view\.sections\.find\(section => section\.id === "service"\);/);
  assert.match(client, /const otherworkSection = view\.sections\.find\(section => section\.id === "otherwork"\);/);
  assert.match(client, /const storeSection = view\.sections\.find\(section => section\.id === "store"\);/);
  assert.match(client, /anchorId:\s+serviceSection\?\.anchorId \?\? null/);
  assert.match(client, /anchorId:\s+otherworkSection\?\.anchorId \?\? null/);
  assert.match(client, /anchorId:\s+storeSection\?\.anchorId \?\? null/);

  // Fail-closed contract: a missing derived anchor renders informational only, no fabricated href.
  assert.match(client, /const isReachable = card\.anchorId !== null;/);
  assert.match(client, /if \(!isReachable\) \{/);
  assert.doesNotMatch(client, /anchorId:\s+"\/settings/);
});

test("forbidden obsolete wizard cards are absent from the access layer", () => {
  const client = read(CLIENT_PATH);
  for (const forbidden of ["表示順設定", "必須入力項目", "見積レビュー確認", "非表示メニュー管理"]) {
    assert.doesNotMatch(client, new RegExp(forbidden), `${forbidden} must not appear`);
  }
});

test("existing estimate-wizard forms, actions, and the real service-offerings section remain unchanged below the access layer", () => {
  const client = read(CLIENT_PATH);
  assert.match(client, /id="section-service-offerings"/);
  assert.match(client, /saveWizardCatalogItem\(parsed\.input\)/);
  assert.match(client, /archiveWizardCatalogItem\(target\.itemId\)/);
  assert.match(client, /confirmWizardCatalogReview\(\)/);
  assert.match(client, /setServiceOffering\(family, next\)/);
  assert.match(client, /SERVICE_FAMILIES\.map/);
  assert.match(client, /view\.sections\.map/);
});
