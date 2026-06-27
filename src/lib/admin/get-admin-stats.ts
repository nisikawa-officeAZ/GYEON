"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminDashboardStats {
  totalDealers:       number;
  pendingApprovals:   number;
  activeTrials:       number;
  trialsEndingSoon:   number;  // active, trial_end_date within 7 days
  planCounts: {
    basic:    number;
    pro:      number;
    pro_plus: number;
    other:    number;
  };
  certifiedDetailers: number;
}

const ZERO: AdminDashboardStats = {
  totalDealers: 0, pendingApprovals: 0, activeTrials: 0, trialsEndingSoon: 0,
  planCounts: { basic: 0, pro: 0, pro_plus: 0, other: 0 },
  certifiedDetailers: 0,
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await requireAdmin();
  const supabase = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const in7   = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

  try {
    const [total, pending, trials, soon, planRows, certified] = await Promise.all([
      supabase.from("dealers").select("*", { count: "exact", head: true }),
      supabase.from("dealers").select("*", { count: "exact", head: true })
        .eq("approval_status", "pending"),
      supabase.from("dealers").select("*", { count: "exact", head: true })
        .eq("trial_status", "active"),
      supabase.from("dealers").select("*", { count: "exact", head: true })
        .eq("trial_status", "active")
        .gte("trial_end_date", today)
        .lte("trial_end_date", in7),
      supabase.from("dealers").select("plan"),
      supabase.from("dealers").select("*", { count: "exact", head: true })
        .not("detailer_rank", "is", null),
    ]);

    const counts = { basic: 0, pro: 0, pro_plus: 0, other: 0 };
    for (const row of (planRows.data ?? [])) {
      if (row.plan === "basic")    counts.basic++;
      else if (row.plan === "pro") counts.pro++;
      else if (row.plan === "pro_plus") counts.pro_plus++;
      else counts.other++;
    }

    return {
      totalDealers:       total.count       ?? 0,
      pendingApprovals:   pending.count      ?? 0,
      activeTrials:       trials.count       ?? 0,
      trialsEndingSoon:   soon.count         ?? 0,
      planCounts:         counts,
      certifiedDetailers: certified.count    ?? 0,
    };
  } catch {
    return ZERO;
  }
}
