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
  assert.match(sidebar, /w-\[268px\]/);
  assert.match(sidebar, /<Brand size=\{63\}/);
  assert.match(sidebar, /GDA_CATEGORIES\.map/);
  assert.doesNotMatch(sidebar, /const navItems/);
  assert.doesNotMatch(sidebar, /href: "\/completion-reports"/);
});

test("TOP billing category enters the new hub while SNS stays intentionally inactive", () => {
  const top = read("public/desktop-home.html");
  assert.match(top, /'BILLING': '\/billing'/);
  assert.equal((top.match(/data-gda-category="social-media"/g) ?? []).length, 1);
});

test("CategoryHub cards preserve the accepted desktop large-card layout at >=1024px", () => {
  const hub = read("src/components/navigation/CategoryHub.tsx");
  assert.match(hub, /lg:min-h-\[250px\]/);
  assert.match(hub, /lg:p-7/);
  assert.match(hub, /lg:text-\[22px\]/);
  assert.match(hub, /lg:line-clamp-none/);
  assert.match(hub, /lg:text-\[14px\]\s+lg:leading-7/);
  assert.match(hub, /lg:inline-flex[\s\S]*?開く/);
});

test("CategoryHub cards collapse to compact two-column cards at 768-1023px with the open affordance hidden", () => {
  const hub = read("src/components/navigation/CategoryHub.tsx");
  assert.match(hub, /md:grid-cols-2/);
  assert.match(hub, /md:flex-col/);
  assert.match(hub, /md:block\s+md:line-clamp-2/);
  assert.doesNotMatch(hub, /\bmd:inline-flex\b/);
});

test("CategoryHub cards render as compact horizontal rows on mobile with description and open affordance hidden", () => {
  const hub = read("src/components/navigation/CategoryHub.tsx");
  assert.match(hub, /min-h-\[64px\]/);
  assert.match(hub, /h-10 w-10 shrink-0/);
  assert.match(hub, /<p className="hidden /);
  assert.match(hub, /<span className="hidden lg:mt-6/);
});

test("CategoryHub cards preserve destinations, labels, and route Links unchanged", () => {
  const hub = read("src/components/navigation/CategoryHub.tsx");
  assert.match(hub, /href=\{item\.href\}/);
  assert.match(hub, /\{item\.label\}/);
  assert.match(hub, /\{item\.labelEn\}/);
  assert.match(hub, /\{item\.description\}/);
});

test("BottomNav maintenance icon is repaired to a wrench + sparkle and the coffee-cup glyph is gone", () => {
  const bottomNav = read("src/components/layout/BottomNav.tsx");
  const maintenanceIconBody = bottomNav.match(/function IconMaintenance\(\)[\s\S]*?\n}/)?.[0] ?? "";
  assert.match(maintenanceIconBody, /viewBox="0 0 24 24"/);
  assert.match(maintenanceIconBody, /stroke="currentColor"/);
  assert.match(maintenanceIconBody, /fill="none"/);
  assert.doesNotMatch(maintenanceIconBody, /M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z/);
  assert.doesNotMatch(maintenanceIconBody, /line x1="10" y1="1" x2="10" y2="4"/);
});

test("BottomNav preserves the /maintenance route, label, and right-tab position", () => {
  const bottomNav = read("src/components/layout/BottomNav.tsx");
  assert.match(bottomNav, /\{ href: "\/work-orders", icon: <IconWorkOrders \/>,\s+label: "施工" \},\s*\n\s*\{ href: "\/maintenance", icon: <IconMaintenance \/>,\s+label: "メンテ" \}/);
});
