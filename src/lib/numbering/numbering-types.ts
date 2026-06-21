// Pure types — no "use server" directive

export type DocumentSequenceType =
  | "estimate"
  | "work_order"
  | "completion_report"
  | "invoice"
  | "payment"
  | "maintenance_reminder"
  | "product_order";

export type DocumentResetPolicy = "never" | "yearly" | "monthly";

export interface DocumentSequenceDB {
  id:             string;
  dealer_id:      string;
  sequence_type:  DocumentSequenceType;
  prefix:         string;
  padding:        number;
  reset_policy:   DocumentResetPolicy;
  fiscal_year:    number;
  current_number: number;
  created_at:     string;
  updated_at:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function defaultPrefix(type: DocumentSequenceType): string {
  switch (type) {
    case "estimate":             return "EST";
    case "work_order":           return "WO";
    case "completion_report":    return "REP";
    case "invoice":              return "INV";
    case "payment":              return "PAY";
    case "maintenance_reminder": return "MNT";
    case "product_order":        return "PO";
  }
}

export function sequenceTypeLabel(type: DocumentSequenceType): string {
  switch (type) {
    case "estimate":             return "見積書";
    case "work_order":           return "作業指示書";
    case "completion_report":    return "作業完了報告";
    case "invoice":              return "請求書";
    case "payment":              return "入金";
    case "maintenance_reminder": return "メンテナンス通知";
    case "product_order":        return "商品注文";
  }
}

export function resetPolicyLabel(policy: DocumentResetPolicy): string {
  switch (policy) {
    case "never":   return "リセットなし";
    case "yearly":  return "年次リセット";
    case "monthly": return "月次リセット";
  }
}

/**
 * Formats a document number string.
 * e.g. formatDocumentNumber("EST", 1, 5, 2026) → "EST-2026-00001"
 *      formatDocumentNumber("EST", 1, 5, 0)    → "EST-00001"   (never policy)
 *      formatDocumentNumber("EST", 1, 5, 202606) → "EST-2026-06-00001" (monthly)
 */
export function formatDocumentNumber(
  prefix:    string,
  number:    number,
  padding:   number,
  fiscalYear: number,
): string {
  const numStr = String(number).padStart(padding, "0");
  let yearPart = "";
  if (fiscalYear >= 100000) {
    // monthly: YYYYMM
    const y = String(fiscalYear).slice(0, 4);
    const m = String(fiscalYear).slice(4).padStart(2, "0");
    yearPart = `-${y}-${m}`;
  } else if (fiscalYear > 0) {
    // yearly: YYYY
    yearPart = `-${fiscalYear}`;
  }

  return prefix ? `${prefix}${yearPart}-${numStr}` : `${yearPart.replace(/^-/, "")}-${numStr}`.replace(/^-/, numStr);
}

/**
 * Compute the fiscal_year value for a given reset policy and date.
 */
export function computeFiscalYear(policy: DocumentResetPolicy, date: Date = new Date()): number {
  switch (policy) {
    case "never":   return 0;
    case "yearly":  return date.getFullYear();
    case "monthly": return date.getFullYear() * 100 + (date.getMonth() + 1);
  }
}
