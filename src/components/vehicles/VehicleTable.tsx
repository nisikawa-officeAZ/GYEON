"use client";

import { VehicleDB, customerDisplayName } from "@/lib/vehicles/vehicle-types";
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

interface VehicleTableProps {
  vehicles: VehicleDB[];
  onEdit?:  (vehicle: VehicleDB) => void;
  onView?:  (vehicle: VehicleDB) => void;
  onCreate?: () => void;
}

export default function VehicleTable({ vehicles, onEdit, onView, onCreate }: VehicleTableProps) {
  const showActions = !!(onEdit || onView);
  if (vehicles.length === 0) {
    return (
      <GdaOperationalListEmptyState
        messageJa="車両が登録されていません"
        messageEn="NO VEHICLES YET"
        actionLabel={onCreate ? "+ 新規車両登録" : undefined}
        onAction={onCreate}
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
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">顧客名</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">メーカー</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">車種</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">グレード</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">年式</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden xl:table-cell">ボディ</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ナンバー</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden xl:table-cell">色</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden xl:table-cell">車検満了日</th>
                {showActions && (
                  <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3" />
                )}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => {
                const custName = v.customers
                  ? customerDisplayName(v.customers)
                  : "—";

                return (
                  <tr
                    key={v.id}
                    className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors ${
                      i === vehicles.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#c3cee2] whitespace-nowrap">
                      {custName || "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-medium text-[#edf3fc] whitespace-nowrap">
                      {onView ? (
                        <button
                          type="button"
                          onClick={() => onView(v)}
                          className="text-[#edf3fc] hover:text-[#5f9cff] transition-colors text-left"
                        >
                          {v.maker ?? "—"}
                        </button>
                      ) : (
                        v.maker ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#c3cee2] whitespace-nowrap">
                      {v.model ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] hidden lg:table-cell whitespace-nowrap">
                      {v.grade ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] hidden lg:table-cell whitespace-nowrap">
                      {v.year ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] hidden xl:table-cell whitespace-nowrap">
                      {v.body_size ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap">
                      {v.plate_number ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] hidden xl:table-cell whitespace-nowrap">
                      {v.color ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#7788a4] text-xs hidden xl:table-cell whitespace-nowrap">
                      {formatDate(v.inspection_expiry_date)}
                    </td>
                    {showActions && (
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                        <div className="flex gap-1.5">
                          {onView && (
                            <button
                              type="button"
                              onClick={() => onView(v)}
                              className="text-xs text-[#5f9cff] hover:text-[#bcd4ff] hover:bg-[#173463]/40 border border-[#2f5db8]/50 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap min-h-[36px]"
                            >
                              詳細
                            </button>
                          )}
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(v)}
                              className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]"
                            >
                              編集
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile (<768px): stacked records replace the wide table. */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {vehicles.map((v) => {
          const custName = v.customers ? customerDisplayName(v.customers) : "—";

          return (
            <div key={v.id} className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4">
              <div className="min-w-0">
                {onView ? (
                  <button
                    type="button"
                    onClick={() => onView(v)}
                    className="block truncate text-left text-[15px] font-bold text-[#edf3fc]"
                  >
                    {[v.maker, v.model].filter(Boolean).join(" ") || "—"}
                  </button>
                ) : (
                  <p className="truncate text-[15px] font-bold text-[#edf3fc]">
                    {[v.maker, v.model].filter(Boolean).join(" ") || "—"}
                  </p>
                )}
                <p className="truncate text-[11px] text-[#8191ad]">{custName || "—"}</p>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                <div>
                  <dt className="text-[#7788a4]">グレード</dt>
                  <dd className="text-[#c3cee2]">{v.grade ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">年式</dt>
                  <dd className="text-[#c3cee2]">{v.year ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">ナンバー</dt>
                  <dd className="text-[#c3cee2]">{v.plate_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">色</dt>
                  <dd className="text-[#c3cee2]">{v.color ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">ボディ</dt>
                  <dd className="text-[#c3cee2]">{v.body_size ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">車検満了日</dt>
                  <dd className="text-[#c3cee2]">{formatDate(v.inspection_expiry_date)}</dd>
                </div>
              </dl>

              {showActions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(v)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#2f5db8]/50 text-xs font-medium text-[#5f9cff] hover:bg-[#173463]/40 transition-colors"
                    >
                      詳細
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(v)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                    >
                      編集
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
