"use server";

// GYEON News Center — admin management (create / edit / publish / archive).
//
// Security:
//   - requireAdmin() enforces an active admin identity; only super_admin /
//     gyeon_admin may manage news (checked below).
//   - Writes use the service-role client (createAdminClient), consistent with
//     other admin actions. created_by is the admin's id (server-resolved) —
//     never trusted from the client.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin }     from "@/lib/admin/require-admin";
import type {
  GyeonNews, NewsCategory, NewsPriority, NewsStatus,
} from "./news-types";
import { NEWS_CATEGORIES, NEWS_PRIORITIES } from "./news-types";

const MANAGE_ROLES = ["super_admin", "gyeon_admin"];

async function requireNewsManager() {
  const admin = await requireAdmin();
  if (!MANAGE_ROLES.includes(admin.role)) {
    throw new Error("ニュース管理の権限がありません");
  }
  return admin;
}

/** All news (incl. drafts/archived) for the admin console. */
export async function getNewsForAdmin(): Promise<GyeonNews[]> {
  await requireNewsManager();
  // Use the dealer/anon server client under the admin's session; the admin RLS
  // policy (FOR ALL) grants full visibility.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyeon_news")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getNewsForAdmin] error:", error.message);
    return [];
  }
  return (data ?? []) as GyeonNews[];
}

export interface NewsInput {
  category:         NewsCategory;
  priority:         NewsPriority;
  title:            string;
  body:             string | null;
  image_url:        string | null;
  pdf_url:          string | null;
  youtube_url:      string | null;
  external_url:     string | null;
  status:           NewsStatus;
  publish_start_at: string | null;
  publish_end_at:   string | null;
}

function sanitize(input: NewsInput) {
  const category: NewsCategory = NEWS_CATEGORIES.includes(input.category) ? input.category : "announcement";
  const priority: NewsPriority = NEWS_PRIORITIES.includes(input.priority) ? input.priority : "normal";
  const status: NewsStatus =
    input.status === "published" || input.status === "archived" ? input.status : "draft";
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    category,
    priority,
    title:            input.title?.trim() || "",
    body:             clean(input.body),
    image_url:        clean(input.image_url),
    pdf_url:          clean(input.pdf_url),
    youtube_url:      clean(input.youtube_url),
    external_url:     clean(input.external_url),
    status,
    publish_start_at: clean(input.publish_start_at),
    publish_end_at:   clean(input.publish_end_at),
  };
}

export async function createNews(input: NewsInput): Promise<{ id: string } | { error: string }> {
  try {
    const admin = await requireNewsManager();
    const payload = sanitize(input);
    if (!payload.title) return { error: "タイトルは必須です" };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("gyeon_news")
      .insert({ ...payload, created_by: admin.id })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/admin/news");
    revalidatePath("/news");
    return { id: (data as { id: string }).id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "作成に失敗しました" };
  }
}

export async function updateNews(id: string, input: NewsInput): Promise<{ success: true } | { error: string }> {
  try {
    await requireNewsManager();
    const payload = sanitize(input);
    if (!payload.title) return { error: "タイトルは必須です" };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("gyeon_news")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/admin/news");
    revalidatePath("/news");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました" };
  }
}

/** Set status to published | archived | draft. */
export async function setNewsStatus(
  id: string, status: NewsStatus,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireNewsManager();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("gyeon_news")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/news");
    revalidatePath("/news");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました" };
  }
}

export async function deleteNews(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireNewsManager();
    const supabase = createAdminClient();
    const { error } = await supabase.from("gyeon_news").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/news");
    revalidatePath("/news");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "削除に失敗しました" };
  }
}
