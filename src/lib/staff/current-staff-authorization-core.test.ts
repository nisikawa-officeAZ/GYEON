// DEALEROS-ESTIMATE-INVOICE-PDF-B1-R5 — staff authorization decision table.
//
// Run: node --import tsx --test src/lib/staff/current-staff-authorization-core.test.ts
//
// The executable half proves every row of the fail-closed decision table on
// the pure core. The structural half proves getCurrentStaff actually routes
// through that core: the dealer_staff query no longer filters inactive rows
// out of existence, a query failure no longer falls back, and the readonly
// coercion of unknown roles is gone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FINANCE_ROLES,
  RECOGNIZED_STAFF_ROLES,
  isFinanceRole,
  isRecognizedStaffRole,
  resolveStaffAuthorization,
  type DealerStaffQueryOutcome,
} from "./current-staff-authorization-core";

const row = (role: string, status: string): DealerStaffQueryOutcome => ({
  kind: "row",
  id: "staff-1",
  role,
  status,
});
const NO_ROW: DealerStaffQueryOutcome = { kind: "no-row" };
const QUERY_ERROR: DealerStaffQueryOutcome = { kind: "error" };
const ACTIVE_OWNER_FALLBACK = { role: "owner", status: "active" };

// ── Canonical dealer_staff rows ──────────────────────────────────────────────

test("1. an active owner dealer_staff row is authorized and finance-capable", () => {
  const decision = resolveStaffAuthorization(row("owner", "active"), null);
  assert.deepEqual(decision, {
    kind: "authorized",
    role: "owner",
    staffId: "staff-1",
    source: "dealer_staff",
  });
  assert.equal(isFinanceRole("owner"), true);
});

test("2. an active manager dealer_staff row is authorized and finance-capable", () => {
  const decision = resolveStaffAuthorization(row("manager", "active"), null);
  assert.equal(decision.kind, "authorized");
  assert.ok(decision.kind === "authorized" && decision.role === "manager");
  assert.equal(isFinanceRole("manager"), true);
});

test("3. active staff and readonly rows authorize an identity but NOT finance", () => {
  for (const role of ["staff", "readonly"] as const) {
    const decision = resolveStaffAuthorization(row(role, "active"), null);
    assert.equal(decision.kind, "authorized", `${role} is a valid identity`);
    assert.equal(isFinanceRole(role), false, `${role} must not write invoices`);
  }
});

test("4. an invited dealer_staff row denies even when dealer_members stays active", () => {
  const decision = resolveStaffAuthorization(row("owner", "invited"), ACTIVE_OWNER_FALLBACK);
  assert.deepEqual(decision, { kind: "denied" });
});

test("5. a disabled dealer_staff row denies even when dealer_members stays active", () => {
  const decision = resolveStaffAuthorization(row("owner", "disabled"), ACTIVE_OWNER_FALLBACK);
  assert.deepEqual(decision, { kind: "denied" });
});

test("6. an unknown dealer_staff status denies", () => {
  for (const status of ["", "ACTIVE", "pending", "suspended"]) {
    assert.deepEqual(
      resolveStaffAuthorization(row("owner", status), ACTIVE_OWNER_FALLBACK),
      { kind: "denied" },
      `status ${JSON.stringify(status)} must deny`
    );
  }
});

test("7. an unknown dealer_staff role denies instead of coercing to readonly", () => {
  for (const role of ["", "admin", "superuser", "OWNER"]) {
    assert.deepEqual(
      resolveStaffAuthorization(row(role, "active"), ACTIVE_OWNER_FALLBACK),
      { kind: "denied" },
      `role ${JSON.stringify(role)} must deny`
    );
  }
});

// ── The query-error row of the table ─────────────────────────────────────────

test("8. a dealer_staff query error fails closed and never falls back", () => {
  assert.deepEqual(resolveStaffAuthorization(QUERY_ERROR, ACTIVE_OWNER_FALLBACK), {
    kind: "denied",
  });
  assert.deepEqual(resolveStaffAuthorization(QUERY_ERROR, null), { kind: "denied" });
});

// ── Fallback: only when NO dealer_staff row exists ───────────────────────────

test("9. no row and no fallback membership denies", () => {
  assert.deepEqual(resolveStaffAuthorization(NO_ROW, null), { kind: "denied" });
});

test("10. fallback authorizes an active owner membership with a null staffId", () => {
  const decision = resolveStaffAuthorization(NO_ROW, ACTIVE_OWNER_FALLBACK);
  assert.deepEqual(decision, {
    kind: "authorized",
    role: "owner",
    staffId: null,
    source: "dealer_members",
  });
});

test("11. fallback authorizes an active manager membership as finance", () => {
  const decision = resolveStaffAuthorization(NO_ROW, { role: "manager", status: "active" });
  assert.equal(decision.kind, "authorized");
  assert.ok(decision.kind === "authorized" && isFinanceRole(decision.role));
});

test("12. fallback staff and readonly memberships are identities without finance", () => {
  for (const role of ["staff", "readonly"]) {
    const decision = resolveStaffAuthorization(NO_ROW, { role, status: "active" });
    assert.equal(decision.kind, "authorized");
    assert.ok(decision.kind === "authorized" && !isFinanceRole(decision.role));
  }
});

test("13. suspended and removed fallback memberships are denied", () => {
  for (const status of ["suspended", "removed", "invited", ""]) {
    assert.deepEqual(
      resolveStaffAuthorization(NO_ROW, { role: "owner", status }),
      { kind: "denied" },
      `fallback status ${JSON.stringify(status)} must deny`
    );
  }
});

test("14. an unrecognized fallback role is denied", () => {
  for (const role of ["", "admin", "OWNER"]) {
    assert.deepEqual(
      resolveStaffAuthorization(NO_ROW, { role, status: "active" }),
      { kind: "denied" },
      `fallback role ${JSON.stringify(role)} must deny`
    );
  }
});

// ── Role sets ────────────────────────────────────────────────────────────────

test("15. the finance roles are exactly owner and manager", () => {
  assert.deepEqual([...FINANCE_ROLES], ["owner", "manager"]);
  for (const role of FINANCE_ROLES) {
    assert.ok(isRecognizedStaffRole(role), "every finance role is recognized");
  }
});

test("16. the recognized role set matches the database constraint", () => {
  assert.deepEqual([...RECOGNIZED_STAFF_ROLES], ["owner", "manager", "staff", "readonly"]);
});

// ── Structural: getCurrentStaff routes through the core, fail-closed ─────────

const ROOT = process.cwd();

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const GET_STAFF = stripComments(
  readFileSync(join(ROOT, "src/lib/staff/get-current-staff.ts"), "utf8")
);
const CORE_SRC = stripComments(
  readFileSync(join(ROOT, "src/lib/staff/current-staff-authorization-core.ts"), "utf8")
);

test("17. the dealer_staff query no longer filters by status and reads it instead", () => {
  assert.ok(
    !/\.eq\("status"/.test(GET_STAFF),
    "an inactive row must be SEEN, not filtered out of existence"
  );
  assert.match(GET_STAFF, /\.select\("id, role, status"\)/);
  assert.match(GET_STAFF, /\.eq\("dealer_id", dealer\.dealer_id\)/);
  assert.match(GET_STAFF, /\.eq\("user_id", user\.id\)/);
  assert.match(GET_STAFF, /\.maybeSingle\(\)/);
});

test("18. every failure path resolves to the error outcome, never a fallback", () => {
  const errorAssignments = GET_STAFF.match(/staffQuery = \{ kind: "error" \}/g) ?? [];
  assert.equal(errorAssignments.length, 2, "both the error branch and the catch must deny");
  assert.ok(!/fallbackRole/.test(GET_STAFF), "the old fallback-on-error variable must be gone");
  assert.ok(
    !/\? .* : "readonly"/.test(GET_STAFF) && !/isValidRole/.test(GET_STAFF),
    "the readonly coercion of unknown roles must be gone"
  );
});

test("19. the decision is delegated to the shared core and denials return null", () => {
  assert.match(GET_STAFF, /resolveStaffAuthorization\(staffQuery, \{/);
  assert.match(GET_STAFF, /if \(decision\.kind !== "authorized"\) return null;/);
  assert.match(GET_STAFF, /return \{ role: decision\.role, staffId: decision\.staffId \};/);
});

test("20. the core stays pure: type-only imports and no I/O", () => {
  const runtimeImports = (CORE_SRC.match(/^import\s(?!type\s)/gm) ?? []).filter(
    (line) => !/^import\s+type/.test(line)
  );
  assert.equal(runtimeImports.length, 0, "only `import type` is allowed in the core");
  for (const forbidden of ["@supabase", "process.env", "fetch(", "createClient", "server"]) {
    assert.ok(!CORE_SRC.includes(forbidden), `the core must not reference ${forbidden}`);
  }
});
