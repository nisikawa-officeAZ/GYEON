"use client";

// Estimate Wizard Ver2.2 — Screen 7 real save panel (Phase 11I).
//
// Replaces the preview-only confirmation with the real "save draft estimate" action. It drives the
// server action → atomic RPC path. UI states: idle / validating / saving / success / error. Duplicate
// clicks are disabled while saving and after success. The Wizard state is preserved on failure (the
// parent never clears it). On success it shows the saved estimate NUMBER (never the internal id).
// Preserves the approved GenSpark visual language (same button/panel styling as the review flow).

export type SaveEstimateStatus = "idle" | "validating" | "saving" | "success" | "error";

export function SaveEstimatePanel({
  status,
  result,
  errorMessage,
  issues,
  onSave,
  onBack,
}: {
  status:       SaveEstimateStatus;
  result:       { estimateNumber: string; replay: boolean } | null;
  errorMessage: string | null;
  issues:       { message: string }[];
  onSave:       () => void;
  onBack:       () => void;
}) {
  const busy = status === "saving" || status === "validating";
  const done = status === "success";

  return (
    <section className="bg-[#1e293b] rounded-xl shadow-lg p-5" aria-label="見積の保存">
      {done && result && (
        <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-emerald-300">✓</span>
            <p className="text-sm text-emerald-200">見積を保存しました（下書き）。</p>
          </div>
          <p className="text-xs text-emerald-200/90 mt-1">見積番号：<span className="tabular-nums">{result.estimateNumber}</span></p>
          {result.replay && (
            <p className="text-[11px] text-emerald-200/70 mt-1">※ 再送信のため、既存の見積を返しました（重複作成なし）。</p>
          )}
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-600/40 bg-rose-500/10 p-3 flex flex-col gap-1">
          <p className="text-sm text-rose-200">{errorMessage ?? "保存に失敗しました。"}</p>
          {issues.map((i, idx) => (
            <p key={idx} className="text-[11px] text-rose-200/80">・{i.message}</p>
          ))}
          <p className="text-[11px] text-rose-200/70 mt-1">入力内容は保持されています。修正のうえ再度お試しください。</p>
        </div>
      )}

      {!done && (
        <p className="text-[11px] text-slate-500 mb-3">
          内容を確定して見積書（下書き）を保存します。保存後もお客様への送信・PDF 生成・LINE は行いません。
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || done}
          aria-disabled={busy || done}
          aria-busy={busy}
          className="w-full sm:w-auto text-sm font-medium text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:ring-offset-2 focus:ring-offset-[#1e293b] px-5 min-h-[44px] rounded-lg transition-colors"
        >
          {busy ? "保存中…" : done ? "保存済み（下書き）" : "見積を保存（下書き）"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto text-sm text-slate-300 border border-slate-700 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 px-5 min-h-[44px] rounded-lg transition-colors"
        >
          備考へ戻る
        </button>
      </div>
    </section>
  );
}
