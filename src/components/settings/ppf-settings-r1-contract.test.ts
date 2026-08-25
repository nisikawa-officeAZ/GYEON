import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./PpfSettingsClient.tsx", import.meta.url), "utf8");
const HUB = readFileSync(new URL("./SettingsCenterHub.tsx", import.meta.url), "utf8");

test("PPF R1 keeps the exact seven-size contract", () => {
  assert.match(SOURCE, /\["SS", "S", "M", "ML", "L", "LL", "XL"\]/);
  assert.doesNotMatch(SOURCE, /XXL|size8|8サイズ/);
});

test("PPF R1 exposes every accepted section without hard-delete wording", () => {
  for (const label of [
    "基準価格（サイズ別・税抜）",
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

test("settings hub routes PPF to the dedicated R1 page", () => {
  assert.match(HUB, /href: "\/settings\/ppf"/);
});
