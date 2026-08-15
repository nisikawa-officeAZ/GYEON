// CertificateCareSection — concept-b `.care-grid` (two equal columns: Care Instructions · From GYEON,
// or From GYEON · Recommendation on CanCoat) followed by the `.privacy` notice.
//
// The privacy notice is the only fixed legal sentence on the page and is passed in as data so the
// wording stays with the certificate contract rather than the component.

import { View } from "@react-pdf/renderer";
import { Row } from "../../primitives";
import { Text } from "../../primitives/pdf-text";
import { COLOR, FS, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import { CertificateSectionLabel } from "./CertificateHeader";
import type { TermsBlock } from "./certificate-data";
import { scaled, type CertificateScale } from "./certificate-scale";

export function CertificateCareSection({
  care,
  privacyNotice,
  accent,
  scale = 1,
}: {
  care: TermsBlock[];
  privacyNotice: string;
  accent: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  return (
    <View>
      <Row gap={u(15)} style={{ marginBottom: u(6), alignItems: "flex-start" }}>
        {care.map((block, i) => (
          <View key={i} style={{ flex: 1 }}>
            <CertificateSectionLabel en={block.labelEn} ja={block.labelJa} accent={accent} scale={scale} />
            {block.paragraphs?.map((p, j) => (
              <Text
                key={j}
                hyphenationPenalty={HYPHEN_PENALTY}
                style={{ fontFamily: FONT.sans, fontSize: u(FS.fs10), color: COLOR.text, lineHeight: 1.6 }}
              >
                {p}
              </Text>
            ))}
          </View>
        ))}
      </Row>

      {/* `.privacy` — grey panel with a muted left bar. */}
      <View
        style={{
          backgroundColor: COLOR.gray50,
          borderLeftWidth: 1.5, // 2px
          borderLeftColor: COLOR.textMuted,
          borderLeftStyle: "solid",
          paddingVertical: u(5), // 8px, tightened to fit A4
          paddingHorizontal: u(9), // 12px
          marginBottom: u(6),
        }}
      >
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{
            fontFamily: FONT.sansBold,
            fontSize: u(6.375),
            letterSpacing: u(1.15), // 0.18em
            textTransform: "uppercase",
            color: COLOR.textMuted,
            lineHeight: LH.snug,
            marginBottom: u(2.25),
          }}
        >
          Privacy Notice — 個人情報の利用目的
        </Text>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{ fontFamily: FONT.sans, fontSize: u(6.375), color: COLOR.textMuted, lineHeight: 1.55 }}
        >
          {privacyNotice}
        </Text>
      </View>
    </View>
  );
}
