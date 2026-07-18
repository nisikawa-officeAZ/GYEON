// EW-UI-5A1-B3-P0 — Coherent estimate-save actor context — PURE CORE.
//
// No React, no server module, no Supabase, no DB, no `server-only`, no clock, no randomness, no
// `any`. Every dependency arrives through `EstimateSaveActorContextReaders`, so this module is
// exhaustively testable under plain `node:test` without importing anything server-only.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
// The pre-existing save path resolves tenant and role through TWO INDEPENDENT lookups that can
// disagree:
//   • `getCurrentDealer()` (auth/get-current-dealer.ts) selects a membership with
//     `.limit(1).single()` — an ARBITRARY tenant when a user belongs to more than one dealer. Which
//     dealer you get is whatever the planner returns; it is not a decision anyone made.
//   • `getCurrentStaff()` (staff/get-current-staff.ts) then reads `dealer_staff` and, on ANY error
//     — including an operational query failure — SILENTLY FALLS BACK to the `dealer_members` role.
//     An error is not an authorization decision, and a fallback on error is a fail-OPEN.
// Combined, a role read for one dealer can be paired with a `dealer_id` from another, and a failed
// staff read can still yield an editing role. Both are tenant-isolation defects.
//
// This module resolves ONE coherent { userId, dealerId, role } triple or nothing at all. The role
// and the dealerId are ALWAYS derived from the SAME selected membership row: the dealerId is fixed
// first, and the staff role is then read for that exact (userId, dealerId) pair. There is no branch
// in this file where a role from one dealer can travel with a dealerId from another.
//
// ── AMBIGUITY IS A FAILURE, NOT A CHOICE ────────────────────────────────────────
// Two or more active memberships resolve to `"tenant-context-unavailable"`. This module refuses to
// pick a tenant on the user's behalf: an arbitrary pick is exactly the defect being removed.

import { canEditBusinessData, type DealerStaffRole } from "@/lib/staff/staff-types";

/**
 * Why no coherent actor context could be produced. None is recoverable into a context.
 *
 *   "unauthenticated"            — no authenticated user. Nothing to resolve a tenant FOR.
 *   "membership-read-failed"     — the membership query itself failed or threw. An error is not an
 *                                  authorization decision, and never an absence of memberships.
 *   "no-active-membership"       — the user has zero active `dealer_members` rows.
 *   "tenant-context-unavailable" — MORE THAN ONE active membership (or an unusable dealer id). The
 *                                  tenant is ambiguous and is never picked arbitrarily.
 *   "staff-read-failed"          — the `dealer_staff` read failed or threw. NEVER falls back to the
 *                                  membership role: that is the fail-open being removed.
 *   "permission-denied"          — a role was resolved, but it may not edit business data. An
 *                                  unknown/invalid stored role is mapped to least privilege first,
 *                                  so it lands here rather than being coerced onto an editing role.
 */
export type EstimateSaveActorContextFailure =
  | "unauthenticated"
  | "membership-read-failed"
  | "no-active-membership"
  | "tenant-context-unavailable"
  | "staff-read-failed"
  | "permission-denied";

// The brand is a compile-time-only unique symbol: it is DECLARED, never defined, so it exists in no
// runtime object. Because the symbol is not exported, no module outside this file can name the
// property, and therefore no module outside this file can produce a value of the branded type.
// `resolveEstimateSaveActorContext` below is the only constructor.
declare const ESTIMATE_SAVE_ACTOR_CONTEXT_BRAND: unique symbol;

/**
 * A coherent, server-resolved actor context. `dealerId` and `role` are guaranteed to originate from
 * the SAME active membership, and `role` is guaranteed to satisfy `canEditBusinessData`.
 *
 * Opaque by construction: a caller cannot assemble one from a client-supplied dealer id or role.
 */
export type EstimateSaveActorContext = {
  readonly userId: string;
  readonly dealerId: string;
  readonly role: DealerStaffRole;
  readonly [ESTIMATE_SAVE_ACTOR_CONTEXT_BRAND]: true;
};

/** Discriminated: `context` exists ONLY on the success arm, so a failure cannot be read as a context. */
export type EstimateSaveActorContextResolution =
  | { readonly ok: true; readonly context: EstimateSaveActorContext }
  | { readonly ok: false; readonly reason: EstimateSaveActorContextFailure };

/** One active `dealer_members` row: the tenant and the membership-level role, read together. */
export interface ActiveMembership {
  readonly dealer_id: string;
  readonly role: string;
}

/** The result of reading memberships. Distinguishes "read failed" from "read zero rows". */
export type ActiveMembershipsRead =
  | { readonly ok: true; readonly rows: readonly ActiveMembership[] }
  | { readonly ok: false };

/** The result of reading the staff role. Distinguishes "read failed" from "no active staff row". */
export type ActiveStaffRoleRead =
  | { readonly ok: true; readonly role: string | null }
  | { readonly ok: false };

/**
 * Injected dependencies. Note what is NOT here: there is no way to pass in a `dealerId` or a `role`.
 * The tenant is discovered, never supplied; the role is read, never asserted.
 *
 * `getActiveStaffRole` takes BOTH ids so the staff read is provably scoped to the tenant that was
 * already fixed — the signature makes a cross-dealer pairing unrepresentable.
 */
export interface EstimateSaveActorContextReaders {
  readonly getUserId: () => Promise<string | null>;
  readonly getActiveMemberships: (userId: string) => Promise<ActiveMembershipsRead>;
  readonly getActiveStaffRole: (userId: string, dealerId: string) => Promise<ActiveStaffRoleRead>;
}

const VALID_ROLES: readonly DealerStaffRole[] = ["owner", "manager", "staff", "readonly"];

/** Exact, literal membership test. No trimming, no casing, no aliasing. */
function isDealerStaffRole(value: unknown): value is DealerStaffRole {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

/**
 * Least privilege for anything that is not a literal canonical role. `"readonly"` cannot edit
 * business data, so an unknown/legacy/wrong-typed stored role is denied rather than coerced onto an
 * editing role.
 */
function toRoleOrLeastPrivilege(raw: unknown): DealerStaffRole {
  return isDealerStaffRole(raw) ? raw : "readonly";
}

const deny = (reason: EstimateSaveActorContextFailure): EstimateSaveActorContextResolution => ({
  ok: false,
  reason,
});

function isUsableId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Resolve ONE coherent actor context, fail-closed at every step.
 *
 * Precedence (each step returns immediately; no later reader runs after an earlier failure):
 *   1. user resolved exactly once      → not usable            ⇒ "unauthenticated"
 *   2. all active memberships, one read → read failed/threw     ⇒ "membership-read-failed"
 *   3. zero rows                                                 ⇒ "no-active-membership"
 *   4. more than one row                                         ⇒ "tenant-context-unavailable"
 *   5. exactly one row FIXES dealerId  → unusable dealer id     ⇒ "tenant-context-unavailable"
 *   6. staff role for (userId, dealerId) → read failed/threw    ⇒ "staff-read-failed"
 *   7. no active staff row             → the SAME row's role
 *   8. role must satisfy canEditBusinessData                     ⇒ else "permission-denied"
 *
 * A thrown reader is treated as that reader's failure — never as an absence, and never as a reason
 * to fall back. There is no branch that produces a context the readers did not jointly support.
 */
export async function resolveEstimateSaveActorContext(
  readers: EstimateSaveActorContextReaders,
): Promise<EstimateSaveActorContextResolution> {
  // ── 1. Resolve the user EXACTLY ONCE. A thrown lookup establishes no session ⇒ unauthenticated.
  let userId: string | null;
  try {
    userId = await readers.getUserId();
  } catch {
    return deny("unauthenticated");
  }
  if (!isUsableId(userId)) return deny("unauthenticated");

  // ── 2. Read ALL active memberships in ONE operation. No limit, no arbitrary pick.
  let memberships: ActiveMembershipsRead;
  try {
    memberships = await readers.getActiveMemberships(userId);
  } catch {
    return deny("membership-read-failed");
  }
  // ── 3. An operational failure is not an absence of memberships.
  if (!memberships.ok) return deny("membership-read-failed");

  const rows = memberships.rows;
  // ── 4. Zero ⇒ nothing to authorize. More than one ⇒ ambiguous; refuse rather than choose.
  if (rows.length === 0) return deny("no-active-membership");
  if (rows.length > 1) return deny("tenant-context-unavailable");

  // ── 5. Exactly one membership FIXES the tenant. Everything downstream is bound to THIS row.
  const membership = rows[0] as ActiveMembership;
  if (!isUsableId(membership.dealer_id)) return deny("tenant-context-unavailable");
  const dealerId: string = membership.dealer_id;

  // ── 6. Read the staff role for THAT EXACT (userId, dealerId) pair. A failure is fail-CLOSED: it
  //       never falls back to the membership role, because an error is not an authorization result.
  let staff: ActiveStaffRoleRead;
  try {
    staff = await readers.getActiveStaffRole(userId, dealerId);
  } catch {
    return deny("staff-read-failed");
  }
  if (!staff.ok) return deny("staff-read-failed");

  // ── 7. An active `dealer_staff` row OVERRIDES the membership role for this same dealer; its
  //       absence (role === null) falls back to the SAME membership row's role. Both sources
  //       describe the one tenant fixed in step 5, so role and dealerId can never diverge.
  const rawRole: unknown = staff.role === null ? membership.role : staff.role;
  const role = toRoleOrLeastPrivilege(rawRole);

  // ── 8. Least-privilege / read-only roles cannot edit business data.
  if (!canEditBusinessData(role)) return deny("permission-denied");

  // The ONLY construction of the branded type. The brand property is compile-time-only and is not
  // present on the runtime object, so the value is structurally exactly { userId, dealerId, role }.
  const context = { userId, dealerId, role } as EstimateSaveActorContext;
  return { ok: true, context };
}
