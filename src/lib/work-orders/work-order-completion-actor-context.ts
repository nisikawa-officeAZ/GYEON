// GDA-1W-C3 — Work-order completion actor context — PURE CORE.
//
// No React, no server module, no Supabase, no DB, no `server-only`, no clock, no randomness, no
// `any`. Every dependency arrives through `WorkOrderCompletionActorReaders`, so this module is
// exhaustively testable under plain `node:test` without importing anything server-only.
//
// ── WHAT THIS IS ────────────────────────────────────────────────────────────────
// The application-side mirror of the §5.3 authorization inside `public.complete_work_order_v1`
// (GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md). The DATABASE check is the authority and cannot be
// replaced by this module; this exists as defense in depth so the application resolves the SAME
// actor/tenant pair with the SAME precedence and denies the same states before a round-trip.
//
// ── THE ACCEPTED PRECEDENCE (fail-closed at every step) ─────────────────────────
//   1. The caller must be authenticated. Anonymous and service-role contexts have no user.
//   2. Authorization is evaluated for the dealer that OWNS the work order. The dealer id is
//      resolved by the caller from the work order row — it is never client-supplied — and this
//      module cannot be handed a role, only readers.
//   3. If ANY `dealer_staff` row exists for (dealerId, userId), that table is AUTHORITATIVE:
//      exactly one row, status `active`, role `owner` | `manager` | `staff` authorizes. A
//      `disabled`, `invited`, unknown-role, unknown-status, or duplicate/ambiguous staff state is
//      a BLOCKING state — it denies and NEVER falls back to `dealer_members` or to the dealer
//      owner. A blocking row is an explicit administrative decision about this exact pair.
//   4. Only when NO `dealer_staff` row exists may an ACTIVE same-dealer `dealer_members` role of
//      `owner` | `manager` | `staff` authorize. `readonly` and inactive memberships deny.
//   5. The dealer's `owner_user_id` may authorize as `owner` only when no blocking `dealer_staff`
//      row exists (step 3 already returned if one did). This is the bootstrap path for a dealer
//      whose staff/member rows were never populated.
//   6. Everything else — including any read failure — denies. An error is not an authorization
//      decision, and a failed read never falls through to a weaker source.

/** The only roles that may complete a work order or correct a draft (§3.3, §5.3). */
export type WorkOrderCompletionRole = "owner" | "manager" | "staff";

const AUTHORIZING_ROLES: readonly WorkOrderCompletionRole[] = ["owner", "manager", "staff"];

/**
 * Why no completion actor could be authorized. None is recoverable into a context.
 *
 *   "unauthenticated"     — no authenticated user; nothing to authorize.
 *   "staff-read-failed"   — the `dealer_staff` read failed or threw. Fail-CLOSED: a read error is
 *                           never treated as "no staff row" and never falls back.
 *   "staff-blocked"       — a `dealer_staff` row EXISTS for this exact pair but does not authorize
 *                           (disabled, invited, readonly, unknown role/status, or duplicate rows).
 *                           The blocking row forbids every fallback.
 *   "member-read-failed"  — the `dealer_members` read failed or threw. Fail-closed as above.
 *   "owner-read-failed"   — the dealer owner read failed or threw. Fail-closed as above.
 *   "permission-denied"   — no source authorized: no staff row, no active editing membership, and
 *                           not the dealer's owner_user_id (or only a readonly/inactive state).
 */
export type WorkOrderCompletionActorFailure =
  | "unauthenticated"
  | "staff-read-failed"
  | "staff-blocked"
  | "member-read-failed"
  | "owner-read-failed"
  | "permission-denied";

// Compile-time-only brand: declared, never defined, not exported — so no module outside this file
// can construct the authorized type. `resolveWorkOrderCompletionActor` is the only constructor.
declare const WORK_ORDER_COMPLETION_ACTOR_BRAND: unique symbol;

/**
 * An authorized completion actor. `dealerId` is the work order's dealer, `role` is the role the
 * accepted precedence resolved, and `source` records WHICH authority granted it — useful for audit
 * logging without re-deriving the decision.
 */
export type WorkOrderCompletionActorContext = {
  readonly userId: string;
  readonly dealerId: string;
  readonly role: WorkOrderCompletionRole;
  readonly source: "dealer_staff" | "dealer_members" | "dealer_owner";
  readonly [WORK_ORDER_COMPLETION_ACTOR_BRAND]: true;
};

/** Discriminated: `context` exists ONLY on the success arm. */
export type WorkOrderCompletionActorResolution =
  | { readonly ok: true; readonly context: WorkOrderCompletionActorContext }
  | { readonly ok: false; readonly reason: WorkOrderCompletionActorFailure };

/** One `dealer_staff` row for the exact (dealerId, userId) pair: status and role, read together. */
export interface DealerStaffRow {
  readonly status: string;
  readonly role: string;
}

/**
 * Reading ALL staff rows for the pair distinguishes three materially different states the database
 * check also distinguishes: read failed, zero rows (fallback permitted), one-or-more rows
 * (authoritative — possibly blocking).
 */
export type DealerStaffRead =
  | { readonly ok: true; readonly rows: readonly DealerStaffRow[] }
  | { readonly ok: false };

/** One active `dealer_members` row's role for the pair, or null when no ACTIVE row exists. */
export type ActiveMemberRoleRead =
  | { readonly ok: true; readonly role: string | null }
  | { readonly ok: false };

/** Whether `dealers.owner_user_id` for this dealer is this user. */
export type DealerOwnerRead =
  | { readonly ok: true; readonly isOwner: boolean }
  | { readonly ok: false };

/**
 * Injected dependencies. There is deliberately NO way to pass in a role, and the dealerId given to
 * `resolveWorkOrderCompletionActor` must be the one read from the work order row by the caller —
 * both readers take (userId, dealerId) so a cross-dealer pairing is unrepresentable.
 *
 * Readers are called LAZILY in precedence order: when `dealer_staff` decides, the member and owner
 * readers are never invoked, mirroring the database's short-circuit.
 */
export interface WorkOrderCompletionActorReaders {
  readonly getUserId: () => Promise<string | null>;
  readonly getDealerStaffRows: (userId: string, dealerId: string) => Promise<DealerStaffRead>;
  readonly getActiveMemberRole: (userId: string, dealerId: string) => Promise<ActiveMemberRoleRead>;
  readonly getIsDealerOwner: (userId: string, dealerId: string) => Promise<DealerOwnerRead>;
}

/** Exact, literal role test. No trimming, no casing, no aliasing — `readonly` is NOT here. */
function isAuthorizingRole(value: unknown): value is WorkOrderCompletionRole {
  return typeof value === "string" && (AUTHORIZING_ROLES as readonly string[]).includes(value);
}

function isUsableId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const deny = (reason: WorkOrderCompletionActorFailure): WorkOrderCompletionActorResolution => ({
  ok: false,
  reason,
});

const grant = (
  userId: string,
  dealerId: string,
  role: WorkOrderCompletionRole,
  source: WorkOrderCompletionActorContext["source"],
): WorkOrderCompletionActorResolution => ({
  ok: true,
  // The ONLY construction of the branded type. The brand is compile-time-only, so the runtime
  // value is structurally exactly { userId, dealerId, role, source }.
  context: { userId, dealerId, role, source } as WorkOrderCompletionActorContext,
});

/**
 * Resolve the completion actor for the dealer that owns the work order, or deny.
 *
 * `dealerId` MUST be the `dealer_id` of the work order row as read server-side. Passing a
 * client-supplied dealer id here would defeat the tenant binding — callers own that discipline;
 * the database check remains the backstop for a caller that gets it wrong.
 */
export async function resolveWorkOrderCompletionActor(
  dealerId: string,
  readers: WorkOrderCompletionActorReaders,
): Promise<WorkOrderCompletionActorResolution> {
  // ── 1. Authentication. A thrown lookup establishes no session ⇒ unauthenticated.
  let userId: string | null;
  try {
    userId = await readers.getUserId();
  } catch {
    return deny("unauthenticated");
  }
  if (!isUsableId(userId)) return deny("unauthenticated");
  if (!isUsableId(dealerId)) return deny("permission-denied");

  // ── 2/3. dealer_staff is PRIMARY and, when any row exists, FINAL.
  let staff: DealerStaffRead;
  try {
    staff = await readers.getDealerStaffRows(userId, dealerId);
  } catch {
    return deny("staff-read-failed");
  }
  if (!staff.ok) return deny("staff-read-failed");

  if (staff.rows.length > 0) {
    // Duplicate rows are an ambiguous administrative state: blocking, never resolved by picking.
    if (staff.rows.length > 1) return deny("staff-blocked");

    const row = staff.rows[0] as DealerStaffRow;
    // Exact-literal status and role. `invited`, `disabled`, unknown status, `readonly`, and any
    // unknown role all land here — and because a row EXISTS, nothing below may run.
    if (row.status !== "active") return deny("staff-blocked");
    if (!isAuthorizingRole(row.role)) return deny("staff-blocked");
    return grant(userId, dealerId, row.role, "dealer_staff");
  }

  // ── 4. No staff row exists: an ACTIVE same-dealer membership with an editing role may authorize.
  let member: ActiveMemberRoleRead;
  try {
    member = await readers.getActiveMemberRole(userId, dealerId);
  } catch {
    return deny("member-read-failed");
  }
  if (!member.ok) return deny("member-read-failed");

  if (member.role !== null && isAuthorizingRole(member.role)) {
    return grant(userId, dealerId, member.role, "dealer_members");
  }

  // ── 5. Owner bootstrap: dealers.owner_user_id authorizes as `owner` only when no blocking
  //       dealer_staff row exists — which step 3 already guaranteed by returning on any row.
  //       A readonly/inactive membership above does not block this path; only dealer_staff blocks.
  let owner: DealerOwnerRead;
  try {
    owner = await readers.getIsDealerOwner(userId, dealerId);
  } catch {
    return deny("owner-read-failed");
  }
  if (!owner.ok) return deny("owner-read-failed");

  if (owner.isOwner) return grant(userId, dealerId, "owner", "dealer_owner");

  // ── 6. Nothing authorized. One coarse reason: which source ALMOST authorized is not disclosed.
  return deny("permission-denied");
}
