// PHASE 12B — EstimateTemplate dynamic-data contract.
//
// The template renders ONLY from this typed input + a BrandProfile. Nothing here (or in any component
// below) hardcodes a tenant: issuer identity comes from BrandProfile, document data from the caller's
// mapping of the existing Estimate model. No Office AZ / address / phone / bank / tax / dealer /
// technician literals anywhere in the template layer.

import type { Party } from "../../types";

export interface EstimateItem {
  category?: string; // e.g. "Coating"
  name: string;
  description?: string; // sub-line under the name
  unitPrice?: number | null;
  quantity?: number;
  discount?: number | null; // per-line discount amount (null → em-dash)
  amount?: number | null; // line subtotal
}

export interface EstimateSummaryData {
  subtotal: number;
  discount: number; // shown as a negative red line when > 0
  taxRatePercent: number; // e.g. 10
  tax: number;
  grandTotal: number;
}

/** Vehicle fields as shown on the Estimate (differs from the shared VehicleBlock row set). */
export interface EstimateVehicle {
  name?: string; // "Ferrari 458 Italia"
  maker?: string;
  year?: string;
  grade?: string;
  plate?: string;
  color?: string;
  mileage?: string;
}

export interface EstimateCustomer extends Party {
  email?: string;
}

export interface EstimatePhilosophy {
  eyebrow: string;
  lines: string[];
  attribution: string;
}

// GYEON brand philosophy (not tenant data) — the approved default quote from concept-b.
export const DEFAULT_ESTIMATE_PHILOSOPHY: EstimatePhilosophy = {
  eyebrow: "GYEON Philosophy",
  lines: ["Every car deserves to be protected,", "every finish deserves to be enhanced."],
  attribution: "Protect & Enhance — GYEON",
};

export interface EstimateDocumentData {
  serial: string; // e.g. "EST/2026/00012"
  issueDate: string;
  validUntil?: string;
  titleJa?: string; // default 見積書
  titleEn?: string; // default "Estimate / Coating & Protection Proposal"
  status?: string; // "Sent" / "Draft" / "Approved"
  preparedBy?: string; // technician name (typically brand.business.responsiblePerson)
  customer: EstimateCustomer;
  vehicle: EstimateVehicle;
  items: EstimateItem[];
  summary: EstimateSummaryData;
  notes: string[];
  philosophy?: EstimatePhilosophy;
  showSignature?: boolean; // concept-b Estimate omits the signature; opt-in only
}
