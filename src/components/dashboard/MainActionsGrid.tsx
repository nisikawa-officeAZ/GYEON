"use client";

// DealerOS — Main Actions Grid (PHASE73)
// 8 large cards in 2-column layout. Replaces QuickActionsCard.
// Links to core business operations only — no product promotions.

import Link from "next/link";

interface ActionCard {
  icon:     string;
  title:    string;
  href:     string;
  subs:     string[];
  accent:   string;
}

const ACTIONS: ActionCard[] = [
  {
    icon: "📝", title: "新規見積もり", href: "/estimates",
    subs: ["顧客 → 車両 → 施工 → PDF"],
    accent: "hover:border-blue-600/60 hover:bg-blue-950/10 active:bg-blue-950/20",
  },
  {
    icon: "👥", title: "顧客管理", href: "/customers",
    subs: ["顧客", "LINE", "履歴"],
    accent: "hover:border-violet-600/60 hover:bg-violet-950/10 active:bg-violet-950/20",
  },
  {
    icon: "🚗", title: "車両管理", href: "/vehicles",
    subs: ["車両一覧", "車検証", "施工履歴"],
    accent: "hover:border-sky-600/60 hover:bg-sky-950/10 active:bg-sky-950/20",
  },
  {
    icon: "📅", title: "予約管理", href: "/reservations",
    subs: ["今日", "週", "月"],
    accent: "hover:border-amber-600/60 hover:bg-amber-950/10 active:bg-amber-950/20",
  },
  {
    icon: "📋", title: "作業指示", href: "/work-orders",
    subs: ["進行中", "完了", "報告書"],
    accent: "hover:border-green-600/60 hover:bg-green-950/10 active:bg-green-950/20",
  },
  {
    icon: "💬", title: "LINE", href: "/line",
    subs: ["友だち", "送信", "リマインダー"],
    accent: "hover:border-emerald-600/60 hover:bg-emerald-950/10 active:bg-emerald-950/20",
  },
  {
    icon: "🛒", title: "商品注文", href: "/product-orders",
    subs: ["GYEON", "発注", "履歴"],
    accent: "hover:border-orange-600/60 hover:bg-orange-950/10 active:bg-orange-950/20",
  },
  {
    icon: "⚙️", title: "自社設定", href: "/settings",
    subs: ["店舗", "価格", "OCR"],
    accent: "hover:border-slate-600/60 hover:bg-slate-800/40 active:bg-slate-800/60",
  },
];

export default function MainActionsGrid() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-0.5">
        メインメニュー
      </p>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex flex-col gap-3 p-4 rounded-2xl border border-slate-800 bg-[#0f172a] transition-all ${action.accent}`}
          >
            <span className="text-3xl leading-none">{action.icon}</span>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-slate-100 leading-tight">{action.title}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {action.subs.map(sub => (
                  <span key={sub} className="text-[10px] text-slate-500 leading-snug">{sub}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
