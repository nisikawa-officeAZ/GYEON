// CompletionReportHeader — masthead (concept-b): left = Completion Report No. + completed date +
// duration + referenced estimate; right = shop logo + issuer name + rank · registration no.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Overline, DocSubtitle, Caption, Value, ValueLg } from "../../primitives";
import { COLOR, BW, FS, TRACK } from "../../tokens";
import { formatDocDate } from "../../brand";
import type { BrandProfile } from "../../types";
import type { CompletionReportDocumentData } from "./completion-report-data";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Row gap={4}>
      <Caption style={{ color: COLOR.textMuted }}>{label}</Caption>
      <Value style={{ fontSize: FS.fs11 }}>{value}</Value>
    </Row>
  );
}

export function CompletionReportHeader({ brand, data }: { brand: BrandProfile; data: CompletionReportDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const rankLabel = brand.business.shopRankLabel || brand.business.shopRank;
  const issuerSub = [rankLabel, brand.business.invoiceRegistrationNumber].filter(Boolean).join("  ·  ");
  return (
    <View style={{ paddingBottom: 7, marginBottom: 10, borderBottomWidth: BW.medium, borderBottomColor: primary, borderBottomStyle: "solid" }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Stack gap={3} style={{ maxWidth: "58%" }}>
          <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>Completion Report No.</Overline>
          <DocSubtitle style={{ fontSize: FS.fs16, letterSpacing: TRACK.wide, color: COLOR.textStrong }}>{data.serial}</DocSubtitle>
          <Row gap={12} style={{ marginTop: 1 }}>
            <MetaItem label="Completed" value={formatDocDate(data.completedDate)} />
            {data.duration ? <MetaItem label="Duration" value={data.duration} /> : null}
            {data.refEstimate ? <MetaItem label="Ref. Estimate" value={data.refEstimate} /> : null}
          </Row>
        </Stack>

        <Stack gap={2} style={{ alignItems: "flex-end", maxWidth: "40%" }}>
          {brand.logoUrl ? (
            <>
              <Image src={brand.logoUrl} style={{ height: 20, objectFit: "contain" }} />
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
