"use client";

// Phase 2 Sprint 3 — Vehicle service-history foundation.
// Reads the existing dealer-scoped activity_logs for this vehicle entity. No
// schema change; a future sprint can enrich this with estimate/work-order links.

import { useState, useEffect } from "react";
import { getActivityLogsByEntity } from "@/lib/activity/activity-log";
import type { ActivityLogDB } from "@/lib/activity/activity-log-types";
import { activityEntityTypeLabel, activityActionLabel, activityActionColor } from "@/lib/activity/activity-log-types";

interface Props {
  vehicleId: string;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return iso.slice(0, 10);
}

export default function VehicleServiceHistory({ vehicleId }: Props) {
  const [logs, setLogs] = useState<ActivityLogDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getActivityLogsByEntity("vehicle", vehicleId).then((data) => {
      if (!cancelled) {
        setLogs(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [vehicleId]);

  if (loading) {
    return <p className="text-xs text-slate-500">読み込み中...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-xs text-slate-500">まだ履歴はありません</p>;
  }

  return (
    <div className="max-h-96 overflow-y-auto pr-1">
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-700" />
        <ul className="space-y-4">
          {logs.map((log) => (
            <li key={log.id} className="relative flex gap-3 pl-5">
              <span
                className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-[#1e293b] bg-current shrink-0 ${activityActionColor(log.action)}`}
                style={{ backgroundClip: "padding-box" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                    {activityEntityTypeLabel(log.entity_type)}
                  </span>
                  <span className={`text-xs font-medium ${activityActionColor(log.action)}`}>
                    {activityActionLabel(log.action)}
                  </span>
                </div>
                <p className="text-sm text-slate-100 leading-snug">{log.title}</p>
                {log.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{log.description}</p>
                )}
                <p className="text-[10px] text-slate-500 mt-1">{formatRelativeTime(log.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
