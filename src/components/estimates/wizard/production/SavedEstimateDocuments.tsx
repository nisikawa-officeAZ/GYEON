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
// server actions. Missing injections disable it. Delivery-note issuance remains
// disabled; invoice date entry and final issuance are separate later work.
//
// ── WHY THIS MODULE TOUCHES NO BROWSER GLOBAL AND IMPORTS NO HOST ───────────
// It takes a validated estimate id, initial preference and injected actions,
// and re-checks the id at the last point before it can become a URL. It imports the validator
// from the session authority — never the host (no cycle), never a Server Action,
// gateway, PDF renderer or database.

import { useState } from "react";
import SavedEstimateInvoice from "./SavedEstimateInvoice";
import type { SavedInvoiceActions } from "./saved-estimate-invoice-controller";

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

// ── Component ───────────────────────────────────────────────────────────────

export type SavedEstimateDocumentsProps = {
  /** A VALIDATED estimate id. Re-checked here; an invalid value renders no link. */
  readonly estimateId: string;
  /** `true` only for the 保存してPDFを開く intent: the preview opens immediately. */
  readonly initialPdfPreview: boolean;
  readonly invoiceActions?: SavedInvoiceActions;
};

type PreviewState = "choices" | "estimate-pdf";

const NOT_WIRED_DELIVERY_NOTE =
  "納品書の同一画面発行はまだ接続されていません。この画面からは発行できません。";
export default function SavedEstimateDocuments({ estimateId, initialPdfPreview, invoiceActions }: SavedEstimateDocumentsProps) {
  // Defensive: the props are typed, but the id is re-validated at the last point
  // before it can become a URL, and the preference is accepted only as a literal
  // `true` — a truthy non-boolean is not an intent.
  const pdfPath = buildSavedEstimatePdfPath(estimateId);
  const detailPath = buildSavedEstimateDetailPath(estimateId);
  const [preview, setPreview] = useState<PreviewState>(
    initialPdfPreview === true ? "estimate-pdf" : "choices",
  );

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
      className="rounded-md border border-slate-700 bg-slate-900/60 p-4"
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
            className="rounded-md border border-sky-600 bg-sky-900/40 px-4 py-2 text-sm"
          >
            見積書（PDF）を表示
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-describedby="saved-document-delivery-note-reason"
            data-testid="saved-document-delivery-note"
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-500"
          >
            納品書（未接続）
          </button>
          <p
            id="saved-document-delivery-note-reason"
            className="mt-1 text-[11px] text-amber-300"
            data-testid="saved-document-delivery-note-reason"
          >
            {NOT_WIRED_DELIVERY_NOTE}
          </p>
        </li>
        <li>
          <SavedEstimateInvoice key={estimateId} estimateId={estimateId} actions={invoiceActions} />
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
