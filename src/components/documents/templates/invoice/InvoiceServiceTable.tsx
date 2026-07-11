// InvoiceServiceTable — concept-b "Billed Items" 6-column table:
// Category | Item & Description | Unit Price | Qty | Discount | Subtotal. Same structure as the
// Estimate table (built from shared primitives) with the invoice heading. Renders APPLIED pricing
// only — no recalculation; em-dash for no discount.

import { View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { Row, Stack, Overline, Value, Price, Caption } from "../../primitives";
import { COLOR, BW, FS, TRACK, RADIUS } from "../../tokens";
import { formatYen } from "../../brand";
import type { InvoiceItem } from "./invoice-data";

const COL = {
  category: { width: 50 } as Style,
  item: { flex: 1, paddingRight: 6 } as Style,
  unit: { width: 58, textAlign: "right" as const } as Style,
  qty: { width: 26, textAlign: "center" as const } as Style,
  discount: { width: 52, textAlign: "right" as const } as Style,
  subtotal: { width: 68, textAlign: "right" as const } as Style,
};

function CategoryTag({ label, accent }: { label: string; accent: string }) {
  return (
    <View style={{ alignSelf: "flex-start", borderWidth: BW.hair, borderColor: accent, borderStyle: "solid", borderRadius: RADIUS.sm, paddingVertical: 1, paddingHorizontal: 4 }}>
      <Caption style={{ fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase", color: accent }}>{label}</Caption>
    </View>
  );
}

export function InvoiceServiceTable({ items, accent }: { items: InvoiceItem[]; accent: string }) {
  return (
    <View style={{ marginBottom: 5 }}>
      <Row gap={6} style={{ alignItems: "center", marginBottom: 4 }}>
        <Value style={{ fontSize: FS.fs14, color: accent }}>04</Value>
        <Overline>Billed Items</Overline>
        <Caption style={{ fontSize: FS.fs10 }}>請求項目</Caption>
        <View style={{ flex: 1 }} />
        <Caption style={{ fontSize: FS.fs9 }}>{items.length} items</Caption>
      </Row>

      <Row style={{ backgroundColor: COLOR.gray50, paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: BW.thin, borderBottomColor: COLOR.lineStrong, borderBottomStyle: "solid" }}>
        <Overline style={[COL.category, { letterSpacing: TRACK.wide }]}>Category</Overline>
        <Overline style={[COL.item, { letterSpacing: TRACK.wide }]}>Item &amp; Description</Overline>
        <Overline style={[COL.unit, { letterSpacing: TRACK.wide }]}>Unit</Overline>
        <Overline style={[COL.qty, { letterSpacing: TRACK.wide }]}>Qty</Overline>
        <Overline style={[COL.discount, { letterSpacing: TRACK.wide }]}>Disc.</Overline>
        <Overline style={[COL.subtotal, { letterSpacing: TRACK.wide }]}>Subtotal</Overline>
      </Row>

      {items.map((it, i) => (
        <View key={i} wrap={false} style={{ flexDirection: "row", paddingVertical: 2, paddingHorizontal: 6, borderBottomWidth: BW.hair, borderBottomColor: COLOR.lineHair, borderBottomStyle: "solid", alignItems: "flex-start" }}>
          <View style={COL.category}>{it.category ? <CategoryTag label={it.category} accent={accent} /> : null}</View>
          <Stack style={COL.item} gap={0}>
            <Value style={{ fontSize: FS.fs12, lineHeight: 1.2 }}>{it.name}</Value>
            {it.description ? <Caption style={{ fontSize: FS.fs9, lineHeight: 1.15 }}>{it.description}</Caption> : null}
          </Stack>
          <Price style={COL.unit}>{it.unitPrice != null ? formatYen(it.unitPrice) : "—"}</Price>
          <Value style={COL.qty}>{it.quantity != null ? String(it.quantity) : ""}</Value>
          <Value style={[COL.discount, { color: it.discount ? COLOR.danger : COLOR.textFaint }]}>
            {it.discount ? `− ${formatYen(it.discount)}` : "—"}
          </Value>
          <Price style={COL.subtotal}>{it.amount != null ? formatYen(it.amount) : "—"}</Price>
        </View>
      ))}
    </View>
  );
}
