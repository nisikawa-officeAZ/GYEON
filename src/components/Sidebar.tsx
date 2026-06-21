"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { type: "link"; href: string; label: string; icon: string }
  | { type: "flow-arrow" };

const navItems: NavItem[] = [
  { type: "link", href: "/", label: "Dashboard", icon: "▦" },

  { type: "link", href: "/customers", label: "Customers", icon: "⊙" },
  { type: "flow-arrow" },
  { type: "link", href: "/vehicles", label: "Vehicles", icon: "⊡" },
  { type: "flow-arrow" },
  { type: "link", href: "/estimates", label: "Estimates", icon: "⊛" },
  { type: "flow-arrow" },
  { type: "link", href: "/work-orders", label: "Work Orders", icon: "⊟" },
  { type: "flow-arrow" },
  { type: "link", href: "/completion-reports", label: "Reports", icon: "✓" },
  { type: "flow-arrow" },
  { type: "link", href: "/invoices", label: "Invoices", icon: "⊝" },
  { type: "flow-arrow" },
  { type: "link", href: "/payments", label: "Payments", icon: "⊕" },
  { type: "flow-arrow" },
  { type: "link", href: "/pdf", label: "PDF", icon: "⊠" },

  { type: "link", href: "/line", label: "LINE", icon: "⊿" },
  { type: "link", href: "/settings", label: "Settings", icon: "⊞" },
];

interface SidebarProps {
  open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`w-[240px] bg-slate-900 border-r border-slate-800 fixed top-14 bottom-0 left-0 z-40 flex flex-col transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <nav className="flex-1 px-2 py-4">
        <div className="space-y-0.5">
          {navItems.map((item, i) => {
            if (item.type === "flow-arrow") {
              return (
                <div key={i} className="flex items-center pl-[22px] py-0.5">
                  <div className="w-px h-3 bg-slate-700 ml-[10px]" />
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-[#1d4ed8] text-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-3 pt-4 pb-6 border-t border-slate-800">
        <p className="text-xs text-slate-600 px-3">v0.1.0-dev</p>
      </div>
    </aside>
  );
}
