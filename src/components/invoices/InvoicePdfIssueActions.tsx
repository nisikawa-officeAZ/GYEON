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

export type IssueSuccessKind = "issued" | "already_issued";

/** Invoice statuses for which a delivery note may be produced (issued and beyond). */
const DELIVERY_NOTE_ALLOWED_STATUSES = ["issued", "paid", "partially_paid", "overdue"];

interface InvoicePdfIssueActionsProps {
  invoiceId: string;
  status: string;
  /**
   * TEMPLATE-C2-DN: the linked work order's actual completion date — the sole delivery-date
   * source. Null/absent means no completion date is registered, so the delivery note cannot be
   * produced and the UI explains that instead of generating a document.
   */
  workOrderActualEndAt?: string | null;
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
  workOrderActualEndAt,
  onIssued,
}: InvoicePdfIssueActionsProps) {
  const [pending, startTransition] = useTransition();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDraft = status === "draft";
  const deliveryNoteAllowed = DELIVERY_NOTE_ALLOWED_STATUSES.includes(status);
  const hasCompletionDate = typeof workOrderActualEndAt === "string" && workOrderActualEndAt.trim() !== "";

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

        {/* TEMPLATE-C2-DN: the delivery-note action appears only for an allowed (issued+) status
            AND only when a work completion date is registered. It opens the authenticated
            delivery-note route in a new tab — it never mutates or reissues the invoice. */}
        {deliveryNoteAllowed && hasCompletionDate && (
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

      {deliveryNoteAllowed && !hasCompletionDate && (
        <p className="text-[11px] text-amber-400/90">
          納品書を出力するには、施工指示に作業完了日を登録してください。
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
