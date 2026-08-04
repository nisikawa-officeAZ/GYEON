// The ONE InvoiceDB → InvoiceDocumentData adapter (TEMPLATE-B3).
//
// Everything the customer-facing invoice PDF shows comes from the invoice's PERSISTED, snapshot-
// validated issuance state. Nothing is recomputed: line amounts, the discount, the tax and the
// grand total are read exactly as validateIssuanceSnapshot accepted them, so the printed document
// is the issued document.
//
// `internal_memo` is deliberately unreachable: it is not read, and InvoiceDocumentData has no
// field that could carry it. The same is true of dealer cost and margin.
//
// Fields the dealer has not filled in are omitted, never invented — no placeholder address,
// no zero mileage, no fabricated dates.

import type { InvoiceDB, InvoiceItemDB } from "@/lib/invoices/invoice-types";
import { invoiceDisplayNo } from "@/lib/invoices/invoice-types";
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

export interface InvoiceDocumentItem {
  category?: string;
  name: string;
  description?: string;
  unitPrice?: number | null;
  quantity?: number;
  discount?: number | null;
  amount?: number | null;
}

export interface InvoiceDocumentData {
  serial: string;
  issueDate?: string;
  paymentDue?: string;
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
  items: InvoiceDocumentItem[];
  summary: {
    subtotal: number;
    discount: number;
    taxRatePercent: number;
    tax: number;
    grandTotal: number;
  };
  notes: string[];
}

function text(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

function partyKind(isBusiness: boolean | null | undefined): PartyKind {
  return isBusiness ? "corporation" : "individual";
}

/**
 * The line's discount as a monetary amount from the SAME persisted snapshot as the rest of the
 * line: stored gross (unit_price × quantity) minus stored line_total. Null (em-dash) when the
 * line carries no discount.
 */
function lineDiscount(item: InvoiceItemDB): number | null {
  const gross = item.unit_price * item.quantity;
  const applied = gross - item.line_total;
  return applied > 0 ? applied : null;
}

function toItem(item: InvoiceItemDB): InvoiceDocumentItem {
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

export function toInvoiceDocumentData(invoice: InvoiceDB): InvoiceDocumentData {
  const c = invoice.customers ?? null;
  const v = invoice.vehicles ?? null;

  // Persisted, stable order: sort_order ascending; ties keep the stored array order.
  const items = [...(invoice.invoice_items ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return {
    serial: formatDocumentSerial(invoiceDisplayNo(invoice)),
    issueDate: text(invoice.issue_date),
    paymentDue: text(invoice.due_date),

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

    // Every figure is the persisted, snapshot-validated issuance state.
    summary: {
      subtotal: invoice.subtotal,
      discount: invoice.discount_amount,
      taxRatePercent: invoice.tax_rate,
      tax: invoice.tax_amount,
      grandTotal: invoice.total,
    },

    // Customer-facing notes only. `internal_memo` is never read.
    notes: (invoice.notes ?? "")
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean),
  };
}
