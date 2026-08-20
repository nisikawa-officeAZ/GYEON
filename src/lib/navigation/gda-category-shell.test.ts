import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { GDA_CATEGORIES, categoryForPathname } from "./gda-categories";

const read = (path: string) => readFileSync(path, "utf8");

test("owner-approved sidebar keeps the exact ten large categories in order", () => {
  assert.deepEqual(
    GDA_CATEGORIES.map(({ label, labelEn }) => [label, labelEn]),
    [
      ["ダッシュボード", "HOME"],
      ["顧客・車両", "CUSTOMERS"],
      ["見積・作業", "ESTIMATES"],
      ["予約", "RESERVATIONS"],
      ["請求・入金", "BILLING"],
      ["発注・在庫", "ORDERS"],
      ["SNS", "SOCIAL MEDIA"],
      ["メッセージ", "MESSAGES"],
      ["記録・資料", "RECORDS"],
      ["設定", "SETTINGS"],
    ],
  );
});

test("billing routes resolve to one large category and the three existing small-category pages", () => {
  for (const route of ["/billing", "/invoices", "/payments", "/points"]) {
    assert.equal(categoryForPathname(route).id, "billing");
  }
  for (const route of ["invoices", "payments", "points"]) {
    assert.equal(existsSync(`src/app/${route}/page.tsx`), true, `${route} route must exist`);
  }
});

test("shared shell renders the rectangular Brand lockup and no legacy 22-route list", () => {
  const sidebar = read("src/components/Sidebar.tsx");
  assert.match(sidebar, /<Brand size=\{54\}/);
  assert.match(sidebar, /GDA_CATEGORIES\.map/);
  assert.doesNotMatch(sidebar, /const navItems/);
  assert.doesNotMatch(sidebar, /href: "\/completion-reports"/);
});

test("TOP billing category enters the new hub while SNS stays intentionally inactive", () => {
  const top = read("public/desktop-home.html");
  assert.match(top, /'BILLING': '\/billing'/);
  assert.equal((top.match(/data-gda-category="social-media"/g) ?? []).length, 1);
});
