"use client";

import { LineMessageLogDB, lineMessageStatusLabel, lineMessagePurposeLabel, LineMessageStatus } from "@/lib/line/line-message-types";

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function customerName(log: LineMessageLogDB): string {
  if (log.customers) {
    const n = [log.customers.last_name, log.customers.first_name].filter(Boolean).join(" ");
    if (n) return n;
  }
  return log.line_customers?.display_name ?? log.line_user_id ?? "—";
}

const STATUS_STYLE: Record<LineMessageStatus, string> = {
  pending:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
  sent:      "bg-green-500/10 text-green-400 border-green-500/20",
  failed:    "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-slate-600/10 text-slate-500 border-slate-600/20",
};

interface Props {
  logs:      LineMessageLogDB[];
  onDetail?: (log: LineMessageLogDB) => void;
}

export default function LineMessageLogTable({ logs, onDetail }: Props) {
  if (logs.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">送信履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">顧客 / LINE名</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">目的</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">タイトル / 内容</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3">ステータス</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">送信日時</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">リトライ</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden xl:table-cell">エラー</th>
              {onDetail && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr
                key={log.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                  i === logs.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <p className="text-slate-100 text-xs font-medium whitespace-nowrap">
                    {customerName(log)}
                  </p>
                  {log.line_customers?.display_name && log.customers && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {log.line_customers.display_name}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-[10px] text-slate-400">
                    {lineMessagePurposeLabel(log.purpose)}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  {log.title && (
                    <p className="text-xs text-slate-200 truncate">{log.title}</p>
                  )}
                  <p className="text-[10px] text-slate-500 truncate">{log.body ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[log.status]}`}>
                    {lineMessageStatusLabel(log.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                  {log.status === "sent"
                    ? formatDatetime(log.sent_at)
                    : log.status === "failed"
                    ? formatDatetime(log.failed_at)
                    : formatDatetime(log.created_at)}
                </td>
                <td className="px-4 py-3 text-center text-xs text-slate-400 hidden sm:table-cell">
                  {log.retry_count > 0 ? (
                    <span className="text-amber-400">{log.retry_count}</span>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="px-4 py-3 text-[10px] text-red-400 hidden xl:table-cell max-w-[180px] truncate">
                  {log.error_message ?? "—"}
                </td>
                {onDetail && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onDetail(log)}
                      className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      詳細
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
