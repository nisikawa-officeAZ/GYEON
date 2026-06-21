"use client";

import { useState, useEffect, useTransition } from "react";
import { getAuditLogsAdmin, exportAuditLogsCsvAdmin } from "@/lib/audit/audit-admin";
import {
  AuditAction,
  AuditResourceType,
  AuditLogDB,
  AuditLogFilter,
  auditActionLabel,
  auditResourceTypeLabel,
  auditActionBadgeColor,
} from "@/lib/audit/audit-types";

const ALL_ACTIONS: AuditAction[] = [
  "create", "update", "delete", "archive", "restore",
  "export", "login", "logout", "change_role",
  "generate_pdf", "download_pdf", "send_line",
  "create_staff", "delete_staff",
];

const ALL_RESOURCE_TYPES: AuditResourceType[] = [
  "customer", "vehicle", "estimate", "work_order",
  "completion_report", "invoice", "payment",
  "product_order", "reservation", "staff", "role",
  "dealer_setting", "document", "super_admin",
];

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(isoStr: string): string {
  const dt = new Date(isoStr);
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function truncate(str: string, max = 20): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function diffSummary(
  oldVal: Record<string, unknown> | null,
  newVal: Record<string, unknown> | null
): string {
  if (!oldVal && !newVal) return "—";
  if (!oldVal && newVal) {
    const entries = Object.entries(newVal).slice(0, 2);
    return entries.map(([k, v]) => `${k}: ${truncate(String(v))}`).join(", ");
  }
  if (oldVal && !newVal) {
    return "削除済み";
  }
  if (oldVal && newVal) {
    const changed: string[] = [];
    for (const key of Object.keys(newVal)) {
      if (oldVal[key] !== newVal[key]) {
        changed.push(`${key}: ${truncate(String(oldVal[key]))} → ${truncate(String(newVal[key]))}`);
        if (changed.length >= 2) break;
      }
    }
    return changed.length > 0 ? changed.join(", ") : "—";
  }
  return "—";
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogDB[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterAction, setFilterAction] = useState<AuditAction | "">("");
  const [filterResource, setFilterResource] = useState<AuditResourceType | "">("");

  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  function buildFilter(p: number): AuditLogFilter & { dealer_id?: string } {
    return {
      ...(filterFrom ? { from: filterFrom } : {}),
      ...(filterTo ? { to: filterTo } : {}),
      ...(filterAction ? { action: filterAction } : {}),
      ...(filterResource ? { resource_type: filterResource } : {}),
      page: p,
      per_page: PER_PAGE,
    };
  }

  function fetchLogs(p: number) {
    startTransition(async () => {
      const result = await getAuditLogsAdmin(buildFilter(p));
      setLogs(result.data);
      setTotal(result.total);
    });
  }

  useEffect(() => {
    fetchLogs(1);
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    setPage(1);
    fetchLogs(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchLogs(newPage);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const { csv, filename } = await exportAuditLogsCsvAdmin(buildFilter(1));
      if (csv) downloadCsv(csv, filename);
    } finally {
      setIsExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const rangeEnd = Math.min(page * PER_PAGE, total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">監査ログ</h1>
        <span className="text-xs text-slate-500">DEALER-SCOPED AUDIT LOG</span>
      </div>

      {/* Filter bar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">開始日</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="bg-[#1e293b] border border-slate-700 text-slate-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">終了日</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="bg-[#1e293b] border border-slate-700 text-slate-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">アクション</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as AuditAction | "")}
              className="bg-[#1e293b] border border-slate-700 text-slate-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-500"
            >
              <option value="">すべて</option>
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>{auditActionLabel(a)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">リソース種別</label>
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value as AuditResourceType | "")}
              className="bg-[#1e293b] border border-slate-700 text-slate-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-500"
            >
              <option value="">すべて</option>
              {ALL_RESOURCE_TYPES.map((r) => (
                <option key={r} value={r}>{auditResourceTypeLabel(r)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs rounded transition-colors disabled:opacity-50"
          >
            検索
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || isPending}
            className="px-4 py-1.5 bg-amber-700/50 hover:bg-amber-700/70 text-amber-200 text-xs rounded transition-colors disabled:opacity-50"
          >
            {isExporting ? "エクスポート中..." : "CSVエクスポート"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg overflow-hidden">
        {isPending ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            読み込み中...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            監査ログがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">日時</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">ユーザー</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">ロール</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">アクション</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">リソース</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">リソースID</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">変更内容</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                      {log.actor_email
                        ? truncate(log.actor_email, 24)
                        : log.actor_user_id
                        ? log.actor_user_id.slice(0, 8)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.actor_role ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-300 border border-slate-600/50">
                          {log.actor_role}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${auditActionBadgeColor(log.action)}`}
                      >
                        {auditActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                      {auditResourceTypeLabel(log.resource_type)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap font-mono">
                      {log.resource_id ? log.resource_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-xs">
                      <span title={
                        log.old_value || log.new_value
                          ? `変更前: ${JSON.stringify(log.old_value)}\n変更後: ${JSON.stringify(log.new_value)}`
                          : ""
                      }>
                        {diffSummary(log.old_value, log.new_value)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isPending && total > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{total}件中 {rangeStart}–{rangeEnd}件</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              前へ
            </button>
            <span className="text-slate-400">
              {page} / {totalPages} ページ
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
