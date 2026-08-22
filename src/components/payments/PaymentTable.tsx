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
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

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

const chipBase =
  "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors min-h-[32px]";
const chipOn  = "border-[#3478ff] bg-[#173463] text-[#bcd4ff]";
const chipOff = "border-[#263955] text-[#8191ad] hover:text-[#c3cee2] hover:border-[#3b6eb4]";

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
    <div className="flex flex-col gap-4 p-4">
      {/* Search + status chips */}
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="入金番号・請求書・顧客で検索..."
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
          {PAYMENT_STATUSES.map((s) => (
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
          messageJa={payments.length === 0 ? "入金記録がありません" : "条件に一致する入金記録がありません"}
          messageEn={payments.length === 0 ? "NO PAYMENTS YET" : "NO MATCHING PAYMENTS"}
        />
      ) : (
        <>
          {/* Desktop / tablet (>=768px): table-first presentation. */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#20304a]">
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">入金番号</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">区分</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden sm:table-cell">請求書</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">顧客名</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">入金日</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden sm:table-cell">支払方法</th>
                    <th className="text-right text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">入金額</th>
                    <th className="text-right text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">手数料</th>
                    <th className="text-right text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">実入金</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ステータス</th>
                    <th className="px-3 py-2.5 lg:px-4 lg:py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const mode = derivePaymentMode(p);
                    return (
                      <tr key={p.id}
                        className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors cursor-pointer ${
                          i === filtered.length - 1 ? "border-b-0" : ""
                        }`}
                        onClick={() => onView(p)}>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-medium text-[#edf3fc] whitespace-nowrap">
                          {paymentDisplayNo(p)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${MODE_BADGE[mode]}`}>
                            {paymentModeLabel(mode)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden sm:table-cell">
                          {p.invoices?.invoice_number ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden md:table-cell">
                          {paymentCustomerName(p.customers)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap">
                          {p.payment_date ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden sm:table-cell">
                          {paymentMethodLabel(p.payment_method)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-right text-[#edf3fc] font-medium whitespace-nowrap">
                          {formatYen(p.amount)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-right text-[#5b6a86] whitespace-nowrap hidden md:table-cell">
                          {p.fee_amount > 0 ? formatYen(p.fee_amount) : "—"}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-right text-[#8191ad] whitespace-nowrap hidden md:table-cell">
                          {formatYen(p.net_amount)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[p.status] ?? "bg-slate-700 text-slate-300"}`}>
                            {paymentStatusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                          <div onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => onEdit(p)}
                              className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]">
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
          </div>

          {/* Mobile (<768px): stacked records replace the wide table. */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((p) => {
              const mode = derivePaymentMode(p);
              return (
                <div
                  key={p.id}
                  onClick={() => onView(p)}
                  className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-[#edf3fc]">{paymentDisplayNo(p)}</p>
                      <p className="truncate text-[11px] text-[#8191ad]">{paymentCustomerName(p.customers)}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[p.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {paymentStatusLabel(p.status)}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                    <div>
                      <dt className="text-[#7788a4]">区分</dt>
                      <dd>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${MODE_BADGE[mode]}`}>
                          {paymentModeLabel(mode)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#7788a4]">請求書</dt>
                      <dd className="truncate text-[#c3cee2]">{p.invoices?.invoice_number ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7788a4]">入金日</dt>
                      <dd className="text-[#c3cee2]">{p.payment_date ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7788a4]">支払方法</dt>
                      <dd className="text-[#c3cee2]">{paymentMethodLabel(p.payment_method)}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7788a4]">手数料</dt>
                      <dd className="text-[#c3cee2]">{p.fee_amount > 0 ? formatYen(p.fee_amount) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7788a4]">実入金</dt>
                      <dd className="text-[#c3cee2]">{formatYen(p.net_amount)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#7788a4]">入金額</dt>
                      <dd className="text-[15px] font-bold text-[#edf3fc]">{formatYen(p.amount)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(p)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                    >
                      編集
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
