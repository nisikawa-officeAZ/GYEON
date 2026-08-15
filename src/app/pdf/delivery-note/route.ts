// DealerOS — Delivery Note PDF stream (TEMPLATE-C2-DN). Renders a delivery note on demand from an
// ALREADY-ISSUED invoice, using the SAME production renderer for preview and download so the
// operator sees exactly the customer's file. Nothing is written to Storage; this is not an
// immutable stored artifact and it never mutates invoice state.
//
// Tenant isolation: dealer_id is resolved server-side from the session and applied by
// getDeliveryNotePdfData, which scopes the query by BOTH invoice id AND dealer_id through the
// caller's RLS-scoped client (never the service role). A foreign invoice id resolves to nothing.
//
// Responses are coarse — 401 / 400 / 404 / 500 — and reveal no foreign-tenant existence, Storage
// paths, database internals, or service-role details.

import { NextRequest } from "next/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getDeliveryNotePdfData } from "@/lib/pdf/get-delivery-note-pdf-data";
import { getBrandProfile } from "@/lib/pdf/brand-profile";
import { renderDeliveryNoteDocumentPdf } from "@/lib/pdf/render-delivery-note-document";
import { deliveryNumberFromInvoiceNumber } from "@/lib/pdf/delivery-note-document-data";
import { buildContentDisposition, resolveDisposition } from "../estimate/pdf-response-headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const dealer = await getCurrentDealer();
  if (!dealer) return new Response("Unauthorized", { status: 401 });

  const invoiceId = req.nextUrl.searchParams.get("invoiceId") ?? "";
  if (!invoiceId) return new Response("invoiceId required", { status: 400 });

  const resolved = await getDeliveryNotePdfData(dealer.dealer_id, invoiceId);
  if (resolved.kind === "unauthenticated") return new Response("Unauthorized", { status: 401 });
  if (resolved.kind === "invalid_request") return new Response("invoiceId required", { status: 400 });
  // A foreign/missing invoice AND an ineligible one both answer 404 — the id grants nothing and the
  // reason never distinguishes "not yours" from "not ready".
  if (resolved.kind !== "ok") return new Response("Not found", { status: 404 });

  const brand = await getBrandProfile(dealer.dealer_id);

  let buffer: Buffer;
  try {
    buffer = await renderDeliveryNoteDocumentPdf(resolved.invoice, resolved.deliveryDate, brand);
  } catch (err) {
    console.error("[delivery-note pdf] render failed:", err);
    return new Response("PDFの生成に失敗しました", { status: 500 });
  }

  // The BYTES are identical in both modes — only the disposition differs.
  const disposition = resolveDisposition(req.nextUrl.searchParams.get("download"));
  const deliveryNumber = deliveryNumberFromInvoiceNumber(resolved.invoice.invoice_number);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(disposition, deliveryNumber),
      "Cache-Control": "no-store",
    },
  });
}
