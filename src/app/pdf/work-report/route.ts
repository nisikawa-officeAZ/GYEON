// DealerOS — Work Report PDF stream (TEMPLATE-C2-WR + GDA-1W §8). Renders a monetary-free work
// report on demand from the ONE canonical completion_reports row, using the SAME production
// renderer for preview and download. Nothing is written to Storage; this is not an immutable stored
// artifact and it never mutates report or work-order state — no side effect of any kind.
//
// Authentication is the genuine request scope: getCurrentDealer() and the loader both read the
// caller's cookie-backed RLS-scoped Supabase client — never the service role. Tenant isolation:
// dealer_id is resolved server-side from the session and applied by getWorkReportPdfData, which
// re-judges the SHARED §8 eligibility contract (getWorkReportSource) and reads performed work only
// from the confirmed completion_report_items snapshot. There is no estimate-item fallback.
//
// Response contract, stable and non-leaking:
//   401 — no authenticated dealer context.
//   400 — missing/blank reportId (the ONLY accepted input).
//   404 — foreign or missing report: the id grants nothing and never distinguishes
//         "not yours" from "does not exist".
//   422 — the caller's OWN canonical report is not work-report ready. The body carries
//         ONLY the exact shared reason CODES (the same list the UI renders) — no SQL,
//         no row content, no foreign-tenant information.
//   500 — renderer failure, generic text only.

import { NextRequest } from "next/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getWorkReportPdfData } from "@/lib/pdf/get-work-report-pdf-data";
import { getBrandProfile } from "@/lib/pdf/brand-profile";
import { renderWorkReportDocumentPdf } from "@/lib/pdf/render-work-report-document";
import { buildContentDisposition, resolveDisposition } from "../estimate/pdf-response-headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // ── Genuine request-scope authentication: cookie session, RLS-scoped. ──
  const dealer = await getCurrentDealer();
  if (!dealer) return new Response("Unauthorized", { status: 401 });

  // ── The only accepted input is the report id. Everything else — dealer,
  //    number, date, status, items — is resolved server-side.
  const reportId = req.nextUrl.searchParams.get("reportId") ?? "";
  if (!reportId) return new Response("reportId required", { status: 400 });

  // ── ONE fail-closed loader call; it re-judges the shared §8 contract. ──
  const resolved = await getWorkReportPdfData(dealer.dealer_id, reportId);
  if (resolved.kind === "unauthenticated") return new Response("Unauthorized", { status: 401 });
  if (resolved.kind === "invalid_request") return new Response("reportId required", { status: 400 });
  // Foreign/missing answers 404 — the id grants nothing.
  if (resolved.kind === "not_found") return new Response("Not found", { status: 404 });
  if (resolved.kind === "not_eligible") {
    // The caller owns this report (tenant-proven); the exact shared reason
    // codes tell them precisely what the completion flow must still do.
    return new Response(JSON.stringify({ ready: false, reasons: resolved.reasons }), {
      status: 422,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }

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
