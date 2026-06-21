"use server";

// PHASE64: Billing renewal reminder logic.
// Returns dealers needing renewal contact. No automated email/LINE sending.
// Admin manually contacts dealers based on reminder data.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin }   from "@/lib/admin/get-current-admin";
import type { DealerBilling } from "./billing-types";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Super admin access required");
  return admin;
}

export type RenewalUrgency = "expired" | "7days" | "30days";

export interface RenewalTarget {
  billing:  DealerBilling;
  urgency:  RenewalUrgency;
  daysLeft: number | null;
  dealerName: string;
}

export async function getRenewalTargets(): Promise<RenewalTarget[]> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const now       = new Date();
    const in30Days  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [billingsRes, dealersRes] = await Promise.all([
      supabase
        .from("dealer_billing")
        .select("*")
        .eq("contract_status", "active")
        .lte("renewal_date", in30Days.toISOString())
        .order("renewal_date"),
      supabase.from("dealers").select("id, name"),
    ]);

    const billings = (billingsRes.data ?? []) as DealerBilling[];
    const dealers  = (dealersRes.data  ?? []) as { id: string; name: string }[];
    const dealerNameMap: Record<string, string> = {};
    for (const d of dealers) dealerNameMap[d.id] = d.name;

    const targets: RenewalTarget[] = [];
    for (const b of billings) {
      if (!b.renewal_date) continue;
      const rd = new Date(b.renewal_date);
      const diffMs   = rd.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let urgency: RenewalUrgency;
      if (rd < now)      urgency = "expired";
      else if (daysLeft <= 7) urgency = "7days";
      else               urgency = "30days";

      targets.push({
        billing:    b,
        urgency,
        daysLeft:   rd < now ? null : daysLeft,
        dealerName: dealerNameMap[b.dealer_id] ?? "Unknown",
      });
    }

    // Also add dealers where expires_at is past (active but expired)
    const expiredRes = await supabase
      .from("dealer_billing")
      .select("*")
      .eq("contract_status", "active")
      .lt("expires_at", now.toISOString());

    for (const b of ((expiredRes.data ?? []) as DealerBilling[])) {
      if (targets.find(t => t.billing.id === b.id)) continue;
      targets.push({
        billing:    b,
        urgency:    "expired",
        daysLeft:   null,
        dealerName: dealerNameMap[b.dealer_id] ?? "Unknown",
      });
    }

    return targets;
  } catch {
    return [];
  }
}

export async function createRenewalNotification(params: {
  dealerId:  string;
  urgency:   RenewalUrgency;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const messageMap: Record<RenewalUrgency, string> = {
      expired:  "ご契約期限が過ぎています。更新手続きをお願いします。",
      "7days":  "ご契約期限まで7日以内です。更新手続きをご検討ください。",
      "30days": "ご契約期限まで30日以内です。更新手続きをご検討ください。",
    };

    const { error } = await supabase
      .from("notifications")
      .insert({
        dealer_id: params.dealerId,
        type:      "billing_reminder",
        message:   messageMap[params.urgency],
        read:      false,
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
