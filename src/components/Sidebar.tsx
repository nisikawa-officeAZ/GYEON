"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Brand from "@/components/ui/Brand";
import { GDA_CATEGORIES, categoryForPathname, type GdaCategoryIcon } from "@/lib/navigation/gda-categories";
import { getCurrentPlan } from "@/lib/plans/get-current-plan";
import { canUseFeature, DealerPlan } from "@/lib/plans/plan-types";
import { getUnreadNewsCount } from "@/lib/news/news";

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
  /** GLOBAL_SHELL_POST_C5: server-resolved plan from MainLayout. When
      supplied, Sidebar skips its own getCurrentPlan() mount fetch. */
  initialPlan?: DealerPlan;
  /** GLOBAL_SHELL_POST_C7: server-resolved unread news count from
      MainLayout. When supplied, Sidebar skips its own getUnreadNewsCount()
      mount fetch; the 60s poll still runs unconditionally either way. */
  initialUnreadNews?: number;
}

function CategoryIcon({ icon }: { icon: GdaCategoryIcon }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "home":
      return <svg {...common}><path d="M3 12 12 3.5 21 12"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>;
    case "customers":
      return <svg {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.4-3 4-4.4 7-4.4s5.6 1.4 7 4.4"/></svg>;
    case "document":
      return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6M9 13h6"/></svg>;
    case "calendar":
      return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/></svg>;
    case "billing":
      return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2"/><path d="m9.5 11 2.5-2.5 2.5 2.5M12 8.5V19"/></svg>;
    case "orders":
      return <svg {...common}><circle cx="9" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/><path d="M3 5h2.4l2 10.5h9.8L20 8H7"/></svg>;
    case "social":
      return <svg {...common}><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>;
    case "message":
      return <svg {...common}><path d="M20 12c0 3.9-3.6 7-8 7-1 0-2-.1-2.8-.4L5 20l1-3.2C4.7 15.6 4 13.9 4 12c0-3.9 3.6-7 8-7s8 3.1 8 7Z"/></svg>;
    case "records":
      return <svg {...common}><path d="M12 4v9M8.5 9.5 12 13l3.5-3.5M5 17v2.5h14V17"/></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4L9.6 5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.5 7.5 0 0 0 0 3l-2 1.5 2 3.5 2.4-1A7.5 7.5 0 0 0 9.6 19l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.5Z"/></svg>;
  }
}

export default function Sidebar({ open, onClose, initialPlan, initialUnreadNews }: SidebarProps) {
  const pathname = usePathname();
  const [plan, setPlan] = useState<DealerPlan | null>(initialPlan ?? null);
  const [unreadNews, setUnreadNews] = useState(initialUnreadNews ?? 0);
  const prevPathname = useRef(pathname);
  const activeCategory = categoryForPathname(pathname);

  useEffect(() => {
    if (initialPlan !== undefined) return;
    getCurrentPlan().then((info) => setPlan(info.plan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unread GYEON News badge — refreshed periodically and on navigation.
  useEffect(() => {
    let active = true;
    const load = () => getUnreadNewsCount().then((n) => { if (active) setUnreadNews(n); }).catch(() => {});
    if (initialUnreadNews === undefined) load();
    const interval = setInterval(load, 60000);
    return () => { active = false; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose?.();
    }
  }, [pathname, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed bottom-0 left-0 top-[var(--app-header-h)] z-40 w-[268px] border-r border-[#20304a] bg-[#080e1b]/95 backdrop-blur-xl transition-transform duration-300 md:top-0 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="メインメニュー"
      >
        <div className="hidden h-[124px] items-center border-b border-[#20304a] px-[22px] md:flex">
          <Brand size={63} className="w-full justify-center" />
        </div>

        <nav className="flex h-[calc(100%-52px)] flex-col gap-1 overflow-y-auto px-3 py-5 md:h-[calc(100%-190px)]">
          {GDA_CATEGORIES.map((category) => {
            const active = activeCategory.id === category.id;
            const available = category.href !== null && (!category.feature || plan === null || canUseFeature(plan, category.feature));
            const className = `group relative flex min-h-[48px] items-center gap-1 rounded-xl border px-2.5 transition-colors ${active ? "is-active border-[#31568c] bg-[#122142] text-white" : "border-transparent text-[#b4c0d4] hover:border-[#203c66] hover:bg-white/[0.035] hover:text-white"} ${available ? "" : "cursor-not-allowed opacity-55"}`;
            const content = (
              <>
                <span className={`grid h-8 w-8 shrink-0 place-items-center group-hover:text-[#61a2ff] ${active ? "text-[#61a2ff]" : "text-[#91a4c1]"}`}><CategoryIcon icon={category.icon} /></span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[0.02em]">{category.label}</span>
                <span className={`text-[9px] font-semibold tracking-[0.12em] ${active ? "text-[#8dbbff]" : "text-[#5f708d]"}`}>{category.labelEn}</span>
                {category.badge === "news" && unreadNews > 0 && (
                  <span className="absolute right-2 top-1 min-w-[17px] rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-[17px] text-white">{unreadNews > 9 ? "9+" : unreadNews}</span>
                )}
              </>
            );

            return available ? (
              <Link key={category.id} href={category.href!} className={className} aria-current={active ? "page" : undefined}>
                {active && <span className="absolute -left-3 h-8 w-1 rounded-r-full bg-[#3478ff] shadow-[0_0_12px_rgba(52,120,255,.9)]" />}
                {content}
              </Link>
            ) : (
              <div key={category.id} className={className} aria-disabled="true" title={category.id === "social-media" ? "SNS機能は準備中です" : "現在のプランでは利用できません"}>{content}</div>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-[#20304a] px-5 py-4">
          <p className="text-[10px] tracking-[0.16em] text-[#455571]">SYSTEM ONLINE · v2.6</p>
        </div>
      </aside>
    </>
  );
}
