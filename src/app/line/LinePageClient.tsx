"use client";

import { useState, useTransition } from "react";
import LineMessageLogTable        from "@/components/line/LineMessageLogTable";
import LineNotificationQueueTable from "@/components/line/LineNotificationQueueTable";
import { LineMessageLogDB, LineNotificationQueueDB } from "@/lib/line/line-message-types";
import { processLineNotificationQueue } from "@/lib/line/process-line-notification-queue";
import { getLineMessageLogs }           from "@/lib/line/get-line-message-logs";
import { getLineNotificationQueue }     from "@/lib/line/get-line-notification-queue";

interface LineStats {
  friends_count:  number;
  linked_count:   number;
  this_month_new: number;
}

interface LineMessageStats {
  this_month_sent:   number;
  this_month_failed: number;
  total_sent:        number;
}

type TabKey = "logs" | "queue" | "failed";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?:  string;
  accent?: "green" | "blue" | "red" | "amber";
}) {
  const color =
    accent === "green" ? "text-green-400" :
    accent === "red"   ? "text-red-400"   :
    accent === "amber" ? "text-amber-400" :
    accent === "blue"  ? "text-blue-400"  :
    "text-slate-100";

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  initialLogs:       LineMessageLogDB[];
  initialFailedLogs: LineMessageLogDB[];
  initialQueue:      LineNotificationQueueDB[];
  lineStats:         LineStats;
  msgStats:          LineMessageStats;
  queueStats:        { scheduled: number; failed: number };
}

export default function LinePageClient({
  initialLogs,
  initialFailedLogs,
  initialQueue,
  lineStats,
  msgStats,
  queueStats,
}: Props) {
  const [tab, setTab] = useState<TabKey>("logs");
  const [logs,       setLogs]       = useState(initialLogs);
  const [failedLogs, setFailedLogs] = useState(initialFailedLogs);
  const [queue,      setQueue]      = useState(initialQueue);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const [freshLogs, freshFailed, freshQueue] = await Promise.all([
      getLineMessageLogs({ limit: 50 }),
      getLineMessageLogs({ status: "failed", limit: 30 }),
      getLineNotificationQueue({ status: ["scheduled", "failed"], limit: 50 }),
    ]);
    setLogs(freshLogs);
    setFailedLogs(freshFailed);
    setQueue(freshQueue);
  }

  function handleProcessQueue() {
    startTransition(async () => {
      setProcessResult(null);
      const result = await processLineNotificationQueue();
      if ("error" in result) {
        setProcessResult(`エラー: ${result.error}`);
      } else {
        setProcessResult(
          `処理完了: ${result.processed}件処理 / 送信${result.sent}件 / 失敗${result.failed}件`
        );
        await refresh();
      }
    });
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: "logs",   label: "送信履歴" },
    { key: "queue",  label: `通知キュー (${queueStats.scheduled})` },
    { key: "failed", label: `失敗 (${msgStats.this_month_failed})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">LINE管理</h1>
        <button
          type="button"
          disabled={isPending}
          onClick={handleProcessQueue}
          className="text-xs bg-[#06C755] hover:bg-[#05a847] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          {isPending ? "処理中..." : "キュー処理を実行"}
        </button>
      </div>

      {processResult && (
        <div className={`text-xs px-4 py-2 rounded-lg ${
          processResult.startsWith("エラー")
            ? "bg-red-900/20 text-red-400"
            : "bg-green-900/20 text-green-400"
        }`}>
          {processResult}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="LINE友達数"
          value={lineStats.friends_count}
          sub={`連携済み: ${lineStats.linked_count}名`}
          accent="green"
        />
        <StatCard
          label="今月送信数"
          value={msgStats.this_month_sent}
          sub={`通算: ${msgStats.total_sent}件`}
          accent="blue"
        />
        <StatCard
          label="今月失敗数"
          value={msgStats.this_month_failed}
          accent={msgStats.this_month_failed > 0 ? "red" : undefined}
        />
        <StatCard
          label="予約通知数"
          value={queueStats.scheduled}
          accent={queueStats.scheduled > 0 ? "amber" : undefined}
        />
        <StatCard
          label="今月の新規友達"
          value={lineStats.this_month_new}
          accent={lineStats.this_month_new > 0 ? "green" : undefined}
        />
        <StatCard
          label="キュー失敗"
          value={queueStats.failed}
          accent={queueStats.failed > 0 ? "red" : undefined}
        />
      </div>

      {/* Tabs */}
      <div>
        <div className="flex border-b border-slate-700 mb-4 gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "border-[#06C755] text-[#06C755]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "logs" && (
          <LineMessageLogTable logs={logs} />
        )}
        {tab === "queue" && (
          <LineNotificationQueueTable
            items={queue}
            onChanged={refresh}
          />
        )}
        {tab === "failed" && (
          <LineMessageLogTable logs={failedLogs} />
        )}
      </div>
    </div>
  );
}
