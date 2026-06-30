"use client";

import Link from "next/link";
import {
  EstimateDB,
  estimateDisplayNo,
  estimateCustomerName,
  estimateVehicleLabel,
  estimateStatusLabel,
} from "@/lib/estimates/estimate-types";

const STATUS_BADGE: Record<string, string> = {
  draft:    "bg-slate-600 text-slate-100",
  sent:     "bg-blue-600 text-white",
  approved: "bg-green-600 text-white",
  rejected: "bg-red-600 text-white",
  expired:  "bg-amber-600 text-white",
  // Legacy uppercase
  DRAFT:    "bg-slate-600 text-slate-100",
  SENT:     "bg-blue-600 text-white",
  APPROVED: "bg-green-600 text-white",
  REJECTED: "bg-red-600 text-white",
};

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
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
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">見積がまだありません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">No</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">顧客</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">車両</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">ステータス</th>
              <th className="text-right text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">小計</th>
              <th className="text-right text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">消費税</th>
              <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">合計</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">作成日</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {estimates.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                  i === estimates.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">
                  {estimateDisplayNo(e)}
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                  {estimateCustomerName(e.customers)}
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden md:table-cell">
                  {estimateVehicleLabel(e.vehicles)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[e.status] ?? "bg-slate-700 text-slate-300"}`}>
                    {estimateStatusLabel(e.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-right whitespace-nowrap hidden md:table-cell">
                  {formatYen(e.subtotal)}
                </td>
                <td className="px-4 py-3 text-slate-400 text-right whitespace-nowrap hidden md:table-cell">
                  {formatYen(e.tax_amount ?? e.tax ?? 0)}
                </td>
                <td className="px-4 py-3 text-slate-100 font-medium text-right whitespace-nowrap">
                  {formatYen(e.total)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap hidden sm:table-cell">
                  {formatDate(e.created_at)}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    {/* Phase 3 Sprint 4 — direct PDF/print output (opens the
                        tenant-scoped preview/print page; totals are server-validated). */}
                    <Link
                      href={`/pdf?estimateId=${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-300 hover:text-white hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      PDF
                    </Link>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(e)}
                        className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                      >
                        編集
                      </button>
                    )}
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(e)}
                        className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors"
                      >
                        詳細
                      </button>
                    )}
                    {onCreateWorkOrder &&
                     (e.status === "approved" || e.status === "APPROVED") && (
                      <button
                        onClick={() => onCreateWorkOrder(e)}
                        className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                      >
                        WO作成
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
