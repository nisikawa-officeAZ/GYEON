"use client";

// Estimate Wizard Ver2.2 — Screen7 action controls (Phase 7B, presentation-only).
//
// Renders the seven tracked Ver2.2 Screen7 controls that were missing from the review screen:
// キャンセル / PDF作成 / LINE / 予約日を決めてカレンダー登録 / 請求書 / 納品書 / 納品請求書.
// (修正 is already provided per-section by ReviewSection; 保存 by SaveEstimatePanel.)
//
// STRICTLY PRESENTATION-ONLY. This component cancels nothing, navigates nowhere, saves nothing,
// generates no PDF/invoice/delivery document, sends no LINE/email, registers no calendar event,
// calls no API/Server Action, writes no DB, touches no browser storage, and mutates no business
// state. It computes no prices. `onAction` is OPTIONAL — when the owner omits it the controls are
// inert by construction, not merely by convention. The real behaviour (per spec: キャンセル以外は
// 自動保存, then navigate to the target module; 請求書/納品書/納品請求書 → 請求書欄) is wired in a
// later Integration Phase and is deliberately NOT approximated here.

import { cn } from "../foundation/tokens";

/** The seven Screen7 actions. `修正` and `保存` are intentionally absent — they already exist. */
export type ReviewAction =
  | "cancel"
  | "createPdf"
  | "sendLine"
  | "schedule"
  | "createInvoice"
  | "createDeliveryNote"
  | "createDeliveryInvoice";

type ActionSpec = { action: ReviewAction; label: string; icon: string };

// Labels are the tracked Ver2.2 spec labels, verbatim. Do not translate or reword.
const OUTPUT_ACTIONS: ActionSpec[] = [
  { action: "createPdf",  label: "PDF作成", icon: "📄" },
  { action: "sendLine",   label: "LINE",    icon: "💬" },
];

const SCHEDULE_ACTIONS: ActionSpec[] = [
  { action: "schedule", label: "予約日を決めてカレンダー登録", icon: "📅" },
];

const DOCUMENT_ACTIONS: ActionSpec[] = [
  { action: "createInvoice",         label: "請求書",     icon: "🧾" },
  { action: "createDeliveryNote",    label: "納品書",     icon: "📦" },
  { action: "createDeliveryInvoice", label: "納品請求書", icon: "🧾" },
];

const GROUP_LABEL = "text-[10px] text-slate-500 uppercase tracking-wider mb-1.5";

function ActionButton({
  spec,
  disabled,
  onAction,
}: {
  spec: ActionSpec;
  disabled: boolean;
  onAction?: (action: ReviewAction) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={disabled || !onAction ? undefined : () => onAction(spec.action)}
      className={cn(
        // min-h 48px: tracked Ver2.2 touch-target requirement (48×48px). py-2 lets a wrapped
        // label grow the button beyond the floor instead of clipping it.
        "flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 min-h-[48px] rounded-lg border transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]",
        disabled
          ? "bg-[#0f172a] border-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
          : "bg-[#0f172a] border-slate-700 text-slate-200 hover:border-slate-500",
      )}
    >
      <span aria-hidden className="text-base shrink-0">{spec.icon}</span>
      {/* Wraps rather than truncates — 予約日を決めてカレンダー登録 must stay fully readable at 320px. */}
      <span className="text-center leading-snug">{spec.label}</span>
    </button>
  );
}

export function ReviewActionBar({
  onAction,
  disabledActions,
}: {
  /** Optional. Omit entirely to render the controls fully inert (no handler is attached). */
  onAction?: (action: ReviewAction) => void;
  /** Additional disabled state supplied by the owner. */
  disabledActions?: ReviewAction[];
}) {
  const disabled = new Set(disabledActions ?? []);
  const isDisabled = (a: ReviewAction) => disabled.has(a);

  const renderGroup = (specs: ActionSpec[], cols: string) => (
    <div className={cn("grid gap-2", cols)}>
      {specs.map((s) => (
        <ActionButton key={s.action} spec={s} disabled={isDisabled(s.action)} onAction={onAction} />
      ))}
    </div>
  );

  return (
    <section className="bg-[#1e293b] rounded-xl shadow-lg p-5" aria-label="見積アクション">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">見積アクション</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-4">
        表示のみです。保存・PDF・LINE・カレンダー・請求書／納品書の各処理は、後続の統合フェーズで既存モジュールに接続されます。
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <p className={GROUP_LABEL}>出力・送信</p>
          {renderGroup(OUTPUT_ACTIONS, "grid-cols-1 sm:grid-cols-2")}
        </div>

        <div>
          <p className={GROUP_LABEL}>予約</p>
          {renderGroup(SCHEDULE_ACTIONS, "grid-cols-1")}
        </div>

        <div>
          <p className={GROUP_LABEL}>請求・納品</p>
          {renderGroup(DOCUMENT_ACTIONS, "grid-cols-1 sm:grid-cols-3")}
        </div>

        <div className="pt-3 border-t border-slate-700/60">
          <button
            type="button"
            disabled={isDisabled("cancel")}
            aria-disabled={isDisabled("cancel")}
            onClick={isDisabled("cancel") || !onAction ? undefined : () => onAction("cancel")}
            className={cn(
              // min-h 48px: tracked Ver2.2 touch-target requirement (48×48px).
              "w-full sm:w-auto text-sm px-5 py-2 min-h-[48px] rounded-lg border transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-slate-500",
              isDisabled("cancel")
                ? "border-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
                : "border-slate-700 text-slate-300 hover:border-slate-500",
            )}
          >
            キャンセル
          </button>
          <p className="text-[10px] text-slate-600 mt-2">
            仕様上、キャンセル以外の操作は自動保存を伴います（本画面では未接続）。
          </p>
        </div>
      </div>
    </section>
  );
}
