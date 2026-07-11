// DeliveryNoteTemplate (Layer 4) — the production Delivery Note, composed from the shared Document
// Design System + delivery-note blocks into the concept-b/delivery-note-a4.html layout:
//   Header(DLV No./Delivery Date/Ref.Est) → Title(納品書) → caption(+Completed) →
//   Parties(納品先/納品対象車両/Issuer) → Delivered items → Aftercare notes + Summary(納品金額, navy)
//   → Receipt signature → Philosophy → Footer(brand+QR) → Serial.
// Issuer/logos/rank/SNS from BrandProfile; document data from DeliveryNoteDocumentData. Applied
// pricing only — never recalculated. No bank / valid-until / payment-due / internal memo. Reuses the
// Estimate Philosophy + Footer and the shared SignatureBlock. Rendered with @react-pdf/renderer.

import { Document, View } from "@react-pdf/renderer";
import { DocumentPage, TitleBlock, SerialFooter, NotesBlock } from "../../components";
import { Row, Stack, Body, Caption } from "../../primitives";
import { COLOR, FS } from "../../tokens";
import type { BrandProfile } from "../../types";
import type { DeliveryNoteDocumentData } from "./delivery-note-data";
import { DeliveryNoteHeader } from "./DeliveryNoteHeader";
import { DeliveryNoteCustomerBlock, DeliveryNoteVehicleBlock, DeliveryNoteIssuerBlock } from "./DeliveryNoteParties";
import { DeliveryNoteServiceTable } from "./DeliveryNoteServiceTable";
import { DeliveryNoteSummary } from "./DeliveryNoteSummary";
import { DeliveryNoteSignature } from "./DeliveryNoteSignature";
import { DeliveryNoteFooter } from "./DeliveryNoteFooter";
import { EstimatePhilosophy } from "../estimate/EstimatePhilosophy";

export function DeliveryNoteTemplate({ brand, data }: { brand: BrandProfile; data: DeliveryNoteDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const titleJa = data.titleJa ?? "納品書";
  const titleEn = data.titleEn ?? "Delivery Note / Statement of Delivered Works";

  return (
    <Document title={`納品書 ${data.serial}`} author={brand.brandNameJa || brand.brandNameEn || "DealerOS"}>
      <DocumentPage>
        <DeliveryNoteHeader brand={brand} data={data} />

        <TitleBlock meta={{ type: "delivery-note", serial: data.serial, issueDate: data.issueDate, titleJa, titleEn }} />
        <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Row gap={8} style={{ alignItems: "center" }}>
            <Body style={{ fontSize: FS.fs11 }}>下記の通り納品いたします</Body>
            {data.status ? (
              <View style={{ backgroundColor: COLOR.success, paddingVertical: 1, paddingHorizontal: 6 }}>
                <Caption style={{ color: COLOR.textInverse, fontSize: FS.fs9, textTransform: "uppercase" }}>{data.status}</Caption>
              </View>
            ) : null}
          </Row>
        </Row>

        {/* Parties — 01 納品先 / 02 納品対象車両 / 03 Issuer */}
        <Row style={{ marginBottom: 6 }}>
          <DeliveryNoteCustomerBlock customer={data.customer} accent={primary} />
          <DeliveryNoteVehicleBlock vehicle={data.vehicle} accent={primary} />
          <DeliveryNoteIssuerBlock brand={brand} accent={primary} />
        </Row>

        {/* Delivered items */}
        <DeliveryNoteServiceTable items={data.items} accent={primary} />

        {/* Aftercare notes + Summary (Delivered Total) */}
        <Row gap={16} style={{ alignItems: "flex-start", marginBottom: 4 }}>
          <Stack style={{ flex: 1 }}>
            <NotesBlock title="納品後のお取り扱い ・ Aftercare Notes" notes={data.aftercareNotes} accent={primary} ordered />
          </Stack>
          <View style={{ width: 280 }}>
            <DeliveryNoteSummary summary={data.summary} accent={primary} />
          </View>
        </Row>

        {/* Customer acknowledgement signature */}
        <DeliveryNoteSignature text={data.receiptText} accent={primary} />

        {/* GYEON Philosophy (reused) */}
        <EstimatePhilosophy accent={primary} />

        {/* Footer + serial */}
        <DeliveryNoteFooter brand={brand} />
        <SerialFooter serial={data.serial} />
      </DocumentPage>
    </Document>
  );
}
