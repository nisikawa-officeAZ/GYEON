// DealerOS — Statement (統合請求書) PDF Template (Phase E8.5)
// Non-persisted: rendered on demand from the Statement Preview service.
// Uses @react-pdf/renderer — NOT "use client" or "use server".

import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { BrandingIdentity, BrandingFooterLines } from "@/lib/pdf/branding-blocks";
import type { DealerBranding } from "@/lib/pdf/dealer-branding-types";
import { registerPdfFonts } from "@/lib/pdf/register-fonts";

export interface StatementPdfRow {
  issueDate:          string;
  vehicleName:        string;
  registrationNumber: string;
  serviceCategory:    string;
  invoiceNumber:      string;
  invoiceTotal:       number;
}

export interface StatementPdfData {
  customerName:   string;
  periodStart:    string;
  periodEnd:      string;
  closingDay:     number | null;
  paymentDueDate: string | null;
  rows:           StatementPdfRow[];
  invoiceCount:   number;
  subtotal:       number;
  tax:            number;
  grandTotal:     number;
}

const yen = (n: number) => "¥" + (Number.isFinite(n) ? n : 0).toLocaleString("ja-JP");

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, color: "#111827", backgroundColor: "#fff", paddingTop: 40, paddingBottom: 48, paddingLeft: 48, paddingRight: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  docTitle: { fontSize: 22, fontFamily: "NotoSansJP-Bold", color: "#111827", textAlign: "right", marginBottom: 6 },
  docMeta: { fontSize: 9, color: "#6b7280", textAlign: "right", lineHeight: 1.6 },
  custName: { fontSize: 13, fontFamily: "NotoSansJP-Bold", color: "#111827", marginBottom: 2 },
  custSub: { fontSize: 9, color: "#6b7280" },
  metaBox: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 16, padding: 10, backgroundColor: "#f8fafc", borderRadius: 4 },
  metaLabel: { fontSize: 8, color: "#6b7280" },
  metaValue: { fontSize: 10, fontFamily: "NotoSansJP-Bold", color: "#111827", marginTop: 2 },
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111827", paddingBottom: 4, marginTop: 4 },
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 4 },
  th: { fontSize: 8, color: "#6b7280" },
  td: { fontSize: 8, color: "#111827" },
  cDate: { width: "14%" },
  cVeh:  { width: "24%" },
  cReg:  { width: "16%" },
  cCat:  { width: "14%" },
  cNo:   { width: "16%" },
  cAmt:  { width: "16%", textAlign: "right" },
  empty: { fontSize: 10, color: "#9ca3af", textAlign: "center", paddingVertical: 24 },
  summary: { marginTop: 16, marginLeft: "auto", width: "50%" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  sumLabel: { fontSize: 9, color: "#6b7280" },
  sumValue: { fontSize: 10, color: "#111827" },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: "#111827" },
  grandLabel: { fontSize: 11, fontFamily: "NotoSansJP-Bold", color: "#111827" },
  grandValue: { fontSize: 13, fontFamily: "NotoSansJP-Bold", color: "#1d4ed8" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48 },
});

function StatementDocument({ data, branding }: { data: StatementPdfData; branding?: DealerBranding | null }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View><BrandingIdentity branding={branding} /></View>
          <View>
            <Text style={styles.docTitle}>統合請求書</Text>
            <Text style={styles.docMeta}>請求期間: {data.periodStart} 〜 {data.periodEnd}</Text>
            {data.closingDay != null && <Text style={styles.docMeta}>締め日: {data.closingDay}日</Text>}
            {data.paymentDueDate && <Text style={styles.docMeta}>支払期限: {data.paymentDueDate}</Text>}
          </View>
        </View>

        <View>
          <Text style={styles.custName}>{data.customerName || "—"} 御中</Text>
          <Text style={styles.custSub}>下記の通りご請求申し上げます。</Text>
        </View>

        {/* Summary strip */}
        <View style={styles.metaBox}>
          <View><Text style={styles.metaLabel}>請求件数</Text><Text style={styles.metaValue}>{data.invoiceCount} 件</Text></View>
          <View><Text style={styles.metaLabel}>小計</Text><Text style={styles.metaValue}>{yen(data.subtotal)}</Text></View>
          <View><Text style={styles.metaLabel}>消費税</Text><Text style={styles.metaValue}>{yen(data.tax)}</Text></View>
          <View><Text style={styles.metaLabel}>合計</Text><Text style={styles.metaValue}>{yen(data.grandTotal)}</Text></View>
        </View>

        {/* Detail table */}
        <View style={styles.tHead}>
          <Text style={[styles.th, styles.cDate]}>発行日</Text>
          <Text style={[styles.th, styles.cVeh]}>車両</Text>
          <Text style={[styles.th, styles.cReg]}>登録番号</Text>
          <Text style={[styles.th, styles.cCat]}>区分</Text>
          <Text style={[styles.th, styles.cNo]}>請求番号</Text>
          <Text style={[styles.th, styles.cAmt]}>金額</Text>
        </View>
        {data.rows.length === 0 ? (
          <Text style={styles.empty}>対象請求書はありません</Text>
        ) : (
          data.rows.map((r, i) => (
            <View style={styles.tRow} key={i}>
              <Text style={[styles.td, styles.cDate]}>{r.issueDate}</Text>
              <Text style={[styles.td, styles.cVeh]}>{r.vehicleName}</Text>
              <Text style={[styles.td, styles.cReg]}>{r.registrationNumber}</Text>
              <Text style={[styles.td, styles.cCat]}>{r.serviceCategory}</Text>
              <Text style={[styles.td, styles.cNo]}>{r.invoiceNumber}</Text>
              <Text style={[styles.td, styles.cAmt]}>{yen(r.invoiceTotal)}</Text>
            </View>
          ))
        )}

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>小計</Text><Text style={styles.sumValue}>{yen(data.subtotal)}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>消費税</Text><Text style={styles.sumValue}>{yen(data.tax)}</Text></View>
          <View style={styles.grand}><Text style={styles.grandLabel}>合計金額</Text><Text style={styles.grandValue}>{yen(data.grandTotal)}</Text></View>
        </View>

        {/* Footer (Dealer Branding Engine) */}
        <View style={styles.footer} fixed>
          <BrandingFooterLines branding={branding} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderStatementPdf(data: StatementPdfData, branding?: DealerBranding | null): Promise<Buffer> {
  registerPdfFonts();
  return await renderToBuffer(<StatementDocument data={data} branding={branding} />);
}
