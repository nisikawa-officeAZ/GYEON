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
            概要
          </Link>
          <Link href="/admin/dealers" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            ディーラー管理
          </Link>
          <Link href="/admin/users" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            ユーザー管理
          </Link>
          <Link href="/admin/subscriptions" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            契約プラン
          </Link>
          <Link href="/admin/audit" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            監査ログ
          </Link>
          <Link href="/admin/release-readiness" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            リリース確認
          </Link>
          <Link href="/admin/migration-status" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            マイグレーション状態
          </Link>
          <Link href="/admin/staging-verification" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            ステージング検証
          </Link>
          <Link href="/admin/uat" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            受入テスト
          </Link>
          <Link href="/admin/billing" className="text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            請求管理
          </Link>
          <Link href="/admin/release-candidate" className="text-xs text-amber-400 hover:text-amber-200 px-3 py-1.5 rounded hover:bg-amber-950/40 border border-amber-800/40 transition-colors">
            RC確認
          </Link>
          <Link href="/admin/official-release" className="text-xs text-amber-300 hover:text-amber-100 px-3 py-1.5 rounded hover:bg-amber-900/50 border border-amber-600/50 bg-amber-950/20 font-semibold transition-colors">
            正式リリース
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
