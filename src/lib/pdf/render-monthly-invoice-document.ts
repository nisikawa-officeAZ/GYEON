// B1B-E2-R1 — the ONE production renderer for the monthly-invoice (月次請求書) PDF.
//
// The monthly design package renders through the SAME accepted offline serverless Chromium
// foundation as the estimate/invoice/delivery-note/work-report documents: native HTML template,
// self-hosted Geist/Noto fonts with the accepted Japanese numeric-stack fix, DOM-measurement
// pagination, request interception that fails the render closed on any outbound attempt.
//
// This phase renders BYTES ONLY: no persistence, no upload, no attach, no signing, no download,
// no URLs, no database fields. The caller supplies the already-loaded issued-statement snapshot
// bundle; the adapter re-proves the accepted formulas and identities before anything renders.
//
// The monthly design package is vendored at src/lib/pdf/chromium-document/design/. The accepted
// Chromium runner resolves template files against the premium design root, so the template is
// addressed by its relative path INSIDE the same vendored src/lib/pdf tree — the runner itself
// (offline rules, ready-gates, fonts, print settings) is reused byte-for-byte, never forked.

import path from "node:path";
import {
  toMonthlyInvoiceDocumentData,
  buildMonthlyInvoiceChromiumContext,
  type MonthlyInvoiceSource,
} from "./monthly-invoice-document-data";
import { resolveStoreLogoDataUri } from "./chromium-document/store-logo";
import { renderChromiumDocumentPdf } from "./chromium-document/chromium-renderer";
import type { BrandProfile } from "@/components/documents/types";

const MONTHLY_TEMPLATE_FILE = path.join("..", "..", "chromium-document", "design", "monthly-invoice-a4.html");

export async function renderMonthlyInvoiceDocumentPdf(
  source: MonthlyInvoiceSource,
  brand: BrandProfile,
): Promise<Buffer> {
  const data = toMonthlyInvoiceDocumentData(source);
  const storeLogo = await resolveStoreLogoDataUri(brand);
  const context = buildMonthlyInvoiceChromiumContext(data, brand, storeLogo);
  return renderChromiumDocumentPdf({ templateFile: MONTHLY_TEMPLATE_FILE, context });
}
