"use client";

import { useState, useEffect, useTransition } from "react";
import { getSystemHealth } from "@/lib/health/health";
import type { SystemHealth, HealthStatus } from "@/lib/health/health";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: HealthStatus) {
  const colors: Record<HealthStatus, string> = {
    healthy: "bg-green-400",
    warning: "bg-amber-400",
    error:   "bg-red-400",
    unknown: "bg-slate-500",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status]}`}
    />
  );
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case "healthy": return "正常";
    case "warning": return "警告";
    case "error":   return "エラー";
    case "unknown": return "不明";
  }
}

function statusTextColor(status: HealthStatus): string {
  switch (status) {
    case "healthy": return "text-green-400";
    case "warning": return "text-amber-400";
    case "error":   return "text-red-400";
    case "unknown": return "text-slate-500";
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} `
    + `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemHealthCard() {
  const [health, setHealth]     = useState<SystemHealth | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getSystemHealth();
      setHealth(result);
    });
  }

  useEffect(() => {
    refresh();
    // Auto-refresh every 5 minutes
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks: Array<{ key: keyof Omit<SystemHealth, "timestamp" | "overall">; label: string }> = [
    { key: "supabase",    label: "Supabase DB" },
    { key: "storage",     label: "Storage" },
    { key: "line",        label: "LINE" },
    { key: "environment", label: "環境変数" },
  ];

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            System Health
          </h3>
          {health && (
            <span className={`text-xs font-bold ${statusTextColor(health.overall)}`}>
              {statusLabel(health.overall)}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={isPending}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          {isPending ? "確認中..." : "↺ 更新"}
        </button>
      </div>

      {/* Loading state */}
      {!health && isPending && (
        <div className="flex items-center gap-2 py-4">
          <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
          <span className="text-xs text-slate-500">ヘルスチェック実行中...</span>
        </div>
      )}

      {/* Health items */}
      {health && (
        <div className="flex flex-col gap-3">
          {checks.map(({ key, label }) => {
            const check = health[key];
            return (
              <div key={key} className="flex items-start gap-3">
                <div className="mt-1">{statusDot(check.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200">{label}</span>
                    <span className={`text-[10px] font-semibold ${statusTextColor(check.status)}`}>
                      {statusLabel(check.status)}
                    </span>
                    {check.latency !== undefined && (
                      <span className="text-[10px] text-slate-600">{check.latency}ms</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{check.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Last checked */}
      {health && (
        <p className="text-[10px] text-slate-600 mt-4 pt-3 border-t border-slate-800">
          最終確認: {formatTimestamp(health.timestamp)}
        </p>
      )}
    </div>
  );
}
