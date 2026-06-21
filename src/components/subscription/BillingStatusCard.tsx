"use client";

// PHASE64: Dealer-facing billing status card.
// Read-only. Dealers can view their own plan/status/dates.
// No payment forms. No subscription management actions.

import type { DealerBilling, BillingInvoice } from "@/lib/billing/billing-types";
import {
  contractStatusLabel,
  contractStatusColor,
  invoiceStatusLabel,
  invoiceStatusColor,
  planCodeLabel,
  formatJPY,
} from "@/lib/billing/billing-types";

interface Props {
  billing:  DealerBilling | null;
  invoices: BillingInvoice[];
}

export default function BillingStatusCard({ billing, invoices }: Props) {
  if (!billing) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 text-center">
        <p className="text-sm text-slate-500">請求情報が登録されていません</p>
        <p className="text-xs text-slate-600 mt-1">お問い合わせは担当者までご連絡ください</p>
      </div>
    );
  }

  const recentInvoices = invoices.slice(0, 5);
  const pendingAmount  = invoices
    .filter(i => i.status === "issued" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 flex flex-col gap-5">
      {/* Plan & status */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-500 mb-0.5">契約プラン</p>
          <p className="text-lg font-bold text-slate-100">{planCodeLabel(billing.plan_code)}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${contractStatusColor(billing.contract_status)}`}>
          {contractStatusLabel(billing.contract_status)}
        </span>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[10px] text-slate-500 mb-1">開始日</p>
          <p className="text-sm font-medium text-slate-200">{billing.started_at?.slice(0, 10) ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[10px] text-slate-500 mb-1">有効期限</p>
          <p className="text-sm font-medium text-slate-200">{billing.expires_at?.slice(0, 10) ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[10px] text-slate-500 mb-1">更新日</p>
          <p className="text-sm font-medium text-slate-200">{billing.renewal_date?.slice(0, 10) ?? "—"}</p>
        </div>
      </div>

      {/* Pending amount */}
      {pendingAmount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
          <span className="text-amber-400 shrink-0">⚠</span>
          <div>
            <p className="text-xs font-medium text-amber-300">未払い請求があります</p>
            <p className="text-[10px] text-amber-400/80 mt-0.5">合計 {formatJPY(pendingAmount)} — 担当者までお問い合わせください</p>
          </div>
        </div>
      )}

      {/* Invoices */}
      {recentInvoices.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">請求履歴</p>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            {recentInvoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-xs ${
                  idx < recentInvoices.length - 1 ? "border-b border-slate-800/50" : ""
                }`}
              >
                <span className="text-slate-500 font-mono text-[10px] flex-1 truncate">{inv.invoice_number}</span>
                <span className="text-slate-300 font-medium shrink-0">{formatJPY(inv.amount)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${invoiceStatusColor(inv.status)}`}>
                  {invoiceStatusLabel(inv.status)}
                </span>
                <span className="text-slate-600 text-[10px] shrink-0">{inv.issued_at?.slice(0, 10) ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600">
        請求・支払いに関するお問い合わせは担当者までご連絡ください。
      </p>
    </div>
  );
}
