// The ONE production renderer for the Delivery Note PDF (TEMPLATE-C2-DN).
//
// The adopted delivery-note design renders through the same offline serverless Chromium foundation
// the estimate and invoice use: native delivery-note HTML, self-hosted Geist/Noto fonts with the
// accepted Japanese numeric-stack fix, DOM-measurement pagination, zero network. The download
// route calls this on demand; NOTHING is persisted — the streamed bytes are not an immutable
// stored artifact.

import { toDeliveryNoteDocumentData } from "./delivery-note-document-data";
import { buildDeliveryNoteChromiumContext } from "./chromium-document/delivery-note-document-context";
import { resolveStoreLogoDataUri } from "./chromium-document/store-logo";
import { renderChromiumDocumentPdf } from "./chromium-document/chromium-renderer";
import type { InvoiceDB } from "@/lib/invoices/invoice-types";
import type { BrandProfile } from "@/components/documents/types";

export async function renderDeliveryNoteDocumentPdf(
  invoice: InvoiceDB,
  deliveryDate: string,
  brand: BrandProfile,
): Promise<Buffer> {
  const data = toDeliveryNoteDocumentData(invoice, deliveryDate);
  const storeLogo = await resolveStoreLogoDataUri(brand);
  const context = buildDeliveryNoteChromiumContext(data, brand, storeLogo);
  return renderChromiumDocumentPdf({ templateFile: "delivery-note-a4-compact.html", context });
}
