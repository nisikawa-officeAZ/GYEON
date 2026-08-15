"use client";

import {
  WorkOrderDB,
  workOrderStatusLabel,
  workOrderDisplayNo,
  workOrderCustomerName,
  workOrderVehicleLabel,
} from "@/lib/work-orders/work-order-types";

const STATUS_BADGE: Record<string, string> = {
  scheduled:   "bg-blue-600/80 text-blue-100",
  in_progress: "bg-amber-600 text-white",
  completed:   "bg-green-600 text-white",
  cancelled:   "bg-slate-600 text-slate-300",
  on_hold:     "bg-orange-600 text-white",
};

function formatDatetime(iso: string | null) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

interface WorkOrderTableProps {
  workOrders:    WorkOrderDB[];
  onViewDetail?: (wo: WorkOrderDB) => void;
  onEdit?:       (wo: WorkOrderDB) => void;
}

export default function WorkOrderTable({
  workOrders,
  onViewDetail,
  onEdit,
}: WorkOrderTableProps) {
  if (workOrders.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">施工指示がまだありません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">作業番号</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">顧客</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">車両</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">見積</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">ステータス</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">施工予定開始</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">担当者</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {workOrders.map((wo, i) => (
              <tr
                key={wo.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                  i === workOrders.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">
                  <div>{workOrderDisplayNo(wo)}</div>
                  {wo.title && (
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                      {wo.title}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                  {workOrderCustomerName(wo.customers)}
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden md:table-cell">
                  {workOrderVehicleLabel(wo.vehicles)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap hidden lg:table-cell">
                  {wo.estimates?.estimate_number ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-300"}`}>
                    {workOrderStatusLabel(wo.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap hidden md:table-cell">
                  {formatDatetime(wo.scheduled_start_at)}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap hidden lg:table-cell">
                  {wo.assigned_staff ?? "—"}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(wo)}
                        className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                      >
                        編集
                      </button>
                    )}
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(wo)}
                        className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors"
                      >
                        詳細
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
