"use client";

// Phase 3 Sprint 1 — Estimate status management control.
// Shows the current status and (for users who can edit) allows transitioning it
// via the dealer-scoped updateEstimateStatus action. No schema change.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  estimateStatusLabel, normalizeEstimateStatus,
  ESTIMATE_WORKFLOW_STATUSES, ESTIMATE_STATUS_LABELS, type EstimateStatus,
} from "@/lib/estimates/estimate-types";
import { updateEstimateStatus } from "@/lib/estimates/update-estimate-status";
import { useCurrentStaff } from "@/contexts/StaffContext";

// Workflow statuses only (SENT is transmission, not workflow).
const STATUS_OPTIONS: { value: string; label: string }[] =
  ESTIMATE_WORKFLOW_STATUSES.map((v) => ({ value: v, label: ESTIMATE_STATUS_LABELS[v] }));

function toneClass(status: string): string {
  switch (normalizeEstimateStatus(status)) {
    case "approved":    return "text-green-400 border-green-500/30 bg-green-500/10";
    case "proposal":    return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    case "lost":        return "text-red-400 border-red-500/30 bg-red-500/10";
    case "accepted":    return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    case "in_progress": return "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
    case "completed":   return "text-teal-400 border-teal-500/30 bg-teal-500/10";
    case "invoiced":    return "text-purple-400 border-purple-500/30 bg-purple-500/10";
    default:            return "text-slate-400 border-slate-600/40 bg-slate-700/30";
  }
}

interface Props {
  estimateId:    string;
  currentStatus: EstimateStatus;
}

export default function EstimateStatusControl({ estimateId, currentStatus }: Props) {
  const { canEdit } = useCurrentStaff();
  const router = useRouter();
  // Normalize legacy values (e.g. 'sent') to the canonical workflow status so the
  // select matches an option and displays 提案中 rather than an empty selection.
  const [status, setStatus] = useState<string>(normalizeEstimateStatus(String(currentStatus)) ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (next === status) return;
    setError(null);
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const result = await updateEstimateStatus(estimateId, next);
      if (result?.error) {
        setStatus(previous); // revert on failure
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const badge = (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${toneClass(status)}`}>
      {estimateStatusLabel(status as EstimateStatus)}
    </span>
  );

  if (!canEdit) {
    return badge;
  }

  return (
    <div className="flex items-center gap-2">
      {badge}
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#1d4ed8] disabled:opacity-50"
        aria-label="見積ステータス"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
