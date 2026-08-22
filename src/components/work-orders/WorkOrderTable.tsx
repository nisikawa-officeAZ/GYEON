"use client";

import {
  WorkOrderDB,
  workOrderStatusLabel,
  workOrderDisplayNo,
  workOrderCustomerName,
  workOrderVehicleLabel,
} from "@/lib/work-orders/work-order-types";
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

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
      <GdaOperationalListEmptyState
        messageJa="施工指示がまだありません"
        messageEn="NO WORK ORDERS YET"
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet (>=768px): table-first presentation. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#20304a]">
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">作業番号</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden sm:table-cell">顧客</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">車両</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">見積</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ステータス</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">施工予定開始</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">担当者</th>
                <th className="text-center text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3" />
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo, i) => (
                <tr
                  key={wo.id}
                  className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors ${
                    i === workOrders.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-medium text-[#edf3fc] whitespace-nowrap">
                    <div>{workOrderDisplayNo(wo)}</div>
                    {wo.title && (
                      <div className="text-[10px] text-[#7788a4] mt-0.5 truncate max-w-[140px]">
                        {wo.title}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden sm:table-cell">
                    {workOrderCustomerName(wo.customers)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden md:table-cell">
                    {workOrderVehicleLabel(wo.vehicles)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#7788a4] text-xs whitespace-nowrap hidden lg:table-cell">
                    {wo.estimates?.estimate_number ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {workOrderStatusLabel(wo.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] text-xs whitespace-nowrap hidden md:table-cell">
                    {formatDatetime(wo.scheduled_start_at)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] text-xs whitespace-nowrap hidden lg:table-cell">
                    {wo.assigned_staff ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(wo)}
                          className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]"
                        >
                          編集
                        </button>
                      )}
                      {onViewDetail && (
                        <button
                          onClick={() => onViewDetail(wo)}
                          className="text-xs text-[#5f9cff] hover:text-[#bcd4ff] hover:bg-[#173463]/40 border border-[#2f5db8]/50 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap min-h-[36px]"
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

      {/* Mobile (<768px): stacked records replace the wide table. */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {workOrders.map((wo) => (
          <div key={wo.id} className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#edf3fc]">{workOrderDisplayNo(wo)}</p>
                {wo.title && <p className="truncate text-[11px] text-[#8191ad]">{wo.title}</p>}
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-300"}`}>
                {workOrderStatusLabel(wo.status)}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <div>
                <dt className="text-[#7788a4]">顧客</dt>
                <dd className="truncate text-[#c3cee2]">{workOrderCustomerName(wo.customers)}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">車両</dt>
                <dd className="truncate text-[#c3cee2]">{workOrderVehicleLabel(wo.vehicles)}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">見積</dt>
                <dd className="text-[#c3cee2]">{wo.estimates?.estimate_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">担当者</dt>
                <dd className="text-[#c3cee2]">{wo.assigned_staff ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#7788a4]">施工予定開始</dt>
                <dd className="text-[#c3cee2]">{formatDatetime(wo.scheduled_start_at)}</dd>
              </div>
            </dl>

            {(onEdit || onViewDetail) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(wo)}
                    className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                  >
                    編集
                  </button>
                )}
                {onViewDetail && (
                  <button
                    onClick={() => onViewDetail(wo)}
                    className="min-h-[44px] flex-1 rounded-xl border border-[#2f5db8]/50 text-xs font-medium text-[#5f9cff] hover:bg-[#173463]/40 transition-colors"
                  >
                    詳細
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
