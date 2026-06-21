"use client";

// PHASE58: Client-side feature locked component
// Use this inside client components where server FeatureGate can't be used.

import Link from "next/link";

interface Props {
  /** The feature that is locked (for display) */
  featureName?: string;
  /** The minimum plan required */
  requiredPlan?: "Pro" | "Pro Plus";
  /** Custom message override */
  message?: string;
}

export default function FeatureLocked({
  featureName,
  requiredPlan = "Pro",
  message,
}: Props) {
  const upgradeTarget = requiredPlan === "Pro Plus" ? "Pro Plus" : "Pro";

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      {/* Lock icon */}
      <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
        🔒
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-200">
          {featureName
            ? `「${featureName}」はご利用いただけません`
            : "この機能は現在のプランでは利用できません"}
        </p>
        <p className="text-xs text-slate-500 max-w-xs">
          {message ?? `${upgradeTarget} 以上のプランにアップグレードするとこの機能が利用できます。`}
        </p>
      </div>

      {/* Required plan badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
          upgradeTarget === "Pro Plus"
            ? "bg-purple-900/60 text-purple-300 border-purple-700"
            : "bg-blue-900/60 text-blue-300 border-blue-700"
        }`}
      >
        {upgradeTarget} 以上が必要です
      </div>

      {/* CTA */}
      <Link
        href="/settings"
        className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
      >
        プランを確認する
      </Link>

      <p className="text-[10px] text-slate-600 max-w-xs">
        アップグレードについては管理者へお問い合わせください。
      </p>
    </div>
  );
}
