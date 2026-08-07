"use server";

// B3-B1B I2 — monthly-statement draft creation bound to the accepted atomic D1 RPC.
//
// EXACTLY ONE call to create_monthly_statement_draft_rpc on the authenticated SSR client.
// The RPC owns finance authorization (re-verified in-database), the customer lock, the
// closing-day period derivation, delivery_date-only eligibility, the fixed MIV numbering
// inside the same transaction, and the all-or-nothing header+lines insert. This action
// never allocates numbers and never inserts statements or lines from application code.
//
// The RPC returns the EXISTING exact-scope draft unchanged on re-entry, so the caller must
// treat the returned row as "the draft to open", never as proof a new draft was created.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { isValidCalendarDate } from "@/lib/invoices/invoice-delivery-date";
import type { MonthlyStatementDB } from "./monthly-statement-types";

function mapRpcError(message: string | undefined): string {
  switch (message) {
    case "statement_draft_dealer_required":         return "ディーラー情報が不正です";
    case "statement_draft_customer_required":       return "顧客の選択が必要です";
    case "statement_draft_reference_date_required": return "対象月の指定が必要です";
    case "statement_draft_not_finance_authorized":  return "この操作を行う権限がありません";
    case "statement_draft_actor_mismatch":          return "認証エラー";
    case "statement_draft_customer_not_found":      return "顧客が見つかりません";
    case "statement_draft_dealer_not_closing_mode":
      return "締め日が設定されていません。設定画面でディーラー締め日を登録してください";
    case "statement_draft_period_already_issued":
      return "この期間の月次請求書は既に発行済みです";
    case "statement_draft_no_eligible_invoices":
      return "この期間に納品日の登録された請求対象の請求書がありません";
    case "statement_draft_number_unavailable":      return "月次請求書番号の採番に失敗しました";
    default:
      return message || "月次請求書の作成に失敗しました";
  }
}

export async function createMonthlyStatementDraft(
  customerId: string,
  referenceDate: string,
): Promise<{ error: string } | { success: true; statement: MonthlyStatementDB }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  if (!customerId || typeof customerId !== "string") return { error: "顧客の選択が必要です" };
  // Strict calendar validation (the accepted helper): malformed AND impossible dates
  // (2026-02-30, 2026-13-01, non-leap 02-29, …) are rejected BEFORE any client or RPC use.
  if (!isValidCalendarDate(referenceDate)) {
    return { error: "対象月の指定が不正です" };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user?.id ?? null;
  if (!actor) return { error: "認証エラー" };

  const { data, error } = await supabase.rpc("create_monthly_statement_draft_rpc", {
    p_dealer_id:      auth.dealerId,   // server-resolved tenant; RPC re-verifies finance authority
    p_actor:          actor,           // session user; a mismatch is rejected in-database
    p_customer_id:    customerId,
    p_reference_date: referenceDate,
  });

  if (error || !data) {
    console.error("createMonthlyStatementDraft rpc error:", error);
    return { error: mapRpcError(error?.message) };
  }
  const statement = (Array.isArray(data) ? data[0] : data) as MonthlyStatementDB;
  return { success: true, statement };
}
