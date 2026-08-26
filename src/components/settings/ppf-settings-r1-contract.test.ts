import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./PpfSettingsClient.tsx", import.meta.url), "utf8");
const STYLES = readFileSync(new URL("./PpfSettingsClient.module.css", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../../app/settings/ppf/page.tsx", import.meta.url), "utf8");
const HUB = readFileSync(new URL("./SettingsCenterHub.tsx", import.meta.url), "utf8");

test("PPF R1 keeps the exact seven-size contract", () => {
  assert.match(SOURCE, /\["SS", "S", "M", "ML", "L", "LL", "XL"\]/);
  assert.doesNotMatch(SOURCE, /XXL|size8|8サイズ/);
});

test("PPF R1 removes the measured tablet size-grid overflow without changing mobile", () => {
  assert.match(STYLES, /@media \(max-width: 1024px\)/);
  assert.match(STYLES, /@media \(min-width: 768px\) and \(max-width: 827px\)/);
  assert.match(STYLES, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(STYLES, /@media \(max-width: 767px\)/);
  assert.match(STYLES, /\.sizeGrid \{ grid-template-columns: 1fr; \}/);
});

test("PPF R1 exposes every accepted section without hard-delete wording", () => {
  for (const label of [
    "フロントフル価格（サイズ別・税抜）",
    "フルボディ価格（サイズ別・税抜）",
    "PPF種類マスタ",
    "施工範囲プリセット",
    "PPF専用コーティング（税抜）",
    "室内PPF（税抜）",
    "部分PPF施工・単体用（税抜）",
    "フロントウインドPPF（税抜）",
  ]) assert.match(SOURCE, new RegExp(label.replace(/[（），＋]/g, ".")));
  assert.doesNotMatch(SOURCE, /delete\(|\.delete\(/);
  assert.match(SOURCE, /archived: true, active: false/);
  assert.match(SOURCE, />復元</);
});

test("PPF R1 replaces the single ambiguous base-price authority with two independent seven-size panels", () => {
  assert.doesNotMatch(SOURCE, /基準価格/);
  assert.doesNotMatch(SOURCE, /MOCK_BASE/);
  assert.match(SOURCE, /data-component="price-matrix-front-full"/);
  assert.match(SOURCE, /data-component="price-matrix-full-body"/);
  assert.match(SOURCE, /frontFullPrices/);
  assert.match(SOURCE, /fullBodyPrices/);
  assert.match(SOURCE, /setFrontFullPrices/);
  assert.match(SOURCE, /setFullBodyPrices/);
});

test("PPF R1 seven-size price panels show unsaved simulation prices when no authoritative settings exist", () => {
  for (const price of ["90_000", "100_000", "110_000", "120_000", "130_000", "140_000", "150_000"]) {
    assert.match(SOURCE, new RegExp(price));
  }
  assert.match(SOURCE, /\(FRONT_FULL_SIMULATION_PRICES\[size\] \?\? 0\) \* 4/);
  assert.match(SOURCE, /resolution\.status === "READY"[\s\S]*priceText\(resolution\.settings\[key\]\[size\]\)[\s\S]*priceText\(simulationPrices\[size\]\)/);
  assert.match(SOURCE, /useState\(\(\) => initialSizePrices\(resolution, "frontFullPricesBySize"\)\)/);
  assert.match(SOURCE, /useState\(\(\) => initialSizePrices\(resolution, "fullBodyPricesBySize"\)\)/);
});

test("PPF R1 scope-preset rows that duplicate the size-matrix plans cannot expose an editable price input", () => {
  assert.match(SOURCE, /MATRIX_AUTHORITATIVE_SCOPE_NAMES = new Set\(\["フルボディ（全周）", "フロントフル（バンパー＋ボンネット＋フェンダー）"\]\)/);
  assert.match(SOURCE, /matrixAuthoritative: MATRIX_AUTHORITATIVE_SCOPE_NAMES\.has\(name\)/);
  assert.match(SOURCE, /row\.matrixAuthoritative\s*\n\s*\? <span className=\{styles\.standard\} data-matrix-authoritative-price="true">サイズ別価格表を使用<\/span>/);
  assert.match(SOURCE, /: <input className=\{`\$\{styles\.input\} \$\{styles\.price\}`\} inputMode="numeric" value=\{row\.price\}/);
  const priceCellBranch = SOURCE.match(/<td>\{row\.matrixAuthoritative[\s\S]*?<\/td>/);
  assert.ok(priceCellBranch, "expected the conditional price-cell branch in EditableRows");
  assert.doesNotMatch(priceCellBranch[0], /matrixAuthoritative\s*\?[^:]*<input/);
});

test("PPF R1 two seven-size panels remain the only pricing authority for the matrix-authoritative plans", () => {
  assert.match(SOURCE, /data-component="price-matrix-front-full"/);
  assert.match(SOURCE, /data-component="price-matrix-full-body"/);
  assert.doesNotMatch(SOURCE, /基準価格/);
  assert.doesNotMatch(SOURCE, /MOCK_BASE/);
});

test("settings hub routes PPF to the dedicated R1 page", () => {
  assert.match(HUB, /href: "\/settings\/ppf"/);
});

test("PPF R1 page reads and saves the authoritative versioned price contract", () => {
  assert.match(PAGE, /getAuthoritativePpfR1PriceSettings\(\)/, "server page reads under request scope");
  assert.match(PAGE, /getAuthoritativePpfR1InstallationCoefficients\(\)/, "server page reads dealer coefficient overrides");
  assert.match(PAGE, /<PpfSettingsClient resolution=\{resolution\} coefficientResolution=\{coefficientResolution\}/, "both read results reach the existing UI");
  assert.match(SOURCE, /saveAuthoritativePpfR1PriceSettings\(payload, coefficients\)/, "one save reaches the atomic strict server action");
  assert.match(SOURCE, /PPF_R1_STANDARD_PRODUCT_CODES\.map/, "all eight standard products are required");
  assert.match(SOURCE, /8種類すべての施工係数/, "partial coefficient input is rejected visibly");
  assert.doesNotMatch(SOURCE, /保存契約は未接続/, "stale mock-only save message is removed");
});

test("PPF R1 does not seed a third-party product", () => {
  assert.doesNotMatch(SOURCE, /STEK DYNOshield/, "STEK DYNOshield must not appear as a default row");
  assert.match(SOURCE, /＋ PPF種類を追加/, "dealers can still add a third-party product when needed");
  assert.match(SOURCE, /id: `custom-\$\{Date\.now\(\)\}`, name: "", coefficient: ""/, "new third-party rows start blank");
});

test("PPF R1 hides the sample notice only after an authoritative save", () => {
  assert.match(SOURCE, /画面に表示されている保存対象のPPF価格と施工係数は、表示確認のためのサンプルです。実際の設定には使用されません。/);
  assert.match(SOURCE, /入力内容はまだ保存されていません。/);
  assert.match(SOURCE, /setDraftNoticeState\("persisted"\)/);
  assert.match(SOURCE, /draftNoticeState === "sample"[\s\S]*draftNoticeState === "dirty"[\s\S]*: null/);
});
