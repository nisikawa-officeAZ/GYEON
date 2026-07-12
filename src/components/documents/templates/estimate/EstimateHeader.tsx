// EstimateHeader — the Estimate masthead (concept-b): left = Estimate No. + issue/valid/currency
// meta; right = shop logo + issuer name + rank · tax registration. Bottom rule in brand-primary.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Overline, DocSubtitle, Caption, Value, ValueLg } from "../../primitives";
import { COLOR, BW, FS, TRACK } from "../../tokens";
import { formatDocDate } from "../../brand";
import type { BrandProfile } from "../../types";
import type { EstimateDocumentData } from "./estimate-data";

// A meta pair must never be squeezed: flex would otherwise shrink the label and value into each
// other ("Delivery Dat2026.07.20") once the trio is wider than the header's left column. Pinning the
// pair against shrinkage and letting the row wrap keeps every label whole.
function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Row gap={4} style={{ flexShrink: 0 }}>
      <Caption style={{ color: COLOR.textMuted, flexShrink: 0 }}>{label}</Caption>
      <Value style={{ fontSize: FS.fs11, flexShrink: 0 }}>{value}</Value>
    </Row>
  );
}

export function EstimateHeader({ brand, data }: { brand: BrandProfile; data: EstimateDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const rankLabel = brand.business.shopRankLabel || brand.business.shopRank;
  const issuerSub = [rankLabel, brand.business.invoiceRegistrationNumber].filter(Boolean).join("  ·  ");
  return (
    <View style={{ paddingBottom: 7, marginBottom: 10, borderBottomWidth: BW.medium, borderBottomColor: primary, borderBottomStyle: "solid" }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Left — serial + meta */}
        <Stack gap={3} style={{ maxWidth: "58%" }}>
          <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>Estimate No.</Overline>
          <DocSubtitle style={{ fontSize: FS.fs16, letterSpacing: TRACK.wide, color: COLOR.textStrong }}>
            {data.serial}
          </DocSubtitle>
          <Row gap={12} style={{ marginTop: 1, flexWrap: "wrap" }}>
            <MetaItem label="Issue Date" value={formatDocDate(data.issueDate)} />
            {data.validUntil ? <MetaItem label="Valid Until" value={formatDocDate(data.validUntil)} /> : null}
            <MetaItem label="Currency" value="JPY (¥)" />
          </Row>
        </Stack>

        {/* Right — issuer */}
        <Stack gap={2} style={{ alignItems: "flex-end", maxWidth: "40%" }}>
          {brand.logoUrl ? (
            <>
              <Image src={brand.logoUrl} style={{ height: 27, maxWidth: 165, objectFit: "contain" }} />
              <Caption style={{ textAlign: "right", color: COLOR.textStrong }}>{brand.brandNameJa || brand.brandNameEn || ""}</Caption>
            </>
          ) : (
            <ValueLg style={{ fontSize: FS.fs14 }}>{brand.brandNameJa || brand.brandNameEn || ""}</ValueLg>
          )}
          {issuerSub ? <Caption style={{ textAlign: "right", fontSize: FS.fs9 }}>{issuerSub}</Caption> : null}
        </Stack>
      </Row>
    </View>
  );
}
