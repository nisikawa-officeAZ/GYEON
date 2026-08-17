// GLOBAL_NAV_PERF_C2 regression contract: MainLayout resolves staff once,
// server-side, and StaffProvider must not refetch it on every navigation
// when that resolved state is supplied.
//
// Run: node --import tsx --test src/contexts/staff-context-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("MainLayout resolves getCurrentStaff() after the dealer gate and passes it down", () => {
  const code = strip(read("src/components/layout/MainLayout.tsx"));
  const gateAt = code.indexOf("await requireActiveDealer()");
  const staffAt = code.indexOf("const staff = await getCurrentStaff()", gateAt);
  const passAt = code.indexOf("initialStaff={staff}", staffAt);

  assert.ok(gateAt >= 0, "the active-dealer gate must remain");
  assert.ok(staffAt > gateAt, "staff is resolved only after the dealer gate settles");
  assert.ok(passAt > staffAt, "the resolved staff must be passed into MainLayoutClient");
});

test("MainLayoutClient forwards initialStaff into StaffProvider", () => {
  const code = strip(read("src/components/layout/MainLayoutClient.tsx"));

  assert.match(code, /initialStaff\??:\s*InitialStaff/);
  assert.match(code, /<StaffProvider initialStaff=\{initialStaff\}>/);
});

test("StaffProvider uses supplied initial staff without an effect-triggered refetch", () => {
  const code = strip(read("src/contexts/StaffContext.tsx"));
  const providerAt = code.indexOf("export function StaffProvider(");
  const hasInitialAt = code.indexOf("const hasInitialStaff = initialStaff !== undefined;", providerAt);
  const stateAt = code.indexOf("useState<StaffContextValue>(() =>", providerAt);
  const effectAt = code.indexOf("useEffect(() => {", providerAt);
  const guardAt = code.indexOf("if (hasInitialStaff) return;", effectAt);
  const fetchAt = code.indexOf("getCurrentStaff().then(", effectAt);

  assert.ok(providerAt >= 0);
  assert.ok(hasInitialAt > providerAt, "must detect whether the caller already resolved staff");
  assert.ok(stateAt > hasInitialAt, "initial state must be derivable from the supplied prop, not always unloaded");
  assert.ok(
    guardAt > effectAt && fetchAt > guardAt,
    "the effect must bail out before fetching when initial staff was already supplied"
  );
});

test("StaffProvider fetch fallback and initial derivation share the same role-to-permissions mapping", () => {
  const code = strip(read("src/contexts/StaffContext.tsx"));

  assert.match(code, /function deriveStaffContextValue\(staff: InitialStaff\): StaffContextValue/);
  const deriveCount = (code.match(/deriveStaffContextValue\(/g) || []).length;
  // 1 definition + 2 call sites (initial useState lazy-init, and the effect fallback)
  assert.equal(deriveCount, 3, "both the initial-state path and the fallback fetch path must reuse the same derivation");
});
