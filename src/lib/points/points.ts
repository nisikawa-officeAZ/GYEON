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
import {
  EMPTY_POINTS_SUMMARY,
  type PointCardWithCustomer, type PointTxnType,
  type PointTransactionRow, type PointsSummary, type PointsFilter,
} from "./point-types";

function customerName(c?: { last_name?: string | null; first_name?: string | null } | null): string {
  return [c?.last_name, c?.first_name].filter(Boolean).join(" ") || "—";
}

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

/** Filtered transaction history for the current dealer (customer / type / date range). */
export async function getPointTransactions(filter?: PointsFilter): Promise<PointTransactionRow[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    let q = supabase
      .from("point_transactions")
      .select("id, dealer_id, customer_id, point_card_id, type, points, reason, created_by, created_at, expires_at, reference_type, reference_id, customers ( last_name, first_name )")
      .eq("dealer_id", dealer.dealer_id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (filter?.customer_id) q = q.eq("customer_id", filter.customer_id);
    if (filter?.type && filter.type !== "all") q = q.eq("type", filter.type);
    if (filter?.from) q = q.gte("created_at", `${filter.from}T00:00:00`);
    if (filter?.to)   q = q.lte("created_at", `${filter.to}T23:59:59`);

    const { data, error } = await q;
    if (error) { console.error("[getPointTransactions] error:", error.message); return []; }

    return ((data ?? []) as unknown[]).map((r) => {
      const row = r as Record<string, unknown> & {
        customers?: { last_name?: string | null; first_name?: string | null } | null;
      };
      return {
        id: row.id, dealer_id: row.dealer_id, customer_id: row.customer_id,
        point_card_id: row.point_card_id ?? null, type: row.type, points: row.points,
        reason: row.reason ?? null, created_by: row.created_by ?? null, created_at: row.created_at,
        expires_at: row.expires_at ?? null,
        reference_type: row.reference_type ?? null, reference_id: row.reference_id ?? null,
        customer_name: customerName(row.customers),
      } as PointTransactionRow;
    });
  } catch (err) {
    console.error("[getPointTransactions] failed:", err);
    return [];
  }
}

/** Summary cards: active balance, issued/redeemed this month, expiring within 30 days. */
export async function getPointsSummary(): Promise<PointsSummary> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { ...EMPTY_POINTS_SUMMARY };
    const supabase = await createClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sum = (rows: { points?: number }[] | null) =>
      (rows ?? []).reduce((a, r) => a + (r.points ?? 0), 0);

    const [cards, earned, redeemed, expiring] = await Promise.all([
      supabase.from("point_cards").select("points_balance").eq("dealer_id", dealer.dealer_id),
      supabase.from("point_transactions").select("points").eq("dealer_id", dealer.dealer_id).eq("type", "earn").gte("created_at", monthStart),
      supabase.from("point_transactions").select("points").eq("dealer_id", dealer.dealer_id).eq("type", "redeem").gte("created_at", monthStart),
      supabase.from("point_transactions").select("points").eq("dealer_id", dealer.dealer_id).eq("type", "earn").gte("expires_at", now.toISOString()).lte("expires_at", in30),
    ]);

    return {
      total_active:        ((cards.data ?? []) as { points_balance?: number }[]).reduce((a, r) => a + (r.points_balance ?? 0), 0),
      issued_this_month:   sum(earned.data as { points?: number }[] | null),
      redeemed_this_month: sum(redeemed.data as { points?: number }[] | null),
      expiring_soon:       sum(expiring.data as { points?: number }[] | null),
    };
  } catch (err) {
    console.error("[getPointsSummary] failed:", err);
    return { ...EMPTY_POINTS_SUMMARY };
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
