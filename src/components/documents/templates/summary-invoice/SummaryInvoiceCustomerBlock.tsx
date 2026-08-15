// SummaryInvoiceCustomerBlock — concept-b two-box party grid:
//   Billed To · 御請求先 (business customer + code + billing terms) | Issued By · 発行者 (issuer).
// Both boxes are bordered; issuer identity comes from BrandProfile. No monetary content.

import { View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { Row, Stack, Overline, Caption, Value, ValueLg, Label } from "../../primitives";
import { COLOR, BW, FS, TRACK } from "../../tokens";
import { honorific } from "../../brand";
import type { BrandProfile } from "../../types";
import type { SummaryInvoiceCustomer } from "./summary-invoice-data";

function PartyBox({ label, children, flex, accent }: { label: string; children: ReactNode; flex: number; accent: string }) {
  return (
    <Stack
      gap={0}
      style={{ flex, borderWidth: BW.hair, borderColor: COLOR.line, borderStyle: "solid", padding: 10 }}
    >
      <Overline
        style={{ fontSize: FS.fs9, color: accent, letterSpacing: TRACK.wider, marginBottom: 5, paddingBottom: 3, borderBottomWidth: BW.hair, borderBottomColor: COLOR.line, borderBottomStyle: "solid" }}
      >
        {label}
      </Overline>
      {children}
    </Stack>
  );
}

function Term({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <Row gap={8} style={{ marginBottom: 1 }}>
      <Caption style={{ width: 74, fontSize: FS.fs9, letterSpacing: TRACK.wide, textTransform: "uppercase", color: COLOR.textMuted }}>{k}</Caption>
      <Value style={{ flex: 1, fontSize: FS.fs10, lineHeight: 1.25 }}>{v}</Value>
    </Row>
  );
}

function BilledTo({ customer, accent }: { customer: SummaryInvoiceCustomer; accent: string }) {
  return (
    <PartyBox label="Billed To · 御請求先" flex={1.4} accent={accent}>
      <Row gap={4} style={{ alignItems: "flex-end", marginBottom: 2 }}>
        <ValueLg style={{ fontSize: FS.fs18 }}>{customer.name}</ValueLg>
        <Value style={{ marginBottom: 1 }}>{honorific(customer.kind)}</Value>
      </Row>
      <Stack gap={0.5} style={{ marginBottom: 4 }}>
        {customer.tradeName ? <Caption style={{ fontSize: FS.fs9 }}>屋号: {customer.tradeName}</Caption> : null}
        {customer.contactPerson ? <Caption style={{ fontSize: FS.fs9 }}>ご担当: {customer.contactPerson}</Caption> : null}
        {customer.postalCode || customer.address ? (
          <Caption style={{ fontSize: FS.fs9 }}>
            {customer.postalCode ? `〒${customer.postalCode}　` : ""}
            {customer.address ?? ""}
          </Caption>
        ) : null}
        {customer.tel ? <Caption style={{ fontSize: FS.fs9 }}>TEL: {customer.tel}</Caption> : null}
      </Stack>
      <View style={{ paddingTop: 5, borderTopWidth: BW.hair, borderTopColor: COLOR.line, borderTopStyle: "solid" }}>
        <Term k="Customer Code" v={customer.customerCode} />
        <Term k="締め日" v={customer.closingDate} />
        <Term k="支払条件" v={customer.paymentTerms} />
        <Term k="取引区分" v={customer.dealClass} />
      </View>
    </PartyBox>
  );
}

function IssuedBy({ brand, salesPerson, accent }: { brand: BrandProfile; salesPerson?: string; accent: string }) {
  const c = brand.contact;
  const rankLabel = brand.business.shopRankLabel || brand.business.shopRank;
  const telFax = [c.tel ? `TEL: ${c.tel}` : "", c.fax ? `FAX: ${c.fax}` : ""].filter(Boolean).join("　");
  // concept-b's Summary Invoice `Issued By` box is a text lockup — unlike the other four documents,
  // the dealer's own mark appears only in this document's footer (`.footer__shop`).
  return (
    <PartyBox label="Issued By · 発行者" flex={1} accent={accent}>
      <ValueLg style={{ fontSize: FS.fs14, marginBottom: 1 }}>{brand.brandNameJa || brand.brandNameEn || ""}</ValueLg>
      {rankLabel ? <Caption style={{ fontSize: FS.fs9, marginBottom: 3 }}>Detailer OS · {rankLabel}</Caption> : null}
      <Stack gap={0.5}>
        {c.postalCode || c.address ? (
          <Caption style={{ fontSize: FS.fs9 }}>
            {c.postalCode ? `〒${c.postalCode}　` : ""}
            {c.address ?? ""}
          </Caption>
        ) : null}
        {telFax ? <Caption style={{ fontSize: FS.fs9 }}>{telFax}</Caption> : null}
      </Stack>
      <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: BW.hair, borderTopColor: COLOR.line, borderTopStyle: "solid" }}>
        {brand.business.invoiceRegistrationNumber ? <Term k="登録番号" v={brand.business.invoiceRegistrationNumber} /> : null}
        <Term k="担当営業" v={salesPerson || brand.business.responsiblePerson} />
      </View>
    </PartyBox>
  );
}

export function SummaryInvoiceCustomerBlock({
  brand,
  customer,
  salesPerson,
}: {
  brand: BrandProfile;
  customer: SummaryInvoiceCustomer;
  salesPerson?: string;
}) {
  const accent = brand.colors.primary || COLOR.textStrong;
  return (
    <Row gap={16} style={{ marginBottom: 12, alignItems: "stretch" }}>
      <BilledTo customer={customer} accent={accent} />
      <IssuedBy brand={brand} salesPerson={salesPerson} accent={accent} />
    </Row>
  );
}
