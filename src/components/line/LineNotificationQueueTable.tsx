"use client";

import { useTransition } from "react";
import { LineNotificationQueueDB, lineQueueStatusLabel, lineMessagePurposeLabel, LineQueueStatus } from "@/lib/line/line-message-types";
import { cancelQueuedNotification } from "@/lib/line/queue-line-notification";

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function customerName(item: LineNotificationQueueDB): string {
  if (item.customers) {
    const n = [item.customers.last_name, item.customers.first_name].filter(Boolean).join(" ");
    if (n) return n;
  }
  return item.line_customers?.display_name ?? "—";
}

const STATUS_STYLE: Record<LineQueueStatus, string> = {
  scheduled:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  sent:       "bg-green-500/10 text-green-400 border-green-500/20",
  failed:     "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled:  "bg-slate-600/10 text-slate-500 border-slate-600/20",
};

interface Props {
  items:     LineNotificationQueueDB[];
  onChanged: () => void;
}

export default function LineNotificationQueueTable({ items, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleCancel(id: string) {
    startTransition(async () => {
      await cancelQueuedNotification(id);
      onChanged();
    });
  }

  if (items.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">通知キューがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">予定日時</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">顧客 / LINE名</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">目的</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">内容</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3">ステータス</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">試行</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">最終試行</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden xl:table-cell">エラー</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                  i === items.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 text-xs text-slate-300 whitespace-nowrap">
                  {formatDatetime(item.scheduled_at)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-slate-100 font-medium whitespace-nowrap">
                    {customerName(item)}
                  </p>
                  {item.line_customers?.display_name && item.customers && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {item.line_customers.display_name}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-[10px] text-slate-400">
                    {lineMessagePurposeLabel(item.purpose)}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[180px]">
                  {item.title && (
                    <p className="text-xs text-slate-200 truncate">{item.title}</p>
                  )}
                  <p className="text-[10px] text-slate-500 truncate">{item.body}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[item.status]}`}>
                    {lineQueueStatusLabel(item.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-slate-400 hidden sm:table-cell">
                  {item.attempts}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell whitespace-nowrap">
                  {formatDatetime(item.last_attempt_at)}
                </td>
                <td className="px-4 py-3 text-[10px] text-red-400 hidden xl:table-cell max-w-[160px] truncate">
                  {item.error_message ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {/* Read-only link to the customer's record / activity log when applicable. */}
                  {item.customer_id && (
                    <a
                      href={`/customers/${item.customer_id}`}
                      className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 px-2 py-1 rounded transition-colors"
                    >
                      履歴
                    </a>
                  )}
                  {item.status === "scheduled" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCancel(item.id)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-40"
                    >
                      キャンセル
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
