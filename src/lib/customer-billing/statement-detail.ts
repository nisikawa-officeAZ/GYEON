// DealerOS — Statement detail model builder (Phase E8.4, pure — data prep only).
//
// Maps invoices (with joined vehicle + item categories) into statement detail
// rows. No PDF, no persistence. The representative service category is the
// primary line-item category by the canonical E7 ordering.

import { categoryRank } from "@/lib/estimates/category-order";

const STATEMENT_CATEGORY_LABEL: Record<string, string> = {
  coating:     "Coating",
  ppf:         "PPF",
  window:      "Window",
  maintenance: "Maintenance",
  carwash:     "Carwash",
  roomclean:   "RoomClean",
  interior:    "Interior",
  glass:       "Glass",
  other:       "Other",
};

interface VehicleRef { maker?: string | null; model?: string | null; plate_number?: string | null }

export interface StatementInvoiceRow {
  invoice_number?: string | null;
  issue_date?:     string | null;
  total?:          number | null;
  vehicles?:       VehicleRef | VehicleRef[] | null;
  invoice_items?:  { category?: string | null }[] | null;
}

export interface StatementDetailRow {
  issueDate:          string;
  vehicleName:        string;
  registrationNumber: string;
  serviceCategory:    string;
  invoiceNumber:      string;
  invoiceTotal:       number;
}

function primaryCategory(items?: { category?: string | null }[] | null): string {
  const cats = (items ?? []).map((i) => i?.category).filter((c): c is string => !!c);
  if (cats.length === 0) return "—";
  const primary = cats.slice().sort((a, b) => categoryRank(a) - categoryRank(b))[0];
  return STATEMENT_CATEGORY_LABEL[primary] ?? primary;
}

export function buildStatementDetail(invoices: readonly StatementInvoiceRow[]): StatementDetailRow[] {
  return (invoices ?? []).map((inv) => {
    const vraw = inv.vehicles;
    const v: VehicleRef | null = Array.isArray(vraw) ? (vraw[0] ?? null) : (vraw ?? null);
    return {
      issueDate:          inv.issue_date ?? "—",
      vehicleName:        [v?.maker, v?.model].filter(Boolean).join(" ") || "—",
      registrationNumber: v?.plate_number ?? "—",
      serviceCategory:    primaryCategory(inv.invoice_items),
      invoiceNumber:      inv.invoice_number ?? "—",
      invoiceTotal:       Number(inv.total) || 0,
    };
  });
}
