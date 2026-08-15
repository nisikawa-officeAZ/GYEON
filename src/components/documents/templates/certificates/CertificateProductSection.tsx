// CertificateProductSection — concept-b `.coating-table` / `.film-table` (one component: the two are
// the same table with different column headings and row semantics) plus the PPF-only
// `.film-warranty` panel.
//
// Every row is supplied by the adapter. The table never derives a category from a product name and
// never infers which areas were installed — `tag`, `name`, and `appliedTo` are typed input.

import { View } from "@react-pdf/renderer";
import { Row, Stack, Caption } from "../../primitives";
import { Text } from "../../primitives/pdf-text";
import { COLOR, BW, FS, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import { CertificateSectionLabel } from "./CertificateHeader";
import type { AppliedProductRow, CertificateDocumentData, FilmWarrantyItem } from "./certificate-data";
import { scaled, type CertificateScale } from "./certificate-scale";

const COL_TAG = { width: 82.5 }; // 110px
const COL_APPLIED = { width: 150 }; // 200px

function HeadCell({
  label,
  style,
  u,
}: {
  label: string;
  style?: { width?: number; flex?: number };
  u: (n: number) => number;
}) {
  return (
    <Text
      hyphenationPenalty={HYPHEN_PENALTY}
      style={{
        ...style,
        fontFamily: FONT.sansBold,
        fontSize: u(6.375), // 8.5px
        letterSpacing: u(1.02), // 0.16em
        textTransform: "uppercase",
        color: COLOR.textMuted,
        lineHeight: LH.snug,
      }}
    >
      {label}
    </Text>
  );
}

/** The navy chip in the leading column (Base / Top · Protect+ / Enhance / …). */
function ProductTag({ label, accent, u }: { label: string; accent: string; u: (n: number) => number }) {
  return (
    <View
      style={{ alignSelf: "flex-start", backgroundColor: accent, paddingVertical: u(1.5), paddingHorizontal: u(6) }}
    >
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          fontFamily: FONT.sansBold,
          fontSize: u(6.375),
          letterSpacing: u(0.89), // 0.14em
          color: COLOR.textInverse,
          lineHeight: 1.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProductRow({
  row,
  accent,
  last,
  u,
}: {
  row: AppliedProductRow;
  accent: string;
  last: boolean;
  u: (n: number) => number;
}) {
  return (
    <Row
      wrap={false}
      style={{
        paddingVertical: u(4.5), // 8px, tightened to fit A4
        alignItems: "center",
        ...(last
          ? {}
          : { borderBottomWidth: BW.hair, borderBottomColor: COLOR.line, borderBottomStyle: "solid" as const }),
      }}
    >
      <View style={{ width: u(COL_TAG.width) }}>
        <ProductTag label={row.tag} accent={accent} u={u} />
      </View>
      <Stack gap={u(0.75)} style={{ flex: 1, paddingRight: u(8) }}>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{ fontFamily: FONT.sans, fontSize: u(8.25), color: COLOR.textStrong, lineHeight: LH.snug }}
        >
          {row.name}
        </Text>
        {row.description ? (
          <Caption style={{ fontSize: u(6.375), color: COLOR.textMuted }}>{row.description}</Caption>
        ) : null}
      </Stack>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          width: u(COL_APPLIED.width),
          fontFamily: FONT.num,
          fontSize: u(FS.fs10),
          letterSpacing: u(0.18),
          color: COLOR.text,
          lineHeight: LH.snug,
        }}
      >
        {row.appliedTo}
      </Text>
    </Row>
  );
}

export function CertificateProductSection({
  data,
  accent,
  scale = 1,
}: {
  data: CertificateDocumentData;
  accent: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  const cols = data.productColumns;
  return (
    <View style={{ marginBottom: u(7.5) }}>
      <CertificateSectionLabel en={data.productLabelEn} ja={data.productLabelJa} accent={accent} scale={scale} />
      <Row
        style={{
          paddingVertical: u(3.75), // 5px
          borderBottomWidth: BW.hair,
          borderBottomColor: COLOR.line,
          borderBottomStyle: "solid",
        }}
      >
        <HeadCell label={cols.tag} style={{ width: u(COL_TAG.width) }} u={u} />
        <HeadCell label={cols.name} style={{ flex: 1 }} u={u} />
        <HeadCell label={cols.appliedTo} style={{ width: u(COL_APPLIED.width) }} u={u} />
      </Row>
      {data.products.map((row, i) => (
        <ProductRow key={i} row={row} accent={accent} last={i === data.products.length - 1} u={u} />
      ))}
    </View>
  );
}

// ── PPF only ─────────────────────────────────────────────────────────────────

function FilmWarrantyRow({
  item,
  accent,
  u,
}: {
  item: FilmWarrantyItem;
  accent: string;
  u: (n: number) => number;
}) {
  return (
    <Row gap={u(7.5)} style={{ width: "50%", alignItems: "flex-end", paddingRight: u(15), marginBottom: u(4) }}>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          width: u(81), // 108px
          fontFamily: FONT.sansBold,
          fontSize: u(FS.fs10),
          letterSpacing: u(0.18),
          color: accent,
          lineHeight: 1.5,
        }}
      >
        {item.product}
      </Text>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ flex: 1, fontFamily: FONT.sans, fontSize: u(7.875), color: COLOR.textStrong, lineHeight: 1.5 }}
      >
        {item.coverage}
      </Text>
    </Row>
  );
}

/**
 * concept-b `.film-warranty` — the PPF-only panel that lists exactly which films carry a
 * discoloration warranty, and states which products carry none. Both lists are supplied; the
 * certificate does not decide eligibility.
 */
export function FilmWarrantySection({
  warranty,
  accent,
  scale = 1,
}: {
  warranty: NonNullable<CertificateDocumentData["filmWarranty"]>;
  accent: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  return (
    <View
      style={{
        backgroundColor: COLOR.paper,
        borderWidth: BW.thin,
        borderColor: COLOR.line,
        borderStyle: "solid",
        borderLeftWidth: 2.25, // 3px
        borderLeftColor: accent,
        paddingVertical: u(7.5), // 12px, tightened to fit A4
        paddingHorizontal: u(12), // 16px
        marginBottom: u(7.5),
      }}
    >
      <Row
        style={{
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingBottom: u(4.5),
          marginBottom: u(6),
          borderBottomWidth: BW.hair,
          borderBottomColor: COLOR.line,
          borderBottomStyle: "solid",
        }}
      >
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{
            fontFamily: FONT.sansBold,
            fontSize: u(7.875),
            letterSpacing: u(1.35),
            textTransform: "uppercase",
            color: accent,
            lineHeight: LH.snug,
          }}
        >
          {warranty.titleEn}
        </Text>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{ fontFamily: FONT.sans, fontSize: u(7.875), letterSpacing: u(0.63), color: COLOR.text, lineHeight: LH.snug }}
        >
          {warranty.titleJa}
        </Text>
      </Row>

      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ fontFamily: FONT.sans, fontSize: u(7.125), color: COLOR.textMuted, lineHeight: 1.55, marginBottom: u(6) }}
      >
        {warranty.intro}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {warranty.items.map((item, i) => (
          <FilmWarrantyRow key={i} item={item} accent={accent} u={u} />
        ))}
      </View>

      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ fontFamily: FONT.sans, fontSize: u(7.125), color: COLOR.textMuted, lineHeight: 1.55 }}
      >
        {warranty.note}
      </Text>
    </View>
  );
}
