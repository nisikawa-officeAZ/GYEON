"use server";

// DealerOS — Work Bay batch save/reconcile (Batch B6b).
//
// Reconciles the dealer's work_bays rows to the submitted list:
//   - existing id in list  → update (name/active/capacity/sort_order)
//   - new/unknown          → insert
//   - existing not in list → delete (reservations.work_bay_id → NULL via FK)
//
// Security: dealer_id from requireRole → getCurrentDealer(); never from client.
// Writes require owner/manager (requireRole + RLS). Gated on WORK_BAYS_SCHEMA_READY.

import { createClient }     from "@/lib/supabase/server";
import { requireRole }      from "@/lib/staff/require-role";
import { WORK_BAYS_SCHEMA_READY } from "@/lib/flags";
import type { WorkBayInput } from "./work-bay-types";

function clampCapacity(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  if (v > 50) return 50;
  return v;
}

export async function saveWorkBays(
  bays: WorkBayInput[],
): Promise<{ success: true } | { error: string }> {
  if (!WORK_BAYS_SCHEMA_READY) return { error: "作業ベイ機能は現在利用できません" };
  try {
    const { dealerId } = await requireRole(["owner", "manager"]);
    const supabase = await createClient();

    const { data: current, error: readErr } = await supabase
      .from("work_bays")
      .select("id")
      .eq("dealer_id", dealerId);
    if (readErr) return { error: readErr.message };

    const currentIds = new Set((current ?? []).map((r) => (r as { id: string }).id));
    const incoming = Array.isArray(bays) ? bays : [];
    const keepIds = new Set<string>();
    const now = new Date().toISOString();

    let order = 0;
    for (const b of incoming) {
      const name = (b?.name ?? "").trim();
      if (!name) continue; // skip nameless
      const active = typeof b.active === "boolean" ? b.active : true;
      const capacity = clampCapacity(b.capacity);
      const sort_order = order++;

      if (b.id && currentIds.has(b.id)) {
        keepIds.add(b.id);
        const { error } = await supabase
          .from("work_bays")
          .update({ name, active, capacity, sort_order, updated_at: now })
          .eq("id", b.id)
          .eq("dealer_id", dealerId);
        if (error) return { error: error.message };
      } else {
        const { error } = await supabase
          .from("work_bays")
          .insert({ dealer_id: dealerId, name, active, capacity, sort_order });
        if (error) return { error: error.message };
      }
    }

    const toDelete = [...currentIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("work_bays")
        .delete()
        .eq("dealer_id", dealerId)
        .in("id", toDelete);
      if (error) return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[saveWorkBays] failed:", err);
    return { error: err instanceof Error ? err.message : "保存に失敗しました" };
  }
}
