"use client";

// DEALEROS-ESTIMATE-INVOICE-PDF-B1 — the invoice PDF surface.
//
// Replaces the old placeholder and the target-less window.print() button. There
// are exactly two states, and they mirror the business contract:
//
//   draft   → 請求書を発行  (issues once, producing an immutable PDF)
//   issued  → 発行済みPDFをダウンロード  (re-signs the SAME artifact, never re-renders)
//
// Errors are shown as the typed Japanese messages the server returns; Storage
// paths, bucket names and service-role details never reach the browser.

import { useState, useTransition } from "react";
import { isValidCalendarDate } from "@/lib/invoices/invoice-delivery-date";

export type IssueSuccessKind = "issued" | "already_issued";

/** Invoice statuses for which a delivery note may be produced (issued and beyond). */
const DELIVERY_NOTE_ALLOWED_STATUSES = ["issued", "paid", "partially_paid", "overdue"];

interface InvoicePdfIssueActionsProps {
  invoiceId: string;
  status: string;
  /**
   * TEMPLATE-C2-DN-R1: the invoice's persisted delivery date (invoices.delivery_date, 納品日) —
   * the sole delivery-date source. Null/absent/invalid means no delivery date is saved, so the
   * delivery note cannot be produced and the UI explains that instead of generating a document.
   */
  deliveryDate?: string | null;
  /**
   * B1-V1-R1: fired ONLY when an issue action actually succeeded, so the
   * surrounding views can leave the draft state without a page reload. A
   * download never fires it — downloading changes no invoice state — and a
   * failed issuance never fires it either.
   */
  onIssued?: (kind: IssueSuccessKind) => void;
}

export default function InvoicePdfIssueActions({
  invoiceId,
  status,
  deliveryDate,
  onIssued,
}: InvoicePdfIssueActionsProps) {
  const [pending, startTransition] = useTransition();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDraft = status === "draft";
  const deliveryNoteAllowed = DELIVERY_NOTE_ALLOWED_STATUSES.includes(status);
  const hasDeliveryDate = isValidCalendarDate(deliveryDate);

  function run(action: "issue" | "download") {
    setError(null);
    startTransition(async () => {
      const mod = await import("@/lib/invoices/issue-invoice");
      const result =
        action === "issue"
          ? await mod.issueInvoice(invoiceId)
          : await mod.getIssuedInvoicePdfUrl(invoiceId);

      if (result.kind === "issued" || result.kind === "already_issued") {
        // The signed link survives the state change: it is set before the
        // callback, and the callback only swaps which controls are rendered.
        setSignedUrl(result.signedUrl);
        if (action === "issue") onIssued?.(result.kind);
        return;
      }
      setError(result.message);
    });
  }

  const btn =
    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {isDraft ? (
          <button
            type="button"
            onClick={() => run("issue")}
            disabled={pending}
            className={`${btn} bg-emerald-700 hover:bg-emerald-600 text-white`}
          >
            {pending ? "発行中..." : "請求書を発行"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run("download")}
            disabled={pending}
            className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
          >
            {pending ? "準備中..." : "発行済みPDFをダウンロード"}
          </button>
        )}

        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn} bg-blue-700 hover:bg-blue-600 text-white`}
          >
            PDFを開く
          </a>
        )}

        {/* TEMPLATE-C2-DN-R1: the delivery-note action appears only for an allowed (issued+)
            status AND only when a valid delivery date is persisted on the invoice. It opens the
            authenticated delivery-note route in a new tab — it never mutates or reissues the
            invoice. */}
        {deliveryNoteAllowed && hasDeliveryDate && (
          <a
            href={`/pdf/delivery-note?invoiceId=${encodeURIComponent(invoiceId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`}
          >
            納品書を表示
          </a>
        )}
      </div>

      {isDraft && (
        <p className="text-[11px] text-slate-500">
          発行すると請求書の内容は確定し、以後は編集できません。
        </p>
      )}

      {deliveryNoteAllowed && !hasDeliveryDate && (
        <p className="text-[11px] text-amber-400/90">
          納品書を出力するには、請求書に納品日が保存されている必要があります。
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
