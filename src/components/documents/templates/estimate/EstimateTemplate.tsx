// EstimateTemplate (Layer 4) — the first production document. Composes the shared Document Design
// System (Layer 2/3) + Estimate-specific blocks into the concept-b/estimate-a4.html layout:
//   Header → Title (+status/preparedBy) → Parties(01/02/03) → Service table →
//   Notes + Summary(navy total) → [Signature] → GYEON Philosophy → Footer(brand+QR) → Serial.
// All issuer identity is injected from BrandProfile; document data from EstimateDocumentData. No
// hardcoded tenant values. Rendered with the existing @react-pdf/renderer engine (the caller wraps
// this and calls registerPdfFonts() before rendering to buffer — same as existing PDF generators).

import { Document, View } from "@react-pdf/renderer";
import { DocumentPage, TitleBlock, SerialFooter } from "../../components";
import { Row, Stack, Body, Caption, Value } from "../../primitives";
import { COLOR, FS } from "../../tokens";
import type { BrandProfile } from "../../types";
import type { EstimateDocumentData } from "./estimate-data";
import { EstimateHeader } from "./EstimateHeader";
import { EstimateCustomerBlock, EstimateVehicleBlock, EstimateIssuerBlock } from "./EstimateParties";
import { EstimateServiceTable } from "./EstimateServiceTable";
import { EstimateSummary } from "./EstimateSummary";
import { EstimateNotes } from "./EstimateNotes";
import { EstimatePhilosophy } from "./EstimatePhilosophy";
import { EstimateSignature } from "./EstimateSignature";
import { EstimateFooter } from "./EstimateFooter";

export function EstimateTemplate({ brand, data }: { brand: BrandProfile; data: EstimateDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const titleJa = data.titleJa ?? "見積書";
  const titleEn = data.titleEn ?? "Estimate / Coating & Protection Proposal";

  return (
    <Document title={`見積書 ${data.serial}`} author={brand.brandNameJa || brand.brandNameEn || "DealerOS"}>
      <DocumentPage>
        <EstimateHeader brand={brand} data={data} />

        {/* Title + caption (status / prepared by) */}
        <TitleBlock meta={{ type: "estimate", serial: data.serial, issueDate: data.issueDate, titleJa, titleEn }} />
        <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Row gap={8} style={{ alignItems: "center" }}>
            <Body style={{ fontSize: FS.fs11 }}>下記の通りお見積り申し上げます</Body>
            {data.status ? (
              <View style={{ backgroundColor: primary, paddingVertical: 1, paddingHorizontal: 6 }}>
                <Caption style={{ color: COLOR.textInverse, fontSize: FS.fs9, textTransform: "uppercase" }}>{data.status}</Caption>
              </View>
            ) : null}
          </Row>
          {data.preparedBy ? (
            <Row gap={4} style={{ alignItems: "center" }}>
              <Caption>Prepared By</Caption>
              <Value style={{ fontSize: FS.fs11 }}>{data.preparedBy}</Value>
            </Row>
          ) : null}
        </Row>

        {/* Parties — 01 Customer / 02 Vehicle / 03 Issuer */}
        <Row style={{ marginBottom: 10 }}>
          <EstimateCustomerBlock customer={data.customer} accent={primary} />
          <EstimateVehicleBlock vehicle={data.vehicle} accent={primary} />
          <EstimateIssuerBlock brand={brand} accent={primary} />
        </Row>

        {/* Services & Products */}
        <EstimateServiceTable items={data.items} accent={primary} />

        {/* Notes + Summary */}
        <Row gap={16} style={{ alignItems: "flex-start", marginBottom: 4 }}>
          <Stack style={{ flex: 1 }}>
            <EstimateNotes notes={data.notes} accent={primary} />
          </Stack>
          <View style={{ width: 280 }}>
            <EstimateSummary summary={data.summary} accent={primary} />
          </View>
        </Row>

        {data.showSignature ? (
          <View style={{ marginBottom: 8 }}>
            <EstimateSignature />
          </View>
        ) : null}

        {/* GYEON Philosophy (Estimate-unique) */}
        <EstimatePhilosophy philosophy={data.philosophy} accent={primary} />

        {/* Footer + serial */}
        <EstimateFooter brand={brand} />
        <SerialFooter serial={data.serial} />
      </DocumentPage>
    </Document>
  );
}
