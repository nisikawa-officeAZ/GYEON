"use client";

// GYEON-EST-LINE-F1-R1 — the REAL 送付履歴 card content, replacing the static
// placeholder. Renders exactly what the tenant-scoped reader returns:
//   ok+rows   → the truthful per-attempt states below
//   ok+empty  → 送付履歴はありません — ONLY after a successful read
//   error     → an explicit read-failure line, never the empty text
// The reader is injectable so tests drive every branch without a DOM harness.

import { useEffect, useState } from "react";

import { getEstimateLineHistory } from "@/lib/line/get-estimate-line-history";
import type {
  EstimateLineHistoryRow,
  EstimateLineHistoryState,
} from "@/lib/line/send-estimate-line-core";

export type EstimateLineHistoryFetcher = (estimateId: string) => Promise<
  { readonly kind: "ok"; readonly rows: EstimateLineHistoryRow[] } | { readonly kind: "error" }
>;

// Truthful Japanese per-state labels. `pending` NEVER claims delivery — the
// transport outcome is unconfirmed, and the label says exactly that.
export const HISTORY_STATE_LABEL: Record<EstimateLineHistoryState, string> = {
  sent:      "送信済み",
  failed:    "送信失敗",
  pending:   "送信結果未確認（送信済みの可能性があります）",
  cancelled: "中止",
};

const STATE_COLOR: Record<EstimateLineHistoryState, string> = {
  sent:      "text-emerald-300",
  failed:    "text-rose-300",
  pending:   "text-amber-300",
  cancelled: "text-slate-400",
};

type Stage =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "ok"; readonly rows: EstimateLineHistoryRow[] };

export function EstimateLineHistory({
  estimateId,
  version,
  fetchHistory = getEstimateLineHistory,
}: {
  estimateId: string;
  /** Bumped by the send surface after an attempt that may have logged a row. */
  version: number;
  fetchHistory?: EstimateLineHistoryFetcher;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  // Read-only load on mount and whenever an attempt settles (version bump).
  // This effect never initiates a send.
  useEffect(() => {
    let current = true;
    setStage({ kind: "loading" });
    fetchHistory(estimateId)
      .then((result) => {
        if (!current) return;
        setStage(result.kind === "ok" ? { kind: "ok", rows: result.rows } : { kind: "error" });
      })
      .catch(() => {
        if (current) setStage({ kind: "error" });
      });
    return () => { current = false; };
  }, [estimateId, version, fetchHistory]);

  if (stage.kind === "loading") {
    return <p data-testid="line-history-loading" className="text-xs text-slate-500">読み込み中…</p>;
  }

  if (stage.kind === "error") {
    return (
      <p data-testid="line-history-error" className="text-xs text-amber-300">
        送付履歴を読み込めませんでした。再読み込みしてください。
      </p>
    );
  }

  if (stage.rows.length === 0) {
    // The ONLY state allowed to render the empty text: a SUCCESSFUL read with zero rows.
    return (
      <p data-testid="line-history-empty" className="text-xs text-slate-600">
        送付履歴はありません（LINE送信時に記録されます）
      </p>
    );
  }

  return (
    <div data-testid="line-history-list" className="flex flex-col gap-2">
      {stage.rows.map((row) => (
        <div key={row.id} data-testid="line-history-row" className="rounded-md border border-slate-700/60 bg-slate-900/40 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-medium ${STATE_COLOR[row.state]}`}>
              LINE {HISTORY_STATE_LABEL[row.state]}
              {row.mode === "pdf-link" ? "（PDFリンク付き）" : ""}
            </span>
            <span className="text-[10px] text-slate-500">{row.sentAt ?? row.createdAt ?? ""}</span>
          </div>
          {row.body && (
            <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
              {row.body}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export default EstimateLineHistory;
