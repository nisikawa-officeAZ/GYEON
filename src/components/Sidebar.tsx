"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentPlan } from "@/lib/plans/get-current-plan";
import { canUseFeature, DealerPlan } from "@/lib/plans/plan-types";
import type { AppFeature } from "@/lib/plans/plan-types";

type NavItem =
  | { type: "link"; href: string; label: string; icon: string; feature?: AppFeature }
  | { type: "flow-arrow" };

const navItems: NavItem[] = [
  { type: "link", href: "/",                  label: "Dashboard",      icon: "▦" },

  { type: "link", href: "/customers",         label: "Customers",      icon: "⊙", feature: "customers" },
  { type: "flow-arrow" },
  { type: "link", href: "/vehicles",          label: "Vehicles",       icon: "⊡", feature: "vehicles" },
  { type: "flow-arrow" },
  { type: "link", href: "/estimates",         label: "Estimates",      icon: "⊛", feature: "estimates" },
  { type: "flow-arrow" },
  { type: "link", href: "/calendar",          label: "Calendar",       icon: "◷", feature: "calendar" },
  { type: "flow-arrow" },
  { type: "link", href: "/reservations",      label: "Reservations",   icon: "◈", feature: "reservations" },
  { type: "flow-arrow" },
  { type: "link", href: "/work-orders",       label: "Work Orders",    icon: "⊟", feature: "work_orders" },
  { type: "flow-arrow" },
  { type: "link", href: "/completion-reports",label: "Reports",        icon: "✓", feature: "completion_reports" },
  { type: "flow-arrow" },
  { type: "link", href: "/invoices",          label: "Invoices",       icon: "⊝", feature: "invoices" },
  { type: "flow-arrow" },
  { type: "link", href: "/payments",          label: "Payments",       icon: "⊕", feature: "payments" },
  { type: "flow-arrow" },
  { type: "link", href: "/pdf",               label: "PDF",            icon: "⊠", feature: "estimate_pdf" },

  { type: "link", href: "/products",          label: "Products",       icon: "⊗", feature: "products" },
  { type: "link", href: "/product-orders",    label: "Product Orders", icon: "⊘", feature: "product_orders" },
  { type: "link", href: "/line",              label: "LINE",           icon: "⊿", feature: "line" },
  { type: "link", href: "/maintenance",       label: "Maintenance",    icon: "◉", feature: "maintenance" },
  { type: "link", href: "/settings",          label: "Settings",       icon: "⊞" },
];

interface SidebarProps {
  open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
  const pathname = usePathname();
  const [plan, setPlan] = useState<DealerPlan | null>(null);

  useEffect(() => {
    getCurrentPlan().then((info) => setPlan(info.plan));
  }, []);

  // Build visible items: filter links by plan (but keep flow-arrows only between visible links)
  const visibleItems: NavItem[] = [];
  let prevWasVisibleLink = false;

  for (let i = 0; i < navItems.length; i++) {
    const item = navItems[i];

    if (item.type === "flow-arrow") {
      // Defer — add only if the next visible item is a link
      if (prevWasVisibleLink) {
        visibleItems.push(item);
        prevWasVisibleLink = false; // will be corrected if next link is visible
      }
      continue;
    }

    // link item
    const allowed = !item.feature || plan === null || canUseFeature(plan, item.feature);
    if (allowed) {
      // If last pushed item is a dangling flow-arrow and this link is visible — that arrow stands
      prevWasVisibleLink = true;
      visibleItems.push(item);
    } else {
      // This link is hidden — remove any dangling flow-arrow at the end
      if (visibleItems.length > 0 && visibleItems[visibleItems.length - 1].type === "flow-arrow") {
        visibleItems.pop();
      }
      prevWasVisibleLink = false;
    }
  }

  // Remove trailing flow-arrow if last item
  if (visibleItems.length > 0 && visibleItems[visibleItems.length - 1].type === "flow-arrow") {
    visibleItems.pop();
  }

  return (
    <aside
      className={`w-[240px] bg-slate-900 border-r border-slate-800 fixed top-14 bottom-0 left-0 z-40 flex flex-col transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <nav className="flex-1 px-2 py-4">
        <div className="space-y-0.5">
          {visibleItems.map((item, i) => {
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
