// Regression contract for the /no-dealer recheck convergence.
//
// Run: node --import tsx --test src/lib/auth/no-dealer-recheck.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = "src/app/no-dealer/page.tsx";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("active membership recheck converges to the guarded dashboard", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const userAt = code.indexOf("await getCurrentUser()");
  const activeAt = code.indexOf('.eq("status", "active")');
  const dashboardAt = code.indexOf('if (activeMembership) redirect("/dashboard")');
  const onboardingAt = code.indexOf("if (isGyeonPartnerOnboardingEnabled())");
  const suspendedAt = code.indexOf('.eq("status", "suspended")');

  assert.ok(userAt >= 0 && activeAt >= 0 && dashboardAt >= 0);
  assert.ok(userAt < activeAt, "session identity must be resolved before membership lookup");
  assert.ok(activeAt < dashboardAt, "only an active membership may trigger dashboard convergence");
  assert.ok(dashboardAt < onboardingAt, "already-active members bypass claim processing");
  assert.ok(dashboardAt < suspendedAt, "active convergence precedes suspended-state rendering");
});

test("recheck lookup remains user-bound and fail-closed", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(
    code,
    /\.from\("dealer_members"\)[\s\S]*?\.eq\("user_id", user\.id\)[\s\S]*?\.eq\("status", "active"\)[\s\S]*?\.limit\(1\)[\s\S]*?\.maybeSingle\(\)/,
  );
  assert.equal(code.includes("service_role"), false);
  assert.equal(code.includes("createAdminClient().from(\"dealer_members\")"), false);
});
