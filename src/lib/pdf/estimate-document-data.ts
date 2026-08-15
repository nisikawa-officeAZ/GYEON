// The ONE EstimateDB → EstimateDocumentData adapter.
//
// Everything the customer-facing PDF shows comes from the estimate's PERSISTED snapshot. Pricing is
// never recomputed here: the catalog may have moved since the estimate was saved, and a certificate
// of what we quoted must show what we quoted. So line amounts, the discount, the tax rate, and the
// grand total are read, not derived from the pricing engine.
//
// `internal_memo` is deliberately unreachable: it is not read, and `EstimateDocumentData` has no
// field that could carry it. The same is true of dealer cost and margin.
//
// Fields the dealer has not filled in are omitted, never invented — no zero mileage, no blank postal
// code, no placeholder address.

import type { EstimateDB, EstimateItemDB, EstimateStatus, EstimateCategory } from "@/lib/estimates/estimate-types";
import { estimateDisplayNo } from "@/lib/estimates/estimate-types";
import { sortByCategoryOrder } from "@/lib/estimates/category-order";
import { formatDocumentSerial } from "./document-serial";
import type { EstimateDocumentData, EstimateItem } from "@/components/documents/templates/estimate/estimate-data";
import type { PartyKind } from "@/components/documents/types";

/**
 * Stored workflow status → the chip printed on the PDF. Internal states are never shown raw: an
 * estimate the shop lost, or is invoicing, is not the customer's business, so those map to no chip
 * at all rather than leaking a pipeline stage onto a document we hand over.
 */
const STATUS_LABEL: Partial<Record<EstimateStatus, string>> = {
  draft: "Draft",
  proposal: "Sent",
  sent: "Sent",
  SENT: "Sent",
  DRAFT: "Draft",
  approved: "Approved",
  APPROVED: "Approved",
  accepted: "Approved",
};

/** Stored category key → the tag printed in the table. One explicit map; never fuzzy-matched. */
const CATEGORY_TAG: Record<EstimateCategory, string> = {
  coating: "Coating",
  ppf: "PPF",
  window: "Window",
  interior: "Interior",
  glass: "Glass",
  maintenance: "Care",
  carwash: "Wash",
  roomclean: "Interior",
  other: "Other",
};

function text(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

/** 法人 → 御中, 個人 → 様. Derived from the existing `customers.is_business` flag. */
function partyKind(isBusiness: boolean | null | undefined): PartyKind {
  return isBusiness ? "corporation" : "individual";
}

function customerName(c: NonNullable<EstimateDB["customers"]>): string {
  return [c.last_name, c.first_name].filter(Boolean).join(" ").trim();
}

function vehicleName(v: NonNullable<EstimateDB["vehicles"]>): string | undefined {
  return text([v.maker, v.model].filter(Boolean).join(" "));
}

/**
 * The line's discount as a monetary amount, taken from the SAME persisted snapshot as the rest of
 * the line. The DB stores a percentage (`discount_rate`), but the template prints money, so the
 * amount is the difference between the stored gross (unit_price × quantity) and the stored
 * `line_total` — both already written at save time. The pricing engine is not consulted.
 *
 * Returns null (rendered as an em-dash) when the line carries no discount, so an undiscounted line
 * never reads as "¥0 off".
 */
function lineDiscount(item: EstimateItemDB): number | null {
  const gross = item.unit_price * item.quantity;
  const applied = gross - item.line_total;
  return applied > 0 ? applied : null;
}

function toItem(item: EstimateItemDB): EstimateItem {
  return {
    category: CATEGORY_TAG[item.category],
    name: item.item_name,
    description: text(item.description),
    unitPrice: item.unit_price,
    quantity: item.quantity,
    discount: lineDiscount(item),
    amount: item.line_total,
  };
}

export function toEstimateDocumentData(estimate: EstimateDB): EstimateDocumentData {
  const c = estimate.customers ?? null;
  const v = estimate.vehicles ?? null;
  const items = sortByCategoryOrder(estimate.estimate_items ?? []);

  return {
    // The stored number is untouched; only its presentation changes.
    serial: formatDocumentSerial(estimateDisplayNo(estimate)),
    issueDate: estimate.created_at,
    validUntil: text(estimate.valid_until),
    status: STATUS_LABEL[estimate.status],

    customer: {
      name: c ? customerName(c) : "",
      kind: partyKind(c?.is_business),
      postalCode: text(c?.postal_code),
      address: text(c?.address1),
      tel: text(c?.phone),
      email: text(c?.email),
    },

    vehicle: {
      name: v ? vehicleName(v) : undefined,
      maker: text(v?.maker),
      year: text(v?.year),
      grade: text(v?.grade),
      plate: text(v?.plate_number),
      color: text(v?.color),
      // Mileage is only printed when it was actually recorded — 0 is not a reading.
      mileage: v?.mileage != null ? `${v.mileage.toLocaleString("ja-JP")} km` : undefined,
    },

    items: items.map(toItem),

    // Every figure is the persisted snapshot.
    summary: {
      subtotal: estimate.subtotal,
      discount: estimate.discount_amount,
      taxRatePercent: estimate.tax_rate,
      tax: estimate.tax_amount,
      grandTotal: estimate.total,
    },

    // Customer-facing notes only. `internal_memo` is never read.
    notes: (estimate.notes ?? "")
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean),
  };
}
