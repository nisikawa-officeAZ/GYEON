"use server";

// Point Card — dealer-isolated server actions.
//
// Security:
//   - dealer_id is ALWAYS resolved server-side via getCurrentDealer().
//   - dealer_id is NEVER accepted from client input.
//   - RLS additionally scopes every row to the dealer's active membership.

import { revalidatePath }    from "next/cache";
import { createClient }      from "@/lib/supabase/server";
import { getCurrentDealer }  from "@/lib/auth/get-current-dealer";
import { getCurrentUser }    from "@/lib/auth/get-current-user";
import type { PointCardWithCustomer, PointTxnType } from "./point-types";

/** List the dealer's point cards with the customer's name. Never throws. */
export async function getPointCards(): Promise<PointCardWithCustomer[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("point_cards")
      .select("id, dealer_id, customer_id, points_balance, created_at, updated_at, customers ( last_name, first_name )")
      .eq("dealer_id", dealer.dealer_id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[getPointCards] error:", error.message);
      return [];
    }

    return ((data ?? []) as unknown[]).map((r) => {
      const row = r as {
        id: string; dealer_id: string; customer_id: string; points_balance: number;
        created_at: string; updated_at: string;
        customers?: { last_name?: string | null; first_name?: string | null } | null;
      };
      const name = [row.customers?.last_name, row.customers?.first_name].filter(Boolean).join(" ") || "—";
      return { ...row, customer_name: name } as PointCardWithCustomer;
    });
  } catch (err) {
    console.error("[getPointCards] failed:", err);
    return [];
  }
}

/**
 * Apply a points change for a customer (earn / redeem / adjust). Upserts the
 * card, writes a ledger transaction, and updates the running balance.
 */
export async function adjustPoints(
  customerId: string,
  type: PointTxnType,
  points: number,
  reason?: string,
): Promise<{ success: true; balance: number } | { error: string }> {
  try {
    const [dealer, user] = await Promise.all([getCurrentDealer(), getCurrentUser()]);
    if (!dealer) return { error: "認証が必要です" };
    if (!customerId) return { error: "顧客を指定してください" };
    const amount = Math.trunc(points);
    if (!Number.isFinite(amount) || amount <= 0) return { error: "ポイント数を正しく入力してください" };

    const supabase = await createClient();

    // Verify the customer belongs to this dealer (defense in depth alongside RLS).
    const { data: cust } = await supabase
      .from("customers").select("id").eq("id", customerId).eq("dealer_id", dealer.dealer_id).maybeSingle();
    if (!cust) return { error: "顧客が見つかりません" };

    // Get or create the card.
    const { data: existing } = await supabase
      .from("point_cards").select("id, points_balance")
      .eq("dealer_id", dealer.dealer_id).eq("customer_id", customerId).maybeSingle();

    let cardId = (existing as { id: string } | null)?.id ?? null;
    let balance = (existing as { points_balance: number } | null)?.points_balance ?? 0;

    if (!cardId) {
      const { data: created, error: cErr } = await supabase
        .from("point_cards")
        .insert({ dealer_id: dealer.dealer_id, customer_id: customerId, points_balance: 0 })
        .select("id, points_balance").single();
      if (cErr || !created) return { error: cErr?.message ?? "カードの作成に失敗しました" };
      cardId = (created as { id: string }).id;
      balance = 0;
    }

    const delta = type === "redeem" ? -amount : amount; // adjust treated as +; redeem subtracts
    const next = balance + delta;
    if (next < 0) return { error: "残高が不足しています" };

    const { error: txErr } = await supabase.from("point_transactions").insert({
      dealer_id:     dealer.dealer_id,   // server-injected
      customer_id:   customerId,
      point_card_id: cardId,
      type,
      points:        amount,
      reason:        reason?.trim() || null,
      created_by:    user?.id ?? null,
    });
    if (txErr) return { error: txErr.message };

    const { error: upErr } = await supabase
      .from("point_cards").update({ points_balance: next, updated_at: new Date().toISOString() })
      .eq("id", cardId).eq("dealer_id", dealer.dealer_id);
    if (upErr) return { error: upErr.message };

    revalidatePath("/points");
    return { success: true, balance: next };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました" };
  }
}
