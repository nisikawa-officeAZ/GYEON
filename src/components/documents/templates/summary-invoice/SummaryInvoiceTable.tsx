// SummaryInvoiceTable — concept-b "Included Invoices" list for ONE page-group (行前控除方式):
//   Date | Invoice No./Estimate | Vehicle·Customer | Work summary | Gross | Paid | Remaining |
//   Status | Included(Yes/No). Renders the section label, header, rows, the STORED page subtotal, and
//   (on the last page) the STORED grand total. No amount is computed here.

import { View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { Row, Stack, Overline, Caption, Value } from "../../primitives";
import { COLOR, BW, FS, TRACK, FONT, RADIUS, LH, HYPHEN_PENALTY } from "../../tokens";
import { formatYen, formatDocDate } from "../../brand";
import type { SummaryInvoicePage, SummaryInvoiceLine, SummaryInvoiceTotals, SummaryInvoiceStatus } from "./summary-invoice-data";
import { Text } from "../../primitives/pdf-text";

const COL = {
  date: { width: 40 } as Style,
  doc: { width: 62 } as Style,
  vehicle: { flex: 0.95, paddingRight: 4 } as Style,
  work: { flex: 1.15, paddingRight: 4 } as Style,
  gross: { width: 50, textAlign: "right" as const } as Style,
  paid: { width: 44, textAlign: "right" as const } as Style,
  remaining: { width: 46, textAlign: "right" as const } as Style,
  status: { width: 40, alignItems: "center" as const } as Style,
  included: { width: 24, alignItems: "center" as const } as Style,
};

const STATUS_LABEL: Record<SummaryInvoiceStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  partial: "Partial",
  excluded: "Excluded",
  void: "Void",
};

function statusColors(s: SummaryInvoiceStatus): { bg: string; fg: string; strike?: boolean } {
  switch (s) {
    case "paid": return { bg: "#e8f5ec", fg: COLOR.success };
    case "partial": return { bg: "#fff8e1", fg: COLOR.warning };
    case "unpaid": return { bg: "#fdecea", fg: COLOR.danger };
    case "excluded": return { bg: COLOR.gray100, fg: COLOR.textMuted };
    case "void": return { bg: COLOR.gray100, fg: COLOR.textFaint, strike: true };
  }
}

function StatusBadge({ status }: { status: SummaryInvoiceStatus }) {
  const c = statusColors(status);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: RADIUS.sm, paddingVertical: 1, paddingHorizontal: 4 }}>
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ fontFamily: FONT.sansBold, fontSize: FS.fs9, letterSpacing: TRACK.wide, color: c.fg, textDecoration: c.strike ? "line-through" : "none", lineHeight: LH.snug }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

function IncludedBadge({ included, accent }: { included: boolean; accent: string }) {
  return (
    <View style={{ backgroundColor: included ? accent : COLOR.gray100, borderRadius: RADIUS.sm, paddingVertical: 1, paddingHorizontal: 4, minWidth: 22, alignItems: "center" }}>
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ fontFamily: FONT.sansBold, fontSize: FS.fs9, letterSpacing: TRACK.wide, color: included ? COLOR.textInverse : COLOR.textMuted, lineHeight: LH.snug }}>
        {included ? "Yes" : "No"}
      </Text>
    </View>
  );
}

function Num({ children, style, tone, accent }: { children: string; style?: Style; tone?: "gross" | "muted" | "danger" | "default"; accent: string }) {
  const color =
    tone === "gross" ? accent : tone === "danger" ? COLOR.danger : tone === "muted" ? COLOR.textMuted : COLOR.textStrong;
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={[{ fontFamily: tone === "gross" ? FONT.sansBold : FONT.num, fontSize: FS.fs9, color, textAlign: "right", lineHeight: LH.snug }, style as Style]}>
      {children}
    </Text>
  );
}

function HeaderCell({ label, style, align }: { label: string; style: Style; align?: "right" | "center" }) {
  return (
    <Overline style={[{ fontSize: FS.fs9, letterSpacing: TRACK.wide, textAlign: align ?? "left" }, style]}>{label}</Overline>
  );
}

function TableHead() {
  return (
    <Row style={{ backgroundColor: COLOR.gray50, paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: BW.thin, borderBottomColor: COLOR.lineStrong, borderBottomStyle: "solid", alignItems: "center" }}>
      <HeaderCell label="Date" style={COL.date} />
      <HeaderCell label="Invoice / Est." style={COL.doc} />
      <HeaderCell label="Vehicle · Customer" style={COL.vehicle} />
      <HeaderCell label="Work Summary" style={COL.work} />
      <HeaderCell label="Gross" style={COL.gross} align="right" />
      <HeaderCell label="Paid" style={COL.paid} align="right" />
      <HeaderCell label="Remain" style={COL.remaining} align="right" />
      <HeaderCell label="Status" style={COL.status} align="center" />
      <HeaderCell label="請求" style={COL.included} align="center" />
    </Row>
  );
}

function InvoiceRow({ line, accent }: { line: SummaryInvoiceLine; accent: string }) {
  const dim = !line.included;
  return (
    <View
      wrap={false}
      style={{ flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 4, borderBottomWidth: BW.hair, borderBottomColor: COLOR.lineHair, borderBottomStyle: "solid", alignItems: "flex-start", backgroundColor: dim ? COLOR.gray50 : undefined }}
    >
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={[{ fontFamily: FONT.num, fontSize: FS.fs9, color: COLOR.textMuted, lineHeight: LH.snug }, COL.date]}>{formatDocDate(line.date)}</Text>
      <Stack style={COL.doc} gap={0}>
        <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ fontFamily: FONT.num, fontSize: FS.fs9, color: dim ? COLOR.textMuted : COLOR.textStrong, lineHeight: LH.snug }}>{line.invoiceNo}</Text>
        {line.estimateNo ? <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ fontFamily: FONT.num, fontSize: FS.fs9, color: COLOR.textFaint, lineHeight: LH.snug }}>{line.estimateNo}</Text> : null}
      </Stack>
      <Stack style={COL.vehicle} gap={0}>
        <Value style={{ fontSize: FS.fs9, lineHeight: 1.2, color: dim ? COLOR.textMuted : COLOR.textStrong }}>{line.vehicle}</Value>
        {line.customer ? <Caption style={{ fontSize: FS.fs9 }}>顧客: {line.customer}</Caption> : null}
      </Stack>
      <Stack style={COL.work} gap={0}>
        <Value style={{ fontSize: FS.fs9, lineHeight: 1.2, color: dim ? COLOR.textMuted : COLOR.textStrong }}>{line.workSummary}</Value>
        {line.reason ? <Caption style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>{line.reason}</Caption> : null}
      </Stack>
      <Num style={COL.gross} tone="gross" accent={accent}>{formatYen(line.gross)}</Num>
      <Num style={COL.paid} tone={line.paid ? "default" : "muted"} accent={accent}>{line.paid ? formatYen(line.paid) : "—"}</Num>
      <Num style={COL.remaining} tone={line.remaining ? "danger" : "muted"} accent={accent}>{line.remaining ? formatYen(line.remaining) : "¥ 0"}</Num>
      <View style={COL.status}><StatusBadge status={line.status} /></View>
      <View style={COL.included}><IncludedBadge included={line.included} accent={accent} /></View>
    </View>
  );
}

function TotalsRow({
  label,
  totals,
  strong,
  accent,
}: {
  label: string;
  totals: SummaryInvoiceTotals;
  strong?: boolean;
  accent: string;
}) {
  return (
    <Row
      style={{
        paddingVertical: 4,
        paddingHorizontal: 4,
        backgroundColor: COLOR.gray50,
        borderTopWidth: strong ? BW.medium : BW.thin,
        borderTopColor: accent,
        borderTopStyle: "solid",
        alignItems: "center",
      }}
    >
      <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ flex: 1, fontFamily: FONT.sansBold, fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase", textAlign: "right", color: COLOR.textMuted, paddingRight: 8, lineHeight: LH.snug }}>
        {label}
      </Text>
      <Num style={{ ...COL.gross, fontSize: FS.fs10 } as Style} tone="gross" accent={accent}>{formatYen(totals.gross)}</Num>
      <Num style={COL.paid} tone={totals.paid ? "default" : "muted"} accent={accent}>{totals.paid ? formatYen(totals.paid) : "¥ 0"}</Num>
      <Num style={COL.remaining} tone="default" accent={accent}>{formatYen(totals.remaining)}</Num>
      <View style={COL.status} />
      <View style={COL.included} />
    </Row>
  );
}

export function SummaryInvoiceTable({
  page,
  pageIndex,
  totalPages,
  totalCount,
  grandTotal,
  accent,
}: {
  page: SummaryInvoicePage;
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  grandTotal?: SummaryInvoiceTotals;
  accent: string;
}) {
  const n = page.invoices.length;
  return (
    <View style={{ marginBottom: 6 }}>
      {/* Section label */}
      <Row style={{ alignItems: "baseline", paddingBottom: 3, marginBottom: 4, borderBottomWidth: BW.medium, borderBottomColor: accent, borderBottomStyle: "solid" }}>
        <Overline style={{ fontSize: FS.fs10, color: accent, letterSpacing: TRACK.wider }}>
          Included Invoices — Page {pageIndex + 1} of {totalPages}
        </Overline>
        <Value style={{ fontSize: FS.fs10, marginLeft: 8, color: COLOR.text }}>対象請求書一覧{pageIndex > 0 ? "（続き）" : ""}</Value>
        <View style={{ flex: 1 }} />
        <Caption style={{ fontSize: FS.fs9 }}>{n} 件掲載 / 全 {totalCount} 件</Caption>
      </Row>

      <TableHead />
      {page.invoices.map((line, i) => (
        <InvoiceRow key={i} line={line} accent={accent} />
      ))}
      <TotalsRow label={`Subtotal — Page ${pageIndex + 1} (${n} invoices)`} totals={page.subtotal} accent={accent} />
      {grandTotal ? (
        <TotalsRow label={`Displayed Gross — All Listed Invoices (${totalCount} 件)`} totals={grandTotal} strong accent={accent} />
      ) : null}
    </View>
  );
}
