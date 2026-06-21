"use client";

import {
  InvoiceDB,
  InvoiceStatus,
  invoiceDisplayNo,
  invoiceCustomerName,
  invoiceVehicleLabel,
  invoiceStatusLabel,
  INVOICE_STATUSES,
} from "@/lib/invoices/invoice-types";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:          "bg-slate-600 text-slate-100",
  issued:         "bg-blue-600 text-white",
  paid:           "bg-green-600 text-white",
  partially_paid: "bg-amber-600 text-white",
  overdue:        "bg-red-600 text-white",
  cancelled:      "bg-slate-700 text-slate-400",
};

interface InvoiceTableProps {
  invoices:       InvoiceDB[];
  onView:         (inv: InvoiceDB) => void;
  onEdit:         (inv: InvoiceDB) => void;
  filterStatus:   string;
  onFilterStatus: (s: string) => void;
  searchQuery:    string;
  onSearch:       (q: string) => void;
}

export default function InvoiceTable({
  invoices,
  onView,
  onEdit,
  filterStatus,
  onFilterStatus,
  searchQuery,
  onSearch,
}: InvoiceTableProps) {
  const filtered = invoices.filter((inv) => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const no    = invoiceDisplayNo(inv).toLowerCase();
      const name  = invoiceCustomerName(inv.customers).toLowerCase();
      const veh   = invoiceVehicleLabel(inv.vehicles).toLowerCase();
      const title = (inv.title ?? "").toLowerCase();
      if (!no.includes(q) && !name.includes(q) && !veh.includes(q) && !title.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="請求書番号・顧客・車両で検索..."
          className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors flex-1 min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => onFilterStatus(e.target.value)}
          className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors"
        >
          <option value="">すべてのステータス</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">請求書がありません</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#1e293b]">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">請求書番号</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">顧客</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">車両</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">発行日</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">支払期限</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">合計</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">残高</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ステータス</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-slate-800 hover:bg-[#1e293b]/50 transition-colors cursor-pointer"
                  onClick={() => onView(inv)}
                >
                  <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">
                    {invoiceDisplayNo(inv)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {invoiceCustomerName(inv.customers)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                    {invoiceVehicleLabel(inv.vehicles)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden md:table-cell">
                    {inv.issue_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden md:table-cell">
                    {inv.due_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200 font-medium whitespace-nowrap">
                    {formatYen(inv.total)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap hidden sm:table-cell">
                    <span className={inv.balance_due > 0 ? "text-blue-400" : "text-slate-500"}>
                      {formatYen(inv.balance_due)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[inv.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {invoiceStatusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(inv); }}
                      className="text-slate-500 hover:text-slate-100 text-xs hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
