"use client";

import NotificationBell from "@/components/notifications/NotificationBell";
import Brand from "@/components/ui/Brand";
import type { NotificationBellData } from "@/lib/notifications/notification";

const isDev = process.env.NODE_ENV === "development";

interface HeaderProps {
  open: boolean;
  onToggleSidebar: () => void;
  /** GLOBAL_SHELL_POST_C6: server-resolved notification data from
      MainLayout, threaded through to NotificationBell. */
  initialNotificationData?: NotificationBellData;
}

export default function Header({ open, onToggleSidebar, initialNotificationData }: HeaderProps) {
  return (
    <header
      className="border-b border-[var(--gs-line)] flex items-center px-4 gap-3 fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{
        height: "var(--app-header-h)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "var(--gs-bg-2)",
      }}
    >
      <button
        onClick={onToggleSidebar}
        className="w-11 h-11 flex items-center justify-center rounded-[var(--gs-r-sm)] text-[var(--gs-text-2)] hover:text-[var(--gs-text)] hover:bg-white/[0.06] transition-colors md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gs-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gs-bg-2)]"
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
        <NotificationBell initialData={initialNotificationData} />
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border border-[var(--gs-line)]"
          style={{ background: "var(--gs-bg-3)", color: "var(--gs-text-2)" }}
        >
          U
        </div>
      </div>
    </header>
  );
}
