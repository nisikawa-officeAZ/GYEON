"use client";

// B3-B1B I2 — monthly-statement detail: lines, receipt split, adjustments, closing formula
// and reconciliation state. Draft-only actions: adjustments, issuance (the existing
// service-role-isolated server action), and abandonment (with a number-burn warning).
// E3: issued statements gain the immutable PDF artifact controls — 作成 (retry-safe ensure)
// while the pointer is null, ダウンロード (sign-only) once pointed; voided keeps download only.
// No regenerate control exists: the artifact is immutable. No credentials or URLs are persisted.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MonthlyStatementStatus,
  monthlyStatementStatusLabel,
} from "@/lib/monthly-statements/monthly-statement-types";
import type { MonthlyStatementDetail } from "@/lib/monthly-statements/get-monthly-statement-detail";
import { issueMonthlyStatement } from "@/lib/monthly-statements/issue-monthly-statement";
import { abandonMonthlyStatementDraft } from "@/lib/monthly-statements/abandon-monthly-statement-draft";
import { addStatementAdjustment, deleteStatementAdjustment } from "@/lib/monthly-statements/statement-adjustment-actions";
import { ensureMonthlyInvoicePdf, getMonthlyInvoicePdfUrl } from "@/lib/monthly-statements/ensure-monthly-invoice-pdf";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<MonthlyStatementStatus, string> = {
  draft:  "bg-amber-600 text-white",
  issued: "bg-green-600 text-white",
  voided: "bg-slate-600 text-slate-300",
};

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs ${strong ? "text-slate-100 font-semibold" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

interface MonthlyStatementDetailClientProps {
  detail: MonthlyStatementDetail;
}

export default function MonthlyStatementDetailClient({ detail }: MonthlyStatementDetailClientProps) {
  const router = useRouter();
  const { statement: s, lines, receipts, adjustments, previewReceipts, totals } = detail;
  const isDraft = s.status === "draft";
  const isIssued = s.status === "issued";
  const isVoided = s.status === "voided";
  const hasPdfPointer = Boolean(s.pdf_document_file_id);

  const [error, setError]   = useState<string | null>(null);
  // Artifact feedback carries its tone: operator-attention states are NOT retry invitations.
  const [artifactNotice, setArtifactNotice] = useState<{ tone: "operator" | "retry"; message: string } | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [pending, startTransition] = useTransition();

  const customerName = (() => {
    const snap = s.customer_snapshot as { name?: string; last_name?: string; first_name?: string };
    return [snap?.last_name, snap?.first_name].filter(Boolean).join(" ") || snap?.name || "—";
  })();

  function handleIssue() {
    setError(null);
    startTransition(async () => {
      const result = await issueMonthlyStatement(s.id);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function handleArtifactResult(result: Awaited<ReturnType<typeof ensureMonthlyInvoicePdf>>) {
    if (result.kind === "ready") {
      setArtifactNotice(null);
      // The signed URL carries download disposition (createSignedUrl { download: true }), so a
      // same-tab navigation downloads the PDF without leaving the page. window.open after an
      // await is popup-blocked by browsers; location.assign is not.
      window.location.assign(result.signedUrl);
      router.refresh();
      return;
    }
    const operatorKinds = ["artifact_missing", "cleanup_failed"];
    setArtifactNotice({
      tone: operatorKinds.includes(result.kind) ? "operator" : "retry",
      message: result.message,
    });
  }

  function handleCreatePdf() {
    setArtifactNotice(null);
    startTransition(async () => {
      handleArtifactResult(await ensureMonthlyInvoicePdf(s.id));
    });
  }

  function handleDownloadPdf() {
    setArtifactNotice(null);
    startTransition(async () => {
      handleArtifactResult(await getMonthlyInvoicePdfUrl(s.id));
    });
  }

  function handleAbandon() {
    setError(null);
    startTransition(async () => {
      const result = await abandonMonthlyStatementDraft(s.id);
      if ("error" in result) { setError(result.error); setConfirmAbandon(false); }
      else router.push("/monthly-statements");
    });
  }

  function handleAddAdjustment() {
    setError(null);
    const amount = parseFloat(adjAmount);
    startTransition(async () => {
      const result = await addStatementAdjustment(s.id, amount, adjReason);
      if ("error" in result) setError(result.error);
      else { setAdjAmount(""); setAdjReason(""); router.refresh(); }
    });
  }

  function handleDeleteAdjustment(adjustmentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteStatementAdjustment(adjustmentId);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-100">{s.statement_number ?? "（番号未設定）"}</h1>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[s.status]}`}>
              {monthlyStatementStatusLabel(s.status)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {customerName} ・ {s.period_start} 〜 {s.period_end}
            {s.payment_due_date && ` ・ お支払期日 ${s.payment_due_date}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <button onClick={() => setConfirmAbandon(true)} disabled={pending}
                className="text-xs text-slate-400 hover:text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                下書きを破棄
              </button>
              <button onClick={handleIssue} disabled={pending}
                className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {pending ? "処理中..." : "発行する"}
              </button>
            </>
          )}
          {isIssued && !hasPdfPointer && (
            <button onClick={handleCreatePdf} disabled={pending}
              className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {pending ? "処理中..." : "請求書PDFを作成"}
            </button>
          )}
          {(isIssued || isVoided) && hasPdfPointer && (
            <button onClick={handleDownloadPdf} disabled={pending}
              className="text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {pending ? "処理中..." : "PDFをダウンロード"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {artifactNotice && (
        <div className={artifactNotice.tone === "operator"
          ? "bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2"
          : "bg-red-900/30 border border-red-700 rounded-lg px-3 py-2"}>
          <p className={`text-xs ${artifactNotice.tone === "operator" ? "text-amber-400" : "text-red-400"}`}>
            {artifactNotice.message}
          </p>
        </div>
      )}

      {/* totals + closing formula + reconciliation */}
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">残高サマリー</h3>
          <span className="text-[10px] text-slate-500">
            {totals.source === "stored" ? "発行時確定値" : "下書きプレビュー（現在の登録データから算出）"}
          </span>
        </div>
        <TotalRow label="前月繰越残高" value={formatYen(totals.opening_balance)} />
        <TotalRow label="当月請求額（税込）" value={formatYen(totals.current_total)} />
        <TotalRow label="当月入金額" value={`- ${formatYen(totals.payments_received_total)}`} />
        <TotalRow label="　うち請求書充当" value={formatYen(totals.allocated_payments_total)} />
        <TotalRow label="　うち前受金（未充当）" value={formatYen(totals.unapplied_credit_total)} />
        <TotalRow label="調整額" value={formatYen(totals.adjustments_total)} />
        <TotalRow label="締め残高" value={formatYen(totals.closing_balance)} strong />
        <p className="text-[10px] text-slate-500 mt-2">
          締め残高 ＝ 前月繰越 ＋ 当月請求 − 当月入金 ＋ 調整
        </p>
        <p className={`text-[10px] mt-0.5 ${totals.reconciles ? "text-slate-500" : "text-red-400"}`}>
          入金内訳の整合（当月入金 ＝ 充当 ＋ 前受金）: {totals.reconciles ? "一致" : "不一致（要確認）"}
        </p>
      </div>

      {/* lines */}
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          請求明細（{lines.length}件）
        </h3>
        {lines.length === 0 ? (
          <p className="text-xs text-slate-500">明細がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500">
                  <th className="text-left py-2 pr-3 font-medium">納品日</th>
                  <th className="text-left py-2 pr-3 font-medium">請求書番号</th>
                  <th className="text-left py-2 pr-3 font-medium">作業内容</th>
                  <th className="text-right py-2 pr-3 font-medium hidden sm:table-cell">小計</th>
                  <th className="text-right py-2 pr-3 font-medium hidden sm:table-cell">消費税</th>
                  <th className="text-right py-2 font-medium">金額（税込）</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{l.delivery_date}</td>
                    <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{l.invoice_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-300">{l.work_description_snapshot || "—"}</td>
                    <td className="py-2 pr-3 text-right text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      {formatYen(l.subtotal_snapshot)}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      {formatYen(l.tax_snapshot)}
                    </td>
                    <td className="py-2 text-right text-slate-200 font-medium whitespace-nowrap">
                      {formatYen(l.total_snapshot)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* receipts: stored snapshots (issued/voided) or live preview split (draft) */}
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {totals.source === "stored" ? `入金内訳（発行時スナップショット・${receipts.length}件）` : `入金内訳プレビュー（${previewReceipts.length}件）`}
        </h3>
        {totals.source === "stored" ? (
          receipts.length === 0 ? (
            <p className="text-xs text-slate-500">対象期間の入金はありません</p>
          ) : (
            <div className="flex flex-col">
              {receipts.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-1.5 border-b border-slate-800/60 last:border-b-0 text-xs">
                  <span className="text-slate-400">
                    {r.payment_date_snapshot} ・ {r.payment_number_snapshot ?? "（番号なし）"}
                  </span>
                  <span className="text-slate-300">
                    {formatYen(r.amount_snapshot)}
                    <span className="text-slate-500 ml-2">
                      （充当 {formatYen(r.allocated_amount_snapshot)} / 前受 {formatYen(r.unapplied_amount_snapshot)}）
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )
        ) : previewReceipts.length === 0 ? (
          <p className="text-xs text-slate-500">対象期間の入金はまだありません（発行時点の入金が確定値になります）</p>
        ) : (
          <div className="flex flex-col">
            {previewReceipts.map((r) => (
              <div key={r.paymentId} className="flex justify-between items-center py-1.5 border-b border-slate-800/60 last:border-b-0 text-xs">
                <span className="text-slate-400">{r.paymentId.slice(0, 8).toUpperCase()}</span>
                <span className="text-slate-300">
                  {formatYen(r.amount)}
                  <span className="text-slate-500 ml-2">
                    （充当 {formatYen(r.allocated)} / 前受 {formatYen(r.unapplied)}）
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* adjustments */}
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          調整（{adjustments.length}件）
        </h3>
        {adjustments.length > 0 && (
          <div className="flex flex-col">
            {adjustments.map((a) => (
              <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-slate-800/60 last:border-b-0 text-xs">
                <span className="text-slate-300">{a.reason}</span>
                <span className="flex items-center gap-2">
                  <span className={a.signed_amount < 0 ? "text-red-300" : "text-slate-200"}>
                    {formatYen(a.signed_amount)}
                  </span>
                  {isDraft && (
                    <button onClick={() => handleDeleteAdjustment(a.id)} disabled={pending}
                      className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                      ✕
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {isDraft && (
          <div className="flex flex-wrap gap-2 items-end pt-1 border-t border-slate-700/60">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">調整額（マイナス可）</label>
              <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="-1000"
                className="w-32 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-[10px] text-slate-500">理由（必須）</label>
              <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}
                placeholder="値引き・端数調整など"
                className="bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors" />
            </div>
            <button onClick={handleAddAdjustment} disabled={pending}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              追加
            </button>
          </div>
        )}
      </div>

      {/* abandonment confirmation */}
      {confirmAbandon && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setConfirmAbandon(false)} />
          <div className="relative w-full max-w-md bg-[#0f172a] rounded-xl shadow-lg my-8 p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-slate-100">下書きを破棄しますか？</h2>
            <div className="text-xs text-slate-300 flex flex-col gap-1">
              <p>明細 {lines.length}件・調整 {adjustments.length}件 が同時に削除されます。</p>
              <p className="text-amber-400">
                番号 {s.statement_number ?? "—"} は破棄後も再利用されず、作り直すと次の番号が採番されます（欠番になります）。
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
              <button onClick={() => setConfirmAbandon(false)} disabled={pending}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
                キャンセル
              </button>
              <button onClick={handleAbandon} disabled={pending}
                className="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50">
                {pending ? "破棄中..." : "破棄する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
