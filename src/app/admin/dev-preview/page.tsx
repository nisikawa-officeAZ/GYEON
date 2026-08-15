import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDevPreviewHub } from "@/lib/ai/dev-preview-checks";
import type { HubCardStatus } from "@/lib/ai/dev-preview-checks";
import { getSystemDoctorReport } from "@/lib/ai/system-doctor";
import type { DoctorStatus } from "@/lib/ai/system-doctor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Developer Preview Center | GYEON Admin" };

const STATUS_META: Record<HubCardStatus, { icon: string; cls: string; chip: string }> = {
  pass:   { icon: "✓", cls: "text-green-400", chip: "text-green-300 bg-green-900/40 border-green-700/50" },
  fail:   { icon: "✕", cls: "text-red-400",   chip: "text-red-300 bg-red-900/40 border-red-700/50" },
  warn:   { icon: "!", cls: "text-amber-400", chip: "text-amber-300 bg-amber-900/30 border-amber-700/50" },
  manual: { icon: "—", cls: "text-slate-400", chip: "text-slate-400 bg-slate-800 border-slate-700" },
};
const STATUS_LABEL: Record<HubCardStatus, string> = { pass: "PASS", fail: "FAIL", warn: "要確認", manual: "手動" };

const DOCTOR_META: Record<DoctorStatus, { label: string; dot: string; chip: string }> = {
  normal:  { label: "正常",   dot: "bg-green-400", chip: "text-green-300 bg-green-900/40 border-green-700/50" },
  warning: { label: "警告",   dot: "bg-amber-400", chip: "text-amber-300 bg-amber-900/30 border-amber-700/50" },
  error:   { label: "エラー", dot: "bg-red-400",   chip: "text-red-300 bg-red-900/40 border-red-700/50" },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function DevPreviewCenterPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "super_admin") redirect("/admin/dashboard");

  const [{ cards, diagnostics, checkedAt }, doctor] = await Promise.all([
    getDevPreviewHub(),
    getSystemDoctorReport(),
  ]);

  const diag: { label: string; value: string }[] = [
    { label: "環境",            value: diagnostics.environment },
    { label: "DBバージョン",     value: diagnostics.dbVersion ?? "—" },
    { label: "マイグレーション",  value: diagnostics.migrationVersion },
    { label: "ビルド",          value: diagnostics.buildVersion },
    { label: "Git",             value: diagnostics.gitCommit ? diagnostics.gitCommit.slice(0, 7) : "—" },
    { label: "AIプロバイダ",     value: diagnostics.provider },
    { label: "OpenAI状態",      value: diagnostics.openaiStatus === "success" ? "接続成功" : diagnostics.openaiStatus === "failed" ? "接続失敗" : "未テスト" },
    { label: "最終OCR",         value: fmt(diagnostics.lastOcrAt) },
    { label: "最終AIリクエスト", value: fmt(diagnostics.lastAiRequestAt) },
    { label: "最終エラー",       value: diagnostics.lastFailedError ? `${diagnostics.lastFailedError} (${fmt(diagnostics.lastFailedAt)})` : "なし" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Developer Preview Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">開発プレビュー統合検証（{fmt(checkedAt)} 時点）</p>
        </div>
        <Link href="/admin/dev-preview" className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded px-3 py-1.5">
          再チェック
        </Link>
      </div>

      {/* Diagnostics strip */}
      <section className="rounded-lg border border-slate-800 bg-[#0b1120] p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2">
          {diag.map((d) => (
            <div key={d.label} className="min-w-0">
              <div className="text-[10px] text-slate-500">{d.label}</div>
              <div className="text-[11px] text-slate-200 truncate font-mono">{d.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 9 status cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const m = STATUS_META[c.status];
          return (
            <Link
              key={c.key}
              href={c.href}
              className="rounded-lg border border-slate-800 bg-[#0b1120] p-3 hover:border-slate-600 transition-colors flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">{c.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.chip}`}>
                  <span className={m.cls}>{m.icon}</span> {STATUS_LABEL[c.status]}
                </span>
              </div>
              {c.detail && <div className="text-[10px] text-slate-500 truncate">{c.detail}</div>}
              {c.latestError && <div className="text-[10px] text-red-400/80 truncate">最新エラー: {c.latestError}</div>}
              <div className="text-[9px] text-slate-600 mt-auto">確認: {fmt(checkedAt)}</div>
            </Link>
          );
        })}
      </section>

      {/* System Health / AI Doctor (read-only foundation) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">System Health / AI Doctor</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">読み取り専用の自己診断（自動修復は行いません）</p>
          </div>
          <span className="text-[10px] text-slate-600 border border-slate-800 rounded px-2 py-0.5">診断のみ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {doctor.cards.map((c) => {
            const m = DOCTOR_META[c.status];
            return (
              <div key={c.key} className="rounded-lg border border-slate-800 bg-[#0b1120] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${m.dot} shrink-0`} />
                    <span className="text-xs font-semibold text-slate-200 truncate">{c.label}</span>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${m.chip}`}>{m.label}</span>
                </div>
                {c.latestError && <div className="text-[10px] text-red-400/80 truncate" title={c.latestError}>{c.latestError}</div>}
                {c.suggestedFix && <div className="text-[10px] text-slate-500 line-clamp-2">対処: {c.suggestedFix}</div>}
                <div className="text-[9px] text-slate-600 mt-auto">確認: {fmt(c.lastChecked)}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-amber-400/80 border border-amber-800/30 bg-amber-900/10 rounded px-3 py-2">
          ロードマップ: {doctor.roadmapNote}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/dev-preview/ai-verification" className="text-xs text-slate-400 hover:text-slate-200 underline">→ AI検証（詳細）</Link>
        <Link href="/admin/dev-preview/checklist" className="text-xs text-slate-400 hover:text-slate-200 underline">→ チェックリスト</Link>
        <Link href="/admin/ai-center" className="text-xs text-slate-400 hover:text-slate-200 underline">→ AIセンター</Link>
      </div>
    </div>
  );
}
