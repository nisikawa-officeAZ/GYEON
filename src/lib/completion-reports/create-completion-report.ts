"use server";

// Server Action — canonical completion-report resolution (GDA-1W boundary).
//
// This action NO LONGER CREATES REPORTS. Under the accepted contract (§3.1,
// §5, §7.1) there is exactly one canonical completion report per
// (dealer, work order), and it is created ONLY inside the atomic
// `public.complete_work_order_v1` operation reached through the
// `completeWorkOrder` command — which also allocates the authoritative report
// number, derives the report date server-side, and records the confirmed
// monetary-free performed-work snapshot in the same transaction.
//
// The previous behavior of this file is exactly what the contract removes:
//   * a second raw-write path into `completion_reports` (raw INSERT is now
//     revoked at the database, so the old insert would fail anyway);
//   * pre-committed TypeScript numbering (`getNextDocumentNumber`) that burned
//     a number on every failed save (the forbidden legacy one-argument path);
//   * a client-supplied report number and report date; and
//   * an automatic maintenance-reminder side effect on creation (§3.5: the
//     completion transaction must not create reminders; follow-up flows are
//     separately authorized and idempotent).
//
// What remains is fail-closed RESOLUTION for existing callers:
//   * if the canonical report already exists, its id is returned in the same
//     `{ success, id }` shape callers already consume (duplicate creation is
//     structurally impossible — nothing is written);
//   * otherwise the action returns a stable guidance error pointing to the
//     completion flow. No numbering, no estimate fallback, no monetary data,
//     no write, no side effect of any kind.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

/**
 * Stable guidance shown when no canonical report exists yet: the report is
 * born from the completion action, not from a create button.
 */
const COMPLETION_FLOW_REQUIRED =
  "完了報告書は「作業完了」操作で自動的に作成されます。作業指示の編集画面から、実際の終了日時と実施した作業を確認して完了してください。";

export async function createCompletionReport(formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const workOrderId = str(formData, "work_order_id");
  if (!workOrderId) return { error: "Work order ID is required." };

  const supabase = await createClient();

  // Validate work_order_id belongs to the same dealer (unchanged behavior).
  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .select("id")
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (woError || !wo) {
    return { error: "Work order not found or does not belong to your dealer." };
  }

  // Resolve the ONE canonical report, if the atomic completion already
  // created it. Read-only: the (dealer_id, work_order_id) unique index makes
  // maybeSingle() safe, and a resolved id keeps existing "create then open"
  // callers working without any second write path.
  const { data: existing, error: existingError } = await supabase
    .from("completion_reports")
    .select("id")
    .eq("dealer_id",     dealer.dealer_id)
    .eq("work_order_id", workOrderId)
    .maybeSingle();

  if (existingError) {
    console.error("[createCompletionReport] canonical lookup failed:", existingError.message);
    return { error: "Failed to resolve the completion report." };
  }

  if (existing) {
    // Repeated clicks, two tabs, retries: same id every time, zero writes.
    return { success: true, id: existing.id, alreadyExists: true };
  }

  // Fail closed with guidance: the canonical report is created only by the
  // atomic completion operation.
  return { error: COMPLETION_FLOW_REQUIRED };
}
