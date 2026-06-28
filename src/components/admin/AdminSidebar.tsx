"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { getVisibleNav } from "@/lib/admin/admin-roles";

// SVG icon set — 16×16 stroke-based. Uses `iconKey` prop (not `key`).
function NavIcon({ iconKey }: { iconKey: string }) {
  const cls = "w-4 h-4 flex-shrink-0";
  switch (iconKey) {
    case "dashboard": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1"/>
        <rect x="9.5" y="1" width="5.5" height="5.5" rx="1"/>
        <rect x="1" y="9.5" width="5.5" height="5.5" rx="1"/>
        <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1"/>
      </svg>
    );
    case "dealers": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 6l7-5 7 5v8a1 1 0 01-1 1H2a1 1 0 01-1-1V6z"/>
        <path d="M6 15V9h4v6"/>
      </svg>
    );
    case "plans": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="14" height="14" rx="2"/>
        <path d="M4 8h8M4 5h4M4 11h6"/>
      </svg>
    );
    case "users": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="5" r="3"/>
        <path d="M1 15c0-3 2.2-5 5-5s5 2 5 5"/>
        <path d="M11 7c1.7 0 3 1.3 3 3v1M13 4a2 2 0 010 4"/>
      </svg>
    );
    case "logistics": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="5" width="10" height="8" rx="1"/>
        <path d="M11 8h2.5l1.5 3v2h-4"/>
        <circle cx="4" cy="14" r="1.5"/>
        <circle cx="12" cy="14" r="1.5"/>
      </svg>
    );
    case "products": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1l7 4v6l-7 4-7-4V5l7-4z"/>
        <path d="M8 9V15M1 5l7 4 7-4"/>
      </svg>
    );
    case "crm": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 10c0 1-1.5 4-6 4S2 11 2 10V4c0-1 1.5-2 6-2s6 1 6 2v6z"/>
        <path d="M2 4c0 1 1.5 2 6 2s6-1 6-2"/>
      </svg>
    );
    case "ai": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="3"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/>
      </svg>
    );
    case "news": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2H2a1 1 0 00-1 1v10a1 1 0 001 1h10a2 2 0 002-2V4M11 2l3 2M11 2v2.5a.5.5 0 00.5.5H14"/>
        <path d="M4 6h5M4 9h5M4 12h3"/>
      </svg>
    );
    case "resources": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1v8M8 9L5 6.5M8 9l3-2.5"/>
        <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/>
      </svg>
    );
    case "billing": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="14" height="10" rx="1.5"/>
        <path d="M1 7h14M4 11h2M7 11h2"/>
      </svg>
    );
    case "settings": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.5"/>
        <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.2 3.2l.7.7M12.1 12.1l.7.7M3.2 12.8l.7-.7M12.1 3.9l.7-.7"/>
      </svg>
    );
    case "audit": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
        <path d="M5 5h6M5 8h6M5 11h4"/>
      </svg>
    );
    default: return <span className="w-4 h-4 text-xs flex items-center justify-center">◈</span>;
  }
}

export default function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const items = getVisibleNav(role);

  const live = items.filter((i) => !i.soon);
  const soon = items.filter((i) =>  i.soon);

  function isActive(href: string) {
    if (href === "/admin/dashboard") return pathname === href || pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex flex-col p-3">
      {live.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-0.5 ${
            isActive(item.href)
              ? "bg-blue-600/20 text-blue-300 border border-blue-700/30"
              : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
          }`}
        >
          <NavIcon iconKey={item.iconKey} />
          {item.label}
        </Link>
      ))}

      {soon.length > 0 && (
        <>
          <div className="my-3 border-t border-slate-800/60" />
          <p className="px-3 text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-2">
            Coming soon
          </p>
          {soon.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-700 cursor-not-allowed select-none mb-0.5"
            >
              <NavIcon iconKey={item.iconKey} />
              {item.label}
              <span className="ml-auto text-[8px] border border-slate-800 rounded px-1 py-px text-slate-700">
                soon
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
