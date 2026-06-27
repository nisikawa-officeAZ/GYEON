"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB_ITEMS = [
  { href: "/",            icon: "▦", label: "ホーム" },
  { href: "/customers",   icon: "⊙", label: "顧客" },
  { href: "/estimates",   icon: "⊛", label: "見積" },
  { href: "/work-orders", icon: "⊟", label: "施工" },
  { href: "/maintenance", icon: "◉", label: "メンテ" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 safe-area-inset-bottom">
      <div className="flex items-stretch h-14">
        {TAB_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? "text-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-blue-500 rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
