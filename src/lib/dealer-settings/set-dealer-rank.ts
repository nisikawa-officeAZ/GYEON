"use server";

// Admin-only server action — assigns a dealer rank to a specific dealer.
//
// Security rules:
//   1. Caller must be an authenticated Admin or Super Admin (requireAdmin()).
//   2. Uses service-role client — bypasses RLS deliberately for admin cross-dealer writes.
//   3. dealer_id comes from the function argument, validated against the dealers table.
//   4. Rank values are validated server-side; no client value is trusted.

import { requireAdmin }     from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog }    from "@/lib/admin/write-audit-log";
import type { DetailerRank } from "./dealer-settings-types";
import { DEALER_RANK_VALUES } from "@/lib/ranks/dealer-ranks";

const VALID_RANKS: DetailerRank[] = DEALER_RANK_VALUES;

export async function setDealerRank(
  dealerId: string,
  rank: DetailerRank
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin();

  if (!dealerId?.trim()) {
    return { success: false, error: "ディーラーIDが必要です" };
  }
  if (!VALID_RANKS.includes(rank)) {
    return { success: false, error: "無効なランクです" };
  }

  const supabase = createAdminClient();

  // Verify the target dealer exists before writing.
  const { data: dealer, error: dealerError } = await supabase
    .from("dealers")
    .select("id")
    .eq("id", dealerId)
    .single();

  if (dealerError || !dealer) {
    return { success: false, error: "指定されたディーラーが見つかりません" };
  }

  // Read current rank for audit log.
  const { data: current } = await supabase
    .from("dealer_settings")
    .select("detailer_rank")
    .eq("dealer_id", dealerId)
    .maybeSingle();

  const prevRank = current?.detailer_rank ?? "detailer";

  // Upsert so the action is idempotent even if no dealer_settings row yet exists.
  const { error } = await supabase
    .from("dealer_settings")
    .upsert(
      { dealer_id: dealerId, detailer_rank: rank, updated_at: new Date().toISOString() },
      { onConflict: "dealer_id" }
    );

  if (error) {
    console.error("[setDealerRank] upsert error:", error.message);
    return { success: false, error: "ランクの更新に失敗しました" };
  }

  await writeAuditLog({
    adminUserId:    admin.id,
    targetDealerId: dealerId,
    action:         "rank_assigned",
    details:        { from: prevRank, to: rank },
  });

  return { success: true };
}
