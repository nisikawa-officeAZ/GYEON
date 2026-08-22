"use client";

import { useState } from "react";
import { InvoiceDB } from "@/lib/invoices/invoice-types";
import InvoiceTable  from "./InvoiceTable";
import InvoiceForm   from "./InvoiceForm";
import InvoiceDetail from "./InvoiceDetail";

type ModalState =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit";   invoice: InvoiceDB }
  | { mode: "detail"; invoice: InvoiceDB };

interface InvoicesClientProps {
  initialInvoices: InvoiceDB[];
}

export default function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<InvoiceDB[]>(initialInvoices);
  const [modal, setModal]       = useState<ModalState>({ mode: "none" });
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery,  setSearchQuery]  = useState("");

  async function refresh() {
    // Re-fetch from server action
    const { getInvoices } = await import("@/lib/invoices/get-invoices");
    const data = await getInvoices();
    setInvoices(data);
  }

  function handleCreated(id: string) {
    import("@/lib/invoices/get-invoices").then(({ getInvoices }) =>
      getInvoices().then((data) => {
        setInvoices(data);
        const found = data.find((i) => i.id === id);
        if (found) setModal({ mode: "detail", invoice: found });
        else setModal({ mode: "none" });
      })
    );
  }

  function handleUpdated() {
    refresh().then(() => setModal({ mode: "none" }));
  }

  /**
   * B1-V1-R1: an open detail view reports every invoice change (today:
   * issuance) so the table leaves the draft state immediately. The row is
   * REPLACED in place and the detail modal keeps the same identity, so the
   * freshly produced PDFを開く link is never unmounted.
   */
  function handleInvoiceChange(updated: InvoiceDB) {
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setModal((prev) =>
      prev.mode === "detail" && prev.invoice.id === updated.id
        ? { mode: "detail", invoice: updated }
        : prev
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">請求書</h1>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">INVOICES</p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="shrink-0 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
        >
          + 新規作成
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl">
        <InvoiceTable
          invoices={invoices}
          onView={(inv) => setModal({ mode: "detail", invoice: inv })}
          onEdit={(inv) => setModal({ mode: "edit",   invoice: inv })}
          filterStatus={filterStatus}
          onFilterStatus={setFilterStatus}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
        />
      </div>

      {/* Create modal */}
      {modal.mode === "create" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative my-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#263955] bg-[#111826] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#edf3fc]">請求書を作成</h2>
              <button
                type="button"
                onClick={() => setModal({ mode: "none" })}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                ✕
              </button>
            </div>
            <InvoiceForm
              onCancel={() => setModal({ mode: "none" })}
              onSuccess={handleCreated}
            />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal.mode === "edit" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative my-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#263955] bg-[#111826] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#edf3fc]">請求書を編集</h2>
              <button
                type="button"
                onClick={() => setModal({ mode: "none" })}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                ✕
              </button>
            </div>
            <InvoiceForm
              invoice={modal.invoice}
              onCancel={() => setModal({ mode: "none" })}
              onSuccess={handleUpdated}
            />
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modal.mode === "detail" && (
        <InvoiceDetail
          invoice={modal.invoice}
          onClose={() => setModal({ mode: "none" })}
          onEdit={() => setModal({ mode: "edit", invoice: modal.invoice })}
          onInvoiceChange={handleInvoiceChange}
        />
      )}
    </div>
  );
}
