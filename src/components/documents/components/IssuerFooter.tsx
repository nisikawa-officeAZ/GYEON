// Layer 3 — Issuer Footer. Three columns: [GYEON rank logo] [shop logo] [issuer details].
// EVERY value comes from BrandProfile (Dealer Settings). The rank logo image is injected
// (brand.rankLogoUrl); when absent, the resolved rank label is shown as text.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Caption, Value, Overline } from "../primitives";
import { COLOR, BW, FS } from "../tokens";
import { resolveGyeonRank, gyeonRankLabel } from "../brand";
import type { BrandProfile } from "../types";

export function IssuerFooter({ brand }: { brand: BrandProfile }) {
  const rank = brand.rank ?? resolveGyeonRank(brand.business.shopRank);
  const c = brand.contact;
  return (
    <View
      style={{
        borderTopWidth: BW.thin,
        borderTopColor: COLOR.line,
        borderTopStyle: "solid",
        paddingTop: 10,
      }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Left — GYEON rank logo (or resolved label fallback) */}
        <Stack gap={2} style={{ width: 120 }}>
          {brand.rankLogoUrl ? (
            <Image src={brand.rankLogoUrl} style={{ height: 30, objectFit: "contain", alignSelf: "flex-start" }} />
          ) : (
            <Caption style={{ letterSpacing: 1 }}>{gyeonRankLabel(rank)}</Caption>
          )}
        </Stack>

        {/* Center — shop logo (or brand name) */}
        <Stack gap={2} style={{ flex: 1, alignItems: "center" }}>
          {brand.logoUrl ? (
            <Image src={brand.logoUrl} style={{ height: 24, objectFit: "contain" }} />
          ) : (
            <Value style={{ fontSize: FS.fs12 }}>{brand.brandNameJa || brand.brandNameEn || ""}</Value>
          )}
          {brand.footer.tagline ? <Caption style={{ fontSize: FS.fs9 }}>{brand.footer.tagline}</Caption> : null}
        </Stack>

        {/* Right — issuer details */}
        <Stack gap={1} style={{ width: 200, alignItems: "flex-end" }}>
          <Overline style={{ fontSize: FS.fs10 }}>{brand.brandNameJa || brand.brandNameEn || ""}</Overline>
          {c.postalCode || c.address ? (
            <Caption style={{ textAlign: "right" }}>
              {c.postalCode ? `〒${c.postalCode} ` : ""}
              {c.address ?? ""}
            </Caption>
          ) : null}
          {c.tel || c.fax ? (
            <Caption style={{ textAlign: "right" }}>
              {c.tel ? `TEL ${c.tel}` : ""}
              {c.tel && c.fax ? " / " : ""}
              {c.fax ? `FAX ${c.fax}` : ""}
            </Caption>
          ) : null}
          {brand.business.invoiceRegistrationNumber ? (
            <Caption style={{ textAlign: "right" }}>登録番号 {brand.business.invoiceRegistrationNumber}</Caption>
          ) : null}
          {brand.business.responsiblePerson ? (
            <Caption style={{ textAlign: "right" }}>担当 {brand.business.responsiblePerson}</Caption>
          ) : null}
        </Stack>
      </Row>
    </View>
  );
}
