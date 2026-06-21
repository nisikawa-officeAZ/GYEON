"use client";

import { useState } from "react";
import { PaymentDB } from "@/lib/payments/payment-types";
import PaymentTable  from "./PaymentTable";
import PaymentForm   from "./PaymentForm";
import PaymentDetail from "./PaymentDetail";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit";   payment: PaymentDB }
  | { mode: "detail"; payment: PaymentDB };

interface PaymentsClientProps {
  initialPayments: PaymentDB[];
}

export default function PaymentsClient({ initialPayments }: PaymentsClientProps) {
  const [payments, setPayments] = useState<PaymentDB[]>(initialPayments);
  const [modal, setModal]       = useState<ModalState>({ mode: "none" });
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery,  setSearchQuery]  = useState("");

  async function refresh() {
    const { getPayments } = await import("@/lib/payments/get-payments");
    const data = await getPayments();
    setPayments(data);
  }

  function handleCreated() {
    refresh().then(() => setModal({ mode: "none" }));
  }

  function handleUpdated() {
    refresh().then(() => setModal({ mode: "none" }));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">入金管理</h1>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="text-sm bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg transition-colors"
        >
          + 入金登録
        </button>
      </div>

      {/* Table */}
      <PaymentTable
        payments={payments}
        onView={(p) => setModal({ mode: "detail", payment: p })}
        onEdit={(p) => setModal({ mode: "edit",   payment: p })}
        onDeleted={refresh}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
      />

      {/* Create modal */}
      {modal.mode === "create" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-xl shadow-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">入金を登録</h2>
              <button onClick={() => setModal({ mode: "none" })}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="p-6">
              <PaymentForm
                invoiceId=""
                onCancel={() => setModal({ mode: "none" })}
                onSuccess={handleCreated}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal.mode === "edit" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-xl shadow-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">入金を編集</h2>
              <button onClick={() => setModal({ mode: "none" })}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="p-6">
              <PaymentForm
                invoiceId={modal.payment.invoice_id}
                payment={modal.payment}
                onCancel={() => setModal({ mode: "none" })}
                onSuccess={handleUpdated}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modal.mode === "detail" && (
        <PaymentDetail
          payment={modal.payment}
          onClose={() => setModal({ mode: "none" })}
          onEdit={() => setModal({ mode: "edit", payment: modal.payment })}
        />
      )}
    </div>
  );
}
