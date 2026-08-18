// GLOBAL_SHELL_POST_C6 regression contract: getNotificationBellData() is
// resolved once server-side in MainLayout, threaded through
// MainLayoutClient -> Header -> NotificationBell, and NotificationBell skips
// its mount fetch when a valid initial value is supplied — while its 60s
// poll keeps running either way. getUnreadNewsCount() is untouched.
//
// Run: node --import tsx --test src/components/layout/global-shell-post-c6-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("MainLayout resolves getNotificationBellData() alongside staff/plan and passes it down", () => {
  const code = strip(read("src/components/layout/MainLayout.tsx"));
  const gateAt = code.indexOf("await requireActiveDealer()");
  const parallelAt = code.indexOf("await Promise.all([", gateAt);
  const notifAt = code.indexOf("getNotificationBellData(),", parallelAt);
  const passAt = code.indexOf("initialNotificationData={notificationData}", notifAt);

  assert.ok(gateAt >= 0, "the active-dealer gate must remain");
  assert.ok(parallelAt > gateAt, "notification data is resolved only after the dealer gate settles");
  assert.ok(notifAt > parallelAt, "getNotificationBellData() must be part of that Promise.all");
  assert.ok(passAt > notifAt, "the resolved notification data must be passed into MainLayoutClient");
});

test("MainLayoutClient forwards initialNotificationData into Header", () => {
  const code = strip(read("src/components/layout/MainLayoutClient.tsx"));

  assert.match(code, /initialNotificationData\??:\s*NotificationBellData/);
  assert.match(code, /initialNotificationData=\{initialNotificationData\}/);
});

test("Header forwards initialNotificationData into NotificationBell", () => {
  const code = strip(read("src/components/Header.tsx"));

  assert.match(code, /initialNotificationData\??:\s*NotificationBellData/);
  assert.match(code, /<NotificationBell initialData=\{initialNotificationData\} \/>/);
});

test("NotificationBell seeds state from initialData and skips the mount fetch when supplied, but the 60s poll always runs", () => {
  const code = strip(read("src/components/notifications/NotificationBell.tsx"));

  assert.match(code, /useState\(initialData\?\.unreadCount \?\? 0\)/);
  assert.match(code, /useState<NotificationDB\[\]>\(initialData\?\.notifications \?\? \[\]\)/);
  assert.match(code, /if \(initialData === undefined\) fetchData\(\);/);
  // The interval must be set up unconditionally, after the guarded fetch.
  const guardAt = code.indexOf("if (initialData === undefined) fetchData();");
  const intervalAt = code.indexOf("const interval = setInterval(fetchData, 60000);", guardAt);
  assert.ok(intervalAt > guardAt, "the 60s poll must run regardless of whether the mount fetch was skipped");
});

test("getUnreadNewsCount and its 60s poll remain untouched by C6", () => {
  const sidebarCode = strip(read("src/components/Sidebar.tsx"));

  assert.match(sidebarCode, /getUnreadNewsCount\(\)/);
  assert.match(sidebarCode, /setInterval\(load, 60000\)/);
});
