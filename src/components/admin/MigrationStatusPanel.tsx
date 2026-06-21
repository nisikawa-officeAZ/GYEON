"use client";

// PHASE61: Migration status panel.
// Displays the result of getMigrationReadinessStatus() as a read-only table.
// IMPORTANT: This panel must NOT contain any button that applies migrations.

import type { MigrationStatusReport, MigrationInfo } from "@/lib/migrations/migration-types";

interface Props {
  report: MigrationStatusReport;
}

function StatusBadge({ status }: { status: MigrationInfo["status"] }) {
  if (status === "applied") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-900/40 text-green-300 border border-green-700/40">
        <span className="text-green-400">✓</span> Applied
      </span>
    );
  }
  if (status === "missing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-900/40 text-red-300 border border-red-700/40">
        <span className="text-red-400">✗</span> Missing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
      ? Unknown
    </span>
  );
}

function OverallBadge({ overall }: { overall: MigrationStatusReport["overall"] }) {
  if (overall === "ready") {
    return (
      <span className="px-3 py-1 rounded-full bg-green-900/50 text-green-300 text-xs font-bold border border-green-700/50">
        ALL APPLIED
      </span>
    );
  }
  if (overall === "warning") {
    return (
      <span className="px-3 py-1 rounded-full bg-amber-900/50 text-amber-300 text-xs font-bold border border-amber-700/50">
        WARNING
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-red-900/50 text-red-300 text-xs font-bold border border-red-700/40">
      MIGRATIONS MISSING
    </span>
  );
}

export default function MigrationStatusPanel({ report }: Props) {
  const appliedCount = report.migrations.filter(m => m.status === "applied").length;
  const missingCount = report.migrations.filter(m => m.status === "missing").length;
  const totalCount   = report.migrations.length;

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
      {/* Warning banner — always shown */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-700/40 bg-amber-950/20">
        <span className="text-amber-400 text-lg shrink-0">⚠</span>
        <div>
          <p className="text-xs font-semibold text-amber-300">
            Migrations must be applied manually in Supabase SQL Editor.
          </p>
          <p className="text-[10px] text-amber-500 mt-0.5">
            This page is read-only and cannot apply migrations.
            Follow docs/STAGING_MIGRATION_EXECUTION_GUIDE.md to apply each migration manually.
          </p>
        </div>
      </div>

      {/* Overall status header */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-sm font-semibold text-slate-100">Schema Status</h2>
            <OverallBadge overall={report.overall} />
          </div>
          <p className="text-xs text-slate-500">
            Checked: {checkedAt} — {" "}
            <span className="text-green-400">{appliedCount}/{totalCount} applied</span>
            {missingCount > 0 && (
              <>, <span className="text-red-400">{missingCount} missing</span></>
            )}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            Status is inferred from schema presence — not from a migration history table.
            A migration may show as &quot;Applied&quot; if its key table/column exists for any reason.
          </p>
        </div>
      </div>

      {/* Migration table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium w-8">#</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">File</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Purpose</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium w-32">Status</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Schema Note</th>
            </tr>
          </thead>
          <tbody>
            {report.migrations.map((m, i) => (
              <tr
                key={m.filename}
                className={[
                  "border-b border-slate-800/50 last:border-0",
                  m.status === "missing" ? "bg-red-950/15" : "",
                  i % 2 === 0 && m.status !== "missing" ? "bg-slate-900/20" : "",
                ].join(" ")}
              >
                <td className="px-4 py-2.5 text-slate-500 tabular-nums">{m.number}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-slate-300 whitespace-nowrap">
                  {m.filename}
                </td>
                <td className="px-4 py-2.5 text-slate-400">{m.purpose}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-[10px]">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Numbering gap notice */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <p className="text-xs text-slate-400 font-semibold mb-1">Numbering Gap Notice</p>
        <p className="text-[10px] text-slate-500">
          Migrations 056 and 057 do not exist as SQL files — those phases contained code-only changes.
          The jump from 055 → 058 is intentional.
          File <code className="text-slate-400">001_create_core_tables_PASTE_ONLY.sql</code> is a
          reference copy and must NOT be applied separately.
        </p>
      </div>

      {/* Docs links */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <p className="text-xs text-slate-400 font-semibold mb-2">Reference Documents</p>
        <ul className="text-[10px] text-slate-500 space-y-1 list-disc list-inside">
          <li>docs/STAGING_MIGRATION_EXECUTION_GUIDE.md — how to apply each migration safely</li>
          <li>docs/MANUAL_MIGRATION_TRACKING.md — manual tracking checklist per migration</li>
          <li>docs/STAGING_SQL_VERIFICATION_PACK.md — SQL queries for post-migration verification</li>
          <li>docs/MIGRATION_APPLICATION_ORDER.md — canonical ordered file list</li>
        </ul>
      </div>
    </div>
  );
}
