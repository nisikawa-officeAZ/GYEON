// EstimateSummary — reuses the shared SummaryPanel (navy Grand Total binding). No duplication.

import { SummaryPanel } from "../../components";
import type { DocumentSummary, SummaryLine } from "../../types";
import type { EstimateSummaryData } from "./estimate-data";

export function EstimateSummary({ summary, accent }: { summary: EstimateSummaryData; accent: string }) {
  const lines: SummaryLine[] = [
    { label: "小計 / Subtotal", amount: summary.subtotal },
    ...(summary.discount ? [{ label: "値引き / Discount", amount: summary.discount, tone: "danger" as const }] : []),
    { label: `消費税 / Tax ${summary.taxRatePercent}%`, amount: summary.tax },
  ];
  const doc: DocumentSummary = { lines, grandTotalLabel: "合計金額 (税込)", grandTotal: summary.grandTotal };
  return <SummaryPanel summary={doc} accent={accent} />;
}
