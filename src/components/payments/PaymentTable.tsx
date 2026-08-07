"use client";

// B3-B1B I1 — payments list. Displays the derived payment mode (legacy_direct /
// allocated / unapplied). Deletion is disabled in I1: no delete button, no delete flow.
// "編集" opens the notes-only editor.

import {
  PaymentDB,
  PaymentStatus,
  paymentDisplayNo,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentCustomerName,
  paymentModeLabel,
  derivePaymentMode,
  PAYMENT_STATUSES,
} from "@/lib/payments/payment-types";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "bg-green-600 text-white",
  pending:   "bg-amber-600 text-white",
  cancelled: "bg-slate-600 text-slate-300",
  refunded:  "bg-red-700 text-white",
};

const MODE_BADGE: Record<string, string> = {
  legacy_direct: "bg-slate-700 text-slate-300",
  allocated:     "bg-blue-900/60 text-blue-300",
  unapplied:     "bg-amber-900/50 text-amber-300",
};

interface PaymentTableProps {
  payments:       PaymentDB[];
  onView:         (p: PaymentDB) => void;
  onEdit:         (p: PaymentDB) => void;
  filterStatus:   string;
  onFilterStatus: (s: string) => void;
  searchQuery:    string;
  onSearch:       (q: string) => void;
}

export default function PaymentTable({
  payments,
  onView,
  onEdit,
  filterStatus,
  onFilterStatus,
  searchQuery,
  onSearch,
}: PaymentTableProps) {
  const filtered = payments.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (searchQuery) {
      const q    = searchQuery.toLowerCase();
      const no   = paymentDisplayNo(p).toLowerCase();
      const name = paymentCustomerName(p.customers).toLowerCase();
      const inv  = (p.invoices?.invoice_number ?? "").toLowerCase();
      if (!no.includes(q) && !name.includes(q) && !inv.includes(q)) return false;
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
          placeholder="入金番号・請求書・顧客で検索..."
          className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors flex-1 min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => onFilterStatus(e.target.value)}
          className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-[#1d4ed8] transition-colors"
        >
          <option value="">すべてのステータス</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">入金記録がありません</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#1e293b]">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">入金番号</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">区分</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">請求書</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">顧客名</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">入金日</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">支払方法</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">入金額</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden md:table-cell">手数料</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium hidden md:table-cell">実入金</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">ステータス</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const mode = derivePaymentMode(p);
                return (
                  <tr key={p.id}
                    className="border-b border-slate-800 hover:bg-[#1e293b]/50 transition-colors cursor-pointer"
                    onClick={() => onView(p)}>
                    <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">
                      {paymentDisplayNo(p)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${MODE_BADGE[mode]}`}>
                        {paymentModeLabel(mode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      {p.invoices?.invoice_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap hidden md:table-cell">
                      {paymentCustomerName(p.customers)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {p.payment_date ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      {paymentMethodLabel(p.payment_method)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-medium whitespace-nowrap">
                      {formatYen(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap hidden md:table-cell">
                      {p.fee_amount > 0 ? formatYen(p.fee_amount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 whitespace-nowrap hidden md:table-cell">
                      {formatYen(p.net_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[p.status] ?? "bg-slate-700 text-slate-300"}`}>
                        {paymentStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onEdit(p)}
                          className="text-slate-500 hover:text-slate-100 text-xs hover:bg-slate-700 px-2 py-1 rounded transition-colors">
                          編集
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
