"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { ActivityEntityType, ActivityAction, ActivityLogDB } from "./activity-log-types";

interface CreateActivityLogParams {
  entity_type:  ActivityEntityType;
  entity_id:    string;
  customer_id?: string | null;
  action:       ActivityAction;
  title:        string;
  description?: string | null;
  metadata?:    Record<string, unknown>;
}

/**
 * Creates an activity log entry.
 * ALWAYS resolves dealer_id server-side.
 * NEVER accepts dealer_id as argument.
 * Fails silently — must not block primary business flow.
 */
export async function createActivityLog(params: CreateActivityLogParams): Promise<void> {
  try {
    const [dealer, user] = await Promise.all([
      getCurrentDealer(),
      getCurrentUser(),
    ]);
    if (!dealer) return; // Silently skip if no dealer context

    const supabase = await createClient();
    await supabase.from("activity_logs").insert({
      dealer_id:     dealer.dealer_id,
      actor_user_id: user?.id ?? null,
      entity_type:   params.entity_type,
      entity_id:     params.entity_id,
      customer_id:   params.customer_id ?? null,
      action:        params.action,
      title:         params.title,
      description:   params.description ?? null,
      metadata:      params.metadata ?? {},
    });
    // Intentionally ignore insert errors — logging must not block primary flow
  } catch {
    // Silent failure
  }
}

/**
 * Returns activity logs for a specific customer (newest first, max 50).
 */
export async function getActivityLogsByCustomer(customerId: string): Promise<ActivityLogDB[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("dealer_id", dealer.dealer_id)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data as ActivityLogDB[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Returns activity logs for a specific entity (newest first, max 30).
 */
export async function getActivityLogsByEntity(
  entityType: ActivityEntityType,
  entityId: string
): Promise<ActivityLogDB[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("dealer_id", dealer.dealer_id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(30);

    return (data as ActivityLogDB[]) ?? [];
  } catch {
    return [];
  }
}
