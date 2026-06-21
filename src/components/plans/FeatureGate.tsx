import { getCurrentPlan }        from "@/lib/plans/get-current-plan";
import {
  AppFeature,
  canUseFeature,
  planLabel,
  planBadgeColor,
  requiredPlanForFeature,
} from "@/lib/plans/plan-types";
import { ReactNode } from "react";

interface Props {
  feature:   AppFeature;
  children:  ReactNode;
  /** Custom locked fallback (optional) */
  fallback?: ReactNode;
}

/**
 * Server component — wraps content that requires a specific plan tier.
 * If the dealer's plan doesn't include the feature, renders a lock card.
 */
export default async function FeatureGate({ feature, children, fallback }: Props) {
  const { plan } = await getCurrentPlan();
  const allowed  = canUseFeature(plan, feature);

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const required      = requiredPlanForFeature(feature);
  const badgeClass    = planBadgeColor(required);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
        🔒
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-200 mb-1">この機能は利用できません</p>
        <p className="text-xs text-slate-500">
          現在のプラン:{" "}
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${planBadgeColor(plan)}`}>
            {planLabel(plan)}
          </span>
        </p>
      </div>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${badgeClass}`}>
        {planLabel(required)} 以上が必要です
      </div>
      <p className="text-xs text-slate-600 max-w-xs text-center">
        プランをアップグレードするには管理者へお問い合わせください。
      </p>
    </div>
  );
}
