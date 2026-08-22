"use client";

// B3-B1B I1 — global payments screen. The create modal now runs the GLOBAL flow:
// customer selection + allocated-by-default (open invoices) / unapplied. legacy_direct
// is never offered here — it exists only inside an invoice detail (PaymentSection).
// Payment deletion is disabled in I1, so no delete wiring exists.

import { useState } from "react";
import { PaymentDB, PayableCustomerOption } from "@/lib/payments/payment-types";
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
  const [customers, setCustomers] = useState<PayableCustomerOption[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery,  setSearchQuery]  = useState("");

  async function refresh() {
    const { getPayments } = await import("@/lib/payments/get-payments");
    const data = await getPayments();
    setPayments(data);
  }

  async function openCreate() {
    setModal({ mode: "create" });
    if (!customersLoaded) {
      const { getPayableCustomers } = await import("@/lib/payments/get-payments");
      setCustomers(await getPayableCustomers());
      setCustomersLoaded(true);
    }
  }

  function handleCreated() {
    refresh().then(() => setModal({ mode: "none" }));
  }

  function handleUpdated() {
    refresh().then(() => setModal({ mode: "none" }));
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">入金管理</h1>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">PAYMENTS</p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
        >
          + 入金登録
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl">
        <PaymentTable
          payments={payments}
          onView={(p) => setModal({ mode: "detail", payment: p })}
          onEdit={(p) => setModal({ mode: "edit",   payment: p })}
          filterStatus={filterStatus}
          onFilterStatus={setFilterStatus}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
        />
      </div>

      {/* Create modal — GLOBAL flow (allocated / unapplied only) */}
      {modal.mode === "create" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative my-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#263955] bg-[#111826] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#edf3fc]">入金を登録</h2>
              <button
                type="button"
                onClick={() => setModal({ mode: "none" })}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                ✕
              </button>
            </div>
            <PaymentForm
              context={{ kind: "global", customers }}
              onCancel={() => setModal({ mode: "none" })}
              onSuccess={handleCreated}
            />
          </div>
        </div>
      )}

      {/* Edit modal — notes / internal_memo only */}
      {modal.mode === "edit" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative my-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#263955] bg-[#111826] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#edf3fc]">入金メモを編集</h2>
              <button
                type="button"
                onClick={() => setModal({ mode: "none" })}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                ✕
              </button>
            </div>
            <PaymentForm
              context={{ kind: "global", customers }}
              payment={modal.payment}
              onCancel={() => setModal({ mode: "none" })}
              onSuccess={handleUpdated}
            />
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modal.mode === "detail" && (
        <PaymentDetail
          payment={modal.payment}
          onClose={() => setModal({ mode: "none" })}
          onEdit={() => setModal({ mode: "edit", payment: modal.payment })}
          onConverted={() => refresh().then(() => setModal({ mode: "none" }))}
        />
      )}
    </div>
  );
}
