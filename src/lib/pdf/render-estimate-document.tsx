// The ONE production renderer for the Estimate PDF.
//
// Both the on-screen preview and the downloadable file go through this function, so what the
// operator checks is byte-for-byte what the customer receives — there is no second rendering path
// and no HTML mock to drift out of sync.
//
// It follows the existing PDF architecture exactly: register the bundled Japanese fonts, then
// renderToBuffer the approved template. No new PDF dependency.

import { renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "./register-fonts";
import { EstimateTemplate } from "@/components/documents/templates/estimate";
import { toEstimateDocumentData } from "./estimate-document-data";
import type { EstimateDB } from "@/lib/estimates/estimate-types";
import type { BrandProfile } from "@/components/documents/types";

export async function renderEstimateDocumentPdf(estimate: EstimateDB, brand: BrandProfile): Promise<Buffer> {
  registerPdfFonts();
  const data = toEstimateDocumentData(estimate);
  return renderToBuffer(<EstimateTemplate brand={brand} data={data} />);
}
