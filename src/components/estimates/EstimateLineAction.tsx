"use client";

// R90B Phase 1 — the operator surface for sending a saved estimate over LINE.
//
// TEXT ONLY. There is no PDF-link selector anywhere in this tree — not hidden,
// not disabled: absent. Phase 2 introduces it.
//
// ── WHY THE ATTEMPT LOGIC IS A SEPARATE PURE FUNCTION ───────────────────────
// This repo has no DOM harness, so a test cannot click. `runEstimateLineAttempt`
// below is the single implementation of the ordering and guard rules; the
// component calls it and the tests call the SAME function. A test helper that
// re-implemented it would prove a copy rather than the shipped behaviour.

import { useCallback, useRef, useState } from "react";

import type {
  EstimateLineResult,
  EstimateResendAuthorization,
} from "@/lib/line/send-estimate-line-core";

// ── The injectable attempt core ─────────────────────────────────────────────

export type EstimateLineSender = (
  estimateId: string,
  authorization: EstimateResendAuthorization,
) => Promise<EstimateLineResult>;

export type EstimateLineAttemptDeps = {
  /** Per-mount guard. Checked and set SYNCHRONOUSLY, before any await. */
  readonly inFlight: { current: boolean };
  readonly estimateId: string;
  readonly authorization: EstimateResendAuthorization;
  readonly send: EstimateLineSender;
  readonly onResult: (result: EstimateLineResult) => void;
  readonly onSubmitting: () => void;
};

/**
 * One send attempt.
 *
 * The guard is read and set before the first await, so two clicks in the same
 * tick cannot both reach the server: the second returns having done nothing. It
 * is a ref rather than React state because a state update is not visible to the
 * second synchronous caller.
 *
 * A THROW is reported as `unknown` WITHOUT a copyText: the request may have been
 * delivered, and this layer has no access to the server-generated message.
 */
export async function runEstimateLineAttempt(deps: EstimateLineAttemptDeps): Promise<void> {
  if (deps.inFlight.current) return;
  deps.inFlight.current = true;
  try {
    deps.onSubmitting();
    let result: EstimateLineResult;
    try {
      result = await deps.send(deps.estimateId, deps.authorization);
    } catch {
      result = { kind: "unknown", copyText: "" };
    }
    deps.onResult(result);
  } finally {
    deps.inFlight.current = false;
  }
}

// ── Fixed operator-facing copy ──────────────────────────────────────────────

// `skipped` carries no copyText — the message is never built for these outcomes —
// so neither string may promise one.
const SKIP_TEXT: Record<"no-customer" | "not-linked", string> = {
  "no-customer": "この見積に顧客が紐づいていないため送信できません。",
  "not-linked":  "お客様のLINE連携がありません。",
};

const BLOCK_TEXT: Record<string, string> = {
  "estimate-not-found":       "見積が見つかりません。",
  "line-disabled":            "LINE連携が無効です。設定を確認してください。",
  "no-access-token":          "LINEアクセストークンが設定されていません。",
  "invalid-request":          "送信要求が不正です。画面を再読み込みしてください。",
  "resend-check-unavailable": "送信済みかどうかを確認できなかったため、二重送信を避けて中止しました。時間をおいて再度お試しください。",
};

const UNKNOWN_TEXT =
  "送信結果を確認できませんでした。すでに送信されている可能性があります。";

// ── Component ───────────────────────────────────────────────────────────────

type Stage =
  | { readonly kind: "idle" }
  | { readonly kind: "confirming"; readonly authorization: EstimateResendAuthorization }
  | { readonly kind: "submitting" }
  | { readonly kind: "result"; readonly result: EstimateLineResult };

export function EstimateLineAction({
  estimateId, estimateNumber, customerName, send,
}: {
  estimateId: string;
  estimateNumber: string;
  customerName: string;
  send: EstimateLineSender;
}) {
  const inFlight = useRef(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const attempt = useCallback((authorization: EstimateResendAuthorization) => {
    void runEstimateLineAttempt({
      inFlight,
      estimateId,
      authorization,
      send,
      onSubmitting: () => setStage({ kind: "submitting" }),
      onResult: (result) => setStage({ kind: "result", result }),
    });
  }, [estimateId, send]);

  const btn = "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50";
  const result = stage.kind === "result" ? stage.result : null;
  // Only an explicit failure or an indeterminate outcome offers the fallback,
  // and only when the SERVER produced the text.
  const copyText =
    result && (result.kind === "failed" || result.kind === "unknown") && result.copyText
      ? result.copyText
      : null;

  return (
    <div data-testid="estimate-line-action" className="flex flex-col gap-2">
      {stage.kind === "idle" && (
        <div data-testid="line-state-idle">
          <button
            type="button"
            data-testid="line-send-open"
            onClick={() => setStage({ kind: "confirming", authorization: { kind: "first-send" } })}
            className={`${btn} bg-[#06c755] hover:bg-[#05b34c] text-white`}
          >
            LINEで送信
          </button>
        </div>
      )}

      {stage.kind === "confirming" && (
        <div data-testid="line-state-confirming" className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-200">
            {customerName} さんの LINE に見積 {estimateNumber} を送信します。よろしいですか？
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              data-testid="line-send-confirm"
              onClick={() => attempt(stage.authorization)}
              className={`${btn} bg-[#06c755] hover:bg-[#05b34c] text-white`}
            >
              送信する
            </button>
            <button
              type="button"
              data-testid="line-send-cancel"
              onClick={() => setStage({ kind: "idle" })}
              className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {stage.kind === "submitting" && (
        <div data-testid="line-state-submitting">
          <button type="button" data-testid="line-send-submitting" disabled className={`${btn} bg-slate-700 text-slate-400`}>
            送信中…
          </button>
        </div>
      )}

      {result?.kind === "resend-required" && (
        <div data-testid="line-state-resend-required" className="rounded-md border border-amber-600/50 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-300">
            この見積は{result.sentAt ? ` ${result.sentAt} に` : "すでに"}送信済みです。再送しますか？
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              data-testid="line-resend-confirm"
              onClick={() => attempt({ kind: "confirmed-resend" })}
              className={`${btn} bg-amber-700 hover:bg-amber-600 text-white`}
            >
              再送する
            </button>
            <button
              type="button"
              data-testid="line-resend-cancel"
              onClick={() => setStage({ kind: "idle" })}
              className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {result?.kind === "resend-required-indeterminate" && (
        <div data-testid="line-state-resend-indeterminate" className="rounded-md border border-amber-600/50 bg-amber-500/10 p-3">
          {/* NOT 「送信済み」: the last attempt's delivery is unconfirmed, so the
              message says exactly that rather than asserting it arrived. */}
          <p className="text-xs text-amber-300">
            前回の送信結果を確認できていません（{result.attemptedAt ?? "日時不明"}）。すでに届いている可能性があります。それでも再送しますか？
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              data-testid="line-resend-indeterminate-confirm"
              onClick={() => attempt({ kind: "confirmed-resend" })}
              className={`${btn} bg-amber-700 hover:bg-amber-600 text-white`}
            >
              それでも再送する
            </button>
            <button
              type="button"
              data-testid="line-resend-indeterminate-cancel"
              onClick={() => setStage({ kind: "idle" })}
              className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {result?.kind === "sent" && (
        <p data-testid="line-state-sent" className="text-xs text-emerald-300">LINEで送信しました。</p>
      )}

      {result?.kind === "skipped" && (
        <p data-testid="line-state-skipped" className="text-xs text-amber-300">{SKIP_TEXT[result.reason]}</p>
      )}

      {result?.kind === "blocked" && (
        <p data-testid="line-state-blocked" className="text-xs text-amber-300">
          {BLOCK_TEXT[result.reason] ?? "送信できません。"}
        </p>
      )}

      {result?.kind === "failed" && (
        <p data-testid="line-state-failed" className="text-xs text-rose-300">{result.message}</p>
      )}

      {result?.kind === "unknown" && (
        <p data-testid="line-state-unknown" className="text-xs text-amber-300">{UNKNOWN_TEXT}</p>
      )}

      {copyText && (
        <div data-testid="line-copy-fallback" className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          {/* The exact server-generated message — never re-composed here. */}
          <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words">{copyText}</pre>
          <button
            type="button"
            data-testid="line-copy-button"
            onClick={() => { void navigator.clipboard?.writeText(copyText); }}
            className={`${btn} mt-2 bg-slate-700 hover:bg-slate-600 text-slate-200`}
          >
            メッセージをコピー
          </button>
        </div>
      )}

      {/* The ordinary Close/reset must not appear alongside EITHER resend prompt —
          both offer their own explicit resend/cancel pair. */}
      {(result && result.kind !== "resend-required" && result.kind !== "resend-required-indeterminate") && (
        <div>
          <button
            type="button"
            data-testid="line-send-reset"
            onClick={() => setStage({ kind: "idle" })}
            className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-300`}
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

export default EstimateLineAction;
