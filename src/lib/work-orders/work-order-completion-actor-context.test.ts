// GDA-1W-C3 — Pure tests for work-order-completion-actor-context.ts.
//
// Plain `node:test` + `node:assert/strict` (run with `node --import tsx --test <file>`); every
// reader is an in-memory stub, so the §5.3 precedence, the blocking-row no-fallback rule, and the
// fail-closed read-failure handling are proven without any server import.
//
// Reader stubs additionally RECORD invocation, so the short-circuit claims ("a staff decision
// never consults members or owner", "a failure never reads further") are asserted, not assumed.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  resolveWorkOrderCompletionActor,
  type ActiveMemberRoleRead,
  type DealerOwnerRead,
  type DealerStaffRead,
  type DealerStaffRow,
  type WorkOrderCompletionActorReaders,
} from "./work-order-completion-actor-context";

const USER = "11111111-1111-4111-8111-111111111111";
const DEALER = "22222222-2222-4222-8222-222222222222";

interface StubCalls {
  staff: Array<{ userId: string; dealerId: string }>;
  member: Array<{ userId: string; dealerId: string }>;
  owner: Array<{ userId: string; dealerId: string }>;
}

/**
 * Build readers from plain results. A result may also be the literal "throw" to make that reader
 * reject, proving thrown readers map to their own fail-closed reason.
 */
function makeReaders(config: {
  userId?: string | null | "throw";
  staff?: DealerStaffRead | "throw";
  member?: ActiveMemberRoleRead | "throw";
  owner?: DealerOwnerRead | "throw";
}): { readers: WorkOrderCompletionActorReaders; calls: StubCalls } {
  const calls: StubCalls = { staff: [], member: [], owner: [] };
  const readers: WorkOrderCompletionActorReaders = {
    getUserId: async () => {
      if (config.userId === "throw") throw new Error("auth boom");
      return config.userId === undefined ? USER : config.userId;
    },
    getDealerStaffRows: async (userId, dealerId) => {
      calls.staff.push({ userId, dealerId });
      if (config.staff === "throw") throw new Error("staff boom");
      return config.staff ?? { ok: true, rows: [] };
    },
    getActiveMemberRole: async (userId, dealerId) => {
      calls.member.push({ userId, dealerId });
      if (config.member === "throw") throw new Error("member boom");
      return config.member ?? { ok: true, role: null };
    },
    getIsDealerOwner: async (userId, dealerId) => {
      calls.owner.push({ userId, dealerId });
      if (config.owner === "throw") throw new Error("owner boom");
      return config.owner ?? { ok: true, isOwner: false };
    },
  };
  return { readers, calls };
}

const staffRows = (...rows: DealerStaffRow[]): DealerStaffRead => ({ ok: true, rows });

// ─── Authentication ─────────────────────────────────────────────────────────────

describe("authentication", () => {
  it("denies a null, empty, and whitespace user id without reading anything else", async () => {
    for (const userId of [null, "", "   "] as const) {
      const { readers, calls } = makeReaders({ userId });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.deepEqual(result, { ok: false, reason: "unauthenticated" });
      assert.equal(calls.staff.length, 0);
      assert.equal(calls.member.length, 0);
      assert.equal(calls.owner.length, 0);
    }
  });

  it("treats a thrown user lookup as unauthenticated", async () => {
    const { readers } = makeReaders({ userId: "throw" });
    assert.deepEqual(await resolveWorkOrderCompletionActor(DEALER, readers), {
      ok: false,
      reason: "unauthenticated",
    });
  });

  it("denies an unusable dealer id after authentication, before any read", async () => {
    const { readers, calls } = makeReaders({});
    const result = await resolveWorkOrderCompletionActor("  ", readers);
    assert.deepEqual(result, { ok: false, reason: "permission-denied" });
    assert.equal(calls.staff.length, 0);
  });
});

// ─── dealer_staff primary: allow ────────────────────────────────────────────────

describe("dealer_staff authorizes", () => {
  it("grants each of owner, manager, staff from one active row, and never reads further", async () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      const { readers, calls } = makeReaders({ staff: staffRows({ status: "active", role }) });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.context.userId, USER);
        assert.equal(result.context.dealerId, DEALER);
        assert.equal(result.context.role, role);
        assert.equal(result.context.source, "dealer_staff");
      }
      // Short-circuit: a staff decision consults neither members nor owner.
      assert.equal(calls.member.length, 0);
      assert.equal(calls.owner.length, 0);
      // The staff read is scoped to the exact pair.
      assert.deepEqual(calls.staff, [{ userId: USER, dealerId: DEALER }]);
    }
  });
});

// ─── dealer_staff blocking rows: deny, NEVER fall back ─────────────────────────

describe("dealer_staff blocking states", () => {
  // Every case pairs the blocking row with readers that WOULD authorize via fallback
  // (active owner membership AND dealer owner), proving the row truly blocks both paths.
  const wouldAuthorizeFallbacks = {
    member: { ok: true, role: "owner" } as ActiveMemberRoleRead,
    owner: { ok: true, isOwner: true } as DealerOwnerRead,
  };

  const blockingRows: ReadonlyArray<[string, DealerStaffRead]> = [
    ["disabled status", staffRows({ status: "disabled", role: "owner" })],
    ["invited status", staffRows({ status: "invited", role: "manager" })],
    ["unknown status literal", staffRows({ status: "ACTIVE", role: "staff" })],
    ["whitespace-padded status", staffRows({ status: " active", role: "staff" })],
    ["readonly role", staffRows({ status: "active", role: "readonly" })],
    ["unknown role literal", staffRows({ status: "active", role: "admin" })],
    ["cased role literal", staffRows({ status: "active", role: "Owner" })],
    ["whitespace-padded role", staffRows({ status: "active", role: "staff " })],
    ["empty role", staffRows({ status: "active", role: "" })],
    [
      "duplicate rows, even both active/editing",
      staffRows({ status: "active", role: "owner" }, { status: "active", role: "staff" }),
    ],
    [
      "duplicate rows with one blocking",
      staffRows({ status: "active", role: "staff" }, { status: "disabled", role: "staff" }),
    ],
  ];

  for (const [name, staff] of blockingRows) {
    it(`denies staff-blocked for ${name} and does not fall back`, async () => {
      const { readers, calls } = makeReaders({ staff, ...wouldAuthorizeFallbacks });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.deepEqual(result, { ok: false, reason: "staff-blocked" });
      // THE core rule: an existing staff row forbids every fallback read.
      assert.equal(calls.member.length, 0);
      assert.equal(calls.owner.length, 0);
    });
  }
});

// ─── dealer_members fallback (no staff row) ─────────────────────────────────────

describe("dealer_members fallback", () => {
  it("grants each editing role when no staff row exists, without reading the owner", async () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      const { readers, calls } = makeReaders({
        staff: staffRows(),
        member: { ok: true, role },
      });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.context.role, role);
        assert.equal(result.context.source, "dealer_members");
      }
      assert.equal(calls.owner.length, 0);
      assert.deepEqual(calls.member, [{ userId: USER, dealerId: DEALER }]);
    }
  });

  it("does not authorize readonly, unknown, cased, padded, or empty member roles", async () => {
    for (const role of ["readonly", "admin", "Owner", " staff", "staff ", ""]) {
      const { readers, calls } = makeReaders({
        staff: staffRows(),
        member: { ok: true, role },
        owner: { ok: true, isOwner: false },
      });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.deepEqual(result, { ok: false, reason: "permission-denied" });
      // A non-authorizing membership is not a BLOCK: the owner bootstrap was still consulted.
      assert.equal(calls.owner.length, 1);
    }
  });
});

// ─── dealers.owner_user_id bootstrap ────────────────────────────────────────────

describe("dealer owner bootstrap", () => {
  it("grants owner when no staff row and no active membership exist", async () => {
    const { readers } = makeReaders({
      staff: staffRows(),
      member: { ok: true, role: null },
      owner: { ok: true, isOwner: true },
    });
    const result = await resolveWorkOrderCompletionActor(DEALER, readers);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.context.role, "owner");
      assert.equal(result.context.source, "dealer_owner");
    }
  });

  it("grants owner past a readonly membership — only dealer_staff blocks the bootstrap", async () => {
    const { readers } = makeReaders({
      staff: staffRows(),
      member: { ok: true, role: "readonly" },
      owner: { ok: true, isOwner: true },
    });
    const result = await resolveWorkOrderCompletionActor(DEALER, readers);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.context.source, "dealer_owner");
  });

  it("denies permission when the user is not the owner and nothing else authorized", async () => {
    const { readers } = makeReaders({
      staff: staffRows(),
      member: { ok: true, role: null },
      owner: { ok: true, isOwner: false },
    });
    assert.deepEqual(await resolveWorkOrderCompletionActor(DEALER, readers), {
      ok: false,
      reason: "permission-denied",
    });
  });
});

// ─── Reader failures: fail-closed, own reason, no fallthrough ──────────────────

describe("reader failures", () => {
  it("maps a failed and a thrown staff read to staff-read-failed and reads nothing further", async () => {
    for (const staff of [{ ok: false } as DealerStaffRead, "throw" as const]) {
      const { readers, calls } = makeReaders({
        staff,
        member: { ok: true, role: "owner" },
        owner: { ok: true, isOwner: true },
      });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.deepEqual(result, { ok: false, reason: "staff-read-failed" });
      // A read ERROR is not "no staff row": the would-authorize fallbacks were never consulted.
      assert.equal(calls.member.length, 0);
      assert.equal(calls.owner.length, 0);
    }
  });

  it("maps a failed and a thrown member read to member-read-failed and skips the owner", async () => {
    for (const member of [{ ok: false } as ActiveMemberRoleRead, "throw" as const]) {
      const { readers, calls } = makeReaders({
        staff: staffRows(),
        member,
        owner: { ok: true, isOwner: true },
      });
      const result = await resolveWorkOrderCompletionActor(DEALER, readers);
      assert.deepEqual(result, { ok: false, reason: "member-read-failed" });
      assert.equal(calls.owner.length, 0);
    }
  });

  it("maps a failed and a thrown owner read to owner-read-failed", async () => {
    for (const owner of [{ ok: false } as DealerOwnerRead, "throw" as const]) {
      const { readers } = makeReaders({
        staff: staffRows(),
        member: { ok: true, role: null },
        owner,
      });
      assert.deepEqual(await resolveWorkOrderCompletionActor(DEALER, readers), {
        ok: false,
        reason: "owner-read-failed",
      });
    }
  });
});

// ─── Context integrity ──────────────────────────────────────────────────────────

describe("granted context integrity", () => {
  it("carries exactly the resolved pair and exposes no extra runtime properties", async () => {
    const { readers } = makeReaders({ staff: staffRows({ status: "active", role: "manager" }) });
    const result = await resolveWorkOrderCompletionActor(DEALER, readers);
    assert.equal(result.ok, true);
    if (result.ok) {
      // The brand is compile-time-only: the runtime object is structurally the four data fields.
      assert.deepEqual(Object.keys(result.context).sort(), [
        "dealerId",
        "role",
        "source",
        "userId",
      ]);
      assert.equal(result.context.userId, USER);
      assert.equal(result.context.dealerId, DEALER);
    }
  });

  it("passes the exact (userId, dealerId) pair to every reader it invokes", async () => {
    const { readers, calls } = makeReaders({
      staff: staffRows(),
      member: { ok: true, role: null },
      owner: { ok: true, isOwner: false },
    });
    await resolveWorkOrderCompletionActor(DEALER, readers);
    assert.deepEqual(calls.staff, [{ userId: USER, dealerId: DEALER }]);
    assert.deepEqual(calls.member, [{ userId: USER, dealerId: DEALER }]);
    assert.deepEqual(calls.owner, [{ userId: USER, dealerId: DEALER }]);
  });
});
