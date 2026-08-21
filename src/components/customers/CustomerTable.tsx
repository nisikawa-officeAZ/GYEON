"use client";

import { CustomerDB, customerDisplayName, customerKanaName } from "@/lib/customers/customer-types";
import LineStatusBadge from "@/components/line/LineStatusBadge";
import type { BillingMethodInfo } from "@/lib/customer-billing/billing-method";
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

interface CustomerTableProps {
  customers:        CustomerDB[];
  billing:          BillingMethodInfo;
  onEdit?:          (customer: CustomerDB) => void;
  onStartEstimate?: (customer: CustomerDB) => void;
  onView?:          (customer: CustomerDB) => void;
  onCreate?:        () => void;
}

export default function CustomerTable({ customers, billing, onEdit, onStartEstimate, onView, onCreate }: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <GdaOperationalListEmptyState
        messageJa="顧客データがありません"
        messageEn="NO CUSTOMERS YET"
        actionLabel={onCreate ? "+ 新規顧客登録" : undefined}
        onAction={onCreate}
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet (>=768px): table-first presentation. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#20304a]">
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">氏名</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">フリガナ</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">電話番号</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">メール</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden xl:table-cell">住所</th>
                <th className="text-center text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">LINE</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">登録日</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">業者</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">請求方法</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3" />
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
                    className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors ${
                      i === customers.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-medium text-[#edf3fc] whitespace-nowrap">
                      {onView ? (
                        <button
                          type="button"
                          onClick={() => onView(c)}
                          className="text-[#edf3fc] hover:text-[#5f9cff] transition-colors text-left"
                        >
                          {displayName || "—"}
                        </button>
                      ) : (
                        displayName || "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap">
                      {kanaName || "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap">{c.phone ?? "—"}</td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] hidden lg:table-cell">{c.email ?? "—"}</td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] hidden xl:table-cell max-w-[200px] truncate">
                      {address || "—"}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-center">
                      <LineStatusBadge
                        connected={!!c.line_connected}
                        displayName={c.line_display_name}
                        customerId={c.id}
                      />
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#7788a4] text-xs whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 whitespace-nowrap">
                      {c.is_business ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          業販{c.trade_discount_pct}%
                        </span>
                      ) : (
                        <span className="text-[#5b6a86] text-xs">個人</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] text-xs hidden lg:table-cell whitespace-nowrap">
                      {billing.labelJa}
                      {billing.mode === "closing" && billing.closingDay != null && (
                        <span className="text-[#5b6a86] ml-1">（{billing.closingDay}日締/翌{billing.paymentDay}日払）</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                      <div className="flex gap-1.5">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(c)}
                            className="text-xs text-[#5f9cff] hover:text-[#bcd4ff] hover:bg-[#173463]/40 border border-[#2f5db8]/50 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap min-h-[36px]"
                          >
                            詳細
                          </button>
                        )}
                        {onStartEstimate && (
                          <button
                            type="button"
                            onClick={() => onStartEstimate(c)}
                            className="text-xs text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/30 border border-emerald-800/40 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap min-h-[36px]"
                          >
                            見積作成
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(c)}
                            className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]"
                          >
                            編集
                          </button>
                        )}
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
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {customers.map((c) => {
          const displayName = customerDisplayName(c);
          const kanaName    = customerKanaName(c);
          const address     = [c.prefecture, c.city, c.address1, c.address2]
            .filter(Boolean).join(" ");

          return (
            <div key={c.id} className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {onView ? (
                    <button
                      type="button"
                      onClick={() => onView(c)}
                      className="block truncate text-left text-[15px] font-bold text-[#edf3fc]"
                    >
                      {displayName || "—"}
                    </button>
                  ) : (
                    <p className="truncate text-[15px] font-bold text-[#edf3fc]">{displayName || "—"}</p>
                  )}
                  <p className="truncate text-[11px] text-[#8191ad]">{kanaName || "—"}</p>
                </div>
                <LineStatusBadge
                  connected={!!c.line_connected}
                  displayName={c.line_display_name}
                  customerId={c.id}
                />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                <div>
                  <dt className="text-[#7788a4]">電話番号</dt>
                  <dd className="text-[#c3cee2]">{c.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">登録日</dt>
                  <dd className="text-[#c3cee2]">{formatDate(c.created_at)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#7788a4]">メール</dt>
                  <dd className="truncate text-[#c3cee2]">{c.email ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#7788a4]">住所</dt>
                  <dd className="truncate text-[#c3cee2]">{address || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">区分</dt>
                  <dd>
                    {c.is_business ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        業販{c.trade_discount_pct}%
                      </span>
                    ) : (
                      <span className="text-[#5b6a86] text-xs">個人</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#7788a4]">請求方法</dt>
                  <dd className="text-[#c3cee2]">{billing.labelJa}</dd>
                </div>
              </dl>

              {(onView || onStartEstimate || onEdit) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(c)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#2f5db8]/50 text-xs font-medium text-[#5f9cff] hover:bg-[#173463]/40 transition-colors"
                    >
                      詳細
                    </button>
                  )}
                  {onStartEstimate && (
                    <button
                      type="button"
                      onClick={() => onStartEstimate(c)}
                      className="min-h-[44px] flex-1 rounded-xl border border-emerald-800/40 text-xs font-medium text-emerald-400 hover:bg-emerald-950/30 transition-colors"
                    >
                      見積作成
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                    >
                      編集
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
