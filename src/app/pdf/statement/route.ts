// DealerOS — Statement PDF route (Phase E8.5). Streams a non-persisted
// 統合請求書 rendered on demand from the Statement Preview service. Nothing is
// saved to storage or the database. dealer_id is resolved server-side via
// getCurrentDealer(); customerId is dealer-scoped by the preview query.

import { NextRequest } from "next/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getStatementPreview } from "@/lib/customer-billing/statement-preview";
import { getCustomerById } from "@/lib/customers/get-customer";
import { customerDisplayName } from "@/lib/customers/customer-types";
import { getDealerBranding } from "@/lib/pdf/dealer-branding";
import { renderStatementPdf } from "@/lib/pdf/templates/statement-pdf";

export async function GET(req: NextRequest) {
  const dealer = await getCurrentDealer();
  if (!dealer) return new Response("Unauthorized", { status: 401 });

  const customerId = req.nextUrl.searchParams.get("customerId") ?? "";
  const ref = req.nextUrl.searchParams.get("ref") ?? undefined;
  if (!customerId) return new Response("customerId required", { status: 400 });

  const preview = await getStatementPreview(customerId, ref);
  if ("error" in preview) return new Response(preview.error, { status: 400 });
  if (!preview.eligible || !preview.billingPeriod) {
    return new Response("Not a closing-billing customer", { status: 400 });
  }

  const customer = await getCustomerById(customerId);
  const branding = await getDealerBranding(dealer.dealer_id);

  let buffer: Buffer;
  try {
    buffer = await renderStatementPdf(
      {
        customerName:   customer ? customerDisplayName(customer) : "",
        periodStart:    preview.billingPeriod.periodStart,
        periodEnd:      preview.billingPeriod.periodEnd,
        closingDay:     preview.billingMethod.closingDay,
        paymentDueDate: preview.paymentDueDate,
        rows:           preview.detail,
        invoiceCount:   preview.invoiceCount,
        subtotal:       preview.subtotal,
        tax:            preview.tax,
        grandTotal:     preview.grandTotal,
      },
      branding,
    );
  } catch (err) {
    { console.error("[statement pdf] render failed:", err); return new Response("PDFの生成に失敗しました", { status: 500 }); }
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${customerId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
