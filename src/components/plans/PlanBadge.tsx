import {
  DealerPlan,
  DealerPlanInfo,
  planLabel,
  planBadgeColor,
  subscriptionStatusLabel,
  subscriptionStatusColor,
} from "@/lib/plans/plan-types";

interface Props {
  planInfo: DealerPlanInfo;
  showStatus?: boolean;
}

export default function PlanBadge({ planInfo, showStatus = false }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide ${planBadgeColor(planInfo.plan)}`}>
        {planLabel(planInfo.plan)}
      </span>
      {showStatus && (
        <span className={`text-xs ${subscriptionStatusColor(planInfo.subscription_status)}`}>
          {subscriptionStatusLabel(planInfo.subscription_status)}
        </span>
      )}
    </div>
  );
}
