// CompletionReportTemplate (Layer 4) — the production Completion Report (作業完了報告書), composed
// from the shared Document Design System + completion-report blocks into the concept-b layout:
//   Header(RPT No./Completed/Duration/Ref.Est) → Title(作業完了報告書) → caption(+Completed ribbon) →
//   Parties(01 お客様 / 02 施工車両+作業時間 / 03 発行元+主任技術者) →
//   04 Before & After 施工写真 → 05 Completed Works(non-priced) → non-monetary summary strip →
//   06 Inspection Checklist → 07 Technician's Note → Customer notes → Sign-off(主任技術者/お客様) →
//   Philosophy(reused) → Footer(brand+QR) → Serial.
// NON-monetary document: no amounts / tax / bank / payment. Issuer/logos/rank/SNS from BrandProfile;
// content from CompletionReportDocumentData — nothing is priced or recalculated. Rendered with
// @react-pdf/renderer.

import { Document, View } from "@react-pdf/renderer";
import { DocumentPage, TitleBlock, SerialFooter, NotesBlock } from "../../components";
import { Row, Body, Caption } from "../../primitives";
import { COLOR, FS } from "../../tokens";
import type { BrandProfile } from "../../types";
import type { CompletionReportDocumentData } from "./completion-report-data";
import { CompletionReportHeader } from "./CompletionReportHeader";
import { CompletionReportCustomerBlock, CompletionReportVehicleBlock, CompletionReportIssuerBlock } from "./CompletionReportParties";
import { CompletionReportServiceTable } from "./CompletionReportServiceTable";
import { CompletionReportSummary } from "./CompletionReportSummary";
import { CompletionReportPhotoSection, CompletionReportInspection, CompletionReportNote } from "./CompletionReportWorkSection";
import { CompletionReportSignoff } from "./CompletionReportSignoff";
import { CompletionReportFooter } from "./CompletionReportFooter";
import { EstimatePhilosophy } from "../estimate/EstimatePhilosophy";

export function CompletionReportTemplate({ brand, data }: { brand: BrandProfile; data: CompletionReportDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const titleJa = data.titleJa ?? "作業完了報告書";
  const titleEn = data.titleEn ?? "Completion Report / Detailing Works Summary";

  return (
    <Document title={`作業完了報告書 ${data.serial}`} author={brand.brandNameJa || brand.brandNameEn || "DealerOS"}>
      <DocumentPage>
        <CompletionReportHeader brand={brand} data={data} />

        <TitleBlock meta={{ type: "completion-report", serial: data.serial, issueDate: data.issueDate, titleJa, titleEn }} />
        <Row gap={8} style={{ alignItems: "center", marginBottom: 8 }}>
          <Body style={{ fontSize: FS.fs11 }}>下記の通り施工完了のご報告をいたします</Body>
          {data.status ? (
            <View style={{ backgroundColor: COLOR.success, paddingVertical: 1, paddingHorizontal: 6 }}>
              <Caption style={{ color: COLOR.textInverse, fontSize: FS.fs9, textTransform: "uppercase" }}>{data.status}</Caption>
            </View>
          ) : null}
        </Row>

        {/* Parties — 01 お客様 / 02 施工車両(+作業時間) / 03 発行元(+主任技術者) */}
        <Row style={{ marginBottom: 6 }}>
          <CompletionReportCustomerBlock customer={data.customer} accent={primary} />
          <CompletionReportVehicleBlock vehicle={data.vehicle} duration={data.duration} accent={primary} />
          <CompletionReportIssuerBlock brand={brand} chiefTechnician={data.chiefTechnician} accent={primary} />
        </Row>

        {/* 04 Before & After photos */}
        <CompletionReportPhotoSection photos={data.photos} accent={primary} />

        {/* 05 Completed Works (non-priced) */}
        <CompletionReportServiceTable works={data.completedWorks} accent={primary} />

        {/* Non-monetary work summary strip */}
        <CompletionReportSummary data={data} accent={primary} />

        {/* 06 Inspection Checklist */}
        <CompletionReportInspection items={data.inspectionItems} summary={data.inspectionSummary} accent={primary} />

        {/* 07 Technician's Note */}
        <CompletionReportNote note={data.technicianNote} accent={primary} />

        {/* Customer-facing notes (aftercare) */}
        {data.customerNotes && data.customerNotes.length ? (
          <View style={{ marginBottom: 6 }}>
            <NotesBlock title="お客様へのご案内 ・ Notes" notes={data.customerNotes} accent={primary} ordered />
          </View>
        ) : null}

        {/* Sign-off — Chief Technician / Customer */}
        <CompletionReportSignoff brand={brand} chiefTechnician={data.chiefTechnician} accent={primary} />

        {/* GYEON Philosophy (reused) */}
        <EstimatePhilosophy accent={primary} />

        {/* Footer + serial */}
        <CompletionReportFooter brand={brand} />
        <SerialFooter serial={data.serial} />
      </DocumentPage>
    </Document>
  );
}
