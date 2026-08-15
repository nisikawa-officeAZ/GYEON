// Layer 3 — Masthead. Top cross-header: left wordmark + rank, right serial + issue date.
// Bottom edge uses a 1.5px brand-primary rule.

import { View, Image } from "@react-pdf/renderer";
import { COLOR, BW, FS, TRACK } from "../tokens";
import { Row, Stack, DocSubtitle, Value, Caption, ValueLg } from "../primitives";
import { formatDocDate } from "../brand";
import type { BrandProfile, DocumentMeta } from "../types";

export function Masthead({ brand, meta }: { brand: BrandProfile; meta: DocumentMeta }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  return (
    <View
      style={{
        paddingBottom: 10,
        marginBottom: 16,
        borderBottomWidth: BW.medium,
        borderBottomColor: primary,
        borderBottomStyle: "solid",
      }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Left: shop wordmark (or text lockup fallback) + rank */}
        <Stack gap={2} style={{ maxWidth: "60%" }}>
          {brand.logoUrl ? (
            <Image src={brand.logoUrl} style={{ height: 22, objectFit: "contain", alignSelf: "flex-start" }} />
          ) : (
            <ValueLg>{brand.brandNameJa || brand.brandNameEn || ""}</ValueLg>
          )}
          {brand.business.shopRankLabel || brand.business.shopRank ? (
            <Caption style={{ letterSpacing: TRACK.wide }}>
              {brand.business.shopRankLabel || brand.business.shopRank}
            </Caption>
          ) : null}
        </Stack>

        {/* Right: serial + issue date */}
        <Stack gap={2} style={{ alignItems: "flex-end" }}>
          <DocSubtitle style={{ fontSize: FS.fs9 }}>{meta.serial}</DocSubtitle>
          <Row gap={4}>
            <Caption>発行日</Caption>
            <Value style={{ fontSize: FS.fs11 }}>{formatDocDate(meta.issueDate)}</Value>
          </Row>
        </Stack>
      </Row>
    </View>
  );
}
