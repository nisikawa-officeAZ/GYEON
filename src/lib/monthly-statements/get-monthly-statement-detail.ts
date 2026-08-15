"use server";

// B3-B1B I2 — monthly-statement detail read model (authenticated RLS reads only).
//
// ISSUED / VOIDED statements display ONLY the stored authoritative totals and the persisted
// receipt snapshots — nothing is recomputed from live payment data. A DRAFT additionally
// carries a live PREVIEW computed from persisted evidence through the ACCEPTED pure cores
// (statement lines, completed customer receipts by payment_date, adjustments, predecessor
// closing balance). Preview closing balance is ALWAYS
//   opening_balance + current_total - payments_received_total + adjustments_total
// and the receipt identity payments_received = allocated + unapplied is surfaced. Any
// non-finite monetary input makes the cores throw and this read model fail closed.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  MonthlyStatementDB,
  MonthlyStatementLineDB,
  MonthlyStatementReceiptDB,
  MonthlyStatementAdjustmentDB,
} from "./monthly-statement-types";
import { computeClosingBalance, reconcileReceiptTotals, resolveOpeningBalance } from "./monthly-statement-core";
import {
  CandidatePayment,
  ReceiptSplit,
  selectPeriodReceipts,
  splitReceipt,
  summarizeReceiptTotals,
} from "./statement-receipt-core";
import { aggregateAdjustmentsTotal } from "./statement-adjustment-core";

export interface StatementDisplayTotals {
  opening_balance:          number;
  current_subtotal:         number;
  current_discount:         number;
  current_tax:              number;
  current_total:            number;
  payments_received_total:  number;
  allocated_payments_total: number;
  unapplied_credit_total:   number;
  adjustments_total:        number;
  closing_balance:          number;
  reconciles:               boolean;   // payments_received = allocated + unapplied
  source:                   "stored" | "draft_preview";
}

export interface MonthlyStatementDetail {
  statement:       MonthlyStatementDB;
  lines:           MonthlyStatementLineDB[];
  receipts:        MonthlyStatementReceiptDB[];      // persisted snapshots (issued/voided)
  adjustments:     MonthlyStatementAdjustmentDB[];
  previewReceipts: ReceiptSplit[];                   // draft only: live candidate split
  totals:          StatementDisplayTotals;
}

function assertFinite(label: string, v: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`monthly-statement-detail: non-finite ${label}`);
  }
  return v;
}

export async function getMonthlyStatementDetail(
  statementId: string,
): Promise<{ error: string } | { success: true; detail: MonthlyStatementDetail }> {
  if (!statementId) return { error: "月次請求書が見つかりません" };
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  const { data: statement } = await supabase
    .from("monthly_statements")
    .select("*")
    .eq("id", statementId)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();
  if (!statement) return { error: "月次請求書が見つかりません" };
  const stmt = statement as MonthlyStatementDB;

  const [linesRes, receiptsRes, adjustmentsRes] = [
    await supabase
      .from("monthly_statement_lines")
      .select("*")
      .eq("statement_id", stmt.id)
      .order("sort_order", { ascending: true }),
    await supabase
      .from("monthly_statement_receipts")
      .select("*")
      .eq("statement_id", stmt.id)
      .order("payment_date_snapshot", { ascending: true })
      .order("id", { ascending: true }),
    await supabase
      .from("monthly_statement_adjustments")
      .select("*")
      .eq("statement_id", stmt.id)
      .order("created_at", { ascending: true }),
  ];
  if (linesRes.error || receiptsRes.error || adjustmentsRes.error) {
    console.error("getMonthlyStatementDetail error:", linesRes.error ?? receiptsRes.error ?? adjustmentsRes.error);
    return { error: "月次請求書の読み込みに失敗しました" };
  }
  const lines = (linesRes.data ?? []) as MonthlyStatementLineDB[];
  const receipts = (receiptsRes.data ?? []) as MonthlyStatementReceiptDB[];
  const adjustments = (adjustmentsRes.data ?? []) as MonthlyStatementAdjustmentDB[];

  try {
    if (stmt.status !== "draft") {
      // ── ISSUED / VOIDED: stored authoritative totals + persisted snapshots ONLY ──
      const totals: StatementDisplayTotals = {
        opening_balance:          assertFinite("opening_balance", stmt.opening_balance),
        current_subtotal:         assertFinite("current_subtotal", stmt.current_subtotal),
        current_discount:         assertFinite("current_discount", stmt.current_discount),
        current_tax:              assertFinite("current_tax", stmt.current_tax),
        current_total:            assertFinite("current_total", stmt.current_total),
        payments_received_total:  assertFinite("payments_received_total", stmt.payments_received_total),
        allocated_payments_total: assertFinite("allocated_payments_total", stmt.allocated_payments_total),
        unapplied_credit_total:   assertFinite("unapplied_credit_total", stmt.unapplied_credit_total),
        adjustments_total:        assertFinite("adjustments_total", stmt.adjustments_total),
        closing_balance:          assertFinite("closing_balance", stmt.closing_balance),
        reconciles: reconcileReceiptTotals({
          payments_received_total:  stmt.payments_received_total,
          allocated_payments_total: stmt.allocated_payments_total,
          unapplied_credit_total:   stmt.unapplied_credit_total,
        }),
        source: "stored",
      };
      return {
        success: true,
        detail: { statement: stmt, lines, receipts, adjustments, previewReceipts: [], totals },
      };
    }

    // ── DRAFT: live preview from persisted evidence through the accepted pure cores ──
    // Line totals: the persisted line snapshots are the statement's own stored evidence.
    let current_subtotal = 0, current_discount = 0, current_tax = 0, current_total = 0;
    for (const l of lines) {
      current_subtotal += assertFinite("subtotal_snapshot", l.subtotal_snapshot);
      current_discount += assertFinite("discount_snapshot", l.discount_snapshot);
      current_tax      += assertFinite("tax_snapshot", l.tax_snapshot);
      current_total    += assertFinite("total_snapshot", l.total_snapshot);
    }

    // Candidate receipts: completed customer payments selected by payment_date in-period,
    // excluding payments already captured by another NON-VOIDED statement's receipts.
    const paymentsRes = await supabase
      .from("payments")
      .select("id, dealer_id, customer_id, status, payment_date, amount, invoice_id, payment_number, payment_method, payment_allocations ( allocated_amount )")
      .eq("dealer_id", dealer.dealer_id)
      .eq("customer_id", stmt.customer_id)
      .eq("status", "completed")
      .gte("payment_date", stmt.period_start)
      .lte("payment_date", stmt.period_end);
    if (paymentsRes.error) {
      console.error("getMonthlyStatementDetail payments error:", paymentsRes.error);
      return { error: "入金情報の読み込みに失敗しました" };
    }
    type PaymentRow = {
      id: string; dealer_id: string; customer_id: string | null; status: string;
      payment_date: string | null; amount: number; invoice_id: string | null;
      payment_number: string | null; payment_method: string | null;
      payment_allocations: { allocated_amount: number }[] | null;
    };
    const paymentRows = (paymentsRes.data ?? []) as unknown as PaymentRow[];

    let captured = new Set<string>();
    if (paymentRows.length > 0) {
      const capturedRes = await supabase
        .from("monthly_statement_receipts")
        .select("payment_id, monthly_statements ( status )")
        .in("payment_id", paymentRows.map((p) => p.id));
      if (capturedRes.error) {
        console.error("getMonthlyStatementDetail captured error:", capturedRes.error);
        return { error: "入金情報の読み込みに失敗しました" };
      }
      captured = new Set(
        ((capturedRes.data ?? []) as unknown as { payment_id: string; monthly_statements: { status: string } | null }[])
          .filter((r) => r.monthly_statements && r.monthly_statements.status !== "voided")
          .map((r) => r.payment_id),
      );
    }

    const candidates: CandidatePayment[] = paymentRows
      .filter((p) => !captured.has(p.id))
      .map((p) => ({
        id: p.id, dealer_id: p.dealer_id, customer_id: p.customer_id, status: p.status,
        payment_date: p.payment_date, amount: p.amount, invoice_id: p.invoice_id,
        allocated_sum: (p.payment_allocations ?? []).reduce((s, a) => s + a.allocated_amount, 0),
        payment_number: p.payment_number, payment_method: p.payment_method,
      }));

    const periodReceipts = selectPeriodReceipts(
      candidates,
      { dealerId: dealer.dealer_id, customerId: stmt.customer_id },
      { period_start: stmt.period_start, period_end: stmt.period_end },
    );
    const receiptTotals = summarizeReceiptTotals(periodReceipts);
    const previewReceipts = periodReceipts.map(splitReceipt);

    const adjustments_total = aggregateAdjustmentsTotal(
      adjustments.map((a) => ({ signed_amount: a.signed_amount, reason: a.reason })),
    );

    // Predecessor: latest ISSUED statement of the same scope ending before this period.
    const prevRes = await supabase
      .from("monthly_statements")
      .select("id, closing_balance")
      .eq("dealer_id", dealer.dealer_id)
      .eq("customer_id", stmt.customer_id)
      .eq("status", "issued")
      .lt("period_end", stmt.period_start)
      .order("period_end", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
    if (prevRes.error) {
      console.error("getMonthlyStatementDetail predecessor error:", prevRes.error);
      return { error: "前月残高の読み込みに失敗しました" };
    }
    const prev = (prevRes.data ?? [])[0] as { closing_balance: number } | undefined;
    const opening_balance = resolveOpeningBalance(prev ?? null);

    // The ACCEPTED closing formula — payments_received_total, never the allocated component.
    const closing_balance = computeClosingBalance({
      opening_balance,
      current_total,
      payments_received_total: receiptTotals.payments_received_total,
      adjustments_total,
    });

    const totals: StatementDisplayTotals = {
      opening_balance,
      current_subtotal,
      current_discount,
      current_tax,
      current_total,
      payments_received_total:  receiptTotals.payments_received_total,
      allocated_payments_total: receiptTotals.allocated_payments_total,
      unapplied_credit_total:   receiptTotals.unapplied_credit_total,
      adjustments_total,
      closing_balance,
      reconciles: reconcileReceiptTotals(receiptTotals),
      source: "draft_preview",
    };
    return {
      success: true,
      detail: { statement: stmt, lines, receipts, adjustments, previewReceipts, totals },
    };
  } catch (err) {
    // The pure cores throw on invalid/non-finite monetary data — fail closed, never render junk.
    console.error("getMonthlyStatementDetail totals error:", err);
    return { error: "金額データが不正なため表示できません" };
  }
}
