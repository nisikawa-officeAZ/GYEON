"use client";

// Phase 2 Sprint 5 — OCR review audit trail (read-only).
// Renders dealer-scoped audit_logs for the vehicle_registration resource type,
// covering OCR upload / analysis / confirmation events.

import type { AuditLogDB } from "@/lib/audit/audit-types";
import { auditActionLabel } from "@/lib/audit/audit-types";

interface Props {
  logs: AuditLogDB[];
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default function OcrAuditTrail({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-xs text-slate-500">監査ログはありません</p>;
  }

  return (
    <div className="max-h-96 overflow-y-auto pr-1">
      <ul className="flex flex-col gap-2">
        {logs.map((log) => (
          <li key={log.id} className="bg-[#0f172a] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0">
                {auditActionLabel(log.action)}
              </span>
              <span className="text-xs text-slate-300 truncate">
                {log.actor_email ?? "システム"}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">{formatDateTime(log.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
