"use client";

// BottomNav — GenSpark Design System (RC-10)
// Layout: [Home] [Customers] [FAB: 新規見積] [WorkOrders] [Maintenance]
// The FAB (Floating Action Button) is the center item, elevated with a blue glow.
// Only visible on mobile (md:hidden).

import Link from "next/link";
import { usePathname } from "next/navigation";

// SVG icon components — all 24×24 viewBox, stroke-based
function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9"/>
      <path d="M5 10v10h5v-5h4v5h5V10"/>
    </svg>
  );
}
function IconCustomers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}
function IconWorkOrders() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M3 10h18M8 4v4M16 4v4"/>
    </svg>
  );
}
function IconMaintenance() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  );
}

const LEFT_TABS = [
  { href: "/",          icon: <IconHome />,       label: "ホーム" },
  { href: "/customers", icon: <IconCustomers />,  label: "顧客" },
] as const;

const RIGHT_TABS = [
  { href: "/work-orders", icon: <IconWorkOrders />,   label: "施工" },
  { href: "/maintenance", icon: <IconMaintenance />,  label: "メンテ" },
] as const;

const FAB_HREF = "/estimates";

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const fabActive = pathname.startsWith(FAB_HREF);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{
        background:     "rgba(10,10,15,0.95)",
        borderTop:      "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom:  "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center" style={{ height: "56px" }}>

        {/* Left tabs */}
        {LEFT_TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors"
              style={{ color: active ? "var(--gs-blue)" : "var(--gs-text-3)" }}
            >
              {tab.icon}
              <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.3px" }}>
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* FAB — center raised button */}
        <div className="flex-none flex flex-col items-center justify-center" style={{ width: "72px" }}>
          <Link
            href={FAB_HREF}
            style={{
              width:        "52px",
              height:       "52px",
              borderRadius: "50%",
              background:   fabActive
                ? "linear-gradient(135deg, #6aa3fa, #4f8ef7)"
                : "var(--gs-blue)",
              boxShadow:    fabActive
                ? "0 8px 28px rgba(79,142,247,0.6)"
                : "0 8px 24px rgba(79,142,247,0.45)",
              display:      "grid",
              placeItems:   "center",
              marginTop:    "-20px",
              flexShrink:   0,
              transition:   "box-shadow 0.2s, background 0.2s",
            }}
            aria-label="新規見積作成"
          >
            <IconPlus />
          </Link>
        </div>

        {/* Right tabs */}
        {RIGHT_TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors"
              style={{ color: active ? "var(--gs-blue)" : "var(--gs-text-3)" }}
            >
              {tab.icon}
              <span style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.3px" }}>
                {tab.label}
              </span>
            </Link>
          );
        })}

      </div>
    </nav>
  );
}
