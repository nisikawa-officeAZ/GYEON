"use client";

// Lazy-loaded payment section inside InvoiceDetail.

import { useState, useEffect, useTransition } from "react";
import {
  PaymentDB,
  PaymentStatus,
  paymentDisplayNo,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/payments/payment-types";
import { getPaymentsByInvoice } from "@/lib/payments/get-payments";
import { deletePayment } from "@/lib/payments/delete-payment";
import PaymentForm   from "./PaymentForm";
import PaymentDetail from "./PaymentDetail";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "bg-green-600 text-white",
  pending:   "bg-amber-600 text-white",
  cancelled: "bg-slate-600 text-slate-300",
  refunded:  "bg-red-700 text-white",
};

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit";   payment: PaymentDB }
  | { mode: "detail"; payment: PaymentDB };

interface PaymentSectionProps {
  invoiceId:      string;
  invoiceBalance: number;
  onPaymentSaved?: () => void;  // called after create/update/delete so parent can refresh invoice
}

export default function PaymentSection({ invoiceId, invoiceBalance, onPaymentSaved }: PaymentSectionProps) {
  const [payments,  setPayments]  = useState<PaymentDB[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<ViewState>({ mode: "list" });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  async function handleDelete(p: PaymentDB) {
    if (!confirm(`${paymentDisplayNo(p)} を削除しますか？`)) return;
    setDeletingId(p.id);
    startTransition(async () => {
      const result = await deletePayment(p.id);
      setDeletingId(null);
      if ("error" in result) {
        alert(result.error);
      } else {
        refresh();
        onPaymentSaved?.();
      }
    });
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (view.mode === "detail") {
    return (
      <PaymentDetail
        payment={view.payment}
        onClose={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "edit", payment: view.payment })}
      />
    );
  }

  // ── Create form ──────────────────────────────────────────────────────────────
  if (view.mode === "create") {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setView({ mode: "list" })}
          className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors self-start">
          ← キャンセル
        </button>
        <PaymentForm
          invoiceId={invoiceId}
          invoiceBalance={invoiceBalance}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleSaved}
        />
      </div>
    );
  }

  // ── Edit form ────────────────────────────────────────────────────────────────
  if (view.mode === "edit") {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setView({ mode: "list" })}
          className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors self-start">
          ← 戻る
        </button>
        <PaymentForm
          invoiceId={invoiceId}
          payment={view.payment}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleSaved}
        />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <p className="text-xs text-slate-500 py-2 text-center">読み込み中...</p>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              {payments.length > 0
                ? `${payments.length}件の入金記録`
                : "入金記録がありません"}
            </p>
            {invoiceBalance > 0 && (
              <button
                onClick={() => setView({ mode: "create" })}
                className="text-xs bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                + 入金登録
              </button>
            )}
          </div>

          {payments.length > 0 && (
            <div className="flex flex-col gap-2">
              {payments.map((p) => (
                <div key={p.id}
                  className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {formatYen(p.amount)}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE[p.status] ?? "bg-slate-700 text-slate-300"}`}>
                        {paymentStatusLabel(p.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {paymentDisplayNo(p)}
                      {p.payment_date && ` · ${p.payment_date}`}
                      {" · "}
                      {paymentMethodLabel(p.payment_method)}
                      {p.fee_amount > 0 && (
                        <span className="ml-1 text-slate-600">
                          (手数料 {formatYen(p.fee_amount)} / 実 {formatYen(p.net_amount)})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setView({ mode: "edit", payment: p })}
                      className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {deletingId === p.id ? "..." : "削除"}
                    </button>
                    <button
                      onClick={() => setView({ mode: "detail", payment: p })}
                      className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium px-2 py-1 transition-colors"
                    >
                      詳細
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {payments.length === 0 && invoiceBalance <= 0 && (
            <p className="text-xs text-green-400 text-center py-2">入金完了</p>
          )}
        </>
      )}
    </div>
  );
}
