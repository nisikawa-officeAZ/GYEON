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

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">請求書</h1>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="text-sm bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg transition-colors"
        >
          + 新規作成
        </button>
      </div>

      {/* Table */}
      <InvoiceTable
        invoices={invoices}
        onView={(inv) => setModal({ mode: "detail", invoice: inv })}
        onEdit={(inv) => setModal({ mode: "edit",   invoice: inv })}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
      />

      {/* Create modal */}
      {modal.mode === "create" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setModal({ mode: "none" })} />
          <div className="relative w-full max-w-3xl bg-[#0f172a] rounded-xl shadow-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">請求書を作成</h2>
              <button onClick={() => setModal({ mode: "none" })}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="p-6">
              <InvoiceForm
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
          <div className="relative w-full max-w-3xl bg-[#0f172a] rounded-xl shadow-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">請求書を編集</h2>
              <button onClick={() => setModal({ mode: "none" })}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="p-6">
              <InvoiceForm
                invoice={modal.invoice}
                onCancel={() => setModal({ mode: "none" })}
                onSuccess={handleUpdated}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modal.mode === "detail" && (
        <InvoiceDetail
          invoice={modal.invoice}
          onClose={() => setModal({ mode: "none" })}
          onEdit={() => setModal({ mode: "edit", invoice: modal.invoice })}
        />
      )}
    </div>
  );
}
