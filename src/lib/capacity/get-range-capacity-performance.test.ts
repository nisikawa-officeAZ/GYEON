// CALENDAR_PERF_C3 regression contract: getRangeCapacity() must skip its
// businessHours/bayOptions/staffOptions fetches when the caller already
// supplies them, while getServiceDurations()/getStaffCapacitySettings() and
// the reservations range fetch stay unconditional.
//
// Run: node --import tsx --test src/lib/capacity/get-range-capacity-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("getRangeCapacity accepts an optional overrides parameter", () => {
  const code = strip(read("src/lib/capacity/get-range-capacity.ts"));

  assert.match(
    code,
    /export interface GetRangeCapacityOverrides \{[\s\S]*?businessHours\?: BusinessHoursSettings;[\s\S]*?bayOptions\?: WorkBayOption\[\];[\s\S]*?staffOptions\?: ReservationStaffOption\[\];[\s\S]*?\}/
  );
  assert.match(
    code,
    /export async function getRangeCapacity\(\s*from: string,\s*to: string,\s*overrides\?: GetRangeCapacityOverrides,\s*\)/
  );
});

test("businessHours/bayOptions/staffOptions are skipped when overrides supply them", () => {
  const code = strip(read("src/lib/capacity/get-range-capacity.ts"));
  const batchAt = code.indexOf("const [businessHours, durations, scheduling, bays, staffOpts] = await Promise.all([");

  assert.ok(batchAt >= 0);
  assert.match(code, /overrides\?\.businessHours \?\? getBusinessHoursSettings\(\)/);
  assert.match(code, /overrides\?\.bayOptions \?\? getBayOptions\(\)/);
  assert.match(code, /overrides\?\.staffOptions \?\? getReservationStaffOptions\(\)/);
});

test("getServiceDurations, getStaffCapacitySettings, and the reservations range fetch remain unconditional", () => {
  const code = strip(read("src/lib/capacity/get-range-capacity.ts"));

  // Called directly (optionally wrapped for PERF-C4 timing), never guarded
  // by `overrides?.` — always run.
  assert.match(code, /getServiceDurations\(\)/);
  assert.match(code, /getStaffCapacitySettings\(\)/);
  assert.doesNotMatch(code, /overrides\?\.\w*[Dd]urations/);
  assert.doesNotMatch(code, /overrides\?\.\w*[Ss]cheduling/);
  assert.match(code, /const reservations = \(await getReservationsByDateRange\(fetchFrom, end\)\)/);
});

test("getDayCapacity is untouched by the C3 overrides change", () => {
  const code = strip(read("src/lib/capacity/get-day-capacity.ts"));

  assert.doesNotMatch(code, /overrides/);
  assert.doesNotMatch(code, /GetRangeCapacityOverrides/);
});

test("page.tsx passes the raw staffOptions array down alongside staffNameById", () => {
  const code = strip(read("src/app/calendar/page.tsx"));
  const nameByIdAt = code.indexOf("staffNameById={staffNameById}");
  const rawAt = code.indexOf("staffOptions={staffOptions}", nameByIdAt);

  assert.ok(nameByIdAt >= 0);
  assert.ok(rawAt > nameByIdAt, "staffOptions must be passed as its own prop, not only derived into staffNameById");
});

test("CalendarPageClient forwards businessHours/bays/staffOptions into getRangeCapacity()", () => {
  const code = strip(read("src/app/calendar/CalendarPageClient.tsx"));

  assert.match(
    code,
    /await getRangeCapacity\(from, to, \{ businessHours, bayOptions: bays, staffOptions \}\)/
  );
  // Only one call site — day view's getDayCapacity() must remain untouched
  // (still single-argument; no overrides threaded through).
  assert.match(code, /await getDayCapacity\(date\)/);
});
