// Layer 3 — Summary Panel + Grand Total. Right-aligned summary lines (discounts in danger red),
// then the Grand Total block filled with brand-primary and inverse (white) text — LAYOUT BINDING
// (navy reversal is a fixed rule; do not restyle).

import { View } from "@react-pdf/renderer";
import { Row, Stack, Label, Price, PriceTotal } from "../primitives";
import { COLOR, BW, FS } from "../tokens";
import { formatYen } from "../brand";
import type { DocumentSummary } from "../types";

export function SummaryPanel({ summary, accent }: { summary: DocumentSummary; accent?: string }) {
  const primary = accent || COLOR.textStrong;
  return (
    <View style={{ marginBottom: 16, alignItems: "flex-end" }}>
      {/* Summary lines */}
      <Stack style={{ width: 260 }}>
        {summary.lines.map((ln, i) => (
          <Row
            key={i}
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 4,
              borderBottomWidth: BW.hair,
              borderBottomColor: COLOR.lineHair,
              borderBottomStyle: "solid",
            }}
          >
            <Label>{ln.label}</Label>
            <Price style={{ color: ln.tone === "danger" ? COLOR.danger : COLOR.textStrong }}>
              {ln.tone === "danger" && ln.amount > 0 ? `− ${formatYen(ln.amount)}` : formatYen(ln.amount)}
            </Price>
          </Row>
        ))}
      </Stack>

      {/* Grand Total — navy reversal (fixed) */}
      <Row
        style={{
          width: 260,
          marginTop: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: primary,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Label style={{ color: COLOR.textInverse, fontSize: FS.fs12 }}>{summary.grandTotalLabel}</Label>
        <PriceTotal style={{ color: COLOR.textInverse, fontSize: FS.fs22 }}>{formatYen(summary.grandTotal)}</PriceTotal>
      </Row>
    </View>
  );
}
