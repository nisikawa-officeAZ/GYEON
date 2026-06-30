// DealerOS — Product Order PDF Template (PHASE54)
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
import { ProductOrderDB, orderDisplayNo, orderStatusLabel, orderTotal } from "@/lib/product-orders/product-order-types";
import { registerPdfFonts } from "@/lib/pdf/register-fonts";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
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
    fontFamily: "NotoSansJP-Bold",
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
    fontFamily: "NotoSansJP-Bold",
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
    fontFamily: "NotoSansJP-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
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
  colSku:      { width: 80,  fontSize: 8, fontFamily: "Courier" },
  colName:     { flex: 1,    fontSize: 8 },
  colPrice:    { width: 70,  fontSize: 8, textAlign: "right" },
  colQty:      { width: 40,  fontSize: 8, textAlign: "right" },
  colSubtotal: { width: 75,  fontSize: 8, textAlign: "right" },
  tableHeaderText: {
    fontFamily: "NotoSansJP-Bold",
    color: "#6b7280",
    fontSize: 8,
  },
  totalsContainer: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 180,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 6,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 11, fontFamily: "NotoSansJP-Bold", color: "#111827" },
  grandTotalValue: { fontSize: 11, fontFamily: "NotoSansJP-Bold", color: "#111827" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  statusLabel: { fontSize: 8, color: "#9ca3af" },
  statusValue: { fontSize: 9, fontFamily: "NotoSansJP-Bold", color: "#374151" },
  notesBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  notesText: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.5,
  },
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

interface ProductOrderDocumentProps {
  order: ProductOrderDB;
}

function ProductOrderDocument({ order }: ProductOrderDocumentProps) {
  const items = order.product_order_items ?? [];
  const total = orderTotal(items);
  const docNo = orderDisplayNo(order);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>GYEON Detailer Agent</Text>
            <Text style={styles.companyInfo}>DealerOS — Dealer Management System</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>商品注文書</Text>
            <Text style={styles.docMeta}>注文番号: {docNo}</Text>
            {order.order_date && (
              <Text style={styles.docMeta}>注文日: {order.order_date}</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Status */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusLabel}>ステータス:</Text>
          <Text style={styles.statusValue}>{orderStatusLabel(order.status)}</Text>
        </View>

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>注文明細</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.colSku,      styles.tableHeaderText]}>SKU</Text>
            <Text style={[styles.colName,     styles.tableHeaderText]}>商品名</Text>
            <Text style={[styles.colPrice,    styles.tableHeaderText]}>定価</Text>
            <Text style={[styles.colQty,      styles.tableHeaderText]}>数量</Text>
            <Text style={[styles.colSubtotal, styles.tableHeaderText]}>小計</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colSku}>{item.sku}</Text>
              <Text style={styles.colName}>{item.product_name_snapshot}</Text>
              <Text style={styles.colPrice}>
                {item.retail_price_snapshot != null ? yen(item.retail_price_snapshot) : "—"}
              </Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colSubtotal}>{yen(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalsContainer}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>合計（定価ベース）</Text>
            <Text style={styles.grandTotalValue}>{yen(total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {order.notes && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionLabel}>備考</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>GYEON Detailer Agent — DealerOS</Text>
          <Text style={styles.footerText}>{docNo}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderProductOrderPdf(order: ProductOrderDB): Promise<Buffer> {
  registerPdfFonts();
  return await renderToBuffer(<ProductOrderDocument order={order} />);
}
