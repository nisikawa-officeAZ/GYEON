"use client";

// Lazy-loaded invoice section inside WorkOrderDetail.

import { useState, useEffect, useTransition } from "react";
import {
  InvoiceDB,
  invoiceDisplayNo,
  invoiceStatusLabel,
  InvoiceStatus,
} from "@/lib/invoices/invoice-types";
import { getInvoicesByWorkOrder } from "@/lib/invoices/get-invoice";
import { createInvoiceFromWorkOrder } from "@/lib/invoices/create-invoice";
import InvoiceForm   from "./InvoiceForm";
import InvoiceDetail from "./InvoiceDetail";

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:          "bg-slate-600 text-slate-100",
  issued:         "bg-blue-600 text-white",
  paid:           "bg-green-600 text-white",
  partially_paid: "bg-amber-600 text-white",
  overdue:        "bg-red-600 text-white",
  cancelled:      "bg-slate-700 text-slate-400",
};

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit";   invoice: InvoiceDB }
  | { mode: "detail"; invoice: InvoiceDB };

interface InvoiceSectionProps {
  workOrderId: string;
}

export default function InvoiceSection({ workOrderId }: InvoiceSectionProps) {
  const [invoices, setInvoices] = useState<InvoiceDB[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<ViewState>({ mode: "list" });
  const [creating, startCreate] = useTransition();
  const [error,    setError]    = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    getInvoicesByWorkOrder(workOrderId).then((data) => {
      setInvoices(data);
      setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, [workOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreatedFromWO() {
    setError(null);
    startCreate(async () => {
      const result = await createInvoiceFromWorkOrder(workOrderId);
      if ("error" in result) {
        setError(result.error);
      } else {
        refresh();
      }
    });
  }

  function handleSaved() {
    refresh();
    setView({ mode: "list" });
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (view.mode === "detail") {
    return (
      <InvoiceDetail
        invoice={view.invoice}
        onClose={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "edit", invoice: view.invoice })}
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
        <InvoiceForm
          workOrderId={workOrderId}
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
        <InvoiceForm
          invoice={view.invoice}
          workOrderId={workOrderId}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleSaved}
        />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500 py-2 text-center">読み込み中...</p>
      ) : invoices.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-600 mb-3">請求書がまだありません。</p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={handleCreatedFromWO}
              disabled={creating}
              className="text-sm bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? "作成中..." : "作業指示書から請求書を作成"}
            </button>
            <button
              onClick={() => setView({ mode: "create" })}
              className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 px-4 py-2 rounded-lg transition-colors"
            >
              手動で作成
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setView({ mode: "create" })}
              className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors"
            >
              + 新規作成
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {inv.title ?? invoiceDisplayNo(inv)}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE[inv.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {invoiceStatusLabel(inv.status)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {invoiceDisplayNo(inv)}
                    {inv.issue_date && ` · ${inv.issue_date}`}
                    {" · "}
                    <span className="text-slate-400 font-medium">¥{inv.total.toLocaleString("ja-JP")}</span>
                    {inv.balance_due > 0 && (
                      <span className="text-blue-400 ml-1">
                        (残 ¥{inv.balance_due.toLocaleString("ja-JP")})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setView({ mode: "edit", invoice: inv })}
                    className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => setView({ mode: "detail", invoice: inv })}
                    className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium px-2 py-1 transition-colors"
                  >
                    詳細
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
