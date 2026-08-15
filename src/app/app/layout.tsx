import type { ReactNode } from "react";
import Link from "next/link";
import CustomerBottomNav from "./CustomerBottomNav";

export const metadata = { title: "GYEON Detailer Agent" };

// Customer-facing mobile app shell — independent of the dealer chrome.
// Dark, mobile-first, card-based, with a fixed bottom navigation.
export default function CustomerAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100">
      <div className="mx-auto w-full max-w-md min-h-screen flex flex-col relative">
        {/* Brand header */}
        <header className="sticky top-0 z-30 flex items-center gap-2.5 px-4 h-14 bg-[#080d1a]/90 backdrop-blur border-b border-white/[.06]">
          <Link href="/app" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
              <span className="text-white text-[11px] font-black tracking-tight">G</span>
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[8px] font-semibold tracking-[3px] text-slate-500 uppercase">GYEON</span>
              <span className="text-[12px] font-bold text-slate-100 tracking-tight">Detailer Agent</span>
            </span>
          </Link>
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-700/30">DEMO</span>
        </header>

        <main className="flex-1 px-4 pt-4 pb-24">{children}</main>

        <CustomerBottomNav />
      </div>
    </div>
  );
}
