"use client";

import { VehicleDB, customerDisplayName } from "@/lib/vehicles/vehicle-types";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

interface VehicleTableProps {
  vehicles: VehicleDB[];
  onEdit?:  (vehicle: VehicleDB) => void;
}

export default function VehicleTable({ vehicles, onEdit }: VehicleTableProps) {
  if (vehicles.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">車両が登録されていません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">顧客名</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">メーカー</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">車種</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">グレード</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">年式</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">ボディ</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">ナンバー</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">色</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden xl:table-cell">車検満了日</th>
              {onEdit && (
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3" />
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
                  className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                    i === vehicles.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {custName || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">
                    {v.maker ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {v.model ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">
                    {v.grade ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">
                    {v.year ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell whitespace-nowrap">
                    {v.body_size ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell whitespace-nowrap">
                    {v.plate_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell whitespace-nowrap">
                    {v.color ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell whitespace-nowrap">
                    {formatDate(v.inspection_expiry_date)}
                  </td>
                  {onEdit && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onEdit(v)}
                        className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2.5 py-2 rounded transition-colors min-h-[36px]"
                      >
                        編集
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
