"use client";

// PHASE66-B: GYEON branded hero section.
// Static visual — no data props. CSS-only animation, no external libraries.
// Future: replace product strip with official GYEON product video / image carousel.

import Link from "next/link";

const PRODUCTS = [
  "Q² MOHS EVO",
  "Q² PURE EVO",
  "Q² CANCOAT EVO",
  "Q² LEATHERSHIELD EVO",
  "Q²M BATHE",
  "Q²M IRON",
  "Q²M BILBERRY",
  "Q²M PREP",
  "Q²M GLASS",
  "Q²M TIRE",
  "Q² SKIN",
  "Q² WTRMN EVO",
];

const WORKFLOW_STEPS = [
  { label: "顧客",     en: "Customer",     color: "text-blue-400",   dot: "bg-blue-500"   },
  { label: "見積",     en: "Estimate",     color: "text-violet-400", dot: "bg-violet-500" },
  { label: "施工",     en: "Work Order",   color: "text-amber-400",  dot: "bg-amber-500"  },
  { label: "請求",     en: "Invoice",      color: "text-green-400",  dot: "bg-green-500"  },
  { label: "メンテ",   en: "Maintenance",  color: "text-sky-400",    dot: "bg-sky-500"    },
  { label: "再来店",   en: "Repeat Visit", color: "text-rose-400",   dot: "bg-rose-500"   },
];

export default function GyeonHero() {
  return (
    <div className="flex flex-col gap-0 mb-8">

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-t-2xl border border-b-0 border-slate-800 bg-gradient-to-br from-[#0a0f1a] via-[#0d1526] to-[#0a0f1a] px-6 pt-8 pb-6">

        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#60a5fa 1px, transparent 1px), linear-gradient(90deg, #60a5fa 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow accents */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-end gap-6">

          {/* Brand + tagline */}
          <div className="flex-1">
            {/* Logo area */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white font-black text-sm">G</span>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.25em] text-blue-400 uppercase">GYEON</p>
                <p className="text-[10px] text-slate-500 tracking-wider">Detailer Agent</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-700/50 text-blue-400 bg-blue-950/30 ml-2">
                v1.0 Official
              </span>
            </div>

            {/* Main headline */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 leading-tight mb-2">
              施工で終わらせない。
            </h1>
            <p className="text-lg sm:text-xl font-medium text-slate-300 leading-snug mb-3">
              顧客との関係を、次の来店へ。
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              顧客管理、見積、施工、請求、LINEメンテナンスまでを一つに。
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/estimates"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
            >
              <span>+</span> 見積作成
            </Link>
            <Link
              href="/customers"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <span>+</span> 顧客追加
            </Link>
            <Link
              href="/reservations"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              予約確認
            </Link>
          </div>
        </div>
      </div>

      {/* ── Product strip ──────────────────────────────────────────────────── */}
      {/* Future: replace with official GYEON product video / image carousel. */}
      <div className="border-x border-slate-800 bg-[#080d18] overflow-hidden py-3 relative">
        {/* Fade masks */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#080d18] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#080d18] to-transparent z-10 pointer-events-none" />

        <div className="flex gap-0 gyeon-scroll-track">
          {/* Duplicate for seamless loop */}
          {[...PRODUCTS, ...PRODUCTS].map((p, i) => (
            <div
              key={i}
              className="shrink-0 flex items-center gap-3 px-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
              <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase whitespace-nowrap">
                {p}
              </span>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes gyeon-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .gyeon-scroll-track {
            animation: gyeon-scroll 28s linear infinite;
            width: max-content;
          }
          @media (prefers-reduced-motion: reduce) {
            .gyeon-scroll-track { animation: none; }
          }
        `}</style>
      </div>

      {/* ── Workflow visualization ─────────────────────────────────────────── */}
      <div className="rounded-b-2xl border border-t-0 border-slate-800 bg-[#0a0f1a] px-6 py-4">
        {/* Desktop: horizontal */}
        <div className="hidden sm:flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${step.dot}`} />
                <p className={`text-xs font-semibold ${step.color}`}>{step.label}</p>
                <p className="text-[9px] text-slate-600">{step.en}</p>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="flex items-center mx-2">
                  <div className="h-px w-8 bg-gradient-to-r from-slate-700 to-slate-600" />
                  <span className="text-slate-600 text-[10px] -ml-0.5">›</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: horizontal compact */}
        <div className="flex sm:hidden items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${step.dot}`} />
                <p className={`text-[10px] font-semibold ${step.color}`}>{step.label}</p>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <span className="text-slate-700 text-xs mx-1">›</span>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-600 mt-2 text-center sm:text-right">
          GYEON Detailer Agent — Customer Journey
        </p>
      </div>
    </div>
  );
}
