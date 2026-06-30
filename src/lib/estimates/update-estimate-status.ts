"use server";

// Phase 3 Sprint 1 — Server Action: update an estimate's status only.
//
// Security rules:
//   - Scoped by BOTH id AND dealer_id from getCurrentDealer().
//   - dealer_id is NEVER accepted from client input and is never changed here.
//   - Only the `status` column is written (no schema change introduced).

import { revalidatePath }    from "next/cache";
import { createClient }      from "@/lib/supabase/server";
import { getCurrentDealer }  from "@/lib/auth/get-current-dealer";
import { createActivityLog } from "@/lib/activity/activity-log";
import { estimateStatusLabel, type EstimateStatus } from "./estimate-types";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

// Canonical (lowercase) statuses a user may transition an estimate to.
// NOTE: this is a "use server" module — only the async action may be exported.
// The allow-list and helper are kept local (non-exported) to satisfy that rule.
const ALLOWED_STATUSES = ["draft", "sent", "approved", "rejected", "expired"] as const;
type EstimateStatusInput = (typeof ALLOWED_STATUSES)[number];

function isAllowedEstimateStatus(value: string): value is EstimateStatusInput {
  return (ALLOWED_STATUSES as readonly string[]).includes(value.toLowerCase());
}

export async function updateEstimateStatus(estimateId: string, status: string) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const normalized = status.trim().toLowerCase();
  if (!isAllowedEstimateStatus(normalized)) {
    return { error: "Invalid estimate status." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("estimates")
    .update({ status: normalized, updated_at: new Date().toISOString() })
    .eq("id",        estimateId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateEstimateStatus] error:", error.message);
    return { error: error.message };
  }

  void createActivityLog({
    entity_type: "estimate",
    entity_id:   estimateId,
    action:      "updated",
    title:       `見積ステータスを変更: ${estimateStatusLabel(normalized as EstimateStatus)}`,
  });

  revalidatePath("/estimates");
  return { success: true };
}
