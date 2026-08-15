// Layer 3 — Item Table primitives + a generic ItemTable.
// Header: gray-50 fill, uppercase wide-tracked labels. Numeric columns right-aligned. Hairline rows.
// Unpriced lines (unitPrice/amount null) render an em-dash so nothing false-reads as free.

import { View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import { COLOR, BW, FS, TRACK } from "../tokens";
import { Overline, Value, Price, Caption } from "../primitives";
import { formatYen } from "../brand";
import type { ItemLine } from "../types";

// Column layout shared by header + body (label flexes; numeric columns fixed).
const COL = {
  label: { flex: 1 } as Style,
  qty: { width: 44, textAlign: "right" as const } as Style,
  unit: { width: 80, textAlign: "right" as const } as Style,
  amount: { width: 90, textAlign: "right" as const } as Style,
};

export function TableHeader({
  labels = { item: "項目", qty: "数量", unit: "単価", amount: "金額" },
}: {
  labels?: { item: string; qty: string; unit: string; amount: string };
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLOR.gray50,
        paddingVertical: 6,
        paddingHorizontal: 6,
        borderBottomWidth: BW.thin,
        borderBottomColor: COLOR.lineStrong,
        borderBottomStyle: "solid",
      }}
    >
      <Overline style={[COL.label, { letterSpacing: TRACK.wider }]}>{labels.item}</Overline>
      <Overline style={[COL.qty, { letterSpacing: TRACK.wide }]}>{labels.qty}</Overline>
      <Overline style={[COL.unit, { letterSpacing: TRACK.wide }]}>{labels.unit}</Overline>
      <Overline style={[COL.amount, { letterSpacing: TRACK.wide }]}>{labels.amount}</Overline>
    </View>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 6,
        paddingHorizontal: 6,
        borderBottomWidth: BW.hair,
        borderBottomColor: COLOR.lineHair,
        borderBottomStyle: "solid",
        alignItems: "flex-start",
      }}
      wrap={false}
    >
      {children}
    </View>
  );
}

export function ItemTable({ items }: { items: ItemLine[] }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <TableHeader />
      {items.map((it, i) => (
        <TableRow key={i}>
          <View style={COL.label}>
            <Value>{it.label}</Value>
            {it.category ? (
              <Caption style={{ fontSize: FS.fs9, letterSpacing: TRACK.wider, textTransform: "uppercase", color: COLOR.textMuted }}>
                {it.category}
              </Caption>
            ) : null}
            {it.note ? <Caption>{it.note}</Caption> : null}
          </View>
          <Value style={COL.qty}>{it.quantity != null ? String(it.quantity) : ""}</Value>
          <Price style={COL.unit}>{it.unitPrice != null ? formatYen(it.unitPrice) : "—"}</Price>
          <Price style={COL.amount}>{it.amount != null ? formatYen(it.amount) : "—"}</Price>
        </TableRow>
      ))}
    </View>
  );
}
