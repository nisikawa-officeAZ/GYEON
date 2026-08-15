// InvoiceTemplate (Layer 4) — the production Invoice, composed from the shared Document Design System
// + Invoice-specific blocks into the concept-b/invoice-a4.html layout:
//   Header(Invoice No./Due) → Title(請求書) → caption(+Unpaid) → Parties(Bill To/Vehicle/Issuer) →
//   Billed items → PaymentBlock(notes+bank) + Summary(Amount Due, navy) → Seal → Philosophy →
//   Footer(brand+QR) → Serial.
// Issuer identity, bank account, seal and the qualified-invoice registration number all come from
// BrandProfile; document data from InvoiceDocumentData. Applied pricing only — never recalculated.
// Reuses the Estimate Philosophy + Footer verbatim. Rendered with the existing @react-pdf/renderer.

import { Document, View, Image } from "@react-pdf/renderer";
import { DocumentPage, TitleBlock, SerialFooter } from "../../components";
import { Row, Stack, Body, Caption } from "../../primitives";
import { COLOR, FS, BW, RADIUS } from "../../tokens";
import type { BrandProfile } from "../../types";
import type { InvoiceDocumentData } from "./invoice-data";
import { InvoiceHeader } from "./InvoiceHeader";
import { InvoiceCustomerBlock, InvoiceVehicleBlock, InvoiceIssuerBlock } from "./InvoiceParties";
import { InvoiceServiceTable } from "./InvoiceServiceTable";
import { InvoiceSummary } from "./InvoiceSummary";
import { InvoicePaymentBlock } from "./InvoicePaymentBlock";
import { InvoiceFooter } from "./InvoiceFooter";
import { EstimatePhilosophy } from "../estimate/EstimatePhilosophy";

function SealRow({ brand }: { brand: BrandProfile }) {
  return (
    <Row gap={8} style={{ justifyContent: "flex-end", alignItems: "center", marginBottom: 4, marginTop: 0 }} wrap={false}>
      <Caption>発行者社印 ・ Official Seal</Caption>
      {brand.sealImageUrl ? (
        <Image src={brand.sealImageUrl} style={{ width: 34, height: 34, objectFit: "contain" }} />
      ) : (
        <View style={{ width: 34, height: 34, borderWidth: BW.thin, borderColor: COLOR.danger, borderStyle: "solid", borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" }}>
          <Caption style={{ color: COLOR.danger, fontSize: FS.fs9 }}>社印</Caption>
        </View>
      )}
    </Row>
  );
}

export function InvoiceTemplate({ brand, data }: { brand: BrandProfile; data: InvoiceDocumentData }) {
  const primary = brand.colors.primary || COLOR.textStrong;
  const titleJa = data.titleJa ?? "請求書";
  const titleEn = data.titleEn ?? "Invoice / Statement for Payment";

  return (
    <Document title={`請求書 ${data.serial}`} author={brand.brandNameJa || brand.brandNameEn || "DealerOS"}>
      <DocumentPage>
        <InvoiceHeader brand={brand} data={data} />

        <TitleBlock meta={{ type: "invoice", serial: data.serial, issueDate: data.issueDate, titleJa, titleEn }} />
        <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Row gap={8} style={{ alignItems: "center" }}>
            <Body style={{ fontSize: FS.fs11 }}>下記の通りご請求申し上げます</Body>
            {data.status ? (
              <View style={{ backgroundColor: COLOR.danger, paddingVertical: 1, paddingHorizontal: 6 }}>
                <Caption style={{ color: COLOR.textInverse, fontSize: FS.fs9, textTransform: "uppercase" }}>{data.status}</Caption>
              </View>
            ) : null}
          </Row>
        </Row>

        {/* Parties — 01 Bill To / 02 Vehicle / 03 Issuer */}
        <Row style={{ marginBottom: 6 }}>
          <InvoiceCustomerBlock customer={data.customer} accent={primary} />
          <InvoiceVehicleBlock vehicle={data.vehicle} accent={primary} />
          <InvoiceIssuerBlock brand={brand} accent={primary} />
        </Row>

        {/* Billed items */}
        <InvoiceServiceTable items={data.items} accent={primary} />

        {/* Payment (notes + bank) + Summary (Amount Due) */}
        <Row gap={16} style={{ alignItems: "flex-start", marginBottom: 2 }}>
          <Stack style={{ flex: 1 }}>
            <InvoicePaymentBlock notes={data.paymentNotes} bankAccount={brand.bankAccount} accent={primary} />
          </Stack>
          <View style={{ width: 280 }}>
            <InvoiceSummary summary={data.summary} accent={primary} />
          </View>
        </Row>

        {/* Company seal */}
        <SealRow brand={brand} />

        {/* GYEON Philosophy (reused) */}
        <EstimatePhilosophy accent={primary} />

        {/* Footer + serial */}
        <InvoiceFooter brand={brand} />
        <SerialFooter serial={data.serial} />
      </DocumentPage>
    </Document>
  );
}
