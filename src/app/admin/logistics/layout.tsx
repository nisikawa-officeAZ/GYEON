"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LOGISTICS_NAV = [
  { key: "dashboard",    label: "Dashboard",     href: "/admin/logistics/dashboard" },
  { key: "receiving",    label: "Receiving",     href: "/admin/logistics/receiving" },
  { key: "inventory",    label: "Inventory",     href: "/admin/logistics/inventory" },
  { key: "backorders",   label: "Backorders",    href: "/admin/logistics/backorders" },
  { key: "shipments",    label: "Shipments",     href: "/admin/logistics/shipments" },
  { key: "stocktaking",  label: "棚卸し",        href: "/admin/logistics/stocktaking" },
  { key: "adjustments",  label: "Adjustments",   href: "/admin/logistics/adjustments" },
  { key: "movements",    label: "Movements",     href: "/admin/logistics/movements" },
  { key: "po-receiving", label: "PO Receiving",  href: "/admin/logistics/po-receiving" },
];

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {LOGISTICS_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={[
                  "relative flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap",
                  "border-b-2 -mb-px transition-colors",
                  isActive
                    ? "border-green-500 text-green-400"
                    : "border-transparent text-slate-400 hover:text-slate-200",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
}
