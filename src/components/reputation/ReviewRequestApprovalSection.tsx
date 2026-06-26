"use client";

// DealerOS — Review Request Approval Section
//
// Sprint 11E Phase B/E: initial dealer-facing review request approval UI.
// Sprint 11F Phase D: added LINE message preview, link readiness, and copy button.
//
// Shown inside WorkOrderDetail when:
//   - work order status === "completed"
//   - work order has a linked customer_id
//
// Features:
//   - Loads dry-run readiness data on mount
//   - Shows customer, vehicle, service summary
//   - Shows AI Gateway + review destination + compliance readiness
//   - Lists missing settings the dealer must configure
//   - LINE message preview with character count (Sprint 11F)
//   - Per-destination link readiness (Sprint 11F)
//   - Copy message text button (Sprint 11F)
//   - Approve / Reject / Skip buttons (all dry-run — no LINE sent)
//   - Edit draft button (disabled — AI generation is Phase 11G+)
//
// Persistence:
//   All approve/reject/skip actions return dry_run: true.
//   No ReviewRequest is persisted — requires review_requests DB table migration.
//   State is local React state only.
//
// LINE dispatch:
//   Not implemented. Deferred to Phase 11G+.
//   Real LINE dispatch requires dealer LINE settings and explicit approval.
//
// AI generation:
//   Not implemented. Deferred to Phase 11G+.

import { useState, useEffect, useTransition } from "react";
import type {
  ReviewRequestApprovalData,
  ReviewRequestApprovalStatus,
  ReviewRequestDryRunActionResult,
} from "@/lib/reputation/actions/review-request-actions";
import {
  prepareReviewRequestApproval,
  approveReviewRequestDryRun,
  rejectReviewRequestDryRun,
  skipReviewRequestDryRun,
} from "@/lib/reputation/actions/review-request-actions";
import type { ReputationReadinessCheck } from "@/lib/reputation/runtime/runtime-types";
import type { ReviewLinkReadinessItem } from "@/lib/reputation/line/review-line-types";
import { linkReadinessStatusLabel } from "@/lib/reputation/line/review-link-readiness";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ReviewRequestApprovalSectionProps {
  workOrderId: string;
  isCompleted: boolean;
}

// ─── Section state ─────────────────────────────────────────────────────────────

type SectionPhase =
  | "idle"
  | "loading"
  | "loaded"
  | "approving"
  | "rejecting"
  | "skipping"
  | "done";

interface SectionState {
  phase:  SectionPhase;
  data:   ReviewRequestApprovalData | null;
  result: ReviewRequestDryRunActionResult | null;
  error:  string | null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function statusBadge(status: ReviewRequestApprovalStatus): { label: string; cls: string } {
  switch (status) {
    case "ready":              return { label: "承認可能",           cls: "bg-green-600/20 text-green-400 border border-green-600/30" };
    case "not_ready":          return { label: "設定が必要",         cls: "bg-amber-600/20 text-amber-400 border border-amber-600/30" };
    case "feature_locked":     return { label: "Pro+必須",           cls: "bg-slate-700 text-slate-400 border border-slate-600" };
    case "no_customer":        return { label: "顧客未設定",         cls: "bg-slate-700 text-slate-400 border border-slate-600" };
    case "gateway_locked":     return { label: "AI未設定",           cls: "bg-red-600/20 text-red-400 border border-red-600/30" };
    case "compliance_blocked": return { label: "コンプライアンス違反", cls: "bg-red-700/20 text-red-400 border border-red-700/30" };
  }
}

function ReadinessRow({ check }: { check: ReputationReadinessCheck }) {
  const icon   = check.status === "passed" ? "✓" : check.status === "failed" ? "✗" : check.status === "warning" ? "⚠" : "—";
  const iconCls = check.status === "passed" ? "text-green-400" : check.status === "failed" ? "text-red-400" : check.status === "warning" ? "text-amber-400" : "text-slate-500";
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`text-[11px] font-bold shrink-0 mt-0.5 ${iconCls}`}>{icon}</span>
      <span className="text-[11px] text-slate-400 leading-relaxed">{check.message}</span>
    </div>
  );
}

function LinkReadinessRow({ item }: { item: ReviewLinkReadinessItem }) {
  const ready = item.status === "ready";
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold shrink-0 ${ready ? "text-green-400" : "text-slate-600"}`}>
          {ready ? "✓" : "○"}
        </span>
        <span className={`text-[11px] ${ready ? "text-slate-300" : "text-slate-600"}`}>
          {item.label}
        </span>
      </div>
      <span className={`text-[10px] shrink-0 ${ready ? "text-green-500/70" : "text-slate-700"}`}>
        {linkReadinessStatusLabel(item.status)}
      </span>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function ReviewRequestApprovalSection({
  workOrderId,
  isCompleted,
}: ReviewRequestApprovalSectionProps) {
  const [state,     setState]     = useState<SectionState>({ phase: "idle", data: null, result: null, error: null });
  const [expanded,  setExpanded]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [, startTransition]       = useTransition();

  // ── Load on mount ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCompleted) return;
    setState((s) => ({ ...s, phase: "loading" }));
    prepareReviewRequestApproval(workOrderId).then((data) => {
      setState({ phase: "loaded", data, result: null, error: null });
    }).catch(() => {
      setState({ phase: "loaded", data: null, result: null, error: "データの取得に失敗しました。" });
    });
  }, [workOrderId, isCompleted]);

  // ── Action handlers ────────────────────────────────────────────────────────────
  function handleApprove() {
    setState((s) => ({ ...s, phase: "approving" }));
    startTransition(async () => {
      const result = await approveReviewRequestDryRun(workOrderId);
      setState((s) => ({ ...s, phase: "done", result }));
    });
  }
  function handleReject() {
    setState((s) => ({ ...s, phase: "rejecting" }));
    startTransition(async () => {
      const result = await rejectReviewRequestDryRun(workOrderId);
      setState((s) => ({ ...s, phase: "done", result }));
    });
  }
  function handleSkip() {
    setState((s) => ({ ...s, phase: "skipping" }));
    startTransition(async () => {
      const result = await skipReviewRequestDryRun(workOrderId);
      setState((s) => ({ ...s, phase: "done", result }));
    });
  }

  // ── Copy handler ───────────────────────────────────────────────────────────────
  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard not available — silently ignore (non-blocking)
    });
  }

  // ── Guards ─────────────────────────────────────────────────────────────────────
  if (!isCompleted) {
    return <p className="text-xs text-slate-600 text-center py-2">施工完了後にレビュー依頼を準備できます。</p>;
  }

  if (state.phase === "idle" || state.phase === "loading") {
    return <p className="text-xs text-slate-500 text-center py-4 animate-pulse">レビュー依頼の準備状況を確認中...</p>;
  }

  if (state.error || !state.data) {
    return (
      <div className="bg-red-900/10 border border-red-700/30 rounded-lg px-4 py-3 text-center">
        <p className="text-xs text-red-400">{state.error ?? "エラーが発生しました。"}</p>
      </div>
    );
  }

  const { data } = state;
  const badge    = statusBadge(data.status);
  const busy     = state.phase === "approving" || state.phase === "rejecting" || state.phase === "skipping";

  // ── Done state ─────────────────────────────────────────────────────────────────
  if (state.phase === "done" && state.result) {
    const r = state.result;
    if (!r.success) {
      return (
        <div className="flex flex-col gap-3">
          <div className="bg-red-900/10 border border-red-700/30 rounded-lg px-4 py-3">
            <p className="text-xs text-red-400">{r.error}</p>
          </div>
          <button onClick={() => setState({ phase: "loaded", data, result: null, error: null })}
            className="text-xs text-slate-400 hover:text-slate-100 self-start transition-colors">
            ← 戻る
          </button>
        </div>
      );
    }
    const actionIcon = r.action === "approved" ? "✓" : r.action === "rejected" ? "✗" : "—";
    const actionBg   = r.action === "approved" ? "bg-green-900/20 border-green-700/30" : "bg-slate-800 border-slate-700";
    const actionText = r.action === "approved" ? "text-green-300" : "text-slate-400";
    return (
      <div className={`rounded-lg border px-4 py-4 flex flex-col gap-3 ${actionBg}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${actionText}`}>{actionIcon}</span>
          <p className={`text-xs font-medium ${actionText}`}>{r.message}</p>
        </div>
        {r.action === "approved" && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-amber-500/80">⚠ LINE送信は未実装です（Phase 11G+で実装予定）</p>
            <p className="text-[10px] text-slate-600">⚠ レビュー依頼はDBに保存されません（review_requestsテーブルのmigrationが必要）</p>
          </div>
        )}
        <button onClick={() => setState({ phase: "loaded", data, result: null, error: null })}
          className="text-xs text-slate-500 hover:text-slate-300 self-start transition-colors">
          ← 戻る
        </button>
      </div>
    );
  }

  // ── Feature / customer guards ─────────────────────────────────────────────────
  if (data.status === "feature_locked") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">🔒</div>
        <p className="text-xs text-slate-500 text-center">
          AIレビュー依頼機能は <span className="text-slate-300 font-medium">Pro+プラン</span> が必要です。
        </p>
      </div>
    );
  }
  if (data.status === "no_customer") {
    return (
      <div className="text-center py-3">
        <p className="text-xs text-slate-600">{data.missing_settings[0] ?? "顧客情報が必要です。"}</p>
      </div>
    );
  }

  // ── Main approval card ─────────────────────────────────────────────────────────
  const preview = data.message_preview;

  return (
    <div className="flex flex-col gap-4">

      {/* Status badge + dry-run label */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-[10px] text-slate-600">ドライラン — LINE送信・DB保存は未実装</span>
      </div>

      {/* Customer / Vehicle / Service summary */}
      <div className="bg-[#0f172a] rounded-lg border border-slate-700 px-4 py-3 flex flex-col gap-2">
        {data.customer_name && (
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-[10px] text-slate-500 shrink-0">顧客</span>
            <span className="text-xs text-slate-200 text-right">{data.customer_name}</span>
          </div>
        )}
        {data.vehicle_label && (
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-[10px] text-slate-500 shrink-0">車両</span>
            <span className="text-xs text-slate-300 text-right">{data.vehicle_label}</span>
          </div>
        )}
        {data.service_summary && (
          <div className="flex flex-col gap-1 pt-1 border-t border-slate-700/50">
            <span className="text-[10px] text-slate-500">施工概要</span>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{data.service_summary}</p>
          </div>
        )}
      </div>

      {/* LINE message preview (Sprint 11F) */}
      {preview ? (
        <div className="bg-[#0f172a] rounded-lg border border-blue-800/30 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                LINEメッセージプレビュー
              </p>
              {!preview.validation.passed && (
                <span className="text-[9px] bg-red-800/40 text-red-400 px-1.5 py-0.5 rounded">違反あり</span>
              )}
            </div>
            <span className="text-[10px] text-slate-600">
              {preview.payload.character_count}文字
            </span>
          </div>

          {/* Message text */}
          <div className="px-4 py-3">
            <pre className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
              {preview.payload.message_text}
            </pre>
          </div>

          {/* Validation violations (if any) */}
          {preview.validation.violations.length > 0 && (
            <div className="mx-4 mb-3 bg-red-900/10 border border-red-700/30 rounded px-3 py-2">
              {preview.validation.violations.map((v, i) => (
                <p key={i} className="text-[10px] text-red-400">{v.description}</p>
              ))}
            </div>
          )}

          {/* Copy button + LINE notice */}
          <div className="flex items-center justify-between px-4 pb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(preview.payload.message_text)}
                className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded transition-colors"
              >
                {copied ? "コピー済み ✓" : "メッセージをコピー"}
              </button>
            </div>
            <p className="text-[10px] text-slate-700 shrink-0">
              ※ LINE送信は未実装（Phase 11G+）
            </p>
          </div>

          {/* Link readiness */}
          <div className="border-t border-slate-700/50 px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              リンク設定状況
            </p>
            {preview.link_readiness.items.map((item, i) => (
              <LinkReadinessRow key={i} item={item} />
            ))}
            {!preview.link_readiness.has_any_url && (
              <p className="text-[10px] text-amber-600/70 mt-1.5">
                レビューリンクが未設定です。設定画面でURLを追加してください。
              </p>
            )}
          </div>
        </div>
      ) : (
        // Fallback if message_preview is null (e.g. insufficient context)
        <div className="bg-[#0f172a] rounded-lg border border-slate-700/50 border-dashed px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            LINEメッセージプレビュー
          </p>
          <p className="text-xs text-slate-700 italic">メッセージの生成に必要な情報が不足しています。</p>
        </div>
      )}

      {/* Readiness checks (collapsible) */}
      <div className="bg-[#0f172a] rounded-lg border border-slate-700">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        >
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            準備状況チェック ({data.readiness_checks.filter(c => c.status === "passed").length}/{data.readiness_checks.length})
          </span>
          <span className="text-slate-600 text-[10px]">{expanded ? "▲" : "▼"}</span>
        </button>
        {expanded && (
          <div className="px-4 pb-3 border-t border-slate-700/50">
            {data.readiness_checks.map((check, i) => (
              <ReadinessRow key={i} check={check} />
            ))}
          </div>
        )}
      </div>

      {/* Missing settings */}
      {data.missing_settings.length > 0 && (
        <div className="bg-amber-900/10 border border-amber-700/30 rounded-lg px-4 py-3">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2">設定が必要な項目</p>
          <ul className="flex flex-col gap-1">
            {data.missing_settings.map((s, i) => (
              <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Compliance checklist */}
      <div className="bg-[#0f172a] rounded-lg border border-slate-700 px-4 py-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">コンプライアンス保証</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
          {data.compliance_checklist.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <span className="text-green-400 text-[10px] font-bold shrink-0 mt-0.5">✓</span>
              <span className="text-[10px] text-slate-500 leading-relaxed line-clamp-2" title={item.description}>
                {item.rule.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {state.phase === "approving" ? "処理中..." : "承認（ドライラン）"}
        </button>
        <button
          onClick={handleReject}
          disabled={busy}
          className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 px-4 py-2 rounded-lg transition-colors"
        >
          {state.phase === "rejecting" ? "処理中..." : "否認"}
        </button>
        <button
          onClick={handleSkip}
          disabled={busy}
          className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 transition-colors"
        >
          {state.phase === "skipping" ? "..." : "後で"}
        </button>
        <button
          disabled
          title="AI生成ドラフト編集はPhase 11G+で実装予定"
          className="text-xs text-slate-700 cursor-not-allowed px-3 py-2 ml-auto"
        >
          下書き編集（Phase 11G+）
        </button>
      </div>

      {/* Footer notice */}
      <p className="text-[10px] text-slate-700 border-t border-slate-800 pt-2">
        ※ 現在はドライランのみです。LINE送信 · AI生成 · DB保存はPhase 11G+で実装予定です。
      </p>
    </div>
  );
}
