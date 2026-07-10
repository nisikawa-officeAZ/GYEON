"use client";

// Estimate Wizard Ver2.2 — Review confirmation (Phase 7, presentation-only).
//
// Preview-only final action. Confirming sets a LOCAL preview-confirmed state and shows a success
// panel — it NEVER saves, calls EstimateEditor, creates/updates an estimate, calls an API,
// generates a PDF, sends LINE, or writes the DB. The primary action is deliberately named
// "preview confirm" (not save/submit/create). Duplicate confirmation clicks are disabled.

export function ReviewConfirmation({
  previewConfirmed,
  onPreviewConfirm,
  onBack,
}: {
  previewConfirmed: boolean;
  onPreviewConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <section className="bg-[#1e293b] rounded-xl shadow-lg p-5" aria-label="レビュー確定">
      {previewConfirmed && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3 flex items-center gap-2"
        >
          <span aria-hidden className="text-emerald-300">✓</span>
          <p className="text-xs text-emerald-200">
            レビューを確定しました（プレビュー）。この操作は保存・送信・PDF生成を行いません。今後の統合で親が本処理を担当します。
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-500 mb-3">
        入力内容をご確認ください。確定はプレビュー用で、保存・見積作成・API・DB・PDF・LINE は実行されません。
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onPreviewConfirm}
          disabled={previewConfirmed}
          aria-disabled={previewConfirmed}
          className="w-full sm:w-auto text-sm font-medium text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:ring-offset-2 focus:ring-offset-[#1e293b] px-5 min-h-[44px] rounded-lg transition-colors"
        >
          {previewConfirmed ? "確定済み（プレビュー）" : "レビューを確定"}
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
