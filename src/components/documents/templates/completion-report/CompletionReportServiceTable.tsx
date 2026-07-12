// CompletionReportServiceTable — concept-b "05 Completed Works 完了施工項目" list.
// NON-monetary: Category | Item & Description only. No unit price / qty / discount / subtotal.
// Renders stored completed-work items — nothing is priced or recalculated.

import { View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { Row, Stack, Overline, Value, Caption } from "../../primitives";
import { COLOR, BW, FS, TRACK, RADIUS } from "../../tokens";
import type { CompletedWorkItem } from "./completion-report-data";

const COL = {
  no: { width: 20, textAlign: "center" as const } as Style,
  category: { width: 56 } as Style,
  item: { flex: 1, paddingRight: 6 } as Style,
};

function CategoryTag({ label, accent }: { label: string; accent: string }) {
  return (
    <View style={{ alignSelf: "flex-start", borderWidth: BW.hair, borderColor: accent, borderStyle: "solid", borderRadius: RADIUS.sm, paddingVertical: 1, paddingHorizontal: 4 }}>
      <Caption style={{ fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase", color: accent }}>{label}</Caption>
    </View>
  );
}

export function CompletionReportServiceTable({ works, accent }: { works: CompletedWorkItem[]; accent: string }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Row gap={6} style={{ alignItems: "center", marginBottom: 4 }}>
        <Value style={{ fontSize: FS.fs14, color: accent }}>05</Value>
        <Overline>Completed Works</Overline>
        <Caption style={{ fontSize: FS.fs10 }}>完了施工項目</Caption>
        <View style={{ flex: 1 }} />
        <Caption style={{ fontSize: FS.fs9 }}>{works.length} items</Caption>
      </Row>

      <Row fixed style={{ backgroundColor: COLOR.gray50, paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: BW.thin, borderBottomColor: COLOR.lineStrong, borderBottomStyle: "solid" }}>
        <Overline style={[COL.no, { letterSpacing: TRACK.wide }]}>No.</Overline>
        <Overline style={[COL.category, { letterSpacing: TRACK.wide }]}>Category</Overline>
        <Overline style={[COL.item, { letterSpacing: TRACK.wide }]}>Item &amp; Description</Overline>
      </Row>

      {works.map((w, i) => (
        <View key={i} wrap={false} style={{ flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 6, borderBottomWidth: BW.hair, borderBottomColor: COLOR.lineHair, borderBottomStyle: "solid", alignItems: "flex-start" }}>
          <Caption style={[COL.no, { fontSize: FS.fs10, color: COLOR.textMuted }]}>{String(i + 1).padStart(2, "0")}</Caption>
          <View style={COL.category}>{w.category ? <CategoryTag label={w.category} accent={accent} /> : null}</View>
          <Stack style={COL.item} gap={0}>
            <Value style={{ fontSize: FS.fs12, lineHeight: 1.2 }}>{w.name}</Value>
            {w.description ? <Caption style={{ fontSize: FS.fs9, lineHeight: 1.15 }}>{w.description}</Caption> : null}
          </Stack>
        </View>
      ))}
    </View>
  );
}
