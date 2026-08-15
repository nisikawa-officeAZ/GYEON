// CompletionReportSummary — NON-monetary work summary strip. Instead of the Estimate/Invoice's
// navy amount panel, the Completion Report closes with report stats: works completed / work time /
// inspection result / status. No amounts, no tax, no grand total. Values are stored Completion data.

import { View } from "@react-pdf/renderer";
import { Row, Stack, Overline, Value, Caption } from "../../primitives";
import { COLOR, BW, FS } from "../../tokens";
import type { CompletionReportDocumentData } from "./completion-report-data";

function Stat({ label, value, accent, last }: { label: string; value: string; accent: string; last?: boolean }) {
  return (
    <Stack
      gap={1}
      style={{
        flex: 1,
        paddingHorizontal: 10,
        borderRightWidth: last ? 0 : BW.hair,
        borderRightColor: COLOR.line,
        borderRightStyle: "solid",
      }}
    >
      <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>{label}</Overline>
      <Value style={{ fontSize: FS.fs14, color: accent }}>{value}</Value>
    </Stack>
  );
}

export function CompletionReportSummary({ data, accent }: { data: CompletionReportDocumentData; accent: string }) {
  const stats: { label: string; value: string }[] = [
    { label: "Completed Works", value: `${data.completedWorks.length} items` },
    ...(data.duration ? [{ label: "Work Time", value: data.duration }] : []),
    ...(data.inspectionSummary ? [{ label: "Inspection", value: data.inspectionSummary }] : []),
    { label: "Status", value: data.status ?? "Completed" },
  ];
  return (
    <View
      style={{
        borderWidth: BW.thin,
        borderColor: COLOR.lineStrong,
        borderStyle: "solid",
        paddingVertical: 7,
        marginBottom: 6,
      }}
      wrap={false}
    >
      <Row style={{ alignItems: "center" }}>
        {stats.map((s, i) => (
          <Stat key={i} label={s.label} value={s.value} accent={accent} last={i === stats.length - 1} />
        ))}
      </Row>
    </View>
  );
}
