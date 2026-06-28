// DealerOS — Invoice PDF Template (PHASE54)
// Uses @react-pdf/renderer — NOT "use client" or "use server"

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { InvoiceDB } from "@/lib/invoices/invoice-types";
import { StampBlock } from "@/lib/pdf/stamp-block";
import type { PdfStamp } from "@/lib/stamp/stamp-types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  docTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    textAlign: "right",
    marginBottom: 6,
  },
  docMeta: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
    lineHeight: 1.6,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
  },
  infoBlock: {
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: {
    fontSize: 8,
    color: "#9ca3af",
    width: 60,
  },
  infoValue: {
    fontSize: 8,
    color: "#374151",
    flex: 1,
    textAlign: "right",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  colCategory: { width: 70, fontSize: 8 },
  colName:     { flex: 1,   fontSize: 8 },
  colQty:      { width: 40, fontSize: 8, textAlign: "right" },
  colUnit:     { width: 70, fontSize: 8, textAlign: "right" },
  colTotal:    { width: 70, fontSize: 8, textAlign: "right" },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    fontSize: 8,
  },
  totalsContainer: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 9, color: "#6b7280" },
  totalsValue: { fontSize: 9, color: "#374151" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 6,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" },
  grandTotalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
    paddingTop: 6,
    marginTop: 4,
  },
  balanceLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  balanceValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
});

function yen(n: number): string {
  return "¥" + n.toLocaleString("en-US");
}

const CATEGORY_LABELS: Record<string, string> = {
  coating: "コーティング",
  ppf: "PPF",
  window: "ウィンドウ",
  interior: "インテリア",
  glass: "ガラス",
  other: "その他",
};

interface InvoiceDocumentProps {
  invoice: InvoiceDB;
  stamp?:  PdfStamp | null;
}

function InvoiceDocument({ invoice, stamp }: InvoiceDocumentProps) {
  const items = (invoice.invoice_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const docNo = invoice.invoice_number ?? `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
  const customerName = [invoice.customers?.last_name, invoice.customers?.first_name]
    .filter(Boolean).join(" ") || "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>GYEON Detailer Agent</Text>
            <Text style={styles.companyInfo}>DealerOS — Dealer Management System</Text>
            {stamp && <View style={{ marginTop: 8, alignItems: "flex-start" }}><StampBlock stamp={stamp} /></View>}
          </View>
          <View>
            <Text style={styles.docTitle}>請求書</Text>
            <Text style={styles.docMeta}>請求番号: {docNo}</Text>
            {invoice.issue_date && (
              <Text style={styles.docMeta}>発行日: {invoice.issue_date}</Text>
            )}
            {invoice.due_date && (
              <Text style={styles.docMeta}>支払期限: {invoice.due_date}</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer & Vehicle */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionLabel}>お客様情報</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>顧客名</Text>
              <Text style={styles.infoValue}>{customerName} 様</Text>
            </View>
            {invoice.customers?.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>電話番号</Text>
                <Text style={styles.infoValue}>{invoice.customers.phone}</Text>
              </View>
            )}
            {invoice.customers?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>メール</Text>
                <Text style={styles.infoValue}>{invoice.customers.email}</Text>
              </View>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionLabel}>車両情報</Text>
            {invoice.vehicles?.maker && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>メーカー</Text>
                <Text style={styles.infoValue}>{invoice.vehicles.maker}</Text>
              </View>
            )}
            {invoice.vehicles?.model && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>車種</Text>
                <Text style={styles.infoValue}>{invoice.vehicles.model}</Text>
              </View>
            )}
            {invoice.vehicles?.plate_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ナンバー</Text>
                <Text style={styles.infoValue}>{invoice.vehicles.plate_number}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>明細</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.colCategory, styles.tableHeaderText]}>カテゴリ</Text>
            <Text style={[styles.colName,     styles.tableHeaderText]}>品目名</Text>
            <Text style={[styles.colQty,      styles.tableHeaderText]}>数量</Text>
            <Text style={[styles.colUnit,     styles.tableHeaderText]}>単価</Text>
            <Text style={[styles.colTotal,    styles.tableHeaderText]}>金額</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colCategory}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
              <Text style={styles.colName}>{item.item_name}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{yen(item.unit_price)}</Text>
              <Text style={styles.colTotal}>{yen(item.line_total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>小計</Text>
            <Text style={styles.totalsValue}>{yen(invoice.subtotal)}</Text>
          </View>
          {invoice.discount_amount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>値引き</Text>
              <Text style={[styles.totalsValue, { color: "#ef4444" }]}>
                -{yen(invoice.discount_amount)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>消費税 ({invoice.tax_rate}%)</Text>
            <Text style={styles.totalsValue}>{yen(invoice.tax_amount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>合計</Text>
            <Text style={styles.grandTotalValue}>{yen(invoice.total)}</Text>
          </View>
          {invoice.paid_amount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: "#16a34a" }]}>入金済み</Text>
              <Text style={[styles.totalsValue, { color: "#16a34a" }]}>
                -{yen(invoice.paid_amount)}
              </Text>
            </View>
          )}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>残高</Text>
            <Text style={styles.balanceValue}>{yen(invoice.balance_due)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>GYEON Detailer Agent — DealerOS</Text>
          <Text style={styles.footerText}>{docNo}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  invoice: InvoiceDB,
  stamp?: PdfStamp | null,
): Promise<Buffer> {
  return await renderToBuffer(<InvoiceDocument invoice={invoice} stamp={stamp} />);
}
