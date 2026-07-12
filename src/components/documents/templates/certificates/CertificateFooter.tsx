// CertificateFooter — concept-b `.footer`: a three-column closing band (auto · 1fr · auto),
// bottom-aligned over a strong rule.
//   left   — GYEON rank mark (44px) + rank label
//   centre — the issuing dealer's own logo (40px) + "Issuing Studio"
//   right  — issuer identity (name, address, contact, registration, 主任技術者)
// Both marks and every value come from BrandProfile; each image degrades to its text label when the
// dealer has not supplied it. Nothing here is hardcoded to a tenant.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Caption, Value } from "../../primitives";
import { COLOR, BW, FS, TRACK } from "../../tokens";
import { resolveGyeonRank, gyeonRankLabel } from "../../brand";
import type { BrandProfile } from "../../types";
import { scaled, type CertificateScale } from "./certificate-scale";

const RANK_LOGO_H = 33; // 44px
const SHOP_LOGO_H = 30; // 40px
const SHOP_LOGO_MAX_W = 135; // 180px
const MARK_TRACK = 1.2; // 0.22em of 7.5px

function MarkLabel({ children, u }: { children: string; u: (n: number) => number }) {
  return (
    <Caption
      style={{ fontSize: u(FS.fs9), letterSpacing: u(MARK_TRACK), textTransform: "uppercase", color: COLOR.textMuted }}
    >
      {children}
    </Caption>
  );
}

export function CertificateFooter({
  brand,
  technician,
  scale = 1,
}: {
  brand: BrandProfile;
  technician?: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  const rank = brand.rank ?? resolveGyeonRank(brand.business.shopRank);
  const rankLabel = brand.business.shopRankLabel || gyeonRankLabel(rank);
  const c = brand.contact;
  const addressLine = [c.postalCode ? `〒${c.postalCode}` : "", c.address ?? ""].filter(Boolean).join("　");
  const telLine = [c.tel ? `TEL: ${c.tel}` : "", c.fax ? `FAX: ${c.fax}` : ""].filter(Boolean).join("　");
  const regLine = [
    brand.business.invoiceRegistrationNumber ? `登録番号: ${brand.business.invoiceRegistrationNumber}` : "",
    technician ? `主任技術者: ${technician}` : "",
  ]
    .filter(Boolean)
    .join("　");

  return (
    <View
      style={{
        borderTopWidth: BW.thin,
        borderTopColor: COLOR.lineStrong,
        borderTopStyle: "solid",
        paddingTop: u(6), // 12px, tightened to fit A4
      }}
    >
      <Row gap={u(15)} style={{ alignItems: "flex-end" }}>
        <Stack gap={u(3)} style={{ alignItems: "flex-start" }}>
          {brand.rankLogoUrl ? (
            <Image src={brand.rankLogoUrl} style={{ height: u(RANK_LOGO_H), objectFit: "contain" }} />
          ) : null}
          <MarkLabel u={u}>{rankLabel}</MarkLabel>
        </Stack>

        <Stack gap={u(3)} style={{ flex: 1, alignItems: "center" }}>
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              style={{ height: u(SHOP_LOGO_H), maxWidth: u(SHOP_LOGO_MAX_W), objectFit: "contain" }}
            />
          ) : null}
          <MarkLabel u={u}>Issuing Studio</MarkLabel>
        </Stack>

        <Stack gap={u(1)} style={{ alignItems: "flex-end", maxWidth: "46%" }}>
          <Value style={{ fontSize: u(FS.fs13), letterSpacing: u(TRACK.wide) }}>
            {brand.brandNameJa || brand.brandNameEn || ""}
          </Value>
          {addressLine ? <Caption style={{ fontSize: u(FS.fs9), textAlign: "right" }}>{addressLine}</Caption> : null}
          {telLine ? <Caption style={{ fontSize: u(FS.fs9), textAlign: "right" }}>{telLine}</Caption> : null}
          {regLine ? <Caption style={{ fontSize: u(FS.fs9), textAlign: "right" }}>{regLine}</Caption> : null}
        </Stack>
      </Row>
    </View>
  );
}
