"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EstimateDB,
  EstimateItemDB,
  estimateDisplayNo,
  estimateCustomerName,
} from "@/lib/estimates/estimate-types";
import type { EstimateRelatedInvoice } from "@/lib/invoices/get-invoice";
import { buildSavedDeliveryNotePath } from "./wizard/production/SavedEstimateDocuments";
import SavedEstimateInvoice from "./wizard/production/SavedEstimateInvoice";
import type { SavedInvoiceActions, SavedInvoiceSummary } from "./wizard/production/saved-estimate-invoice-controller";
import { sortByCategoryOrder } from "@/lib/estimates/category-order";
import EstimateSummary from "./EstimateSummary";
import EstimateStatusControl from "./EstimateStatusControl";
import EstimateLineAction from "./EstimateLineAction";
import EstimateLineHistory from "./EstimateLineHistory";
import { sendEstimateLine } from "@/lib/line/send-estimate-line";

// GDA_ESTIMATE_DETAIL_DOCUMENTS_R1 — the delivery-note display href, FAIL-CLOSED.
// Delegates entirely to buildSavedDeliveryNotePath (SavedEstimateDocuments.tsx), the
// same pure authority the saved-estimate document surface uses, so there is exactly
// one eligibility decision in the codebase. No related invoice, draft, cancelled/
// disallowed status, an invalid or missing date, and an ambiguous or failed server
// read all collapse to `null` before reaching this component, so every one of those
// states renders identically: no link, never a guess.
export function resolveDeliveryNoteHref(invoice: EstimateRelatedInvoice | null): string | null {
  return buildSavedDeliveryNotePath(
    invoice as Pick<SavedInvoiceSummary, "id" | "status" | "deliveryDate"> | null,
  );
}

// v17 workspace card. Presentation only — no data/logic here.
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#111a2b] border border-slate-700/60 rounded-xl shadow-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Field row: label (left) / value (right). Empty values render as a subtle 未入力
// placeholder so unfilled fields read as editable-later, per the v17 reference.
function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  const empty = value == null || value === "" || value === "—";
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/40 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className={`text-xs text-right ${empty ? "text-slate-600" : "text-slate-200"}`}>
        {empty ? "未入力" : value}
      </span>
    </div>
  );
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const CATEGORY_LABEL: Record<string, string> = {
  coating:     "コーティング",
  ppf:         "PPF",
  window:      "ウィンドウ",
  interior:    "インテリア",
  glass:       "ガラス",
  other:       "その他",
  maintenance: "メンテナンス",   // Plan A (migration 093)
  carwash:     "洗車",
  roomclean:   "ルームクリーニング",
};

interface EstimateDetailProps {
  estimate:             EstimateDB;
  onClose:              () => void;
  onCreateWorkOrder?:   () => void;
  /** "modal" (default) keeps the existing overlay; "page" renders in normal flow for a full-page route. */
  variant?:             "modal" | "page";
  /** F1-R1: dealer_settings.business_name, server-resolved; null omits the LINE template line. */
  dealerDisplayName?:   string | null;
  /** GDA_ESTIMATE_DETAIL_DOCUMENTS_R1: server-read, tenant-scoped minimal invoice fields
   *  for the delivery-note document surface. null means no eligible related invoice. */
  relatedInvoice?:      EstimateRelatedInvoice | null;
  /** GDA_ESTIMATE_DETAIL_INVOICE_SAME_PAGE_R1: route-injected canonical invoice actions. */
  invoiceActions?:      SavedInvoiceActions;
}

export default function EstimateDetail({ estimate, onClose, onCreateWorkOrder, variant = "modal", dealerDisplayName = null, relatedInvoice = null, invoiceActions }: EstimateDetailProps) {
  const customer = estimate.customers;
  const vehicle  = estimate.vehicles;
  const items    = estimate.estimate_items ?? [];

  const customerName = estimateCustomerName(customer);
  const [invoiceReadback, setInvoiceReadback] = useState<SavedInvoiceSummary | null>(null);
  const deliveryNoteHref = resolveDeliveryNoteHref(invoiceReadback ?? relatedInvoice);

  // F1-R1 — bumped after a LINE attempt that may have logged a row, so the
  // 送付履歴 card refetches without a full-page reload.
  const [historyVersion, setHistoryVersion] = useState(0);

  const router = useRouter();
  const isApproved = estimate.status === "approved" || estimate.status === "APPROVED";
  const handleInvoiceReadback = useCallback((invoice: SavedInvoiceSummary | null) => {
    if (invoice !== null) setInvoiceReadback(invoice);
  }, []);

  // 「編集する」 navigates to the existing full editor route. No inline save, no
  // new Server Action — the editor owns all save/validation logic.
  function handleEdit() {
    router.push(`/estimates/${estimate.id}/edit`);
  }

  const isPage = variant === "page";

  const btn = "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50";

  return (
    <div className={isPage
      ? "flex justify-center px-4 pb-8"
      : "fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"}>
      {/* Backdrop (modal only) */}
      {!isPage && (
        <div
          className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-[#0b1220] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{estimateDisplayNo(estimate)}</h2>
            {estimate.title && (
              <p className="text-xs text-slate-400 mt-0.5">{estimate.title}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-500">見積詳細</span>
              {/* Canonical workflow status (no legacy "送付済み" — status is not a transmission event). */}
              <EstimateStatusControl estimateId={estimate.id} currentStatus={estimate.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={handleEdit} className={`${btn} bg-[#1d4ed8] hover:bg-[#1e40af] text-white`}>
              編集する
            </button>
            <Link
              href={`/pdf?estimateId=${estimate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
            >
              PDF表示
            </Link>
            {/* Immediate download — the SAME production renderer as the preview,
                streamed straight to the operator. No Storage write, so this works
                without the documents bucket. */}
            <a
              href={`/pdf/estimate?estimateId=${encodeURIComponent(estimate.id)}&download=1`}
              className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
            >
              PDFダウンロード
            </a>
            {onCreateWorkOrder && (
              <button onClick={onCreateWorkOrder} className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}>
                施工指示作成
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Customer & Vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="顧客情報">
              <FieldRow label="顧客名"  value={customerName} />
              <FieldRow label="電話番号" value={customer?.phone} />
              <FieldRow label="メール"   value={customer?.email} />
            </Card>

            <Card title="車両情報">
              <FieldRow label="メーカー"     value={vehicle?.maker} />
              <FieldRow label="車種"         value={vehicle?.model} />
              <FieldRow label="年式"         value={vehicle?.year} />
              <FieldRow label="グレード"     value={vehicle?.grade} />
              <FieldRow label="登録年月日"   value={vehicle?.registration_date} />
              <FieldRow label="車検満了日"   value={vehicle?.inspection_expiry_date} />
              <FieldRow label="ナンバー"     value={vehicle?.plate_number} />
              <FieldRow label="ボディサイズ" value={vehicle?.body_size} />
            </Card>
          </div>

          {/* Store/dealer info is intentionally NOT shown here — it belongs only in
              PDF / print / email / LINE output (see src/lib/pdf/dealer-branding.ts). */}

          {/* Invoice — GDA_ESTIMATE_DETAIL_INVOICE_SAME_PAGE_R1. The canonical saved-invoice
              component performs only explicit operator actions and authoritative readback.
              Unapproved estimates receive no mutation-capable action object. */}
          <Card title="請求書">
            {isApproved ? (
              <div className="text-slate-100">
                <SavedEstimateInvoice
                  key={estimate.id}
                  estimateId={estimate.id}
                  actions={invoiceActions}
                  onInvoice={handleInvoiceReadback}
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-describedby="estimate-detail-invoice-reason"
                  data-testid="estimate-detail-invoice"
                  className="rounded-md border border-slate-700 px-4 py-2 text-xs text-slate-500"
                >
                  請求書の下書きを作成・確認
                </button>
                <p
                  id="estimate-detail-invoice-reason"
                  data-testid="estimate-detail-invoice-reason"
                  className="mt-2 text-[11px] text-amber-300"
                >
                  見積の承認が必要です。この画面から自動承認や請求書の作成・発行は行いません。
                </p>
              </>
            )}
          </Card>

          {/* Delivery note — GDA_ESTIMATE_DETAIL_DOCUMENTS_R1. Display only: eligibility
              was already decided server-side (issued+ status, valid persisted delivery
              date, valid invoice identity), or refreshed from a successfully parsed
              readback after an explicit invoice action. Reopening this screen never
              creates, issues, or dates an invoice. */}
          <Card title="納品書">
            {deliveryNoteHref ? (
              <a
                href={deliveryNoteHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby="estimate-detail-delivery-note-reason"
                data-testid="estimate-detail-delivery-note"
                className="inline-block rounded-md border border-sky-600 bg-sky-900/40 px-4 py-2 text-xs text-slate-100"
              >
                納品書（PDF）を表示
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-describedby="estimate-detail-delivery-note-reason"
                data-testid="estimate-detail-delivery-note"
                className="rounded-md border border-slate-700 px-4 py-2 text-xs text-slate-500"
              >
                納品書（PDF）
              </button>
            )}
            <p
              id="estimate-detail-delivery-note-reason"
              data-testid="estimate-detail-delivery-note-reason"
              className="mt-2 text-[11px] text-amber-300"
            >
              {deliveryNoteHref
                ? "発行済みの請求書と保存済みの納品日から表示します。表示のみで、保存・再発行は行いません。"
                : "関連する請求書が発行済みで、納品日が保存されると表示できます。この画面から納品書の保存・再発行は行いません。"}
            </p>
          </Card>

          {/* Service Summary — grouped by the categories actually selected */}
          {items.length > 0 && (
            <Card title="サービス内容">
              <div className="flex flex-col gap-3">
                {Array.from(new Set(sortByCategoryOrder(items).map((i) => i.category))).map((cat) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-blue-300">{CATEGORY_LABEL[cat] ?? cat}</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {items.filter((i) => i.category === cat).map((i) => (
                        <li key={i.id} className="text-xs text-slate-300">
                          ・{i.item_name}
                          {i.description && <span className="text-slate-500">（{i.description}）</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Line Items */}
          {items.length > 0 && (
            <Card title="明細">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <th className="text-left pb-2 pr-3">カテゴリ</th>
                      <th className="text-left pb-2 pr-3">品目</th>
                      <th className="text-right pb-2 pr-3">単価</th>
                      <th className="text-right pb-2 pr-3">数量</th>
                      <th className="text-right pb-2 pr-3">割引</th>
                      <th className="text-right pb-2">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortByCategoryOrder(items)
                      .map((item: EstimateItemDB) => (
                        <tr key={item.id} className="border-b border-slate-700/40 last:border-b-0">
                          <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                            {CATEGORY_LABEL[item.category] ?? item.category}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            <div>{item.item_name}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{item.description}</div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-400 whitespace-nowrap">
                            {formatYen(item.unit_price)}
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-400">
                            {item.quantity}
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-400">
                            {item.discount_rate > 0 ? `${item.discount_rate}%` : "—"}
                          </td>
                          <td className="py-2 text-right text-slate-200 font-medium whitespace-nowrap">
                            {formatYen(item.line_total)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Summary (金額サマリー) */}
          <EstimateSummary estimate={estimate} />

          {/* Notes — customer note + internal memo */}
          {(estimate.notes || estimate.internal_memo) && (
            <Card title="備考・メモ">
              <div className="flex flex-col gap-3">
                {estimate.notes && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">お客様向け備考</p>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{estimate.notes}</p>
                  </div>
                )}
                {estimate.internal_memo && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">社内メモ</p>
                    <p className="text-xs text-slate-400 whitespace-pre-wrap">{estimate.internal_memo}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 送付履歴 — transmission history is REAL data now (F1-R1): the card
              reads the tenant-scoped line_message_logs projection and renders
              truthful sent/failed/unconfirmed/cancelled states. The empty text
              appears only after a SUCCESSFUL read returns zero rows. */}
          <Card title="送付履歴">
            <EstimateLineHistory estimateId={estimate.id} version={historyVersion} />
          </Card>

          {/* LINE delivery (R90B Phase 1 → F1-R1 editable message). The action
              receives the persisted estimate id and the dealer-scoped Server
              Action; it never sees a recipient or a token. The operator-edited
              customer-visible body rides the closed authorization union. */}
          <Card title="LINE送信">
            <EstimateLineAction
              estimateId={estimate.id}
              estimateNumber={estimateDisplayNo(estimate)}
              customerName={customerName}
              dealerDisplayName={dealerDisplayName}
              send={sendEstimateLine}
              onAttemptSettled={() => setHistoryVersion((v) => v + 1)}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
