"use client";

import { useState } from "react";
import {
  WorkOrderDB,
  workOrderStatusLabel,
  workOrderDisplayNo,
  workOrderCustomerName,
  workOrderVehicleLabel,
} from "@/lib/work-orders/work-order-types";
import WorkOrderFiles from "./WorkOrderFiles";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right break-all">{value}</span>
    </div>
  );
}

function formatDatetime(iso: string | null) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const CATEGORY_LABEL: Record<string, string> = {
  coating:  "コーティング",
  ppf:      "PPF",
  window:   "ウィンドウ",
  interior: "インテリア",
  glass:    "ガラス",
  other:    "その他",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled:   "bg-blue-600/80 text-blue-100",
  in_progress: "bg-amber-600 text-white",
  completed:   "bg-green-600 text-white",
  cancelled:   "bg-slate-600 text-slate-300",
  on_hold:     "bg-orange-600 text-white",
};

interface WorkOrderDetailProps {
  workOrder: WorkOrderDB;
  onClose:   () => void;
}

export default function WorkOrderDetail({ workOrder: wo, onClose }: WorkOrderDetailProps) {
  const [showFiles, setShowFiles] = useState(false);
  const estimate = wo.estimates;
  const items    = estimate?.estimate_items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-[#0f172a] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                {workOrderDisplayNo(wo)}
              </h2>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-300"}`}>
                {workOrderStatusLabel(wo.status)}
              </span>
            </div>
            {wo.title && <p className="text-xs text-slate-400 mt-0.5">{wo.title}</p>}
            <p className="text-xs text-slate-500 mt-0.5">作業指示書</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Customer */}
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">顧客情報</h3>
              <InfoRow label="顧客名"  value={workOrderCustomerName(wo.customers)} />
            </div>

            {/* Vehicle */}
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">車両情報</h3>
              <InfoRow label="車両"    value={workOrderVehicleLabel(wo.vehicles)} />
              {wo.vehicles?.grade && (
                <InfoRow label="グレード" value={wo.vehicles.grade} />
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">スケジュール</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">施工予定</p>
                <InfoRow label="開始" value={formatDatetime(wo.scheduled_start_at)} />
                <InfoRow label="終了" value={formatDatetime(wo.scheduled_end_at)} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">実施工</p>
                <InfoRow label="開始" value={formatDatetime(wo.actual_start_at)} />
                <InfoRow label="終了" value={formatDatetime(wo.actual_end_at)} />
              </div>
            </div>
          </div>

          {/* Assigned Staff */}
          {wo.assigned_staff && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">担当者</h3>
              <InfoRow label="担当者" value={wo.assigned_staff} />
            </div>
          )}

          {/* Service Summary */}
          {wo.service_summary && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">作業概要</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{wo.service_summary}</p>
            </div>
          )}

          {/* Linked Estimate */}
          {estimate && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">紐付け見積</h3>
              <InfoRow label="見積番号" value={estimate.estimate_number ?? "—"} />
              {estimate.title && <InfoRow label="タイトル" value={estimate.title} />}
              <InfoRow label="合計金額" value={formatYen(estimate.total)} />

              {/* Estimate Items */}
              {items.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] text-slate-500 mb-2">明細</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-500">
                        <th className="text-left pb-1.5 pr-3">カテゴリ</th>
                        <th className="text-left pb-1.5 pr-3">品目</th>
                        <th className="text-right pb-1.5 pr-3">単価</th>
                        <th className="text-right pb-1.5 pr-3">数量</th>
                        <th className="text-right pb-1.5">小計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((item) => (
                          <tr key={item.id} className="border-b border-slate-700/40 last:border-b-0">
                            <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">
                              {CATEGORY_LABEL[item.category] ?? item.category}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-300">
                              <div>{item.item_name}</div>
                              {item.description && (
                                <div className="text-[10px] text-slate-500">{item.description}</div>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-slate-400 whitespace-nowrap">
                              {formatYen(item.unit_price)}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-slate-400">
                              {item.quantity}
                            </td>
                            <td className="py-1.5 text-right text-slate-200 font-medium whitespace-nowrap">
                              {formatYen(item.line_total)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {wo.notes && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備考</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{wo.notes}</p>
            </div>
          )}

          {/* Internal Memo */}
          {wo.internal_memo && (
            <div className="bg-[#1e293b] rounded-xl shadow-lg p-5 border border-slate-700">
              <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider mb-2">
                内部メモ（社内のみ）
              </h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{wo.internal_memo}</p>
            </div>
          )}

          {/* Files Section */}
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <button
              onClick={() => setShowFiles((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                施工写真・ファイル
              </h3>
              <span className="text-slate-600 text-xs">{showFiles ? "▲ 閉じる" : "▼ 開く"}</span>
            </button>

            {showFiles && (
              <div className="mt-4">
                <WorkOrderFiles workOrderId={wo.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
