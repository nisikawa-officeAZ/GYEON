"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startStocktakingSession } from "@/lib/admin/logistics/stocktaking-actions";
import type { StocktakingSessionSummary } from "@/lib/admin/logistics/stocktaking-types";

const STATUS_LABEL: Record<string, string> = {
  active:    "進行中",
  completed: "完了",
  cancelled: "キャンセル",
};
const STATUS_COLOR: Record<string, string> = {
  active:    "bg-green-900/40 text-green-300 border border-green-700/50",
  completed: "bg-slate-700/60 text-slate-400",
  cancelled: "bg-red-900/30 text-red-400",
};

type Props = { sessions: StocktakingSessionSummary[] };

export default function StocktakingListClient({ sessions: initialSessions }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [note, setNote]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startStocktakingSession(note.trim() || undefined);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/admin/logistics/stocktaking/${result.sessionId}`);
    });
  }

  const activeSession = sessions.find((s) => s.status === "active");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">棚卸し管理</h1>
          <p className="text-sm text-slate-400 mt-0.5">倉庫在庫の棚卸しセッションを管理します</p>
        </div>
        {!activeSession && (
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            棚卸し開始
          </button>
        )}
        {activeSession && (
          <button
            onClick={() => router.push(`/admin/logistics/stocktaking/${activeSession.id}`)}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-colors animate-pulse"
          >
            進行中に戻る
          </button>
        )}
      </div>

      {/* Start form */}
      {showForm && !activeSession && (
        <div className="mb-6 bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">新しい棚卸しセッション</h2>
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1">メモ（任意）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 月次棚卸し 2026年1月"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600"
            />
          </div>
          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleStart}
              disabled={isPending}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isPending ? "作成中…" : "棚卸しを開始する"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            ※ 開始するとすべての有効商品を含むセッションが作成されます。
          </p>
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          棚卸しセッションがありません。「棚卸し開始」ボタンから開始してください。
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const pct = s.total_items > 0
              ? Math.round((s.counted_items / s.total_items) * 100)
              : 0;
            return (
              <div
                key={s.id}
                onClick={() => s.status === "active" && router.push(`/admin/logistics/stocktaking/${s.id}`)}
                className={[
                  "bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 transition-colors",
                  s.status === "active" ? "cursor-pointer hover:bg-slate-700/60" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                      {s.note && (
                        <span className="text-sm text-slate-300">{s.note}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      開始: {new Date(s.started_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                      {s.started_by_name && ` — ${s.started_by_name}`}
                    </p>
                    {s.completed_at && (
                      <p className="text-xs text-slate-500">
                        完了: {new Date(s.completed_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{s.counted_items} / {s.total_items}</p>
                    <p className="text-xs text-slate-400">商品完了</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${s.status === "completed" ? "bg-green-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5 text-right">{pct}%</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
