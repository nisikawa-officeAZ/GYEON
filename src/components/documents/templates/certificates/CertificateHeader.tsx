// CertificateHeader — concept-b `.m-head` + `.title-block` + `.title-block__intro`.
//   Masthead: GYEON wordmark + programme lockup (left) · serial + issue date (right), navy rule.
//   Title:    serif 和文タイトル (0.10em tracking) + right-aligned English subtitle.
//   Intro:    the certifying sentence, ruled above and below.
// The wordmark is a fixed GYEON mark; every issuer value comes from BrandProfile.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Caption } from "../../primitives";
import { Text } from "../../primitives/pdf-text";
import { COLOR, BW, FS, FONT, TRACK, LH, HYPHEN_PENALTY } from "../../tokens";
import { formatDocDate } from "../../brand";
import type { BrandProfile } from "../../types";
import type { CertificateDocumentData } from "./certificate-data";
import { scaled, type CertificateScale } from "./certificate-scale";

const WORDMARK_H = 16.5; // 22px
const TITLE_TRACK = 2.25; // .title-block__ja letter-spacing: 0.10em of 30px

export function CertificateHeader({
  brand,
  data,
  scale = 1,
}: {
  brand: BrandProfile;
  data: CertificateDocumentData;
  scale?: CertificateScale;
}) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const u = scaled(scale);
  return (
    <View>
      {/* Masthead */}
      <View
        style={{
          paddingBottom: u(7.5), // 10px
          marginBottom: u(9), // 16px, tightened to fit A4
          borderBottomWidth: BW.medium,
          borderBottomColor: primary,
          borderBottomStyle: "solid",
        }}
      >
        <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <Row gap={u(10.5)} style={{ alignItems: "center", maxWidth: "62%" }}>
            {brand.gyeonWordmarkUrl ? (
              <Image src={brand.gyeonWordmarkUrl} style={{ height: u(WORDMARK_H), objectFit: "contain" }} />
            ) : null}
            <Stack
              gap={u(1.5)}
              style={{
                paddingLeft: u(10.5),
                borderLeftWidth: BW.hair,
                borderLeftColor: COLOR.line,
                borderLeftStyle: "solid",
              }}
            >
              <Text
                hyphenationPenalty={HYPHEN_PENALTY}
                style={{
                  fontFamily: FONT.sansBold,
                  fontSize: u(7.125), // 9.5px
                  letterSpacing: u(1.57), // 0.22em
                  textTransform: "uppercase",
                  color: primary,
                  lineHeight: LH.snug,
                }}
              >
                {data.programLabel}
              </Text>
              {data.programSubLabel ? (
                <Caption style={{ fontSize: u(6.375), letterSpacing: u(1.02), textTransform: "uppercase" }}>
                  {data.programSubLabel}
                </Caption>
              ) : null}
            </Stack>
          </Row>

          <Stack gap={u(1)} style={{ alignItems: "flex-end", maxWidth: "38%" }}>
            <Caption style={{ fontSize: u(6), letterSpacing: u(1.44), textTransform: "uppercase" }}>
              Certificate Serial No.
            </Caption>
            <Text
              hyphenationPenalty={HYPHEN_PENALTY}
              style={{
                fontFamily: FONT.sansBold,
                fontSize: u(FS.fs16),
                letterSpacing: u(0.48),
                color: primary,
                lineHeight: LH.tight,
              }}
            >
              {data.serialDisplay ?? data.serial}
            </Text>
            <Caption style={{ fontSize: u(6.75), letterSpacing: u(0.54) }}>Issued {formatDocDate(data.issueDate)}</Caption>
          </Stack>
        </Row>
      </View>

      {/* Title. Built here rather than with the shared TitleBlock: certificate titles are long
          ("GYEON コーティング施工証明書") and the shared block pins its title against shrinking, which
          makes a title this wide overlap the English subtitle. Here the subtitle is free to wrap. */}
      <Row gap={u(18)} style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: u(7.5) }}>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{
            flexShrink: 0, // the title sets its own width; the subtitle takes what is left
            fontFamily: FONT.serif,
            fontSize: u(22.5), // 30px
            letterSpacing: u(TITLE_TRACK),
            color: COLOR.textStrong,
            lineHeight: LH.tight,
          }}
        >
          {data.titleJa}
        </Text>
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{
            flex: 1,
            fontFamily: FONT.sans,
            fontSize: u(6.75), // 9px
            letterSpacing: u(1.49), // 0.22em
            textTransform: "uppercase",
            textAlign: "right",
            color: COLOR.textMuted,
            lineHeight: 1.5,
          }}
        >
          {data.titleEn}
        </Text>
      </Row>

      {/* Certifying sentence */}
      <View
        style={{
          paddingTop: u(6),
          paddingBottom: u(6),
          marginBottom: u(7.5),
          borderTopWidth: BW.hair,
          borderTopColor: COLOR.line,
          borderTopStyle: "solid",
          borderBottomWidth: BW.hair,
          borderBottomColor: COLOR.line,
          borderBottomStyle: "solid",
        }}
      >
        <Text
          hyphenationPenalty={HYPHEN_PENALTY}
          style={{ fontFamily: FONT.sans, fontSize: u(7.875), lineHeight: 1.6, color: COLOR.text }}
        >
          {data.intro}
        </Text>
      </View>
    </View>
  );
}

/** Shared section rule: uppercase English label (navy) + Japanese label, over a navy underline. */
export function CertificateSectionLabel({
  en,
  ja,
  accent,
  scale = 1,
  style,
}: {
  en: string;
  ja: string;
  accent: string;
  scale?: CertificateScale;
  style?: { marginTop?: number; marginBottom?: number };
}) {
  const u = scaled(scale);
  return (
    <Row
      style={{
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingTop: u(3),
        paddingBottom: u(2.25),
        marginBottom: u(3),
        borderBottomWidth: BW.medium,
        borderBottomColor: accent,
        borderBottomStyle: "solid",
        ...style,
      }}
    >
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          fontFamily: FONT.sansBold,
          fontSize: u(FS.fs10),
          letterSpacing: u(1.35),
          textTransform: "uppercase",
          color: accent,
          lineHeight: LH.snug,
        }}
      >
        {en}
      </Text>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{ fontFamily: FONT.sans, fontSize: u(7.875), letterSpacing: u(0.63), color: COLOR.text, lineHeight: LH.snug }}
      >
        {ja}
      </Text>
    </Row>
  );
}
