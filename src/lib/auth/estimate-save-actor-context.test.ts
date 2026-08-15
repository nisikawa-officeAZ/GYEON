// EW-UI-5A1-B3-P0 — DI unit tests for the pure estimate-save actor context (no database).
// Run: node --import tsx --test src/lib/auth/estimate-save-actor-context.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  resolveEstimateSaveActorContext,
  type ActiveMembership,
  type ActiveMembershipsRead,
  type ActiveStaffRoleRead,
  type EstimateSaveActorContextReaders,
} from "./estimate-save-actor-context";

const USER = "u0000000-0000-0000-0000-000000000001";
const DEALER_A = "d0000000-0000-0000-0000-00000000000a";
const DEALER_B = "d0000000-0000-0000-0000-00000000000b";

const member = (dealer_id: string, role: string): ActiveMembership => ({ dealer_id, role });

/** Records every reader invocation so short-circuiting and tenant scoping are both observable. */
interface Trace {
  user: number;
  memberships: string[];
  staff: Array<{ userId: string; dealerId: string }>;
}

function makeReaders(over: {
  user?: string | null | (() => Promise<string | null>);
  memberships?: ActiveMembershipsRead | (() => Promise<ActiveMembershipsRead>);
  /** Staff rows keyed by dealer — asking for the wrong tenant would yield the wrong role. */
  staffByDealer?: Record<string, string | null>;
  staff?: ActiveStaffRoleRead | (() => Promise<ActiveStaffRoleRead>);
}): { readers: EstimateSaveActorContextReaders; trace: Trace } {
  const trace: Trace = { user: 0, memberships: [], staff: [] };
  const readers: EstimateSaveActorContextReaders = {
    getUserId: async () => {
      trace.user += 1;
      if (typeof over.user === "function") return over.user();
      return over.user === undefined ? USER : over.user;
    },
    getActiveMemberships: async (userId) => {
      trace.memberships.push(userId);
      const m = over.memberships;
      if (m === undefined) return { ok: true, rows: [member(DEALER_A, "staff")] };
      return typeof m === "function" ? m() : m;
    },
    getActiveStaffRole: async (userId, dealerId) => {
      trace.staff.push({ userId, dealerId });
      const s = over.staff;
      if (s !== undefined) return typeof s === "function" ? s() : s;
      if (over.staffByDealer) return { ok: true, role: over.staffByDealer[dealerId] ?? null };
      return { ok: true, role: null };
    },
  };
  return { readers, trace };
}

const resolve = (over: Parameters<typeof makeReaders>[0]) =>
  resolveEstimateSaveActorContext(makeReaders(over).readers);

// ── Trust boundary ───────────────────────────────────────────────────────────
test("resolver takes only readers (no user id / dealer id / role argument)", () => {
  assert.equal(resolveEstimateSaveActorContext.length, 1);
});

// ── 1. Unauthenticated ───────────────────────────────────────────────────────
test("no authenticated user → unauthenticated", async () => {
  assert.deepEqual(await resolve({ user: null }), { ok: false, reason: "unauthenticated" });
});
test("blank user id → unauthenticated (never a usable actor)", async () => {
  for (const u of ["", "   "]) {
    assert.deepEqual(await resolve({ user: u }), { ok: false, reason: "unauthenticated" });
  }
});
test("a thrown user lookup → unauthenticated (no session established)", async () => {
  const r = await resolve({ user: () => { throw new Error("boom"); } });
  assert.deepEqual(r, { ok: false, reason: "unauthenticated" });
});

// ── 2. Membership read failure ───────────────────────────────────────────────
test("membership query failure → membership-read-failed (never 'no memberships')", async () => {
  assert.deepEqual(await resolve({ memberships: { ok: false } }), {
    ok: false,
    reason: "membership-read-failed",
  });
});
test("a thrown membership read → membership-read-failed", async () => {
  const r = await resolve({ memberships: () => { throw new Error("boom"); } });
  assert.deepEqual(r, { ok: false, reason: "membership-read-failed" });
});

// ── 3/4/5. Membership cardinality decides the tenant ─────────────────────────
test("zero active memberships → no-active-membership", async () => {
  assert.deepEqual(await resolve({ memberships: { ok: true, rows: [] } }), {
    ok: false,
    reason: "no-active-membership",
  });
});

test("exactly one active membership → success with that exact tenant", async () => {
  const r = await resolve({ memberships: { ok: true, rows: [member(DEALER_A, "manager")] } });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual({ ...r.context }, { userId: USER, dealerId: DEALER_A, role: "manager" });
});

test("two active memberships → tenant-context-unavailable (never an arbitrary pick)", async () => {
  const r = await resolve({
    memberships: { ok: true, rows: [member(DEALER_A, "owner"), member(DEALER_B, "owner")] },
  });
  assert.deepEqual(r, { ok: false, reason: "tenant-context-unavailable" });
});

test("an ambiguous tenant is refused BEFORE any staff read runs", async () => {
  const { readers, trace } = makeReaders({
    memberships: { ok: true, rows: [member(DEALER_A, "owner"), member(DEALER_B, "staff")] },
  });
  await resolveEstimateSaveActorContext(readers);
  assert.equal(trace.staff.length, 0, "no tenant was chosen, so no role may be read");
});

test("a blank dealer id on the sole membership → tenant-context-unavailable", async () => {
  assert.deepEqual(await resolve({ memberships: { ok: true, rows: [member("  ", "owner")] } }), {
    ok: false,
    reason: "tenant-context-unavailable",
  });
});

// ── 6. Staff read failure never falls back ───────────────────────────────────
test("staff read failure → staff-read-failed; the membership role is NOT used", async () => {
  const r = await resolve({
    memberships: { ok: true, rows: [member(DEALER_A, "owner")] }, // an editing role…
    staff: { ok: false },                                          // …but the read failed
  });
  assert.deepEqual(r, { ok: false, reason: "staff-read-failed" }, "an error is not an authorization decision");
  assert.equal("context" in r, false, "a failure carries no context");
});

test("a thrown staff read → staff-read-failed (no silent fallback)", async () => {
  const r = await resolve({
    memberships: { ok: true, rows: [member(DEALER_A, "owner")] },
    staff: () => { throw new Error("relation does not exist"); },
  });
  assert.deepEqual(r, { ok: false, reason: "staff-read-failed" });
});

// ── 7/8. Role source precedence within the ONE selected tenant ───────────────
test("no active staff row → the SAME membership row's role is used", async () => {
  const r = await resolve({
    memberships: { ok: true, rows: [member(DEALER_A, "manager")] },
    staff: { ok: true, role: null },
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.context.role, "manager");
  assert.equal(r.context.dealerId, DEALER_A);
});

test("an active staff role OVERRIDES the same dealer's membership role", async () => {
  const r = await resolve({
    memberships: { ok: true, rows: [member(DEALER_A, "readonly")] }, // membership says readonly
    staff: { ok: true, role: "owner" },                              // dealer_staff says owner
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.context.role, "owner", "dealer_staff is primary for the resolved tenant");
});

test("an active staff role can also DEMOTE below the membership role", async () => {
  const r = await resolve({
    memberships: { ok: true, rows: [member(DEALER_A, "owner")] },
    staff: { ok: true, role: "readonly" },
  });
  assert.deepEqual(r, { ok: false, reason: "permission-denied" }, "the primary source wins in both directions");
});

// ── 9. Least privilege / editing capability ──────────────────────────────────
test("readonly cannot edit → permission-denied", async () => {
  const r = await resolve({ memberships: { ok: true, rows: [member(DEALER_A, "readonly")] } });
  assert.deepEqual(r, { ok: false, reason: "permission-denied" });
});

test("an unknown/legacy/wrong-typed role is least-privileged, never coerced to an editing role", async () => {
  for (const bad of ["admin", "OWNER", " owner ", "", "superuser", "1"]) {
    const r = await resolve({
      memberships: { ok: true, rows: [member(DEALER_A, bad)] },
      staff: { ok: true, role: null },
    });
    assert.deepEqual(r, { ok: false, reason: "permission-denied" }, `membership role ${JSON.stringify(bad)} must not edit`);
    const s = await resolve({
      memberships: { ok: true, rows: [member(DEALER_A, "owner")] },
      staff: { ok: true, role: bad },
    });
    assert.deepEqual(s, { ok: false, reason: "permission-denied" }, `staff role ${JSON.stringify(bad)} must not edit`);
  }
});

test("every editing role succeeds; only readonly is denied", async () => {
  for (const role of ["owner", "manager", "staff"] as const) {
    const r = await resolve({ memberships: { ok: true, rows: [member(DEALER_A, role)] } });
    assert.equal(r.ok, true, `${role} may edit`);
    if (r.ok) assert.equal(r.context.role, role);
  }
});

// ── 10. ONE coherent tenant: role and dealerId share a single membership ─────
test("the staff read is scoped to the resolved user AND the resolved dealer", async () => {
  const { readers, trace } = makeReaders({
    memberships: { ok: true, rows: [member(DEALER_A, "staff")] },
  });
  const r = await resolveEstimateSaveActorContext(readers);
  assert.equal(r.ok, true);
  assert.equal(trace.user, 1, "the user is resolved exactly once");
  assert.deepEqual(trace.memberships, [USER], "memberships read once, for that user");
  assert.deepEqual(trace.staff, [{ userId: USER, dealerId: DEALER_A }], "role read for that exact pair");
});

test("role and dealerId always come from the SAME selected membership", async () => {
  // dealer_staff holds a DIFFERENT role for each dealer. If the resolver ever read the role for a
  // tenant other than the one it selected, the returned role would be the other dealer's.
  const staffByDealer = { [DEALER_A]: "manager", [DEALER_B]: "owner" };
  for (const [dealerId, expected] of [[DEALER_A, "manager"], [DEALER_B, "owner"]] as const) {
    const { readers, trace } = makeReaders({
      memberships: { ok: true, rows: [member(dealerId, "staff")] },
      staffByDealer,
    });
    const r = await resolveEstimateSaveActorContext(readers);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.context.dealerId, dealerId, "the tenant is the selected membership's dealer");
    assert.equal(r.context.role, expected, "the role belongs to that same dealer");
    assert.deepEqual(trace.staff, [{ userId: USER, dealerId }], "no read for any other tenant");
  }
});

test("a success carries exactly userId + dealerId + role and nothing else", async () => {
  const r = await resolve({ memberships: { ok: true, rows: [member(DEALER_A, "owner")] } });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.context).sort(), ["dealerId", "role", "userId"]);
});

// ── 11. No downstream reader runs after a prior failure ──────────────────────
test("no downstream reader runs after a prior failure", async () => {
  const cases: Array<{ name: string; over: Parameters<typeof makeReaders>[0]; memberships: number; staff: number }> = [
    { name: "unauthenticated", over: { user: null }, memberships: 0, staff: 0 },
    { name: "thrown user read", over: { user: () => { throw new Error("x"); } }, memberships: 0, staff: 0 },
    { name: "membership read failed", over: { memberships: { ok: false } }, memberships: 1, staff: 0 },
    { name: "no active membership", over: { memberships: { ok: true, rows: [] } }, memberships: 1, staff: 0 },
    {
      name: "ambiguous tenant",
      over: { memberships: { ok: true, rows: [member(DEALER_A, "owner"), member(DEALER_B, "owner")] } },
      memberships: 1,
      staff: 0,
    },
  ];
  for (const c of cases) {
    const { readers, trace } = makeReaders(c.over);
    const r = await resolveEstimateSaveActorContext(readers);
    assert.equal(r.ok, false, `${c.name} must fail`);
    assert.equal(trace.memberships.length, c.memberships, `${c.name}: membership reads`);
    assert.equal(trace.staff.length, c.staff, `${c.name}: staff reads`);
  }
});

test("each reader runs at most once on the success path", async () => {
  const { readers, trace } = makeReaders({});
  const r = await resolveEstimateSaveActorContext(readers);
  assert.equal(r.ok, true);
  assert.equal(trace.user, 1);
  assert.equal(trace.memberships.length, 1);
  assert.equal(trace.staff.length, 1);
});

// ── 12. Determinism ──────────────────────────────────────────────────────────
test("equivalent inputs are deterministic (same result every time, success and failure)", async () => {
  const scenarios: Parameters<typeof makeReaders>[0][] = [
    {},
    { user: null },
    { memberships: { ok: false } },
    { memberships: { ok: true, rows: [] } },
    { memberships: { ok: true, rows: [member(DEALER_A, "owner"), member(DEALER_B, "owner")] } },
    { memberships: { ok: true, rows: [member(DEALER_A, "readonly")] } },
    { memberships: { ok: true, rows: [member(DEALER_A, "owner")] }, staff: { ok: false } },
    { memberships: { ok: true, rows: [member(DEALER_A, "staff")] }, staff: { ok: true, role: "manager" } },
  ];
  for (const over of scenarios) {
    const runs = await Promise.all([resolve(over), resolve(over), resolve(over)]);
    const shape = (r: (typeof runs)[number]) => (r.ok ? { ok: true, ...r.context } : { ...r });
    assert.deepEqual(shape(runs[1]), shape(runs[0]), `deterministic: ${JSON.stringify(over)}`);
    assert.deepEqual(shape(runs[2]), shape(runs[0]), `deterministic: ${JSON.stringify(over)}`);
  }
});

// ── 13. Source guard on the server wrapper ───────────────────────────────────
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const WRAPPER_SRC = "src/lib/auth/resolve-estimate-save-actor-context.ts";

test("the server wrapper is server-only and wires the pure core", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /^\s*import\s+["']server-only["']/, "must begin with import \"server-only\"");
  assert.match(code, /resolveEstimateSaveActorContext\s*\(/, "delegates every decision to the pure core");
  assert.match(code, /getCurrentUser\s*\(\s*\)/, "resolves the user through getCurrentUser");
  assert.equal((code.match(/getCurrentUser\s*\(\s*\)/g) ?? []).length, 1, "exactly one user resolution");
  assert.match(code, /createClient\s*\(\s*\)/, "uses the normal authenticated client");
});

test("the server wrapper imports NO legacy fail-open helper", () => {
  const code = codeOf(WRAPPER_SRC);
  for (const forbidden of ["getCurrentDealer", "getCurrentStaff", "requireStaffCapability", "hasStaffCapability"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`).test(code), false, `must not reference ${forbidden}`);
  }
});

test("the server wrapper uses no service-role/secret/admin client", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.equal(/service_role|SERVICE_ROLE|serviceRole/.test(code), false, "no service-role client");
  assert.equal(/SUPABASE_SERVICE|SECRET_KEY|createAdminClient/.test(code), false, "no secret/admin client");
});

test("the server wrapper never authorizes from JWT claim bags", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.equal(/user_metadata|app_metadata/.test(code), false, "user-writable claims are not authorization");
});

test("the server wrapper reads every active membership with no arbitrary row limit", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /from\(\s*["']dealer_members["']\s*\)/, "reads dealer_members");
  assert.match(code, /eq\(\s*["']status["']\s*,\s*["']active["']\s*\)/, "active rows only");
  assert.equal(/\.limit\s*\(/.test(code), false, "no limit() arbitrary tenant selection");
  assert.equal(/\.single\s*\(/.test(code), false, "no single() collapse of an ambiguous tenant");
});

test("the server wrapper scopes the staff read by BOTH the user and the exact dealer", () => {
  const code = codeOf(WRAPPER_SRC);
  assert.match(code, /from\(\s*["']dealer_staff["']\s*\)/, "reads dealer_staff");
  assert.match(code, /eq\(\s*["']user_id["']\s*,\s*userId\s*\)/, "scoped by the resolved user id");
  assert.match(code, /eq\(\s*["']dealer_id["']\s*,\s*dealerId\s*\)/, "scoped by the resolved dealer id");
});

test("the pure core imports nothing server-only", () => {
  const code = codeOf("src/lib/auth/estimate-save-actor-context.ts");
  assert.equal(/server-only/.test(code), false, "the core must stay unit-testable");
  assert.equal(/@\/lib\/supabase/.test(code), false, "no Supabase in the pure core");
  assert.equal(/createClient/.test(code), false, "no client construction in the pure core");
});
