// CertificateTermsSection — concept-b `.infinity` / `.proof` callout + the `.terms-grid`
// (Coverage · Scope on the left, Exclusions / Handling Notice on the right, 1fr : 1.2fr).
//
// The callout is the one piece that differs in tone between the three certificates: navy reversal
// for Coating's Infinity Warranty, a grey panel with navy text for CanCoat's Proof of Installation,
// and none at all for PPF (whose warranty lives in its own Film Warranty panel). Which one appears
// — and every word in it — comes from the data, so the PDF asserts no warranty of its own.

import { View } from "@react-pdf/renderer";
import { Row, Stack } from "../../primitives";
import { Text } from "../../primitives/pdf-text";
import { COLOR, FS, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import { CertificateSectionLabel } from "./CertificateHeader";
import type { CertificateCallout, TermsBlock } from "./certificate-data";
import { scaled, type CertificateScale } from "./certificate-scale";

export function CertificateCalloutPanel({
  callout,
  accent,
  scale = 1,
}: {
  callout: CertificateCallout;
  accent: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  const navy = callout.tone === "navy";
  const bg = navy ? accent : COLOR.gray50;
  const fg = navy ? COLOR.textInverse : accent;
  const bodyColor = navy ? COLOR.textInverse : COLOR.text;

  return (
    <Row
      gap={u(15)}
      wrap={false}
      style={{
        backgroundColor: bg,
        paddingVertical: u(7.5), // 14px, tightened to fit A4
        paddingHorizontal: u(15), // 20px
        marginBottom: u(7.5),
        alignItems: "center",
      }}
    >
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ fontFamily: FONT.sans, fontSize: u(30), color: fg, lineHeight: 1 }}
      >
        {callout.mark}
      </Text>
      <Stack gap={u(2)} style={{ flex: 1 }}>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{
            fontFamily: FONT.sans,
            fontSize: u(6), // 8px
            letterSpacing: u(1.68), // 0.28em
            textTransform: "uppercase",
            color: navy ? COLOR.gray200 : COLOR.textMuted,
            lineHeight: LH.snug,
          }}
        >
          {callout.eyebrow}
        </Text>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{
            fontFamily: FONT.serif,
            fontSize: u(FS.fs16 + 3), // 20px
            letterSpacing: u(2.1), // 0.14em
            color: fg,
            lineHeight: LH.tight,
          }}
        >
          {callout.title}
        </Text>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{ fontFamily: FONT.sans, fontSize: u(7.125), color: bodyColor, lineHeight: 1.6 }}
        >
          {callout.body}
        </Text>
      </Stack>
    </Row>
  );
}

function Paragraph({ children, u }: { children: string; u: (n: number) => number }) {
  return (
    <Text
      hyphenationPenalty={HYPHEN_PENALTY}
      style={{ fontFamily: FONT.sans, fontSize: u(FS.fs10), color: COLOR.text, lineHeight: 1.6, marginBottom: u(4.5) }}
    >
      {children}
    </Text>
  );
}

/** Numbered item with a navy marker, matching `.terms-col ol li::marker`. */
function NumberedItem({
  index,
  children,
  accent,
  u,
}: {
  index: number;
  children: string;
  accent: string;
  u: (n: number) => number;
}) {
  return (
    <Row gap={u(4)} style={{ marginBottom: u(1.5) }}>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          width: u(12),
          fontFamily: FONT.sansBold,
          fontSize: u(7.125),
          color: accent,
          textAlign: "right",
          lineHeight: 1.55,
        }}
      >
        {index}.
      </Text>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ flex: 1, fontFamily: FONT.sans, fontSize: u(7.125), color: COLOR.text, lineHeight: 1.55 }}
      >
        {children}
      </Text>
    </Row>
  );
}

export function TermsColumn({
  blocks,
  accent,
  flex,
  scale = 1,
}: {
  blocks: TermsBlock[];
  accent: string;
  flex: number;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  return (
    <Stack style={{ flex }}>
      {blocks.map((block, b) => (
        <View key={b}>
          <CertificateSectionLabel
            en={block.labelEn}
            ja={block.labelJa}
            accent={accent}
            scale={scale}
            style={{ marginTop: b > 0 ? u(7.5) : 0, marginBottom: u(6) }}
          />
          {block.paragraphs?.map((p, i) => (
            <Paragraph key={i} u={u}>
              {p}
            </Paragraph>
          ))}
          {block.items?.map((item, i) => (
            <NumberedItem key={i} index={i + 1} accent={accent} u={u}>
              {item}
            </NumberedItem>
          ))}
        </View>
      ))}
    </Stack>
  );
}

/** `.terms-grid` — 1fr : 1.2fr, the wider right column carrying the numbered exclusions. */
export function CertificateTermsSection({
  left,
  right,
  accent,
  scale = 1,
}: {
  left: TermsBlock[];
  right: TermsBlock[];
  accent: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  return (
    <Row gap={u(15)} style={{ marginBottom: u(7.5), alignItems: "flex-start" }}>
      <TermsColumn blocks={left} accent={accent} flex={1} scale={scale} />
      <TermsColumn blocks={right} accent={accent} flex={1.2} scale={scale} />
    </Row>
  );
}
