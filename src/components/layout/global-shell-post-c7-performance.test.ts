// GLOBAL_SHELL_POST_C7 regression contract: getUnreadNewsCount() is resolved
// once server-side in MainLayout, threaded through directly to Sidebar (no
// intermediate pass-through needed, unlike NotificationBell), and Sidebar
// skips its mount fetch when a valid initial value is supplied — while its
// 60s poll and [pathname] dependency keep running exactly as before.
//
// Run: node --import tsx --test src/components/layout/global-shell-post-c7-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("MainLayout resolves getUnreadNewsCount() alongside staff/plan/notifications and passes it down", () => {
  const code = strip(read("src/components/layout/MainLayout.tsx"));
  const gateAt = code.indexOf("await requireActiveDealer()");
  const parallelAt = code.indexOf("await Promise.all([", gateAt);
  const newsAt = code.indexOf("getUnreadNewsCount(),", parallelAt);
  const passAt = code.indexOf("initialUnreadNews={unreadNewsCount}", newsAt);

  assert.ok(gateAt >= 0, "the active-dealer gate must remain");
  assert.ok(parallelAt > gateAt, "unread news count is resolved only after the dealer gate settles");
  assert.ok(newsAt > parallelAt, "getUnreadNewsCount() must be part of that Promise.all");
  assert.ok(passAt > newsAt, "the resolved count must be passed into MainLayoutClient");
});

test("MainLayoutClient forwards initialUnreadNews directly into Sidebar", () => {
  const code = strip(read("src/components/layout/MainLayoutClient.tsx"));
  const sidebarAt = code.indexOf("<Sidebar");
  const sidebarCloseAt = code.indexOf("/>", sidebarAt);
  const sidebarTag = code.slice(sidebarAt, sidebarCloseAt);

  assert.match(code, /initialUnreadNews\??:\s*number/);
  assert.match(sidebarTag, /initialUnreadNews=\{initialUnreadNews\}/);
});

test("Sidebar seeds unreadNews from initialUnreadNews and guards only the mount fetch", () => {
  const code = strip(read("src/components/Sidebar.tsx"));

  assert.match(code, /useState\(initialUnreadNews \?\? 0\)/);
  assert.match(code, /if \(initialUnreadNews === undefined\) load\(\);/);
});

test("the 60s poll and [pathname] dependency are unchanged by C7", () => {
  const code = strip(read("src/components/Sidebar.tsx"));
  const effectAt = code.indexOf("Unread GYEON News badge");
  const guardAt = code.indexOf("if (initialUnreadNews === undefined) load();", effectAt);
  const intervalAt = code.indexOf("const interval = setInterval(load, 60000);", guardAt);
  const depsAt = code.indexOf("}, [pathname]);", intervalAt);

  assert.ok(guardAt > effectAt, "the guard must be inside the news-badge effect");
  assert.ok(intervalAt > guardAt, "the interval must still be set up unconditionally, after the guard");
  assert.ok(depsAt > intervalAt, "the [pathname] dependency array must remain exactly as before");
});

test("getUnreadNewsCount, markNewsRead, and the /news page flow are untouched", () => {
  const newsCode = strip(read("src/lib/news/news.ts"));
  const newsPageCode = strip(read("src/app/news/page.tsx"));

  assert.match(newsCode, /export async function getUnreadNewsCount\(\): Promise<number>/);
  assert.match(newsCode, /export async function markNewsRead\(/);
  assert.match(newsPageCode, /getPublishedNews\(\)/);
});
