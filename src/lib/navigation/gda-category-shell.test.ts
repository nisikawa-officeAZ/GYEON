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

test("billing routes resolve to one large category and all existing small-category pages", () => {
  for (const route of ["/billing", "/invoices", "/payments", "/points", "/sales", "/monthly-statements"]) {
    assert.equal(categoryForPathname(route).id, "billing");
  }
  for (const route of ["invoices", "payments", "points", "sales", "monthly-statements"]) {
    assert.equal(existsSync(`src/app/${route}/page.tsx`), true, `${route} route must exist`);
  }
});

test("billing hub exposes exactly the three owner-approved small categories", () => {
  const billingHub = read("src/app/billing/page.tsx");
  assert.equal((billingHub.match(/href: "\/(?:invoices|payments|points)"/g) ?? []).length, 3);
  assert.match(billingHub, /href: "\/invoices"[\s\S]*?label: "請求管理"/);
  assert.match(billingHub, /href: "\/payments"[\s\S]*?label: "入金管理"/);
  assert.match(billingHub, /href: "\/points"[\s\S]*?label: "ポイント"/);
  assert.doesNotMatch(billingHub, /href: "\/(?:sales|monthly-statements)"/);
});

test("orders hub preserves the owner-approved small-category order", () => {
  const ordersHub = read("src/app/hub/orders/page.tsx");
  assert.match(
    ordersHub,
    /href: "\/products"[\s\S]*?label: "商品管理"[\s\S]*?href: "\/inventory"[\s\S]*?label: "在庫カウント"[\s\S]*?href: "\/product-orders"[\s\S]*?label: "商品注文"/,
  );
});

test("large categories enter collision-free hubs while every operational leaf route remains available", () => {
  const hubs = [
    ["customers", "/hub/customers", ["customers", "vehicles", "customer-app"]],
    ["estimates", "/hub/estimates", ["estimates", "work-orders", "completion-reports", "maintenance"]],
    ["reservations", "/hub/reservations", ["reservations", "calendar"]],
    ["orders", "/hub/orders", ["product-orders", "products", "inventory"]],
    ["messages", "/hub/messages", ["line", "news"]],
    ["records", "/hub/records", ["downloads", "pdf", "ocr-sessions"]],
  ] as const;

  for (const [categoryId, hubPath, leaves] of hubs) {
    assert.equal(categoryForPathname(hubPath).id, categoryId);
    assert.equal(existsSync(`src/app${hubPath}/page.tsx`), true, `${hubPath} must exist`);
    for (const leaf of leaves) {
      assert.equal(categoryForPathname(`/${leaf}`).id, categoryId);
      assert.equal(existsSync(`src/app/${leaf}/page.tsx`), true, `${leaf} route must remain`);
    }
  }
});

test("settings stays direct and SNS stays disabled without a fabricated route", () => {
  const settings = GDA_CATEGORIES.find(({ id }) => id === "settings");
  const social = GDA_CATEGORIES.find(({ id }) => id === "social-media");
  assert.equal(settings?.href, "/settings");
  assert.equal(social?.href, null);
  assert.equal(existsSync("src/app/hub/settings/page.tsx"), false);
  assert.equal(existsSync("src/app/social-media/page.tsx"), false);
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

test("TOP sidebar categories enter hubs while Quick Access cards remain direct shortcuts", () => {
  const top = read("public/desktop-home.html");
  assert.match(top, /var CATEGORY_ROUTES = \{[\s\S]*?'CUSTOMERS': '\/hub\/customers'[\s\S]*?'ESTIMATES': '\/hub\/estimates'[\s\S]*?'RESERVATIONS': '\/hub\/reservations'[\s\S]*?'ORDERS': '\/hub\/orders'[\s\S]*?'MESSAGES': '\/hub\/messages'[\s\S]*?'RECORDS': '\/hub\/records'/);
  assert.match(top, /var QUICK_ACCESS_ROUTES = \{[\s\S]*?'CUSTOMERS': '\/customers'[\s\S]*?'RESERVATIONS': '\/reservations'[\s\S]*?'ORDERS': '\/product-orders'/);
  assert.match(top, /el\.matches\('nav\.nav a'\) \? CATEGORY_ROUTES/);
  assert.match(top, /el\.matches\('\.cta-action'\) \? CTA_ROUTES/);
});

test("TOP large categories use native parent navigation so the outer URL and browser history stay synchronized", () => {
  const top = read("public/desktop-home.html");
  assert.match(
    top,
    /if \(el\.matches\('nav\.nav a'\)\) \{[\s\S]*?el\.setAttribute\('href', route\);[\s\S]*?el\.setAttribute\('target', '_parent'\);[\s\S]*?return;/,
  );
});

test("TOP plan badge, trial badge, and countdown are driven by separate authenticated facts", () => {
  const page = read("src/app/page.tsx");
  const top = read("public/desktop-home.html");

  assert.match(page, /getCurrentPlan/);
  assert.match(page, /planInfo\.subscription_status === "trial"/);
  assert.match(page, /planInfo\.expired_at/);
  assert.match(page, /Math\.ceil\(\(new Date\(planInfo\.expired_at\)\.getTime\(\) - Date\.now\(\)\) \/ 86_400_000\)/);
  assert.match(page, /`&td=\$\{trialDays\}`/);
  assert.match(page, /&p=\$\{planParam\}&t=\$\{trialParam\}\$\{trialDaysParam\}/);
  assert.match(top, /\['basic', 'pro', 'pro_plus'\]\.includes\(requestedPlan\)/);
  assert.match(top, /params\.get\('t'\) === '1'/);
  assert.match(top, /params\.get\('td'\)/);
  assert.match(top, /trialDays === 0 \? 'トライアル終了' : '残り' \+ trialDays \+ '日'/);
  assert.match(top, /trialDays <= 3/);
  assert.match(top, /trialDays <= 7/);
  assert.match(top, /tag\.textContent = 'BASIC'/);
  assert.match(top, /tag\.textContent = 'PRO'/);
  assert.match(top, /tag\.textContent = 'PRO\+'/);
  assert.doesNotMatch(top, /data-plan="pro" data-trial="1"/);
  assert.doesNotMatch(top, /残り180日/);
});

test("TOP actions use the server-owned feature list and fail closed when unavailable", () => {
  const page = read("src/app/page.tsx");
  const top = read("public/desktop-home.html");

  assert.match(page, /PLAN_FEATURES\[planInfo\.plan\]\.join\(","\)/);
  assert.match(page, /&f=\$\{featureParam\}/);
  for (const feature of [
    "customers", "vehicles", "estimates", "products", "product_orders",
    "work_orders", "reservations", "invoices", "maintenance", "line",
  ]) {
    assert.match(top, new RegExp(`data-feature="${feature}"`));
  }
  assert.match(top, /allowedFeatures\.has\(feature\)/);
  assert.match(top, /classList\.add\('plan-locked'\)/);
  assert.match(top, /setAttribute\('aria-disabled', 'true'\)/);
  assert.match(top, /現在のプランでは利用できません/);
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
