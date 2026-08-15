// InvoiceFooter — identical to the Estimate footer (brand block + SNS QR). Reused directly to avoid
// duplication; all values come from BrandProfile.

import { EstimateFooter } from "../estimate/EstimateFooter";
import type { BrandProfile } from "../../types";

export function InvoiceFooter({ brand }: { brand: BrandProfile }) {
  return <EstimateFooter brand={brand} />;
}
