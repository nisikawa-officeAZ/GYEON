// DEALEROS-ESTIMATE-INVOICE-PDF-B1-R4 — issuance snapshot validator.
//
// Issuance turns a draft into a permanent commercial document. Before we render
// anything we must be sure the snapshot we are about to publish is internally
// consistent: that the stored totals really are the totals of the stored lines.
//
// Why this matters even with content_version: the marker proves the content did
// not CHANGE between render and transition. It cannot tell us the content was
// coherent in the first place — a torn write committed earlier, or a stored
// aggregate that drifted from its lines, would otherwise be frozen into the PDF
// and the issued row together.
//
// PURE AND IMPORT-SAFE except for the money rules, which are deliberately reused
// from invoice-types so there is exactly ONE rounding and tax policy in the
// system. No React, no Supabase, no environment, no network.

import { calculateInvoiceTotals, lineTotal } from "./invoice-types";

export type SnapshotRejection =
  | "invalid-number"
  | "line-total-mismatch"
  | "subtotal-mismatch"
  | "tax-amount-mismatch"
  | "total-mismatch"
  | "balance-due-mismatch"
  | "missing-items";

export type SnapshotValidation =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly reason: SnapshotRejection; readonly detail?: string };

export interface SnapshotItemInput {
  quantity?: unknown;
  unit_price?: unknown;
  discount_rate?: unknown;
  line_total?: unknown;
}

export interface SnapshotInvoiceInput {
  discount_amount?: unknown;
  tax_rate?: unknown;
  paid_amount?: unknown;
  subtotal?: unknown;
  tax_amount?: unknown;
  total?: unknown;
  balance_due?: unknown;
  invoice_items?: unknown;
}

/** Money must be a real finite number. NaN, Infinity, null and strings are not. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validate that the loaded invoice and its lines agree with each other, using
 * the SAME lineTotal and calculateInvoiceTotals rules the rest of the system
 * uses. A disagreement means the snapshot must not be published.
 */
export function validateIssuanceSnapshot(invoice: SnapshotInvoiceInput): SnapshotValidation {
  const invalid = (reason: SnapshotRejection, detail?: string): SnapshotValidation => ({
    kind: "invalid",
    reason,
    ...(detail ? { detail } : {}),
  });

  const items = invoice.invoice_items;
  if (!Array.isArray(items)) return invalid("missing-items");

  // Every monetary field on the parent must be a finite number.
  for (const field of [
    "discount_amount",
    "tax_rate",
    "paid_amount",
    "subtotal",
    "tax_amount",
    "total",
    "balance_due",
  ] as const) {
    if (!isFiniteNumber(invoice[field])) return invalid("invalid-number", field);
  }

  const normalised: { quantity: number; unit_price: number; discount_rate: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as SnapshotItemInput;

    for (const field of ["quantity", "unit_price", "discount_rate", "line_total"] as const) {
      if (!isFiniteNumber(item?.[field])) return invalid("invalid-number", `items[${i}].${field}`);
    }

    const quantity = item.quantity as number;
    const unitPrice = item.unit_price as number;
    const discountRate = item.discount_rate as number;

    // The stored line total must be the total the shared rule produces.
    const expected = lineTotal(quantity, unitPrice, discountRate);
    if ((item.line_total as number) !== expected) {
      return invalid("line-total-mismatch", `items[${i}]`);
    }

    normalised.push({ quantity, unit_price: unitPrice, discount_rate: discountRate });
  }

  const totals = calculateInvoiceTotals(
    normalised,
    invoice.discount_amount as number,
    invoice.tax_rate as number,
    invoice.paid_amount as number
  );

  if (totals.subtotal !== (invoice.subtotal as number)) return invalid("subtotal-mismatch");
  if (totals.tax_amount !== (invoice.tax_amount as number)) return invalid("tax-amount-mismatch");
  if (totals.total !== (invoice.total as number)) return invalid("total-mismatch");
  if (totals.balance_due !== (invoice.balance_due as number)) return invalid("balance-due-mismatch");

  return { kind: "valid" };
}
