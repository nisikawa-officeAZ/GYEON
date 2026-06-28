// DealerOS — Completion Report PDF Template (PHASE54)
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
import { CompletionReportFullData } from "@/lib/completion-reports/completion-report-types";
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
    fontSize: 20,
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
    width: 70,
  },
  infoValue: {
    fontSize: 8,
    color: "#374151",
    flex: 1,
    textAlign: "right",
  },
  workInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  workInfoPair: {
    flexDirection: "row",
    width: "48%",
  },
  workInfoLabel: {
    fontSize: 8,
    color: "#9ca3af",
    width: 60,
  },
  workInfoValue: {
    fontSize: 8,
    color: "#374151",
    flex: 1,
  },
  summaryBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  summaryText: {
    fontSize: 8,
    color: "#374151",
    lineHeight: 1.6,
  },
  messageBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    padding: 10,
  },
  messageText: {
    fontSize: 9,
    color: "#1e3a5f",
    lineHeight: 1.7,
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
  nextMaintenanceBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextMaintenanceLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
  },
  nextMaintenanceValue: {
    fontSize: 9,
    color: "#15803d",
    fontFamily: "Helvetica-Bold",
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP");
}

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

const CATEGORY_LABELS: Record<string, string> = {
  coating: "コーティング",
  ppf: "PPF",
  window: "ウィンドウ",
  interior: "インテリア",
  glass: "ガラス",
  other: "その他",
};

interface CompletionReportDocumentProps {
  data:   CompletionReportFullData;
  stamp?: PdfStamp | null;
}

function CompletionReportDocument({ data, stamp }: CompletionReportDocumentProps) {
  const { report, dealer, work_order: wo } = data;
  const customer = wo?.customers ?? null;
  const vehicle  = wo?.vehicles  ?? null;
  const estimate = wo?.estimates ?? null;
  const items = (estimate?.estimate_items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  const docNo = report.report_number ?? `RPT-${report.id.slice(0, 8).toUpperCase()}`;
  const customerName = [customer?.last_name, customer?.first_name].filter(Boolean).join(" ") || "—";
  const dealerName = dealer?.name ?? "GYEON Detailer Agent";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{dealerName}</Text>
            {dealer?.address && (
              <Text style={styles.companyInfo}>{dealer.prefecture ?? ""} {dealer.address}</Text>
            )}
            {dealer?.phone && (
              <Text style={styles.companyInfo}>TEL: {dealer.phone}</Text>
            )}
            {stamp && <View style={{ marginTop: 8, alignItems: "flex-start" }}><StampBlock stamp={stamp} /></View>}
          </View>
          <View>
            <Text style={styles.docTitle}>作業完了報告書</Text>
            <Text style={styles.docMeta}>報告番号: {docNo}</Text>
            <Text style={styles.docMeta}>作業日: {formatDate(report.report_date)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer & Vehicle */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionLabel}>お客様</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>顧客名</Text>
              <Text style={styles.infoValue}>{customerName} 様</Text>
            </View>
            {customer?.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>電話番号</Text>
                <Text style={styles.infoValue}>{customer.phone}</Text>
              </View>
            )}
            {customer?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>メール</Text>
                <Text style={styles.infoValue}>{customer.email}</Text>
              </View>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.sectionLabel}>車両情報</Text>
            {(vehicle?.maker || vehicle?.model) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>車種</Text>
                <Text style={styles.infoValue}>
                  {[vehicle?.maker, vehicle?.model].filter(Boolean).join(" ")}
                </Text>
              </View>
            )}
            {vehicle?.plate_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ナンバー</Text>
                <Text style={styles.infoValue}>{vehicle.plate_number}</Text>
              </View>
            )}
            {vehicle?.color && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>カラー</Text>
                <Text style={styles.infoValue}>{vehicle.color}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Work Order Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>施工情報</Text>
          <View style={styles.workInfoGrid}>
            {wo?.work_order_number && (
              <View style={styles.workInfoPair}>
                <Text style={styles.workInfoLabel}>作業番号</Text>
                <Text style={styles.workInfoValue}>{wo.work_order_number}</Text>
              </View>
            )}
            {wo?.assigned_staff && (
              <View style={styles.workInfoPair}>
                <Text style={styles.workInfoLabel}>担当者</Text>
                <Text style={styles.workInfoValue}>{wo.assigned_staff}</Text>
              </View>
            )}
            {wo?.actual_start_at && (
              <View style={styles.workInfoPair}>
                <Text style={styles.workInfoLabel}>施工開始</Text>
                <Text style={styles.workInfoValue}>{formatDatetime(wo.actual_start_at)}</Text>
              </View>
            )}
            {wo?.actual_end_at && (
              <View style={styles.workInfoPair}>
                <Text style={styles.workInfoLabel}>施工終了</Text>
                <Text style={styles.workInfoValue}>{formatDatetime(wo.actual_end_at)}</Text>
              </View>
            )}
          </View>
          {wo?.service_summary && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{wo.service_summary}</Text>
            </View>
          )}
        </View>

        {/* Estimate Items */}
        {items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>施工内容明細</Text>
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
            {estimate && (
              <View style={{ alignItems: "flex-end", marginTop: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", width: 160, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 9, color: "#6b7280" }}>合計</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827" }}>{yen(estimate.total)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Customer Message */}
        {report.customer_message && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>お客様へのメッセージ</Text>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{report.customer_message}</Text>
            </View>
          </View>
        )}

        {/* Next Maintenance Date */}
        {report.next_maintenance_date && (
          <View style={styles.nextMaintenanceBox}>
            <Text style={styles.nextMaintenanceLabel}>次回メンテナンス推奨日:</Text>
            <Text style={styles.nextMaintenanceValue}>{formatDate(report.next_maintenance_date)}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{dealerName} — DealerOS</Text>
          <Text style={styles.footerText}>{docNo}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCompletionReportPdf(
  report: CompletionReportFullData,
  stamp?: PdfStamp | null,
): Promise<Buffer> {
  return await renderToBuffer(<CompletionReportDocument data={report} stamp={stamp} />);
}
