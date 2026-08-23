import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const CLIENT_PATH = "src/app/settings/estimate-wizard/EstimateWizardSettingsClient.tsx";
const PAGE_PATH = "src/app/settings/estimate-wizard/page.tsx";
const PANEL_PAGE_PATH = "src/app/settings/estimate-wizard/[panel]/page.tsx";
const PANEL_CONFIG_PATH = "src/app/settings/estimate-wizard/panel-config.ts";
const ROOT_LAYOUT_PATH = "src/app/layout.tsx";
const LEGACY_LOADING_PATH = "src/app/settings/estimate-wizard/loading.tsx";
const WIZARD_LAYOUT_PATH = "src/app/settings/estimate-wizard/layout.tsx";
const PANEL_LOADING_PATH = "src/app/settings/estimate-wizard/[panel]/loading.tsx";
const SHARED_PANEL_LOADING_PATH = "src/app/settings/estimate-wizard/EstimateWizardPanelLoading.tsx";

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

test("estimate wizard uses the same approved 1280px card canvas as the settings hub", () => {
  const page = read(PAGE_PATH);
  assert.match(page, /mx-auto flex w-full max-w-\[1280px\] flex-col gap-6/);
  assert.doesNotMatch(page, /className="[^"]*max-w-3xl/);
});

test("estimate wizard access cards use the approved badge states and dedicated child routes", () => {
  const client = read(CLIENT_PATH);
  const config = read(PANEL_CONFIG_PATH);

  assert.equal((client.match(/badge:\s+"solid_active"/g) ?? []).length, 1, "only SERVICE AVAILABILITY is solid_active");
  assert.equal((client.match(/badge:\s+"solid_unset"/g) ?? []).length, 3, "the other three real cards are solid_unset");
  assert.match(client, /const serviceSection = view\.sections\.find\(section => section\.id === "service"\);/);
  assert.match(client, /const otherworkSection = view\.sections\.find\(section => section\.id === "otherwork"\);/);
  assert.match(client, /const storeSection = view\.sections\.find\(section => section\.id === "store"\);/);
  assert.match(client, /href:\s+serviceSection \? getEstimateWizardPanelHref\("service-menus"\) : null/);
  assert.match(client, /href:\s+otherworkSection \? getEstimateWizardPanelHref\("work-presets"\) : null/);
  assert.match(client, /href:\s+storeSection \? getEstimateWizardPanelHref\("shop-options"\) : null/);

  assert.match(client, /const isReachable = card\.href !== null;/);
  assert.match(client, /if \(!isReachable\) \{/);
  assert.match(client, /<Link\s+href=\{card\.href!\}/);
  for (const slug of ["service-availability", "service-menus", "work-presets", "shop-options"]) {
    assert.match(config, new RegExp(`"${slug}"`));
  }
});

test("forbidden obsolete wizard cards are absent from the access layer", () => {
  const client = read(CLIENT_PATH);
  for (const forbidden of ["表示順設定", "必須入力項目", "見積レビュー確認", "非表示メニュー管理"]) {
    assert.doesNotMatch(client, new RegExp(forbidden), `${forbidden} must not appear`);
  }
});

test("existing estimate-wizard actions render only on a dedicated panel page", () => {
  const client = read(CLIENT_PATH);
  const panelPage = read(PANEL_PAGE_PATH);
  assert.doesNotMatch(client, /selectedPanel|setSelectedPanel/);
  assert.match(client, /panelId === "section-service-offerings"/);
  assert.match(client, /view\.sections\.filter\(\(section\) => section\.anchorId === panelId\)\.map/);
  assert.match(panelPage, /href="\/settings\/estimate-wizard"/);
  assert.match(panelPage, /<EstimateWizardSettingsClient view=\{result\.view\} panelId=\{panelId!\} \/>/);
  assert.doesNotMatch(panelPage, /buildWizardAccessCards/);
  assert.doesNotMatch(client, /view\.coating\.titleJa/);
  assert.doesNotMatch(client, /view\.ppfCoatingAdjustment\.rules\.map/);
  assert.match(client, /saveWizardCatalogItem\(parsed\.input\)/);
  assert.match(client, /archiveWizardCatalogItem\(target\.itemId\)/);
  assert.match(client, /confirmWizardCatalogReview\(\)/);
  assert.match(client, /setServiceOffering\(family, next\)/);
  assert.match(client, /SERVICE_FAMILIES\.map/);
});

test("estimate wizard hub never appends a selected editor below its cards", () => {
  const page = read(PAGE_PATH);
  const client = read(CLIENT_PATH);
  const accessLayer = client.slice(
    client.indexOf("type WizardAccessBadgeVariant"),
    client.indexOf("type Toast ="),
  );
  assert.match(page, /<EstimateWizardSettingsClient view=\{result\.view\} \/>/);
  assert.match(client, /\{!panelId && !navigatingPanelHref && \(/);
  assert.doesNotMatch(accessLayer, /onClick=\{\(\) => onSelect/);
  assert.doesNotMatch(accessLayer, /href=\{`#\$\{/);
});

test("estimate-wizard navigation keeps one shared shell and shows only the approved panel loading state", () => {
  const page = read(PAGE_PATH);
  const panelPage = read(PANEL_PAGE_PATH);
  const layout = read(WIZARD_LAYOUT_PATH);
  const panelLoading = read(PANEL_LOADING_PATH);
  const sharedPanelLoading = read(SHARED_PANEL_LOADING_PATH);

  assert.equal(
    existsSync(LEGACY_LOADING_PATH),
    false,
    "the obsolete segment-level skeleton must stay absent",
  );
  assert.match(layout, /<MainLayout>\{children\}<\/MainLayout>/);
  assert.doesNotMatch(page, /<MainLayout>/);
  assert.doesNotMatch(panelPage, /<MainLayout>/);
  assert.match(panelLoading, /EstimateWizardPanelLoading/);
  assert.match(sharedPanelLoading, /設定を読み込んでいます/);
  assert.match(sharedPanelLoading, /max-w-\[1280px\]/);
  assert.doesNotMatch(panelLoading, /max-w-3xl|h-32 bg-slate-900\/60/);
});

test("estimate-wizard card navigation replaces the retained hub immediately", () => {
  const client = read(CLIENT_PATH);

  assert.match(client, /const \[navigatingPanelHref, setNavigatingPanelHref\] = useState<string \| null>\(null\);/);
  assert.match(client, /onNavigate=\{setNavigatingPanelHref\}/);
  assert.match(client, /!panelId && navigatingPanelHref && <EstimateWizardPanelLoading \/>/);
  assert.match(client, /!panelId && !navigatingPanelHref && \(/);
  assert.match(client, /onClick=\{\(event\) => \{/);
});

test("estimate-wizard access-card icon boxes and glyphs use one exact size", () => {
  const client = read(CLIENT_PATH);
  assert.match(client, /h-\[52px\] w-\[52px\]/);
  assert.match(client, /className="block h-6 w-6" viewBox="0 0 24 24"/);
});

test("approved bilingual UI is protected from browser auto-translation", () => {
  const layout = read(ROOT_LAYOUT_PATH);
  const page = read(PAGE_PATH);

  assert.match(layout, /google:\s*"notranslate"/);
  assert.match(layout, /<html lang="ja" translate="no">/);
  assert.match(layout, /notranslate antialiased/);
  assert.match(page, />見積ウィザード設定</);
  assert.doesNotMatch(page, /簡易ウィザード/);
});
