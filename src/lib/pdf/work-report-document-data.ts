// The ONE Work Report source → WorkReportDocumentData adapter (TEMPLATE-C2-WR).
//
// The Work Report (作業内容書) is STRUCTURALLY monetary-free: neither this module, its input
// projection, nor its output can carry a price, quantity, discount, tax, total, cost, or margin.
// Completed-work rows expose ONLY category / name / description; there is no summary and no grand
// total. This is enforced by the type shapes below (there is nowhere to put a monetary field) and
// by the boundary test that greps the whole chain.
//
// `internal_memo` is unreachable: it is neither in the input projection nor representable in the
// output. Missing optional fields are omitted, never invented.

import { formatDocumentSerial } from "./document-serial";
import type { PartyKind } from "@/components/documents/types";

/** Stored category key → the tag printed in the table. One explicit map; never fuzzy-matched. */
const CATEGORY_TAG: Record<string, string> = {
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

/**
 * The non-monetary work-report SOURCE projection. Every field here is deliberately non-monetary:
 * a completed-work row carries category / name / description / sort_order ONLY. The loader may
 * populate this projection only from non-monetary columns.
 */
export interface WorkReportSourceItem {
  category: string | null;
  item_name: string | null;
  description: string | null;
  sort_order: number | null;
}

export interface WorkReportSource {
  reportNumber: string;
  reportDate: string;
  workDate: string;
  customerMessage: string | null;
  customer: {
    last_name: string | null;
    first_name: string | null;
    postal_code: string | null;
    address1: string | null;
    phone: string | null;
    email: string | null;
    is_business: boolean | null;
  } | null;
  vehicle: {
    maker: string | null;
    model: string | null;
    year: string | null;
    grade: string | null;
    plate_number: string | null;
    color: string | null;
    mileage: number | null;
  } | null;
  items: WorkReportSourceItem[];
}

export interface WorkReportDocumentItem {
  category?: string;
  name: string;
  description?: string;
}

export interface WorkReportDocumentData {
  serial: string;
  issueDate: string; // completion_reports.report_date
  workDate: string; // work_orders.actual_end_at
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
  items: WorkReportDocumentItem[];
  notes: string[];
}

function text(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

function partyKind(isBusiness: boolean | null | undefined): PartyKind {
  return isBusiness ? "corporation" : "individual";
}

function toItem(item: WorkReportSourceItem): WorkReportDocumentItem {
  return {
    category: item.category ? CATEGORY_TAG[item.category] ?? "Other" : "Other",
    name: item.item_name ?? "",
    description: text(item.description),
  };
}

/**
 * Build the work-report document data from the non-monetary source projection.
 * @throws if the report number or either required date is empty — never fabricated.
 */
export function toWorkReportDocumentData(source: WorkReportSource): WorkReportDocumentData {
  const reportNumber = (source.reportNumber ?? "").trim();
  if (!reportNumber) throw new Error("work-report-document-data: report number is required");
  const reportDate = (source.reportDate ?? "").trim();
  if (!reportDate) throw new Error("work-report-document-data: report date is required");
  const workDate = (source.workDate ?? "").trim();
  if (!workDate) throw new Error("work-report-document-data: work date is required");

  const c = source.customer ?? null;
  const v = source.vehicle ?? null;
  const items = [...(source.items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return {
    serial: formatDocumentSerial(reportNumber),
    issueDate: reportDate,
    workDate,

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

    // Optional customer-facing note only. internal_memo is never read.
    notes: (source.customerMessage ?? "")
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean),
  };
}
