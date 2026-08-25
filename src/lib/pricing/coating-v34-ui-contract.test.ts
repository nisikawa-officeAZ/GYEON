import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync("src/components/settings/CoatingV34SettingsClient.tsx", "utf8");

test("coating V3.4 UI keeps the approved seven-size direct-price defaults", () => {
  assert.match(SOURCE, /base:\s*\{ SS: 65_000, S: 72_000, M: 80_000, ML: 88_000, L: 96_000, LL: 105_000, XL: 115_000 \}/);
  assert.match(SOURCE, /layer2:\s*\{ SS: 28_000, S: 31_000, M: 35_000, ML: 38_000, L: 42_000, LL: 46_000, XL: 50_000 \}/);
  assert.match(SOURCE, /layer3:\s*\{ SS: 18_000, S: 20_000, M: 23_000, ML: 25_000, L: 28_000, LL: 31_000, XL: 35_000 \}/);
  assert.match(SOURCE, /resolution\.status === "NOT_CONFIGURED"\s*\? applyUnsavedDefaultPrices/);
  assert.match(SOURCE, /現在設定されている価格はシミュレーション用の価格を表示しています。御社の規定の金額を入力し保存を押してからアプリをご使用ください。/);
  assert.doesNotMatch(SOURCE, /趣味レーション/);
  assert.doesNotMatch(SOURCE, /未保存ドラフト/);
  assert.match(SOURCE, /baseSimulationSource/);
  assert.match(SOURCE, /layer2SimulationSource/);
});

test("coating V3.4 UI uses the approved rank-specific initial products", () => {
  assert.match(SOURCE, /shop:\s*\{ base: "one-evo", layer2: "cancoat-evo", layer3: "cancoat-evo" \}/);
  assert.match(SOURCE, /detailer:\s*\{ base: "pure-evo", layer2: "cancoat-evo", layer3: "cancoat-evo" \}/);
  assert.match(SOURCE, /certified:\s*\{ base: "infinit1", layer2: "infinit-t1", layer3: "infinit-t1" \}/);
});

test("coating V3.4 UI stacks all layers and renders compact seven-column desktop prices", () => {
  assert.match(SOURCE, /xl:grid-cols-7/);
  assert.doesNotMatch(SOURCE, /xl:grid-cols-2/);
  assert.match(SOURCE, /xl:grid-cols-6/);
  assert.doesNotMatch(SOURCE, /xl:grid-cols-5/);
  assert.doesNotMatch(SOURCE, /V3\.4・7サイズ契約/);
  assert.match(SOURCE, /selectorTitle="1層目コーティング剤"/);
  assert.match(SOURCE, /selectorTitle="2層目コーティング剤（追加価格・税抜）"/);
  assert.match(SOURCE, /selectorTitle="3層目コーティング剤（追加価格・税抜）"/);
  assert.match(SOURCE, /data-size-contract="SS,S,M,ML,L,LL,XL"/);
});

test("coating V3.4 UI bulk-copies PURE draft prices without saving", () => {
  assert.match(SOURCE, /const BULK_COPY_SOURCE_PRODUCT_ID = "pure-evo"/);
  assert.match(SOURCE, /PURE価格を1層目へ一括反映/);
  assert.match(SOURCE, /PURE価格を2層目へ一括反映/);
  assert.match(SOURCE, /PUREの2層目価格を3層目へ一括反映/);
  assert.match(SOURCE, /bulkCopyPrices\(\s*"base",\s*"base",\s*catalogs\.base/);
  assert.match(SOURCE, /bulkCopyPrices\(\s*"layer2",\s*"layer2",\s*catalogs\.layer2/);
  assert.match(SOURCE, /bulkCopyPrices\(\s*"layer2",\s*"layer3",\s*catalogs\.layer3/);
  assert.match(SOURCE, /画面上の未保存価格だけに反映します。「保存する」を押すまでは登録されません。/);
});
