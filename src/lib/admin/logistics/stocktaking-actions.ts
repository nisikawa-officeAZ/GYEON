"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  StocktakingItem,
  StocktakingSession,
  StocktakingSessionWithItems,
  StocktakingSessionSummary,
  SaveCountInput,
  SaveCountResult,
  StartSessionResult,
  FinalizeResult,
} from "./stocktaking-types";

// ─── Start session ────────────────────────────────────────────────────────────

export async function startStocktakingSession(
  note?: string,
): Promise<StartSessionResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Create session
  const { data: session, error: sessionErr } = await supabase
    .from("inventory_stocktaking_sessions")
    .insert({ started_by: admin.id, note: note || null, status: "active" })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return { success: false, error: sessionErr?.message ?? "セッション作成に失敗しました" };
  }

  // Load all active products
  const { data: products, error: prodErr } = await supabase
    .from("gyeon_products")
    .select("id, jan_code, units_per_case")
    .eq("is_active", true)
    .order("category")
    .order("product_name");

  if (prodErr) {
    return { success: false, error: prodErr.message };
  }

  if (!products || products.length === 0) {
    return { success: false, error: "有効な商品が登録されていません。商品マスターを確認してください。" };
  }

  // Insert one item per product
  const items = (products as { id: string; jan_code: string | null; units_per_case: number | null }[]).map((p) => ({
    session_id:              (session as { id: string }).id,
    product_id:              p.id,
    barcode:                 p.jan_code ?? null,
    units_per_case_snapshot: p.units_per_case ?? 1,
    status:                  "pending",
  }));

  const { error: itemsErr } = await supabase
    .from("inventory_stocktaking_items")
    .insert(items);

  if (itemsErr) {
    // Clean up session if items failed
    await supabase.from("inventory_stocktaking_sessions").delete().eq("id", (session as { id: string }).id);
    return { success: false, error: itemsErr.message };
  }

  return { success: true, sessionId: (session as { id: string }).id };
}

// ─── Get session list ─────────────────────────────────────────────────────────

export async function getStocktakingSessions(): Promise<StocktakingSessionSummary[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [sessionsRes, adminsRes] = await Promise.all([
    supabase
      .from("inventory_stocktaking_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase.from("admin_users").select("id, name"),
  ]);

  const sessions = (sessionsRes.data ?? []) as Record<string, unknown>[];
  const adminMap = new Map<string, string>(
    ((adminsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]),
  );

  // Item counts per session
  const sessionIds = sessions.map((s) => s.id as string);
  let itemCounts: Record<string, { total: number; counted: number }> = {};

  if (sessionIds.length > 0) {
    const { data: counts } = await supabase
      .from("inventory_stocktaking_items")
      .select("session_id, status")
      .in("session_id", sessionIds);

    for (const row of (counts ?? []) as { session_id: string; status: string }[]) {
      if (!itemCounts[row.session_id]) itemCounts[row.session_id] = { total: 0, counted: 0 };
      itemCounts[row.session_id].total++;
      if (row.status !== "pending") itemCounts[row.session_id].counted++;
    }
  }

  return sessions.map((s) => ({
    id:              s.id as string,
    status:          s.status as StocktakingSessionSummary["status"],
    started_at:      s.started_at as string,
    completed_at:    (s.completed_at as string | null) ?? null,
    note:            (s.note as string | null) ?? null,
    total_items:     itemCounts[s.id as string]?.total   ?? 0,
    counted_items:   itemCounts[s.id as string]?.counted ?? 0,
    started_by_name: s.started_by ? (adminMap.get(s.started_by as string) ?? null) : null,
  }));
}

// ─── Get full session with items ──────────────────────────────────────────────

export async function getStocktakingSession(
  sessionId: string,
): Promise<StocktakingSessionWithItems | null> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [sessionRes, itemsRes, adminsRes] = await Promise.all([
    supabase
      .from("inventory_stocktaking_sessions")
      .select("*")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("inventory_stocktaking_items")
      .select("*, gyeon_products(sku, product_name, category, size_label)")
      .eq("session_id", sessionId)
      .order("status")          // pending first
      .order("created_at"),
    supabase.from("admin_users").select("id, name"),
  ]);

  if (sessionRes.error || !sessionRes.data) return null;

  const adminMap = new Map<string, string>(
    ((adminsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]),
  );

  const session = sessionRes.data as Record<string, unknown>;
  const rawItems = (itemsRes.data ?? []) as Record<string, unknown>[];

  const items: StocktakingItem[] = rawItems.map((r) => {
    const product = r.gyeon_products as Record<string, unknown> | null;
    return {
      id:                      r.id as string,
      session_id:              r.session_id as string,
      product_id:              r.product_id as string,
      barcode:                 (r.barcode as string | null) ?? null,
      units_per_case_snapshot: r.units_per_case_snapshot as number,
      expected_quantity:       (r.expected_quantity as number | null) ?? null,
      case_count:              r.case_count as number,
      loose_count:             r.loose_count as number,
      counted_quantity:        r.counted_quantity as number,
      difference_quantity:     (r.difference_quantity as number | null) ?? null,
      counted_by:              (r.counted_by as string | null) ?? null,
      counted_at:              (r.counted_at as string | null) ?? null,
      status:                  r.status as StocktakingItem["status"],
      sku:                     (product?.sku as string) ?? "—",
      product_name:            (product?.product_name as string) ?? "—",
      category:                (product?.category as string | null) ?? null,
      size_label:              (product?.size_label as string | null) ?? null,
    };
  });

  const totalCount  = items.length;
  const doneCount   = items.filter((i) => i.status !== "pending").length;
  const adminName   = session.started_by ? (adminMap.get(session.started_by as string) ?? null) : null;

  return {
    session: session as unknown as StocktakingSession,
    items,
    totalCount,
    doneCount,
    adminName,
  };
}

// ─── Save count ───────────────────────────────────────────────────────────────

export async function saveStocktakingCount(
  input: SaveCountInput,
): Promise<SaveCountResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Verify item belongs to session (security: no client-supplied dealer_id)
  const { data: item, error: fetchErr } = await supabase
    .from("inventory_stocktaking_items")
    .select("id, session_id, units_per_case_snapshot, expected_quantity")
    .eq("id", input.itemId)
    .eq("session_id", input.sessionId)
    .single();

  if (fetchErr || !item) {
    return { success: false, error: "該当するカウントアイテムが見つかりません" };
  }

  const { units_per_case_snapshot, expected_quantity } = item as {
    units_per_case_snapshot: number;
    expected_quantity: number | null;
  };

  const cases  = Math.max(0, Math.floor(input.caseCount));
  const loose  = Math.max(0, Math.floor(input.looseCount));
  const total  = cases * units_per_case_snapshot + loose;
  const diff   = expected_quantity != null ? total - expected_quantity : null;

  const { error: updateErr } = await supabase
    .from("inventory_stocktaking_items")
    .update({
      case_count:          cases,
      loose_count:         loose,
      counted_quantity:    total,
      difference_quantity: diff,
      counted_by:          admin.id,
      counted_at:          new Date().toISOString(),
      status:              "counted",
    })
    .eq("id", input.itemId)
    .eq("session_id", input.sessionId);

  if (updateErr) return { success: false, error: updateErr.message };

  return { success: true, countedQuantity: total };
}

// ─── Skip item ────────────────────────────────────────────────────────────────

export async function skipStocktakingItem(
  sessionId: string,
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("inventory_stocktaking_items")
    .update({ status: "skipped", counted_by: admin.id, counted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("session_id", sessionId);

  return error ? { success: false, error: error.message } : { success: true };
}

// ─── Finalize session ─────────────────────────────────────────────────────────

export async function finalizeStocktaking(sessionId: string): Promise<FinalizeResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Verify session exists and is active
  const { data: session, error: fetchErr } = await supabase
    .from("inventory_stocktaking_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (fetchErr || !session) return { success: false, error: "セッションが見つかりません" };
  if ((session as { status: string }).status !== "active") {
    return { success: false, error: "このセッションはすでに完了またはキャンセルされています" };
  }

  const { error: updateErr } = await supabase
    .from("inventory_stocktaking_sessions")
    .update({
      status:        "completed",
      completed_by:  admin.id,
      completed_at:  new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq("id", sessionId);

  return updateErr ? { success: false, error: updateErr.message } : { success: true };
}

// ─── Cancel session ───────────────────────────────────────────────────────────

export async function cancelStocktakingSession(sessionId: string): Promise<FinalizeResult> {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("inventory_stocktaking_sessions")
    .update({
      status:       "cancelled",
      completed_by:  admin.id,
      completed_at:  new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "active");

  return error ? { success: false, error: error.message } : { success: true };
}
