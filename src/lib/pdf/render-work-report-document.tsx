// The ONE production renderer for the Work Report PDF (TEMPLATE-C2-WR).
//
// The adopted work-report design renders through the same offline serverless Chromium foundation
// the estimate/invoice/delivery-note use: native monetary-free work-report HTML, self-hosted
// Geist/Noto fonts, DOM-measurement pagination, zero network. The download route calls this on
// demand; NOTHING is persisted and no report/work-order state changes.

import { toWorkReportDocumentData, type WorkReportSource } from "./work-report-document-data";
import { buildWorkReportChromiumContext } from "./chromium-document/work-report-document-context";
import { resolveStoreLogoDataUri } from "./chromium-document/store-logo";
import { renderChromiumDocumentPdf } from "./chromium-document/chromium-renderer";
import type { BrandProfile } from "@/components/documents/types";

export async function renderWorkReportDocumentPdf(source: WorkReportSource, brand: BrandProfile): Promise<Buffer> {
  const data = toWorkReportDocumentData(source);
  const storeLogo = await resolveStoreLogoDataUri(brand);
  const context = buildWorkReportChromiumContext(data, brand, storeLogo);
  return renderChromiumDocumentPdf({ templateFile: "work-report-a4-compact.html", context });
}
