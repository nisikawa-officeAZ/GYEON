// PHASE 12E — CompletionReportTemplate dynamic-data contract.
//
// The Completion Report is a NON-monetary document: it reports completed works, before/after photos,
// an inspection checklist and the chief technician's note, with technician + customer sign-off. No
// amounts / bank / payment-due / internal memo. Reuses the Estimate customer/vehicle shapes. All
// content is stored Estimate/Completion data — nothing is recalculated.

import type { EstimateVehicle, EstimateCustomer } from "../estimate/estimate-data";

export type CompletionCustomer = EstimateCustomer;
export type CompletionVehicle = EstimateVehicle;

export interface CompletionPhoto {
  area: string; // e.g. "Front"
  beforeUrl?: string; // image URL/data-URI (optional; placeholder frame when absent)
  afterUrl?: string;
  beforeDate?: string;
  afterDate?: string;
}

export interface CompletedWorkItem {
  category?: string;
  name: string;
  description?: string;
}

export interface InspectionItem {
  label: string;
  result: string; // "OK" / "obs." / …
}

export interface CompletionReportDocumentData {
  serial: string; // e.g. "RPT/2026/00004"
  issueDate: string;
  completedDate: string;
  duration?: string; // e.g. "32 h (4 日)"
  refEstimate?: string;
  status?: string; // e.g. "Completed"
  chiefTechnician?: string;
  titleJa?: string; // default 作業完了報告書
  titleEn?: string; // default "Completion Report / Detailing Works Summary"
  customer: CompletionCustomer;
  vehicle: CompletionVehicle;
  photos: CompletionPhoto[]; // Before/After
  completedWorks: CompletedWorkItem[]; // no prices
  inspectionItems: InspectionItem[];
  inspectionSummary?: string; // e.g. "15 items · 14 OK · 1 obs."
  technicianNote?: string;
  customerNotes?: string[]; // customer-facing notes
}
