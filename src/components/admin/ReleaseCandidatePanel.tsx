"use client";

// PHASE65: Release Candidate status panel.

import type { RcStatusReport, RcCategory, RcCheckStatus, RcOverallStatus } from "@/lib/release/rc-status";

// ─── Status indicators ────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: RcCheckStatus }) {
  if (status === "pass")    return <span className="text-green-400 font-bold">✓</span>;
  if (status === "warning") return <span className="text-amber-400 font-bold">⚠</span>;
  return <span className="text-red-400 font-bold">✗</span>;
}

function OverallBadge({ status }: { status: RcOverallStatus }) {
  const map: Record<RcOverallStatus, { label: string; cls: string }> = {
    ready:   { label: "準備完了", cls: "text-green-300 border-green-700/50 bg-green-950/40" },
    warning: { label: "警告",     cls: "text-amber-300 border-amber-700/50 bg-amber-950/40" },
    blocked: { label: "ブロック", cls: "text-red-300 border-red-700/50 bg-red-950/40"       },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-sm font-bold px-3 py-1 rounded-lg border ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct   = Math.round((score / max) * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-200 w-16 text-right">
        {score} / {max}
      </span>
    </div>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: RcCategory }) {
  const pct   = Math.round((cat.earned / cat.points) * 100);
  const color = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800/50 last:border-0">
      <div className="mt-0.5 shrink-0">
        <StatusIcon status={cat.status} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-medium text-slate-200">{cat.label}</p>
          <span className="text-[10px] text-slate-500 shrink-0">{cat.earned} / {cat.points} pts</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden mb-1.5">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>

        {/* Sub-checks */}
        <div className="flex flex-col gap-0.5 mt-1">
          {cat.checks.map(c => (
            <div key={c.key} className="flex items-start gap-2">
              <StatusIcon status={c.status} />
              <span className="text-[10px] text-slate-500 leading-tight">{c.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  report: RcStatusReport;
}

export default function ReleaseCandidatePanel({ report }: Props) {
  const { version, status, score, maxScore, categories, checkedAt } = report;

  const passCount  = categories.filter(c => c.status === "pass").length;
  const warnCount  = categories.filter(c => c.status === "warning").length;
  const blockCount = categories.filter(c => c.status === "fail").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Version + Overall Status */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">バージョン</p>
            <p className="text-2xl font-bold text-slate-100">{version}</p>
            <p className="text-xs text-slate-500 mt-0.5">GYEON Detailer Agent</p>
          </div>
          <OverallBadge status={status} />
        </div>

        {/* Score */}
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">リリーススコア</p>
        <ScoreBar score={score} max={maxScore} />

        {/* Category summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl border border-green-700/30 bg-green-950/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{passCount}</p>
            <p className="text-[10px] text-green-600">合格</p>
          </div>
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{warnCount}</p>
            <p className="text-[10px] text-amber-600">警告</p>
          </div>
          <div className="rounded-xl border border-red-700/30 bg-red-950/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{blockCount}</p>
            <p className="text-[10px] text-red-600">ブロック</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-600 mt-3">
          確認日時 {checkedAt.replace("T", " ").slice(0, 19)} UTC
        </p>
      </div>

      {/* RC Go/No-Go */}
      {status === "ready" ? (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-green-700/40 bg-green-950/20">
          <span className="text-green-400 shrink-0">✓</span>
          <div>
            <p className="text-xs font-semibold text-green-300">RC1 検証準備完了</p>
            <p className="text-[10px] text-green-400/80 mt-0.5">
              すべてのカテゴリが合格しました。RELEASE_CHECKLIST.md を完了し、承認を得て本番へ進んでください。
            </p>
          </div>
        </div>
      ) : status === "warning" ? (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
          <span className="text-amber-400 shrink-0">⚠</span>
          <div>
            <p className="text-xs font-semibold text-amber-300">RC1 — 警告あり</p>
            <p className="text-[10px] text-amber-400/80 mt-0.5">
              下記の警告を確認してください。警告はリリースを妨げませんが、内容を把握しておく必要があります。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-700/40 bg-red-950/20">
          <span className="text-red-400 shrink-0">✗</span>
          <div>
            <p className="text-xs font-semibold text-red-300">RC1 — ブロック</p>
            <p className="text-[10px] text-red-400/80 mt-0.5">
              1つ以上のカテゴリが不合格です。本番へ進む前にすべての不合格を解消してください。
            </p>
          </div>
        </div>
      )}

      {/* Score threshold notice */}
      {score < 70 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-700/40 bg-red-950/20">
          <span className="text-red-400 shrink-0">✗</span>
          <p className="text-xs text-red-300">
            リリーススコア {score}/100 は最低基準の 70 を下回っています。本番デプロイは承認されません。
          </p>
        </div>
      )}

      {/* Category checklist */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/40">
          <p className="text-xs font-semibold text-slate-300">リリースチェックリスト — 10カテゴリ</p>
        </div>
        <div className="px-5 divide-y divide-slate-800/50">
          {categories.map(cat => (
            <CategoryRow key={cat.key} cat={cat} />
          ))}
        </div>
      </div>

      {/* Reference docs */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">参考ドキュメント</p>
        <ul className="flex flex-col gap-1">
          {[
            ["VERSION.md",                    "バージョン定義"],
            ["CHANGELOG.md",                  "全フェーズの変更履歴"],
            ["RELEASE_NOTES_v1.md",           "機能一覧と技術的ハイライト"],
            ["KNOWN_LIMITATIONS.md",          "既知の制限事項と回避策"],
            ["RELEASE_CHECKLIST.md",          "本番向け承認チェックリスト"],
            ["docs/OFFICIAL_RELEASE_PROCESS.md", "ステップごとのリリースプロセス"],
            ["ROADMAP_V2.md",                 "v2 の機能ロードマップ"],
          ].map(([file, desc]) => (
            <li key={file} className="flex gap-2 text-[10px]">
              <code className="text-blue-400 shrink-0">{file}</code>
              <span className="text-slate-500">{desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
