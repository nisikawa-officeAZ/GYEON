"use client";

// GYEON_SAVED_DOCUMENT_SURFACE_R1 — the saved-estimate document surface.
//
// Mounted by the production wizard host AFTER a verified save, or for a
// recovered completed session on reload. It replaces the editable wizard on the
// SAME URL: no navigation, estimate resave, session write or automatic issuance.
//
// ── WHAT THIS IS, HONESTLY ───────────────────────────────────────────────────
// Estimate PDF opens inline through the existing authenticated /pdf route.
// The invoice child connects explicit draft creation/readback via injected
// server actions. Missing injections disable it. The delivery note is a plain
// display link to the existing authenticated /pdf/delivery-note route; it
// activates ONLY after the related invoice has been read back in an issued+
// status with a valid persisted delivery date, and it never mutates anything.
//
// ── WHY THIS MODULE TOUCHES NO BROWSER GLOBAL AND IMPORTS NO HOST ───────────
// It takes a validated estimate id, initial preference and injected actions,
// and re-checks the id at the last point before it can become a URL. It imports the validator
// from the session authority — never the host (no cycle), never a Server Action,
// gateway, PDF renderer or database.

import { useState } from "react";
import SavedEstimateInvoice from "./SavedEstimateInvoice";
import { hasIssuedInvoice, type SavedInvoiceActions, type SavedInvoiceSummary } from "./saved-estimate-invoice-controller";
import { isValidCalendarDate } from "../../../../lib/invoices/invoice-delivery-date";

import { isValidEstimateId } from "../save/wizard-idempotency-session";

// ── Pure completion-state classifier ────────────────────────────────────────

export type SavedEstimateCompletionState =
  | { readonly kind: "saved"; readonly estimateId: string; readonly initialPdfPreview: boolean }
  | { readonly kind: "invalid-estimate-id" }
  | { readonly kind: "invalid-destination" };

/**
 * Turn a verified completion into saved-surface state, FAIL-CLOSED on both axes.
 *
 * The id is checked FIRST, so an invalid id is reported as such whatever the
 * destination is. Only the two existing save destinations are recognized:
 * `estimate` opens the surface on the document choices, `pdf` opens it on the
 * inline estimate-PDF preview. Anything else blocks — never a silent fallback.
 * The completed-session reload omits the destination, so it always lands on the
 * choices: the preference is a UI intent that is never persisted.
 */
export function classifySavedEstimateCompletion(
  estimateId: unknown,
  destination: unknown = "estimate",
): SavedEstimateCompletionState {
  if (!isValidEstimateId(estimateId)) return { kind: "invalid-estimate-id" };
  if (destination !== "estimate" && destination !== "pdf") return { kind: "invalid-destination" };
  return { kind: "saved", estimateId: estimateId as string, initialPdfPreview: destination === "pdf" };
}

// ── Pure path helpers (validated + encoded, never concatenated raw) ─────────

/** The existing authenticated PDF route. The ONLY value placed in a URL is the saved id. */
export function buildSavedEstimatePdfPath(estimateId: unknown): string | null {
  if (!isValidEstimateId(estimateId)) return null;
  return `/pdf?estimateId=${encodeURIComponent(estimateId as string)}`;
}

/** The saved-estimate detail page — an explicitly labelled fallback link, not issuance. */
export function buildSavedEstimateDetailPath(estimateId: unknown): string | null {
  if (!isValidEstimateId(estimateId)) return null;
  return `/estimates/${encodeURIComponent(estimateId as string)}`;
}

/**
 * The delivery-note display path, FAIL-CLOSED on every axis: it exists only for an invoice that
 * was READ BACK in an allowed issued+ status with a strictly valid persisted delivery date and a
 * valid UUID. The ONLY value placed in the URL is that validated invoice id — the already-issued
 * invoice is the sole delivery-note identity. Draft, cancelled, dateless or malformed readbacks
 * yield no link, never a guess.
 */
export function buildSavedDeliveryNotePath(
  invoice: Pick<SavedInvoiceSummary, "id" | "status" | "deliveryDate"> | null,
): string | null {
  if (!invoice) return null;
  if (!hasIssuedInvoice(invoice.status)) return null;
  if (!isValidCalendarDate(invoice.deliveryDate)) return null;
  if (!isValidEstimateId(invoice.id)) return null;
  return `/pdf/delivery-note?invoiceId=${encodeURIComponent(invoice.id)}`;
}

// ── Component ───────────────────────────────────────────────────────────────

export type SavedEstimateDocumentsProps = {
  /** A VALIDATED estimate id. Re-checked here; an invalid value renders no link. */
  readonly estimateId: string;
  /** `true` only for the 保存してPDFを開く intent: the preview opens immediately. */
  readonly initialPdfPreview: boolean;
  readonly invoiceActions?: SavedInvoiceActions;
};

type PreviewState = "choices" | "estimate-pdf";

const DELIVERY_NOTE_BLOCKED =
  "納品書は、下の請求書で納品日を保存し、確定発行した後に表示できます。この画面から納品書の保存・再発行は行いません。";
const DELIVERY_NOTE_READY =
  "発行済みの請求書と保存済みの納品日から表示します。表示のみで、保存・再発行は行いません。";

/**
 * The delivery-note choice: a plain display link when the read-back invoice is eligible,
 * otherwise a genuinely disabled control with the accurate reason. No handler in either state —
 * activation is purely the readback, and the link mutates nothing.
 */
export function SavedDeliveryNoteChoice({ invoice }: { invoice: SavedInvoiceSummary | null }) {
  const path = buildSavedDeliveryNotePath(invoice);
  if (path === null) {
    return (
      <>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-describedby="saved-document-delivery-note-reason"
          data-testid="saved-document-delivery-note"
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-500"
        >
          納品書（PDF）
        </button>
        <p
          id="saved-document-delivery-note-reason"
          className="mt-1 text-[11px] text-amber-300"
          data-testid="saved-document-delivery-note-reason"
        >
          {DELIVERY_NOTE_BLOCKED}
        </p>
      </>
    );
  }
  return (
    <>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby="saved-document-delivery-note-reason"
        data-testid="saved-document-delivery-note"
        className="inline-block rounded-md border border-sky-600 bg-sky-900/40 px-4 py-2 text-sm text-sky-100"
      >
        納品書（PDF）を表示
      </a>
      <p
        id="saved-document-delivery-note-reason"
        className="mt-1 text-[11px] text-slate-400"
        data-testid="saved-document-delivery-note-reason"
      >
        {DELIVERY_NOTE_READY}
      </p>
    </>
  );
}

export default function SavedEstimateDocuments({ estimateId, initialPdfPreview, invoiceActions }: SavedEstimateDocumentsProps) {
  // Defensive: the props are typed, but the id is re-validated at the last point
  // before it can become a URL, and the preference is accepted only as a literal
  // `true` — a truthy non-boolean is not an intent.
  const pdfPath = buildSavedEstimatePdfPath(estimateId);
  const detailPath = buildSavedEstimateDetailPath(estimateId);
  const [preview, setPreview] = useState<PreviewState>(
    initialPdfPreview === true ? "estimate-pdf" : "choices",
  );
  // The latest invoice readback from the child — the ONLY thing that can activate the
  // delivery-note link. It starts null, so the link is fail-closed until a real readback.
  const [readInvoice, setReadInvoice] = useState<SavedInvoiceSummary | null>(null);

  if (pdfPath === null || detailPath === null) {
    return (
      <div className="p-4" data-testid="saved-estimate-documents-invalid">
        <p className="text-sm text-amber-300">保存済み見積の識別子を確認できません。担当者へご連絡ください。</p>
      </div>
    );
  }

  const showingPdf = preview === "estimate-pdf";

  return (
    <section
      className="rounded-md border border-slate-700 bg-slate-900/60 p-4 text-slate-100"
      aria-labelledby="saved-estimate-documents-heading"
      data-testid="saved-estimate-documents"
    >
      <p role="status" className="text-sm text-emerald-300" data-testid="saved-estimate-status">
        保存完了
      </p>
      <h2 id="saved-estimate-documents-heading" className="mt-2 text-base text-slate-100">
        書類を選択
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        見積は保存されました。必要な書類を選んでください。何度選んでも見積が再保存されることはありません。
      </p>

      <ul className="mt-3 flex flex-col gap-2" data-testid="saved-document-choices">
        <li>
          <button
            type="button"
            data-testid="saved-document-estimate-pdf"
            aria-pressed={showingPdf}
            onClick={() => setPreview("estimate-pdf")}
            className="rounded-md border border-sky-600 bg-sky-900/40 px-4 py-2 text-sm text-slate-100"
          >
            見積書（PDF）を表示
          </button>
        </li>
        <li>
          <SavedDeliveryNoteChoice invoice={readInvoice} />
        </li>
        <li>
          <SavedEstimateInvoice key={estimateId} estimateId={estimateId} actions={invoiceActions} onInvoice={setReadInvoice} />
        </li>
      </ul>

      {showingPdf && (
        <div className="mt-4" data-testid="saved-estimate-pdf-preview">
          <iframe
            title="見積書PDFプレビュー"
            src={pdfPath}
            className="h-[70vh] w-full rounded-md border border-slate-700 bg-white"
            data-testid="saved-estimate-pdf-iframe"
          />
          <a
            href={pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-sky-300 underline"
            data-testid="saved-estimate-pdf-new-tab"
          >
            新しいタブで見積書PDFを開く
          </a>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        <a href={detailPath} className="underline" data-testid="saved-estimate-detail-link">
          保存済み見積の詳細ページを開く（別画面・書類発行ではありません）
        </a>
      </p>
    </section>
  );
}
