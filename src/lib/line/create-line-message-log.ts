"use server";

// DealerOS — LINE Message Log CRUD (PHASE47)
// Creates and updates log entries for LINE send operations.
// Called by send-line-message.ts around every LINE API call.

import { SupabaseClient } from "@supabase/supabase-js";
import { LineMessageInput, LineMessagePurpose } from "./line-message-types";

// ─── Create pending log ───────────────────────────────────────────────────────

export async function createPendingLog(
  supabase: SupabaseClient,
  dealerId: string,
  input: LineMessageInput
): Promise<string | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("line_message_logs")
    .insert({
      dealer_id:        dealerId,
      customer_id:      input.customer_id      ?? null,
      line_customer_id: input.line_customer_id ?? null,
      line_user_id:     input.line_user_id,
      message_type:     input.message_type     ?? "text",
      purpose:          input.purpose,
      title:            input.title            ?? null,
      body:             input.body,
      payload:          input.payload          ?? null,
      status:           "pending",
      retry_count:      0,
      created_at:       now,
      updated_at:       now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createPendingLog error:", error);
    return null;
  }

  return data.id as string;
}

// ─── Mark as sent ─────────────────────────────────────────────────────────────

export async function markLogSent(
  supabase: SupabaseClient,
  logId: string,
  dealerId: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("line_message_logs")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", logId)
    .eq("dealer_id", dealerId);
}

// ─── Mark as failed ───────────────────────────────────────────────────────────

export async function markLogFailed(
  supabase: SupabaseClient,
  logId: string,
  dealerId: string,
  errorMessage: string
): Promise<void> {
  const now = new Date().toISOString();

  // Fetch current retry_count
  const { data } = await supabase
    .from("line_message_logs")
    .select("retry_count")
    .eq("id", logId)
    .eq("dealer_id", dealerId)
    .maybeSingle();

  const retryCount = (data?.retry_count ?? 0) as number;

  await supabase
    .from("line_message_logs")
    .update({
      status:        "failed",
      failed_at:     now,
      error_message: errorMessage,
      retry_count:   retryCount + 1,
      updated_at:    now,
    })
    .eq("id", logId)
    .eq("dealer_id", dealerId);
}

// ─── Mark as cancelled ────────────────────────────────────────────────────────

export async function markLogCancelled(
  supabase: SupabaseClient,
  logId: string,
  dealerId: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("line_message_logs")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", logId)
    .eq("dealer_id", dealerId);
}

// ─── Convenience: create log for a purpose (no send) ─────────────────────────

export async function logLineMessage(
  supabase: SupabaseClient,
  dealerId: string,
  params: {
    lineUserId:      string;
    customerId?:     string | null;
    lineCustomerId?: string | null;
    purpose:         LineMessagePurpose;
    title?:          string | null;
    body:            string;
    status:          "sent" | "failed" | "cancelled";
    errorMessage?:   string | null;
    payload?:        Record<string, unknown> | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("line_message_logs").insert({
    dealer_id:        dealerId,
    customer_id:      params.customerId     ?? null,
    line_customer_id: params.lineCustomerId ?? null,
    line_user_id:     params.lineUserId,
    message_type:     "text",
    purpose:          params.purpose,
    title:            params.title          ?? null,
    body:             params.body,
    payload:          params.payload        ?? null,
    status:           params.status,
    sent_at:          params.status === "sent"   ? now : null,
    failed_at:        params.status === "failed" ? now : null,
    error_message:    params.errorMessage   ?? null,
    retry_count:      0,
    created_at:       now,
    updated_at:       now,
  });
}
