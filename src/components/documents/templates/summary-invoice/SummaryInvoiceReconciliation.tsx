// SummaryInvoiceReconciliation — concept-b "請求額算出内訳 / Amount Due Reconciliation" (行前控除方式).
// Prints the STORED A–G ledger (operator · key · label · signed amount), the resulting Current Amount
// Due, and the row-level traceability notes. The PDF never computes — every amount is supplied.

import { View } from "@react-pdf/renderer";
import { Row, Stack, Overline, Caption, Value } from "../../primitives";
import { COLOR, BW, FS, TRACK, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import { formatYen } from "../../brand";
import type { ReconciliationLine } from "./summary-invoice-data";
import { Text } from "../../primitives/pdf-text";

function LedgerRow({ line, accent }: { line: ReconciliationLine; accent: string }) {
  const danger = line.tone === "danger";
  const amountText = line.amount < 0 ? `− ${formatYen(Math.abs(line.amount))}` : formatYen(line.amount);
  return (
    <Row style={{ alignItems: "center", paddingVertical: 1.5, borderBottomWidth: BW.hair, borderBottomColor: COLOR.lineHair, borderBottomStyle: "solid" }}>
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ width: 14, fontFamily: FONT.sansBold, fontSize: FS.fs11, color: COLOR.textMuted, textAlign: "center", lineHeight: LH.snug }}>{line.op ?? ""}</Text>
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ width: 14, fontFamily: FONT.sansBold, fontSize: FS.fs10, color: accent, lineHeight: LH.snug }}>{line.key}</Text>
      <Value style={{ flex: 1, fontSize: FS.fs10 }}>{line.labelEn}</Value>
      <Caption style={{ fontSize: FS.fs9, marginRight: 12, color: COLOR.textMuted }}>{line.labelJa}</Caption>
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ width: 84, fontFamily: FONT.num, fontSize: FS.fs11, textAlign: "right", color: danger ? COLOR.danger : COLOR.textStrong, lineHeight: LH.snug }}>
        {amountText}
      </Text>
    </Row>
  );
}

export function SummaryInvoiceReconciliation({
  lines,
  currentAmountDue,
  traceability,
  accent,
}: {
  lines: ReconciliationLine[];
  currentAmountDue: number;
  traceability?: string[];
  accent: string;
}) {
  return (
    <View
      wrap={false}
      style={{ borderWidth: BW.medium, borderColor: accent, borderStyle: "solid", padding: 7, marginBottom: 3 }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "baseline", paddingBottom: 4, marginBottom: 4, borderBottomWidth: BW.thin, borderBottomColor: COLOR.line, borderBottomStyle: "solid" }}>
        <Value style={{ fontSize: FS.fs12 }}>請求額算出内訳</Value>
        <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>Amount Due Reconciliation</Overline>
      </Row>

      {lines.map((line, i) => (
        <LedgerRow key={i} line={line} accent={accent} />
      ))}

      {/* = Current Amount Due */}
      <Row style={{ alignItems: "center", paddingTop: 5, marginTop: 1 }}>
        <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ width: 14, fontFamily: FONT.sansBold, fontSize: FS.fs12, color: accent, textAlign: "center", lineHeight: LH.snug }}>=</Text>
        <View style={{ width: 14 }} />
        <Value style={{ flex: 1, fontSize: FS.fs12, color: accent }}>Current Amount Due</Value>
        <Caption style={{ fontSize: FS.fs9, marginRight: 12, color: COLOR.textMuted }}>今回請求額</Caption>
        <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ width: 84, fontFamily: FONT.sansBold, fontSize: FS.fs16, textAlign: "right", color: accent, lineHeight: LH.snug }}>{formatYen(currentAmountDue)}</Text>
      </Row>

      {/* Row traceability */}
      {traceability && traceability.length ? (
        <View style={{ marginTop: 5, paddingTop: 4, borderTopWidth: BW.hair, borderTopColor: COLOR.line, borderTopStyle: "solid" }}>
          <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted, letterSpacing: TRACK.wide, marginBottom: 2 }}>Row Traceability · 行レベル紐付け</Overline>
          <Stack gap={0.5}>
            {traceability.map((t, i) => (
              <Caption key={i} style={{ fontSize: FS.fs9, lineHeight: 1.2, color: COLOR.textMuted }}>{t}</Caption>
            ))}
          </Stack>
        </View>
      ) : null}
    </View>
  );
}
