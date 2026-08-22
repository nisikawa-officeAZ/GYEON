"use client";

// B3-B1B I1 — payment section inside InvoiceDetail. Creation here is ALWAYS legacy_direct
// against the surrounding invoice (the only place that mode is offered). Editing is
// notes-only. Deletion is disabled in I1 — no delete button, no delete flow. Refreshes
// after successful create, notes update, or conversion. Rows come from the I1-R1 union
// read, so a converted (allocated) payment stays visible here with the amount applied to
// THIS invoice (invoice_context_amount); the full payment amount is shown when they differ.

import { useState, useEffect } from "react";
import {
  PaymentDB,
  PaymentStatus,
  paymentDisplayNo,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/payments/payment-types";
import { getPaymentsByInvoice } from "@/lib/payments/get-payments";
import PaymentForm   from "./PaymentForm";
import PaymentDetail from "./PaymentDetail";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  pending:   "border-amber-400/40 bg-amber-500/15 text-amber-300",
  cancelled: "border-[#5C6B84]/40 bg-[#5C6B84]/15 text-[#c3cee2]",
  refunded:  "border-red-400/40 bg-red-500/15 text-red-300",
};

const nestedShellClass =
  "rounded-2xl border border-[#263955] bg-[#111826]/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl";
const linkButtonClass =
  "rounded-full border border-[#263955] bg-[#0b1220]/70 px-3 py-1.5 text-xs font-semibold text-[#93A4BD] transition-colors hover:border-[#60a5fa]/50 hover:text-[#E8EEF7]";

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit";   payment: PaymentDB }
  | { mode: "detail"; payment: PaymentDB };

interface PaymentSectionProps {
  invoiceId:      string;
  invoiceBalance: number;
  onPaymentSaved?: () => void;  // called after create/notes-update/conversion so parent refreshes
}

export default function PaymentSection({ invoiceId, invoiceBalance, onPaymentSaved }: PaymentSectionProps) {
  const [payments,  setPayments]  = useState<PaymentDB[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<ViewState>({ mode: "list" });

  function refresh() {
    setLoading(true);
    getPaymentsByInvoice(invoiceId).then((data) => {
      setPayments(data);
      setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved() {
    refresh();
    setView({ mode: "list" });
    onPaymentSaved?.();
  }

  // ── Detail view (conversion lives here for legacy-direct rows) ────────────────
  if (view.mode === "detail") {
    return (
      <PaymentDetail
        payment={view.payment}
        onClose={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "edit", payment: view.payment })}
        onConverted={handleSaved}
      />
    );
  }

  // ── Create form: fixed legacy_direct for THIS invoice ─────────────────────────
  if (view.mode === "create") {
    return (
      <div className={nestedShellClass}>
        <button onClick={() => setView({ mode: "list" })}
          className={`${linkButtonClass} self-start`}>
          ← キャンセル
        </button>
        <PaymentForm
          context={{ kind: "invoice", invoiceId, invoiceBalance }}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleSaved}
        />
      </div>
    );
  }

  // ── Edit form: notes / internal_memo only ─────────────────────────────────────
  if (view.mode === "edit") {
    return (
      <div className={nestedShellClass}>
        <button onClick={() => setView({ mode: "list" })}
          className={`${linkButtonClass} self-start`}>
          ← 戻る
        </button>
        <PaymentForm
          context={{ kind: "invoice", invoiceId, invoiceBalance }}
          payment={view.payment}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleSaved}
        />
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div className={nestedShellClass}>
      {loading ? (
        <p className="py-2 text-center text-xs text-[#5C6B84]">読み込み中...</p>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-xs text-[#5C6B84]">
              {payments.length > 0
                ? `${payments.length}件の入金記録`
                : "入金記録がありません"}
            </p>
            {invoiceBalance > 0 && (
              <button
                onClick={() => setView({ mode: "create" })}
                className="rounded-xl bg-[#2F6BFF] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_22px_rgba(47,107,255,0.28)] transition-colors hover:bg-[#3b82f6]"
              >
                + 入金登録
              </button>
            )}
          </div>

          {payments.length > 0 && (
            <div className="flex flex-col gap-2">
              {payments.map((p) => (
                <div key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#263955] bg-[#0b1220]/70 px-4 py-3 transition-colors hover:border-[#60a5fa]/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#E8EEF7]">
                        {formatYen(p.invoice_context_amount ?? p.amount)}
                      </p>
                      {(p.invoice_context_amount ?? p.amount) !== p.amount && (
                        <span className="shrink-0 text-[10px] text-[#5C6B84]">
                          （この請求書への割当 / 入金総額 {formatYen(p.amount)}）
                        </span>
                      )}
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_BADGE[p.status] ?? "border-[#263955] bg-[#0b1220]/70 text-[#93A4BD]"}`}>
                        {paymentStatusLabel(p.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#5C6B84]">
                      {paymentDisplayNo(p)}
                      {p.payment_date && ` · ${p.payment_date}`}
                      {" · "}
                      {paymentMethodLabel(p.payment_method)}
                      {p.fee_amount > 0 && (
                        <span className="ml-1 text-[#5C6B84]">
                          (手数料 {formatYen(p.fee_amount)} / 実 {formatYen(p.net_amount)})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setView({ mode: "edit", payment: p })}
                      className="rounded-lg px-2 py-1 text-xs text-[#93A4BD] transition-colors hover:bg-[#263955]/40 hover:text-[#E8EEF7]"
                    >
                      メモ編集
                    </button>
                    <button
                      onClick={() => setView({ mode: "detail", payment: p })}
                      className="px-2 py-1 text-xs font-semibold text-[#60a5fa] transition-colors hover:text-[#93c5fd]"
                    >
                      詳細
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {payments.length === 0 && invoiceBalance <= 0 && (
            <p className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 py-3 text-center text-xs font-semibold text-emerald-300">入金完了</p>
          )}
        </>
      )}
    </div>
  );
}
