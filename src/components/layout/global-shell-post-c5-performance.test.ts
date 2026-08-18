// GLOBAL_SHELL_POST_C5 regression contract: the global shell's mount-time
// server-action POST burst goes from 4 to 1 (getUnreadNewsCount only) —
// getCurrentPlan() is resolved once server-side and NotificationBell's two
// separate actions are combined into one.
//
// Run: node --import tsx --test src/components/layout/global-shell-post-c5-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("MainLayout resolves getCurrentPlan() alongside getCurrentStaff() after the dealer gate", () => {
  const code = strip(read("src/components/layout/MainLayout.tsx"));
  const gateAt = code.indexOf("await requireActiveDealer()");
  const parallelAt = code.indexOf("const [staff, planInfo] = await Promise.all([", gateAt);
  const staffAt = code.indexOf("getCurrentStaff(),", parallelAt);
  const planAt = code.indexOf("getCurrentPlan(),", parallelAt);
  const passAt = code.indexOf("initialPlan={planInfo.plan}", planAt);

  assert.ok(gateAt >= 0, "the active-dealer gate must remain");
  assert.ok(parallelAt > gateAt, "staff/plan are resolved only after the dealer gate settles");
  assert.ok(staffAt > parallelAt && planAt > staffAt, "both reads must be inside the same Promise.all");
  assert.ok(passAt > planAt, "the resolved plan must be passed into MainLayoutClient");
});

test("MainLayoutClient forwards initialPlan into Sidebar", () => {
  const code = strip(read("src/components/layout/MainLayoutClient.tsx"));

  assert.match(code, /initialPlan\??:\s*DealerPlan/);
  assert.match(code, /<Sidebar open=\{open\} onClose=\{\(\) => setOpen\(false\)\} initialPlan=\{initialPlan\} \/>/);
});

test("Sidebar uses the supplied initialPlan and skips its own fetch when defined", () => {
  const code = strip(read("src/components/Sidebar.tsx"));

  assert.match(code, /useState<DealerPlan \| null>\(initialPlan \?\? null\)/);
  assert.match(code, /if \(initialPlan !== undefined\) return;\s*getCurrentPlan\(\)/);
});

test("NotificationBell calls one combined action, not two separate ones", () => {
  const code = strip(read("src/components/notifications/NotificationBell.tsx"));

  assert.match(code, /import \{ getNotificationBellData, markNotificationAsRead, markAllNotificationsAsRead \} from "@\/lib\/notifications\/notification";/);
  assert.doesNotMatch(code, /getUnreadNotificationCount|getNotifications\(\)/);
  assert.match(
    code,
    /const \{ notifications: notifs, unreadCount: count \} = await getNotificationBellData\(\);/
  );
});

test("getNotificationBellData runs both queries via one action, deriving neither from the other", () => {
  const code = strip(read("src/lib/notifications/notification.ts"));

  assert.match(code, /export interface NotificationBellData \{/);
  assert.match(code, /export async function getNotificationBellData\(\): Promise<NotificationBellData>/);
  // Both original queries still run (list can't safely derive the count —
  // a dealer can have more than 20 unread notifications).
  assert.match(code, /\.limit\(20\)/);
  assert.match(code, /count: "exact", head: true/);
  // The two original standalone actions remain available/untouched.
  assert.match(code, /export async function getNotifications\(\): Promise<NotificationDB\[\]>/);
  assert.match(code, /export async function getUnreadNotificationCount\(\): Promise<number>/);
});

test("getUnreadNewsCount and its 60s poll are untouched by C5", () => {
  const sidebarCode = strip(read("src/components/Sidebar.tsx"));

  assert.match(sidebarCode, /getUnreadNewsCount\(\)/);
  assert.match(sidebarCode, /setInterval\(load, 60000\)/);
});
