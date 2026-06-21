// Server component — no "use client" needed
// PHASE58: Subscription status card for dealer Settings page

import { getCurrentDealerSubscription } from "@/lib/subscription/subscription";
import {
  getPlanLabel,
  getStatusLabel,
  getStatusBadgeColor,
  isActiveSubscriptionStatus,
} from "@/lib/subscription/subscription-types";
import {
  planBadgeColor,
  PLAN_FEATURES,
  type DealerPlan,
} from "@/lib/plans/plan-types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10).replace(/-/g, "/");
}

const FALLBACK_CARD = (
  <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
    <p className="text-xs text-slate-500">サブスクリプション情報を取得できませんでした。</p>
  </div>
);

export default async function SubscriptionStatusCard() {
  let sub: Awaited<ReturnType<typeof getCurrentDealerSubscription>> = null;

  try {
    sub = await getCurrentDealerSubscription();
  } catch (err) {
    console.error("[SubscriptionStatusCard] fetch failed:", err);
    return FALLBACK_CARD;
  }

  if (!sub) return FALLBACK_CARD;

  try {
  const isActive    = isActiveSubscriptionStatus(sub.status);
  const planKey     = (sub.plan_code in PLAN_FEATURES ? sub.plan_code : "basic") as DealerPlan;
  const planFeatures = PLAN_FEATURES[planKey] ?? PLAN_FEATURES.basic;
  const proOnlyFeatures    = PLAN_FEATURES.pro.filter((f) => !PLAN_FEATURES.basic.includes(f));
  const proPlusOnlyFeatures = PLAN_FEATURES.pro_plus.filter((f) => !PLAN_FEATURES.pro.includes(f));

  // Trial end warning
  let trialWarning = false;
  if (sub.status === "trial" && sub.trial_ends_at) {
    const daysLeft = Math.ceil(
      (new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000
    );
    trialWarning = daysLeft <= 7;
  }

  // Period end warning
  let periodWarning = false;
  if (sub.status === "active" && sub.current_period_ends_at) {
    const daysLeft = Math.ceil(
      (new Date(sub.current_period_ends_at).getTime() - Date.now()) / 86400000
    );
    periodWarning = daysLeft <= 14;
  }

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide ${planBadgeColor(planKey)}`}>
              {getPlanLabel(sub.plan_code)}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${getStatusBadgeColor(sub.status)}`}>
              {getStatusLabel(sub.status)}
            </span>
          </div>
          {sub.plan?.description && (
            <p className="text-xs text-slate-500">{sub.plan.description}</p>
          )}
        </div>
        {!isActive && (
          <span className="text-[10px] text-red-400 font-semibold bg-red-900/20 border border-red-800/40 px-2 py-1 rounded shrink-0">
            アクセス制限中
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="flex flex-col gap-1.5">
        {sub.status === "trial" && sub.trial_ends_at && (
          <div className={`flex items-center justify-between text-xs ${trialWarning ? "text-amber-400" : "text-slate-400"}`}>
            <span>トライアル終了</span>
            <span className="font-medium">{formatDate(sub.trial_ends_at)}</span>
          </div>
        )}
        {sub.current_period_started_at && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>開始日</span>
            <span>{formatDate(sub.current_period_started_at)}</span>
          </div>
        )}
        {sub.current_period_ends_at && sub.status !== "trial" && (
          <div className={`flex items-center justify-between text-xs ${periodWarning ? "text-amber-400" : "text-slate-500"}`}>
            <span>有効期限</span>
            <span className={periodWarning ? "font-medium" : ""}>{formatDate(sub.current_period_ends_at)}</span>
          </div>
        )}
      </div>

      {/* Warning banners */}
      {trialWarning && sub.trial_ends_at && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-300">
            トライアル期間終了まで残りわずかです。プランのアップグレードについては管理者へお問い合わせください。
          </p>
        </div>
      )}

      {/* Feature summary */}
      <div className="border-t border-slate-800 pt-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">利用可能な機能</p>
        <div className="flex flex-wrap gap-1.5">
          {planFeatures.slice(0, 8).map((f) => (
            <span
              key={f}
              className="text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded"
            >
              {f}
            </span>
          ))}
          {planFeatures.length > 8 && (
            <span className="text-[10px] text-slate-500 px-2 py-0.5">
              +{planFeatures.length - 8}
            </span>
          )}
        </div>
      </div>

      {/* Upgrade prompt for Basic */}
      {sub.plan_code === "basic" && (
        <div className="border-t border-slate-800 pt-3">
          <p className="text-[10px] text-slate-500 mb-1.5">
            Pro にアップグレードすると{proOnlyFeatures.length}機能が追加されます:
          </p>
          <div className="flex flex-wrap gap-1">
            {proOnlyFeatures.map((f) => (
              <span key={f} className="text-[10px] text-blue-400 bg-blue-900/20 border border-blue-800/30 px-1.5 py-0.5 rounded">
                {f}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            アップグレードについては管理者へお問い合わせください。
          </p>
        </div>
      )}

      {sub.plan_code === "pro" && proPlusOnlyFeatures.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <p className="text-[10px] text-slate-500 mb-1.5">
            Pro Plus にアップグレードすると{proPlusOnlyFeatures.length}機能が追加されます:
          </p>
          <div className="flex flex-wrap gap-1">
            {proPlusOnlyFeatures.map((f) => (
              <span key={f} className="text-[10px] text-purple-400 bg-purple-900/20 border border-purple-800/30 px-1.5 py-0.5 rounded">
                {f}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            アップグレードについては管理者へお問い合わせください。
          </p>
        </div>
      )}
    </div>
  );
  } catch (err) {
    console.error("[SubscriptionStatusCard] render error:", err);
    return FALLBACK_CARD;
  }
}
