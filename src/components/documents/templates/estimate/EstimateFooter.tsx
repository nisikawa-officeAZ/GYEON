// EstimateFooter — concept-b footer: left brand block (rank logo / GYEON lockup + tagline), right SNS
// QR zone (Follow CTA + shared SnsFooter). Brand + partner from BrandProfile; QR from brand.qrLinks.

import { View, Image } from "@react-pdf/renderer";
import { SnsFooter } from "../../components";
import { Row, Stack, Overline, Caption, Value } from "../../primitives";
import { COLOR, BW, FS } from "../../tokens";
import type { BrandProfile } from "../../types";

export function EstimateFooter({ brand }: { brand: BrandProfile }) {
  return (
    <View style={{ borderTopWidth: BW.thin, borderTopColor: COLOR.line, borderTopStyle: "solid", paddingTop: 4, marginTop: 2 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Brand */}
        <Stack gap={2} style={{ width: 220 }}>
          {brand.rankLogoUrl ? (
            <Image src={brand.rankLogoUrl} style={{ height: 22, objectFit: "contain", alignSelf: "flex-start" }} />
          ) : (
            <Stack gap={0}>
              <Value style={{ fontSize: FS.fs14 }}>{brand.footer.partnerBrand || "GYEON"}</Value>
              {brand.business.shopRankLabel ? <Caption>{brand.business.shopRankLabel}</Caption> : null}
            </Stack>
          )}
          {brand.footer.tagline ? <Caption style={{ fontSize: FS.fs9 }}>{brand.footer.tagline}</Caption> : null}
        </Stack>

        {/* SNS QR */}
        {brand.qrLinks.length ? (
          <Stack gap={3} style={{ alignItems: "flex-end" }}>
            <Overline style={{ fontSize: FS.fs9 }}>Follow ・ 最新情報は SNS で</Overline>
            <SnsFooter links={brand.qrLinks} size={26} />
          </Stack>
        ) : null}
      </Row>
    </View>
  );
}
