// DeliveryNoteCustomerBlock / VehicleBlock / IssuerBlock — the 3-column party grid
// (01 Customer=納品先 / 02 Vehicle=納品対象車両 / 03 Issuer). Built from shared primitives.

import { View, Image } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { Row, Stack, Overline, Caption, Value, ValueLg } from "../../primitives";
import { COLOR, FS } from "../../tokens";
import { honorific } from "../../brand";
import type { BrandProfile } from "../../types";
import type { DeliveryCustomer, DeliveryVehicle } from "./delivery-note-data";

function PartyMarker({ num, en, ja, accent }: { num: string; en: string; ja: string; accent: string }) {
  return (
    <Row gap={6} style={{ alignItems: "center", marginBottom: 2 }}>
      <Value style={{ fontSize: FS.fs14, color: accent }}>{num}</Value>
      <Overline style={{ color: accent }}>{en}</Overline>
      <Caption style={{ fontSize: FS.fs9 }}>{ja}</Caption>
    </Row>
  );
}

function KV({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <Row gap={6} style={{ marginBottom: 0.5 }}>
      <Caption style={{ width: 46, color: COLOR.textMuted, lineHeight: 1.2 }}>{k}</Caption>
      <Value style={{ flex: 1, fontSize: FS.fs10, lineHeight: 1.2 }}>{v}</Value>
    </Row>
  );
}

function Column({ children }: { children: ReactNode }) {
  return <Stack style={{ flex: 1, paddingRight: 6 }}>{children}</Stack>;
}

export function DeliveryNoteCustomerBlock({ customer, accent }: { customer: DeliveryCustomer; accent: string }) {
  return (
    <Column>
      <PartyMarker num="01" en="Customer" ja="納品先" accent={accent} />
      <Row gap={4} style={{ alignItems: "flex-end", marginBottom: 3 }}>
        <ValueLg>{customer.name}</ValueLg>
        <Value style={{ marginBottom: 1 }}>{honorific(customer.kind)}</Value>
      </Row>
      {customer.postalCode || customer.address ? (
        <Caption style={{ marginBottom: 3 }}>
          {customer.postalCode ? `〒${customer.postalCode}  ` : ""}
          {customer.address ?? ""}
        </Caption>
      ) : null}
      <KV k="TEL" v={customer.tel} />
      <KV k="Email" v={customer.email} />
    </Column>
  );
}

export function DeliveryNoteVehicleBlock({ vehicle, accent }: { vehicle: DeliveryVehicle; accent: string }) {
  return (
    <Column>
      <PartyMarker num="02" en="Vehicle" ja="納品対象車両" accent={accent} />
      {vehicle.name ? <ValueLg style={{ fontSize: FS.fs16, marginBottom: 2 }}>{vehicle.name}</ValueLg> : null}
      <KV k="メーカー" v={vehicle.maker} />
      <KV k="年式" v={vehicle.year} />
      <KV k="グレード" v={vehicle.grade} />
      <KV k="ナンバー" v={vehicle.plate} />
      <KV k="ボディカラー" v={vehicle.color} />
      <KV k="走行距離" v={vehicle.mileage} />
    </Column>
  );
}

export function DeliveryNoteIssuerBlock({ brand, accent }: { brand: BrandProfile; accent: string }) {
  const c = brand.contact;
  return (
    <Column>
      <PartyMarker num="03" en="Issuer" ja="発行元" accent={accent} />
      {brand.logoUrl ? (
        <Image src={brand.logoUrl} style={{ height: 16, objectFit: "contain", alignSelf: "flex-start", marginBottom: 3 }} />
      ) : null}
      <ValueLg style={{ fontSize: FS.fs14, marginBottom: 2 }}>{brand.brandNameJa || brand.brandNameEn || ""}</ValueLg>
      {c.postalCode || c.address ? (
        <Caption style={{ marginBottom: 3 }}>
          {c.postalCode ? `〒${c.postalCode}  ` : ""}
          {c.address ?? ""}
        </Caption>
      ) : null}
      <KV k="TEL" v={c.tel} />
      <KV k="FAX" v={c.fax} />
      <KV k="ランク" v={brand.business.shopRankLabel || brand.business.shopRank} />
      <KV k="登録番号" v={brand.business.invoiceRegistrationNumber} />
    </Column>
  );
}
