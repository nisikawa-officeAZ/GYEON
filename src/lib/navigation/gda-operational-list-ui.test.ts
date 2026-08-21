import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GDA_UI_OPERATIONAL_LIST_S4 — source-contract guard.
//
// The customers/vehicles list pages must share one presentational primitive
// (GdaOperationalListSurface) instead of accumulating page-specific Tailwind
// copies, must keep filters as visible chip controls (never dropdowns), must
// not reintroduce the pre-S4 white/admin-template palette, and must ship a
// mobile stacked-record fallback with a 44px minimum tap target. This test
// reads source files as text and asserts those invariants; it does not
// render React and does not touch business data, permissions, or routes.

const ROOT = process.cwd();
const read = (relPath: string) => readFileSync(join(ROOT, relPath), "utf8");

const SURFACE = read("src/components/ui/GdaOperationalListSurface.tsx");

const CUSTOMERS_CLIENT  = read("src/components/customers/CustomersClient.tsx");
const CUSTOMER_SEARCH   = read("src/components/customers/CustomerSearch.tsx");
const CUSTOMER_FILTERS  = read("src/components/customers/CustomerFilters.tsx");
const CUSTOMER_TABLE    = read("src/components/customers/CustomerTable.tsx");

const VEHICLES_CLIENT = read("src/components/vehicles/VehiclesClient.tsx");
const VEHICLE_SEARCH  = read("src/components/vehicles/VehicleSearch.tsx");
const VEHICLE_FILTERS = read("src/components/vehicles/VehicleFilters.tsx");
const VEHICLE_TABLE   = read("src/components/vehicles/VehicleTable.tsx");

test("GdaOperationalListSurface is presentational only: no data fetch, no Supabase, no permission import", () => {
  assert.doesNotMatch(SURFACE, /supabase/i);
  assert.doesNotMatch(SURFACE, /useCurrentStaff/);
  assert.doesNotMatch(SURFACE, /canEdit/);
  assert.doesNotMatch(SURFACE, /fetch\(/);
});

test("GdaOperationalListSurface exposes the shared shell, action button, and approved empty-state pattern", () => {
  assert.match(SURFACE, /export default function GdaOperationalListSurface/);
  assert.match(SURFACE, /export function GdaOperationalListActionButton/);
  assert.match(SURFACE, /export function GdaOperationalListEmptyState/);
  // 64px line-icon box (h-16 w-16 = 64px in the Tailwind default scale).
  assert.match(SURFACE, /h-16 w-16/);
});

test("both list clients mount the shared GdaOperationalListSurface primitive", () => {
  for (const src of [CUSTOMERS_CLIENT, VEHICLES_CLIENT]) {
    assert.match(src, /from "@\/components\/ui\/GdaOperationalListSurface"/);
    assert.match(src, /<GdaOperationalListSurface/);
  }
});

test("both list tables consume the shared empty-state pattern instead of an inline ad-hoc one", () => {
  for (const src of [CUSTOMER_TABLE, VEHICLE_TABLE]) {
    assert.match(src, /GdaOperationalListEmptyState/);
  }
});

test("filter choices remain visible button/chip controls, never dropdowns", () => {
  for (const src of [CUSTOMER_FILTERS, VEHICLE_FILTERS]) {
    assert.doesNotMatch(src, /<select/i);
    assert.match(src, /aria-pressed=\{active\}/);
  }
});

test("mobile stacked-record fallback exists for both tables with a 44px minimum tap target", () => {
  for (const src of [CUSTOMER_TABLE, VEHICLE_TABLE]) {
    assert.match(src, /md:hidden/);
    assert.match(src, /hidden md:block/);
    assert.match(src, /min-h-\[44px\]/);
  }
});

test("desktop table containment prevents page overflow (overflow-x-auto retained)", () => {
  for (const src of [CUSTOMER_TABLE, VEHICLE_TABLE]) {
    assert.match(src, /overflow-x-auto/);
  }
});

test("no white/admin-template background classes were reintroduced on the converted surfaces", () => {
  const FORBIDDEN = /bg-white|bg-slate-50|bg-slate-100|bg-gray-100/;
  for (const src of [
    SURFACE,
    CUSTOMERS_CLIENT, CUSTOMER_SEARCH, CUSTOMER_FILTERS, CUSTOMER_TABLE,
    VEHICLES_CLIENT, VEHICLE_SEARCH, VEHICLE_FILTERS, VEHICLE_TABLE,
  ]) {
    assert.doesNotMatch(src, FORBIDDEN);
  }
});

test("every current data fetch, filter rule, permission gate, and route destination is preserved in CustomersClient", () => {
  assert.match(CUSTOMERS_CLIENT, /function matchesCustomer\(/);
  assert.match(CUSTOMERS_CLIENT, /useCurrentStaff/);
  assert.match(CUSTOMERS_CLIENT, /canEdit/);
  assert.match(CUSTOMERS_CLIENT, /router\.push\(`\/estimates\?customer_id=\$\{customer\.id\}`\)/);
  assert.match(CUSTOMERS_CLIENT, /router\.push\(`\/customers\/\$\{customer\.id\}`\)/);
  assert.match(CUSTOMERS_CLIENT, /<CustomerForm/);
  assert.match(CUSTOMERS_CLIENT, /<CustomerActivityTimeline/);
});

test("every current data fetch, filter rule, and route destination is preserved in VehiclesClient", () => {
  assert.match(VEHICLES_CLIENT, /function matchesVehicle\(/);
  assert.match(VEHICLES_CLIENT, /deriveVehicleStatus/);
  assert.match(VEHICLES_CLIENT, /router\.push\(`\/vehicles\/\$\{vehicle\.id\}`\)/);
  assert.match(VEHICLES_CLIENT, /<VehicleForm/);
});

test("CustomerForm and VehicleForm internals are not touched by this phase (not imported/edited outside the modal wiring)", () => {
  // S4 must not modify CustomerForm.tsx / VehicleForm.tsx; this guard simply
  // confirms the two clients still reference the same, unmodified form
  // components rather than a S4-introduced replacement.
  assert.match(CUSTOMERS_CLIENT, /import CustomerForm\s+from "@\/components\/customers\/CustomerForm"/);
  assert.match(VEHICLES_CLIENT, /import VehicleForm\s+from "@\/components\/vehicles\/VehicleForm"/);
});

test("protected ScreensPreview.tsx path is never referenced by the S4 surfaces", () => {
  for (const src of [
    SURFACE,
    CUSTOMERS_CLIENT, CUSTOMER_SEARCH, CUSTOMER_FILTERS, CUSTOMER_TABLE,
    VEHICLES_CLIENT, VEHICLE_SEARCH, VEHICLE_FILTERS, VEHICLE_TABLE,
  ]) {
    assert.doesNotMatch(src, /ScreensPreview/);
  }
});
