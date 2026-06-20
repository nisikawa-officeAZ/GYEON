"use client";

import { Estimate } from "@/types/estimate";
import { MOCK_ESTIMATES, CUSTOMER_NAMES, VEHICLE_NAMES } from "./mockEstimates";

const STATUS_BADGE: Record<Estimate["status"], string> = {
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

export default function EstimateTable() {
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Estimate No</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">Customer</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">Vehicle</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">Subtotal</th>
              <th className="text-right text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">Tax</th>
              <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Total</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">Created</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ESTIMATES.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                  i === MOCK_ESTIMATES.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">{e.estimateNo}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                  {CUSTOMER_NAMES[e.customerId] ?? e.customerId}
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden md:table-cell">
                  {VEHICLE_NAMES[e.vehicleId] ?? e.vehicleId}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[e.status]}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-right whitespace-nowrap hidden md:table-cell">
                  {formatYen(e.subtotal)}
                </td>
                <td className="px-4 py-3 text-slate-400 text-right whitespace-nowrap hidden md:table-cell">
                  {formatYen(e.tax)}
                </td>
                <td className="px-4 py-3 text-slate-100 font-medium text-right whitespace-nowrap">
                  {formatYen(e.total)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap hidden sm:table-cell">
                  {formatDate(e.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
