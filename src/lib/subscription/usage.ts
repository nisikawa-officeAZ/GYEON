"use server";

// PHASE58: Usage tracking
// Tracks current-month usage against plan limits using existing tables.
// No new usage table needed — document_files, dealer_members, line_message_logs are used.

import { createClient }    from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getPlanLimits }   from "./subscription";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrentUsage {
  staff_count:           number;
  monthly_pdf_count:     number;
  monthly_line_messages: number;
}

export interface UsageLimitResult {
  current: number;
  limit:   number;
  allowed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Returns all usage counts for the current dealer in one round-trip.
 */
export async function getCurrentUsage(): Promise<CurrentUsage> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { staff_count: 0, monthly_pdf_count: 0, monthly_line_messages: 0 };

  const supabase = await createClient();
  const since    = monthStart();

  const [staffRes, pdfRes, lineRes] = await Promise.allSettled([
    supabase
      .from("dealer_members")
      .select("id", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", "active"),
    supabase
      .from("document_files")
      .select("id", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .gte("created_at", since),
    supabase
      .from("line_message_logs")
      .select("id", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .gte("created_at", since),
  ]);

  return {
    staff_count:
      staffRes.status === "fulfilled" ? (staffRes.value.count ?? 0) : 0,
    monthly_pdf_count:
      pdfRes.status === "fulfilled"   ? (pdfRes.value.count ?? 0)   : 0,
    monthly_line_messages:
      lineRes.status === "fulfilled"  ? (lineRes.value.count ?? 0)  : 0,
  };
}

/**
 * Returns whether the dealer can add another staff member.
 */
export async function checkStaffLimit(): Promise<UsageLimitResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { current: 0, limit: 1, allowed: false };

  const supabase = await createClient();
  const { count } = await supabase
    .from("dealer_members")
    .select("id", { count: "exact", head: true })
    .eq("dealer_id", dealer.dealer_id)
    .eq("status", "active");

  const limits  = await getPlanLimits();
  const limit   = typeof limits.staff === "number" ? limits.staff : 1;
  const current = count ?? 0;

  return { current, limit, allowed: current < limit };
}

/**
 * Returns whether the dealer can generate another PDF this month.
 */
export async function checkMonthlyPdfLimit(): Promise<UsageLimitResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { current: 0, limit: 30, allowed: false };

  const supabase = await createClient();
  const { count } = await supabase
    .from("document_files")
    .select("id", { count: "exact", head: true })
    .eq("dealer_id", dealer.dealer_id)
    .gte("created_at", monthStart());

  const limits  = await getPlanLimits();
  const limit   = typeof limits.monthly_pdf_generations === "number"
    ? limits.monthly_pdf_generations
    : 30;
  const current = count ?? 0;

  return { current, limit, allowed: current < limit };
}

/**
 * Returns whether the dealer can send another LINE message this month.
 */
export async function checkMonthlyLineMessageLimit(): Promise<UsageLimitResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { current: 0, limit: 0, allowed: false };

  const supabase = await createClient();

  let current = 0;
  try {
    const { count } = await supabase
      .from("line_message_logs")
      .select("id", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .gte("created_at", monthStart());
    current = count ?? 0;
  } catch {
    // line_message_logs may not exist
  }

  const limits = await getPlanLimits();
  const limit  = typeof limits.monthly_line_messages === "number"
    ? limits.monthly_line_messages
    : 0;

  return { current, limit, allowed: limit > 0 && current < limit };
}
