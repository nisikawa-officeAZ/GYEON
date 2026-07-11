// PHASE 12D — DeliveryNoteTemplate dynamic-data contract.
//
// Reuses the Estimate item/summary/vehicle/customer shapes (identical structure). Delivery-note
// specific: delivery date, optional referenced estimate, Completed status, aftercare notes, and a
// customer acknowledgement (receipt) signature. No bank / valid-until / payment-due (invoice's
// responsibility). Pricing is pre-computed (stored in DealerOS) — the template only renders it.

import type {
  EstimateItem,
  EstimateSummaryData,
  EstimateVehicle,
  EstimateCustomer,
} from "../estimate/estimate-data";

export type DeliveryItem = EstimateItem;
export type DeliverySummaryData = EstimateSummaryData;
export type DeliveryVehicle = EstimateVehicle;
export type DeliveryCustomer = EstimateCustomer;

export interface DeliveryNoteDocumentData {
  serial: string; // e.g. "DLV/2026/00004"
  issueDate: string;
  deliveryDate: string;
  refEstimate?: string; // referenced estimate serial, e.g. "EST/2026/00004"
  status?: string; // e.g. "Completed"
  titleJa?: string; // default 納品書
  titleEn?: string; // default "Delivery Note / Statement of Delivered Works"
  customer: DeliveryCustomer; // rendered as "Customer / 納品先"
  vehicle: DeliveryVehicle; // "Vehicle / 納品対象車両"
  items: DeliveryItem[]; // delivered items (applied pricing only)
  summary: DeliverySummaryData; // subtotal / discount / tax / grand total (Delivered Total)
  aftercareNotes: string[]; // 納品後のお取り扱い
  receiptText?: string; // acknowledgement statement above the signature line
}
