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
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

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

const chipBase =
  "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors min-h-[32px]";
const chipOn  = "border-[#3478ff] bg-[#173463] text-[#bcd4ff]";
const chipOff = "border-[#263955] text-[#8191ad] hover:text-[#c3cee2] hover:border-[#3b6eb4]";

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
    <div className="flex flex-col gap-4 p-4">
      {/* Search + status chips */}
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="請求書番号・顧客・車両で検索..."
          className="bg-[#0b1220] border border-[#263955] rounded-xl px-3 py-2 text-sm text-[#edf3fc] placeholder-[#4c5b76] focus:outline-none focus:border-[#3478ff] transition-colors w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onFilterStatus("")}
            aria-pressed={filterStatus === ""}
            className={`${chipBase} ${filterStatus === "" ? chipOn : chipOff}`}
          >
            すべて
          </button>
          {INVOICE_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onFilterStatus(s.value)}
              aria-pressed={filterStatus === s.value}
              className={`${chipBase} ${filterStatus === s.value ? chipOn : chipOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <GdaOperationalListEmptyState
          messageJa={invoices.length === 0 ? "請求書がありません" : "条件に一致する請求書がありません"}
          messageEn={invoices.length === 0 ? "NO INVOICES YET" : "NO MATCHING INVOICES"}
        />
      ) : (
        <>
          {/* Desktop / tablet (>=768px): table-first presentation. */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#20304a]">
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">請求書番号</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">顧客</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden sm:table-cell">車両</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">発行日</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">支払期限</th>
                    <th className="text-right text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">合計</th>
                    <th className="text-right text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden sm:table-cell">残高</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ステータス</th>
                    <th className="px-3 py-2.5 lg:px-4 lg:py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, i) => (
                    <tr
                      key={inv.id}
                      className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors cursor-pointer ${
                        i === filtered.length - 1 ? "border-b-0" : ""
                      }`}
                      onClick={() => onView(inv)}
                    >
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-medium text-[#edf3fc] whitespace-nowrap">
                        {invoiceDisplayNo(inv)}
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap">
                        {invoiceCustomerName(inv.customers)}
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden sm:table-cell">
                        {invoiceVehicleLabel(inv.vehicles)}
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden md:table-cell">
                        {inv.issue_date ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden md:table-cell">
                        {inv.due_date ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-right text-[#edf3fc] font-medium whitespace-nowrap">
                        {formatYen(inv.total)}
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-right whitespace-nowrap hidden sm:table-cell">
                        <span className={inv.balance_due > 0 ? "text-[#5f9cff]" : "text-[#5b6a86]"}>
                          {formatYen(inv.balance_due)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[inv.status] ?? "bg-slate-700 text-slate-300"}`}>
                          {invoiceStatusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                        {/* B1: an issued invoice is a commercial record — edit is
                            offered only while it is still a draft. */}
                        {inv.status === "draft" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(inv); }}
                            className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]"
                          >
                            編集
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile (<768px): stacked records replace the wide table. */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onView(inv)}
                className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-[#edf3fc]">{invoiceDisplayNo(inv)}</p>
                    <p className="truncate text-[11px] text-[#8191ad]">{invoiceCustomerName(inv.customers)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[inv.status] ?? "bg-slate-700 text-slate-300"}`}>
                    {invoiceStatusLabel(inv.status)}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                  <div>
                    <dt className="text-[#7788a4]">車両</dt>
                    <dd className="truncate text-[#c3cee2]">{invoiceVehicleLabel(inv.vehicles)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#7788a4]">発行日</dt>
                    <dd className="text-[#c3cee2]">{inv.issue_date ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#7788a4]">支払期限</dt>
                    <dd className="text-[#c3cee2]">{inv.due_date ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#7788a4]">残高</dt>
                    <dd className={inv.balance_due > 0 ? "text-[#5f9cff]" : "text-[#5b6a86]"}>
                      {formatYen(inv.balance_due)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[#7788a4]">合計</dt>
                    <dd className="text-[15px] font-bold text-[#edf3fc]">{formatYen(inv.total)}</dd>
                  </div>
                </dl>

                {inv.status === "draft" && (
                  <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(inv)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                    >
                      編集
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
