// DealerOS — Work Report PDF stream (TEMPLATE-C2-WR). Renders a monetary-free work report on demand
// from a completion_reports row whose work order is completed and dated, using the SAME production
// renderer for preview and download. Nothing is written to Storage; this is not an immutable stored
// artifact and it never mutates report or work-order state.
//
// Tenant isolation: dealer_id is resolved server-side from the session and applied by
// getWorkReportPdfData, which scopes by BOTH report id AND dealer_id through the caller's RLS-scoped
// client (never the service role). A foreign report id resolves to nothing.
//
// Responses are coarse — 401 / 400 / 404 / 500 — and reveal no foreign-tenant ownership.

import { NextRequest } from "next/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getWorkReportPdfData } from "@/lib/pdf/get-work-report-pdf-data";
import { getBrandProfile } from "@/lib/pdf/brand-profile";
import { renderWorkReportDocumentPdf } from "@/lib/pdf/render-work-report-document";
import { buildContentDisposition, resolveDisposition } from "../estimate/pdf-response-headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const dealer = await getCurrentDealer();
  if (!dealer) return new Response("Unauthorized", { status: 401 });

  const reportId = req.nextUrl.searchParams.get("reportId") ?? "";
  if (!reportId) return new Response("reportId required", { status: 400 });

  const resolved = await getWorkReportPdfData(dealer.dealer_id, reportId);
  if (resolved.kind === "unauthenticated") return new Response("Unauthorized", { status: 401 });
  if (resolved.kind === "invalid_request") return new Response("reportId required", { status: 400 });
  // Foreign/missing AND ineligible both answer 404 — the id grants nothing and never distinguishes
  // "not yours" from "not ready".
  if (resolved.kind !== "ok") return new Response("Not found", { status: 404 });

  const brand = await getBrandProfile(dealer.dealer_id);

  let buffer: Buffer;
  try {
    buffer = await renderWorkReportDocumentPdf(resolved.source, brand);
  } catch (err) {
    console.error("[work-report pdf] render failed:", err);
    return new Response("PDFの生成に失敗しました", { status: 500 });
  }

  // The BYTES are identical in both modes — only the disposition differs.
  const disposition = resolveDisposition(req.nextUrl.searchParams.get("download"));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(disposition, resolved.source.reportNumber),
      "Cache-Control": "private, no-store",
    },
  });
}
