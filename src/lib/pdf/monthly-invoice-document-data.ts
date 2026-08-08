// B1B-E2-R1 — the ONE issued-monthly-statement → MonthlyInvoiceDocumentData adapter, plus the
// pure Chromium injection-context builder for the monthly-invoice (月次請求書) template.
//
// SNAPSHOT-ONLY: everything printed comes from the issued monthly_statements row and the
// monthly_statement_lines / receipts / adjustments snapshots SUPPLIED by the caller. This module
// performs no I/O and can never reach live invoices, payments, customers or mutable totals — it
// imports no client, takes no ids, and returns only what the snapshots carry.
//
// FAIL-CLOSED: the accepted statement identities must re-prove here before anything renders —
// a statement that is not issued, a snapshot bundle whose rows belong to another statement or
// tenant, or totals that do not satisfy the accepted formulas refuse to produce document data.
//
// Fields the snapshots do not carry are omitted, never invented.

import type {
  MonthlyStatementDB,
  MonthlyStatementLineDB,
  MonthlyStatementReceiptDB,
  MonthlyStatementAdjustmentDB,
} from "@/lib/monthly-statements/monthly-statement-types";
import type { BrandProfile } from "@/components/documents/types";
import { formatDocumentSerial } from "./document-serial";
import {
  yen,
  formatDocDateDisplay,
  docNoDisplay,
  serialHashDisplay,
} from "./chromium-document/estimate-document-context";

const MINUS = "−"; // U+2212, matching the adopted design's negative amounts

/** The full snapshot bundle the caller already loaded for ONE issued statement. */
export interface MonthlyInvoiceSource {
  statement: MonthlyStatementDB;
  lines: MonthlyStatementLineDB[];
  receipts: MonthlyStatementReceiptDB[];
  adjustments: MonthlyStatementAdjustmentDB[];
}

export interface MonthlyInvoiceDocumentRow {
  deliveryDate: string;
  vehicleName?: string;
  vehiclePlate?: string;
  workDescription: string;
  invoiceNumber?: string;
  amount: number; // 税込 total_snapshot
}

export interface MonthlyInvoiceDocumentData {
  serial: string;
  issueDate?: string;
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  paymentDue?: string;
  customer: {
    name: string;
    postalCode?: string;
    address?: string;
    tel?: string;
    email?: string;
  };
  rows: MonthlyInvoiceDocumentRow[];
  summary: {
    openingBalance: number;
    currentSubtotal: number;
    currentDiscount: number;
    currentTax: number;
    currentTotal: number;
    paymentsReceivedTotal: number;
    allocatedPaymentsTotal: number;
    unappliedCreditTotal: number;
    adjustmentsTotal: number;
    closingBalance: number;
  };
}

function text(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : undefined;
}

/** Exact money comparison in cents — never float-drifted equality. */
function centsOf(n: number): number {
  return Math.round(n * 100);
}

function refuse(reason: string): never {
  throw new Error(`monthly-invoice-document: ${reason}`);
}

function snapshotText(snapshot: Record<string, unknown>, key: string): string | undefined {
  return text(snapshot?.[key]);
}

/** Stable, deterministic line order: persisted sort_order, then delivery_date, then id. */
function orderLines(lines: MonthlyStatementLineDB[]): MonthlyStatementLineDB[] {
  return [...lines].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      a.delivery_date.localeCompare(b.delivery_date) ||
      a.id.localeCompare(b.id),
  );
}

export function toMonthlyInvoiceDocumentData(source: MonthlyInvoiceSource): MonthlyInvoiceDocumentData {
  const st = source.statement;

  // ── identity refusal ──────────────────────────────────────────────────────
  if (st.status !== "issued") refuse("statement_not_issued");
  const serialSource = text(st.statement_number);
  if (!serialSource) refuse("statement_missing_number");
  for (const line of source.lines) {
    if (line.statement_id !== st.id || line.dealer_id !== st.dealer_id || line.customer_id !== st.customer_id) {
      refuse("line_identity_mismatch");
    }
  }
  for (const receipt of source.receipts) {
    if (receipt.statement_id !== st.id || receipt.dealer_id !== st.dealer_id || receipt.customer_id !== st.customer_id) {
      refuse("receipt_identity_mismatch");
    }
  }
  for (const adjustment of source.adjustments) {
    if (
      adjustment.statement_id !== st.id ||
      adjustment.dealer_id !== st.dealer_id ||
      adjustment.customer_id !== st.customer_id
    ) {
      refuse("adjustment_identity_mismatch");
    }
  }
  if (source.lines.length === 0) refuse("issued_statement_requires_lines");

  // ── formula refusal (the accepted B3 invariants, re-proven before rendering) ──
  const closingExpected =
    centsOf(st.opening_balance) + centsOf(st.current_total) - centsOf(st.payments_received_total) + centsOf(st.adjustments_total);
  if (centsOf(st.closing_balance) !== closingExpected) refuse("closing_balance_formula_mismatch");
  if (centsOf(st.payments_received_total) !== centsOf(st.allocated_payments_total) + centsOf(st.unapplied_credit_total)) {
    refuse("payments_reconciliation_mismatch");
  }
  const lineTotal = source.lines.reduce((sum, l) => sum + centsOf(l.total_snapshot), 0);
  if (lineTotal !== centsOf(st.current_total)) refuse("line_total_mismatch");
  const receiptTotal = source.receipts.reduce((sum, r) => sum + centsOf(r.amount_snapshot), 0);
  if (receiptTotal !== centsOf(st.payments_received_total)) refuse("receipt_total_mismatch");
  for (const receipt of source.receipts) {
    if (centsOf(receipt.amount_snapshot) !== centsOf(receipt.allocated_amount_snapshot) + centsOf(receipt.unapplied_amount_snapshot)) {
      refuse("receipt_reconciliation_mismatch");
    }
  }
  const adjustmentTotal = source.adjustments.reduce((sum, a) => sum + centsOf(a.signed_amount), 0);
  if (adjustmentTotal !== centsOf(st.adjustments_total)) refuse("adjustment_total_mismatch");

  // ── snapshot-only projection ──────────────────────────────────────────────
  const c = st.customer_snapshot ?? {};
  const customerName =
    snapshotText(c, "name") ??
    text([snapshotText(c, "last_name"), snapshotText(c, "first_name")].filter(Boolean).join(" ")) ??
    "";
  const customerAddress =
    snapshotText(c, "address") ??
    text(
      [snapshotText(c, "prefecture"), snapshotText(c, "city"), snapshotText(c, "address1"), snapshotText(c, "address2")]
        .filter(Boolean)
        .join(""),
    );

  const rows: MonthlyInvoiceDocumentRow[] = orderLines(source.lines).map((line) => {
    const v = line.vehicle_snapshot ?? {};
    return {
      deliveryDate: line.delivery_date,
      vehicleName: text([snapshotText(v, "maker"), snapshotText(v, "model")].filter(Boolean).join(" ")),
      vehiclePlate: snapshotText(v, "plate_number"),
      workDescription: text(line.work_description_snapshot) ?? "—",
      invoiceNumber: text(line.invoice_number),
      amount: line.total_snapshot,
    };
  });

  return {
    serial: formatDocumentSerial(serialSource),
    issueDate: text(st.issued_at),
    periodStart: st.period_start,
    periodEnd: st.period_end,
    closingDate: st.closing_date,
    paymentDue: text(st.payment_due_date),
    customer: {
      name: customerName,
      postalCode: snapshotText(c, "postal_code"),
      address: customerAddress,
      tel: snapshotText(c, "phone"),
      email: snapshotText(c, "email"),
    },
    rows,
    summary: {
      openingBalance: st.opening_balance,
      currentSubtotal: st.current_subtotal,
      currentDiscount: st.current_discount,
      currentTax: st.current_tax,
      currentTotal: st.current_total,
      paymentsReceivedTotal: st.payments_received_total,
      allocatedPaymentsTotal: st.allocated_payments_total,
      unappliedCreditTotal: st.unapplied_credit_total,
      adjustmentsTotal: st.adjustments_total,
      closingBalance: st.closing_balance,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chromium injection context — everything pre-formatted; the page scripts never calculate.
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyInvoiceChromiumContext {
  storeSettings: {
    brandId?: string;
    storeLogoSrc: string;
    companyName: string;
    postalCode?: string;
    address?: string;
    tel?: string;
    fax?: string;
    rank?: string;
    invoiceRegistrationNumber?: string;
  };
  documentData: {
    issueDateDisplay?: string;
    closingDateDisplay: string;
    paymentDueDisplay?: string;
    periodDisplay: string;
    docNoDisplay: string;
    serialHashDisplay: string;
    customer: {
      name: string;
      honorific: string;
      postalCode?: string;
      address?: string;
      tel?: string;
      email?: string;
    };
    rows: Array<{
      deliveryDateDisplay: string;
      vehicleName?: string;
      vehiclePlate?: string;
      workDescription: string;
      invoiceNoDisplay?: string;
      amountDisplay: string;
    }>;
    summary: {
      openingDisplay: string;
      subtotalDisplay: string;
      discountDisplay?: string;
      taxDisplay: string;
      currentTotalDisplay: string;
      paymentsReceivedDisplay?: string;
      adjustmentsDisplay?: string;
      closingDisplay: string;
    };
    notes: string[];
  };
}

const isDataUri = (v: string | undefined): v is string => typeof v === "string" && v.startsWith("data:");

/** Signed display: negatives use the design's U+2212; zero stays undefined (dash row). */
function signedYen(amount: number): string | undefined {
  if (centsOf(amount) === 0) return undefined;
  return amount < 0 ? `${MINUS}${yen(Math.abs(amount))}` : yen(amount);
}

/**
 * Required-value display (opening / closing balances): always rendered, and a negative balance
 * prints the design's U+2212 BEFORE the currency mark — −¥1,234,567, never ¥-1,234,567.
 * Positive stays ¥1,234,567; financial zero — including IEEE negative zero — is normalized to ¥0
 * first (JS: -0 < 0 is false, and (-0).toLocaleString would otherwise print "-0").
 * Monthly-local; the shared yen() is untouched.
 */
function requiredYen(amount: number): string {
  if (centsOf(amount) === 0) return yen(0);
  return amount < 0 ? `${MINUS}${yen(Math.abs(amount))}` : yen(amount);
}

export function buildMonthlyInvoiceChromiumContext(
  data: MonthlyInvoiceDocumentData,
  brand: BrandProfile,
  resolvedStoreLogoDataUri: string,
): MonthlyInvoiceChromiumContext {
  if (!isDataUri(resolvedStoreLogoDataUri)) {
    refuse("store logo must be an embedded data: URI");
  }

  const notes: string[] = [];
  notes.push(`対象期間: ${formatDocDateDisplay(data.periodStart)} 〜 ${formatDocDateDisplay(data.periodEnd)}`);
  if (data.paymentDue) notes.push(`お支払期日: ${formatDocDateDisplay(data.paymentDue)}`);

  return {
    storeSettings: {
      brandId: brand.brandId,
      storeLogoSrc: resolvedStoreLogoDataUri,
      companyName: brand.brandNameJa,
      postalCode: brand.contact.postalCode,
      address: brand.contact.address,
      tel: brand.contact.tel,
      fax: brand.contact.fax,
      rank: brand.business.shopRankLabel,
      invoiceRegistrationNumber: brand.business.invoiceRegistrationNumber,
    },

    documentData: {
      issueDateDisplay: data.issueDate ? formatDocDateDisplay(data.issueDate) : undefined,
      closingDateDisplay: formatDocDateDisplay(data.closingDate),
      paymentDueDisplay: data.paymentDue ? formatDocDateDisplay(data.paymentDue) : undefined,
      periodDisplay: `${formatDocDateDisplay(data.periodStart)} 〜 ${formatDocDateDisplay(data.periodEnd)}`,
      docNoDisplay: docNoDisplay(data.serial),
      serialHashDisplay: serialHashDisplay(data.serial),
      customer: {
        name: data.customer.name,
        // The snapshot deliberately carries no corporate/individual flag, so the universally
        // valid 様 is used rather than inventing corporate-ness for 御中.
        honorific: "様",
        postalCode: data.customer.postalCode,
        address: data.customer.address,
        tel: data.customer.tel,
        email: data.customer.email,
      },
      rows: data.rows.map((row) => ({
        deliveryDateDisplay: formatDocDateDisplay(row.deliveryDate),
        vehicleName: row.vehicleName,
        vehiclePlate: row.vehiclePlate,
        workDescription: row.workDescription,
        invoiceNoDisplay: row.invoiceNumber,
        amountDisplay: yen(row.amount),
      })),
      summary: {
        openingDisplay: requiredYen(data.summary.openingBalance),
        subtotalDisplay: yen(data.summary.currentSubtotal),
        discountDisplay:
          centsOf(data.summary.currentDiscount) > 0 ? `${MINUS}${yen(data.summary.currentDiscount)}` : undefined,
        taxDisplay: yen(data.summary.currentTax),
        currentTotalDisplay: yen(data.summary.currentTotal),
        paymentsReceivedDisplay:
          centsOf(data.summary.paymentsReceivedTotal) > 0
            ? `${MINUS}${yen(data.summary.paymentsReceivedTotal)}`
            : undefined,
        adjustmentsDisplay: signedYen(data.summary.adjustmentsTotal),
        closingDisplay: requiredYen(data.summary.closingBalance),
      },
      notes,
    },
  };
}
