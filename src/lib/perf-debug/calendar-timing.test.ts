// CALENDAR_PERF_C4 regression contract: the temporary timing helper must
// stay disabled on production (both server and client gates) and must
// never take a value that looks like a secret/cookie/token as an argument
// shape (label + plain numeric/string data only).
//
// Run: node --import tsx --test src/lib/perf-debug/calendar-timing.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("server logging is gated off on VERCEL_ENV production", () => {
  const code = strip(read("src/lib/perf-debug/calendar-timing.ts"));

  assert.match(code, /const SERVER_ENABLED = process\.env\.VERCEL_ENV !== "production";/);
  assert.match(code, /export function perfLogServer\([\s\S]*?\{\s*if \(!SERVER_ENABLED\) return;/);
});

test("client logging is gated off on NEXT_PUBLIC_VERCEL_ENV production and only runs in the browser", () => {
  const code = strip(read("src/lib/perf-debug/calendar-timing.ts"));

  assert.match(code, /const CLIENT_ENABLED = process\.env\.NEXT_PUBLIC_VERCEL_ENV !== "production";/);
  assert.match(
    code,
    /export function perfLogClient\([\s\S]*?\{\s*if \(typeof window === "undefined" \|\| !CLIENT_ENABLED\) return;/
  );
});

test("logging functions only accept a label and a plain data object — no client for secrets/cookies", () => {
  const code = strip(read("src/lib/perf-debug/calendar-timing.ts"));

  assert.match(code, /export function perfLogServer\(label: string, data\?: Record<string, unknown>\): void/);
  assert.match(code, /export function perfLogClient\(label: string, data\?: Record<string, unknown>\): void/);
  assert.doesNotMatch(code, /cookie|token|secret|password/i);
});

test("get-range-capacity.ts and CalendarPageClient.tsx import the C4 helper and tag it temporary", () => {
  // Comment tags are the point of this check, so read the RAW source here —
  // not the comment-stripped version used by the other tests in this file.
  const rangeCapacityRaw = read("src/lib/capacity/get-range-capacity.ts");
  const clientRaw = read("src/app/calendar/CalendarPageClient.tsx");

  assert.match(rangeCapacityRaw, /from "@\/lib\/perf-debug\/calendar-timing"/);
  assert.match(clientRaw, /from "@\/lib\/perf-debug\/calendar-timing"/);
  // Every import line is tagged so the instrumentation is trivially greppable to remove.
  assert.match(rangeCapacityRaw, /calendar-timing";\s*\/\/ PERF-C4 temporary/);
  assert.match(clientRaw, /calendar-timing";\s*\/\/ PERF-C4 temporary/);
});
