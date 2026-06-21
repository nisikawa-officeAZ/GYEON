"use server";

// PHASE58: Admin subscription management server actions
// All mutations use createAdminClient() (service_role — bypasses RLS).
// Every action writes an audit log via writeAuditLog().

import { requireAdmin }      from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog }     from "./write-audit-log";
import {
  PlanCode,
  SubscriptionStatus,
  DealerSubscriptionWithPlan,
} from "@/lib/subscription/subscription-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertSubscriptionParams {
  plan_code:                 PlanCode;
  status:                    SubscriptionStatus;
  trial_started_at?:         string | null;
  trial_ends_at?:            string | null;
  current_period_started_at?: string | null;
  current_period_ends_at?:   string | null;
  notes?:                    string | null;
}

// ─── Internal: sync dealers table (backward compat) ──────────────────────────

function toLegacyStatus(
  status: SubscriptionStatus
): "active" | "trial" | "expired" | "cancelled" {
  if (status === "trial")                       return "trial";
  if (status === "cancelled")                   return "cancelled";
  if (status === "past_due" || status === "suspended") return "expired";
  return "active";
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Creates or updates a dealer's subscription record.
 * Also syncs dealers.plan and dealers.subscription_status for backward compat.
 */
export async function upsertDealerSubscription(
  dealerId: string,
  params: UpsertSubscriptionParams
) {
  const admin   = await requireAdmin();
  const supabase = createAdminClient();

  // Check for existing subscription
  const { data: existing } = await supabase
    .from("dealer_subscriptions")
    .select("id, plan_code, status")
    .eq("dealer_id", dealerId)
    .maybeSingle();

  let error: { message: string } | null = null;

  if (existing) {
    const res = await supabase
      .from("dealer_subscriptions")
      .update({ ...params, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    error = res.error;
  } else {
    const res = await supabase
      .from("dealer_subscriptions")
      .insert({ dealer_id: dealerId, ...params });
    error = res.error;
  }

  if (error) return { success: false, error: error.message };

  // Sync dealers table for backward compat
  await supabase
    .from("dealers")
    .update({
      plan:                params.plan_code,
      subscription_status: toLegacyStatus(params.status),
      started_at:          params.current_period_started_at ?? null,
      expired_at:          params.current_period_ends_at ?? params.trial_ends_at ?? null,
    })
    .eq("id", dealerId);

  const action = existing ? "subscription_updated" : "subscription_created";
  await writeAuditLog({
    adminUserId:      admin.id,
    targetDealerId:   dealerId,
    action,
    details: {
      previous: existing
        ? { plan_code: existing.plan_code, status: existing.status }
        : null,
      new: { plan_code: params.plan_code, status: params.status },
    },
  });

  return { success: true };
}

/**
 * Extends or sets a trial end date for a dealer.
 * Updates both dealer_subscriptions and dealers tables.
 */
export async function extendDealerTrial(dealerId: string, trialEndsAt: string) {
  const admin   = await requireAdmin();
  const supabase = createAdminClient();

  // Try new table first
  const { error: subError } = await supabase
    .from("dealer_subscriptions")
    .update({
      status:        "trial",
      trial_ends_at: trialEndsAt,
      updated_at:    new Date().toISOString(),
    })
    .eq("dealer_id", dealerId);

  // Always sync dealers table
  const { error: dealerError } = await supabase
    .from("dealers")
    .update({ subscription_status: "trial", expired_at: trialEndsAt })
    .eq("id", dealerId);

  if (subError && dealerError) {
    return { success: false, error: dealerError.message };
  }

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "trial_extended",
    details:        { trial_ends_at: trialEndsAt },
  });

  return { success: true };
}

/**
 * Updates the notes field on a dealer's subscription.
 */
export async function updateSubscriptionNote(dealerId: string, notes: string) {
  const admin   = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("dealer_subscriptions")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("dealer_id", dealerId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "subscription_note_updated",
    details:        { notes },
  });

  return { success: true };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns all dealer subscriptions (joined with plan) for the admin panel.
 * Returns empty array if dealer_subscriptions table doesn't exist yet.
 */
export async function getDealerSubscriptionsAdmin(): Promise<DealerSubscriptionWithPlan[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("dealer_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []) as DealerSubscriptionWithPlan[];
  } catch {
    return [];
  }
}

/**
 * Returns dealers with merged subscription data.
 * Uses dealer_subscriptions table if available; falls back to dealers.plan columns.
 */
export async function getDealersWithSubscriptionsAdmin() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: dealers, error } = await supabase
    .from("dealers")
    .select("id, name, email, plan, subscription_status, started_at, expired_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Try to enrich with dealer_subscriptions data
  let subscriptions: DealerSubscriptionWithPlan[] = [];
  try {
    const { data } = await supabase
      .from("dealer_subscriptions")
      .select("*, plan:subscription_plans(*)");
    subscriptions = (data ?? []) as DealerSubscriptionWithPlan[];
  } catch {
    // Table not yet created
  }

  const subMap = new Map(subscriptions.map((s) => [s.dealer_id, s]));

  return (dealers ?? []).map((d) => ({
    ...d,
    subscription: subMap.get(d.id) ?? null,
  }));
}
