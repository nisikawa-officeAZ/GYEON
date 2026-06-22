"use client";

// DealerOS — Main Actions Grid (PHASE73 iPhone-first revision)
// 4×2 icon grid. Icon-first, short label only. Touch-friendly tap targets.
// No descriptions, no sub-links, no scrolling.

import Link from "next/link";

const ACTIONS = [
  { icon: "📝", label: "見積",   href: "/estimates",      accent: "hover:border-blue-500/50 active:bg-blue-950/20"    },
  { icon: "👥", label: "顧客",   href: "/customers",      accent: "hover:border-violet-500/50 active:bg-violet-950/20" },
  { icon: "🚗", label: "車両",   href: "/vehicles",       accent: "hover:border-sky-500/50 active:bg-sky-950/20"      },
  { icon: "📅", label: "予約",   href: "/reservations",   accent: "hover:border-amber-500/50 active:bg-amber-950/20"  },
  { icon: "📋", label: "作業",   href: "/work-orders",    accent: "hover:border-green-500/50 active:bg-green-950/20"  },
  { icon: "💬", label: "LINE",   href: "/line",           accent: "hover:border-emerald-500/50 active:bg-emerald-950/20" },
  { icon: "🛒", label: "注文",   href: "/product-orders", accent: "hover:border-orange-500/50 active:bg-orange-950/20" },
  { icon: "⚙️", label: "設定",   href: "/settings",       accent: "hover:border-slate-500/50 active:bg-slate-800/40"  },
] as const;

export default function MainActionsGrid() {
  return (
    <div className="grid grid-cols-4 gap-2 px-3">
      {ACTIONS.map(a => (
        <Link
          key={a.href}
          href={a.href}
          className={`
            flex flex-col items-center justify-center gap-2
            min-h-[84px] sm:min-h-[100px]
            bg-[#0f172a] border border-slate-800 rounded-2xl
            touch-manipulation select-none transition-colors
            ${a.accent}
          `}
        >
          <span className="text-[28px] sm:text-[32px] leading-none">{a.icon}</span>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-300 tracking-wide">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
