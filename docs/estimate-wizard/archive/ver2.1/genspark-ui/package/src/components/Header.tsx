"use client";

import NotificationBell from "@/components/notifications/NotificationBell";
import Brand from "@/components/ui/Brand";

const isDev = process.env.NODE_ENV === "development";

interface HeaderProps {
  open: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ open, onToggleSidebar }: HeaderProps) {
  return (
    <header
      className="bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-3 fixed top-0 left-0 right-0 z-50"
      style={{ height: "var(--app-header-h)", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <button
        onClick={onToggleSidebar}
        className="w-11 h-11 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors md:hidden"
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4h12v1.5H2V4zm0 3.25h12v1.5H2v-1.5zm0 3.25h12v1.5H2v-1.5z" />
        </svg>
      </button>

      {/* Unified GYEON Detailer Agent branding — matches the top page treatment */}
      <Brand size={40} />

      {/* Environment badge — dev only */}
      {isDev && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30">
          DEV
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 text-xs font-medium">
          U
        </div>
      </div>
    </header>
  );
}
