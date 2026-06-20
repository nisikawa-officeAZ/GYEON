"use client";

import { MOCK_CUSTOMERS } from "./mockCustomers";

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

export default function CustomerTable() {
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Kana</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Phone</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">Email</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">Address</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3">LINE</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">Created</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CUSTOMERS.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                  i === MOCK_CUSTOMERS.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">{c.name}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{c.kana}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{c.phone}</td>
                <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{c.email}</td>
                <td className="px-4 py-3 text-slate-400 hidden lg:table-cell max-w-[200px] truncate">{c.address}</td>
                <td className="px-4 py-3 text-center">
                  {c.lineId ? (
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                      ✓
                    </span>
                  ) : (
                    <span className="text-slate-700">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell whitespace-nowrap">
                  {formatDate(c.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
