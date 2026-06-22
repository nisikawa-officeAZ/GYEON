"use client";

import Link from "next/link";

const ACTIONS = [
  {
    icon:    "📝",
    label:   "見積もり",
    sub:     "新規作成・一覧",
    href:    "/estimates",
    iconBg:  "bg-blue-900/50 text-blue-300",
    border:  "border-blue-900/40 hover:border-blue-600/50",
    glow:    "from-blue-900/20 to-transparent",
  },
  {
    icon:    "👥",
    label:   "顧客管理",
    sub:     "登録・検索",
    href:    "/customers",
    iconBg:  "bg-violet-900/50 text-violet-300",
    border:  "border-violet-900/40 hover:border-violet-600/50",
    glow:    "from-violet-900/20 to-transparent",
  },
  {
    icon:    "🚗",
    label:   "車両管理",
    sub:     "台帳・整備記録",
    href:    "/vehicles",
    iconBg:  "bg-sky-900/50 text-sky-300",
    border:  "border-sky-900/40 hover:border-sky-600/50",
    glow:    "from-sky-900/20 to-transparent",
  },
  {
    icon:    "📅",
    label:   "予約",
    sub:     "本日・週間",
    href:    "/reservations",
    iconBg:  "bg-amber-900/50 text-amber-300",
    border:  "border-amber-900/40 hover:border-amber-600/50",
    glow:    "from-amber-900/20 to-transparent",
  },
  {
    icon:    "📋",
    label:   "作業管理",
    sub:     "進行中・完了",
    href:    "/work-orders",
    iconBg:  "bg-emerald-900/50 text-emerald-300",
    border:  "border-emerald-900/40 hover:border-emerald-600/50",
    glow:    "from-emerald-900/20 to-transparent",
  },
  {
    icon:    "💬",
    label:   "LINE連携",
    sub:     "受信・送信",
    href:    "/line",
    iconBg:  "bg-green-900/50 text-green-300",
    border:  "border-green-900/40 hover:border-green-600/50",
    glow:    "from-green-900/20 to-transparent",
  },
  {
    icon:    "🛒",
    label:   "商品注文",
    sub:     "発注・在庫",
    href:    "/product-orders",
    iconBg:  "bg-orange-900/50 text-orange-300",
    border:  "border-orange-900/40 hover:border-orange-600/50",
    glow:    "from-orange-900/20 to-transparent",
  },
  {
    icon:    "⚙️",
    label:   "設定",
    sub:     "店舗・スタッフ",
    href:    "/settings",
    iconBg:  "bg-slate-800/80 text-slate-300",
    border:  "border-slate-700/40 hover:border-slate-500/50",
    glow:    "from-slate-800/30 to-transparent",
  },
] as const;

export default function MainActionsGrid() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {ACTIONS.map(a => (
        <Link
          key={a.href}
          href={a.href}
          className={`
            relative flex items-center gap-3 p-3.5
            bg-[#0f172a] border rounded-2xl overflow-hidden
            ${a.border}
            touch-manipulation select-none
            transition-all duration-150
            active:scale-[0.97] active:brightness-90
          `}
        >
          {/* Subtle gradient accent in top-left corner */}
          <div className={`absolute inset-0 bg-gradient-to-br ${a.glow} pointer-events-none`} />

          {/* Icon container */}
          <div className={`relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[20px] ${a.iconBg}`}>
            {a.icon}
          </div>

          {/* Text */}
          <div className="relative min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-100 leading-tight truncate">{a.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">{a.sub}</p>
          </div>

          {/* Chevron */}
          <span className="relative text-slate-700 text-base leading-none shrink-0">›</span>
        </Link>
      ))}
    </div>
  );
}
