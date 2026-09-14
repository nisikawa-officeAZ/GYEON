// The ONE issued-invoice → DeliveryNoteDocumentData adapter (TEMPLATE-C2-DN, date source R1).
//
// The delivery note is a monetary document whose SOLE authoritative source is an already-issued
// invoice: its immutable line items and persisted subtotal/discount/tax/total are read exactly as
// issued — never recomputed and never sourced from the estimate. The delivery DATE comes only from
// the invoice's persisted `delivery_date` (納品日, required before issuance); the delivery NUMBER is
// derived deterministically from the invoice number (INV → DLV, serial preserved).
//
// `internal_memo` is unreachable: it is neither read nor representable here. Missing optional fields
// are omitted, never invented.

import type { InvoiceDB, InvoiceItemDB } from "@/lib/invoices/invoice-types";
import { isValidCalendarDate } from "@/lib/invoices/invoice-delivery-date";
import { formatDocumentSerial } from "./document-serial";
import type { PartyKind } from "@/components/documents/types";

/** Stored category key → the tag printed in the table. One explicit map; never fuzzy-matched. */
const CATEGORY_TAG: Record<string, string> = {
  coating: "Coating",
  ppf: "PPF",
  window: "Window",
  interior: "Interior",
  glass: "Glass",
  other: "Other",
};

export interface DeliveryNoteDocumentItem {
  category?: string;
  name: string;
  description?: string;
  unitPrice?: number | null;
  quantity?: number;
  discount?: number | null;
  amount?: number | null;
}

export interface DeliveryNoteDocumentData {
  serial: string;
  issueDate?: string;
  deliveryDate: string;
  customer: {
    name: string;
    kind: PartyKind;
    postalCode?: string;
    address?: string;
    tel?: string;
    email?: string;
  };
  vehicle: {
    name?: string;
    maker?: string;
    year?: string;
    grade?: string;
    plate?: string;
    color?: string;
    mileage?: string;
  };
  items: DeliveryNoteDocumentItem[];
  summary: {
    subtotal: number;
    discount: number;
    taxRatePercent: number;
    tax: number;
    grandTotal: number;
  };
  notes: string[];
}

/**
 * The two stored invoice-number shapes a delivery note may be derived from:
 *   current — `INV-NNNNN`      (the "never"-reset numbering default)
 *   legacy  — `INV-YYYY-NNNNN` (historical yearly-reset rows)
 * The delivery note reuses the SAME serial with the leading document prefix swapped to DLV; the
 * year segment is preserved when stored and NEVER invented when absent. Anything else — absent, a
 * fallback `INV-<id8>`, monthly `INV-YYYY-MM-NNNNN`, foreign, lowercase, already-DLV, estimate, or
 * hostile input — is rejected (returns null), so a delivery number is never invented.
 */
const CURRENT_INVOICE_NUMBER = /^INV-(\d{5})$/;
const LEGACY_INVOICE_NUMBER = /^INV-(\d{4})-(\d{5})$/;

export function deliveryNumberFromInvoiceNumber(invoiceNumber: string | null | undefined): string | null {
  if (typeof invoiceNumber !== "string") return null;
  const n = invoiceNumber.trim();
  const current = CURRENT_INVOICE_NUMBER.exec(n);
  if (current) return `DLV-${current[1]}`;
  const legacy = LEGACY_INVOICE_NUMBER.exec(n);
  if (legacy) return `DLV-${legacy[1]}-${legacy[2]}`;
  return null;
}

function text(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

function partyKind(isBusiness: boolean | null | undefined): PartyKind {
  return isBusiness ? "corporation" : "individual";
}

function lineDiscount(item: InvoiceItemDB): number | null {
  const gross = item.unit_price * item.quantity;
  const applied = gross - item.line_total;
  return applied > 0 ? applied : null;
}

function toItem(item: InvoiceItemDB): DeliveryNoteDocumentItem {
  return {
    category: CATEGORY_TAG[item.category] ?? "Other",
    name: item.item_name,
    description: text(item.description),
    unitPrice: item.unit_price,
    quantity: item.quantity,
    discount: lineDiscount(item),
    amount: item.line_total,
  };
}

/**
 * Build the delivery-note document data from an ISSUED invoice.
 *
 * @param invoice     the issued invoice (RLS-scoped, status/number/date already gated)
 * @param deliveryDate the invoice's persisted delivery_date (strict YYYY-MM-DD)
 * @throws if the delivery number cannot be derived or the delivery date is not a valid calendar
 *         date — this adapter never fabricates either value.
 */
export function toDeliveryNoteDocumentData(invoice: InvoiceDB, deliveryDate: string): DeliveryNoteDocumentData {
  const deliveryNumber = deliveryNumberFromInvoiceNumber(invoice.invoice_number);
  if (!deliveryNumber) {
    throw new Error("delivery-note-document-data: unsupported invoice number shape");
  }
  const date = (deliveryDate ?? "").trim();
  if (!isValidCalendarDate(date)) {
    throw new Error("delivery-note-document-data: a valid delivery date is required");
  }

  const c = invoice.customers ?? null;
  const v = invoice.vehicles ?? null;
  const items = [...(invoice.invoice_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return {
    serial: formatDocumentSerial(deliveryNumber),
    issueDate: text(invoice.issue_date),
    deliveryDate: date,

    customer: {
      name: c ? [c.last_name, c.first_name].filter(Boolean).join(" ").trim() : "",
      kind: partyKind(c?.is_business),
      postalCode: text(c?.postal_code),
      address: text(c?.address1),
      tel: text(c?.phone),
      email: text(c?.email),
    },

    vehicle: {
      name: v ? text([v.maker, v.model].filter(Boolean).join(" ")) : undefined,
      maker: text(v?.maker),
      year: text(v?.year),
      grade: text(v?.grade),
      plate: text(v?.plate_number),
      color: text(v?.color),
      mileage: v?.mileage != null ? `${v.mileage.toLocaleString("ja-JP")} km` : undefined,
    },

    items: items.map(toItem),

    // The immutable issued totals — read, never recomputed, never estimate-sourced.
    summary: {
      subtotal: invoice.subtotal,
      discount: invoice.discount_amount,
      taxRatePercent: invoice.tax_rate,
      tax: invoice.tax_amount,
      grandTotal: invoice.total,
    },

    notes: (invoice.notes ?? "")
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean),
  };
}
