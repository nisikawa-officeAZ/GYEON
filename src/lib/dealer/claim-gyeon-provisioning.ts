"use server";

// GYEON partner onboarding — the ONE shared claim convergence service.
//
// Called from all three convergence points (they are the ONLY call sites):
//   1. /auth/confirm       — right after email verification (signup + invite)
//   2. /signup             — auto-confirmed sessions (dev, confirmations off)
//   3. /no-dealer          — normal-login convergence: any verified user who
//                            lands without an active membership, in any later
//                            session, without re-verification
//
// Authorization inputs are EXCLUSIVELY server-derived: the session user from
// supabase.auth.getUser() (id + email + email_confirmed_at). The function takes
// ZERO parameters, so no applicant-controlled email, user_metadata, rank,
// role, dealer id, or approval status can ever enter the claim. Eligibility
// itself is decided inside the atomic claim_gyeon_provisioning transaction:
// email_normalized match AND provisioning_status = 'registered' AND
// claimed_at IS NULL — invitation_state never gates it.
//
// Fail-closed and idempotent: every non-eligible outcome leaves the existing
// no-dealer / human-review behavior untouched.

import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClaimGyeonProvisioningResult =
  | { kind: "disabled" }
  | { kind: "not-authenticated" }
  | { kind: "not-verified" }
  | { kind: "claimed"; dealerId: string }
  | { kind: "no-match" }
  | { kind: "already-claimed" }
  | { kind: "already-member" }
  | { kind: "revoked" }
  | { kind: "identity-mismatch" }
  | { kind: "error" };

export async function claimGyeonProvisioning(): Promise<ClaimGyeonProvisioningResult> {
  try {
    // Server-only feature gate FIRST — on SaaS this returns before any
    // database access, so all three convergence points are no-ops there.
    if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { kind: "not-authenticated" };
    if (!user.email || !user.email_confirmed_at) return { kind: "not-verified" };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("claim_gyeon_provisioning", {
      p_user_id: user.id,
      p_email: user.email,
    });

    if (error) {
      // 'gyeon_claim_dealer_conflict' (a live non-pending dealer already owns
      // the email) also lands here: the transaction rolled back, the record
      // stays registered, and the case goes to human review.
      console.error("[claimGyeonProvisioning] rpc error:", error.message);
      return { kind: "error" };
    }

    const outcome = (data as { outcome?: string; dealer_id?: string } | null)?.outcome;
    switch (outcome) {
      case "claimed": {
        const dealerId = (data as { dealer_id?: string }).dealer_id;
        if (typeof dealerId !== "string" || dealerId === "") return { kind: "error" };
        return { kind: "claimed", dealerId };
      }
      case "no-match":          return { kind: "no-match" };
      case "already-claimed":   return { kind: "already-claimed" };
      case "already-member":    return { kind: "already-member" };
      case "revoked":           return { kind: "revoked" };
      // F2-01: the transaction re-validated id/email/email_confirmed_at
      // against auth.users and refused with zero writes.
      case "identity-mismatch": return { kind: "identity-mismatch" };
      default:                  return { kind: "error" };
    }
  } catch (err) {
    console.error("[claimGyeonProvisioning] unexpected error:", err);
    return { kind: "error" };
  }
}
