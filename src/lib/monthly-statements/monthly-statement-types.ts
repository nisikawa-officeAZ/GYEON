// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B2 — monthly statement types.
//
// Pure types — no "use server", no Supabase, no network. The monthly statement (月次請求書) is a
// DISTINCT persisted aggregate: monthly_statements + monthly_statement_lines. It is NEVER a synthetic
// single invoice row. Every money field is numeric; every snapshot is a JSON object frozen at issue.

export type MonthlyStatementStatus = "draft" | "issued" | "voided";

/** Invoice statuses eligible to appear on a monthly statement. Draft/cancelled are excluded. */
export const ELIGIBLE_INVOICE_STATUSES = ["issued", "paid", "partially_paid", "overdue"] as const;
export type EligibleInvoiceStatus = (typeof ELIGIBLE_INVOICE_STATUSES)[number];

export interface MonthlyStatementDB {
  id:                     string;
  dealer_id:              string;
  customer_id:            string;
  statement_number:       string | null;
  status:                 MonthlyStatementStatus;
  period_start:           string;       // YYYY-MM-DD (inclusive)
  period_end:             string;       // YYYY-MM-DD (inclusive)
  closing_date:           string;       // = period_end
  payment_due_date:       string | null;
  previous_statement_id:  string | null;
  opening_balance:        number;
  current_subtotal:       number;
  current_discount:       number;
  current_tax:            number;
  current_total:          number;
  allocated_payments_total: number;
  adjustments_total:      number;
  closing_balance:        number;
  customer_snapshot:      Record<string, unknown>;
  dealer_snapshot:        Record<string, unknown>;
  billing_terms_snapshot: Record<string, unknown>;
  tax_summary_snapshot:   Record<string, unknown>;
  issued_at:              string | null;
  issued_by:              string | null;
  voided_at:              string | null;
  voided_by:              string | null;
  void_reason:            string | null;
  created_at:             string;
  updated_at:             string;
}

export interface MonthlyStatementLineDB {
  id:                        string;
  dealer_id:                 string;
  customer_id:               string;
  statement_id:              string;
  invoice_id:                string;
  delivery_date:             string;    // required; sourced only from invoices.delivery_date
  invoice_number:            string | null;
  vehicle_snapshot:          Record<string, unknown>;
  work_description_snapshot: string;
  subtotal_snapshot:         number;
  discount_snapshot:         number;
  tax_rate_snapshot:         number;
  tax_snapshot:              number;
  total_snapshot:            number;
  sort_order:                number;
  created_at:                string;
}

export function monthlyStatementStatusLabel(status: MonthlyStatementStatus): string {
  switch (status) {
    case "draft":  return "下書き";
    case "issued": return "発行済み";
    case "voided": return "取消済み";
  }
}
