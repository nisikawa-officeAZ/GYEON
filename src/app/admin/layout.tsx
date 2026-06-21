import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin | GYEON Detailer Agent" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-100">
      {/* Admin Header */}
      <header className="h-12 bg-[#0f172a] border-b border-red-900/30 flex items-center px-6 gap-4 fixed top-0 left-0 right-0 z-50">
        <span className="text-xs font-bold tracking-widest text-red-400 uppercase px-2 py-0.5 border border-red-700/50 rounded">
          ADMIN
        </span>
        <span className="text-sm font-semibold text-slate-300">GYEON Admin Console</span>
        <nav className="flex items-center gap-1 ml-4">
          <Link href="/admin" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            Overview
          </Link>
          <Link href="/admin/dealers" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            Dealers
          </Link>
          <Link href="/admin/users" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            Users
          </Link>
          <Link href="/admin/audit" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            Audit
          </Link>
        </nav>
        <div className="flex-1" />
        <span className="text-xs text-slate-500">{admin.email ?? admin.name ?? "Admin"}</span>
      </header>

      <main className="pt-12 p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
