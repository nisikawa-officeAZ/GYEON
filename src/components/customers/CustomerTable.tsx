"use client";

import { CustomerDB, customerDisplayName, customerKanaName } from "@/lib/customers/customer-types";
import LineStatusBadge from "@/components/line/LineStatusBadge";

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

interface CustomerTableProps {
  customers: CustomerDB[];
  onEdit?:   (customer: CustomerDB) => void;
}

export default function CustomerTable({ customers, onEdit }: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">顧客データがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">氏名</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">フリガナ</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">電話番号</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">メール</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">住所</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3">LINE</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden sm:table-cell">登録日</th>
              {onEdit && (
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3" />
              )}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const displayName = customerDisplayName(c);
              const kanaName    = customerKanaName(c);
              const address     = [c.prefecture, c.city, c.address1, c.address2]
                .filter(Boolean).join(" ");

              return (
                <tr
                  key={c.id}
                  className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                    i === customers.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">
                    {displayName || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {kanaName || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell max-w-[200px] truncate">
                    {address || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <LineStatusBadge
                      connected={!!c.line_connected}
                      displayName={c.line_display_name}
                      customerId={c.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell whitespace-nowrap">
                    {formatDate(c.created_at)}
                  </td>
                  {onEdit && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onEdit(c)}
                        className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
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
