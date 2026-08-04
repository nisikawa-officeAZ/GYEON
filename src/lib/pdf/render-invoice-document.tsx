// The ONE production renderer for the issued Invoice PDF (TEMPLATE-B3).
//
// The adopted premium invoice design renders through the same offline serverless Chromium
// foundation the estimate uses: native invoice HTML, self-hosted Geist/Noto fonts with the
// accepted Japanese numeric-stack fix, DOM-measurement pagination, zero network. The secure
// issuance boundary calls this AFTER immutable snapshot validation and BEFORE the upsert:false
// Storage upload — the rendered bytes ARE the issued artifact.

import { toInvoiceDocumentData } from "./invoice-document-data";
import { buildInvoiceChromiumContext } from "./chromium-document/invoice-document-context";
import { resolveStoreLogoDataUri } from "./chromium-document/store-logo";
import { renderChromiumDocumentPdf } from "./chromium-document/chromium-renderer";
import type { InvoiceDB } from "@/lib/invoices/invoice-types";
import type { BrandProfile } from "@/components/documents/types";

export async function renderInvoiceDocumentPdf(invoice: InvoiceDB, brand: BrandProfile): Promise<Buffer> {
  const data = toInvoiceDocumentData(invoice);
  const storeLogo = await resolveStoreLogoDataUri(brand);
  const context = buildInvoiceChromiumContext(data, brand, storeLogo);
  return renderChromiumDocumentPdf({ templateFile: "invoice-a4-compact.html", context });
}
