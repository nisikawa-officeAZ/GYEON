import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/settings/WindowFilmSettingsClient.tsx", "utf8");
const styles = readFileSync("src/components/settings/WindowFilmSettingsClient.module.css", "utf8");

test("settings UI uses the seven canonical fixed-area labels", () => {
  for (const label of [
    "フロントガラス",
    "フロントドアガラス",
    "リアドアガラス",
    "三角窓",
    "クォーターガラス",
    "リアガラス（リアハッチ）",
    "サンルーフ",
  ]) assert.match(source, new RegExp(label.replace(/[（）]/g, (value) => `\\${value}`)));
  assert.doesNotMatch(source, /フロントドア左右|リアドア左右|リアクォーター左右/);
});

test("settings UI exposes explicit film archive and 44px controls", () => {
  assert.match(source, /film\.itemId \? "アーカイブ" : "削除"/);
  assert.match(styles, /\.panel input \{[^}]*min-height:44px/);
  assert.match(styles, /\.button \{[^}]*min-height:44px/);
  assert.doesNotMatch(styles, /min-height:42px/);
});

test("C4-R2a removes tablet-only table overflow without changing desktop or mobile breakpoints", () => {
  assert.match(styles, /@media \(min-width:768px\) and \(max-width:1023px\)/);
  assert.match(styles, /\.scroll \{ overflow-x:visible; \}/);
  assert.match(styles, /\.scroll table \{ display:block; width:100%; min-width:0; \}/);
  assert.match(styles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.scroll td::before \{ content:attr\(data-label\)/);
  for (const label of ["フィルム名", "施工係数（×）", "IRカット（%）", "UVカット（%）", "施工部位", "項目名", "提供状態", "操作"]) {
    assert.match(source, new RegExp(`data-label="${label.replace(/[（）×%]/g, value => `\\${value}`)}"`));
  }
  assert.match(styles, /@media \(max-width:767px\)/);
});
