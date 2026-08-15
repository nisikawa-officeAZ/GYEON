// SummaryInvoiceHeader — concept-b masthead + continuation header.
//   Masthead (page 1): left = shop logo / GYEON rank lockup + "Business Billing Program";
//     right = "Summary Invoice No." + serial + issued date.
//   Continuation (page k>1): left = 合計請求書 (続き) + customer · billing period; right = serial.
// Issuer identity + rank from BrandProfile.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Overline, DocSubtitle, Caption, Value, ValueLg } from "../../primitives";
import { COLOR, BW, FS, TRACK } from "../../tokens";
import { formatDocDate, formatDocDateRange, honorific } from "../../brand";
import type { BrandProfile } from "../../types";
import type { SummaryInvoiceDocumentData } from "./summary-invoice-data";

export function SummaryInvoiceHeader({ brand, data }: { brand: BrandProfile; data: SummaryInvoiceDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const rankLabel = brand.business.shopRankLabel || brand.business.shopRank || "";
  return (
    <View style={{ paddingBottom: 9, marginBottom: 12, borderBottomWidth: BW.medium, borderBottomColor: primary, borderBottomStyle: "solid" }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        {/* Left — brand + rank lockup */}
        {/* concept-b `.m-head__wordmark` — the GYEON wordmark (22px), not the tenant's shop logo:
            the Summary Invoice masthead is a GYEON programme lockup. */}
        <Row gap={10} style={{ alignItems: "center", maxWidth: "60%" }}>
          {brand.gyeonWordmarkUrl ? (
            <Image src={brand.gyeonWordmarkUrl} style={{ height: 16.5, objectFit: "contain" }} />
          ) : null}
          <Stack
            gap={1}
            style={{ paddingLeft: 10, borderLeftWidth: BW.hair, borderLeftColor: COLOR.line, borderLeftStyle: "solid" }}
          >
            {rankLabel ? (
              <Overline style={{ fontSize: FS.fs10, color: primary, letterSpacing: TRACK.wider }}>{rankLabel}</Overline>
            ) : null}
            <Caption style={{ fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase" }}>
              Business Billing Program
            </Caption>
          </Stack>
        </Row>

        {/* Right — serial + issued date */}
        <Stack gap={1} style={{ alignItems: "flex-end", maxWidth: "40%" }}>
          <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>Summary Invoice No.</Overline>
          <DocSubtitle style={{ fontSize: FS.fs16, letterSpacing: TRACK.wide, color: primary }}>{data.serial}</DocSubtitle>
          <Caption style={{ fontSize: FS.fs9 }}>Issued {formatDocDate(data.issueDate)}</Caption>
        </Stack>
      </Row>
    </View>
  );
}

export function SummaryInvoiceContinuationHeader({ data }: { data: SummaryInvoiceDocumentData }) {
  const titleJa = data.titleJa ?? "合計請求書";
  return (
    <View
      break
      style={{ paddingBottom: 5, marginBottom: 7, borderBottomWidth: BW.thin, borderBottomColor: COLOR.line, borderBottomStyle: "solid" }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <Stack gap={1} style={{ maxWidth: "70%" }}>
          <ValueLg style={{ fontSize: FS.fs16 }}>{titleJa}（続き）</ValueLg>
          <Caption style={{ fontSize: FS.fs9 }}>
            {data.customer.name} {honorific(data.customer.kind)} · 対象期間 {formatDocDateRange(data.billingPeriodStart, data.billingPeriodEnd)}
          </Caption>
        </Stack>
        <Stack gap={1} style={{ alignItems: "flex-end" }}>
          <Overline style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>Summary Invoice No.</Overline>
          <Value style={{ fontSize: FS.fs12 }}>{data.serial}</Value>
        </Stack>
      </Row>
    </View>
  );
}
