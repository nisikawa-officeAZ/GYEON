// PHASE 12F — SummaryInvoiceTemplate dynamic-data contract (合計請求書 / Summary Invoice v3.0.1).
//
// The Summary Invoice is the monthly BUSINESS-customer consolidated statement. It aggregates the
// individual invoices issued within a billing period, applies the approved row-level deduction
// reconciliation (行前控除方式), and states one Current Amount Due. The PDF NEVER calculates: every
// subtotal, grand total, reconciliation line and the final due amount are STORED values supplied by
// the billing engine. All issuer identity comes from BrandProfile.
//
// Reconciliation formula (Architect Decision v3.0.1 — display only, values pre-computed):
//   Displayed Gross − Fully Paid − Partial Payments − Excluded − Void + Adjustment + Carried Forward
//   = Current Amount Due

import type { PartyKind } from "../../types";

/** Per-invoice payment state → status badge. */
export type SummaryInvoiceStatus = "paid" | "unpaid" | "partial" | "excluded" | "void";

/** One row in the Included Invoices list (all amounts are stored, tax-inclusive display values). */
export interface SummaryInvoiceLine {
  date: string; // 2026.07.03 (already formatted or ISO)
  invoiceNo: string; // INV/2026/00203
  estimateNo?: string; // EST/2026/00198 (sub-line)
  vehicle: string; // Alphard 30 系
  customer?: string; // 田中様 (rendered as 顧客: …)
  workSummary: string; // MOHS EVO Base + Top
  reason?: string; // italic note appended for void/excluded rows
  gross: number; // 税込 gross
  paid: number; // 入金済
  remaining: number; // 残額
  status: SummaryInvoiceStatus;
  included: boolean; // 今回請求対象 Yes/No
}

/** A page-group of invoices with its own stored page subtotal (drives deterministic pagination). */
export interface SummaryInvoicePage {
  invoices: SummaryInvoiceLine[];
  subtotal: SummaryInvoiceTotals; // stored page subtotal
}

export interface SummaryInvoiceTotals {
  gross: number;
  paid: number;
  remaining: number;
}

/** One line of the reconciliation ledger (A–G). `op` is the operator printed before the row. */
export interface ReconciliationLine {
  key: string; // "A" … "G"
  op?: "−" | "+"; // sign context (A has none)
  labelEn: string; // "Displayed Gross Total"
  labelJa: string; // "表示総額 (9 件)"
  amount: number; // signed display amount
  tone?: "default" | "danger"; // danger → red (deductions / adjustments)
}

export interface SummaryInvoiceCustomer {
  name: string; // 株式会社 藤田自動車工業
  kind: PartyKind; // corporation → 御中
  tradeName?: string; // 屋号: 藤田モータース守山店
  contactPerson?: string; // ご担当: 藤田 康介 様（部品仕入部）
  postalCode?: string;
  address?: string;
  tel?: string;
  customerCode?: string; // C-BIZ-00087
  closingDate?: string; // 締め日 毎月末日
  paymentTerms?: string; // 翌月末日振込 / Net 30
  dealClass?: string; // 掛売 · 業者
}

export interface SummaryInvoiceDocumentData {
  serial: string; // SIN/2026/00001
  issueDate: string; // 2026-08-01
  billingPeriodStart: string; // 2026-07-01
  billingPeriodEnd: string; // 2026-07-31
  closingLabel: string; // 毎月末日締め
  paymentDueDate: string; // 2026-08-31
  paymentMethod: string; // 銀行振込
  titleJa?: string; // default 合計請求書
  titleEn?: string; // default "Summary Invoice / Monthly Consolidated Billing"
  intro?: string; // aggregation notice paragraph
  customer: SummaryInvoiceCustomer;
  responsibleSalesPerson?: string; // 担当営業 (issuer side; falls back to brand.responsiblePerson)
  pages: SummaryInvoicePage[]; // pre-grouped for deterministic page subtotals
  grandTotal: SummaryInvoiceTotals; // Displayed Gross — All Listed Invoices
  totalCount: number; // 全 N 件
  reconciliation: ReconciliationLine[]; // A–G ledger
  currentAmountDue: number; // 今回請求額 (税込) — stored
  currentAmountDueNote?: string; // "Billing Target Total · 支払期限 …"
  traceability?: string[]; // 行レベル紐付け notes
  paymentNotice?: string[]; // お支払い上の注意
}
