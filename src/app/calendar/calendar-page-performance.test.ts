// PERF-C1 regression contract for calendar page SSR parallelism.
//
// Run: node --import tsx --test src/app/calendar/calendar-page-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("calendar page starts its five independent SSR reads together", () => {
  const code = strip(read("src/app/calendar/page.tsx"));
  const parallelAt = code.indexOf(
    "const [reservations, dealer, supabase, businessHours, staffOptions, bayOptions] ="
  );
  const reservationsAt = code.indexOf("getReservationsByDateRange(", parallelAt);
  const dealerAt = code.indexOf("getCurrentDealer(),", parallelAt);
  const clientAt = code.indexOf("createClient(),", parallelAt);
  const hoursAt = code.indexOf("getBusinessHoursSettings(),", parallelAt);
  const staffAt = code.indexOf("getReservationStaffOptions(),", parallelAt);
  const bayAt = code.indexOf("getBayOptions(),", parallelAt);
  const custVehParallelAt = code.indexOf("const [custResult, vehResult] = await Promise.all([");

  assert.ok(parallelAt >= 0, "the five reads must be started via a single Promise.all");
  assert.ok(
    reservationsAt > parallelAt &&
      dealerAt > reservationsAt &&
      clientAt > dealerAt &&
      hoursAt > clientAt &&
      staffAt > hoursAt &&
      bayAt > staffAt,
    "reservations, dealer, supabase client, business hours, staff options, and bay options must all be inside the same Promise.all"
  );
  assert.ok(
    custVehParallelAt > bayAt,
    "the customers/vehicles read stays a separate, later Promise.all gated on dealer"
  );
});

test("calendar page keeps dealer-gated customers/vehicles reads unchanged", () => {
  const code = strip(read("src/app/calendar/page.tsx"));

  assert.match(code, /if \(dealer\) \{[\s\S]*?const \[custResult, vehResult\] = await Promise\.all\(\[/);
  assert.match(code, /customers = \(custResult\.data \?\? \[\]\) as typeof customers;/);
  assert.match(code, /vehicles\s+= \(vehResult\.data\s+\?\? \[\]\) as typeof vehicles;/);
});
