"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getCurrentPlan } from "@/lib/plans/get-current-plan";
import { canUseFeature, DealerPlan } from "@/lib/plans/plan-types";
import type { AppFeature } from "@/lib/plans/plan-types";
import { getUnreadNewsCount } from "@/lib/news/news";

type NavItem =
  | { type: "link"; href: string; label: string; icon: string; feature?: AppFeature }
  | { type: "flow-arrow" };

const navItems: NavItem[] = [
  { type: "link", href: "/",                  label: "ダッシュボード", icon: "▦" },

  { type: "link", href: "/customers",         label: "顧客管理",   icon: "⊙", feature: "customers" },
  { type: "flow-arrow" },
  { type: "link", href: "/vehicles",          label: "車両管理",   icon: "⊡", feature: "vehicles" },
  { type: "flow-arrow" },
  { type: "link", href: "/estimates",         label: "見積管理",   icon: "⊛", feature: "estimates" },
  { type: "flow-arrow" },
  { type: "link", href: "/calendar",          label: "カレンダー", icon: "◷", feature: "calendar" },
  { type: "flow-arrow" },
  { type: "link", href: "/reservations",      label: "予約管理",   icon: "◈", feature: "reservations" },
  { type: "flow-arrow" },
  { type: "link", href: "/work-orders",       label: "施工指示",   icon: "⊟", feature: "work_orders" },
  { type: "flow-arrow" },
  { type: "link", href: "/completion-reports",label: "完了報告",   icon: "✓", feature: "completion_reports" },
  { type: "flow-arrow" },
  { type: "link", href: "/invoices",          label: "請求管理",   icon: "⊝", feature: "invoices" },
  { type: "flow-arrow" },
  { type: "link", href: "/payments",          label: "入金管理",   icon: "⊕", feature: "payments" },
  { type: "flow-arrow" },
  { type: "link", href: "/pdf",               label: "PDF",        icon: "⊠", feature: "estimate_pdf" },

  { type: "link", href: "/products",          label: "商品管理",   icon: "⊗", feature: "products" },
  { type: "link", href: "/inventory",         label: "在庫カウント", icon: "⊜", feature: "products" },
  { type: "link", href: "/product-orders",    label: "商品注文",   icon: "⊘", feature: "product_orders" },
  { type: "link", href: "/line",              label: "LINE",       icon: "⊿", feature: "line" },
  { type: "link", href: "/maintenance",       label: "メンテナンス", icon: "◉", feature: "maintenance" },
  { type: "link", href: "/ocr-sessions",      label: "OCR履歴",    icon: "🪪" },
  { type: "link", href: "/news",              label: "お知らせ",   icon: "📢" },
  { type: "link", href: "/downloads",         label: "ダウンロード", icon: "⬇" },
  { type: "link", href: "/points",            label: "ポイント",   icon: "★" },
  { type: "link", href: "/customer-app",      label: "顧客アプリ", icon: "📱" },
  { type: "link", href: "/settings",          label: "設定",       icon: "⊞" },
];

interface SidebarProps {
  open:     boolean;
  onClose?: () => void;
  /** GLOBAL_SHELL_POST_C5: server-resolved plan from MainLayout. When
      supplied, Sidebar skips its own getCurrentPlan() mount fetch. */
  initialPlan?: DealerPlan;
  /** GLOBAL_SHELL_POST_C7: server-resolved unread news count from
      MainLayout. When supplied, Sidebar skips its own getUnreadNewsCount()
      mount fetch; the 60s poll still runs unconditionally either way. */
  initialUnreadNews?: number;
}

export default function Sidebar({ open, onClose, initialPlan, initialUnreadNews }: SidebarProps) {
  const pathname = usePathname();
  const [plan, setPlan] = useState<DealerPlan | null>(initialPlan ?? null);
  const [unreadNews, setUnreadNews] = useState(initialUnreadNews ?? 0);
  const prevPathname = useRef(pathname);

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

  // Close sidebar when the user navigates (mobile UX)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose?.();
    }
  }, [pathname, onClose]);

  // Build visible items: filter links by plan (but keep flow-arrows only between visible links)
  const visibleItems: NavItem[] = [];
  let prevWasVisibleLink = false;

  for (let i = 0; i < navItems.length; i++) {
    const item = navItems[i];

    if (item.type === "flow-arrow") {
      if (prevWasVisibleLink) {
        visibleItems.push(item);
        prevWasVisibleLink = false;
      }
      continue;
    }

    const allowed = !item.feature || plan === null || canUseFeature(plan, item.feature);
    if (allowed) {
      prevWasVisibleLink = true;
      visibleItems.push(item);
    } else {
      if (visibleItems.length > 0 && visibleItems[visibleItems.length - 1].type === "flow-arrow") {
        visibleItems.pop();
      }
      prevWasVisibleLink = false;
    }
  }

  if (visibleItems.length > 0 && visibleItems[visibleItems.length - 1].type === "flow-arrow") {
    visibleItems.pop();
  }

  return (
    <>
      {/* Mobile backdrop — tapping closes sidebar */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          top: "var(--app-header-h)",
          background: "linear-gradient(180deg, var(--gs-bg-2) 0%, var(--gs-bg) 100%)",
        }}
        className={`w-[240px] border-r border-[var(--gs-line)] fixed bottom-0 left-0 z-40 flex flex-col backdrop-blur-md transition-transform duration-300 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {visibleItems.map((item, i) => {
              if (item.type === "flow-arrow") {
                return (
                  <div key={i} className="flex items-center pl-[22px] py-0.5">
                    <div className="w-px h-3 bg-[var(--gs-line-strong)] ml-[10px]" />
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-[var(--gs-r-sm)] text-sm transition-colors min-h-[44px] border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gs-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gs-bg)] ${
                    isActive
                      ? "bg-[var(--gs-blue-dim)] border-[var(--gs-line-strong)] text-[var(--gs-text)]"
                      : "text-[var(--gs-text-2)] hover:text-[var(--gs-text)] hover:bg-white/[0.04] hover:border-[var(--gs-line)]"
                  }`}
                >
                  <span
                    className="text-base shrink-0"
                    style={{ color: isActive ? "var(--gs-blue)" : undefined }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.href === "/news" && unreadNews > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {unreadNews > 9 ? "9+" : unreadNews}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-3 pt-4 pb-6 border-t border-[var(--gs-line)]">
          <p className="text-xs px-3" style={{ color: "var(--gs-text-3)" }}>v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
