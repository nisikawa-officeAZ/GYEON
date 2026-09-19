"use client";

import Link from "next/link";
import {
  EstimateDB,
  estimateDisplayNo,
  estimateCustomerName,
  estimateVehicleLabel,
  estimateStatusLabel,
} from "@/lib/estimates/estimate-types";
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

// Business-state badge colors (「送付済み」は業務状態ではないので sent=提案中 色)
const STATUS_BADGE: Record<string, string> = {
  draft:       "bg-slate-600 text-slate-100",
  sent:        "bg-blue-600 text-white",   // 提案中
  proposed:    "bg-blue-600 text-white",   // 提案中
  approved:    "bg-green-600 text-white",  // 承認
  rejected:    "bg-red-600 text-white",    // 失注
  lost:        "bg-red-600 text-white",    // 失注
  won:         "bg-emerald-600 text-white", // 受注
  ordered:     "bg-emerald-600 text-white", // 受注
  in_progress: "bg-indigo-600 text-white",  // 作業中
  working:     "bg-indigo-600 text-white",  // 作業中
  completed:   "bg-teal-600 text-white",    // 完了
  done:        "bg-teal-600 text-white",    // 完了
  billed:      "bg-purple-600 text-white",  // 請求済
  invoiced:    "bg-purple-600 text-white",  // 請求済
  expired:     "bg-amber-600 text-white",
  // Legacy uppercase
  DRAFT:    "bg-slate-600 text-slate-100",
  SENT:     "bg-blue-600 text-white",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-red-600 text-white",
};

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

interface EstimateTableProps {
  estimates:            EstimateDB[];
  onViewDetail?:        (estimate: EstimateDB) => void;
  onEdit?:              (estimate: EstimateDB) => void;
  onCreateWorkOrder?:   (estimate: EstimateDB) => void;
}

export default function EstimateTable({ estimates, onViewDetail, onEdit, onCreateWorkOrder }: EstimateTableProps) {
  if (estimates.length === 0) {
    return (
      <GdaOperationalListEmptyState
        messageJa="見積がまだありません"
        messageEn="NO ESTIMATES YET"
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet (>=768px): table-first presentation. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] table-fixed text-sm">
            <thead>
              <tr className="border-b border-[#20304a]">
                <th className="w-28 text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">No</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">顧客</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">車両</th>
                <th className="min-w-[6.5rem] whitespace-nowrap text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ステータス</th>
                <th className="w-24 text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">作成日</th>
                <th className="w-64 text-center text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e, i) => (
                <tr
                  key={e.id}
                  data-row-action="view-detail-on-double-click"
                  title={onViewDetail ? "ダブルクリックで見積詳細を表示" : undefined}
                  onDoubleClick={(event) => {
                    if (!onViewDetail) return;
                    const target = event.target as HTMLElement;
                    if (target.closest("button, a")) return;
                    onViewDetail(e);
                  }}
                  className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors ${onViewDetail ? "cursor-pointer" : ""} ${
                    i === estimates.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-medium text-[#edf3fc] whitespace-nowrap">
                    {estimateDisplayNo(e)}
                  </td>
                  <td className="max-w-0 px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad]">
                    <span className="block truncate" title={estimateCustomerName(e.customers)}>
                      {estimateCustomerName(e.customers)}
                    </span>
                  </td>
                  <td className="max-w-0 px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad]">
                    <span className="block truncate" title={estimateVehicleLabel(e.vehicles)}>
                      {estimateVehicleLabel(e.vehicles)}
                    </span>
                  </td>
                  <td className="min-w-[6.5rem] whitespace-nowrap px-3 py-2.5 lg:px-4 lg:py-3">
                    <span className={`inline-flex whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[e.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {estimateStatusLabel(e.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#7788a4] text-xs whitespace-nowrap">
                    {formatDate(e.created_at)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 whitespace-nowrap">
                    <div
                      data-testid="estimate-action-grid"
                      className="grid grid-cols-[4.5rem_2.75rem_2.75rem_4rem] items-center justify-center gap-2"
                    >
                      {onViewDetail ? (
                        <button
                          data-action="estimate"
                          aria-label="見積を表示"
                          onClick={() => onViewDetail(e)}
                          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#2f5db8]/50 text-xs font-medium text-[#5f9cff] hover:text-[#bcd4ff] hover:bg-[#173463]/40 transition-colors"
                        >
                          見積もり
                        </button>
                      ) : <span aria-hidden="true" className="h-9" />}
                      {/* Phase 3 Sprint 4 — direct PDF/print output (opens the
                          tenant-scoped preview/print page; totals are server-validated). */}
                      <Link
                        data-action="pdf"
                        href={`/pdf?estimateId=${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-full items-center justify-center rounded-lg text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                      >
                        PDF
                      </Link>
                      {onEdit ? (
                        <button
                          data-action="edit"
                          onClick={() => onEdit(e)}
                          className="inline-flex h-9 w-full items-center justify-center rounded-lg text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                        >
                          編集
                        </button>
                      ) : <span aria-hidden="true" className="h-9" />}
                      {onCreateWorkOrder &&
                       (e.status === "approved" || e.status === "APPROVED") && (
                        <button
                          data-action="work-order"
                          aria-label="施工指示を作成"
                          onClick={() => onCreateWorkOrder(e)}
                          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-emerald-800/40 text-xs font-medium text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/30 transition-colors"
                        >
                          施工指示
                        </button>
                      )}
                      {(!onCreateWorkOrder || (e.status !== "approved" && e.status !== "APPROVED")) && (
                        <span data-action-placeholder="work-order" aria-hidden="true" className="h-9" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile (<768px): stacked records replace the wide table. */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {estimates.map((e) => (
          <div key={e.id} className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#edf3fc]">{estimateDisplayNo(e)}</p>
                <p className="truncate text-[11px] text-[#8191ad]">{estimateCustomerName(e.customers)}</p>
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[e.status] ?? "bg-slate-700 text-slate-300"}`}>
                {estimateStatusLabel(e.status)}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <div>
                <dt className="text-[#7788a4]">車両</dt>
                <dd className="truncate text-[#c3cee2]">{estimateVehicleLabel(e.vehicles)}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">作成日</dt>
                <dd className="text-[#c3cee2]">{formatDate(e.created_at)}</dd>
              </div>
            </dl>

            <div
              data-testid="estimate-action-grid-mobile"
              className="mt-3 grid grid-cols-4 gap-2"
            >
              {onViewDetail ? (
                <button
                  data-action="estimate"
                  aria-label="見積を表示"
                  onClick={() => onViewDetail(e)}
                  className="min-h-[44px] rounded-xl border border-[#2f5db8]/50 text-xs font-medium text-[#5f9cff] hover:bg-[#173463]/40 transition-colors"
                >
                  見積もり
                </button>
              ) : <span aria-hidden="true" className="min-h-[44px]" />}
              <Link
                data-action="pdf"
                href={`/pdf?estimateId=${e.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] flex items-center justify-center rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
              >
                PDF
              </Link>
              {onEdit ? (
                <button
                  data-action="edit"
                  onClick={() => onEdit(e)}
                  className="min-h-[44px] rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                >
                  編集
                </button>
              ) : <span aria-hidden="true" className="min-h-[44px]" />}
              {onCreateWorkOrder &&
               (e.status === "approved" || e.status === "APPROVED") && (
                <button
                  data-action="work-order"
                  aria-label="施工指示を作成"
                  onClick={() => onCreateWorkOrder(e)}
                  className="min-h-[44px] rounded-xl border border-emerald-800/40 text-xs font-medium text-emerald-400 hover:bg-emerald-950/30 transition-colors"
                >
                  施工指示
                </button>
              )}
              {(!onCreateWorkOrder || (e.status !== "approved" && e.status !== "APPROVED")) && (
                <span data-action-placeholder="work-order" aria-hidden="true" className="min-h-[44px]" />
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
