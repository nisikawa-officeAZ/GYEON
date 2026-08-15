// SummaryInvoiceFooter — concept-b `.footer`: a three-column closing band, `auto 1fr auto`, bottom-
// aligned over a strong top rule.
//   left   — GYEON rank logo (44px) + rank label
//   centre — the issuing dealer's own logo (40px) + "Issuing Studio"
//   right  — issuer identity block (name, address, contact, registration)
// Every value and both images come from BrandProfile; each image degrades to its text lockup when
// the dealer has not supplied it.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Caption, Value } from "../../primitives";
import { COLOR, BW, FS, TRACK } from "../../tokens";
import { resolveGyeonRank, gyeonRankLabel } from "../../brand";
import type { BrandProfile } from "../../types";

const RANK_LOGO_H = 33; // 44px
const SHOP_LOGO_H = 30; // 40px
const SHOP_LOGO_MAX_W = 135; // 180px
const MARK_TRACK = 1.2; // 0.22em of 7.5px

function MarkLabel({ children }: { children: string }) {
  return (
    <Caption style={{ fontSize: FS.fs9, letterSpacing: MARK_TRACK, textTransform: "uppercase", color: COLOR.textMuted }}>
      {children}
    </Caption>
  );
}

export function SummaryInvoiceFooter({ brand }: { brand: BrandProfile }) {
  const rank = brand.rank ?? resolveGyeonRank(brand.business.shopRank);
  const rankLabel = brand.business.shopRankLabel || gyeonRankLabel(rank);
  const c = brand.contact;
  const contactLine = [
    c.postalCode ? `〒${c.postalCode}` : "",
    c.address ?? "",
  ].filter(Boolean).join("　");
  const telLine = [c.tel ? `TEL: ${c.tel}` : "", c.fax ? `FAX: ${c.fax}` : ""].filter(Boolean).join("　");
  const regLine = [
    brand.business.invoiceRegistrationNumber ? `登録番号: ${brand.business.invoiceRegistrationNumber}` : "",
    brand.business.responsiblePerson ? `担当: ${brand.business.responsiblePerson}` : "",
  ].filter(Boolean).join("　");

  return (
    <View
      style={{
        borderTopWidth: BW.thin,
        borderTopColor: COLOR.lineStrong,
        borderTopStyle: "solid",
        paddingTop: 9, // 12px
      }}
    >
      <Row gap={15} style={{ alignItems: "flex-end" }}>
        {/* GYEON rank mark */}
        <Stack gap={3} style={{ alignItems: "flex-start" }}>
          {brand.rankLogoUrl ? (
            <Image src={brand.rankLogoUrl} style={{ height: RANK_LOGO_H, objectFit: "contain" }} />
          ) : null}
          <MarkLabel>{rankLabel}</MarkLabel>
        </Stack>

        {/* Issuing dealer's own mark */}
        <Stack gap={3} style={{ flex: 1, alignItems: "center" }}>
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              style={{ height: SHOP_LOGO_H, maxWidth: SHOP_LOGO_MAX_W, objectFit: "contain" }}
            />
          ) : null}
          <MarkLabel>Issuing Studio</MarkLabel>
        </Stack>

        {/* Issuer identity */}
        <Stack gap={1} style={{ alignItems: "flex-end", maxWidth: "44%" }}>
          <Value style={{ fontSize: FS.fs13, letterSpacing: TRACK.wide }}>
            {brand.brandNameJa || brand.brandNameEn || ""}
          </Value>
          {contactLine ? <Caption style={{ fontSize: FS.fs9, textAlign: "right" }}>{contactLine}</Caption> : null}
          {telLine ? <Caption style={{ fontSize: FS.fs9, textAlign: "right" }}>{telLine}</Caption> : null}
          {regLine ? <Caption style={{ fontSize: FS.fs9, textAlign: "right" }}>{regLine}</Caption> : null}
        </Stack>
      </Row>
    </View>
  );
}
