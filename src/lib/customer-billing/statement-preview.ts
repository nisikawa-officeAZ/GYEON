"use server";

// DealerOS — Statement preview service (Phase E8.4, reusable, NO persistence).
//
// Given a customer + reference date, resolves the closing billing period from
// DEALER settings and returns the eligible invoices and aggregate totals. Uses
// invoice issue_date as the ONLY billing reference date. Nothing is persisted;
// no statement records are created. dealer_id always from getCurrentDealer().

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import { resolveDealerBillingMethod, type BillingMethodInfo } from "./billing-method";
import { resolveStatementPeriod, aggregateInvoiceTotals } from "./statement-helpers";
import { buildStatementDetail, type StatementDetailRow, type StatementInvoiceRow } from "./statement-detail";

export interface StatementPreviewResult {
  billingMethod: BillingMethodInfo;
  eligible:      boolean;
  billingPeriod: { periodStart: string; periodEnd: string } | null;
  invoiceCount:  number;
  subtotal:      number;
  tax:           number;
  grandTotal:    number;
  detail:        StatementDetailRow[];
}

type InvoiceQueryRow = StatementInvoiceRow & {
  subtotal?: number | null;
  tax_amount?: number | null;
  paid_amount?: number | null;
  balance_due?: number | null;
};

export async function getStatementPreview(
  customerId: string,
  referenceDate?: string,
): Promise<StatementPreviewResult | { error: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };
  if (!customerId) return { error: "顧客が指定されていません" };

  const ds = await getCanonicalDealerSettings();
  const billingMethod = resolveDealerBillingMethod(ds.dealer_closing_day, ds.dealer_payment_day);

  const base: StatementPreviewResult = {
    billingMethod, eligible: false, billingPeriod: null,
    invoiceCount: 0, subtotal: 0, tax: 0, grandTotal: 0, detail: [],
  };

  // Per-invoice dealers have no statement period → not eligible.
  if (billingMethod.mode !== "closing" || billingMethod.closingDay === null) return base;

  const refDate = referenceDate ?? new Date().toISOString().slice(0, 10);
  const period = resolveStatementPeriod(refDate, billingMethod.closingDay);

  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, issue_date, subtotal, tax_amount, total, paid_amount, balance_due, customer_id, vehicles ( maker, model, plate_number ), invoice_items ( category )",
    )
    .eq("dealer_id", dealer.dealer_id)          // dealer isolation
    .eq("customer_id", customerId)
    .gte("issue_date", period.periodStart)      // billing reference = issue_date
    .lte("issue_date", period.periodEnd)
    .neq("status", "cancelled")
    .is("deleted_at", null);

  const invoices = (data ?? []) as unknown as InvoiceQueryRow[];
  const totals = aggregateInvoiceTotals(invoices);

  return {
    billingMethod,
    eligible:      true,
    billingPeriod: period,
    invoiceCount:  totals.count,
    subtotal:      totals.subtotal,
    tax:           totals.tax_amount,
    grandTotal:    totals.total,
    detail:        buildStatementDetail(invoices),
  };
}
