// /shop-profile — the dedicated GYEON partner onboarding surface
// (GYEON-PARTNER-ONBOARD-F1).
//
// The ONLY page a claimed-but-not-activated owner (dealer_members status
// 'invited') can use. It never renders the dealer shell (no MainLayout);
// dealer data stays unreachable until completeGyeonShopProfile() atomically
// writes phone/prefecture/address and activates the membership.
//
// Routing contract:
//   * gate disabled                 → /no-dealer (fail closed)
//   * unauthenticated               → /login
//   * active membership already     → /dashboard
//   * no invited owner membership   → /no-dealer (existing behavior owns it)

import { redirect } from "next/navigation";
import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";
import ShopProfileForm from "./ShopProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "店舗情報の入力 | GYEON Detailer Agent" };

export default async function ShopProfilePage() {
  if (!isGyeonPartnerOnboardingEnabled()) redirect("/no-dealer");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const active = await getCurrentDealer();
  if (active) redirect("/dashboard");

  // The invited membership is invisible to the active-only helpers by design;
  // resolve it server-side with explicit session-derived predicates.
  const supabase = createAdminClient();
  const { data: invited } = await supabase
    .from("dealer_members")
    .select("dealer_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "invited")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!invited) redirect("/no-dealer");

  const { data: dealer } = await supabase
    .from("dealers")
    .select("name, phone, prefecture, address")
    .eq("id", invited.dealer_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!dealer) redirect("/no-dealer");

  return (
    <ShopProfileForm
      shopName={dealer.name ?? ""}
      initialPhone={dealer.phone ?? ""}
      initialPrefecture={dealer.prefecture ?? ""}
      initialAddress={dealer.address ?? ""}
    />
  );
}
