"use server";

// GYEON News Center — dealer-facing reads & read tracking.
//
// Security:
//   - All queries run through the RLS-enforced anon client (createClient()).
//   - dealer_id / user_id are resolved server-side (getCurrentDealer / getCurrentUser).
//   - Dealers can ONLY read published, in-window news (enforced again by RLS).

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import type { DealerNews, GyeonNews } from "./news-types";

/** Published, in-window news for the current dealer, with per-user read state. */
export async function getPublishedNews(): Promise<DealerNews[]> {
  try {
    const [dealer, user] = await Promise.all([getCurrentDealer(), getCurrentUser()]);
    if (!dealer || !user) return [];

    const supabase = await createClient();

    // RLS restricts this to published + in-window rows only.
    const { data: news, error } = await supabase
      .from("gyeon_news")
      .select("*")
      .order("priority", { ascending: false }) // urgent/important float via text order is imperfect; re-sorted below
      .order("publish_start_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getPublishedNews] error:", error.message);
      return [];
    }

    const { data: reads } = await supabase
      .from("gyeon_news_reads")
      .select("news_id")
      .eq("user_id", user.id);

    const readSet = new Set((reads ?? []).map((r) => (r as { news_id: string }).news_id));
    const rank: Record<string, number> = { urgent: 0, important: 1, normal: 2 };

    return ((news ?? []) as GyeonNews[])
      .map((n) => ({ ...n, is_read: readSet.has(n.id) }))
      .sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  } catch (err) {
    console.error("[getPublishedNews] failed:", err);
    return [];
  }
}

/** Count of published news the current user has NOT read (for the nav badge). */
export async function getUnreadNewsCount(): Promise<number> {
  try {
    const [dealer, user] = await Promise.all([getCurrentDealer(), getCurrentUser()]);
    if (!dealer || !user) return 0;

    const supabase = await createClient();

    const { data: news } = await supabase.from("gyeon_news").select("id");
    const ids = (news ?? []).map((n) => (n as { id: string }).id);
    if (ids.length === 0) return 0;

    const { data: reads } = await supabase
      .from("gyeon_news_reads")
      .select("news_id")
      .eq("user_id", user.id);

    const readSet = new Set((reads ?? []).map((r) => (r as { news_id: string }).news_id));
    return ids.filter((id) => !readSet.has(id)).length;
  } catch {
    return 0;
  }
}

/** Mark a single news item as read for the current user (idempotent). */
export async function markNewsRead(newsId: string): Promise<{ success: true } | { error: string }> {
  try {
    const [dealer, user] = await Promise.all([getCurrentDealer(), getCurrentUser()]);
    if (!dealer || !user) return { error: "認証が必要です" };

    const supabase = await createClient();
    // dealer_id/user_id are server-resolved; never trusted from the client.
    const { error } = await supabase
      .from("gyeon_news_reads")
      .upsert(
        { news_id: newsId, dealer_id: dealer.dealer_id, user_id: user.id },
        { onConflict: "news_id,user_id" },
      );

    if (error) {
      console.error("[markNewsRead] error:", error.message);
      return { error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新に失敗しました";
    return { error: msg };
  }
}
