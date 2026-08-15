"use client";

// R90B Phase 1 / R92B Phase 2 — the operator surface for sending a saved estimate
// over LINE.
//
// R92B adds a PDF-link mode ALONGSIDE the text mode. The text flow is unchanged —
// the same single "LINEで送信" button, same one click; the PDF flow is a parallel
// entry button so muscle memory and the operation count are preserved. The chosen
// mode rides on the authorization and is carried through any resend prompt.
//
// ── WHY THE ATTEMPT LOGIC IS A SEPARATE PURE FUNCTION ───────────────────────
// This repo has no DOM harness, so a test cannot click. `runEstimateLineAttempt`
// below is the single implementation of the ordering and guard rules; the
// component calls it and the tests call the SAME function. A test helper that
// re-implemented it would prove a copy rather than the shipped behaviour.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_ESTIMATE_LINE_MESSAGE_LENGTH,
  computeEstimateLinePdfReserve,
  type EstimateDeliveryMode,
  type EstimateLineResult,
  type EstimateResendAuthorization,
} from "@/lib/line/send-estimate-line-core";
import { buildDefaultEstimateLineMessage } from "@/lib/line/estimate-line-default-message";
import type { EstimateShareListItem } from "@/lib/estimates/estimate-share-types";
import {
  listActiveEstimateShares,
  revokeEstimateShare,
} from "@/lib/estimates/estimate-share-actions";

// ── The injectable attempt core ─────────────────────────────────────────────

export type EstimateLineSender = (
  estimateId: string,
  authorization: EstimateResendAuthorization,
) => Promise<EstimateLineResult>;

// ── The injectable share list/revoke cores ──────────────────────────────────
//
// Server Actions are wired by default, but every branch is a pure injectable
// function the tests call DIRECTLY — the same functions the component calls, so
// the persistent-list and revoke-then-relist behaviour is proved without a DOM.

export type EstimateShareLister = (estimateId: string) => Promise<EstimateShareListItem[]>;
export type EstimateShareRevoker = (estimateId: string, shareId: string) => Promise<{ ok: boolean }>;

/** Load the active shares. A failure is swallowed to an empty list — never a send. */
export async function runShareListLoad(deps: {
  readonly estimateId: string;
  readonly listShares: EstimateShareLister;
  readonly onShares: (shares: EstimateShareListItem[]) => void;
}): Promise<void> {
  try {
    const shares = await deps.listShares(deps.estimateId);
    deps.onShares(shares);
  } catch {
    deps.onShares([]);
  }
}

/** Revoke one share, then RE-LIST on success so the UI reflects the new state. */
export async function runShareRevoke(deps: {
  readonly estimateId: string;
  readonly shareId: string;
  readonly revokeShare: EstimateShareRevoker;
  readonly reload: () => Promise<void>;
}): Promise<{ ok: boolean }> {
  const res = await deps.revokeShare(deps.estimateId, deps.shareId);
  if (res.ok) await deps.reload();
  return res;
}

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

// ── F1-R1 pure helpers (edit / length / refresh) ────────────────────────────

/**
 * Resolve the share-URL origin CLIENT-side from the build-inlined
 * NEXT_PUBLIC_APP_URL. Null when unresolvable — the client then falls back to
 * the text-mode limit and the SERVER (which is authoritative) still rejects.
 */
export function resolveClientShareOrigin(raw: string | undefined | null): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

/**
 * The client-side UTF-16 limit for the operator body per mode. In pdf-link
 * mode the server appends a block of exactly-known length, so the client limit
 * subtracts the same reserve the server computes — it can never accept a body
 * the server-composed PDF message would necessarily reject (under matching
 * configuration; on divergence the server still rejects).
 */
export function computeClientBodyLimit(mode: EstimateDeliveryMode, origin: string | null): number {
  if (mode === "pdf-link" && origin !== null) {
    return MAX_ESTIMATE_LINE_MESSAGE_LENGTH - computeEstimateLinePdfReserve(origin);
  }
  return MAX_ESTIMATE_LINE_MESSAGE_LENGTH;
}

/** Body validity for the edit surface — UTF-16 units via string.length, no truncation. */
export function validateEstimateLineBody(
  body: string,
  limit: number,
): { readonly valid: boolean; readonly reason: "empty" | "too-long" | null } {
  if (body.trim().length === 0) return { valid: false, reason: "empty" };
  if (body.length > limit) return { valid: false, reason: "too-long" };
  return { valid: true, reason: null };
}

/**
 * Whether an outcome may have produced a line_message_logs row, and therefore
 * whether the history card should refetch. Blocks/skips/resend prompts and
 * pdf-unavailable provably wrote nothing, so they never trigger a refetch.
 */
export function shouldRefreshEstimateLineHistory(kind: EstimateLineResult["kind"]): boolean {
  return kind === "sent" || kind === "failed" || kind === "unknown";
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
  "message-empty":            "メッセージが空のため送信できません。本文を入力してください。",
  "message-too-long":         "メッセージが長すぎるため送信できません。本文を短くしてください。",
};

const UNKNOWN_TEXT =
  "送信結果を確認できませんでした。すでに送信されている可能性があります。";

// pdf-link only. The share could not be produced, so NOTHING was sent — the
// message is safe to retry once the cause is resolved.
const PDF_UNAVAILABLE_TEXT: Record<string, string> = {
  "invalid-app-url":            "共有リンクのURL設定が正しくないため、PDFリンクを作成できませんでした。管理者にご確認ください。",
  "pdf-generation-failed":      "PDFの生成に失敗したため、リンクを作成できませんでした。時間をおいて再度お試しください。",
  "document-persist-failed":    "PDFの保存に失敗したため、リンクを作成できませんでした。時間をおいて再度お試しください。",
  "share-create-failed":        "共有リンクの作成に失敗しました。時間をおいて再度お試しください。",
  "reference-integrity-failed": "この見積のPDFリンクを作成できませんでした。画面を再読み込みしてください。",
};

// ── Component ───────────────────────────────────────────────────────────────

type Stage =
  | { readonly kind: "idle" }
  | { readonly kind: "confirming"; readonly authorization: EstimateResendAuthorization }
  | { readonly kind: "submitting" }
  | { readonly kind: "result"; readonly result: EstimateLineResult };

export function EstimateLineAction({
  estimateId, estimateNumber, customerName, send,
  dealerDisplayName = null,
  onAttemptSettled,
  // Server Actions by default; overridable for tests.
  listShares = listActiveEstimateShares,
  revokeShare = revokeEstimateShare,
}: {
  estimateId: string;
  estimateNumber: string;
  customerName: string;
  send: EstimateLineSender;
  /** dealer_settings.business_name, server-resolved; null omits its template line. */
  dealerDisplayName?: string | null;
  /** Fired after outcomes that may have produced a history log row. */
  onAttemptSettled?: () => void;
  listShares?: EstimateShareLister;
  revokeShare?: EstimateShareRevoker;
}) {
  const inFlight = useRef(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  // The delivery mode chosen when the operator opened the flow. Carried through
  // the confirm and any resend prompt so a resend keeps the original mode.
  const [mode, setMode] = useState<EstimateDeliveryMode>("text");
  // F1-R1 — the operator-editable message body. Initialized ONCE per mount from
  // the single code-defined GYEON default; moving between edit, confirmation,
  // mode selection and resend confirmation never re-runs this initializer, so
  // an operator edit is never silently restored to the default.
  const [editedBody, setEditedBody] = useState<string>(() =>
    buildDefaultEstimateLineMessage({ customerName, estimateNumber, dealerDisplayName }),
  );
  const clientOrigin = resolveClientShareOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const bodyLimit = computeClientBodyLimit(mode, clientOrigin);
  const bodyCheck = validateEstimateLineBody(editedBody, bodyLimit);
  // The persistent list of active share links, loaded on mount and refreshed
  // after every successful revoke.
  const [shares, setShares] = useState<EstimateShareListItem[]>([]);

  const reloadShares = useCallback(
    () => runShareListLoad({ estimateId, listShares, onShares: setShares }),
    [estimateId, listShares],
  );

  // Load-only on mount / when the estimate changes. This effect NEVER initiates a
  // LINE send — it calls the read-only lister and nothing else.
  useEffect(() => {
    void reloadShares();
  }, [reloadShares]);

  const open = useCallback((chosen: EstimateDeliveryMode) => {
    setMode(chosen);
    setStage({ kind: "confirming", authorization: { kind: "first-send", mode: chosen } });
  }, []);

  const attempt = useCallback((authorization: EstimateResendAuthorization) => {
    // Fail-closed client gate: an empty or over-limit body never reaches the
    // server (the proceed controls are disabled too — this guards bypasses).
    const limit = computeClientBodyLimit(authorization.mode ?? "text", clientOrigin);
    if (!validateEstimateLineBody(editedBody, limit).valid) return;
    void runEstimateLineAttempt({
      inFlight,
      estimateId,
      // The confirmed body rides the closed authorization union; recipient,
      // dealer, tokens and URLs still have nowhere to enter.
      authorization: { ...authorization, messageBody: editedBody },
      send,
      onSubmitting: () => setStage({ kind: "submitting" }),
      onResult: (result) => {
        setStage({ kind: "result", result });
        if (shouldRefreshEstimateLineHistory(result.kind)) onAttemptSettled?.();
      },
    });
  }, [estimateId, send, editedBody, clientOrigin, onAttemptSettled]);

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
        <div data-testid="line-state-idle" className="flex gap-2">
          {/* Text mode — unchanged Phase-1 entry: one click, same label. */}
          <button
            type="button"
            data-testid="line-send-open"
            onClick={() => open("text")}
            className={`${btn} bg-[#06c755] hover:bg-[#05b34c] text-white`}
          >
            LINEで送信
          </button>
          {/* pdf-link mode — parallel entry, no extra step added to the text flow. */}
          <button
            type="button"
            data-testid="line-send-open-pdf"
            onClick={() => open("pdf-link")}
            className={`${btn} bg-[#06c755]/80 hover:bg-[#05b34c] text-white`}
          >
            PDF付きで送信
          </button>
        </div>
      )}

      {stage.kind === "confirming" && (
        <div data-testid="line-state-confirming" className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-200">
            {customerName} さんの LINE に見積 {estimateNumber} を
            {stage.authorization.mode === "pdf-link" ? "PDFリンク付きで" : ""}送信します。よろしいですか？
          </p>
          {/* F1-R1 — the message the customer receives, as a REAL editable value
              (never a placeholder). This textarea IS the confirmation: the exact
              body below is what will be sent (pdf-link additionally appends the
              server-generated PDF sentence + link, noted underneath). */}
          <textarea
            data-testid="line-message-editor"
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={8}
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/60 p-2 text-xs text-slate-200 whitespace-pre-wrap"
          />
          <div className="flex items-center justify-between mt-1">
            <span data-testid="line-message-counter" className="text-[10px] text-slate-500">
              {editedBody.length} / {bodyLimit}
            </span>
            {stage.authorization.mode === "pdf-link" && (
              <span className="text-[10px] text-slate-500">
                送信時にPDFリンクが自動で追記されます。
              </span>
            )}
          </div>
          {!bodyCheck.valid && (
            <p data-testid="line-message-invalid" className="text-[11px] text-amber-300 mt-1">
              {bodyCheck.reason === "empty"
                ? "本文が空です。入力してください。"
                : "本文が長すぎます。短くしてください。"}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              data-testid="line-send-confirm"
              disabled={!bodyCheck.valid}
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
              onClick={() => attempt({ kind: "confirmed-resend", mode })}
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
              onClick={() => attempt({ kind: "confirmed-resend", mode })}
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

      {result?.kind === "pdf-unavailable" && (
        <p data-testid="line-state-pdf-unavailable" className="text-xs text-rose-300">
          {PDF_UNAVAILABLE_TEXT[result.reason] ?? "PDFリンクを作成できませんでした。"}
        </p>
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

      {/* Persistent revoke UI. Renders ONLY the safe projection (expiry), never a
          token, hash or storage path. Revoking re-lists so the row disappears. */}
      {shares.length > 0 && (
        <div data-testid="line-share-list" className="rounded-md border border-slate-700 bg-slate-900/40 p-3 flex flex-col gap-2">
          <p className="text-[11px] text-slate-400">有効な共有リンク</p>
          {shares.map((s) => (
            <div key={s.id} data-testid="line-share-row" className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-300">有効期限: {s.expiresAt}</span>
              <button
                type="button"
                data-testid="line-share-revoke"
                onClick={() => void runShareRevoke({ estimateId, shareId: s.id, revokeShare, reload: reloadShares })}
                className={`${btn} bg-slate-700 hover:bg-rose-700 text-slate-200`}
              >
                取り消す
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EstimateLineAction;
