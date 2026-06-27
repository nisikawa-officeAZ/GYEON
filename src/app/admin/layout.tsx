import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { ADMIN_ROLE_META } from "@/lib/admin/admin-roles";
import type { AdminRole } from "@/lib/admin/admin-roles";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin | GYEON Business Hub" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const roleMeta = ADMIN_ROLE_META[admin.role as AdminRole]
    ?? { label: admin.role, color: "text-slate-400 bg-slate-800 border-slate-700" };

  return (
    <div className="min-h-screen bg-[#070c16] text-slate-100">

      {/* ── Fixed top bar ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-12 z-50 bg-[#0b1120] border-b border-slate-800/80 flex items-center px-4 gap-3">
        {/* Brand */}
        <Link href="/admin/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black tracking-[3px] text-red-400 border border-red-800/60 px-1.5 py-0.5 rounded">
            ADMIN
          </span>
          <span className="text-sm font-semibold text-slate-200 hidden sm:block">
            GYEON <span className="text-slate-500">Business Hub</span>
          </span>
        </Link>

        <div className="flex-1" />

        {/* Internal dev tools (small, right side) */}
        <nav className="hidden xl:flex items-center gap-0.5">
          {[
            { href: "/admin/subscriptions",       label: "Subscriptions" },
            { href: "/admin/release-readiness",   label: "Release" },
            { href: "/admin/migration-status",    label: "Migrations" },
            { href: "/admin/staging-verification",label: "Staging" },
            { href: "/admin/uat",                 label: "UAT" },
            { href: "/admin/release-candidate",   label: "RC" },
            { href: "/admin/official-release",    label: "OfficialRelease" },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="text-[10px] text-slate-600 hover:text-slate-400 px-2 py-1 rounded transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Admin identity */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${roleMeta.color}`}>
            {roleMeta.label}
          </span>
          <span className="text-xs text-slate-500 hidden sm:block">
            {admin.email ?? admin.name ?? "Admin"}
          </span>
        </div>
      </header>

      {/* ── Fixed left sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed top-12 left-0 bottom-0 w-52 bg-[#070c16] border-r border-slate-800/60 overflow-y-auto z-40">
        {/* Sidebar brand sub-label */}
        <div className="px-4 pt-5 pb-3 border-b border-slate-800/40">
          <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">
            Business Hub Admin
          </p>
        </div>
        <AdminSidebar role={admin.role} />
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <main className="ml-52 pt-12 min-h-screen">
        <div className="p-6 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
