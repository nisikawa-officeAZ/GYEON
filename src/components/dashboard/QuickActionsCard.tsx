"use client";

// PHASE66-B: Quick actions panel. Uses existing routes only.

import Link from "next/link";

const ACTIONS = [
  { label: "新規顧客",     href: "/customers",       icon: "👤", accent: "hover:border-blue-700/60 hover:bg-blue-950/20"     },
  { label: "新規見積",     href: "/estimates",       icon: "📋", accent: "hover:border-violet-700/60 hover:bg-violet-950/20" },
  { label: "新規予約",     href: "/reservations",    icon: "📅", accent: "hover:border-amber-700/60 hover:bg-amber-950/20"   },
  { label: "製品オーダー", href: "/product-orders",  icon: "📦", accent: "hover:border-green-700/60 hover:bg-green-950/20"   },
  { label: "請求書",       href: "/invoices",        icon: "🧾", accent: "hover:border-rose-700/60 hover:bg-rose-950/20"     },
  { label: "LINE設定",    href: "/line",             icon: "💬", accent: "hover:border-sky-700/60 hover:bg-sky-950/20"       },
] as const;

export default function QuickActionsCard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] p-4">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
        クイックアクション
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ACTIONS.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-slate-800 bg-slate-900/30 transition-colors ${action.accent}`}
          >
            <span className="text-xl leading-none">{action.icon}</span>
            <span className="text-[10px] font-medium text-slate-400 text-center leading-tight">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
