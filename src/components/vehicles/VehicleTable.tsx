"use client";

import { VehicleDB } from "@/lib/vehicles/vehicle-types";

function formatDate(iso: string) {
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
        <p className="text-sm text-slate-500">No vehicles yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Manufacturer</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Model</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Year</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">Grade</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">Body Color</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">License Plate</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">VIN</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">Created</th>
              {onEdit && (
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3" />
              )}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr
                key={v.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                  i === vehicles.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">{v.manufacturer ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{v.model ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{v.year ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">{v.grade ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">{v.body_color ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 hidden sm:table-cell whitespace-nowrap">{v.license_plate ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell whitespace-nowrap">{v.vin ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell whitespace-nowrap">
                  {formatDate(v.created_at)}
                </td>
                {onEdit && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onEdit(v)}
                      className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
