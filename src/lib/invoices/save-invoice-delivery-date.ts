"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { isValidCalendarDate } from "./invoice-delivery-date";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Single-column CAS: never echo stale title, notes, money or items into a draft. */
export async function saveInvoiceDeliveryDate(invoiceId: string, estimateId: string, date: string, expectedVersion: number) {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: "この操作を行う権限がありません" };
  if (typeof invoiceId !== "string" || !uuid.test(invoiceId)
      || typeof estimateId !== "string" || !uuid.test(estimateId)
      || !isValidCalendarDate(date) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    return { error: "納品日と請求書の内容を再確認してください" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices")
    .update({ delivery_date: date })
    .eq("id", invoiceId).eq("estimate_id", estimateId).eq("dealer_id", auth.dealerId)
    .eq("status", "draft").is("deleted_at", null).eq("content_version", expectedVersion)
    .select("id").maybeSingle();
  if (error || data?.id !== invoiceId) {
    return { error: "保存結果を確認できません。請求書を再確認してください。別の操作で変更・発行された可能性があります。" };
  }
  return { success: true };
}
