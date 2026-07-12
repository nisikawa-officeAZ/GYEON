// CompletionReportSignoff — concept-b two-box sign-off:
//   Chief Technician 主任技術者 — name + rank pre-filled (from data / BrandProfile)
//   Customer お客様受領サイン — blank signature line + date line for the customer to complete.
// A signature area is required by the report rules; no monetary content.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Overline, Caption, Value } from "../../primitives";
import { COLOR, BW, FS } from "../../tokens";
import type { BrandProfile } from "../../types";

function SignoffBox({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      gap={0}
      style={{
        flex: 1,
        borderWidth: BW.hair,
        borderColor: COLOR.line,
        borderStyle: "solid",
        padding: 8,
        minHeight: 66,
      }}
    >
      {children}
    </Stack>
  );
}

export function CompletionReportSignoff({
  brand,
  chiefTechnician,
  reportQrUrl,
  accent,
}: {
  brand: BrandProfile;
  chiefTechnician?: string;
  reportQrUrl?: string;
  accent: string;
}) {
  const technician = chiefTechnician || brand.business.responsiblePerson || "";
  const rankLabel = brand.business.shopRankLabel || brand.business.shopRank || "";

  return (
    <Row gap={10} style={{ marginBottom: 6, alignItems: "stretch" }}>
      {/* Chief Technician — pre-filled */}
      <SignoffBox>
        <Overline style={{ color: accent, marginBottom: 4 }}>Chief Technician ・ 主任技術者</Overline>
        <View style={{ flex: 1 }} />
        <Row style={{ justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: BW.thin, borderBottomColor: COLOR.lineStrong, borderBottomStyle: "solid", paddingBottom: 3 }}>
          <Value style={{ fontSize: FS.fs14 }}>{technician}</Value>
          {rankLabel ? <Caption style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>{rankLabel}</Caption> : null}
        </Row>
        <Caption style={{ fontSize: FS.fs9, marginTop: 2, color: COLOR.textMuted }}>Signature ・ 署名</Caption>
      </SignoffBox>

      {/* Customer — blank for sign + date */}
      <SignoffBox>
        <Overline style={{ color: accent, marginBottom: 4 }}>Customer ・ お客様受領サイン</Overline>
        <View style={{ flex: 1 }} />
        <Row style={{ height: 24, borderBottomWidth: BW.thin, borderBottomColor: COLOR.lineStrong, borderBottomStyle: "solid" }} />
        <Row style={{ justifyContent: "space-between", marginTop: 3 }}>
          <Caption style={{ fontSize: FS.fs9, color: COLOR.textMuted }}>Signature ・ 署名</Caption>
          <Caption style={{ fontSize: FS.fs10, color: COLOR.textMuted }}>　　年　　月　　日</Caption>
        </Row>
      </SignoffBox>

      {/* concept-b `.signoff-qr` — QR to the online copy, right of the two sign-off boxes. */}
      {reportQrUrl ? (
        <Stack gap={3} style={{ alignItems: "center", justifyContent: "center", width: 46 }}>
          <Image
            src={reportQrUrl}
            style={{
              width: 42,
              height: 42,
              borderWidth: BW.thin,
              borderColor: COLOR.line,
              borderStyle: "solid",
            }}
          />
          <Caption style={{ fontSize: FS.fs9, textAlign: "center", color: COLOR.textMuted }}>
            Scan to View Online
          </Caption>
        </Stack>
      ) : null}
    </Row>
  );
}
