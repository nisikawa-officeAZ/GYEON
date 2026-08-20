"use client";

import { usePathname } from "next/navigation";
import NotificationBell from "@/components/notifications/NotificationBell";
import Brand from "@/components/ui/Brand";
import { categoryForPathname } from "@/lib/navigation/gda-categories";
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
  const pathname = usePathname();
  const category = categoryForPathname(pathname);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-[var(--app-header-h)] items-center gap-3 border-b border-[#20304a] bg-[#0a1222]/95 px-4 backdrop-blur-xl md:left-[240px] md:px-7">
      <button
        onClick={onToggleSidebar}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#9aabc4] transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
        aria-label={open ? "サイドバーを閉じる" : "サイドバーを開く"}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M2 4h12v1.5H2V4Zm0 3.25h12v1.5H2v-1.5Zm0 3.25h12v1.5H2v-1.5Z" />
        </svg>
      </button>

      <Brand size={32} className="md:hidden" />

      <div className="hidden min-w-[164px] flex-col md:flex">
        <h1 className="text-[20px] font-bold leading-tight text-[#e8eef8]">{category.label}</h1>
        <p className="mt-0.5 text-[9px] font-semibold tracking-[0.25em] text-[#7689a7]">{category.labelEn}</p>
      </div>

      <p className="hidden text-[11px] tracking-[0.08em] text-[#637492] lg:block">
        HOME <span className="px-2 text-[#354663]">/</span> <span className="text-[#899ab5]">{category.label}</span>
      </p>

      {isDev && (
        <span className="hidden rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-amber-400 sm:inline-flex">DEV</span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#263957] bg-[#101a2e]">
          <NotificationBell initialData={initialNotificationData} />
        </div>
        <button type="button" className="hidden h-10 w-10 place-items-center rounded-xl border border-[#263957] bg-[#101a2e] text-[#8fa0bb] sm:grid" aria-label="ヘルプ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.2M12 17h.01"/></svg>
        </button>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#263957] bg-[#1a2942] text-xs font-bold text-[#d5e0f1]">U</div>
      </div>
    </header>
  );
}
