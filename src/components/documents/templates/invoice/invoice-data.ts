// PHASE 12C — InvoiceTemplate dynamic-data contract.
//
// Reuses the Estimate item/summary/vehicle/customer shapes (identical structure). Invoice-specific:
// payment due date, payment notes, Unpaid status. Bank account, seal, and the qualified-invoice
// registration number are injected from BrandProfile — nothing here hardcodes a tenant. Pricing is
// pre-computed (already stored in DealerOS); the template only renders, never recalculates.

import type {
  EstimateItem,
  EstimateSummaryData,
  EstimateVehicle,
  EstimateCustomer,
} from "../estimate/estimate-data";

export type InvoiceItem = EstimateItem;
export type InvoiceSummaryData = EstimateSummaryData;
export type InvoiceVehicle = EstimateVehicle;
export type InvoiceCustomer = EstimateCustomer;

export interface InvoiceDocumentData {
  serial: string; // e.g. "INV/2026/00087"
  issueDate: string;
  dueDate: string; // payment due date (NOT an estimate valid-until)
  status?: string; // e.g. "Unpaid ・ 未払い"
  titleJa?: string; // default 請求書
  titleEn?: string; // default "Invoice / Statement for Payment"
  customer: InvoiceCustomer; // rendered as "Bill To / ご請求先"
  vehicle: InvoiceVehicle;
  items: InvoiceItem[]; // billed items (applied pricing only)
  summary: InvoiceSummaryData; // subtotal / discount / tax / grand total (Amount Due)
  paymentNotes: string[]; // お支払いについて
}
