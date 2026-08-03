// The ONE production renderer for the Estimate PDF.
//
// Both the on-screen preview and the downloadable file go through this function, so what the
// operator checks is byte-for-byte what the customer receives — there is no second rendering path
// and no HTML mock to drift out of sync.
//
// TEMPLATE-B2: the visual layer behind this signature is now the ACCEPTED premium HTML design,
// rendered by the offline serverless Chromium foundation proven in TEMPLATE-B1-R1 (self-hosted
// Geist/Noto fonts with the Japanese numeric-stack fix, DOM-measurement pagination, zero network).
// The exported signature is unchanged, so all three existing callers — the streaming route, the
// Storage-persisting action, and the immutable share snapshot — continue through this single
// renderer with no caller changes and no authorization/Storage semantics touched.

import { toEstimateDocumentData } from "./estimate-document-data";
import { buildEstimateChromiumContext } from "./chromium-document/estimate-document-context";
import { resolveStoreLogoDataUri } from "./chromium-document/store-logo";
import { renderChromiumDocumentPdf } from "./chromium-document/chromium-renderer";
import type { EstimateDB } from "@/lib/estimates/estimate-types";
import type { BrandProfile } from "@/components/documents/types";

export async function renderEstimateDocumentPdf(estimate: EstimateDB, brand: BrandProfile): Promise<Buffer> {
  const data = toEstimateDocumentData(estimate);
  const storeLogo = await resolveStoreLogoDataUri(brand);
  const context = buildEstimateChromiumContext(data, brand, storeLogo);
  return renderChromiumDocumentPdf({ templateFile: "estimate-a4-compact.html", context });
}
