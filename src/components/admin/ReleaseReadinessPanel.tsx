"use client";

// PHASE60: Admin release readiness panel.
// Displays the result of getReleaseReadinessStatus() as a structured checklist.

import type { ReleaseReadinessReport, ReadinessCheck } from "@/lib/release/readiness";

interface Props {
  report: ReleaseReadinessReport;
}

function StatusIcon({ status }: { status: ReadinessCheck["status"] }) {
  if (status === "pass")    return <span className="text-green-400 font-bold text-sm">✓</span>;
  if (status === "warning") return <span className="text-amber-400 font-bold text-sm">⚠</span>;
  return <span className="text-red-400 font-bold text-sm">✗</span>;
}

function OverallBadge({ overall }: { overall: ReleaseReadinessReport["overall"] }) {
  if (overall === "ready") {
    return (
      <span className="px-3 py-1 rounded-full bg-green-900/50 text-green-300 text-xs font-bold border border-green-700/50">
        準備完了
      </span>
    );
  }
  if (overall === "warning") {
    return (
      <span className="px-3 py-1 rounded-full bg-amber-900/50 text-amber-300 text-xs font-bold border border-amber-700/50">
        警告
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-red-900/50 text-red-300 text-xs font-bold border border-red-700/50">
      ブロック
    </span>
  );
}

export default function ReleaseReadinessPanel({ report }: Props) {
  const passCount   = report.checks.filter(c => c.status === "pass").length;
  const warnCount   = report.checks.filter(c => c.status === "warning").length;
  const failCount   = report.checks.filter(c => c.status === "fail").length;

  const checkedAt = new Date(report.checkedAt).toLocaleString("ja-JP", {
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Overall status header */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-sm font-semibold text-slate-100">リリース全体ステータス</h2>
            <OverallBadge overall={report.overall} />
          </div>
          <p className="text-xs text-slate-500">
            確認日時: {checkedAt} —{" "}
            <span className="text-green-400">合格 {passCount}件</span>
            {warnCount > 0 && <>, <span className="text-amber-400">警告 {warnCount}件</span></>}
            {failCount > 0 && <>, <span className="text-red-400">不合格 {failCount}件</span></>}
          </p>
        </div>
        {report.overall === "blocked" && (
          <p className="text-xs text-red-400 max-w-xs">
            すべてのブロック項目が解消されるまで、本番デプロイは禁止されています。
          </p>
        )}
        {report.overall === "warning" && (
          <p className="text-xs text-amber-400 max-w-xs">
            本番へデプロイする前に警告を確認してください。
          </p>
        )}
        {report.overall === "ready" && (
          <p className="text-xs text-green-400 max-w-xs">
            すべてのチェックに合格しました。デプロイ前に PRODUCTION_READINESS_CHECKLIST.md 全体を確認してください。
          </p>
        )}
      </div>

      {/* Checks table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium w-8">ステータス</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">チェック項目</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">メッセージ</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((check, i) => (
              <tr
                key={check.key}
                className={[
                  "border-b border-slate-800/50 last:border-0",
                  check.status === "fail"    ? "bg-red-950/20"    : "",
                  check.status === "warning" ? "bg-amber-950/10"  : "",
                  i % 2 === 0 && check.status === "pass" ? "bg-slate-900/20" : "",
                ].join(" ")}
              >
                <td className="px-4 py-2.5 text-center">
                  <StatusIcon status={check.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-200 font-medium whitespace-nowrap">
                  {check.label}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {check.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="text-green-400 font-bold">✓</span> 合格 — 要件を満たしています
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-amber-400 font-bold">⚠</span> 警告 — 確認を推奨します
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-red-400 font-bold">✗</span> 不合格 — デプロイがブロックされます
        </span>
      </div>

      {/* Docs links */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <p className="text-xs text-slate-400 font-semibold mb-2">参考ドキュメント</p>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>docs/PRODUCTION_READINESS_CHECKLIST.md — 完全な手動チェックリスト</li>
          <li>docs/MIGRATION_APPLICATION_ORDER.md — この順序でマイグレーションを適用</li>
          <li>docs/ENVIRONMENT_RELEASE_CHECKLIST.md — 環境変数の検証</li>
          <li>docs/RLS_VERIFICATION_CHECKLIST.md — 行レベルセキュリティの検証</li>
          <li>docs/STORAGE_VERIFICATION_CHECKLIST.md — ストレージバケットの検証</li>
          <li>docs/LINE_RELEASE_CHECKLIST.md — LINE 連携の検証</li>
          <li>docs/PDF_RELEASE_CHECKLIST.md — PDF 生成の検証</li>
          <li>docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md — サブスクリプションとオンボーディングの検証</li>
        </ul>
      </div>
    </div>
  );
}
