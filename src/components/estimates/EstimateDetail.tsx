"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EstimateDB,
  EstimateItemDB,
  estimateDisplayNo,
  estimateCustomerName,
} from "@/lib/estimates/estimate-types";
import { createInvoiceFromEstimate } from "@/lib/invoices/create-invoice";
import { sortByCategoryOrder } from "@/lib/estimates/category-order";
import EstimateSummary from "./EstimateSummary";
import EstimateStatusControl from "./EstimateStatusControl";

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
}

export default function EstimateDetail({ estimate, onClose, onCreateWorkOrder, variant = "modal" }: EstimateDetailProps) {
  const customer = estimate.customers;
  const vehicle  = estimate.vehicles;
  const items    = estimate.estimate_items ?? [];

  const customerName = estimateCustomerName(customer);

  // Phase 3 Sprint 5 — Estimate → Invoice (one-click, mirrors the WO transition).
  const router = useRouter();
  const [invError, setInvError] = useState<string | null>(null);
  const [invPending, startInvoice] = useTransition();
  const isApproved = estimate.status === "approved" || estimate.status === "APPROVED";

  function handleCreateInvoice() {
    setInvError(null);
    startInvoice(async () => {
      const result = await createInvoiceFromEstimate(estimate.id);
      if ("error" in result) {
        setInvError(result.error);
        return;
      }
      onClose();
      router.push("/invoices");
    });
  }

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
            {onCreateWorkOrder && (
              <button onClick={onCreateWorkOrder} className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}>
                施工指示作成
              </button>
            )}
            {isApproved && (
              <button onClick={handleCreateInvoice} disabled={invPending} className={`${btn} bg-emerald-700 hover:bg-emerald-600 text-white`}>
                {invPending ? "作成中..." : "請求書作成"}
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

          {invError && (
            <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
              <p className="text-xs text-red-400">{invError}</p>
            </div>
          )}

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

          {/* 送付履歴 — transmission (LINE / email / PDF) is history, NOT a workflow status.
              No transmission-history data source exists yet, so this shows an empty
              placeholder only (never fabricated). */}
          <Card title="送付履歴">
            <p className="text-xs text-slate-600">
              送付履歴はありません（LINE・メール・PDF送付時に記録されます）
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
