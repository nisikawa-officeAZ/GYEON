export type DealerApprovalMode = "trial" | "permanent_pro_plus";

export function buildDealerApprovalSubscriptionState({
  mode,
  requestedPlan,
  serviceStartDate,
  trialEndDate,
}: {
  mode: DealerApprovalMode;
  requestedPlan: string;
  serviceStartDate: string;
  trialEndDate: string;
}) {
  if (mode === "permanent_pro_plus") {
    return {
      plan:                     "pro_plus",
      subscription_status:      "active",
      trial_plan_type:          "pro_plus",
      trial_start_date:         null,
      trial_end_date:           null,
      trial_status:             "none",
      auto_downgrade_plan_type: "basic",
    } as const;
  }

  return {
    plan:                     requestedPlan,
    subscription_status:      "trial",
    trial_plan_type:          requestedPlan,
    trial_start_date:         serviceStartDate,
    trial_end_date:           trialEndDate,
    trial_status:             "active",
    auto_downgrade_plan_type: "basic",
  } as const;
}
