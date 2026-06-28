"use client";

import NotificationBell from "@/components/notifications/NotificationBell";

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
        className="w-11 h-11 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4h12v1.5H2V4zm0 3.25h12v1.5H2v-1.5zm0 3.25h12v1.5H2v-1.5z" />
        </svg>
      </button>

      {/* Logo + App name */}
      <div className="flex items-center gap-2.5">
        {/* G mark */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#1d4ed8" />
          <path d="M7 8h6.5C16.538 8 19 10.462 19 14s-2.462 6-5.5 6H7V8z" fill="white" />
          <path d="M13.5 11H10v6h3.5c1.657 0 3-1.343 3-3s-1.343-3-3-3z" fill="#1d4ed8" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold tracking-widest text-slate-500 uppercase">GYEON</span>
          <span className="font-bold text-slate-100 text-sm tracking-tight leading-tight">Detailer Agent</span>
        </div>
      </div>

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
