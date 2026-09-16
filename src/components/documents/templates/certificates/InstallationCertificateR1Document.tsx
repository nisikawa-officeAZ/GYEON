import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";

import type { InstallationCertificateR1Presentation } from "@/lib/certificates/installation-certificate-r1-artifact-core";

export interface InstallationCertificateR1DocumentProps {
  readonly data: InstallationCertificateR1Presentation;
  readonly logoDataUri: string;
}

const navy = "#11203f";
const gold = "#b99b52";
const muted = "#5f6673";
const line = "#cfd4dc";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9.5,
    color: "#111827",
    backgroundColor: "#ffffff",
    paddingTop: 38,
    paddingBottom: 40,
    paddingHorizontal: 42,
  },
  masthead: { flexDirection: "row", alignItems: "center", minHeight: 76, marginBottom: 14 },
  logoBox: { width: 122, height: 64, justifyContent: "center", alignItems: "flex-start" },
  logo: { width: 112, height: 29, objectFit: "contain" },
  titleBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingRight: 122 },
  title: { fontFamily: "NotoSansJP-Bold", fontSize: 27, letterSpacing: 3.5, color: navy },
  subtitle: { fontSize: 9, letterSpacing: 3, color: muted, marginTop: 4 },
  titleRule: { borderBottomWidth: 2, borderBottomColor: navy, marginBottom: 16 },
  meta: { flexDirection: "row", justifyContent: "flex-end", gap: 22, marginBottom: 17 },
  metaPair: { flexDirection: "row", gap: 6 },
  metaLabel: { color: muted },
  metaValue: { fontFamily: "NotoSansJP-Bold", color: navy },
  statement: {
    backgroundColor: "#f4f6f9",
    borderLeftWidth: 3,
    borderLeftColor: gold,
    paddingVertical: 10,
    paddingHorizontal: 12,
    lineHeight: 1.65,
    marginBottom: 18,
  },
  grid: { flexDirection: "row", gap: 14, marginBottom: 18 },
  panel: { flex: 1, borderTopWidth: 1.5, borderTopColor: navy, paddingTop: 7 },
  panelTitle: { fontFamily: "NotoSansJP-Bold", fontSize: 9, letterSpacing: 1.1, color: navy, marginBottom: 8 },
  principal: { fontFamily: "NotoSansJP-Bold", fontSize: 14, marginBottom: 5 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 62, color: muted, fontSize: 8.5 },
  value: { flex: 1, fontSize: 8.5 },
  worksHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: navy,
    paddingBottom: 6,
  },
  worksTitle: { fontFamily: "NotoSansJP-Bold", fontSize: 11, letterSpacing: 1.3, color: navy },
  worksCount: { marginLeft: "auto", color: muted, fontSize: 8.5 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f6f9",
    borderBottomWidth: 1,
    borderBottomColor: line,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.7,
    borderBottomColor: line,
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  numberCol: { width: 28 },
  categoryCol: { width: 86 },
  workCol: { flex: 1 },
  tableLabel: { fontFamily: "NotoSansJP-Bold", fontSize: 8, color: muted },
  itemName: { fontFamily: "NotoSansJP-Bold", fontSize: 9.5 },
  itemDescription: { fontSize: 8, color: muted, marginTop: 2, lineHeight: 1.45 },
  issuer: { marginTop: 20, marginLeft: "auto", width: "48%", borderTopWidth: 1, borderTopColor: navy, paddingTop: 8 },
  issuerName: { fontFamily: "NotoSansJP-Bold", fontSize: 11, color: navy, marginBottom: 4 },
  issuerLine: { fontSize: 8, color: muted, marginBottom: 2 },
  footer: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 24,
    borderTopWidth: 0.7,
    borderTopColor: line,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: muted },
});

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

function issuerAddress(data: InstallationCertificateR1Presentation): string | undefined {
  const parts = [data.issuer.postalCode ? `〒${data.issuer.postalCode}` : undefined, data.issuer.address]
    .filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(" ") : undefined;
}

export function InstallationCertificateR1Document({ data, logoDataUri }: InstallationCertificateR1DocumentProps) {
  const issuerContact = [data.issuer.tel ? `TEL ${data.issuer.tel}` : undefined, data.issuer.email]
    .filter((value): value is string => Boolean(value)).join("  ");

  return (
    <Document title={`施工証明書 ${data.certificateNumber}`} author={data.issuer.displayName}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.masthead}>
          <View style={styles.logoBox}><Image src={logoDataUri} style={styles.logo} /></View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>施工証明書</Text>
            <Text style={styles.subtitle}>INSTALLATION CERTIFICATE</Text>
          </View>
        </View>
        <View style={styles.titleRule} />

        <View style={styles.meta}>
          <View style={styles.metaPair}><Text style={styles.metaLabel}>証明書番号</Text><Text style={styles.metaValue}>{data.certificateNumber}</Text></View>
          <View style={styles.metaPair}><Text style={styles.metaLabel}>発行日</Text><Text style={styles.metaValue}>{data.issueDate}</Text></View>
        </View>

        <Text style={styles.statement}>下記車両に対し、記載の施工を実施したことを証明します。</Text>

        <View style={styles.grid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>01  CUSTOMER / お客様</Text>
            <Text style={styles.principal}>{data.customer.name} {data.customer.honorific}</Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>02  VEHICLE / 施工車両</Text>
            <Text style={styles.principal}>{data.vehicle.name}</Text>
            <DetailRow label="メーカー" value={data.vehicle.maker} />
            <DetailRow label="モデル" value={data.vehicle.model} />
            <DetailRow label="年式" value={data.vehicle.year} />
            <DetailRow label="グレード" value={data.vehicle.grade} />
            <DetailRow label="車台番号" value={data.vehicle.vin} />
            <DetailRow label="登録番号" value={data.vehicle.plate} />
            <DetailRow label="カラー" value={data.vehicle.color} />
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>03  INSTALLATION / 施工情報</Text>
            <DetailRow label="施工日" value={data.installation.appliedDate} />
            <DetailRow label="施工担当" value={data.installation.technician} />
          </View>
        </View>

        <View style={styles.worksHeader}>
          <Text style={styles.worksTitle}>04  PERFORMED WORK / 施工内容</Text>
          <Text style={styles.worksCount}>{data.items.length} items</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableLabel, styles.numberCol]}>NO.</Text>
          <Text style={[styles.tableLabel, styles.categoryCol]}>CATEGORY</Text>
          <Text style={[styles.tableLabel, styles.workCol]}>ITEM & DESCRIPTION</Text>
        </View>
        {data.items.map((item, index) => (
          <View key={`${index}-${item.category}-${item.name}`} style={styles.tableRow} wrap={false}>
            <Text style={styles.numberCol}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={styles.categoryCol}>{item.category}</Text>
            <View style={styles.workCol}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
            </View>
          </View>
        ))}

        <View style={styles.issuer}>
          <Text style={styles.panelTitle}>ISSUER / 発行元</Text>
          <Text style={styles.issuerName}>{data.issuer.displayName}</Text>
          {data.issuer.companyName ? <Text style={styles.issuerLine}>{data.issuer.companyName}</Text> : null}
          {issuerAddress(data) ? <Text style={styles.issuerLine}>{issuerAddress(data)}</Text> : null}
          {issuerContact ? <Text style={styles.issuerLine}>{issuerContact}</Text> : null}
          {data.issuer.invoiceRegistrationNumber ? <Text style={styles.issuerLine}>登録番号 {data.issuer.invoiceRegistrationNumber}</Text> : null}
          {data.issuer.detailerRank ? <Text style={styles.issuerLine}>{data.issuer.detailerRank}</Text> : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>DETAILER AGENT / INSTALLATION CERTIFICATE</Text>
          <Text style={styles.footerText}>{data.certificateNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
