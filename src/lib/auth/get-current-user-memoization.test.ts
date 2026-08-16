import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HELPERS = [
  { path: "src/lib/auth/get-current-user.ts", exportName: "getCurrentUser", cachedName: "getCurrentUserCached" },
  { path: "src/lib/auth/get-current-dealer.ts", exportName: "getCurrentDealer", cachedName: "getCurrentDealerCached" },
  { path: "src/lib/admin/get-current-admin.ts", exportName: "getCurrentAdmin", cachedName: "getCurrentAdminCached" },
  { path: "src/lib/staff/get-current-staff.ts", exportName: "getCurrentStaff", cachedName: "getCurrentStaffCached" },
];

test("all four helpers use a stable module-scope cache() inner function", () => {
  for (const h of HELPERS) {
    const src = readFileSync(h.path, "utf8");
    assert.match(src, /import\s*\{\s*cache\s*\}\s*from\s*["']react["']/, `${h.path}: missing cache import`);
    assert.match(
      src,
      new RegExp(`const\\s+${h.cachedName}\\s*=\\s*cache\\(`),
      `${h.path}: missing module-scope ${h.cachedName}`
    );
    assert.match(
      src,
      new RegExp(`export\\s+async\\s+function\\s+${h.exportName}\\s*\\(`),
      `${h.path}: exported async wrapper missing/renamed`
    );

    const bodyMatch = src.match(new RegExp(`export\\s+async\\s+function\\s+${h.exportName}[\\s\\S]*?\\n\\}`));
    assert.ok(bodyMatch, `${h.path}: exported function body not found`);
    assert.doesNotMatch(
      bodyMatch[0],
      /cache\(/,
      `${h.path}: cache() must not be constructed inside the exported function`
    );
  }
});

test("dealer helper preserves the tenant active-status filter", () => {
  const src = readFileSync("src/lib/auth/get-current-dealer.ts", "utf8");
  assert.match(src, /\.eq\(\s*"status",\s*"active"\s*\)/);
});

test("admin helper preserves the admin active-status filter", () => {
  const src = readFileSync("src/lib/admin/get-current-admin.ts", "utf8");
  assert.match(src, /\.eq\(\s*"status",\s*"active"\s*\)/);
});

test("staff helper preserves fail-closed authorization resolution", () => {
  const src = readFileSync("src/lib/staff/get-current-staff.ts", "utf8");
  assert.match(src, /resolveStaffAuthorization/);
  assert.match(src, /catch\s*(\([^)]*\))?\s*\{\s*return null;?\s*\}/);
});
