// PERF-B source contract for the single-round-trip dashboard aggregate.
//
// Run: node --import tsx --test src/lib/dashboard/dashboard-summary-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MIGRATION = readFileSync(
  "supabase/migrations/20260817074329_dashboard_summary_aggregate_rpc.sql",
  "utf8",
);
const SOURCE = readFileSync("src/lib/dashboard/get-dashboard-summary.ts", "utf8");

test("dashboard summary uses exactly one aggregate RPC and no table fan-out", () => {
  const rpcCalls = SOURCE.match(/\.rpc\(/g) ?? [];
  const tableCalls = SOURCE.match(/\.from\(/g) ?? [];

  assert.equal(rpcCalls.length, 1);
  assert.equal(tableCalls.length, 0);
  assert.match(SOURCE, /\.rpc\("get_dashboard_summary",\s*\{\s*p_dealer_id:\s*dealer\.dealer_id/);
  assert.match(SOURCE, /if \(error \|\| !isDashboardSummary\(data\)\)/);
});

test("aggregate RPC is invoker-only and bound to active membership", () => {
  assert.match(MIGRATION, /create or replace function public\.get_dashboard_summary\(p_dealer_id uuid\)/i);
  assert.match(MIGRATION, /stable\s+security invoker\s+set search_path = ''/i);
  assert.doesNotMatch(MIGRATION, /security definer/i);
  assert.match(MIGRATION, /dm\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(MIGRATION, /dm\.dealer_id = p_dealer_id/i);
  assert.match(MIGRATION, /dm\.status = 'active'/i);
  assert.match(MIGRATION, /revoke all on function public\.get_dashboard_summary\(uuid\) from public/i);
  assert.match(MIGRATION, /revoke all on function public\.get_dashboard_summary\(uuid\) from anon/i);
  assert.match(MIGRATION, /grant execute on function public\.get_dashboard_summary\(uuid\) to authenticated/i);
  assert.doesNotMatch(MIGRATION, /service_role/i);
});

test("aggregate RPC covers every existing dashboard data family", () => {
  for (const table of [
    "dealer_members",
    "customers",
    "vehicles",
    "estimates",
    "work_orders",
    "invoices",
    "payments",
    "line_customers",
    "line_message_logs",
    "line_notification_queue",
    "maintenance_reminders",
    "reservations",
  ]) {
    assert.match(MIGRATION, new RegExp(`public\\.${table}\\b`), `missing ${table}`);
  }
});

test("RPC and TypeScript guard preserve the complete DashboardSummary contract", () => {
  const topLevelKeys = [
    "customer_count",
    "vehicle_count",
    "estimates",
    "work_orders",
    "invoices",
    "sales",
    "line_stats",
    "line_message_stats",
    "line_queue_stats",
    "maintenance_stats",
    "reservation_stats",
    "today_work_orders",
    "upcoming_work_orders",
    "recent_activities",
  ];

  for (const key of topLevelKeys) {
    assert.match(MIGRATION, new RegExp(`'${key}'`), `SQL missing ${key}`);
    assert.match(SOURCE, new RegExp(`value\\.${key}`), `guard missing ${key}`);
  }

  for (const nestedKey of [
    "draft",
    "proposal",
    "approved",
    "rejected",
    "expired",
    "scheduled",
    "in_progress",
    "completed",
    "on_hold",
    "cancelled",
    "issued",
    "paid",
    "partially_paid",
    "overdue",
    "monthly_sales",
    "monthly_received",
    "outstanding",
    "yearly_sales",
    "friends_count",
    "linked_count",
    "this_month_new",
    "this_month_sent",
    "this_month_failed",
    "total_sent",
    "failed",
    "this_month",
    "next_7_days",
    "pending",
    "sent_this_month",
    "today",
    "this_week",
    "confirmed",
  ]) {
    assert.match(MIGRATION, new RegExp(`'${nestedKey}'`), `SQL missing ${nestedKey}`);
  }
});
