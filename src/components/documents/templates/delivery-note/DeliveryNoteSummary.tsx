// DeliveryNoteSummary — reuses the shared SummaryPanel. Grand total reads "納品金額 (税込) /
// Delivered Total". Applied values only — no recalculation.

import { SummaryPanel } from "../../components";
import type { DocumentSummary, SummaryLine } from "../../types";
import type { DeliverySummaryData } from "./delivery-note-data";

export function DeliveryNoteSummary({ summary, accent }: { summary: DeliverySummaryData; accent: string }) {
  const lines: SummaryLine[] = [
    { label: "小計 / Subtotal", amount: summary.subtotal },
    ...(summary.discount ? [{ label: "値引き / Discount", amount: summary.discount, tone: "danger" as const }] : []),
    { label: `消費税 / Tax ${summary.taxRatePercent}%`, amount: summary.tax },
  ];
  const doc: DocumentSummary = { lines, grandTotalLabel: "納品金額 (税込)", grandTotal: summary.grandTotal };
  return <SummaryPanel summary={doc} accent={accent} />;
}
