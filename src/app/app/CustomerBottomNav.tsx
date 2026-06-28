"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app",              label: "ホーム",   icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/app/vehicles",     label: "車両",     icon: "M3 13l2-5h14l2 5M5 13h14v5H5z M7 18v2 M17 18v2" },
  { href: "/app/reservations", label: "予約",     icon: "M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4" },
  { href: "/app/points",       label: "ポイント", icon: "M12 3l2.5 5 5.5.8-4 3.9 1 5.5L12 21l-5-2.8 1-5.5-4-3.9 5.5-.8z" },
  { href: "/app/menu",         label: "その他",   icon: "M4 6h16 M4 12h16 M4 18h16" },
];

export default function CustomerBottomNav() {
  const pathname = usePathname();
  function active(href: string) {
    if (href === "/app") return pathname === "/app";
    return pathname === href || pathname.startsWith(href + "/");
  }
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40"
      style={{
        background: "rgba(8,13,26,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-stretch h-14">
        {TABS.map((t) => {
          const on = active(t.href);
          return (
            <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ color: on ? "#4f8ef7" : "#55556a" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              <span className="text-[9px] font-medium">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
