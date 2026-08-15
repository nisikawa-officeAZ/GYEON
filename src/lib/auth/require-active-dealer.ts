// Shared server guard for the dealer shell (GYEON-PARTNER-ONBOARD-F1).
//
// Invoked by the MainLayout server wrapper before ANY dealer-shell page
// renders, so every surface wrapped in MainLayout is unreachable without an
// ACTIVE dealer membership:
//   * unauthenticated                  → /login
//   * authenticated, no ACTIVE member  → /no-dealer
//     (covers: no membership at all, 'invited' pre-profile memberships from
//     the GYEON provisioning claim, and 'suspended'/'removed' memberships —
//     getCurrentDealer() resolves status = 'active' only)
//
// /no-dealer then converges eligible users onward (claim → /shop-profile),
// so an invited owner can never see dealer data before completing the shop
// profile. This guard is market-neutral: it reads no environment flag, no
// market profile, and no brand value.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer, type DealerMembership } from "@/lib/auth/get-current-dealer";

export async function requireActiveDealer(): Promise<DealerMembership> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dealer = await getCurrentDealer();
  if (!dealer) redirect("/no-dealer");

  return dealer;
}
