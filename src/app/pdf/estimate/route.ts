// DealerOS — Estimate PDF stream (PHASE 12H). Renders the saved estimate on demand with the SAME
// production renderer the download uses, so the preview an operator checks is exactly the file the
// customer gets. Nothing is written to storage here — persistence stays in `generateEstimatePdf`.
//
// Tenant isolation: dealer_id is resolved server-side from the session and applied by
// `getEstimatePdfData`, which scopes the query by both id AND dealer_id. An estimate belonging to
// another dealer therefore resolves to null and is answered 404 — the id in the URL grants nothing.

import { NextRequest } from "next/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getEstimatePdfData } from "@/lib/pdf/get-estimate-pdf-data";
import { getBrandProfile } from "@/lib/pdf/brand-profile";
import { renderEstimateDocumentPdf } from "@/lib/pdf/render-estimate-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const dealer = await getCurrentDealer();
  if (!dealer) return new Response("Unauthorized", { status: 401 });

  const estimateId = req.nextUrl.searchParams.get("estimateId") ?? "";
  if (!estimateId) return new Response("estimateId required", { status: 400 });

  const estimate = await getEstimatePdfData(estimateId);
  if (!estimate) return new Response("Not found", { status: 404 });

  const brand = await getBrandProfile(dealer.dealer_id);

  let buffer: Buffer;
  try {
    buffer = await renderEstimateDocumentPdf(estimate, brand);
  } catch (err) {
    console.error("[estimate pdf] render failed:", err);
    return new Response("PDFの生成に失敗しました", { status: 500 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${estimate.estimate_number ?? estimate.estimate_no}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
