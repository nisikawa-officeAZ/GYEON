// Server component — post-onboarding "Profile Completion" nudge.
//
// Onboarding intentionally collects only the minimum to start. The remaining
// configuration (shop info, LINE, PDF, logo) lives in Settings; this card shows
// what's still incomplete and links straight to the relevant Settings panel.
//
// Visibility:
//   - Hidden until onboarding is completed (the OnboardingCard covers that phase).
//   - Hidden once every item is done (nothing left to nudge).

import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import Link from "next/link";

export default async function ProfileCompletionCard() {
  const status = await getOnboardingStatus();
  if (!status || !status.onboarding_completed) return null;

  const items = [
    { label: "店舗情報",      done: !!status.business_name,                       href: "/settings?panel=store" },
    { label: "LINE連携",      done: !!status.line_enabled,                        href: "/settings?panel=line" },
    { label: "PDF・書類設定", done: !!(status.pdf_footer || status.stamp_url),    href: "/settings?panel=pdf" },
    { label: "会社ロゴ",      done: !!status.logo_url,                            href: "/settings?panel=store" },
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null; // all complete → hide

  const pct = Math.round((doneCount / items.length) * 100);

  return (
    <div className="bg-gradient-to-r from-blue-950/40 to-slate-900/60 border border-blue-800/30 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-200">プロフィール設定</p>
        <span className="text-[10px] text-slate-500">{doneCount}/{items.length} 完了 ({pct}%)</span>
      </div>

      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((i) => (
          <Link
            key={i.label}
            href={i.href}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-slate-800/40 border border-slate-700/40 hover:border-blue-600/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] border ${
                i.done ? "bg-green-600 border-green-500 text-white" : "border-slate-600 text-transparent"
              }`}>
                ✓
              </span>
              <span className={i.done ? "text-slate-500 line-through" : "text-slate-200"}>{i.label}</span>
            </span>
            {!i.done && <span className="text-[10px] text-blue-400 shrink-0">設定 →</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
