import Link from "next/link";
import { getAdminDashboardStats } from "@/lib/admin/get-admin-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理ダッシュボード | GYEON Admin" };

function StatCard({
  value,
  label,
  sublabel,
  accent,
  href,
}: {
  value: number;
  label: string;
  sublabel?: string;
  accent?: "amber" | "red" | "blue" | "purple" | "green" | "slate";
  href?: string;
}) {
  const accentMap: Record<string, string> = {
    amber:  "border-amber-800/40  bg-amber-950/20  text-amber-300",
    red:    "border-red-800/40    bg-red-950/20    text-red-300",
    blue:   "border-blue-800/40   bg-blue-950/20   text-blue-300",
    purple: "border-purple-800/40 bg-purple-950/20 text-purple-300",
    green:  "border-green-800/40  bg-green-950/20  text-green-300",
    slate:  "border-slate-700/50  bg-slate-800/30  text-slate-300",
  };
  const colorClass = accentMap[accent ?? "slate"];
  const inner = (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${colorClass} ${href ? "hover:brightness-110 transition-all" : ""}`}>
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-xs font-semibold">{label}</span>
      {sublabel && <span className="text-[10px] opacity-60">{sublabel}</span>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <div className="space-y-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">管理ダッシュボード</h1>
          <p className="text-xs text-slate-500 mt-0.5">{today}</p>
        </div>
        <Link href="/admin/dealers" className="text-xs text-blue-400 hover:text-blue-200 transition-colors">
          店舗管理 →
        </Link>
      </div>

      {/* ── Alert: pending approvals ─────────────────────────────────────── */}
      {stats.pendingApprovals > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-800/50">
          <span className="text-amber-400 text-base">●</span>
          <p className="text-sm text-amber-200">
            <span className="font-semibold">{stats.pendingApprovals}</span> 件の承認待ち店舗があります
          </p>
          <Link href="/admin/dealers" className="ml-auto text-xs text-amber-400 hover:text-amber-200 underline shrink-0">
            確認する →
          </Link>
        </div>
      )}

      {/* ── Dealer overview stats ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">店舗概要</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard value={stats.totalDealers}     label="総店舗数"            accent="slate"  href="/admin/dealers" />
          <StatCard value={stats.pendingApprovals} label="承認待ち"            accent="amber"  href="/admin/dealers" />
          <StatCard value={stats.activeTrials}     label="トライアル中"        accent="blue"   href="/admin/plans"   />
          <StatCard value={stats.trialsEndingSoon} label="7日以内に終了"       accent={stats.trialsEndingSoon > 0 ? "red" : "slate"} href="/admin/plans" />
          <StatCard value={stats.certifiedDetailers} label="認定ディテーラー"  accent="green" />
          <StatCard value={stats.totalDealers}     label="店舗数"              accent="slate"  />
        </div>
      </section>

      {/* ── Plan distribution ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">プラン分布</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={stats.planCounts.basic}    label="Basic"    sublabel="無料プラン"               accent="slate"  href="/admin/plans" />
          <StatCard value={stats.planCounts.pro}      label="Pro"      sublabel="有料スタンダード"         accent="blue"   href="/admin/plans" />
          <StatCard value={stats.planCounts.pro_plus} label="Pro Plus" sublabel="プレミアム / トライアル"   accent="purple" href="/admin/plans" />
          <StatCard value={stats.planCounts.other}    label="その他"   sublabel="不明 / 旧プラン"          accent="slate"  />
        </div>

        {/* Visual bar */}
        {stats.totalDealers > 0 && (
          <div className="mt-3 flex rounded-full overflow-hidden h-2 bg-slate-800">
            {stats.planCounts.basic > 0 && (
              <div
                className="bg-slate-500 h-full"
                style={{ width: `${(stats.planCounts.basic / stats.totalDealers) * 100}%` }}
              />
            )}
            {stats.planCounts.pro > 0 && (
              <div
                className="bg-blue-600 h-full"
                style={{ width: `${(stats.planCounts.pro / stats.totalDealers) * 100}%` }}
              />
            )}
            {stats.planCounts.pro_plus > 0 && (
              <div
                className="bg-purple-600 h-full"
                style={{ width: `${(stats.planCounts.pro_plus / stats.totalDealers) * 100}%` }}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">クイック操作</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/admin/dealers",      label: "店舗管理",      desc: "店舗の承認・却下・管理",       icon: "⊙" },
            { href: "/admin/plans",        label: "プラン管理",    desc: "トライアル状況・プラン詳細",   icon: "◈" },
            { href: "/admin/users",        label: "ユーザー管理",  desc: "管理者・店舗ユーザー",         icon: "⊡" },
            { href: "/admin/audit",        label: "監査ログ",      desc: "すべての管理操作",             icon: "⊟" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors group"
            >
              <div className="text-xl mb-2 text-slate-500 group-hover:text-slate-300 transition-colors">{item.icon}</div>
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
