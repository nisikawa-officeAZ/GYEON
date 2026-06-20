"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/customers", label: "Customers", icon: "⊙" },
  { href: "/vehicles", label: "Vehicles", icon: "⊡" },
  { href: "/estimates", label: "Estimates", icon: "⊛" },
  { href: "/pdf", label: "PDF", icon: "⊠" },
  { href: "/settings", label: "Settings", icon: "⊞" },
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
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
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
      </nav>

      <div className="px-3 pt-4 pb-6 border-t border-slate-800">
        <p className="text-xs text-slate-600 px-3">v0.1.0-dev</p>
      </div>
    </aside>
  );
}
