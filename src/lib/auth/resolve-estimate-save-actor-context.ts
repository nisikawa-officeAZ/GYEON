import "server-only";

// EW-UI-5A1-B3-P0 — Coherent estimate-save actor context — SERVER WRAPPER.
//
// The ONLY public entry point. It supplies the three real dependencies — the authenticated user,
// every active membership, and the staff role for the resolved tenant — to the pure core, which
// owns every decision. Modeled on `getAuthoritativeShopRank` / `getAuthoritativeDealerPricingCatalog`.
//
// ── SECURITY PROPERTIES ─────────────────────────────────────────────────────────
//   • Takes NO PARAMETERS. There is no `dealerId` and no `role` argument, so a caller cannot name
//     the tenant it wants a context for, nor assert a role. Enforced by the type, not by review.
//   • The user is resolved ONCE, solely through `getCurrentUser()` (auth.uid()).
//   • Reads through the NORMAL authenticated `createClient()` under RLS — never a service-role,
//     admin, or secret-keyed client.
//   • Authorization comes ONLY from `dealer_members` / `dealer_staff` rows. JWT-embedded claim bags
//     are never consulted: they are user-writable in Supabase and are not an authorization source.
//   • The membership query selects EVERY active row and applies NO row limit. The pure core refuses
//     an ambiguous tenant rather than letting the planner pick one — the defect in
//     `getCurrentDealer()`, whose `.limit(1).single()` returns an arbitrary dealer.
//   • The staff query is scoped by BOTH the resolved user id AND the exact resolved dealer id, so
//     the role can only ever describe the tenant the core already fixed.
//   • Both queries filter `status = 'active'`. A query error is a FAILED READ mapped to the
//     corresponding fail-closed arm — never an absence, and never a fallback to a weaker source.
//   • The legacy fail-open helpers are deliberately NOT used and NOT modified by this candidate:
//     the current-dealer helper picks an arbitrary tenant, the current-staff helper silently falls
//     back to the membership role on an operational error, and the staff-capability guard composes
//     both. Each is the behaviour this module replaces.

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  resolveEstimateSaveActorContext,
  type ActiveMembershipsRead,
  type ActiveStaffRoleRead,
  type EstimateSaveActorContextResolution,
} from "./estimate-save-actor-context";

export {
  type EstimateSaveActorContext,
  type EstimateSaveActorContextFailure,
  type EstimateSaveActorContextResolution,
  type EstimateSaveActorContextReaders,
  type ActiveMembership,
  type ActiveMembershipsRead,
  type ActiveStaffRoleRead,
} from "./estimate-save-actor-context";

/**
 * The coherent { userId, dealerId, role } context for the CURRENT actor, or a typed failure
 * carrying no context.
 *
 * Takes no arguments — by design. Never returns a context whose role and dealer came from different
 * tenants, and never returns a context on an operational read failure.
 */
export async function getEstimateSaveActorContext(): Promise<EstimateSaveActorContextResolution> {
  return resolveEstimateSaveActorContext({
    getUserId: async () => {
      const user = await getCurrentUser();
      return user?.id ?? null;
    },

    getActiveMemberships: async (userId: string): Promise<ActiveMembershipsRead> => {
      try {
        const supabase = await createClient();
        // EVERY active membership for this user. No row limit: an ambiguous tenant must be visible
        // to the core as ambiguous, not silently collapsed to whichever row came back first.
        const { data, error } = await supabase
          .from("dealer_members")
          .select("dealer_id, role")
          .eq("user_id", userId)
          .eq("status", "active");

        // A query error is a FAILED READ — never zero memberships.
        if (error || !data) return { ok: false };

        return {
          ok: true,
          rows: data.map((d: { dealer_id: string; role: string }) => ({
            dealer_id: d.dealer_id,
            role: d.role,
          })),
        };
      } catch {
        return { ok: false };
      }
    },

    getActiveStaffRole: async (userId: string, dealerId: string): Promise<ActiveStaffRoleRead> => {
      try {
        const supabase = await createClient();
        // Scoped by BOTH ids: the role can only describe the tenant already fixed by the core.
        // `maybeSingle()` distinguishes "no active staff row" (data === null ⇒ core falls back to
        // the SAME membership row's role) from an error. Duplicate active rows for one
        // (user, dealer) pair make `maybeSingle()` error — a data defect that fails closed rather
        // than resolving to an arbitrary one of them.
        const { data, error } = await supabase
          .from("dealer_staff")
          .select("role")
          .eq("user_id", userId)
          .eq("dealer_id", dealerId)
          .eq("status", "active")
          .maybeSingle();

        // A query error is a FAILED READ — never a reason to fall back to the membership role.
        if (error) return { ok: false };

        return { ok: true, role: data ? ((data.role as string | null) ?? null) : null };
      } catch {
        return { ok: false };
      }
    },
  });
}
