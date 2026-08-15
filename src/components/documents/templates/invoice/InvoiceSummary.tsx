// InvoiceSummary — reuses the shared SummaryPanel (navy Grand Total binding). Grand total reads
// "ご請求金額 (税込) / Amount Due". No recalculation — applied values only.

import { SummaryPanel } from "../../components";
import type { DocumentSummary, SummaryLine } from "../../types";
import type { InvoiceSummaryData } from "./invoice-data";

export function InvoiceSummary({ summary, accent }: { summary: InvoiceSummaryData; accent: string }) {
  const lines: SummaryLine[] = [
    { label: "小計 / Subtotal", amount: summary.subtotal },
    ...(summary.discount ? [{ label: "値引き / Discount", amount: summary.discount, tone: "danger" as const }] : []),
    { label: `消費税 / Tax ${summary.taxRatePercent}%`, amount: summary.tax },
  ];
  const doc: DocumentSummary = { lines, grandTotalLabel: "ご請求金額 (税込)", grandTotal: summary.grandTotal };
  return <SummaryPanel summary={doc} accent={accent} />;
}
