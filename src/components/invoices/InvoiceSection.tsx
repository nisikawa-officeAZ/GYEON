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
  draft:          "border-[#5C6B84]/40 bg-[#5C6B84]/15 text-[#c3cee2]",
  issued:         "border-[#2F6BFF]/45 bg-[#2F6BFF]/15 text-[#93c5fd]",
  paid:           "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  partially_paid: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  overdue:        "border-red-400/40 bg-red-500/15 text-red-300",
  cancelled:      "border-[#5C6B84]/30 bg-[#0b1220]/70 text-[#8191ad]",
};

const nestedShellClass =
  "rounded-2xl border border-[#263955] bg-[#111826]/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl";
const linkButtonClass =
  "rounded-full border border-[#263955] bg-[#0b1220]/70 px-3 py-1.5 text-xs font-semibold text-[#93A4BD] transition-colors hover:border-[#60a5fa]/50 hover:text-[#E8EEF7]";
const primaryButtonClass =
  "rounded-xl bg-[#2F6BFF] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_22px_rgba(47,107,255,0.28)] transition-colors hover:bg-[#3b82f6] disabled:opacity-50";

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
      <div className={nestedShellClass}>
        <button onClick={() => setView({ mode: "list" })}
          className={`${linkButtonClass} self-start`}>
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
      <div className={nestedShellClass}>
        <button onClick={() => setView({ mode: "list" })}
          className={`${linkButtonClass} self-start`}>
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
    <div className={nestedShellClass}>
      {error && (
        <div className="rounded-xl border border-red-500/35 bg-red-950/30 px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="py-2 text-center text-xs text-[#5C6B84]">読み込み中...</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#263955] bg-[#0b1220]/50 py-5 text-center">
          <p className="mb-3 text-xs text-[#5C6B84]">請求書がまだありません。</p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={handleCreatedFromWO}
              disabled={creating}
              className={primaryButtonClass}
            >
              {creating ? "作成中..." : "作業指示書から請求書を作成"}
            </button>
            <button
              onClick={() => setView({ mode: "create" })}
              className="rounded-xl border border-[#263955] bg-[#0b1220]/70 px-4 py-2 text-sm font-semibold text-[#93A4BD] transition-colors hover:border-[#60a5fa]/50 hover:text-[#E8EEF7]"
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
              className="rounded-full border border-[#2F6BFF]/35 bg-[#2F6BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#60a5fa] transition-colors hover:bg-[#2F6BFF]/15"
            >
              + 新規作成
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#263955] bg-[#0b1220]/70 px-4 py-3 transition-colors hover:border-[#60a5fa]/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#E8EEF7]">
                      {inv.title ?? invoiceDisplayNo(inv)}
                    </p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_BADGE[inv.status] ?? "border-[#263955] bg-[#0b1220]/70 text-[#93A4BD]"}`}>
                      {invoiceStatusLabel(inv.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#5C6B84]">
                    {invoiceDisplayNo(inv)}
                    {inv.issue_date && ` · ${inv.issue_date}`}
                    {" · "}
                    <span className="font-medium text-[#93A4BD]">¥{inv.total.toLocaleString("ja-JP")}</span>
                    {inv.balance_due > 0 && (
                      <span className="ml-1 text-[#60a5fa]">
                        (残 ¥{inv.balance_due.toLocaleString("ja-JP")})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setView({ mode: "edit", invoice: inv })}
                    className="rounded-lg px-2 py-1 text-xs text-[#93A4BD] transition-colors hover:bg-[#263955]/40 hover:text-[#E8EEF7]"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => setView({ mode: "detail", invoice: inv })}
                    className="px-2 py-1 text-xs font-semibold text-[#60a5fa] transition-colors hover:text-[#93c5fd]"
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
