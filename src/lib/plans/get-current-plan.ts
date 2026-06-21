"use server";

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { DealerPlan, DealerPlanInfo, SubscriptionStatus } from "./plan-types";

/**
 * Fetches the dealer's current subscription plan from the DB.
 * Never trusts client-side storage — always reads from dealers table.
 */
export async function getCurrentPlan(): Promise<DealerPlanInfo> {
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return {
      plan:                "basic",
      subscription_status: "active",
      started_at:          null,
      expired_at:          null,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("dealers")
    .select("plan, subscription_status, started_at, expired_at")
    .eq("id", dealer.dealer_id)
    .single();

  if (!data) {
    // Fallback: treat as basic/active (new dealer not yet migrated)
    return {
      plan:                "basic",
      subscription_status: "active",
      started_at:          null,
      expired_at:          null,
    };
  }

  return {
    plan:                (data.plan as DealerPlan)                     ?? "basic",
    subscription_status: (data.subscription_status as SubscriptionStatus) ?? "active",
    started_at:          data.started_at  ?? null,
    expired_at:          data.expired_at  ?? null,
  };
}
