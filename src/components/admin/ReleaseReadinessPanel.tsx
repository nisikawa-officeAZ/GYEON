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
        READY
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
    <span className="px-3 py-1 rounded-full bg-red-900/50 text-red-300 text-xs font-bold border border-red-700/50">
      BLOCKED
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
            <h2 className="text-sm font-semibold text-slate-100">Overall Release Status</h2>
            <OverallBadge overall={report.overall} />
          </div>
          <p className="text-xs text-slate-500">
            Checked: {checkedAt} —{" "}
            <span className="text-green-400">{passCount} passed</span>
            {warnCount > 0 && <>, <span className="text-amber-400">{warnCount} warning{warnCount > 1 ? "s" : ""}</span></>}
            {failCount > 0 && <>, <span className="text-red-400">{failCount} failed</span></>}
          </p>
        </div>
        {report.overall === "blocked" && (
          <p className="text-xs text-red-400 max-w-xs">
            Production deployment is PROHIBITED until all BLOCKED items are resolved.
          </p>
        )}
        {report.overall === "warning" && (
          <p className="text-xs text-amber-400 max-w-xs">
            Review warnings before deploying to production.
          </p>
        )}
        {report.overall === "ready" && (
          <p className="text-xs text-green-400 max-w-xs">
            All checks passed. Review the full PRODUCTION_READINESS_CHECKLIST.md before deploying.
          </p>
        )}
      </div>

      {/* Checks table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium w-8">Status</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Check</th>
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Message</th>
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
          <span className="text-green-400 font-bold">✓</span> Pass — requirement met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-amber-400 font-bold">⚠</span> Warning — review recommended
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-red-400 font-bold">✗</span> Fail — deployment blocked
        </span>
      </div>

      {/* Docs links */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
        <p className="text-xs text-slate-400 font-semibold mb-2">Reference Documents</p>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>docs/PRODUCTION_READINESS_CHECKLIST.md — full manual checklist</li>
          <li>docs/MIGRATION_APPLICATION_ORDER.md — apply migrations in this order</li>
          <li>docs/ENVIRONMENT_RELEASE_CHECKLIST.md — environment variable verification</li>
          <li>docs/RLS_VERIFICATION_CHECKLIST.md — row-level security verification</li>
          <li>docs/STORAGE_VERIFICATION_CHECKLIST.md — storage bucket verification</li>
          <li>docs/LINE_RELEASE_CHECKLIST.md — LINE integration verification</li>
          <li>docs/PDF_RELEASE_CHECKLIST.md — PDF generation verification</li>
          <li>docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md — subscription &amp; onboarding verification</li>
        </ul>
      </div>
    </div>
  );
}
