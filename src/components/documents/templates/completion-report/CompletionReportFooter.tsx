// CompletionReportFooter — identical to the Estimate/Invoice/Delivery footer (brand block + SNS QR).
// Reused directly to avoid duplication; all values come from BrandProfile.

import { EstimateFooter } from "../estimate/EstimateFooter";
import type { BrandProfile } from "../../types";

export function CompletionReportFooter({ brand }: { brand: BrandProfile }) {
  return <EstimateFooter brand={brand} />;
}
