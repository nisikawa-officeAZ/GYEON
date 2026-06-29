"use server";

// GYEON News Distribution — admin server actions (foundation phase).
//
// Responsibilities:
//   - Resolve dealer recipients from a target audience.
//   - Create queued delivery jobs + recipient rows (news_delivery_jobs /
//     news_delivery_recipients).
//   - Run a TEST send to the current Super Admin only, through the provider
//     abstraction.
//
// SAFETY (foundation phase):
//   - Real dealer jobs are only QUEUED (status 'scheduled', recipients
//     'pending'). They are NOT dispatched here — a future queue worker does that.
//   - Providers are no-ops (see ./delivery/*) and never contact an external
//     service, so NOTHING is actually emailed or LINE-messaged yet.
//   - Writes use the service-role admin client; created_by is server-resolved.

import { revalidatePath }    from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin }      from "@/lib/admin/require-admin";
import { getEmailProvider }  from "./delivery/email-provider";
import { getLineProvider }   from "./delivery/line-provider";
import { normalizeRank }     from "@/lib/ranks/dealer-ranks";
import {
  channelsToDelivery,
  type DeliveryChannel,
  type NewsAudience,
  type NewsChannels,
  type NewsDeliveryJob,
} from "./distribution-types";

const MANAGE_ROLES = ["super_admin", "gyeon_admin"];

async function requireNewsManager() {
  const admin = await requireAdmin();
  if (!MANAGE_ROLES.includes(admin.role)) {
    throw new Error("ニュース配信の権限がありません");
  }
  return admin;
}

interface DealerRecipient {
  dealer_id: string;
  name:      string | null;
  email:     string | null;
}

/** Resolve the dealer recipients for a target audience (soft-deleted excluded). */
async function resolveDealerRecipients(
  audience: NewsAudience,
  selectedIds: string[],
): Promise<DealerRecipient[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("dealers")
    .select("id, name, email, detailer_rank, approval_status")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  type Row = { id: string; name: string | null; email: string | null; detailer_rank: string | null; approval_status: string | null };
  let rows = (data ?? []) as Row[];

  switch (audience) {
    case "certified_dealers":
      rows = rows.filter((d) => normalizeRank(d.detailer_rank) === "certified");
      break;
    case "regular_dealers":
      rows = rows.filter((d) => normalizeRank(d.detailer_rank) !== "certified");
      break;
    case "active_dealers":
      rows = rows.filter((d) => d.approval_status === "approved");
      break;
    case "selected_dealers":
      rows = rows.filter((d) => selectedIds.includes(d.id));
      break;
    case "all_dealers":
    default:
      break;
  }

  return rows.map((d) => ({ dealer_id: d.id, name: d.name, email: d.email }));
}

interface NewsRow {
  id:                string;
  title:             string;
  channels:          NewsChannels;
  target_audience:   NewsAudience;
  target_dealer_ids: string[] | null;
}

async function loadNews(newsId: string): Promise<NewsRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gyeon_news")
    .select("id, title, channels, target_audience, target_dealer_ids")
    .eq("id", newsId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "ニュースが見つかりません");
  return data as NewsRow;
}

// ── Preview ───────────────────────────────────────────────────────────────────

export interface DistributionPreview {
  audience:      NewsAudience;
  channels:      DeliveryChannel[];
  recipientCount: number;
  withEmail:     number;
  withoutEmail:  number;
  sample:        { name: string | null; email: string | null }[];
}

/** Resolve who would receive this news, for the confirmation step. */
export async function getDistributionPreview(newsId: string): Promise<DistributionPreview | { error: string }> {
  try {
    await requireNewsManager();
    const news = await loadNews(newsId);
    const recipients = await resolveDealerRecipients(news.target_audience, news.target_dealer_ids ?? []);
    const withEmail = recipients.filter((r) => !!r.email).length;
    return {
      audience:       news.target_audience,
      channels:       channelsToDelivery(news.channels),
      recipientCount: recipients.length,
      withEmail,
      withoutEmail:   recipients.length - withEmail,
      sample:         recipients.slice(0, 8).map((r) => ({ name: r.name, email: r.email })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "プレビューに失敗しました" };
  }
}

// ── Queue real delivery (no external send) ────────────────────────────────────

/**
 * Create queued delivery jobs for a news item. One job per delivery channel.
 * Recipients are inserted as 'pending'. Nothing is sent — a future worker
 * dispatches the queue. Requires the caller to have confirmed in the UI.
 */
export async function createDelivery(
  newsId: string,
): Promise<{ jobs: NewsDeliveryJob[] } | { error: string }> {
  try {
    const admin = await requireNewsManager();
    const news = await loadNews(newsId);
    const channels = channelsToDelivery(news.channels);
    if (channels.length === 0) {
      return { error: "配信チャネルが「アプリ内のみ」です。メール／LINEを選択してください。" };
    }

    const recipients = await resolveDealerRecipients(news.target_audience, news.target_dealer_ids ?? []);
    if (recipients.length === 0) {
      return { error: "対象店舗が0件です。ターゲットを確認してください。" };
    }

    const supabase = createAdminClient();
    const createdJobs: NewsDeliveryJob[] = [];

    for (const channel of channels) {
      const { data: job, error: jobErr } = await supabase
        .from("news_delivery_jobs")
        .insert({
          news_id:         newsId,
          channel,
          target_audience: news.target_audience,
          status:          "scheduled",
          is_test:         false,
          total_count:     recipients.length,
          pending_count:   recipients.length,
          created_by:      admin.id,
        })
        .select("*")
        .single();

      if (jobErr || !job) return { error: jobErr?.message ?? "配信ジョブの作成に失敗しました" };

      const rows = recipients.map((r) => ({
        job_id:      (job as NewsDeliveryJob).id,
        dealer_id:   r.dealer_id,
        channel,
        destination: channel === "email" ? r.email : null,
        status:      "pending" as const,
      }));
      const { error: recErr } = await supabase.from("news_delivery_recipients").insert(rows);
      if (recErr) return { error: recErr.message };

      createdJobs.push(job as NewsDeliveryJob);
    }

    revalidatePath("/admin/news");
    return { jobs: createdJobs };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "配信の作成に失敗しました" };
  }
}

// ── Test send (Super Admin only target) ───────────────────────────────────────

/**
 * Send a TEST of this news to the current admin's own email/LINE only, through
 * the provider abstraction. In the foundation phase the providers are no-ops,
 * so this records a 'skipped' recipient and contacts no external service.
 */
export async function sendTestDelivery(
  newsId: string,
): Promise<{ jobs: NewsDeliveryJob[] } | { error: string }> {
  try {
    const admin = await requireNewsManager();
    const news = await loadNews(newsId);
    const channels = channelsToDelivery(news.channels);
    if (channels.length === 0) {
      return { error: "テスト送信するチャネル（メール／LINE）を選択してください。" };
    }

    const supabase = createAdminClient();

    // Load body for the message payload.
    const { data: full } = await supabase
      .from("gyeon_news")
      .select("title, summary, body_html, body_text")
      .eq("id", newsId)
      .single();
    const body = (full ?? {}) as { title?: string; summary?: string | null; body_html?: string | null; body_text?: string | null };

    const emailProvider = getEmailProvider();
    const lineProvider  = getLineProvider();
    const createdJobs: NewsDeliveryJob[] = [];

    for (const channel of channels) {
      const destination = channel === "email" ? (admin.email ?? null) : (admin.id ?? null);

      const { data: job, error: jobErr } = await supabase
        .from("news_delivery_jobs")
        .insert({
          news_id:         newsId,
          channel,
          target_audience: news.target_audience,
          status:          "sending",
          is_test:         true,
          total_count:     1,
          pending_count:   1,
          created_by:      admin.id,
        })
        .select("*")
        .single();
      if (jobErr || !job) return { error: jobErr?.message ?? "テストジョブの作成に失敗しました" };
      const jobId = (job as NewsDeliveryJob).id;

      const result =
        channel === "email"
          ? await emailProvider.sendEmail({
              to:      destination ?? "",
              subject: news.title || body.title || "(無題)",
              html:    body.body_html ?? "",
              text:    body.body_text ?? body.summary ?? "",
            })
          : await lineProvider.sendLine({
              to:    destination ?? "",
              title: news.title || body.title || "(無題)",
              text:  body.body_text ?? body.summary ?? "",
            });

      await supabase.from("news_delivery_recipients").insert({
        job_id:        jobId,
        dealer_id:     null,
        channel,
        destination,
        status:        result.status,
        error_message: result.errorMessage ?? null,
        sent_at:       result.status === "sent" ? new Date().toISOString() : null,
      });

      const sent    = result.status === "sent"    ? 1 : 0;
      const failed  = result.status === "failed"  ? 1 : 0;
      const skipped = result.status === "skipped" ? 1 : 0;

      const { data: updated } = await supabase
        .from("news_delivery_jobs")
        .update({
          status:        result.status === "failed" ? "failed" : "sent",
          pending_count: 0,
          sent_count:    sent,
          failed_count:  failed,
          skipped_count: skipped,
          sent_at:       new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("*")
        .single();

      createdJobs.push((updated ?? job) as NewsDeliveryJob);
    }

    revalidatePath("/admin/news");
    return { jobs: createdJobs };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "テスト送信に失敗しました" };
  }
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getDeliveryHistory(newsId?: string): Promise<NewsDeliveryJob[]> {
  await requireNewsManager();
  const supabase = createAdminClient();
  let query = supabase
    .from("news_delivery_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (newsId) query = query.eq("news_id", newsId);
  const { data, error } = await query;
  if (error) {
    console.error("[getDeliveryHistory] error:", error.message);
    return [];
  }
  return (data ?? []) as NewsDeliveryJob[];
}

export async function cancelDelivery(jobId: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireNewsManager();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("news_delivery_jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .in("status", ["draft", "scheduled"]);
    if (error) return { error: error.message };
    revalidatePath("/admin/news");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "キャンセルに失敗しました" };
  }
}
