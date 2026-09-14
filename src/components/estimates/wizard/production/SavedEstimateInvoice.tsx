"use client";

import { useEffect, useMemo, useState } from "react";
import { createSavedInvoiceController, hasIssuedInvoice, type SavedInvoiceActions, type SavedInvoiceState, type SavedInvoiceSummary } from "./saved-estimate-invoice-controller";
import { isValidCalendarDate } from "../../../../lib/invoices/invoice-delivery-date";

const labels = { draft: "下書き（未発行）", issued: "発行済み", paid: "入金済み", partially_paid: "一部入金", overdue: "期限超過", cancelled: "キャンセル済み" };
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** Remounted after every readback: a changed snapshot always resets consent. */
export function SavedInvoiceIssueControls({ invoice, actions, controller }: {
  invoice: SavedInvoiceSummary; actions?: SavedInvoiceActions;
  controller: Pick<ReturnType<typeof createSavedInvoiceController>, "saveDeliveryDate" | "issue" | "download">;
}) {
  const [date, setDate] = useState(invoice.deliveryDate ?? "");
  const [confirmed, setConfirmed] = useState(false);
  if (hasIssuedInvoice(invoice.status)) return (
    <button type="button" disabled={!actions?.download} onClick={() => { void controller.download(); }}
      className="mt-3 rounded-md border border-sky-600 px-4 py-2 text-sm disabled:opacity-50">発行済みPDFを表示</button>
  );
  if (invoice.status !== "draft") return null;
  const savedDate = isValidCalendarDate(date) && date === invoice.deliveryDate;
  return <div className="mt-3 space-y-3">
    <label className="block text-sm">納品日（必須）
      <input type="date" value={date} onChange={event => { setDate(event.target.value); setConfirmed(false); }}
        disabled={!actions?.saveDate} className="ml-2 rounded border border-slate-600 bg-slate-900 p-2" />
    </label>
    <button type="button" disabled={!actions?.saveDate || !isValidCalendarDate(date) || savedDate}
      onClick={() => { void controller.saveDeliveryDate(date); }}
      className="rounded-md border border-slate-600 px-4 py-2 text-sm disabled:opacity-50">納品日を保存</button>
    <label className="block text-sm"><input type="checkbox" checked={confirmed} disabled={!savedDate || !actions?.issue}
      onChange={event => setConfirmed(event.target.checked)} className="mr-2" />
      上記の納品日・明細・合計金額を確認しました。確定発行後は内容を変更できません。</label>
    <button type="button" disabled={!actions?.issue || !savedDate || !confirmed}
      onClick={() => { void controller.issue(confirmed); }}
      className="rounded-md bg-sky-700 px-4 py-2 text-sm disabled:opacity-50">請求書を確定発行してPDFを表示</button>
    <p className="text-xs text-slate-400">納品日の保存だけでは発行しません。確定発行でも入金処理は行いません。</p>
  </div>;
}

export default function SavedEstimateInvoice({ estimateId, actions, onInvoice }: {
  estimateId: string; actions?: SavedInvoiceActions;
  /** Reports the latest parsed readback (null outside "ready"). Notification only — never a trigger. */
  onInvoice?: (invoice: SavedInvoiceSummary | null) => void;
}) {
  // Parent keys this component by the saved estimate. Mount/reload never creates a record.
  const [state, setState] = useState<SavedInvoiceState>({ kind: "idle" });
  const controller = useMemo(() => actions ? createSavedInvoiceController(estimateId, actions, setState) : null, [estimateId, actions]);
  useEffect(() => () => controller?.cancel(), [controller]);
  useEffect(() => { onInvoice?.(state.kind === "ready" ? state.invoice : null); }, [state, onInvoice]);
  const pending = state.kind === "pending";
  return (
    <div aria-busy={pending}>
      <button type="button" disabled={!controller || pending} aria-disabled={!controller || pending}
        aria-describedby="saved-document-invoice-reason" data-testid="saved-document-invoice"
        onClick={() => { void controller?.run(); }}
        className="rounded-md border border-sky-600 px-4 py-2 text-sm disabled:border-slate-700 disabled:text-slate-500">
        {pending ? "請求書を確認中…" : state.kind === "idle" ? "請求書の下書きを作成・確認" : "請求書を再確認"}
      </button>
      <p id="saved-document-invoice-reason" data-testid="saved-document-invoice-reason" className="mt-1 text-xs text-slate-400">
        {controller ? "承認済みの見積から作成します。既に関連する請求書がある場合は、その内容を確認します。この操作では確定発行・入金処理を行いません。"
          : "請求書の同一画面発行はまだ接続されていません。この画面からは作成・承認・発行は行われません。"}
      </p>
      {state.kind === "error" && <p role="alert" className="mt-2 text-sm text-amber-300">{state.message}</p>}
      {state.kind === "ready" && (
        <section className="mt-3 rounded-md border border-slate-700 p-3" data-testid="saved-invoice-summary" aria-label="請求書の保存内容">
          <p role="status">請求書を確認しました：{labels[state.invoice.status]}</p>
          <dl className="mt-2 text-sm">
            <dt>請求番号</dt><dd>{state.invoice.number ?? "未設定"}</dd>
            <dt>発行日</dt><dd>{state.invoice.issueDate ?? "未設定"}</dd>
            <dt>支払期限</dt><dd>{state.invoice.dueDate ?? "未設定"}</dd>
            <dt>納品日</dt><dd>{state.invoice.deliveryDate ?? "未設定"}</dd>
            <dt>合計</dt><dd>{yen(state.invoice.total)}</dd>
          </dl>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-96 text-sm"><caption className="sr-only">保存済み請求明細</caption>
              <thead><tr><th className="text-left">品目</th><th>数量</th><th>単価</th><th>小計</th></tr></thead>
              <tbody>{state.invoice.items.map(item => <tr key={item.id}><td>{item.name}</td><td className="text-right">{item.quantity}</td><td className="text-right whitespace-nowrap">{yen(item.unitPrice)}</td><td className="text-right whitespace-nowrap">{yen(item.total)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-amber-300">
            {state.invoice.status === "draft" ? "下書きの保存内容です。納品日を保存し、内容を確認してから確定発行してください。"
              : "保存済みの状態を表示しています。再発行・内容変更は行っていません。"}
          </p>
          {state.message && <p role="status" className="mt-2 text-sm text-amber-300">{state.message}</p>}
          {controller && <SavedInvoiceIssueControls key={`${state.invoice.id}:${state.invoice.contentVersion}`}
            invoice={state.invoice} actions={actions} controller={controller} />}
          {state.pdfUrl && <a href={state.pdfUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
            className="mt-3 inline-block text-sky-300 underline">請求書PDFを開く・印刷／保存</a>}
        </section>
      )}
    </div>
  );
}
