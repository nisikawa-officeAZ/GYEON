import { NextResponse } from "next/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface TrialStatusResponse {
  hasActiveTrial: boolean;
  trialEndsToday: boolean;
  trialEnded:     boolean;
  daysRemaining:  number | null;
  planType:       string | null;
  autoDowngradePlan: string | null;
}

export async function GET(): Promise<NextResponse<TrialStatusResponse>> {
  const none: TrialStatusResponse = {
    hasActiveTrial: false,
    trialEndsToday: false,
    trialEnded:     false,
    daysRemaining:  null,
    planType:       null,
    autoDowngradePlan: null,
  };

  const dealer = await getCurrentDealer();
  if (!dealer) return NextResponse.json(none);

  const supabase = await createClient();
  const { data } = await supabase
    .from("dealers")
    .select("plan, trial_status, trial_end_date, auto_downgrade_plan_type")
    .eq("id", dealer.dealer_id)
    .single();

  if (!data || !data.trial_status || data.trial_status === "none") {
    return NextResponse.json({ ...none, planType: data?.plan ?? null });
  }

  if (data.trial_status === "ended") {
    return NextResponse.json({
      hasActiveTrial: false,
      trialEndsToday: false,
      trialEnded:     true,
      daysRemaining:  0,
      planType:       data.plan,
      autoDowngradePlan: data.auto_downgrade_plan_type,
    });
  }

  if (!data.trial_end_date) {
    return NextResponse.json({ ...none, planType: data.plan });
  }

  const todayMs    = new Date(new Date().toISOString().split("T")[0]).getTime();
  const trialEndMs = new Date(data.trial_end_date).getTime();
  const daysRemaining = Math.round((trialEndMs - todayMs) / 86_400_000);

  return NextResponse.json({
    hasActiveTrial: daysRemaining >= 0,
    trialEndsToday: daysRemaining === 0,
    trialEnded:     daysRemaining < 0,
    daysRemaining:  Math.max(0, daysRemaining),
    planType:       data.plan,
    autoDowngradePlan: data.auto_downgrade_plan_type,
  });
}
