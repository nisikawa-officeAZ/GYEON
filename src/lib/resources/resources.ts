"use server";

// GYEON Resource Center — dealer-facing reads, downloads & history.
//
// Security:
//   - RLS-enforced anon client; dealers see ONLY published resources.
//   - dealer_id / user_id resolved server-side; never from the client.
//   - Downloads are served via short-lived signed URLs (private bucket) and
//     logged to gyeon_resource_downloads for future analytics.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import { RESOURCE_BUCKET, type GyeonResource, type ResourceCategory } from "./resource-types";

export interface ResourceFilter {
  category?: ResourceCategory | "all";
  query?:    string;
}

/** Published resources visible to the current dealer, with optional filtering. */
export async function getPublishedResources(filter?: ResourceFilter): Promise<GyeonResource[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    let q = supabase
      .from("gyeon_resources")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter?.category && filter.category !== "all") {
      q = q.eq("category", filter.category);
    }
    if (filter?.query && filter.query.trim()) {
      const term = filter.query.trim().replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[getPublishedResources] error:", error.message);
      return [];
    }
    return (data ?? []) as GyeonResource[];
  } catch (err) {
    console.error("[getPublishedResources] failed:", err);
    return [];
  }
}

/**
 * Record a download and return a short-lived signed URL for the file.
 * Returns the external/youtube URL untouched for link-only resources.
 */
export async function recordResourceDownload(
  resourceId: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const [dealer, user] = await Promise.all([getCurrentDealer(), getCurrentUser()]);
    if (!dealer || !user) return { error: "認証が必要です" };

    const supabase = await createClient();

    // RLS guarantees the row is published & readable by this dealer.
    const { data: resource, error: rErr } = await supabase
      .from("gyeon_resources")
      .select("id, file_path, external_url, youtube_url")
      .eq("id", resourceId)
      .maybeSingle();

    if (rErr || !resource) return { error: "リソースが見つかりません" };
    const r = resource as { file_path: string | null; external_url: string | null; youtube_url: string | null };

    // Log the download (history for analytics). dealer_id/user_id are server-resolved.
    await supabase.from("gyeon_resource_downloads").insert({
      resource_id: resourceId,
      dealer_id:   dealer.dealer_id,
      user_id:     user.id,
    });

    if (r.file_path) {
      const { data: signed, error: sErr } = await supabase.storage
        .from(RESOURCE_BUCKET)
        .createSignedUrl(r.file_path, 60 * 10); // 10 minutes
      if (sErr || !signed?.signedUrl) return { error: "ダウンロードURLの生成に失敗しました" };
      return { url: signed.signedUrl };
    }

    const link = r.external_url ?? r.youtube_url;
    if (link) return { url: link };
    return { error: "ダウンロード可能なファイルがありません" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ダウンロードに失敗しました" };
  }
}
