"use client";

import { MOCK_VEHICLES } from "./mockVehicles";

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

export default function VehicleTable() {
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
            </tr>
          </thead>
          <tbody>
            {MOCK_VEHICLES.map((v, i) => (
              <tr
                key={v.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                  i === MOCK_VEHICLES.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">{v.manufacturer}</td>
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{v.model}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{v.year}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">{v.grade}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">{v.bodyColor}</td>
                <td className="px-4 py-3 text-slate-400 hidden sm:table-cell whitespace-nowrap">{v.licensePlate}</td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell whitespace-nowrap">{v.vin}</td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell whitespace-nowrap">
                  {formatDate(v.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
