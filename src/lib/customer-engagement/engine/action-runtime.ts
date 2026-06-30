// Phase 4 Sprint 5 — Real (non-AI) engagement action executors.
//
// Activates the action-dispatcher's non-AI branches by routing them to EXISTING
// infrastructure only (no new tables, no schema change):
//   - LINE actions (send_line_message / request_review) → queueLineNotification
//       → line_notification_queue (delivered by the Sprint 3 credential-gated processor)
//   - schedule_maintenance_reminder → createMaintenanceReminder → maintenance_reminders
//   - audit of every outcome → activity_logs
//
// Security:
//   - dealer_id ALWAYS from EngagementContext (server-resolved via getCurrentDealer in
//     createEngagementContext). Never from client input.
//   - Customer messaging is GATED by customers.line_connected.
//   - Pre-enqueue DEDUP prevents duplicate queued notifications (same engagement event
//     re-fire) and, for MAINTENANCE_DUE, prevents doubling the Sprint 1–3 reminder
//     pipeline (whose queue items carry payload.reminder_id).
//   - No AI activation; no direct LINE send here (delivery stays with the queue cron).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { queueLineNotification } from "@/lib/line/queue-line-notification";
import { createMaintenanceReminder } from "@/lib/maintenance/create-maintenance-reminder";
import type { LineActionPayload } from "./line-dry-run";
import type { EngagementAction, EngagementContext } from "../types";
import type { ActionDispatchResult } from "./types";

function dedupRefOf(context: EngagementContext, action: EngagementAction): string {
  return `${context.event_type}:${action.id}:${context.job_id ?? context.customer_id}`;
}

async function customerLineConnected(
  supabase: SupabaseClient,
  dealerId: string,
  customerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("customers")
    .select("line_connected")
    .eq("id",        customerId)
    .eq("dealer_id", dealerId)
    .maybeSingle();
  return !!data?.line_connected;
}

async function alreadyQueued(
  supabase: SupabaseClient,
  context: EngagementContext,
  dedupRef: string,
): Promise<boolean> {
  // (1) Same engagement event re-fire → matching dedup_ref already queued/sent.
  const { data: byRef } = await supabase
    .from("line_notification_queue")
    .select("id")
    .eq("dealer_id",   context.dealer_id)
    .eq("customer_id", context.customer_id)
    .in("status", ["scheduled", "processing", "sent"])
    .contains("payload", { dedup_ref: dedupRef })
    .limit(1)
    .maybeSingle();
  if (byRef) return true;

  // (2) MAINTENANCE_DUE cross-dedup: the Sprint 1–3 reminder pipeline already queued a
  // maintenance message for this reminder (payload.reminder_id = job_id) → do not double.
  if (context.event_type === "MAINTENANCE_DUE" && context.job_id) {
    const { data: byReminder } = await supabase
      .from("line_notification_queue")
      .select("id")
      .eq("dealer_id",   context.dealer_id)
      .eq("customer_id", context.customer_id)
      .in("status", ["scheduled", "processing", "sent"])
      .contains("payload", { reminder_id: context.job_id })
      .limit(1)
      .maybeSingle();
    if (byReminder) return true;
  }

  return false;
}

async function audit(
  supabase: SupabaseClient,
  context: EngagementContext,
  action: EngagementAction,
  status: "completed" | "failed" | "skipped",
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("activity_logs").insert({
      dealer_id:   context.dealer_id,
      entity_type: "engagement",
      entity_id:   context.job_id ?? context.customer_id,
      customer_id: context.customer_id,
      action:      `${context.event_type}:${action.type}:${status}`,
      title:       `エンゲージメント: ${action.id}`,
      description: message,
      metadata: {
        trace_id:    context.trace_id,
        event_type:  context.event_type,
        action_id:   action.id,
        action_type: action.type,
        status,
        ...extra,
      },
    });
  } catch {
    // Audit must never block the primary flow.
  }
}

// ─── LINE action (send_line_message / request_review) ──────────────────────────

export async function runLineAction(
  action: EngagementAction,
  context: EngagementContext,
  payload: LineActionPayload,
): Promise<ActionDispatchResult> {
  const supabase = await createClient();

  // Gate: never message a customer who is not LINE-connected.
  if (!(await customerLineConnected(supabase, context.dealer_id, context.customer_id))) {
    await audit(supabase, context, action, "skipped", "顧客がLINE未連携のため送信をスキップしました");
    return { action_id: action.id, action_type: action.type, status: "skipped", error: "顧客がLINE未連携です" };
  }

  const dedupRef = dedupRefOf(context, action);
  if (await alreadyQueued(supabase, context, dedupRef)) {
    await audit(supabase, context, action, "skipped", "重複通知のためスキップしました", { dedup_ref: dedupRef });
    return { action_id: action.id, action_type: action.type, status: "skipped", error: "重複通知のためスキップしました" };
  }

  const scheduledAt = payload.scheduled_for ?? new Date().toISOString();
  const res = await queueLineNotification({
    customer_id:      payload.customer_id,
    line_customer_id: payload.line_customer_id,
    scheduled_at:     scheduledAt,
    message_type:     "text",
    purpose:          payload.purpose,
    title:            null,
    body:             payload.message_text,
    payload: {
      dedup_ref: dedupRef,
      trace_id:  context.trace_id,
      action_id: action.id,
      messages:  [{ type: "text", text: payload.message_text }],
    },
  });

  if ("error" in res) {
    await audit(supabase, context, action, "failed", res.error, { dedup_ref: dedupRef });
    return { action_id: action.id, action_type: action.type, status: "failed", error: res.error };
  }

  await audit(supabase, context, action, "completed", "LINE通知をキューに登録しました", {
    dedup_ref: dedupRef, queue_id: res.id, scheduled_for: payload.scheduled_for,
  });
  return {
    action_id:     action.id,
    action_type:   action.type,
    status:        "completed",
    queue_id:      res.id,
    scheduled_for: payload.scheduled_for,
  };
}

// ─── schedule_maintenance_reminder ─────────────────────────────────────────────

export async function runMaintenanceReminderAction(
  action: EngagementAction,
  context: EngagementContext,
): Promise<ActionDispatchResult> {
  const supabase = await createClient();
  const reminderDays = action.config.reminder_days ?? 30;
  const dueDate = new Date(Date.now() + reminderDays * 86_400_000).toISOString().slice(0, 10);

  const res = await createMaintenanceReminder({
    customer_id:   context.customer_id,
    vehicle_id:    context.vehicle_id ?? null,
    reminder_type: "maintenance",
    status:        "scheduled",
    due_date:      dueDate,
  });

  if ("error" in res) {
    await audit(supabase, context, action, "failed", res.error);
    return { action_id: action.id, action_type: action.type, status: "failed", error: res.error };
  }

  await audit(supabase, context, action, "completed", "メンテナンスリマインダーを作成しました", {
    reminder_id: res.data.id, due_date: dueDate,
  });
  return { action_id: action.id, action_type: action.type, status: "completed", scheduled_for: dueDate };
}
